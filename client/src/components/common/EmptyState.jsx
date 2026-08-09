export default function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state text-center rounded-4 border bg-white p-4 p-md-5">
      <div className="empty-state-mark" aria-hidden="true">FL</div>
      <h2 className="h5 mt-3">{title}</h2>
      <p className="text-secondary mb-3">{message}</p>
      {action}
    </div>
  )
}
