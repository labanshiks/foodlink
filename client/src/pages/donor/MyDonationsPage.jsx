import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { getApiError } from '../../utils/apiErrors.js'
import { formatDateTime, formatQuantity } from '../../utils/formatters.js'

export default function MyDonationsPage() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDonations = useCallback(async () => {
    setError('')
    try {
      const response = await apiClient.get('/donations/mine')
      setDonations(response.data.data.donations)
    } catch (requestError) {
      setError(getApiError(requestError, 'Your donations could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDonations() }, [loadDonations])

  async function changeDonation(id, action) {
    const message = action === 'cancel'
      ? 'Cancel this available donation? Pending requests will be rejected.'
      : 'Confirm that this reserved donation has been collected?'
    if (!window.confirm(message)) return

    setWorkingId(id)
    setError('')
    setSuccess('')
    try {
      await apiClient.patch(`/donations/${id}/${action}`)
      setSuccess(action === 'cancel' ? 'Donation cancelled.' : 'Collection completed successfully.')
      await loadDonations()
    } catch (requestError) {
      setError(getApiError(requestError, 'The donation could not be updated.'))
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="container py-5">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-end gap-3 mb-4">
        <div><span className="eyebrow text-success">Donor workspace</span><h1 className="display-6 fw-bold mt-2 mb-1">My donations</h1><p className="text-secondary mb-0">Manage current listings and review donation history.</p></div>
        <Link className="btn btn-success" to="/donations/new">Create donation</Link>
      </div>
      <AlertMessage message={error} />
      <AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} />
      {loading ? <LoadingSpinner label="Loading your donations…" /> : donations.length === 0 ? (
        <EmptyState title="No donations yet" message="Create your first surplus food listing for recipient organisations." action={<Link className="btn btn-success" to="/donations/new">Create donation</Link>} />
      ) : (
        <div className="table-responsive bg-white rounded-4 shadow-sm">
          <table className="table align-middle mb-0">
            <thead><tr><th>Donation</th><th>Quantity</th><th>Collection window</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
            <tbody>{donations.map((donation) => (
              <tr key={donation.id}>
                <td><strong>{donation.title}</strong><div className="small text-secondary">{donation.category.name} · {donation.city}</div></td>
                <td>{formatQuantity(donation.quantity, donation.quantityUnit)}</td>
                <td className="small"><div>{formatDateTime(donation.availableFrom)}</div><div className="text-secondary">to {formatDateTime(donation.expiresAt)}</div></td>
                <td><StatusBadge status={donation.status} donation={donation} /></td>
                <td><div className="d-flex flex-wrap justify-content-end gap-2">
                  <Link className="btn btn-sm btn-outline-secondary" to={`/donations/${donation.id}`}>View</Link>
                  {donation.status === 'AVAILABLE' && <Link className="btn btn-sm btn-outline-success" to={`/donations/${donation.id}/edit`}>Edit</Link>}
                  {['AVAILABLE', 'RESERVED'].includes(donation.status) && <Link className="btn btn-sm btn-outline-primary" to={`/donations/${donation.id}/requests`}>Requests</Link>}
                  {donation.status === 'AVAILABLE' && <button className="btn btn-sm btn-outline-danger" type="button" disabled={workingId === donation.id} onClick={() => changeDonation(donation.id, 'cancel')}>Cancel</button>}
                  {donation.status === 'RESERVED' && <button className="btn btn-sm btn-success" type="button" disabled={workingId === donation.id} onClick={() => changeDonation(donation.id, 'collected')}>Mark collected</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
