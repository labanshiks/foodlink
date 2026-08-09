import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { getApiError } from '../../utils/apiErrors.js'
import { formatDateTime, formatQuantity } from '../../utils/formatters.js'

const emptyFilters = { search: '', status: '', city: '', category: '', donor: '', expired: '', sort: 'newest' }

export default function AdminDonationsPage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [applied, setApplied] = useState(emptyFilters)
  const [donations, setDonations] = useState([])
  const [categories, setCategories] = useState([])
  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = Object.fromEntries(Object.entries(applied).filter(([, value]) => value !== ''))
    Promise.all([apiClient.get('/admin/donations', { params }), apiClient.get('/admin/categories'), apiClient.get('/admin/users', { params: { role: 'DONOR' } })]).then(([donationResponse, categoryResponse, donorResponse]) => {
      if (!active) return
      setDonations(donationResponse.data.data.donations); setCategories(categoryResponse.data.data.categories); setDonors(donorResponse.data.data.users)
    }).catch((requestError) => { if (active) setError(getApiError(requestError, 'Administrative donation data could not be loaded.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applied])

  async function cancelDonation(donation) {
    if (!window.confirm(`Administratively cancel “${donation.title}”? Pending requests will be rejected.`)) return
    setWorkingId(donation.id); setError('')
    try {
      const response = await apiClient.patch(`/admin/donations/${donation.id}/cancel`)
      setDonations((items) => items.map((item) => item.id === donation.id ? { ...item, ...response.data.data.donation } : item))
      setSuccess('Donation cancelled by administrator.')
    } catch (requestError) { setError(getApiError(requestError, 'The donation could not be cancelled.')) } finally { setWorkingId(null) }
  }

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }

  return <div className="container py-5"><span className="eyebrow text-success">Administration</span><h1 className="display-6 fw-bold mt-2 mb-1">Donations</h1><p className="text-secondary mb-4">Review platform listings across all donor organisations.</p>
    <form className="filter-panel mb-4" onSubmit={(event) => { event.preventDefault(); setApplied(filters) }}><div className="row g-3 align-items-end"><div className="col-md-4 col-xl-3"><label className="form-label" htmlFor="adminDonationSearch">Search</label><input className="form-control" id="adminDonationSearch" name="search" value={filters.search} onChange={updateFilter} /></div><div className="col-md-4 col-xl-2"><label className="form-label" htmlFor="adminDonationStatus">Status</label><select className="form-select" id="adminDonationStatus" name="status" value={filters.status} onChange={updateFilter}><option value="">All</option><option>AVAILABLE</option><option>RESERVED</option><option>COLLECTED</option><option>CANCELLED</option></select></div><div className="col-md-4 col-xl-2"><label className="form-label" htmlFor="adminDonationCity">City</label><input className="form-control" id="adminDonationCity" name="city" value={filters.city} onChange={updateFilter} /></div><div className="col-md-4 col-xl-2"><label className="form-label" htmlFor="adminDonationCategory">Category</label><select className="form-select" id="adminDonationCategory" name="category" value={filters.category} onChange={updateFilter}><option value="">All</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="col-md-4 col-xl-3"><label className="form-label" htmlFor="adminDonationDonor">Donor</label><select className="form-select" id="adminDonationDonor" name="donor" value={filters.donor} onChange={updateFilter}><option value="">All</option>{donors.map((donor) => <option key={donor.id} value={donor.id}>{donor.organisation?.name ?? donor.email}</option>)}</select></div><div className="col-md-4 col-xl-3"><label className="form-label" htmlFor="adminDonationExpired">Expiry</label><select className="form-select" id="adminDonationExpired" name="expired" value={filters.expired} onChange={updateFilter}><option value="">All</option><option value="true">Expired</option><option value="false">Not expired</option></select></div><div className="col-md-4 col-xl-3"><label className="form-label" htmlFor="adminDonationSort">Sort</label><select className="form-select" id="adminDonationSort" name="sort" value={filters.sort} onChange={updateFilter}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="expiry_asc">Expiry ascending</option><option value="expiry_desc">Expiry descending</option></select></div><div className="col-md-4 col-xl-2"><button className="btn btn-success w-100" type="submit">Apply filters</button></div></div></form>
    <AlertMessage message={error} /><AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} />{loading ? <LoadingSpinner label="Loading donations…" /> : donations.length === 0 ? <EmptyState title="No donations found" message="Try changing the administrative filters." /> : <div className="table-responsive bg-white rounded-4 shadow-sm"><table className="table align-middle mb-0"><thead><tr><th>Donation</th><th>Donor</th><th>Quantity</th><th>Expiry</th><th>Requests</th><th>Status</th><th /></tr></thead><tbody>{donations.map((donation) => <tr key={donation.id}><td><Link className="fw-semibold link-dark" to={`/donations/${donation.id}`}>{donation.title}</Link><div className="small text-secondary">{donation.category.name} · {donation.city}</div></td><td>{donation.donor.organisation?.name ?? donation.donor.email}</td><td>{formatQuantity(donation.quantity, donation.quantityUnit)}</td><td>{formatDateTime(donation.expiresAt)}</td><td>{donation._count.reservations}</td><td><StatusBadge status={donation.status} donation={donation} /></td><td className="text-end">{donation.status === 'AVAILABLE' && <button className="btn btn-sm btn-outline-danger" type="button" disabled={workingId === donation.id} onClick={() => cancelDonation(donation)}>Cancel</button>}</td></tr>)}</tbody></table></div>}
  </div>
}
