import { isExpiredDonation } from '../../utils/formatters.js'

const statusClasses = {
  AVAILABLE: 'text-bg-success',
  RESERVED: 'text-bg-primary',
  COLLECTED: 'text-bg-dark',
  CANCELLED: 'text-bg-secondary',
  PENDING: 'text-bg-warning',
  APPROVED: 'text-bg-primary',
  REJECTED: 'text-bg-danger',
  COMPLETED: 'text-bg-success',
  ACTIVE: 'text-bg-success',
  INACTIVE: 'text-bg-secondary',
  SUSPENDED: 'text-bg-danger',
}

export default function StatusBadge({ status, donation }) {
  const expired = donation && isExpiredDonation(donation)
  const label = expired ? 'EXPIRED' : status
  const className = expired ? 'text-bg-warning' : (statusClasses[status] ?? 'text-bg-light')

  return <span className={`badge rounded-pill ${className}`}>{label}</span>
}
