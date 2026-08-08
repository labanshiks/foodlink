import { Router } from 'express'
import {
  browseDonations,
  cancelMyDonation,
  createMyDonation,
  getDonation,
  getMyDonations,
  updateMyDonation,
  markMyDonationCollected,
} from '../controllers/donationController.js'
import {
  createDonationReservation,
  getDonationReservations,
} from '../controllers/reservationController.js'
import { authenticate, requireDonor, requireRecipient } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  browseDonationsValidator,
  donationIdValidator,
  donationWriteValidator,
  rejectServerControlledDonationFields,
} from '../validators/donationValidators.js'
import {
  rejectServerControlledReservationFields,
  reservationCreateValidator,
} from '../validators/reservationValidators.js'

const router = Router()
const donorOnly = [asyncHandler(authenticate), requireDonor]
const recipientOnly = [asyncHandler(authenticate), requireRecipient]

router.get('/', browseDonationsValidator, validateRequest, asyncHandler(browseDonations))
router.get('/mine', donorOnly, asyncHandler(getMyDonations))
router.get(
  '/:id/reservations',
  donorOnly,
  donationIdValidator,
  validateRequest,
  asyncHandler(getDonationReservations),
)
router.post(
  '/:id/reservations',
  recipientOnly,
  donationIdValidator,
  rejectServerControlledReservationFields,
  reservationCreateValidator,
  validateRequest,
  asyncHandler(createDonationReservation),
)
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
router.patch(
  '/:id/collected',
  donorOnly,
  donationIdValidator,
  validateRequest,
  asyncHandler(markMyDonationCollected),
)

export default router
