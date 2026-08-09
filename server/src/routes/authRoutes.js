import { Router } from 'express'
import {
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
} from '../controllers/authController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from '../validators/authValidators.js'

const router = Router()

router.post('/register', registerValidator, validateRequest, asyncHandler(register))
router.post('/login', loginValidator, validateRequest, asyncHandler(login))
router.post(
  '/forgot-password',
  forgotPasswordValidator,
  validateRequest,
  asyncHandler(forgotPassword),
)
router.post(
  '/reset-password',
  resetPasswordValidator,
  validateRequest,
  asyncHandler(resetPassword),
)
router.post('/logout', asyncHandler(authenticate), logout)
router.get('/me', asyncHandler(authenticate), me)

export default router
