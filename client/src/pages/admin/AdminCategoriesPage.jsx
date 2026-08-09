import { useCallback, useEffect, useState } from 'react'
import apiClient from '../../api/apiClient.js'
import AlertMessage from '../../components/common/AlertMessage.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { getApiError, getApiValidationErrors } from '../../utils/apiErrors.js'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [success, setSuccess] = useState('')

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/categories')
      setCategories(response.data.data.categories)
    } catch (requestError) {
      setError(getApiError(requestError, 'Categories could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  function startEditing(category) {
    setEditingId(category.id)
    setForm({ name: category.name, description: category.description ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearForm() {
    setEditingId(null)
    setForm({ name: '', description: '' })
  }

  async function saveCategory(event) {
    event.preventDefault()
    setSubmitting(true); setError(''); setDetails([])
    const payload = { name: form.name, description: form.description.trim() || null }
    try {
      if (editingId) await apiClient.put(`/categories/${editingId}`, payload)
      else await apiClient.post('/categories', payload)
      setSuccess(editingId ? 'Category updated.' : 'Category created.')
      clearForm(); await loadCategories()
    } catch (requestError) {
      setError(getApiError(requestError, 'The category could not be saved.'))
      setDetails(getApiValidationErrors(requestError))
    } finally { setSubmitting(false) }
  }

  async function changeStatus(category) {
    if (category.active && !window.confirm(`Disable ${category.name}? Existing donation references will remain intact.`)) return
    setError('')
    try {
      await apiClient.patch(`/categories/${category.id}/status`, { active: !category.active })
      setSuccess(`Category ${category.active ? 'disabled' : 're-enabled'}.`)
      await loadCategories()
    } catch (requestError) { setError(getApiError(requestError, 'The category status could not be changed.')) }
  }

  return <div className="container py-5"><span className="eyebrow text-success">Administration</span><h1 className="display-6 fw-bold mt-2 mb-1">Food categories</h1><p className="text-secondary mb-4">Manage the categories donors use for their listings.</p>
    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h2 className="h5">{editingId ? 'Edit category' : 'Create category'}</h2><AlertMessage message={error} details={details} /><AlertMessage type="success" message={success} onDismiss={() => setSuccess('')} /><form onSubmit={saveCategory}><div className="row g-3 align-items-end"><div className="col-md-4"><label className="form-label" htmlFor="categoryName">Name</label><input className="form-control" id="categoryName" maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div><div className="col-md-5"><label className="form-label" htmlFor="categoryDescription">Description <span className="text-secondary">(optional)</span></label><input className="form-control" id="categoryDescription" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="col-md-3 d-flex gap-2"><button className="btn btn-success" type="submit" disabled={submitting}>{submitting ? 'Saving…' : (editingId ? 'Save' : 'Create')}</button>{editingId && <button className="btn btn-outline-secondary" type="button" onClick={clearForm}>Cancel</button>}</div></div></form></div></div>
    {loading ? <LoadingSpinner label="Loading categories…" /> : categories.length === 0 ? <EmptyState title="No categories" message="Create the first category above." /> : <div className="table-responsive bg-white rounded-4 shadow-sm"><table className="table align-middle mb-0"><thead><tr><th>Category</th><th>Description</th><th>Usage</th><th>Status</th><th /></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.description || '—'}</td><td>{category._count.donations} donation{category._count.donations === 1 ? '' : 's'}</td><td><StatusBadge status={category.active ? 'ACTIVE' : 'INACTIVE'} /></td><td><div className="d-flex justify-content-end gap-2"><button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => startEditing(category)}>Edit</button><button className={`btn btn-sm ${category.active ? 'btn-outline-danger' : 'btn-outline-success'}`} type="button" onClick={() => changeStatus(category)}>{category.active ? 'Disable' : 'Enable'}</button></div></td></tr>)}</tbody></table></div>}
  </div>
}
