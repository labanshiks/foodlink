import { body, param } from 'express-validator'
import { ApiError } from '../utils/apiError.js'

const serverControlledFields = [
  'id',
  'donationId',
  'donation_id',
  'recipientId',
  'recipient_id',
  'status',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]

export const reservationIdValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('Reservation ID must be a positive integer.')
    .toInt(),
]

export const reservationCreateValidator = [
  body('requestedCollectionTime')
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('Requested collection time must be a valid ISO 8601 date and time.')
    .toDate(),
  body('message')
    .optional({ nullable: true })
    .isString().withMessage('Message must be text or null.')
    .bail()
    .trim()
    .isLength({ max: 2000 }).withMessage('Message must not exceed 2000 characters.'),
]

export const reservationResponseValidator = [
  body('donorResponse')
    .optional({ nullable: true })
    .isString().withMessage('Donor response must be text or null.')
    .bail()
    .trim()
    .isLength({ max: 2000 }).withMessage('Donor response must not exceed 2000 characters.'),
]

export function rejectServerControlledReservationFields(request, _response, next) {
  const requestBody = request.body ?? {}
  const suppliedFields = serverControlledFields.filter((field) => (
    Object.prototype.hasOwnProperty.call(requestBody, field)
  ))

  if (suppliedFields.length > 0) {
    return next(new ApiError(
      400,
      'SERVER_CONTROLLED_FIELD',
      'Reservation ownership, status, IDs, and timestamps are controlled by the server.',
      suppliedFields.map((field) => ({ field, message: `${field} cannot be supplied by the client.` })),
    ))
  }

  return next()
}
