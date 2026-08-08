import 'dotenv/config'

const parsedPort = Number.parseInt(process.env.PORT ?? '5000', 10)

if (Number.isNaN(parsedPort)) {
  throw new Error('PORT must be a valid number')
}

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters')
}

export const env = {
  port: parsedPort,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
}
