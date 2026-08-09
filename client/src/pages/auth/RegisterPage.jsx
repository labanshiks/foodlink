import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'

const initialForm = {
  firstName: '', lastName: '', email: '', phoneNumber: '', password: '', passwordConfirmation: '', role: 'DONOR',
  organisationName: '', organisationType: '', organisationDescription: '', address: '', city: '', organisationContactPhone: '',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setDetails([])
    if (form.password !== form.passwordConfirmation) {
      setError('Password confirmation must match the password.')
      return
    }

    setSubmitting(true)
    const payload = { ...form }
    delete payload.passwordConfirmation
    payload.organisationDescription = payload.organisationDescription.trim() || null
    try {
      await apiClient.post('/auth/register', payload)
      navigate('/login', { replace: true, state: { message: 'Registration successful. You can now log in.' } })
    } catch (requestError) {
      setError(getApiError(requestError, 'Registration could not be completed.'))
      setDetails(getApiValidationErrors(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-xl-10">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-lg-5">
              <span className="eyebrow text-success">Create an account</span>
              <h1 className="h2 fw-bold mt-2">Register your organisation</h1>
              <p className="text-secondary">Public registration is available to donor and recipient organisations.</p>
              <AlertMessage message={error} details={details} />
              <form onSubmit={handleSubmit}>
                <fieldset className="mb-4">
                  <legend className="h5 border-bottom pb-2">Account details</legend>
                  <div className="row g-3">
                    <div className="col-md-6"><label className="form-label" htmlFor="firstName">First name</label><input className="form-control" id="firstName" name="firstName" maxLength="50" value={form.firstName} onChange={handleChange} required /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="lastName">Last name</label><input className="form-control" id="lastName" name="lastName" maxLength="50" value={form.lastName} onChange={handleChange} required /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="registerEmail">Email address</label><input className="form-control" type="email" id="registerEmail" name="email" maxLength="255" autoComplete="email" value={form.email} onChange={handleChange} required /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="phoneNumber">Phone number</label><input className="form-control" type="tel" id="phoneNumber" name="phoneNumber" maxLength="30" value={form.phoneNumber} onChange={handleChange} required /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="role">Account role</label><select className="form-select" id="role" name="role" value={form.role} onChange={handleChange}><option value="DONOR">Donor</option><option value="RECIPIENT">Recipient</option></select></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="registerPassword">Password</label><input className="form-control" type="password" id="registerPassword" name="password" minLength="8" maxLength="72" autoComplete="new-password" value={form.password} onChange={handleChange} required /><div className="form-text">8–72 characters with uppercase, lowercase, and a number.</div></div>
                    <div className="col-md-6 offset-md-6"><label className="form-label" htmlFor="passwordConfirmation">Confirm password</label><input className="form-control" type="password" id="passwordConfirmation" name="passwordConfirmation" minLength="8" maxLength="72" autoComplete="new-password" value={form.passwordConfirmation} onChange={handleChange} required /></div>
                  </div>
                </fieldset>

                <fieldset className="mb-4">
                  <legend className="h5 border-bottom pb-2">Organisation profile</legend>
                  <div className="row g-3">
                    <div className="col-md-6"><label className="form-label" htmlFor="organisationName">Organisation name</label><input className="form-control" id="organisationName" name="organisationName" maxLength="150" value={form.organisationName} onChange={handleChange} required /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="organisationType">Organisation type</label><input className="form-control" id="organisationType" name="organisationType" maxLength="100" placeholder={form.role === 'DONOR' ? 'e.g. Restaurant' : 'e.g. Community centre'} value={form.organisationType} onChange={handleChange} required /></div>
                    <div className="col-12"><label className="form-label" htmlFor="organisationDescription">Description <span className="text-secondary">(optional)</span></label><textarea className="form-control" id="organisationDescription" name="organisationDescription" rows="3" value={form.organisationDescription} onChange={handleChange} /></div>
                    <div className="col-md-8"><label className="form-label" htmlFor="address">Address</label><input className="form-control" id="address" name="address" maxLength="255" value={form.address} onChange={handleChange} required /></div>
                    <div className="col-md-4"><label className="form-label" htmlFor="city">City</label><input className="form-control" id="city" name="city" maxLength="100" value={form.city} onChange={handleChange} required /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="organisationContactPhone">Organisation contact phone</label><input className="form-control" type="tel" id="organisationContactPhone" name="organisationContactPhone" maxLength="30" value={form.organisationContactPhone} onChange={handleChange} required /></div>
                  </div>
                </fieldset>
                <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-3">
                  <button className="btn btn-success px-4" type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Register organisation'}</button>
                  <span className="small text-secondary">Already registered? <Link className="link-success" to="/login">Login</Link></span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
