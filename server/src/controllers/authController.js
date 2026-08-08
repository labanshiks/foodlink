import { loginUser, registerUser } from '../services/authService.js'

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
