import { Router } from 'express'
import { login, logout, me, register } from '../controllers/authController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { loginValidator, registerValidator } from '../validators/authValidators.js'

const router = Router()

router.post('/register', registerValidator, validateRequest, asyncHandler(register))
router.post('/login', loginValidator, validateRequest, asyncHandler(login))
router.post('/logout', asyncHandler(authenticate), logout)
router.get('/me', asyncHandler(authenticate), me)

export default router
