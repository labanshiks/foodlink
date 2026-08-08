import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { DonationStatus } from '@prisma/client'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/prisma.js'

const runId = `${Date.now()}-${process.pid}`
const donorEmail = `donation-donor.${runId}@example.com`
const otherDonorEmail = `donation-other.${runId}@example.com`
const recipientEmail = `donation-recipient.${runId}@example.com`
const inactiveCategoryName = `Inactive Test Category ${runId}`
const password = 'StrongPass123'
const cleanupEmails = [donorEmail, otherDonorEmail, recipientEmail]
const responseBodies = []

let donorToken
let otherDonorToken
let recipientToken
let adminToken
let donorId
let otherDonorId
let preparedCategoryId
let bakeryCategoryId
let inactiveCategoryId
let availableNairobiId
let availableMombasaId
let otherDonorDonationId
let expiredDonationId
let cancelledDonationId
let createdDonationId

function futureIso(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function registrationPayload(email, role, organisationName) {
  return {
    firstName: 'Donation',
    lastName: role === 'DONOR' ? 'Donor' : 'Recipient',
    email,
    phoneNumber: '+254744000001',
    password,
    role,
    organisationName,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Charity',
    organisationDescription: 'Milestone 5 test organisation.',
    address: '1 Donation Test Road',
    city: 'Nairobi',
    organisationContactPhone: '+254744000002',
  }
}

function donationPayload(overrides = {}) {
  return {
    categoryId: preparedCategoryId,
    title: `M5 ${runId} API Donation`,
    description: 'Safe surplus food created by the Milestone 5 tests.',
    quantity: 12.5,
    quantityUnit: 'portions',
    availableFrom: futureIso(1),
    expiresAt: futureIso(5),
    collectionAddress: '2 Donation Test Road',
    city: 'Nairobi',
    collectionInstructions: 'Ask for the duty manager.',
    imageUrl: null,
    ...overrides,
  }
}

function remember(response) {
  responseBodies.push(response.body)
  return response
}

async function cleanTestData() {
  const users = await prisma.user.findMany({
    where: { email: { in: cleanupEmails } },
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
      prisma.reservation.deleteMany({ where: { donationId: { in: donationIds } } }),
      prisma.donation.deleteMany({ where: { donorId: { in: userIds } } }),
      prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  }

  await prisma.foodCategory.deleteMany({ where: { name: inactiveCategoryName } })
}

async function registerAndLogin(email, role, organisationName) {
  const registration = await request(app)
    .post('/api/auth/register')
    .send(registrationPayload(email, role, organisationName))
  assert.equal(registration.status, 201)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
  assert.equal(login.status, 200)

  return { token: login.body.data.token, user: login.body.data.user }
}

async function createFixture(data) {
  return prisma.donation.create({
    data: {
      donorId: data.donorId,
      categoryId: data.categoryId,
      title: data.title,
      description: 'Donation browsing fixture.',
      quantity: 10,
      quantityUnit: 'portions',
      availableFrom: data.availableFrom,
      expiresAt: data.expiresAt,
      collectionAddress: '3 Fixture Road',
      city: data.city,
      status: data.status ?? DonationStatus.AVAILABLE,
    },
  })
}

describe('FoodLink donation API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestData()

    const donor = await registerAndLogin(donorEmail, 'DONOR', 'Primary Donation Donor')
    const otherDonor = await registerAndLogin(otherDonorEmail, 'DONOR', 'Other Donation Donor')
    const recipient = await registerAndLogin(recipientEmail, 'RECIPIENT', 'Donation Recipient')
    donorToken = donor.token
    otherDonorToken = otherDonor.token
    recipientToken = recipient.token
    donorId = donor.user.id
    otherDonorId = otherDonor.user.id

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
    assert.equal(adminLogin.status, 200)
    adminToken = adminLogin.body.data.token

    const preparedCategory = await prisma.foodCategory.findUnique({ where: { name: 'Prepared Meals' } })
    const bakeryCategory = await prisma.foodCategory.findUnique({ where: { name: 'Bakery' } })
    assert.ok(preparedCategory?.active)
    assert.ok(bakeryCategory?.active)
    preparedCategoryId = preparedCategory.id
    bakeryCategoryId = bakeryCategory.id

    const inactiveCategory = await prisma.foodCategory.create({
      data: { name: inactiveCategoryName, active: false },
    })
    inactiveCategoryId = inactiveCategory.id

    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const availableFrom = new Date(now + oneHour)

    const availableNairobi = await createFixture({
      donorId,
      categoryId: preparedCategoryId,
      title: `M5 ${runId} Nairobi Meals`,
      city: 'Nairobi',
      availableFrom,
      expiresAt: new Date(now + 8 * oneHour),
    })
    availableNairobiId = availableNairobi.id

    const availableMombasa = await createFixture({
      donorId,
      categoryId: bakeryCategoryId,
      title: `M5 ${runId} Golden Loaf`,
      city: 'Mombasa',
      availableFrom,
      expiresAt: new Date(now + 4 * oneHour),
    })
    availableMombasaId = availableMombasa.id

    const otherDonation = await createFixture({
      donorId: otherDonorId,
      categoryId: preparedCategoryId,
      title: `M5 ${runId} Kisumu Produce`,
      city: 'Kisumu',
      availableFrom,
      expiresAt: new Date(now + 12 * oneHour),
    })
    otherDonorDonationId = otherDonation.id

    const expired = await createFixture({
      donorId,
      categoryId: preparedCategoryId,
      title: `M5 ${runId} Expired Soup`,
      city: 'Nairobi',
      availableFrom: new Date(now - 8 * oneHour),
      expiresAt: new Date(now - oneHour),
    })
    expiredDonationId = expired.id

    const cancelled = await createFixture({
      donorId,
      categoryId: bakeryCategoryId,
      title: `M5 ${runId} Cancelled Cakes`,
      city: 'Nairobi',
      availableFrom,
      expiresAt: new Date(now + 10 * oneHour),
      status: DonationStatus.CANCELLED,
    })
    cancelledDonationId = cancelled.id
  })

  after(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  })

  test('public user lists available donations', async () => {
    const response = remember(await request(app)
      .get('/api/donations')
      .query({ search: runId }))

    assert.equal(response.status, 200)
    const ids = response.body.data.donations.map((donation) => donation.id)
    assert.equal(ids.includes(availableNairobiId), true)
    assert.equal(ids.includes(availableMombasaId), true)
    assert.equal(ids.includes(otherDonorDonationId), true)
    assert.equal(response.body.data.donations.every((donation) => donation.status === 'AVAILABLE'), true)
  })

  test('public listing excludes expired donations', async () => {
    const response = remember(await request(app)
      .get('/api/donations')
      .query({ search: runId }))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.some((donation) => donation.id === expiredDonationId), false)
  })

  test('public listing excludes cancelled donations', async () => {
    const response = remember(await request(app)
      .get('/api/donations')
      .query({ search: runId }))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.some((donation) => donation.id === cancelledDonationId), false)
  })

  test('public filtering by city works', async () => {
    const response = remember(await request(app)
      .get('/api/donations')
      .query({ city: 'Mombasa', search: runId }))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.length, 1)
    assert.equal(response.body.data.donations[0].id, availableMombasaId)
  })

  test('public filtering by category works', async () => {
    const response = remember(await request(app)
      .get('/api/donations')
      .query({ category: bakeryCategoryId, search: runId }))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.length, 1)
    assert.equal(response.body.data.donations[0].category.id, bakeryCategoryId)
  })

  test('public title and search filtering works', async () => {
    const searchResponse = remember(await request(app)
      .get('/api/donations')
      .query({ search: 'Golden Loaf' }))
    assert.equal(searchResponse.status, 200)
    assert.equal(searchResponse.body.data.donations.some((donation) => donation.id === availableMombasaId), true)

    const titleResponse = remember(await request(app)
      .get('/api/donations')
      .query({ title: 'Nairobi Meals' }))
    assert.equal(titleResponse.status, 200)
    assert.equal(titleResponse.body.data.donations.some((donation) => donation.id === availableNairobiId), true)
  })

  test('expiry sorting works', async () => {
    const ascending = remember(await request(app)
      .get('/api/donations')
      .query({ search: runId, sort: 'expiry_asc' }))
    assert.equal(ascending.status, 200)
    const ascendingDates = ascending.body.data.donations.map((donation) => Date.parse(donation.expiresAt))
    assert.deepEqual(ascendingDates, [...ascendingDates].sort((a, b) => a - b))

    const descending = remember(await request(app)
      .get('/api/donations')
      .query({ search: runId, sort: 'expiry_desc' }))
    assert.equal(descending.status, 200)
    const descendingDates = descending.body.data.donations.map((donation) => Date.parse(donation.expiresAt))
    assert.deepEqual(descendingDates, [...descendingDates].sort((a, b) => b - a))
  })

  test('public donation detail works', async () => {
    const response = remember(await request(app).get(`/api/donations/${availableNairobiId}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.id, availableNairobiId)
    assert.equal(response.body.data.donation.category.name, 'Prepared Meals')
    assert.equal(response.body.data.donation.donor.organisation.name, 'Primary Donation Donor')
  })

  test('unknown donation returns 404', async () => {
    const response = remember(await request(app).get('/api/donations/2147483647'))

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'DONATION_NOT_FOUND')
  })

  test('invalid donation ID is rejected', async () => {
    const response = remember(await request(app).get('/api/donations/not-an-id'))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('DONOR creates a donation', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload()))

    assert.equal(response.status, 201)
    assert.equal(response.body.data.donation.donorId, donorId)
    createdDonationId = response.body.data.donation.id
  })

  test('RECIPIENT cannot create a donation', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send(donationPayload({ title: `M5 ${runId} Recipient Attempt` })))

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'FORBIDDEN')
  })

  test('ADMIN cannot create a donation', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(donationPayload({ title: `M5 ${runId} Admin Attempt` })))

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'FORBIDDEN')
  })

  test('unauthenticated user cannot create a donation', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .send(donationPayload({ title: `M5 ${runId} Public Attempt` })))

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED')
  })

  test('donor_id supplied by the client cannot control ownership', async () => {
    const title = `M5 ${runId} Ownership Attempt`
    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({ donor_id: otherDonorId, title })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'SERVER_CONTROLLED_FIELD')
    assert.equal(await prisma.donation.findFirst({ where: { title } }), null)
  })

  test('new donation status is always AVAILABLE', async () => {
    const donation = await prisma.donation.findUnique({ where: { id: createdDonationId } })
    assert.equal(donation.status, DonationStatus.AVAILABLE)
  })

  test('invalid category is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({ categoryId: 2147483647 })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'CATEGORY_NOT_FOUND')
  })

  test('disabled or inactive category is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({ categoryId: inactiveCategoryId })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'CATEGORY_INACTIVE')
  })

  test('quantity less than or equal to zero is rejected', async () => {
    for (const quantity of [0, -1]) {
      const response = remember(await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationPayload({ quantity })))
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    }
  })

  test('invalid dates are rejected', async () => {
    const invalidAvailable = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({ availableFrom: 'not-a-date' })))
    assert.equal(invalidAvailable.status, 400)

    const invalidExpiry = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({ expiresAt: 'not-a-date' })))
    assert.equal(invalidExpiry.status, 400)
  })

  test('expiresAt earlier than or equal to availableFrom is rejected', async () => {
    const availableFrom = futureIso(5)

    for (const expiresAt of [availableFrom, futureIso(4)]) {
      const response = remember(await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationPayload({ availableFrom, expiresAt })))
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    }
  })

  test('required fields are validated', async () => {
    const payload = donationPayload({ description: '   ', city: '' })
    delete payload.title

    const response = remember(await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(payload))

    assert.equal(response.status, 400)
    const fields = response.body.error.details.map((detail) => detail.field)
    assert.equal(fields.includes('title'), true)
    assert.equal(fields.includes('description'), true)
    assert.equal(fields.includes('city'), true)
  })

  test('DONOR retrieves only their own donations through /mine, including expired and cancelled', async () => {
    const response = remember(await request(app)
      .get('/api/donations/mine')
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.every((donation) => donation.donorId === donorId), true)
    const ids = response.body.data.donations.map((donation) => donation.id)
    assert.equal(ids.includes(expiredDonationId), true)
    assert.equal(ids.includes(cancelledDonationId), true)
    assert.equal(ids.includes(otherDonorDonationId), false)
  })

  test('DONOR updates their own donation', async () => {
    const response = remember(await request(app)
      .put(`/api/donations/${createdDonationId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({
        categoryId: bakeryCategoryId,
        title: `M5 ${runId} Updated API Donation`,
      })))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.title, `M5 ${runId} Updated API Donation`)
    assert.equal(response.body.data.donation.categoryId, bakeryCategoryId)
  })

  test('DONOR cannot update another donor donation', async () => {
    const response = remember(await request(app)
      .put(`/api/donations/${otherDonorDonationId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload()))

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'DONATION_NOT_FOUND')
  })

  test('RECIPIENT cannot update donations', async () => {
    const response = remember(await request(app)
      .put(`/api/donations/${createdDonationId}`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .send(donationPayload()))

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'FORBIDDEN')
  })

  test('client cannot modify donation status through PUT', async () => {
    const response = remember(await request(app)
      .put(`/api/donations/${createdDonationId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload({ status: 'COLLECTED' })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'SERVER_CONTROLLED_FIELD')
    const donation = await prisma.donation.findUnique({ where: { id: createdDonationId } })
    assert.equal(donation.status, DonationStatus.AVAILABLE)
  })

  test('DONOR cancels their own donation', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${createdDonationId}/cancel`)
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.status, DonationStatus.CANCELLED)
  })

  test('repeated cancellation is handled idempotently', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${createdDonationId}/cancel`)
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.status, DonationStatus.CANCELLED)
  })

  test('DONOR cannot cancel another donor donation', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${otherDonorDonationId}/cancel`)
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'DONATION_NOT_FOUND')
  })

  test('cancellation does not physically delete the donation', async () => {
    const donation = await prisma.donation.findUnique({ where: { id: createdDonationId } })
    assert.ok(donation)
    assert.equal(donation.status, DonationStatus.CANCELLED)
  })

  test('CANCELLED donation cannot be edited', async () => {
    const response = remember(await request(app)
      .put(`/api/donations/${createdDonationId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send(donationPayload()))

    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'DONATION_NOT_EDITABLE')
  })

  test('passwordHash never appears in donation responses', () => {
    for (const body of responseBodies) {
      const serialized = JSON.stringify(body)
      assert.equal(serialized.includes('passwordHash'), false)
      assert.equal(serialized.includes('password_hash'), false)
    }
  })

  test('other donor credentials remain valid for cleanup coverage', async () => {
    const response = await request(app)
      .get('/api/donations/mine')
      .set('Authorization', `Bearer ${otherDonorToken}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.some((donation) => donation.id === otherDonorDonationId), true)
  })
})
