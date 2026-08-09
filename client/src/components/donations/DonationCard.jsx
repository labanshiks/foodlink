import { Link } from 'react-router-dom'
import StatusBadge from '../common/StatusBadge.jsx'
import { formatDateTime, formatQuantity } from '../../utils/formatters.js'

export default function DonationCard({ donation }) {
  const organisation = donation.donor?.organisation

  return (
    <article className="card donation-card h-100 border-0 shadow-sm">
      {donation.imageUrl && (
        <img src={donation.imageUrl} className="card-img-top donation-card-image" alt={`${donation.title} donation`} />
      )}
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span className="small text-uppercase fw-semibold text-success">{donation.category?.name}</span>
          <StatusBadge status={donation.status} donation={donation} />
        </div>
        <h2 className="h5 card-title">{donation.title}</h2>
        <p className="text-secondary small mb-3">From {organisation?.name ?? 'FoodLink donor'}</p>
        <dl className="row small mb-4">
          <dt className="col-4 text-secondary fw-normal">Quantity</dt>
          <dd className="col-8 mb-2">{formatQuantity(donation.quantity, donation.quantityUnit)}</dd>
          <dt className="col-4 text-secondary fw-normal">Location</dt>
          <dd className="col-8 mb-2">{donation.city}</dd>
          <dt className="col-4 text-secondary fw-normal">Expires</dt>
          <dd className="col-8 mb-0">{formatDateTime(donation.expiresAt)}</dd>
        </dl>
        <Link className="btn btn-outline-success mt-auto" to={`/donations/${donation.id}`}>View donation details</Link>
      </div>
    </article>
  )
}
