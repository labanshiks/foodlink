import { useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [success, setSuccess] = useState('')
  const [developmentToken, setDevelopmentToken] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setDetails([])
    setDevelopmentToken('')
    try {
      const response = await apiClient.post('/auth/forgot-password', { email })
      setSuccess(response.data.data.message)
      setDevelopmentToken(response.headers['x-foodlink-development-reset-token'] ?? '')
    } catch (requestError) {
      setError(getApiError(requestError, 'The password reset request could not be submitted.'))
      setDetails(getApiValidationErrors(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-5">
          <div className="card border-0 shadow-sm"><div className="card-body p-4 p-md-5">
            <span className="eyebrow text-success">Account recovery</span>
            <h1 className="h2 fw-bold mt-2">Forgot your password?</h1>
            <p className="text-secondary">Enter your email. For privacy, FoodLink always returns the same response.</p>
            <AlertMessage message={error} details={details} />
            <AlertMessage type="success" message={success} />
            {developmentToken && (
              <div className="alert alert-warning" role="alert">
                <strong>Development reset link</strong>
                <p className="small mb-2">This link appears only when the development API explicitly exposes a controlled token.</p>
                <Link className="btn btn-sm btn-dark" to={`/reset-password?token=${encodeURIComponent(developmentToken)}`}>Open password reset</Link>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-4"><label className="form-label" htmlFor="forgotEmail">Email address</label><input className="form-control" type="email" id="forgotEmail" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
              <button className="btn btn-success w-100" type="submit" disabled={submitting}>{submitting ? 'Preparing instructions…' : 'Request reset instructions'}</button>
            </form>
            <p className="text-center small mt-4 mb-0"><Link className="link-success" to="/login">Return to login</Link></p>
          </div></div>
        </div>
      </div>
    </div>
  )
}
