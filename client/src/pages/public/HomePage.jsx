import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

const steps = [
  ['01', 'List surplus food', 'Donors publish safe food, quantities, location, and collection times.'],
  ['02', 'Find a suitable donation', 'Recipient organisations search current listings by food type and city.'],
  ['03', 'Request collection', 'A recipient proposes a collection time within the available window.'],
  ['04', 'Coordinate approval', 'The donor reviews requests and approves one organisation.'],
  ['05', 'Complete collection', 'Food is collected and both donation and reservation histories are updated.'],
]

export default function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <>
      <section className="hero-section">
        <div className="container py-5 py-lg-6">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <span className="eyebrow">Surplus food. Shared purpose.</span>
              <h1 className="display-3 fw-bold mt-3">Good food should feed communities, not landfills.</h1>
              <p className="lead text-secondary mt-4 mb-4 col-xl-10">
                FoodLink helps food businesses coordinate timely surplus donations with verified recipient organisations.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-3">
                <Link className="btn btn-success btn-lg px-4" to="/donations">Browse donations</Link>
                <Link className="btn btn-outline-dark btn-lg px-4" to={isAuthenticated ? '/dashboard' : '/register'}>
                  {isAuthenticated ? 'Open dashboard' : 'Join FoodLink'}
                </Link>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="impact-panel shadow-lg">
                <p className="small text-uppercase fw-bold mb-2">Built around shared goals</p>
                <div className="impact-goal">
                  <span className="impact-number">2</span>
                  <div><strong>Zero Hunger</strong><br /><span>Connect nutritious surplus food with people who need it.</span></div>
                </div>
                <div className="impact-goal">
                  <span className="impact-number">12</span>
                  <div><strong>Responsible Consumption</strong><br /><span>Reduce avoidable food waste through coordination.</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5 py-lg-6" aria-labelledby="how-it-works">
        <div className="row mb-4">
          <div className="col-lg-7">
            <span className="eyebrow text-success">How FoodLink works</span>
            <h2 id="how-it-works" className="display-6 fw-bold mt-2">A clear path from surplus to collection</h2>
          </div>
        </div>
        <div className="row g-3">
          {steps.map(([number, title, description]) => (
            <div className="col-md-6 col-xl" key={number}>
              <article className="workflow-card h-100">
                <span className="workflow-number">{number}</span>
                <h3 className="h5 mt-3">{title}</h3>
                <p className="small text-secondary mb-0">{description}</p>
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-5 pb-lg-6">
        <div className="cta-band d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
          <div>
            <p className="eyebrow text-warning mb-2">Ready to make a practical difference?</p>
            <h2 className="h2 text-white mb-1">See what is available for collection.</h2>
            <p className="text-white-50 mb-0">Listings are filtered to show only available, unexpired donations.</p>
          </div>
          <Link className="btn btn-warning btn-lg text-nowrap" to="/donations">Explore donations</Link>
        </div>
      </section>
    </>
  )
}
