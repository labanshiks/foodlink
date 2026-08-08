import { validationResult } from 'express-validator'
import { ApiError } from '../utils/apiError.js'

export function validateRequest(request, _response, next) {
  const result = validationResult(request)

  if (result.isEmpty()) {
    return next()
  }

  const details = result.array({ onlyFirstError: true }).map((error) => ({
    field: error.path,
    message: error.msg,
  }))

  return next(new ApiError(400, 'VALIDATION_ERROR', 'The request data is invalid.', details))
}
