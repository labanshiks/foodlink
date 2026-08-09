import { env } from '../config/env.js'

const developmentTokenSink = new Map()

export function deliverPasswordResetToken(email, rawToken) {
  if (env.nodeEnv !== 'production') {
    developmentTokenSink.set(email.trim().toLowerCase(), rawToken)
  }

  if (env.passwordResetDeliveryMode === 'response') {
    return rawToken
  }

  return null
}

export function getDevelopmentResetToken(email) {
  if (env.nodeEnv === 'production') return null
  return developmentTokenSink.get(email.trim().toLowerCase()) ?? null
}

export function clearDevelopmentResetTokens() {
  developmentTokenSink.clear()
}
