import { DonationStatus, UserRole, UserStatus } from '@prisma/client'
import { body, param, query } from 'express-validator'
import { ApiError } from '../utils/apiError.js'

function positiveId(label) {
  return param('id')
    .isInt({ min: 1 }).withMessage(`${label} ID must be a positive integer.`)
    .toInt()
}

function optionalSearch(field = 'search') {
  return query(field)
    .optional()
    .trim()
    .notEmpty().withMessage('Search text must not be empty.')
    .isLength({ max: 255 }).withMessage('Search text must not exceed 255 characters.')
}

function rejectUnsupportedBodyFields(allowedFields, message) {
  return (request, _response, next) => {
    const suppliedFields = Object.keys(request.body ?? {})
      .filter((field) => !allowedFields.includes(field))

    if (suppliedFields.length > 0) {
      return next(new ApiError(
        400,
        'UNSUPPORTED_FIELD',
        message,
        suppliedFields.map((field) => ({ field, message: `${field} cannot be supplied here.` })),
      ))
    }

    return next()
  }
}

export const adminUserIdValidator = [positiveId('User')]
export const adminDonationIdValidator = [positiveId('Donation')]
export const categoryIdValidator = [positiveId('Category')]

export const adminUserListValidator = [
  query('role')
    .optional()
    .isIn(Object.values(UserRole)).withMessage('Role filter is invalid.'),
  query('status')
    .optional()
    .isIn(Object.values(UserStatus)).withMessage('User status filter is invalid.'),
  optionalSearch(),
]

export const adminOrganisationListValidator = [
  query('role')
    .optional()
    .isIn([UserRole.DONOR, UserRole.RECIPIENT]).withMessage('Organisation role filter is invalid.'),
  query('city')
    .optional()
    .trim()
    .notEmpty().withMessage('City filter must not be empty.')
    .isLength({ max: 100 }).withMessage('City filter must not exceed 100 characters.'),
  optionalSearch(),
]

export const adminCategoryListValidator = [
  query('active')
    .optional()
    .isBoolean().withMessage('Active filter must be true or false.')
    .toBoolean(),
  optionalSearch(),
]

export const adminDonationListValidator = [
  query('status')
    .optional()
    .isIn(Object.values(DonationStatus)).withMessage('Donation status filter is invalid.'),
  query('city')
    .optional()
    .trim()
    .notEmpty().withMessage('City filter must not be empty.')
    .isLength({ max: 100 }).withMessage('City filter must not exceed 100 characters.'),
  query('category')
    .optional()
    .isInt({ min: 1 }).withMessage('Category filter must be a positive integer.')
    .toInt(),
  query('donor')
    .optional()
    .isInt({ min: 1 }).withMessage('Donor filter must be a positive integer.')
    .toInt(),
  query('expired')
    .optional()
    .isBoolean().withMessage('Expired filter must be true or false.')
    .toBoolean(),
  optionalSearch(),
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'expiry_asc', 'expiry_desc'])
    .withMessage('Sort must be newest, oldest, expiry_asc, or expiry_desc.'),
]

export const userStatusValidator = [
  body('status')
    .exists().withMessage('User status is required.')
    .bail()
    .isIn(Object.values(UserStatus)).withMessage('User status must be ACTIVE or SUSPENDED.'),
]

export const categoryWriteValidator = [
  body('name')
    .isString().withMessage('Category name is required.')
    .bail()
    .trim()
    .notEmpty().withMessage('Category name is required.')
    .isLength({ max: 100 }).withMessage('Category name must not exceed 100 characters.'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Category description must be text or null.')
    .bail()
    .trim(),
]

export const categoryStatusValidator = [
  body('active')
    .exists().withMessage('Category active status is required.')
    .bail()
    .isBoolean({ strict: true }).withMessage('Category active status must be true or false.')
    .toBoolean(),
]

export const rejectUserStatusFields = rejectUnsupportedBodyFields(
  ['status'],
  'Only account status can be changed through this endpoint.',
)

export const rejectCategoryWriteFields = rejectUnsupportedBodyFields(
  ['name', 'description'],
  'Only category name and description can be supplied through this endpoint.',
)

export const rejectCategoryStatusFields = rejectUnsupportedBodyFields(
  ['active'],
  'Only category active status can be changed through this endpoint.',
)

export const rejectAdminCancellationFields = rejectUnsupportedBodyFields(
  [],
  'Administrative cancellation does not accept client-controlled fields.',
)
