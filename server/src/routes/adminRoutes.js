import { Router } from 'express'
import {
  cancelDonationByAdmin,
  getAdminDonations,
  getCategories,
  getOrganisations,
  getUsers,
  updateUserStatus,
} from '../controllers/adminController.js'
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  adminCategoryListValidator,
  adminDonationIdValidator,
  adminDonationListValidator,
  adminOrganisationListValidator,
  adminUserIdValidator,
  adminUserListValidator,
  rejectAdminCancellationFields,
  rejectUserStatusFields,
  userStatusValidator,
} from '../validators/adminValidators.js'

const router = Router()

router.use(asyncHandler(authenticate), requireAdmin)
router.get('/users', adminUserListValidator, validateRequest, asyncHandler(getUsers))
router.patch(
  '/users/:id/status',
  adminUserIdValidator,
  rejectUserStatusFields,
  userStatusValidator,
  validateRequest,
  asyncHandler(updateUserStatus),
)
router.get(
  '/organisations',
  adminOrganisationListValidator,
  validateRequest,
  asyncHandler(getOrganisations),
)
router.get(
  '/categories',
  adminCategoryListValidator,
  validateRequest,
  asyncHandler(getCategories),
)
router.get(
  '/donations',
  adminDonationListValidator,
  validateRequest,
  asyncHandler(getAdminDonations),
)
router.patch(
  '/donations/:id/cancel',
  adminDonationIdValidator,
  rejectAdminCancellationFields,
  validateRequest,
  asyncHandler(cancelDonationByAdmin),
)

export default router
