import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'
import { toDateTimeLocal } from '../../utils/formatters.js'

const initialForm = {
  categoryId: '', title: '', description: '', quantity: '', quantityUnit: '', availableFrom: '', expiresAt: '', collectionAddress: '', city: '', collectionInstructions: '', imageUrl: '',
}

export default function DonationFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [categories, setCategories] = useState([])
  const [editable, setEditable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const requests = [apiClient.get('/categories')]
        if (editing) requests.push(apiClient.get(`/donations/${id}`))
        const [categoryResponse, donationResponse] = await Promise.all(requests)
        if (!active) return
        setCategories(categoryResponse.data.data.categories)
        if (donationResponse) {
          const donation = donationResponse.data.data.donation
          const mayEdit = donation.donorId === user.id && donation.status === 'AVAILABLE'
          setEditable(mayEdit)
          if (mayEdit) setForm({
            categoryId: String(donation.categoryId),
            title: donation.title,
            description: donation.description,
            quantity: String(donation.quantity),
            quantityUnit: donation.quantityUnit,
            availableFrom: toDateTimeLocal(donation.availableFrom),
            expiresAt: toDateTimeLocal(donation.expiresAt),
            collectionAddress: donation.collectionAddress,
            city: donation.city,
            collectionInstructions: donation.collectionInstructions ?? '',
            imageUrl: donation.imageUrl ?? '',
          })
        }
      } catch (requestError) {
        if (active) setError(getApiError(requestError, 'The donation form could not be loaded.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [editing, id, user.id])

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setDetails([])
    const payload = {
      ...form,
      categoryId: Number(form.categoryId),
      quantity: Number(form.quantity),
      availableFrom: new Date(form.availableFrom).toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      collectionInstructions: form.collectionInstructions.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
    }
    try {
      if (editing) await apiClient.put(`/donations/${id}`, payload)
      else await apiClient.post('/donations', payload)
      navigate('/my-donations', { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, `The donation could not be ${editing ? 'updated' : 'created'}.`))
      setDetails(getApiValidationErrors(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="container py-5"><LoadingSpinner label="Preparing donation form…" /></div>
  if (!editable) return <div className="container py-5"><AlertMessage type="warning" message="Only an AVAILABLE donation that belongs to your account can be edited." /><Link className="btn btn-outline-success" to="/my-donations">Back to my donations</Link></div>

  return (
    <div className="container py-5"><div className="row justify-content-center"><div className="col-xl-9">
      <Link className="link-success text-decoration-none" to="/my-donations">← Back to my donations</Link>
      <div className="card border-0 shadow-sm mt-3"><div className="card-body p-4 p-lg-5">
        <span className="eyebrow text-success">Donor workspace</span><h1 className="h2 fw-bold mt-2">{editing ? 'Edit donation' : 'Create a donation'}</h1>
        <p className="text-secondary">Collection timing and location help recipients plan a reliable pickup.</p>
        <AlertMessage message={error} details={details} />
        <form onSubmit={handleSubmit}><div className="row g-3">
          <div className="col-md-5"><label className="form-label" htmlFor="categoryId">Food category</label><select className="form-select" id="categoryId" name="categoryId" value={form.categoryId} onChange={handleChange} required><option value="">Select an active category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className="col-md-7"><label className="form-label" htmlFor="title">Title</label><input className="form-control" id="title" name="title" maxLength="150" value={form.title} onChange={handleChange} required /></div>
          <div className="col-12"><label className="form-label" htmlFor="description">Description</label><textarea className="form-control" id="description" name="description" rows="4" value={form.description} onChange={handleChange} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="quantity">Quantity</label><input className="form-control" type="number" id="quantity" name="quantity" min="0.01" step="0.01" value={form.quantity} onChange={handleChange} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="quantityUnit">Quantity unit</label><input className="form-control" id="quantityUnit" name="quantityUnit" maxLength="30" placeholder="e.g. meals, trays, kg" value={form.quantityUnit} onChange={handleChange} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="availableFrom">Available from</label><input className="form-control" type="datetime-local" id="availableFrom" name="availableFrom" value={form.availableFrom} onChange={handleChange} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="expiresAt">Collection deadline</label><input className="form-control" type="datetime-local" id="expiresAt" name="expiresAt" min={form.availableFrom} value={form.expiresAt} onChange={handleChange} required /></div>
          <div className="col-md-8"><label className="form-label" htmlFor="collectionAddress">Collection address</label><input className="form-control" id="collectionAddress" name="collectionAddress" maxLength="255" value={form.collectionAddress} onChange={handleChange} required /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="donationCity">City</label><input className="form-control" id="donationCity" name="city" maxLength="100" value={form.city} onChange={handleChange} required /></div>
          <div className="col-12"><label className="form-label" htmlFor="collectionInstructions">Collection instructions <span className="text-secondary">(optional)</span></label><textarea className="form-control" id="collectionInstructions" name="collectionInstructions" rows="3" value={form.collectionInstructions} onChange={handleChange} /></div>
          <div className="col-12"><label className="form-label" htmlFor="imageUrl">Image URL <span className="text-secondary">(optional)</span></label><input className="form-control" type="url" id="imageUrl" name="imageUrl" maxLength="500" placeholder="https://example.com/food.jpg" value={form.imageUrl} onChange={handleChange} /></div>
          <div className="col-12 mt-4"><button className="btn btn-success px-4" type="submit" disabled={submitting}>{submitting ? 'Saving donation…' : (editing ? 'Save changes' : 'Publish donation')}</button></div>
        </div></form>
      </div></div>
    </div></div></div>
  )
}
