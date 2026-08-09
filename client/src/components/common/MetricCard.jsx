export default function MetricCard({ label, value, detail }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className="card metric-card h-100 border-0 shadow-sm">
        <div className="card-body">
          <p className="text-uppercase small fw-semibold text-secondary mb-2">{label}</p>
          <p className="display-6 fw-bold text-success mb-1">{value ?? 0}</p>
          {detail && <p className="small text-secondary mb-0">{detail}</p>}
        </div>
      </div>
    </div>
  )
}
