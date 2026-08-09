import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { getApiError } from '../../utils/apiErrors.js'
import { formatDateTime } from '../../utils/formatters.js'

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadReservations = useCallback(async () => {
    setError('')
    try {
      const response = await apiClient.get('/reservations/mine')
      setReservations(response.data.data.reservations)
    } catch (requestError) {
      setError(getApiError(requestError, 'Your reservations could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadReservations() }, [loadReservations])

  async function cancelReservation(id) {
    if (!window.confirm('Cancel this pending reservation request?')) return
    setWorkingId(id)
    setError('')
    try {
      await apiClient.patch(`/reservations/${id}/cancel`)
      setSuccess('Reservation request cancelled.')
      await loadReservations()
    } catch (requestError) {
      setError(getApiError(requestError, 'The reservation could not be cancelled.'))
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="container py-5">
      <span className="eyebrow text-success">Recipient workspace</span><h1 className="display-6 fw-bold mt-2 mb-1">My reservations</h1><p className="text-secondary mb-4">Track pending requests, approvals, and completed collections.</p>
      <AlertMessage message={error} /><AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} />
      {loading ? <LoadingSpinner label="Loading your reservations…" /> : reservations.length === 0 ? <EmptyState title="No reservations yet" message="Browse available donations and request a suitable collection." action={<Link className="btn btn-success" to="/donations">Browse donations</Link>} /> : (
        <div className="table-responsive bg-white rounded-4 shadow-sm"><table className="table align-middle mb-0"><thead><tr><th>Donation</th><th>Donor</th><th>Requested collection</th><th>Reservation</th><th>Donation</th><th>Response</th><th /></tr></thead><tbody>
          {reservations.map((reservation) => <tr key={reservation.id}>
            <td><Link className="fw-semibold link-dark" to={`/donations/${reservation.donation.id}`}>{reservation.donation.title}</Link><div className="small text-secondary">{reservation.donation.city}</div></td>
            <td>{reservation.donation.donor?.organisation?.name ?? 'FoodLink donor'}</td>
            <td>{formatDateTime(reservation.requestedCollectionTime)}</td>
            <td><StatusBadge status={reservation.status} /></td>
            <td><StatusBadge status={reservation.donation.status} donation={reservation.donation} /></td>
            <td className="small">{reservation.donorResponse || '—'}</td>
            <td className="text-end">{reservation.status === 'PENDING' && <button className="btn btn-sm btn-outline-danger" type="button" disabled={workingId === reservation.id} onClick={() => cancelReservation(reservation.id)}>Cancel</button>}</td>
          </tr>)}
        </tbody></table></div>
      )}
    </div>
  )
}
