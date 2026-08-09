export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="d-flex align-items-center justify-content-center gap-3 py-5" role="status">
      <span className="spinner-border text-success" aria-hidden="true" />
      <span className="text-secondary">{label}</span>
    </div>
  )
}
