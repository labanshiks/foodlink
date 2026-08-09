import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

const roleLinks = {
  DONOR: [
    ['/dashboard', 'Dashboard'],
    ['/donations', 'Browse'],
    ['/my-donations', 'My Donations'],
    ['/profile', 'Profile'],
  ],
  RECIPIENT: [
    ['/dashboard', 'Dashboard'],
    ['/donations', 'Browse'],
    ['/my-reservations', 'My Reservations'],
    ['/profile', 'Profile'],
  ],
  ADMIN: [
    ['/admin', 'Dashboard'],
    ['/admin/users', 'Users'],
    ['/admin/organisations', 'Organisations'],
    ['/admin/categories', 'Categories'],
    ['/admin/donations', 'Donations'],
  ],
}

export default function AppLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const links = isAuthenticated
    ? roleLinks[user.role]
    : [['/', 'Home'], ['/donations', 'Browse Donations']]

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true, state: { message: 'You have been logged out.' } })
  }

  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-dark foodlink-navbar sticky-top shadow-sm">
        <div className="container">
          <NavLink className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
            <span className="brand-mark" aria-hidden="true">FL</span>
            FoodLink
          </NavLink>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#foodlinkNav" aria-controls="foodlinkNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="foodlinkNav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {links.map(([to, label]) => (
                <li className="nav-item" key={to}>
                  <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to={to} end={to === '/' || to === '/admin'}>{label}</NavLink>
                </li>
              ))}
            </ul>
            {isAuthenticated ? (
              <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2 text-white">
                <span className="small opacity-75">{user.firstName} · {user.role}</span>
                <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>Logout</button>
              </div>
            ) : (
              <div className="d-flex gap-2">
                <NavLink className="btn btn-outline-light btn-sm" to="/login">Login</NavLink>
                <NavLink className="btn btn-warning btn-sm" to="/register">Register</NavLink>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow-1">
        <Outlet />
      </main>

      <footer className="foodlink-footer mt-auto py-4">
        <div className="container d-flex flex-column flex-md-row justify-content-between gap-2 small">
          <span>© {new Date().getFullYear()} FoodLink</span>
          <span>Supporting SDG 2 · Zero Hunger and SDG 12 · Responsible Consumption</span>
        </div>
      </footer>
    </div>
  )
}
