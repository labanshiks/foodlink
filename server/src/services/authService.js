import { Prisma, UserRole, UserStatus } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import prisma from '../config/prisma.js'
import { ApiError } from '../utils/apiError.js'

const BCRYPT_ROUNDS = 12
const DUMMY_PASSWORD_HASH = await bcrypt.hash('FoodLink invalid login timing value', BCRYPT_ROUNDS)

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organisation: {
    select: {
      id: true,
      name: true,
      organisationType: true,
      description: true,
      address: true,
      city: true,
      contactPhone: true,
      createdAt: true,
      updatedAt: true,
    },
  },
}

function createToken(user) {
  return jwt.sign(
    { role: user.role },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      subject: String(user.id),
      issuer: 'foodlink-api',
      audience: 'foodlink-client',
      expiresIn: env.jwtExpiresIn,
    },
  )
}

export async function registerUser(input) {
  if (![UserRole.DONOR, UserRole.RECIPIENT].includes(input.role)) {
    throw new ApiError(400, 'INVALID_ROLE', 'Public registration allows DONOR and RECIPIENT accounts only.')
  }

  const email = input.email.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email,
          passwordHash,
          phoneNumber: input.phoneNumber,
          role: input.role,
        },
      })

      await transaction.organisation.create({
        data: {
          userId: user.id,
          name: input.organisationName,
          organisationType: input.organisationType,
          description: input.organisationDescription || null,
          address: input.address,
          city: input.city,
          contactPhone: input.organisationContactPhone,
        },
      })

      return transaction.user.findUnique({
        where: { id: user.id },
        select: publicUserSelect,
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'EMAIL_IN_USE', 'An account with this email already exists.')
    }

    throw error
  }
}

export async function loginUser(input) {
  const email = input.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email },
  })

  const passwordIsValid = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  )

  if (!user || !passwordIsValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.')
  }

  const publicUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: publicUserSelect,
  })

  return {
    token: createToken(user),
    user: publicUser,
  }
}
