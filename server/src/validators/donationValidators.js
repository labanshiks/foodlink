import { body, param, query } from 'express-validator'
import { ApiError } from '../utils/apiError.js'

function requiredString(field, label, maximumLength) {
  const validator = body(field)
    .isString().withMessage(`${label} is required.`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${label} is required.`)

  if (maximumLength) {
    validator.isLength({ max: maximumLength }).withMessage(`${label} must not exceed ${maximumLength} characters.`)
  }

  return validator
}

export const donationIdValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('Donation ID must be a positive integer.')
    .toInt(),
]

export const browseDonationsValidator = [
  query('city')
    .optional()
    .trim()
    .notEmpty().withMessage('City filter must not be empty.')
    .isLength({ max: 100 }).withMessage('City filter must not exceed 100 characters.'),
  query('category')
    .optional()
    .isInt({ min: 1 }).withMessage('Category filter must be a positive integer.')
    .toInt(),
  query('search')
    .optional()
    .trim()
    .notEmpty().withMessage('Search text must not be empty.')
    .isLength({ max: 150 }).withMessage('Search text must not exceed 150 characters.'),
  query('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title filter must not be empty.')
    .isLength({ max: 150 }).withMessage('Title filter must not exceed 150 characters.'),
  query('sort')
    .optional()
    .isIn(['expiry_asc', 'expiry_desc']).withMessage('Sort must be expiry_asc or expiry_desc.'),
]

export const donationWriteValidator = [
  body('categoryId')
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer.')
    .toInt(),
  requiredString('title', 'Title', 150),
  requiredString('description', 'Description'),
  body('quantity')
    .isFloat({ gt: 0, lt: 100000000 }).withMessage('Quantity must be greater than zero and within the supported range.')
    .toFloat(),
  requiredString('quantityUnit', 'Quantity unit', 30),
  body('availableFrom')
    .isISO8601({ strict: true, strictSeparator: true }).withMessage('Available-from time must be a valid ISO 8601 date and time.')
    .toDate(),
  body('expiresAt')
    .isISO8601({ strict: true, strictSeparator: true }).withMessage('Expiry time must be a valid ISO 8601 date and time.')
    .bail()
    .toDate()
    .custom((expiresAt, { req }) => {
      const availableFrom = req.body.availableFrom

      if (availableFrom instanceof Date && expiresAt <= availableFrom) {
        throw new Error('Expiry time must be later than the available-from time.')
      }

      return true
    }),
  requiredString('collectionAddress', 'Collection address', 255),
  requiredString('city', 'City', 100),
  body('collectionInstructions')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Collection instructions must be text or null.')
    .bail()
    .trim(),
  body('imageUrl')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Image URL must be a valid HTTP or HTTPS URL.'),
]

const serverControlledFields = [
  'id',
  'donorId',
  'donor_id',
  'status',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]

export function rejectServerControlledDonationFields(request, _response, next) {
  const suppliedFields = serverControlledFields.filter((field) => (
    Object.prototype.hasOwnProperty.call(request.body, field)
  ))

  if (suppliedFields.length > 0) {
    return next(new ApiError(
      400,
      'SERVER_CONTROLLED_FIELD',
      'Donation ownership, status, IDs, and timestamps are controlled by the server.',
      suppliedFields.map((field) => ({ field, message: `${field} cannot be supplied by the client.` })),
    ))
  }

  return next()
}
