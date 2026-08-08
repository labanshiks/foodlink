import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js'
import authRoutes from './routes/authRoutes.js'

const app = express()

app.use(cors({ origin: env.clientUrl }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'foodlink-api' })
})

app.use('/api/auth', authRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
