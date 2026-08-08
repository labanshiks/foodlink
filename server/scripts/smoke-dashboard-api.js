import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`
const runId = Date.now()
const password = 'SmokePass123'
const donorEmail = `dashboard-smoke-donor.${runId}@example.com`
const recipientEmail = `dashboard-smoke-recipient.${runId}@example.com`

async function apiRequest(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json()

  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${body.error?.code ?? 'UNKNOWN_ERROR'}`)
  }

  return body
}

function registrationPayload(email, role) {
  return {
    firstName: 'Dashboard',
    lastName: 'Smoke Test',
    email,
    phoneNumber: role === 'DONOR' ? '+254799000001' : '+254799000003',
    password,
    role,
    organisationName: `${role} Dashboard Smoke Organisation`,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Food Bank',
    organisationDescription: 'Temporary Milestone 7 live smoke-test organisation.',
    address: '12 Dashboard Smoke Road',
    city: 'Nairobi',
    organisationContactPhone: role === 'DONOR' ? '+254799000002' : '+254799000004',
  }
}

async function registerAndLogin(email, role) {
  await apiRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(registrationPayload(email, role)),
  }, 201)

  return apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: [donorEmail, recipientEmail] } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)

  if (userIds.length === 0) return

  const donations = await prisma.donation.findMany({
    where: { donorId: { in: userIds } },
    select: { id: true },
  })
  const donationIds = donations.map((donation) => donation.id)

  await prisma.$transaction([
    prisma.reservation.deleteMany({ where: { donationId: { in: donationIds } } }),
    prisma.donation.deleteMany({ where: { id: { in: donationIds } } }),
    prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ])
}

async function run() {
  await cleanup()

  const category = await prisma.foodCategory.findFirst({
    where: { active: true },
    orderBy: { id: 'asc' },
  })
  if (!category) throw new Error('No active food category is available for the smoke test.')

  const donorLogin = await registerAndLogin(donorEmail, 'DONOR')
  const recipientLogin = await registerAndLogin(recipientEmail, 'RECIPIENT')
  const adminLogin = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    }),
  })
  const donorAuthorization = `Bearer ${donorLogin.data.token}`
  const recipientAuthorization = `Bearer ${recipientLogin.data.token}`
  const adminAuthorization = `Bearer ${adminLogin.data.token}`

  const donation = await apiRequest('/api/donations', {
    method: 'POST',
    headers: { authorization: donorAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      categoryId: category.id,
      title: `Dashboard Smoke Donation ${runId}`,
      description: 'Temporary donation for the Milestone 7 live dashboard test.',
      quantity: 5,
      quantityUnit: 'portions',
      availableFrom: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      collectionAddress: '13 Dashboard Smoke Road',
      city: 'Nairobi',
      collectionInstructions: 'Temporary dashboard test record.',
      imageUrl: null,
    }),
  }, 201)

  await apiRequest(`/api/donations/${donation.data.donation.id}/reservations`, {
    method: 'POST',
    headers: { authorization: recipientAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestedCollectionTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      message: 'Temporary dashboard smoke reservation.',
    }),
  }, 201)

  const donorDashboard = await apiRequest('/api/dashboard', {
    headers: { authorization: donorAuthorization },
  })
  const donorMetrics = donorDashboard.data.dashboard.metrics
  if (
    donorDashboard.data.dashboard.role !== 'DONOR'
    || donorMetrics.donations.total !== 1
    || donorMetrics.reservations.pendingRequests !== 1
  ) {
    throw new Error('DONOR dashboard returned incorrect scoped metrics.')
  }
  console.log('PASS DONOR dashboard')

  const recipientDashboard = await apiRequest('/api/dashboard', {
    headers: { authorization: recipientAuthorization },
  })
  const recipientMetrics = recipientDashboard.data.dashboard.metrics
  if (
    recipientDashboard.data.dashboard.role !== 'RECIPIENT'
    || recipientMetrics.reservations.total !== 1
    || recipientMetrics.reservations.pending !== 1
  ) {
    throw new Error('RECIPIENT dashboard returned incorrect scoped metrics.')
  }
  console.log('PASS RECIPIENT dashboard')

  const adminDashboard = await apiRequest('/api/dashboard', {
    headers: { authorization: adminAuthorization },
  })
  const adminMetrics = adminDashboard.data.dashboard.metrics
  if (
    adminDashboard.data.dashboard.role !== 'ADMIN'
    || adminMetrics.users.total < 3
    || adminMetrics.donations.total < 1
    || adminMetrics.reservations.total < 1
  ) {
    throw new Error('ADMIN dashboard did not include the temporary platform data.')
  }
  console.log('PASS ADMIN dashboard')
}

run()
  .catch((error) => {
    console.error(`FAIL dashboard smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
