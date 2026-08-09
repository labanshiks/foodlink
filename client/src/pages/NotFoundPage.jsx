import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return <div className="container py-5 text-center"><p className="display-1 fw-bold text-success">404</p><h1 className="h2">We could not find that page.</h1><p className="text-secondary">The link may be outdated, or the resource may have moved.</p><Link className="btn btn-success" to="/">Return home</Link></div>
}
