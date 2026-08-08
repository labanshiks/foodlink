import app from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.port, () => {
  console.log(`FoodLink API listening on http://localhost:${env.port}`)
})

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully.`)

  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
