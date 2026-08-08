import { body } from 'express-validator'

function requiredString(field, label, maximumLength) {
  return body(field)
    .isString().withMessage(`${label} is required.`)
    .bail()
    .trim()
    .notEmpty().withMessage(`${label} is required.`)
    .isLength({ max: maximumLength }).withMessage(`${label} must not exceed ${maximumLength} characters.`)
}

export const updateOrganisationValidator = [
  requiredString('name', 'Organisation name', 150),
  requiredString('organisationType', 'Organisation type', 100),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be text or null.')
    .bail()
    .trim(),
  requiredString('address', 'Address', 255),
  requiredString('city', 'City', 100),
  requiredString('contactPhone', 'Contact phone', 30),
]
