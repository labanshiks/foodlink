import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { getApiError } from '../../utils/apiErrors.js'

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const loggedInUser = await login(form)
      const requestedPath = location.state?.from?.pathname
      navigate(requestedPath || (loggedInUser.role === 'ADMIN' ? '/admin' : '/dashboard'), { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, 'Login was unsuccessful.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-md-5">
              <span className="eyebrow text-success">Welcome back</span>
              <h1 className="h2 fw-bold mt-2">Login to FoodLink</h1>
              <p className="text-secondary">Continue coordinating food donations with your organisation.</p>
              <AlertMessage type="success" message={location.state?.message} />
              <AlertMessage message={error} />
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="loginEmail">Email address</label>
                  <input className="form-control" type="email" id="loginEmail" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="loginPassword">Password</label>
                  <input className="form-control" type="password" id="loginPassword" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </div>
                <div className="d-flex justify-content-end mb-4">
                  <Link className="link-success" to="/forgot-password">Forgot password?</Link>
                </div>
                <button className="btn btn-success w-100" type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Login'}</button>
              </form>
              <p className="text-center small text-secondary mt-4 mb-0">New to FoodLink? <Link className="link-success" to="/register">Register your organisation</Link>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
