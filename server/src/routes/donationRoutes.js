import { Router } from 'express'
import {
  browseDonations,
  cancelMyDonation,
  createMyDonation,
  getDonation,
  getMyDonations,
  updateMyDonation,
} from '../controllers/donationController.js'
import { authenticate, requireDonor } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  browseDonationsValidator,
  donationIdValidator,
  donationWriteValidator,
  rejectServerControlledDonationFields,
} from '../validators/donationValidators.js'

const router = Router()
const donorOnly = [asyncHandler(authenticate), requireDonor]

router.get('/', browseDonationsValidator, validateRequest, asyncHandler(browseDonations))
router.get('/mine', donorOnly, asyncHandler(getMyDonations))
router.get('/:id', donationIdValidator, validateRequest, asyncHandler(getDonation))
router.post(
  '/',
  donorOnly,
  rejectServerControlledDonationFields,
  donationWriteValidator,
  validateRequest,
  asyncHandler(createMyDonation),
)
router.put(
  '/:id',
  donorOnly,
  donationIdValidator,
  rejectServerControlledDonationFields,
  donationWriteValidator,
  validateRequest,
  asyncHandler(updateMyDonation),
)
router.patch(
  '/:id/cancel',
  donorOnly,
  donationIdValidator,
  validateRequest,
  asyncHandler(cancelMyDonation),
)

export default router
