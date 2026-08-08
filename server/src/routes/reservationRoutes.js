import { Router } from 'express'
import {
  approveDonationReservation,
  cancelMyReservation,
  getMyReservations,
  rejectDonationReservation,
} from '../controllers/reservationController.js'
import { authenticate, requireDonor, requireRecipient } from '../middleware/authMiddleware.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  rejectServerControlledReservationFields,
  reservationIdValidator,
  reservationResponseValidator,
} from '../validators/reservationValidators.js'

const router = Router()
const authenticated = asyncHandler(authenticate)

router.get('/mine', authenticated, requireRecipient, asyncHandler(getMyReservations))
router.patch(
  '/:id/cancel',
  authenticated,
  requireRecipient,
  reservationIdValidator,
  rejectServerControlledReservationFields,
  validateRequest,
  asyncHandler(cancelMyReservation),
)
router.patch(
  '/:id/approve',
  authenticated,
  requireDonor,
  reservationIdValidator,
  rejectServerControlledReservationFields,
  validateRequest,
  asyncHandler(approveDonationReservation),
)
router.patch(
  '/:id/reject',
  authenticated,
  requireDonor,
  reservationIdValidator,
  rejectServerControlledReservationFields,
  reservationResponseValidator,
  validateRequest,
  asyncHandler(rejectDonationReservation),
)

export default router
