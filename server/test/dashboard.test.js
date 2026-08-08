import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import {
  DonationStatus,
  ReservationStatus,
  UserStatus,
} from '@prisma/client'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/prisma.js'

const runId = `${Date.now()}-${process.pid}`
const password = 'StrongPass123'
const emails = {
  donor: `dashboard-donor.${runId}@example.com`,
  otherDonor: `dashboard-other-donor.${runId}@example.com`,
  recipient: `dashboard-recipient.${runId}@example.com`,
  otherRecipient: `dashboard-other-recipient.${runId}@example.com`,
  suspended: `dashboard-suspended.${runId}@example.com`,
}
const categoryNames = [
  `Dashboard Active Category ${runId}`,
  `Dashboard Inactive Category ${runId}`,
]
const ids = {}
const tokens = {}
const responseBodies = []

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

function remember(response) {
  responseBodies.push(response.body)
  return response
}

function registrationPayload(email, role, suffix) {
  return {
    firstName: 'Dashboard',
    lastName: suffix,
    email,
    phoneNumber: '+254788000001',
    password,
    role,
    organisationName: `${suffix} Dashboard Organisation`,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Food Bank',
    organisationDescription: 'Temporary Milestone 7 test organisation.',
    address: '10 Dashboard Test Road',
    city: 'Nairobi',
    organisationContactPhone: '+254788000002',
  }
}

async function registerAndLogin(email, role, suffix) {
  const registration = await request(app)
    .post('/api/auth/register')
    .send(registrationPayload(email, role, suffix))
  assert.equal(registration.status, 201)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
  assert.equal(login.status, 200)

  return { token: login.body.data.token, user: login.body.data.user }
}

async function createDonation({ donorId, status, title, expired = false }) {
  return prisma.donation.create({
    data: {
      donorId,
      categoryId: ids.category,
      title,
      description: 'Milestone 7 dashboard fixture.',
      quantity: 10,
      quantityUnit: 'portions',
      availableFrom: expired ? hoursFromNow(-5) : hoursFromNow(1),
      expiresAt: expired ? hoursFromNow(-1) : hoursFromNow(8),
      collectionAddress: '11 Dashboard Test Road',
      city: 'Nairobi',
      status,
    },
  })
}

async function createReservation(donationId, recipientId, status) {
  return prisma.reservation.create({
    data: {
      donationId,
      recipientId,
      message: 'Milestone 7 dashboard reservation fixture.',
      requestedCollectionTime: hoursFromNow(2),
      status,
    },
  })
}

async function cleanTestData() {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(emails) } },
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
      prisma.donation.deleteMany({ where: { id: { in: donationIds } } }),
      prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  }

  await prisma.foodCategory.deleteMany({ where: { name: { in: categoryNames } } })
}

describe('FoodLink role-based dashboard API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestData()

    const donor = await registerAndLogin(emails.donor, 'DONOR', 'Primary Donor')
    const otherDonor = await registerAndLogin(emails.otherDonor, 'DONOR', 'Other Donor')
    const recipient = await registerAndLogin(emails.recipient, 'RECIPIENT', 'Primary Recipient')
    const otherRecipient = await registerAndLogin(
      emails.otherRecipient,
      'RECIPIENT',
      'Other Recipient',
    )
    const suspended = await registerAndLogin(emails.suspended, 'DONOR', 'Suspended Donor')

    ids.donor = donor.user.id
    ids.otherDonor = otherDonor.user.id
    ids.recipient = recipient.user.id
    ids.otherRecipient = otherRecipient.user.id
    ids.suspended = suspended.user.id
    tokens.donor = donor.token
    tokens.recipient = recipient.token
    tokens.suspended = suspended.token

    await prisma.user.update({
      where: { id: ids.suspended },
      data: { status: UserStatus.SUSPENDED },
    })

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
    assert.equal(adminLogin.status, 200)
    tokens.admin = adminLogin.body.data.token

    const preparedCategory = await prisma.foodCategory.findUnique({ where: { name: 'Prepared Meals' } })
    assert.ok(preparedCategory)
    ids.category = preparedCategory.id

    await prisma.foodCategory.create({ data: { name: categoryNames[0], active: true } })
    await prisma.foodCategory.create({ data: { name: categoryNames[1], active: false } })

    const available = await createDonation({
      donorId: ids.donor,
      status: DonationStatus.AVAILABLE,
      title: `M7 Active Available ${runId}`,
    })
    const expiredAvailable = await createDonation({
      donorId: ids.donor,
      status: DonationStatus.AVAILABLE,
      title: `M7 Expired Available ${runId}`,
      expired: true,
    })
    const reserved = await createDonation({
      donorId: ids.donor,
      status: DonationStatus.RESERVED,
      title: `M7 Reserved ${runId}`,
    })
    const collected = await createDonation({
      donorId: ids.donor,
      status: DonationStatus.COLLECTED,
      title: `M7 Collected ${runId}`,
    })
    const cancelled = await createDonation({
      donorId: ids.donor,
      status: DonationStatus.CANCELLED,
      title: `M7 Cancelled ${runId}`,
    })
    ids.expiredAvailable = expiredAvailable.id

    const otherAvailable = await createDonation({
      donorId: ids.otherDonor,
      status: DonationStatus.AVAILABLE,
      title: `M7 Other Available ${runId}`,
    })
    const otherCollected = await createDonation({
      donorId: ids.otherDonor,
      status: DonationStatus.COLLECTED,
      title: `M7 Other Collected ${runId}`,
    })

    await createReservation(available.id, ids.recipient, ReservationStatus.PENDING)
    await createReservation(reserved.id, ids.recipient, ReservationStatus.APPROVED)
    await createReservation(collected.id, ids.recipient, ReservationStatus.COMPLETED)
    await createReservation(cancelled.id, ids.recipient, ReservationStatus.REJECTED)
    await createReservation(expiredAvailable.id, ids.recipient, ReservationStatus.CANCELLED)
    await createReservation(otherAvailable.id, ids.otherRecipient, ReservationStatus.PENDING)
    await createReservation(otherCollected.id, ids.otherRecipient, ReservationStatus.COMPLETED)
  })

  after(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  })

  test('unauthenticated dashboard request returns 401', async () => {
    const response = remember(await request(app).get('/api/dashboard'))
    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED')
  })

  test('DONOR receives donor dashboard', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.donor)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.dashboard.role, 'DONOR')
    assert.ok(response.body.data.dashboard.metrics.donations)
    assert.ok(response.body.data.dashboard.metrics.reservations)
  })

  test('DONOR dashboard counts only their own donations', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.donor)))
    assert.equal(response.body.data.dashboard.metrics.donations.total, 5)
    assert.equal(
      response.body.data.dashboard.activity.recentDonations.every(
        (donation) => donation.donorId === ids.donor,
      ),
      true,
    )
  })

  test('DONOR donation status counts are correct', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.donor)))
    assert.deepEqual(response.body.data.dashboard.metrics.donations, {
      total: 5,
      available: 2,
      reserved: 1,
      collected: 1,
      cancelled: 1,
      active: 1,
    })
  })

  test('DONOR reservation counts come only from their donations', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.donor)))
    const metrics = response.body.data.dashboard.metrics.reservations
    assert.equal(metrics.total, 5)
    assert.equal(metrics.pendingRequests, 1)
    assert.equal(metrics.approved, 1)
    assert.equal(metrics.completedCollections, 1)
    assert.equal(
      response.body.data.dashboard.activity.recentReservationRequests.every(
        (reservation) => reservation.donation.donorId === ids.donor,
      ),
      true,
    )
  })

  test('RECIPIENT receives recipient dashboard', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.dashboard.role, 'RECIPIENT')
    assert.equal(typeof response.body.data.dashboard.metrics.donations.available, 'number')
  })

  test('RECIPIENT dashboard counts only their own reservations', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.recipient)))
    assert.equal(response.body.data.dashboard.metrics.reservations.total, 5)
    assert.equal(
      [
        ...response.body.data.dashboard.activity.activeReservations,
        ...response.body.data.dashboard.activity.reservationHistory,
      ].every((reservation) => reservation.recipientId === ids.recipient),
      true,
    )
  })

  test('RECIPIENT reservation status counts are correct', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.recipient)))
    assert.deepEqual(response.body.data.dashboard.metrics.reservations, {
      total: 5,
      pending: 1,
      approved: 1,
      rejected: 1,
      cancelled: 1,
      completed: 1,
    })
  })

  test('ADMIN receives admin dashboard', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.dashboard.role, 'ADMIN')
  })

  test('ADMIN user total is correct', async () => {
    const expected = await prisma.user.count()
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.equal(response.body.data.dashboard.metrics.users.total, expected)
  })

  test('ADMIN user role counts are correct', async () => {
    const [donor, recipient, admin] = await Promise.all([
      prisma.user.count({ where: { role: 'DONOR' } }),
      prisma.user.count({ where: { role: 'RECIPIENT' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
    ])
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.deepEqual(
      {
        donor: response.body.data.dashboard.metrics.users.donor,
        recipient: response.body.data.dashboard.metrics.users.recipient,
        admin: response.body.data.dashboard.metrics.users.admin,
      },
      { donor, recipient, admin },
    )
  })

  test('ADMIN active and suspended user counts are correct', async () => {
    const [active, suspended] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
    ])
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.equal(response.body.data.dashboard.metrics.users.active, active)
    assert.equal(response.body.data.dashboard.metrics.users.suspended, suspended)
  })

  test('ADMIN organisation count is correct', async () => {
    const expected = await prisma.organisation.count()
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.equal(response.body.data.dashboard.metrics.organisations.total, expected)
  })

  test('ADMIN donation status counts are correct', async () => {
    const [total, available, reserved, collected, cancelled] = await Promise.all([
      prisma.donation.count(),
      prisma.donation.count({ where: { status: 'AVAILABLE' } }),
      prisma.donation.count({ where: { status: 'RESERVED' } }),
      prisma.donation.count({ where: { status: 'COLLECTED' } }),
      prisma.donation.count({ where: { status: 'CANCELLED' } }),
    ])
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    const metrics = response.body.data.dashboard.metrics.donations
    assert.deepEqual(
      { total: metrics.total, available: metrics.available, reserved: metrics.reserved, collected: metrics.collected, cancelled: metrics.cancelled },
      { total, available, reserved, collected, cancelled },
    )
  })

  test('ADMIN expired AVAILABLE count is derived from expiresAt without changing status', async () => {
    const expected = await prisma.donation.count({
      where: { status: 'AVAILABLE', expiresAt: { lt: new Date() } },
    })
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.equal(response.body.data.dashboard.metrics.donations.expiredAvailable, expected)
    const fixture = await prisma.donation.findUnique({ where: { id: ids.expiredAvailable } })
    assert.equal(fixture.status, DonationStatus.AVAILABLE)
  })

  test('ADMIN reservation status counts are correct', async () => {
    const [total, pending, approved, rejected, cancelled, completed] = await Promise.all([
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: 'PENDING' } }),
      prisma.reservation.count({ where: { status: 'APPROVED' } }),
      prisma.reservation.count({ where: { status: 'REJECTED' } }),
      prisma.reservation.count({ where: { status: 'CANCELLED' } }),
      prisma.reservation.count({ where: { status: 'COMPLETED' } }),
    ])
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.deepEqual(response.body.data.dashboard.metrics.reservations, {
      total,
      pending,
      approved,
      rejected,
      cancelled,
      completed,
    })
  })

  test('ADMIN category active and inactive counts are correct', async () => {
    const [total, active, inactive] = await Promise.all([
      prisma.foodCategory.count(),
      prisma.foodCategory.count({ where: { active: true } }),
      prisma.foodCategory.count({ where: { active: false } }),
    ])
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.admin)))
    assert.deepEqual(response.body.data.dashboard.metrics.categories, { total, active, inactive })
  })

  test('dashboard responses never expose passwordHash or reset token information', () => {
    const serialized = JSON.stringify(responseBodies)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('password_hash'), false)
    assert.equal(serialized.includes('tokenHash'), false)
    assert.equal(serialized.includes('token_hash'), false)
  })

  test('client-supplied role or user IDs cannot change dashboard scope', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .query({ role: 'ADMIN', userId: ids.otherDonor })
      .set(auth(tokens.donor))
      .send({ role: 'ADMIN', userId: ids.otherDonor }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.dashboard.role, 'DONOR')
    assert.equal(response.body.data.dashboard.metrics.donations.total, 5)
  })

  test('suspended users remain blocked by authentication middleware', async () => {
    const response = remember(await request(app)
      .get('/api/dashboard')
      .set(auth(tokens.suspended)))
    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'ACCOUNT_SUSPENDED')
  })
})
