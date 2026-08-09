const fallbackMessages = {
  ACCOUNT_SUSPENDED: 'This account is suspended. Contact a FoodLink administrator.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  DONATION_NOT_AVAILABLE: 'This donation is no longer available.',
  DONATION_EXPIRED: 'This donation has expired.',
  DONATION_NOT_EDITABLE: 'Only an available donation can be edited.',
  RESERVATION_CONFLICT: 'The reservation state changed. Refresh and try again.',
  RESERVATION_NOT_ACTIONABLE: 'This reservation can no longer be changed.',
  INVALID_RESET_TOKEN: 'The password reset link is invalid.',
  RESET_TOKEN_EXPIRED: 'The password reset link has expired.',
  RESET_TOKEN_USED: 'The password reset link has already been used.',
}

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error.response) {
    return 'FoodLink could not reach the server. Check that the API is running and try again.'
  }

  const apiError = error.response.data?.error
  return fallbackMessages[apiError?.code] ?? apiError?.message ?? fallback
}

export function getApiValidationErrors(error) {
  const details = error.response?.data?.error?.details
  if (!Array.isArray(details)) return []
  return details.map((item) => item.message).filter(Boolean)
}
