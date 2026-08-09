export default function AlertMessage({ type = 'danger', message, details = [], onDismiss }) {
  if (!message) return null

  return (
    <div className={`alert alert-${type} d-flex justify-content-between gap-3`} role="alert">
      <div>
        <div>{message}</div>
        {details.length > 0 && (
          <ul className="mb-0 mt-2">
            {details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        )}
      </div>
      {onDismiss && (
        <button type="button" className="btn-close" aria-label="Dismiss message" onClick={onDismiss} />
      )}
    </div>
  )
}
