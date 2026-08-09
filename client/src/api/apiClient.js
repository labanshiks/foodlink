import axios from 'axios'

export const AUTH_TOKEN_KEY = 'foodlink_auth_token'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  headers: { Accept: 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem(AUTH_TOKEN_KEY)) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      window.dispatchEvent(new Event('foodlink:unauthorized'))
    }

    return Promise.reject(error)
  },
)

export default apiClient
