import { useEffect, useState } from 'react'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { getApiError } from '../../utils/apiErrors.js'

const emptyFilters = { search: '', role: '', status: '' }

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [filters, setFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value))
    apiClient.get('/admin/users', { params }).then((response) => { if (active) setUsers(response.data.data.users) }).catch((requestError) => { if (active) setError(getApiError(requestError, 'Users could not be loaded.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [appliedFilters])

  async function changeStatus(user) {
    const status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    if (status === 'SUSPENDED' && !window.confirm(`Suspend ${user.firstName} ${user.lastName}? They will lose protected access.`)) return
    setWorkingId(user.id)
    setError('')
    try {
      const response = await apiClient.patch(`/admin/users/${user.id}/status`, { status })
      setUsers((items) => items.map((item) => item.id === user.id ? response.data.data.user : item))
      setSuccess(`Account ${status === 'ACTIVE' ? 'reactivated' : 'suspended'}.`)
    } catch (requestError) {
      setError(getApiError(requestError, 'The account status could not be updated.'))
    } finally {
      setWorkingId(null)
    }
  }

  return <div className="container py-5"><span className="eyebrow text-success">Administration</span><h1 className="display-6 fw-bold mt-2 mb-1">Users</h1><p className="text-secondary mb-4">Review accounts and control platform access.</p>
    <form className="filter-panel mb-4" onSubmit={(event) => { event.preventDefault(); setAppliedFilters(filters) }}><div className="row g-3 align-items-end"><div className="col-md-5"><label className="form-label" htmlFor="userSearch">Search</label><input className="form-control" id="userSearch" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name or email" /></div><div className="col-md-3"><label className="form-label" htmlFor="userRole">Role</label><select className="form-select" id="userRole" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">All roles</option><option>DONOR</option><option>RECIPIENT</option><option>ADMIN</option></select></div><div className="col-md-2"><label className="form-label" htmlFor="userStatus">Status</label><select className="form-select" id="userStatus" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option>ACTIVE</option><option>SUSPENDED</option></select></div><div className="col-md-2"><button className="btn btn-success w-100" type="submit">Filter</button></div></div></form>
    <AlertMessage message={error} /><AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} />
    {loading ? <LoadingSpinner label="Loading users…" /> : users.length === 0 ? <EmptyState title="No users found" message="Try different filters." /> : <div className="table-responsive bg-white rounded-4 shadow-sm"><table className="table align-middle mb-0"><thead><tr><th>User</th><th>Role</th><th>Organisation</th><th>Activity</th><th>Status</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.firstName} {user.lastName}</strong><div className="small text-secondary">{user.email}</div></td><td>{user.role}</td><td>{user.organisation?.name ?? '—'}</td><td className="small">{user._count.donations} donations · {user._count.reservations} reservations</td><td><StatusBadge status={user.status} /></td><td className="text-end"><button className={`btn btn-sm ${user.status === 'ACTIVE' ? 'btn-outline-danger' : 'btn-outline-success'}`} type="button" disabled={workingId === user.id || (user.id === currentUser.id && user.status === 'ACTIVE')} title={user.id === currentUser.id ? 'You cannot suspend your own account.' : ''} onClick={() => changeStatus(user)}>{user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button></td></tr>)}</tbody></table></div>}
  </div>
}
