import { Router } from 'express'
import { showDashboard } from '../controllers/dashboardController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(authenticate), asyncHandler(showDashboard))

export default router
