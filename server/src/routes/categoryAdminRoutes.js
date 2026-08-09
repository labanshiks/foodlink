import { Router } from 'express'
import { getActiveCategories } from '../controllers/categoryController.js'
import {
  addCategory,
  editCategory,
  updateCategoryStatus,
} from '../controllers/adminController.js'
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  categoryIdValidator,
  categoryStatusValidator,
  categoryWriteValidator,
  rejectCategoryStatusFields,
  rejectCategoryWriteFields,
} from '../validators/adminValidators.js'

const router = Router()

router.get('/', asyncHandler(getActiveCategories))
router.use(asyncHandler(authenticate), requireAdmin)
router.post(
  '/',
  rejectCategoryWriteFields,
  categoryWriteValidator,
  validateRequest,
  asyncHandler(addCategory),
)
router.put(
  '/:id',
  categoryIdValidator,
  rejectCategoryWriteFields,
  categoryWriteValidator,
  validateRequest,
  asyncHandler(editCategory),
)
router.patch(
  '/:id/status',
  categoryIdValidator,
  rejectCategoryStatusFields,
  categoryStatusValidator,
  validateRequest,
  asyncHandler(updateCategoryStatus),
)

export default router
