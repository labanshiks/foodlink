import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js'
import adminRoutes from './routes/adminRoutes.js'
import authRoutes from './routes/authRoutes.js'
import categoryAdminRoutes from './routes/categoryAdminRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import donationRoutes from './routes/donationRoutes.js'
import organisationRoutes from './routes/organisationRoutes.js'
import reservationRoutes from './routes/reservationRoutes.js'

const app = express()

app.use(cors({ origin: env.clientUrl }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'foodlink-api' })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/categories', categoryAdminRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/organisations', organisationRoutes)
app.use('/api/donations', donationRoutes)
app.use('/api/reservations', reservationRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
