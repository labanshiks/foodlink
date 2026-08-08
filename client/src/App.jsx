function App() {
  return (
    <div className="min-vh-100 bg-body-tertiary">
      <nav className="navbar bg-success" data-bs-theme="dark">
        <div className="container">
          <span className="navbar-brand mb-0 h1">FoodLink</span>
        </div>
      </nav>

      <main className="container py-5">
        <section className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4 p-md-5">
                <span className="badge text-bg-success mb-3">Milestone 1</span>
                <h1 className="display-5 fw-semibold">FoodLink foundation is ready</h1>
                <p className="lead text-secondary mb-0">
                  The React frontend is running with Vite and Bootstrap. Business
                  features will be added in later milestones.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

