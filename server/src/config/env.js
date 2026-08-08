import 'dotenv/config'

const parsedPort = Number.parseInt(process.env.PORT ?? '5000', 10)

if (Number.isNaN(parsedPort)) {
  throw new Error('PORT must be a valid number')
}

export const env = {
  port: parsedPort,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
}

