import { ApiError } from '../utils/apiError.js'

function sendError(response, statusCode, code, message, details) {
  const error = { code, message }

  if (details) {
    error.details = details
  }

  return response.status(statusCode).json({ success: false, error })
}

export function notFoundHandler(request, response) {
  return sendError(
    response,
    404,
    'ROUTE_NOT_FOUND',
    `Route ${request.method} ${request.originalUrl} was not found.`,
  )
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ApiError) {
    return sendError(
      response,
      error.statusCode,
      error.code,
      error.message,
      error.details,
    )
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return sendError(response, 400, 'INVALID_JSON', 'The request body contains invalid JSON.')
  }

  console.error('Unexpected request error:', error.message)
  return sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected server error occurred.')
}
