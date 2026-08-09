import { useEffect, useState } from 'react'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { getApiError } from '../../utils/apiErrors.js'

const emptyFilters = { search: '', city: '', role: '' }

export default function AdminOrganisationsPage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [applied, setApplied] = useState(emptyFilters)
  const [organisations, setOrganisations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = Object.fromEntries(Object.entries(applied).filter(([, value]) => value))
    apiClient.get('/admin/organisations', { params }).then((response) => { if (active) setOrganisations(response.data.data.organisations) }).catch((requestError) => { if (active) setError(getApiError(requestError, 'Organisations could not be loaded.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applied])

  return <div className="container py-5"><span className="eyebrow text-success">Administration</span><h1 className="display-6 fw-bold mt-2 mb-1">Organisations</h1><p className="text-secondary mb-4">A read-only view of donor and recipient organisations.</p>
    <form className="filter-panel mb-4" onSubmit={(event) => { event.preventDefault(); setApplied(filters) }}><div className="row g-3 align-items-end"><div className="col-md-5"><label className="form-label" htmlFor="orgSearch">Search</label><input className="form-control" id="orgSearch" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Organisation, address, or user" /></div><div className="col-md-3"><label className="form-label" htmlFor="orgCity">City</label><input className="form-control" id="orgCity" value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })} /></div><div className="col-md-2"><label className="form-label" htmlFor="orgRole">Role</label><select className="form-select" id="orgRole" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">All</option><option>DONOR</option><option>RECIPIENT</option></select></div><div className="col-md-2"><button className="btn btn-success w-100" type="submit">Filter</button></div></div></form>
    <AlertMessage message={error} />{loading ? <LoadingSpinner label="Loading organisations…" /> : organisations.length === 0 ? <EmptyState title="No organisations found" message="Try different filters." /> : <div className="table-responsive bg-white rounded-4 shadow-sm"><table className="table align-middle mb-0"><thead><tr><th>Organisation</th><th>Type</th><th>Location</th><th>Linked user</th><th>Role</th><th>Status</th></tr></thead><tbody>{organisations.map((org) => <tr key={org.id}><td><strong>{org.name}</strong><div className="small text-secondary">{org.contactPhone}</div></td><td>{org.organisationType}</td><td>{org.address}<div className="small text-secondary">{org.city}</div></td><td>{org.user.firstName} {org.user.lastName}<div className="small text-secondary">{org.user.email}</div></td><td>{org.user.role}</td><td><StatusBadge status={org.user.status} /></td></tr>)}</tbody></table></div>}
  </div>
}
