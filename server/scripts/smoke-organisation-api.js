import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`
const email = `organisation-smoke.${Date.now()}@example.com`
const password = 'SmokePass123'

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json()

  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${body.error?.code ?? 'UNKNOWN_ERROR'}`)
  }

  return body
}

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    return
  }

  await prisma.$transaction([
    prisma.organisation.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ])
}

async function run() {
  await cleanup()

  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Organisation',
      lastName: 'Smoke Test',
      email,
      phoneNumber: '+254700100001',
      password,
      role: 'DONOR',
      organisationName: 'Smoke Test Restaurant',
      organisationType: 'Restaurant',
      organisationDescription: 'Temporary live API test record.',
      address: '1 Smoke Test Road',
      city: 'Nairobi',
      organisationContactPhone: '+254700100002',
    }),
  }, 201)

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const authorization = `Bearer ${login.data.token}`

  const profile = await request('/api/organisations/me', {
    headers: { authorization },
  })
  if (profile.data.organisation.name !== 'Smoke Test Restaurant') {
    throw new Error('GET /api/organisations/me returned the wrong organisation.')
  }
  console.log('PASS GET /api/organisations/me')

  const updated = await request('/api/organisations/me', {
    method: 'PUT',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      user_id: -1,
      name: 'Updated Smoke Test Restaurant',
      organisationType: 'Restaurant',
      description: null,
      address: '2 Updated Test Road',
      city: 'Nairobi',
      contactPhone: '+254700100003',
    }),
  })
  if (updated.data.organisation.name !== 'Updated Smoke Test Restaurant') {
    throw new Error('PUT /api/organisations/me did not update the owned organisation.')
  }
  console.log('PASS PUT /api/organisations/me')
}

run()
  .catch((error) => {
    console.error(`FAIL organisation smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
