import 'dotenv/config'

const parsedPort = Number.parseInt(process.env.PORT ?? '5000', 10)
const passwordResetExpiresMinutes = Number.parseInt(
  process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? '30',
  10,
)

if (Number.isNaN(parsedPort)) {
  throw new Error('PORT must be a valid number')
}

if (!Number.isInteger(passwordResetExpiresMinutes) || passwordResetExpiresMinutes <= 0) {
  throw new Error('PASSWORD_RESET_EXPIRES_MINUTES must be a positive integer')
}

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters')
}

const nodeEnv = process.env.NODE_ENV ?? 'development'
const passwordResetDeliveryMode = process.env.PASSWORD_RESET_DELIVERY_MODE ?? 'none'

if (!['none', 'response'].includes(passwordResetDeliveryMode)) {
  throw new Error('PASSWORD_RESET_DELIVERY_MODE must be none or response')
}

if (nodeEnv === 'production' && passwordResetDeliveryMode !== 'none') {
  throw new Error('PASSWORD_RESET_DELIVERY_MODE must be none in production')
}

export const env = {
  nodeEnv,
  port: parsedPort,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  passwordResetExpiresMinutes,
  passwordResetDeliveryMode,
}
