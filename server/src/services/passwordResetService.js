import { createHash, randomBytes } from 'node:crypto'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { hashPassword } from './authService.js'
import { deliverPasswordResetToken } from './passwordResetDelivery.js'

export const FORGOT_PASSWORD_MESSAGE =
  'If an account matches that email, password reset instructions have been prepared.'

export function hashResetToken(rawToken) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

function generateResetToken() {
  return randomBytes(32).toString('hex')
}

export async function requestPasswordReset(emailInput) {
  const email = emailInput.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })

  let responseToken = null

  if (user) {
    const rawToken = generateResetToken()
    const tokenHash = hashResetToken(rawToken)
    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + env.passwordResetExpiresMinutes * 60 * 1000,
    )

    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      })

      await transaction.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      })
    })

    responseToken = deliverPasswordResetToken(user.email, rawToken)
  } else if (env.passwordResetDeliveryMode === 'response') {
    // A same-shaped development header avoids revealing account existence even in response mode.
    responseToken = generateResetToken()
  }

  return { message: FORGOT_PASSWORD_MESSAGE, responseToken }
}

export async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashResetToken(rawToken)
  const tokenRecord = await prisma.passwordResetToken.findFirst({
    where: { tokenHash },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  })

  if (!tokenRecord) {
    throw new ApiError(400, 'INVALID_RESET_TOKEN', 'The password reset token is invalid.')
  }

  if (tokenRecord.usedAt) {
    throw new ApiError(400, 'RESET_TOKEN_USED', 'The password reset token has already been used.')
  }

  const now = new Date()

  if (tokenRecord.expiresAt <= now) {
    throw new ApiError(400, 'RESET_TOKEN_EXPIRED', 'The password reset token has expired.')
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.passwordResetToken.updateMany({
      where: {
        id: tokenRecord.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    })

    if (consumed.count !== 1) {
      throw new ApiError(
        400,
        'INVALID_RESET_TOKEN',
        'The password reset token is invalid, expired, or already used.',
      )
    }

    await transaction.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash },
    })

    await transaction.passwordResetToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        id: { not: tokenRecord.id },
        usedAt: null,
      },
      data: { usedAt: now },
    })
  })

  return { message: 'Password reset successfully.' }
}
