import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [form, setForm] = useState({ password: '', passwordConfirmation: '' })
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setDetails([])
    if (form.password !== form.passwordConfirmation) {
      setError('Password confirmation must match the new password.')
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post('/auth/reset-password', { token, ...form })
      navigate('/login', { replace: true, state: { message: 'Password reset successful. Login with your new password.' } })
    } catch (requestError) {
      setError(getApiError(requestError, 'The password could not be reset.'))
      setDetails(getApiValidationErrors(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page container py-5">
      <div className="row justify-content-center"><div className="col-md-8 col-lg-5">
        <div className="card border-0 shadow-sm"><div className="card-body p-4 p-md-5">
          <span className="eyebrow text-success">Choose a new password</span>
          <h1 className="h2 fw-bold mt-2">Reset password</h1>
          {!token && <AlertMessage type="warning" message="This reset link does not contain a token. Request a new password reset link." />}
          <AlertMessage message={error} details={details} />
          <form onSubmit={handleSubmit}>
            <div className="mb-3"><label className="form-label" htmlFor="newPassword">New password</label><input className="form-control" type="password" id="newPassword" minLength="8" maxLength="72" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><div className="form-text">8–72 characters with uppercase, lowercase, and a number.</div></div>
            <div className="mb-4"><label className="form-label" htmlFor="newPasswordConfirmation">Confirm new password</label><input className="form-control" type="password" id="newPasswordConfirmation" minLength="8" maxLength="72" autoComplete="new-password" value={form.passwordConfirmation} onChange={(event) => setForm({ ...form, passwordConfirmation: event.target.value })} required /></div>
            <button className="btn btn-success w-100" type="submit" disabled={submitting || !token}>{submitting ? 'Resetting password…' : 'Reset password'}</button>
          </form>
          <p className="text-center small mt-4 mb-0"><Link className="link-success" to="/forgot-password">Request another reset link</Link></p>
        </div></div>
      </div></div>
    </div>
  )
}
