import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return <div className="container py-5 text-center"><p className="display-1 fw-bold text-success">403</p><h1 className="h2">That page is not available for your role.</h1><p className="text-secondary">FoodLink uses role-aware routes in addition to backend authorization.</p><Link className="btn btn-success" to="/dashboard">Return to dashboard</Link></div>
}
