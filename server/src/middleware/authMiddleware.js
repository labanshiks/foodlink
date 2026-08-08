import { UserRole, UserStatus } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import prisma from '../config/prisma.js'
import { publicUserSelect } from '../services/authService.js'
import { ApiError } from '../utils/apiError.js'

export async function authenticate(request, _response, next) {
  const authorization = request.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid bearer token is required.'))
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token) {
    return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid bearer token is required.'))
  }

  let payload

  try {
    payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'foodlink-api',
      audience: 'foodlink-client',
    })
  } catch {
    return next(new ApiError(401, 'INVALID_TOKEN', 'The authentication token is invalid or expired.'))
  }

  const userId = Number(payload.sub)

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new ApiError(401, 'INVALID_TOKEN', 'The authentication token is invalid or expired.'))
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    })

    if (!user) {
      return next(new ApiError(401, 'INVALID_TOKEN', 'The authentication token is invalid or expired.'))
    }

    if (user.status === UserStatus.SUSPENDED) {
      return next(new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.'))
    }

    request.user = user
    request.auth = { token, payload }
    return next()
  } catch (error) {
    return next(error)
  }
}

export function authorizeRoles(...allowedRoles) {
  return (request, _response, next) => {
    if (!request.user) {
      return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.'))
    }

    if (!allowedRoles.includes(request.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'))
    }

    return next()
  }
}

export const requireDonor = authorizeRoles(UserRole.DONOR)
export const requireRecipient = authorizeRoles(UserRole.RECIPIENT)
export const requireAdmin = authorizeRoles(UserRole.ADMIN)
