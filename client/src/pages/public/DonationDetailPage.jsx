import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'
import { formatDateTime, formatQuantity, isExpiredDonation, toDateTimeLocal } from '../../utils/formatters.js'

export default function DonationDetailPage() {
  const { id } = useParams()
  const { user, isAuthenticated } = useAuth()
  const [donation, setDonation] = useState(null)
  const [requestedCollectionTime, setRequestedCollectionTime] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get(`/donations/${id}`)
      .then((response) => {
        if (!active) return
        const item = response.data.data.donation
        setDonation(item)
        setRequestedCollectionTime(toDateTimeLocal(item.availableFrom))
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError, 'Donation details could not be loaded.'))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  async function submitReservation(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setDetails([])
    setSuccess('')
    try {
      await apiClient.post(`/donations/${id}/reservations`, {
        requestedCollectionTime: new Date(requestedCollectionTime).toISOString(),
        message: message.trim() || null,
      })
      setSuccess('Your collection request is pending donor review.')
      setMessage('')
    } catch (requestError) {
      setError(getApiError(requestError, 'The reservation request could not be submitted.'))
      setDetails(getApiValidationErrors(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="container py-5"><LoadingSpinner label="Loading donation details…" /></div>
  if (!donation) return <div className="container py-5"><AlertMessage message={error} /></div>

  const organisation = donation.donor?.organisation
  const canRequest = user?.role === 'RECIPIENT' && donation.status === 'AVAILABLE' && !isExpiredDonation(donation)

  return (
    <div className="container py-5">
      <Link className="link-success text-decoration-none" to="/donations">← Back to donations</Link>
      <div className="row g-4 mt-1">
        <div className="col-lg-8">
          <article className="card border-0 shadow-sm overflow-hidden">
            {donation.imageUrl && <img className="donation-detail-image" src={donation.imageUrl} alt={`${donation.title} donation`} />}
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                <span className="eyebrow text-success">{donation.category?.name}</span>
                <StatusBadge status={donation.status} donation={donation} />
              </div>
              <h1 className="display-6 fw-bold">{donation.title}</h1>
              <p className="lead text-secondary">{donation.description}</p>
              <hr />
              <dl className="row detail-list mb-0">
                <dt className="col-sm-4">Quantity</dt><dd className="col-sm-8">{formatQuantity(donation.quantity, donation.quantityUnit)}</dd>
                <dt className="col-sm-4">Available from</dt><dd className="col-sm-8">{formatDateTime(donation.availableFrom)}</dd>
                <dt className="col-sm-4">Collection deadline</dt><dd className="col-sm-8">{formatDateTime(donation.expiresAt)}</dd>
                <dt className="col-sm-4">Collection location</dt><dd className="col-sm-8">{donation.collectionAddress}, {donation.city}</dd>
                <dt className="col-sm-4">Instructions</dt><dd className="col-sm-8">{donation.collectionInstructions || 'No additional instructions.'}</dd>
              </dl>
            </div>
          </article>
        </div>
        <aside className="col-lg-4">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <p className="small text-uppercase text-secondary fw-semibold mb-2">Donated by</p>
              <h2 className="h5">{organisation?.name ?? 'FoodLink donor'}</h2>
              <p className="mb-1">{organisation?.organisationType}</p>
              <p className="text-secondary small mb-0">{organisation?.address}, {organisation?.city}</p>
            </div>
          </div>

          <AlertMessage type="success" message={success} />
          <AlertMessage message={error} details={details} />
          {!isAuthenticated && (
            <div className="card border-success">
              <div className="card-body">
                <h2 className="h5">Interested in this donation?</h2>
                <p className="small text-secondary">Recipient organisations can log in to request collection.</p>
                <Link className="btn btn-success w-100" to="/login">Login to request</Link>
              </div>
            </div>
          )}
          {canRequest && (
            <form className="card border-success" onSubmit={submitReservation}>
              <div className="card-body">
                <h2 className="h5">Request collection</h2>
                <div className="mb-3">
                  <label className="form-label" htmlFor="collectionTime">Requested collection time</label>
                  <input className="form-control" type="datetime-local" id="collectionTime" value={requestedCollectionTime} min={toDateTimeLocal(donation.availableFrom)} max={toDateTimeLocal(donation.expiresAt)} onChange={(event) => setRequestedCollectionTime(event.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="reservationMessage">Message <span className="text-secondary">(optional)</span></label>
                  <textarea className="form-control" id="reservationMessage" rows="3" maxLength="2000" value={message} onChange={(event) => setMessage(event.target.value)} />
                </div>
                <button className="btn btn-success w-100" type="submit" disabled={submitting}>{submitting ? 'Sending request…' : 'Request this donation'}</button>
              </div>
            </form>
          )}
          {isAuthenticated && !canRequest && user.role === 'RECIPIENT' && (
            <AlertMessage type="warning" message="This donation is not currently available for a new request." />
          )}
        </aside>
      </div>
    </div>
  )
}
