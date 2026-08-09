import { useEffect, useState } from 'react'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import DonationCard from '../../components/donations/DonationCard.jsx'
import { getApiError } from '../../utils/apiErrors.js'

const initialFilters = { search: '', city: '', category: '', sort: 'expiry_asc' }

export default function DonationsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState(initialFilters)
  const [donations, setDonations] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value !== ''))
        const [donationResponse, categoryResponse] = await Promise.all([
          apiClient.get('/donations', { params }),
          apiClient.get('/categories'),
        ])
        if (active) {
          setDonations(donationResponse.data.data.donations)
          setCategories(categoryResponse.data.data.categories)
        }
      } catch (requestError) {
        if (active) setError(getApiError(requestError, 'Donations could not be loaded.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [appliedFilters])

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function submitFilters(event) {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  function clearFilters() {
    setFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }

  return (
    <div className="container py-5">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
        <div>
          <span className="eyebrow text-success">Available now</span>
          <h1 className="display-6 fw-bold mt-2 mb-1">Browse food donations</h1>
          <p className="text-secondary mb-0">Find active listings that can be collected before their deadline.</p>
        </div>
        {!loading && <span className="badge text-bg-light border fs-6">{donations.length} result{donations.length === 1 ? '' : 's'}</span>}
      </div>

      <form className="filter-panel mb-4" onSubmit={submitFilters} aria-label="Donation filters">
        <div className="row g-3 align-items-end">
          <div className="col-md-6 col-xl-3">
            <label className="form-label" htmlFor="search">Search title</label>
            <input className="form-control" id="search" name="search" value={filters.search} onChange={updateFilter} placeholder="e.g. bread" />
          </div>
          <div className="col-md-6 col-xl-3">
            <label className="form-label" htmlFor="city">City</label>
            <input className="form-control" id="city" name="city" value={filters.city} onChange={updateFilter} placeholder="e.g. Nairobi" />
          </div>
          <div className="col-md-6 col-xl-3">
            <label className="form-label" htmlFor="category">Category</label>
            <select className="form-select" id="category" name="category" value={filters.category} onChange={updateFilter}>
              <option value="">All active categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="col-md-6 col-xl-3">
            <label className="form-label" htmlFor="sort">Expiry order</label>
            <select className="form-select" id="sort" name="sort" value={filters.sort} onChange={updateFilter}>
              <option value="expiry_asc">Expiring soonest</option>
              <option value="expiry_desc">Expiring latest</option>
            </select>
          </div>
          <div className="col-12 d-flex gap-2">
            <button className="btn btn-success" type="submit">Apply filters</button>
            <button className="btn btn-outline-secondary" type="button" onClick={clearFilters}>Clear</button>
          </div>
        </div>
      </form>

      <AlertMessage message={error} />
      {loading ? <LoadingSpinner label="Finding available donations…" /> : donations.length === 0 ? (
        <EmptyState title="No matching donations" message="Try changing your filters or check again when donors add new listings." />
      ) : (
        <div className="row g-4">
          {donations.map((donation) => (
            <div className="col-md-6 col-xl-4" key={donation.id}><DonationCard donation={donation} /></div>
          ))}
        </div>
      )}
    </div>
  )
}
