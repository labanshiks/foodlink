import 'dotenv/config'
import { DonationStatus, PrismaClient, ReservationStatus } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`
const runId = Date.now()
const password = 'SmokePass123'
const donorEmail = `reservation-smoke-donor.${runId}@example.com`
const recipientEmail = `reservation-smoke-recipient.${runId}@example.com`

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
    firstName: 'Reservation',
    lastName: 'Smoke Test',
    email,
    phoneNumber: role === 'DONOR' ? '+254777000001' : '+254777000003',
    password,
    role,
    organisationName: `${role} Reservation Smoke Organisation`,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Food Bank',
    organisationDescription: 'Temporary Milestone 6 live smoke-test organisation.',
    address: '8 Reservation Smoke Road',
    city: 'Nairobi',
    organisationContactPhone: role === 'DONOR' ? '+254777000002' : '+254777000004',
  }
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

async function run() {
  await cleanup()

  const category = await prisma.foodCategory.findFirst({
    where: { active: true },
    orderBy: { id: 'asc' },
  })
  if (!category) throw new Error('No active food category is available for the smoke test.')

  const donorLogin = await registerAndLogin(donorEmail, 'DONOR')
  const recipientLogin = await registerAndLogin(recipientEmail, 'RECIPIENT')
  const donorAuthorization = `Bearer ${donorLogin.data.token}`
  const recipientAuthorization = `Bearer ${recipientLogin.data.token}`
  const availableFrom = new Date(Date.now() + 60 * 60 * 1000)
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000)

  const created = await apiRequest('/api/donations', {
    method: 'POST',
    headers: { authorization: donorAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      categoryId: category.id,
      title: `Reservation Smoke Donation ${runId}`,
      description: 'Temporary donation for the Milestone 6 live workflow test.',
      quantity: 6,
      quantityUnit: 'portions',
      availableFrom: availableFrom.toISOString(),
      expiresAt: expiresAt.toISOString(),
      collectionAddress: '9 Reservation Smoke Road',
      city: 'Nairobi',
      collectionInstructions: 'Ask for the smoke-test contact.',
      imageUrl: null,
    }),
  }, 201)
  const donationId = created.data.donation.id

  const requested = await apiRequest(`/api/donations/${donationId}/reservations`, {
    method: 'POST',
    headers: { authorization: recipientAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestedCollectionTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      message: 'Live smoke-test reservation.',
    }),
  }, 201)
  const reservationId = requested.data.reservation.id
  if (requested.data.reservation.status !== ReservationStatus.PENDING) {
    throw new Error('New reservation did not start as PENDING.')
  }
  console.log('PASS recipient reservation request -> PENDING')

  const donorList = await apiRequest(`/api/donations/${donationId}/reservations`, {
    headers: { authorization: donorAuthorization },
  })
  if (!donorList.data.reservations.some((item) => item.id === reservationId)) {
    throw new Error('Donor reservation listing did not include the new request.')
  }
  console.log('PASS donor reservation listing')

  const approved = await apiRequest(`/api/reservations/${reservationId}/approve`, {
    method: 'PATCH',
    headers: { authorization: donorAuthorization },
  })
  if (approved.data.reservation.status !== ReservationStatus.APPROVED) {
    throw new Error('Approval did not change the reservation to APPROVED.')
  }

  const reservedDonation = await apiRequest(`/api/donations/${donationId}`)
  if (reservedDonation.data.donation.status !== DonationStatus.RESERVED) {
    throw new Error('Approval did not change the donation to RESERVED.')
  }
  console.log('PASS approval -> reservation APPROVED and donation RESERVED')

  const collected = await apiRequest(`/api/donations/${donationId}/collected`, {
    method: 'PATCH',
    headers: { authorization: donorAuthorization },
  })
  if (
    collected.data.donation.status !== DonationStatus.COLLECTED
    || collected.data.reservation.status !== ReservationStatus.COMPLETED
  ) {
    throw new Error('Collection did not complete both records.')
  }

  const recipientHistory = await apiRequest('/api/reservations/mine', {
    headers: { authorization: recipientAuthorization },
  })
  const completed = recipientHistory.data.reservations.find((item) => item.id === reservationId)
  if (completed?.status !== ReservationStatus.COMPLETED) {
    throw new Error('Recipient history did not show the completed reservation.')
  }

  const collectedDonation = await apiRequest(`/api/donations/${donationId}`)
  if (collectedDonation.data.donation.status !== DonationStatus.COLLECTED) {
    throw new Error('Donation detail did not show COLLECTED.')
  }
  console.log('PASS collection -> reservation COMPLETED and donation COLLECTED')
}

run()
  .catch((error) => {
    console.error(`FAIL reservation smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
