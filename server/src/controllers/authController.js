import { loginUser, registerUser } from '../services/authService.js'
import {
  requestPasswordReset,
  resetPassword as resetUserPassword,
} from '../services/passwordResetService.js'

export async function register(request, response) {
  const user = await registerUser(request.body)

  return response.status(201).json({
    success: true,
    data: { user },
  })
}

export async function login(request, response) {
  const result = await loginUser(request.body)

  return response.json({
    success: true,
    data: result,
  })
}

export function logout(_request, response) {
  return response.json({
    success: true,
    data: {
      message: 'Logged out successfully. Remove the token from the client.',
    },
  })
}

export function me(request, response) {
  return response.json({
    success: true,
    data: { user: request.user },
  })
}

export async function forgotPassword(request, response) {
  const result = await requestPasswordReset(request.body.email)

  if (result.responseToken) {
    response.set('X-FoodLink-Development-Reset-Token', result.responseToken)
  }

  return response.json({
    success: true,
    data: { message: result.message },
  })
}

export async function resetPassword(request, response) {
  const result = await resetUserPassword(request.body.token, request.body.password)

  return response.json({
    success: true,
    data: result,
  })
}
