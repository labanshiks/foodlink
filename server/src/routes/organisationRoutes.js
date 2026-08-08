import { UserRole } from '@prisma/client'
import { Router } from 'express'
import {
  getMyOrganisation,
  updateMyOrganisation,
} from '../controllers/organisationController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { updateOrganisationValidator } from '../validators/organisationValidators.js'

const router = Router()
const requireOrganisationRole = authorizeRoles(UserRole.DONOR, UserRole.RECIPIENT)

router.use(asyncHandler(authenticate), requireOrganisationRole)

router.get('/me', asyncHandler(getMyOrganisation))
router.put(
  '/me',
  updateOrganisationValidator,
  validateRequest,
  asyncHandler(updateMyOrganisation),
)

export default router
