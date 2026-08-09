import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { getApiError } from '../../utils/apiErrors.js'
import { formatDateTime } from '../../utils/formatters.js'

export default function DonationRequestsPage() {
  const { id } = useParams()
  const [donation, setDonation] = useState(null)
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    setError('')
    try {
      const [donationResponse, reservationResponse] = await Promise.all([
        apiClient.get(`/donations/${id}`),
        apiClient.get(`/donations/${id}/reservations`),
      ])
      setDonation(donationResponse.data.data.donation)
      setReservations(reservationResponse.data.data.reservations)
    } catch (requestError) {
      setError(getApiError(requestError, 'Reservation requests could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function updateReservation(reservation, action) {
    if (!window.confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this reservation request?`)) return
    const donorResponse = action === 'reject' ? window.prompt('Optional response to the recipient:', '') : null
    if (action === 'reject' && donorResponse === null) return
    setWorkingId(reservation.id)
    setError('')
    try {
      await apiClient.patch(`/reservations/${reservation.id}/${action}`, action === 'reject' ? { donorResponse: donorResponse.trim() || null } : {})
      setSuccess(`Reservation ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await loadData()
    } catch (requestError) {
      setError(getApiError(requestError, 'The reservation could not be updated.'))
    } finally {
      setWorkingId(null)
    }
  }

  async function markCollected() {
    if (!window.confirm('Confirm that this donation has been collected?')) return
    setWorkingId('collection')
    setError('')
    try {
      await apiClient.patch(`/donations/${id}/collected`)
      setSuccess('Donation marked as collected and the approved reservation completed.')
      await loadData()
    } catch (requestError) {
      setError(getApiError(requestError, 'Collection could not be completed.'))
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="container py-5">
      <Link className="link-success text-decoration-none" to="/my-donations">← Back to my donations</Link>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 mt-3 mb-4">
        <div><span className="eyebrow text-success">Reservation review</span><h1 className="display-6 fw-bold mt-2 mb-1">{donation?.title ?? 'Donation requests'}</h1>{donation && <StatusBadge status={donation.status} donation={donation} />}</div>
        {donation?.status === 'RESERVED' && <button type="button" className="btn btn-success" disabled={workingId === 'collection'} onClick={markCollected}>{workingId === 'collection' ? 'Completing…' : 'Mark collected'}</button>}
      </div>
      <AlertMessage message={error} /><AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} />
      {loading ? <LoadingSpinner label="Loading reservation requests…" /> : reservations.length === 0 ? <EmptyState title="No reservation requests" message="Recipient requests will appear here when they are submitted." /> : (
        <div className="row g-3">{reservations.map((reservation) => {
          const recipient = reservation.recipient
          return <div className="col-lg-6" key={reservation.id}><article className="card h-100 border-0 shadow-sm"><div className="card-body p-4">
            <div className="d-flex justify-content-between gap-2"><div><h2 className="h5 mb-1">{recipient.firstName} {recipient.lastName}</h2><p className="text-secondary small">{recipient.organisation?.name ?? 'Recipient organisation'} · {recipient.organisation?.city}</p></div><StatusBadge status={reservation.status} /></div>
            <dl className="row small"><dt className="col-5">Requested time</dt><dd className="col-7">{formatDateTime(reservation.requestedCollectionTime)}</dd><dt className="col-5">Message</dt><dd className="col-7">{reservation.message || 'No message.'}</dd><dt className="col-5">Donor response</dt><dd className="col-7">{reservation.donorResponse || 'No response.'}</dd></dl>
            {reservation.status === 'PENDING' && <div className="d-flex gap-2"><button className="btn btn-success btn-sm" type="button" disabled={workingId === reservation.id} onClick={() => updateReservation(reservation, 'approve')}>Approve</button><button className="btn btn-outline-danger btn-sm" type="button" disabled={workingId === reservation.id} onClick={() => updateReservation(reservation, 'reject')}>Reject</button></div>}
          </div></article></div>
        })}</div>
      )}
    </div>
  )
}
