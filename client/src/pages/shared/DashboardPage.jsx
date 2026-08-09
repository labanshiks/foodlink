import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import MetricCard from '../../components/common/MetricCard.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { getApiError } from '../../utils/apiErrors.js'
import { formatDateTime } from '../../utils/formatters.js'

function DonorDashboard({ dashboard }) {
  const { donations, reservations } = dashboard.metrics
  return <><div className="row g-3 mb-5"><MetricCard label="Total donations" value={donations.total} /><MetricCard label="Active listings" value={donations.active} /><MetricCard label="Reserved" value={donations.reserved} /><MetricCard label="Pending requests" value={reservations.pendingRequests} /></div>
    <div className="row g-4"><div className="col-lg-6"><ActivityPanel title="Recent donations" empty="No donations yet.">{dashboard.activity.recentDonations.map((item) => <div className="activity-row" key={item.id}><div><Link className="fw-semibold link-dark" to={`/donations/${item.id}`}>{item.title}</Link><div className="small text-secondary">{item.category.name} · expires {formatDateTime(item.expiresAt)}</div></div><StatusBadge status={item.status} donation={item} /></div>)}</ActivityPanel></div>
      <div className="col-lg-6"><ActivityPanel title="Recent reservation requests" empty="No reservation requests yet.">{dashboard.activity.recentReservationRequests.map((item) => <div className="activity-row" key={item.id}><div><strong>{item.recipient.organisation?.name ?? `${item.recipient.firstName} ${item.recipient.lastName}`}</strong><div className="small text-secondary">{item.donation.title} · {formatDateTime(item.requestedCollectionTime)}</div></div><StatusBadge status={item.status} /></div>)}</ActivityPanel></div></div></>
}

function RecipientDashboard({ dashboard }) {
  const reservations = dashboard.metrics.reservations
  return <><div className="row g-3 mb-5"><MetricCard label="Total reservations" value={reservations.total} /><MetricCard label="Pending" value={reservations.pending} /><MetricCard label="Approved" value={reservations.approved} /><MetricCard label="Available donations" value={dashboard.metrics.donations.available} /></div>
    <div className="row g-4"><div className="col-lg-6"><ActivityPanel title="Active reservations" empty="No pending or approved reservations.">{dashboard.activity.activeReservations.map((item) => <RecipientActivity key={item.id} item={item} />)}</ActivityPanel></div><div className="col-lg-6"><ActivityPanel title="Reservation history" empty="No completed reservation history yet.">{dashboard.activity.reservationHistory.map((item) => <RecipientActivity key={item.id} item={item} />)}</ActivityPanel></div></div></>
}

function RecipientActivity({ item }) {
  return <div className="activity-row"><div><Link className="fw-semibold link-dark" to={`/donations/${item.donation.id}`}>{item.donation.title}</Link><div className="small text-secondary">{item.donation.donor?.organisation?.name} · {formatDateTime(item.requestedCollectionTime)}</div></div><StatusBadge status={item.status} /></div>
}

function AdminDashboard({ dashboard }) {
  const metrics = dashboard.metrics
  return <div className="row g-3"><MetricCard label="Users" value={metrics.users.total} detail={`${metrics.users.active} active · ${metrics.users.suspended} suspended`} /><MetricCard label="Organisations" value={metrics.organisations.total} /><MetricCard label="Donations" value={metrics.donations.total} detail={`${metrics.donations.expiredAvailable} expired available`} /><MetricCard label="Reservations" value={metrics.reservations.total} /><MetricCard label="Donors" value={metrics.users.donor} /><MetricCard label="Recipients" value={metrics.users.recipient} /><MetricCard label="Categories" value={metrics.categories.total} detail={`${metrics.categories.active} active · ${metrics.categories.inactive} inactive`} /><MetricCard label="Collected" value={metrics.donations.collected} /></div>
}

function ActivityPanel({ title, empty, children }) {
  const items = Array.isArray(children) ? children : [children]
  return <section className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5 mb-3">{title}</h2>{items.filter(Boolean).length === 0 ? <EmptyState title={empty} message="New activity will appear here." /> : <div className="d-grid gap-3">{children}</div>}</div></section>
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get('/dashboard').then((response) => { if (active) setDashboard(response.data.data.dashboard) }).catch((requestError) => { if (active) setError(getApiError(requestError, 'Dashboard data could not be loaded.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <div className="container py-5"><span className="eyebrow text-success">{user.role.toLowerCase()} overview</span><h1 className="display-6 fw-bold mt-2 mb-1">Welcome, {user.firstName}</h1><p className="text-secondary mb-4">A current view of your FoodLink activity.</p><AlertMessage message={error} />{loading ? <LoadingSpinner label="Preparing your dashboard…" /> : dashboard && (dashboard.role === 'DONOR' ? <DonorDashboard dashboard={dashboard} /> : dashboard.role === 'RECIPIENT' ? <RecipientDashboard dashboard={dashboard} /> : <AdminDashboard dashboard={dashboard} />)}</div>
}
