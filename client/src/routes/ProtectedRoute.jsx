import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute({ roles }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner label="Restoring your FoodLink session…" />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
