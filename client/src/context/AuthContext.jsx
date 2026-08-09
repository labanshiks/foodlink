import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient, { AUTH_TOKEN_KEY } from '../api/apiClient.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => clearSession()
    window.addEventListener('foodlink:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('foodlink:unauthorized', handleUnauthorized)
  }, [clearSession])

  useEffect(() => {
    let active = true

    async function restoreSession() {
      if (!token) {
        if (active) setLoading(false)
        return
      }

      try {
        const response = await apiClient.get('/auth/me')
        if (active) setUser(response.data.data.user)
      } catch {
        if (active) clearSession()
      } finally {
        if (active) setLoading(false)
      }
    }

    restoreSession()
    return () => { active = false }
  }, [clearSession, token])

  const login = useCallback(async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials)
    const session = response.data.data
    localStorage.setItem(AUTH_TOKEN_KEY, session.token)
    setToken(session.token)
    setUser(session.user)
    return session.user
  }, [])

  const logout = useCallback(async () => {
    try {
      if (token) await apiClient.post('/auth/logout')
    } finally {
      clearSession()
    }
  }, [clearSession, token])

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
  }), [loading, login, logout, token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
