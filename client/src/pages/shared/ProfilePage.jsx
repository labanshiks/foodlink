import { useEffect, useState } from 'react'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'

const emptyProfile = { name: '', organisationType: '', description: '', address: '', city: '', contactPhone: '' }

export default function ProfilePage() {
  const [form, setForm] = useState(emptyProfile)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get('/organisations/me')
      .then((response) => {
        if (!active) return
        const organisation = response.data.data.organisation
        setForm({
          name: organisation.name,
          organisationType: organisation.organisationType,
          description: organisation.description ?? '',
          address: organisation.address,
          city: organisation.city,
          contactPhone: organisation.contactPhone,
        })
        setAccount(organisation.user)
      })
      .catch((requestError) => { if (active) setError(getApiError(requestError, 'Your organisation profile could not be loaded.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setDetails([])
    setSuccess('')
    try {
      await apiClient.put('/organisations/me', { ...form, description: form.description.trim() || null })
      setSuccess('Organisation profile updated successfully.')
    } catch (requestError) {
      setError(getApiError(requestError, 'Your organisation profile could not be updated.'))
      setDetails(getApiValidationErrors(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="container py-5"><LoadingSpinner label="Loading organisation profile…" /></div>

  return (
    <div className="container py-5"><div className="row g-4">
      <div className="col-lg-4"><div className="card border-0 shadow-sm"><div className="card-body p-4"><span className="eyebrow text-success">Account owner</span><h1 className="h4 mt-2">{account?.firstName} {account?.lastName}</h1><p className="mb-1">{account?.email}</p><p className="text-secondary mb-1">{account?.phoneNumber}</p><span className="badge text-bg-light border">{account?.role}</span></div></div></div>
      <div className="col-lg-8"><div className="card border-0 shadow-sm"><div className="card-body p-4 p-lg-5"><h2 className="h3 fw-bold">Organisation profile</h2><p className="text-secondary">This information identifies your organisation across FoodLink.</p><AlertMessage message={error} details={details} /><AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} />
        <form onSubmit={handleSubmit}><div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="profileName">Organisation name</label><input className="form-control" id="profileName" name="name" maxLength="150" value={form.name} onChange={handleChange} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="profileType">Organisation type</label><input className="form-control" id="profileType" name="organisationType" maxLength="100" value={form.organisationType} onChange={handleChange} required /></div>
          <div className="col-12"><label className="form-label" htmlFor="profileDescription">Description <span className="text-secondary">(optional)</span></label><textarea className="form-control" id="profileDescription" name="description" rows="4" value={form.description} onChange={handleChange} /></div>
          <div className="col-md-8"><label className="form-label" htmlFor="profileAddress">Address</label><input className="form-control" id="profileAddress" name="address" maxLength="255" value={form.address} onChange={handleChange} required /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="profileCity">City</label><input className="form-control" id="profileCity" name="city" maxLength="100" value={form.city} onChange={handleChange} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="profilePhone">Contact phone</label><input className="form-control" type="tel" id="profilePhone" name="contactPhone" maxLength="30" value={form.contactPhone} onChange={handleChange} required /></div>
          <div className="col-12 mt-4"><button className="btn btn-success" type="submit" disabled={submitting}>{submitting ? 'Saving profile…' : 'Save profile'}</button></div>
        </div></form>
      </div></div></div>
    </div></div>
  )
}
