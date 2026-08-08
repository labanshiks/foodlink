import 'dotenv/config'

const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json()

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${body.error?.code ?? 'UNKNOWN_ERROR'}`)
  }

  return { response, body }
}

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for the auth smoke test.')
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  console.log('PASS POST /api/auth/login')

  const authorization = `Bearer ${login.body.data.token}`
  const me = await request('/api/auth/me', {
    headers: { authorization },
  })

  if (me.body.data.user.role !== 'ADMIN') {
    throw new Error('GET /api/auth/me did not return the seeded administrator.')
  }
  console.log('PASS GET /api/auth/me')

  await request('/api/auth/logout', {
    method: 'POST',
    headers: { authorization },
  })
  console.log('PASS POST /api/auth/logout')
}

run().catch((error) => {
  console.error(`FAIL auth smoke test: ${error.message}`)
  process.exitCode = 1
})
