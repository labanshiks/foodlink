import { Prisma } from '@prisma/client'
import prisma from '../config/prisma.js'
import { ApiError } from '../utils/apiError.js'

const organisationProfileSelect = {
  id: true,
  name: true,
  organisationType: true,
  description: true,
  address: true,
  city: true,
  contactPhone: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      role: true,
      status: true,
    },
  },
}

function organisationNotFound() {
  return new ApiError(
    404,
    'ORGANISATION_NOT_FOUND',
    'No organisation profile exists for this account.',
  )
}

export async function getOwnOrganisation(userId) {
  const organisation = await prisma.organisation.findUnique({
    where: { userId },
    select: organisationProfileSelect,
  })

  if (!organisation) {
    throw organisationNotFound()
  }

  return organisation
}

export async function updateOwnOrganisation(userId, input) {
  try {
    return await prisma.organisation.update({
      where: { userId },
      data: {
        name: input.name,
        organisationType: input.organisationType,
        description: input.description?.trim() || null,
        address: input.address,
        city: input.city,
        contactPhone: input.contactPhone,
      },
      select: organisationProfileSelect,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw organisationNotFound()
    }

    throw error
  }
}
