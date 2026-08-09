import { body } from 'express-validator'

const normalizeEmail = (value) => String(value).trim().toLowerCase()
const normalizeRole = (value) => String(value).trim().toUpperCase()

function passwordValidator(field = 'password') {
  return body(field)
    .isString().withMessage('Password is required.')
    .isLength({ min: 8, max: 72 }).withMessage('Password must contain between 8 and 72 characters.')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain a number.')
}

export const registerValidator = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required.')
    .isLength({ max: 50 }).withMessage('First name must not exceed 50 characters.'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required.')
    .isLength({ max: 50 }).withMessage('Last name must not exceed 50 characters.'),
  body('email')
    .customSanitizer(normalizeEmail)
    .isEmail().withMessage('A valid email address is required.')
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters.'),
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .isLength({ max: 30 }).withMessage('Phone number must not exceed 30 characters.'),
  passwordValidator(),
  body('role')
    .customSanitizer(normalizeRole)
    .isIn(['DONOR', 'RECIPIENT']).withMessage('Role must be DONOR or RECIPIENT.'),
  body('organisationName')
    .trim()
    .notEmpty().withMessage('Organisation name is required.')
    .isLength({ max: 150 }).withMessage('Organisation name must not exceed 150 characters.'),
  body('organisationType')
    .trim()
    .notEmpty().withMessage('Organisation type is required.')
    .isLength({ max: 100 }).withMessage('Organisation type must not exceed 100 characters.'),
  body('organisationDescription')
    .optional({ nullable: true })
    .trim(),
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required.')
    .isLength({ max: 255 }).withMessage('Address must not exceed 255 characters.'),
  body('city')
    .trim()
    .notEmpty().withMessage('City is required.')
    .isLength({ max: 100 }).withMessage('City must not exceed 100 characters.'),
  body('organisationContactPhone')
    .trim()
    .notEmpty().withMessage('Organisation contact phone is required.')
    .isLength({ max: 30 }).withMessage('Organisation contact phone must not exceed 30 characters.'),
]

export const loginValidator = [
  body('email')
    .customSanitizer(normalizeEmail)
    .isEmail().withMessage('A valid email address is required.'),
  body('password')
    .isString().withMessage('Password is required.')
    .notEmpty().withMessage('Password is required.'),
]

export const forgotPasswordValidator = [
  body('email')
    .customSanitizer(normalizeEmail)
    .isEmail().withMessage('A valid email address is required.')
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters.'),
]

export const resetPasswordValidator = [
  body('token')
    .isString().withMessage('Reset token is required.')
    .bail()
    .trim()
    .matches(/^[a-f0-9]{64}$/i).withMessage('Reset token format is invalid.'),
  passwordValidator(),
  body('passwordConfirmation')
    .isString().withMessage('Password confirmation is required.')
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation must match password.')
      }

      return true
    }),
]
