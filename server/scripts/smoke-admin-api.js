import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`
const runId = Date.now()
const password = 'SmokePass123'
const donorEmail = `admin-smoke-donor.${runId}@example.com`
const recipientEmail = `admin-smoke-recipient.${runId}@example.com`
const categoryName = `Admin Smoke Category ${runId}`

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
    firstName: 'Administration',
    lastName: 'Smoke Test',
    email,
    phoneNumber: role === 'DONOR' ? '+254722200001' : '+254722200003',
    password,
    role,
    organisationName: `${role} Administration Smoke Organisation`,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Food Bank',
    organisationDescription: 'Temporary Milestone 8 smoke-test organisation.',
    address: '17 Administration Smoke Road',
    city: 'Nairobi',
    organisationContactPhone: role === 'DONOR' ? '+254722200002' : '+254722200004',
  }
}

async function registerAndLogin(email, role) {
  const registration = await apiRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(registrationPayload(email, role)),
  }, 201)

  const login = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  return { user: registration.data.user, token: login.data.token }
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: [donorEmail, recipientEmail] } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)

  if (userIds.length > 0) {
    const donations = await prisma.donation.findMany({
      where: { donorId: { in: userIds } },
      select: { id: true },
    })
    const donationIds = donations.map((donation) => donation.id)

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.reservation.deleteMany({ where: { donationId: { in: donationIds } } }),
      prisma.donation.deleteMany({ where: { id: { in: donationIds } } }),
      prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  }

  await prisma.foodCategory.deleteMany({ where: { name: categoryName } })
}

async function run() {
  await cleanup()

  const donor = await registerAndLogin(donorEmail, 'DONOR')
  const recipient = await registerAndLogin(recipientEmail, 'RECIPIENT')
  const adminLogin = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    }),
  })
  const adminAuthorization = `Bearer ${adminLogin.data.token}`
  const donorAuthorization = `Bearer ${donor.token}`
  const recipientAuthorization = `Bearer ${recipient.token}`

  const users = await apiRequest(`/api/admin/users?search=${encodeURIComponent(donorEmail)}`, {
    headers: { authorization: adminAuthorization },
  })
  if (!users.data.users.some((user) => user.id === donor.user.id)) {
    throw new Error('Admin user listing did not include the temporary donor.')
  }
  console.log('PASS admin user listing')

  await apiRequest(`/api/admin/users/${donor.user.id}/status`, {
    method: 'PATCH',
    headers: { authorization: adminAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'SUSPENDED' }),
  })
  await apiRequest('/api/dashboard', { headers: { authorization: donorAuthorization } }, 403)
  await apiRequest(`/api/admin/users/${donor.user.id}/status`, {
    method: 'PATCH',
    headers: { authorization: adminAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE' }),
  })
  console.log('PASS suspend and reactivate temporary user')

  const organisations = await apiRequest(
    `/api/admin/organisations?search=${encodeURIComponent(donorEmail)}`,
    { headers: { authorization: adminAuthorization } },
  )
  if (!organisations.data.organisations.some((item) => item.userId === donor.user.id)) {
    throw new Error('Admin organisation listing did not include the donor organisation.')
  }
  console.log('PASS admin organisation listing')

  const category = await apiRequest('/api/categories', {
    method: 'POST',
    headers: { authorization: adminAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({ name: categoryName, description: 'Temporary smoke-test category.' }),
  }, 201)
  const categoryId = category.data.category.id
  await apiRequest(`/api/categories/${categoryId}/status`, {
    method: 'PATCH',
    headers: { authorization: adminAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({ active: false }),
  })
  await apiRequest(`/api/categories/${categoryId}/status`, {
    method: 'PATCH',
    headers: { authorization: adminAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({ active: true }),
  })
  console.log('PASS category create, disable, and re-enable')

  const donation = await apiRequest('/api/donations', {
    method: 'POST',
    headers: { authorization: donorAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      categoryId,
      title: `Admin Smoke Donation ${runId}`,
      description: 'Temporary donation for the administration smoke test.',
      quantity: 8,
      quantityUnit: 'portions',
      availableFrom: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      collectionAddress: '18 Administration Smoke Road',
      city: 'Nairobi',
      collectionInstructions: 'Temporary administration smoke record.',
      imageUrl: null,
    }),
  }, 201)
  const donationId = donation.data.donation.id

  const reservation = await apiRequest(`/api/donations/${donationId}/reservations`, {
    method: 'POST',
    headers: { authorization: recipientAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestedCollectionTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      message: 'Temporary administration smoke reservation.',
    }),
  }, 201)

  const donations = await apiRequest(
    `/api/admin/donations?search=${encodeURIComponent(`Admin Smoke Donation ${runId}`)}`,
    { headers: { authorization: adminAuthorization } },
  )
  if (!donations.data.donations.some((item) => item.id === donationId)) {
    throw new Error('Admin donation listing did not include the temporary donation.')
  }
  console.log('PASS admin donation listing')

  const cancelled = await apiRequest(`/api/admin/donations/${donationId}/cancel`, {
    method: 'PATCH',
    headers: { authorization: adminAuthorization },
  })
  if (cancelled.data.donation.status !== 'CANCELLED') {
    throw new Error('Administrative cancellation did not set the donation to CANCELLED.')
  }

  const recipientReservations = await apiRequest('/api/reservations/mine', {
    headers: { authorization: recipientAuthorization },
  })
  const storedReservation = recipientReservations.data.reservations
    .find((item) => item.id === reservation.data.reservation.id)
  if (
    storedReservation?.status !== 'REJECTED'
    || !storedReservation.donorResponse?.includes('administrator')
  ) {
    throw new Error('Administrative cancellation did not reject the pending reservation.')
  }
  console.log('PASS admin cancellation and pending reservation rejection')
}

run()
  .catch((error) => {
    console.error(`FAIL admin smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
