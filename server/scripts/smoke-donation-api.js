import 'dotenv/config'
import { DonationStatus, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`
const runId = Date.now()
const email = `donation-smoke.${runId}@example.com`
const password = 'SmokePass123'
const originalTitle = `Donation Smoke ${runId}`
const updatedTitle = `Updated Donation Smoke ${runId}`

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

  const donations = await prisma.donation.findMany({
    where: { donorId: user.id },
    select: { id: true },
  })
  const donationIds = donations.map((donation) => donation.id)

  await prisma.$transaction([
    prisma.reservation.deleteMany({ where: { donationId: { in: donationIds } } }),
    prisma.donation.deleteMany({ where: { donorId: user.id } }),
    prisma.organisation.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ])
}

function donationPayload(categoryId, title) {
  return {
    categoryId,
    title,
    description: 'Temporary donation created by the live Milestone 5 smoke test.',
    quantity: 10,
    quantityUnit: 'portions',
    availableFrom: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    collectionAddress: '5 Smoke Test Road',
    city: 'Nairobi',
    collectionInstructions: 'Temporary test record.',
    imageUrl: null,
  }
}

async function run() {
  await cleanup()

  const category = await prisma.foodCategory.findFirst({
    where: { active: true },
    orderBy: { id: 'asc' },
  })
  if (!category) {
    throw new Error('No active food category is available for the smoke test.')
  }

  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Donation',
      lastName: 'Smoke Test',
      email,
      phoneNumber: '+254755000001',
      password,
      role: 'DONOR',
      organisationName: 'Donation Smoke Restaurant',
      organisationType: 'Restaurant',
      organisationDescription: 'Temporary live test organisation.',
      address: '4 Smoke Test Road',
      city: 'Nairobi',
      organisationContactPhone: '+254755000002',
    }),
  }, 201)

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const authorization = `Bearer ${login.data.token}`

  const created = await request('/api/donations', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(donationPayload(category.id, originalTitle)),
  }, 201)
  const donationId = created.data.donation.id
  if (created.data.donation.status !== DonationStatus.AVAILABLE) {
    throw new Error('New donation did not start as AVAILABLE.')
  }
  console.log('PASS POST /api/donations')

  const listing = await request(`/api/donations?search=${encodeURIComponent(originalTitle)}`)
  if (!listing.data.donations.some((donation) => donation.id === donationId)) {
    throw new Error('Public listing did not include the available donation.')
  }
  console.log('PASS GET /api/donations')

  const detail = await request(`/api/donations/${donationId}`)
  if (detail.data.donation.id !== donationId) {
    throw new Error('Public detail returned the wrong donation.')
  }
  console.log('PASS GET /api/donations/:id')

  const mine = await request('/api/donations/mine', {
    headers: { authorization },
  })
  if (!mine.data.donations.some((donation) => donation.id === donationId)) {
    throw new Error('Donor listing did not include the owned donation.')
  }
  console.log('PASS GET /api/donations/mine')

  const updated = await request(`/api/donations/${donationId}`, {
    method: 'PUT',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(donationPayload(category.id, updatedTitle)),
  })
  if (updated.data.donation.title !== updatedTitle) {
    throw new Error('Donation update did not persist.')
  }
  console.log('PASS PUT /api/donations/:id')

  const cancelled = await request(`/api/donations/${donationId}/cancel`, {
    method: 'PATCH',
    headers: { authorization },
  })
  if (cancelled.data.donation.status !== DonationStatus.CANCELLED) {
    throw new Error('Donation cancellation did not set CANCELLED.')
  }
  console.log('PASS PATCH /api/donations/:id/cancel')

  const hiddenListing = await request(`/api/donations?search=${encodeURIComponent(updatedTitle)}`)
  if (hiddenListing.data.donations.some((donation) => donation.id === donationId)) {
    throw new Error('Cancelled donation remained in the public listing.')
  }

  const stored = await prisma.donation.findUnique({ where: { id: donationId } })
  if (!stored || stored.status !== DonationStatus.CANCELLED) {
    throw new Error('Cancellation physically removed the row or saved the wrong status.')
  }
  console.log('PASS logical cancellation verification')
}

run()
  .catch((error) => {
    console.error(`FAIL donation smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
