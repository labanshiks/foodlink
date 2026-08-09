import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { DonationStatus, ReservationStatus, UserStatus } from '@prisma/client'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/prisma.js'

const runId = `${Date.now()}-${process.pid}`
const password = 'StrongPass123'
const emails = {
  donor: `admin-test-donor.${runId}@example.com`,
  otherDonor: `admin-test-other-donor.${runId}@example.com`,
  recipient: `admin-test-recipient.${runId}@example.com`,
}
const categoryNames = {
  inactive: `Admin Inactive ${runId}`,
  created: `Admin Created ${runId}`,
  updated: `Admin Updated ${runId}`,
}
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

function registrationPayload(email, role, organisationName, city = 'Nairobi') {
  return {
    firstName: 'Administration',
    lastName: role === 'DONOR' ? 'Donor' : 'Recipient',
    email,
    phoneNumber: '+254711100001',
    password,
    role,
    organisationName,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Food Bank',
    organisationDescription: 'Temporary Milestone 8 test organisation.',
    address: '14 Administration Test Road',
    city,
    organisationContactPhone: '+254711100002',
  }
}

function donationPayload(categoryId, overrides = {}) {
  return {
    categoryId,
    title: `Administration API Donation ${runId}`,
    description: 'Temporary donation used by Milestone 8 tests.',
    quantity: 12,
    quantityUnit: 'portions',
    availableFrom: hoursFromNow(1).toISOString(),
    expiresAt: hoursFromNow(6).toISOString(),
    collectionAddress: '15 Administration Test Road',
    city: 'Nairobi',
    collectionInstructions: 'Ask for the administrator test contact.',
    imageUrl: null,
    ...overrides,
  }
}

async function registerAndLogin(email, role, organisationName, city) {
  const registration = await request(app)
    .post('/api/auth/register')
    .send(registrationPayload(email, role, organisationName, city))
  assert.equal(registration.status, 201)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
  assert.equal(login.status, 200)

  return { token: login.body.data.token, user: login.body.data.user }
}

async function createDonation({
  donorId,
  status = DonationStatus.AVAILABLE,
  city = 'Nairobi',
  title,
  expired = false,
  categoryId = ids.preparedCategory,
}) {
  return prisma.donation.create({
    data: {
      donorId,
      categoryId,
      title,
      description: 'Milestone 8 administration donation fixture.',
      quantity: 10,
      quantityUnit: 'portions',
      availableFrom: expired ? hoursFromNow(-6) : hoursFromNow(1),
      expiresAt: expired ? hoursFromNow(-1) : hoursFromNow(8),
      collectionAddress: '16 Administration Test Road',
      city,
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
      prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.reservation.deleteMany({ where: { donationId: { in: donationIds } } }),
      prisma.donation.deleteMany({ where: { id: { in: donationIds } } }),
      prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  }

  await prisma.foodCategory.deleteMany({
    where: { name: { in: Object.values(categoryNames) } },
  })
}

describe('FoodLink administration API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestData()

    const donor = await registerAndLogin(
      emails.donor,
      'DONOR',
      `Admin Searchable Donor ${runId}`,
      'Nairobi',
    )
    const otherDonor = await registerAndLogin(
      emails.otherDonor,
      'DONOR',
      `Admin Other Donor ${runId}`,
      'Mombasa',
    )
    const recipient = await registerAndLogin(
      emails.recipient,
      'RECIPIENT',
      `Admin Searchable Recipient ${runId}`,
      'Kisumu',
    )
    ids.donor = donor.user.id
    ids.otherDonor = otherDonor.user.id
    ids.recipient = recipient.user.id
    tokens.donor = donor.token
    tokens.recipient = recipient.token

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
    assert.equal(adminLogin.status, 200)
    tokens.admin = adminLogin.body.data.token
    ids.admin = adminLogin.body.data.user.id

    const preparedCategory = await prisma.foodCategory.findUnique({ where: { name: 'Prepared Meals' } })
    assert.ok(preparedCategory)
    ids.preparedCategory = preparedCategory.id

    const inactive = await prisma.foodCategory.create({
      data: { name: categoryNames.inactive, active: false },
    })
    ids.inactiveCategory = inactive.id

    await prisma.passwordResetToken.create({
      data: {
        userId: ids.donor,
        tokenHash: `temporary-admin-test-token-hash-${runId}`,
        expiresAt: hoursFromNow(1),
      },
    })

    const available = await createDonation({
      donorId: ids.donor,
      title: `Admin Cancel Target ${runId}`,
    })
    ids.availableDonation = available.id
    ids.pendingOne = (await prisma.reservation.create({
      data: {
        donationId: available.id,
        recipientId: ids.recipient,
        requestedCollectionTime: hoursFromNow(2),
        status: ReservationStatus.PENDING,
      },
    })).id
    ids.pendingTwo = (await prisma.reservation.create({
      data: {
        donationId: available.id,
        recipientId: ids.recipient,
        requestedCollectionTime: hoursFromNow(3),
        status: ReservationStatus.PENDING,
      },
    })).id

    ids.reservedDonation = (await createDonation({
      donorId: ids.donor,
      status: DonationStatus.RESERVED,
      title: `Admin Reserved History ${runId}`,
    })).id
    ids.collectedDonation = (await createDonation({
      donorId: ids.donor,
      status: DonationStatus.COLLECTED,
      title: `Admin Collected History ${runId}`,
    })).id
    ids.cancelledDonation = (await createDonation({
      donorId: ids.donor,
      status: DonationStatus.CANCELLED,
      title: `Admin Cancelled History ${runId}`,
    })).id
    ids.otherDonation = (await createDonation({
      donorId: ids.otherDonor,
      city: 'Mombasa',
      title: `Admin Mombasa Search Target ${runId}`,
    })).id
    ids.expiredDonation = (await createDonation({
      donorId: ids.otherDonor,
      title: `Admin Expired Target ${runId}`,
      expired: true,
    })).id
  })

  after(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  })

  test('unauthenticated admin endpoint returns 401', async () => {
    const response = remember(await request(app).get('/api/admin/users'))
    assert.equal(response.status, 401)
  })

  test('DONOR admin request returns 403', async () => {
    const response = remember(await request(app).get('/api/admin/users').set(auth(tokens.donor)))
    assert.equal(response.status, 403)
  })

  test('RECIPIENT admin request returns 403', async () => {
    const response = remember(await request(app).get('/api/admin/users').set(auth(tokens.recipient)))
    assert.equal(response.status, 403)
  })

  test('ADMIN request succeeds', async () => {
    const response = remember(await request(app).get('/api/admin/users').set(auth(tokens.admin)))
    assert.equal(response.status, 200)
  })

  test('ADMIN lists users with organisation and activity counts', async () => {
    const response = remember(await request(app).get('/api/admin/users').set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.users.some((user) => user.id === ids.donor), true)
    const donor = response.body.data.users.find((user) => user.id === ids.donor)
    assert.ok(donor.organisation)
    assert.equal(typeof donor._count.donations, 'number')
  })

  test('passwordHash never appears in user administration responses', () => {
    const serialized = JSON.stringify(responseBodies)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('password_hash'), false)
  })

  test('password reset token information never appears in user responses', () => {
    const serialized = JSON.stringify(responseBodies)
    assert.equal(serialized.includes('tokenHash'), false)
    assert.equal(serialized.includes('token_hash'), false)
    assert.equal(serialized.includes('passwordResetTokens'), false)
  })

  test('user role filter works', async () => {
    const response = remember(await request(app)
      .get('/api/admin/users')
      .query({ role: 'RECIPIENT' })
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.users.length > 0, true)
    assert.equal(response.body.data.users.every((user) => user.role === 'RECIPIENT'), true)
  })

  test('user status filter works', async () => {
    const response = remember(await request(app)
      .get('/api/admin/users')
      .query({ status: 'ACTIVE' })
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.users.every((user) => user.status === 'ACTIVE'), true)
  })

  test('user email and name search works', async () => {
    const response = remember(await request(app)
      .get('/api/admin/users')
      .query({ search: emails.donor })
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data.users.map((user) => user.id), [ids.donor])
  })

  test('ADMIN suspends an ACTIVE user', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/users/${ids.donor}/status`)
      .set(auth(tokens.admin))
      .send({ status: 'SUSPENDED' }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.status, UserStatus.SUSPENDED)
  })

  test('suspended user is immediately blocked from protected endpoints', async () => {
    const response = remember(await request(app).get('/api/dashboard').set(auth(tokens.donor)))
    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'ACCOUNT_SUSPENDED')
  })

  test('ADMIN reactivates a suspended user', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/users/${ids.donor}/status`)
      .set(auth(tokens.admin))
      .send({ status: 'ACTIVE' }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.status, UserStatus.ACTIVE)
    const protectedResponse = await request(app).get('/api/dashboard').set(auth(tokens.donor))
    assert.equal(protectedResponse.status, 200)
  })

  test('invalid user status is rejected', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/users/${ids.donor}/status`)
      .set(auth(tokens.admin))
      .send({ status: 'DELETED' }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('unknown user returns 404', async () => {
    const response = remember(await request(app)
      .patch('/api/admin/users/2147483647/status')
      .set(auth(tokens.admin))
      .send({ status: 'SUSPENDED' }))
    assert.equal(response.status, 404)
  })

  test('ADMIN cannot change role through status endpoint', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/users/${ids.donor}/status`)
      .set(auth(tokens.admin))
      .send({ status: 'ACTIVE', role: 'ADMIN' }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'UNSUPPORTED_FIELD')
    const stored = await prisma.user.findUnique({ where: { id: ids.donor } })
    assert.equal(stored.role, 'DONOR')
  })

  test('ADMIN cannot suspend their own account', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/users/${ids.admin}/status`)
      .set(auth(tokens.admin))
      .send({ status: 'SUSPENDED' }))
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'ADMIN_SELF_SUSPENSION')
  })

  test('ADMIN lists organisations', async () => {
    const response = remember(await request(app)
      .get('/api/admin/organisations')
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisations.some((item) => item.userId === ids.donor), true)
  })

  test('organisation results contain only safe linked user information', async () => {
    const response = remember(await request(app)
      .get('/api/admin/organisations')
      .set(auth(tokens.admin)))
    const serialized = JSON.stringify(response.body)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('tokenHash'), false)
    assert.ok(response.body.data.organisations.find((item) => item.userId === ids.donor)?.user)
  })

  test('organisation search, city, and role filters work', async () => {
    const searchResponse = remember(await request(app)
      .get('/api/admin/organisations')
      .query({ search: `Searchable Donor ${runId}` })
      .set(auth(tokens.admin)))
    assert.deepEqual(searchResponse.body.data.organisations.map((item) => item.userId), [ids.donor])

    const filtered = remember(await request(app)
      .get('/api/admin/organisations')
      .query({ city: 'Kisumu', role: 'RECIPIENT' })
      .set(auth(tokens.admin)))
    assert.deepEqual(filtered.body.data.organisations.map((item) => item.userId), [ids.recipient])
  })

  test('ADMIN lists active and inactive categories', async () => {
    const response = remember(await request(app)
      .get('/api/admin/categories')
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.categories.some((item) => item.active === true), true)
    assert.equal(response.body.data.categories.some((item) => item.id === ids.inactiveCategory && item.active === false), true)
  })

  test('ADMIN creates an active category by default', async () => {
    const response = remember(await request(app)
      .post('/api/categories')
      .set(auth(tokens.admin))
      .send({ name: ` ${categoryNames.created} `, description: ' Temporary category. ' }))
    assert.equal(response.status, 201)
    assert.equal(response.body.data.category.name, categoryNames.created)
    assert.equal(response.body.data.category.active, true)
    ids.managedCategory = response.body.data.category.id
  })

  test('duplicate category name is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/categories')
      .set(auth(tokens.admin))
      .send({ name: categoryNames.created }))
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'CATEGORY_NAME_IN_USE')
  })

  test('required category name validation works', async () => {
    const response = remember(await request(app)
      .post('/api/categories')
      .set(auth(tokens.admin))
      .send({ name: '   ', description: null }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('ADMIN updates a category and creates a historical donation reference', async () => {
    const response = remember(await request(app)
      .put(`/api/categories/${ids.managedCategory}`)
      .set(auth(tokens.admin))
      .send({ name: categoryNames.updated, description: 'Updated administration category.' }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.category.name, categoryNames.updated)

    const referenced = await createDonation({
      donorId: ids.donor,
      categoryId: ids.managedCategory,
      title: `Admin Category Reference ${runId}`,
    })
    ids.categoryReferenceDonation = referenced.id
  })

  test('ADMIN disables a category', async () => {
    const response = remember(await request(app)
      .patch(`/api/categories/${ids.managedCategory}/status`)
      .set(auth(tokens.admin))
      .send({ active: false }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.category.active, false)
  })

  test('disabled category remains stored and visible to ADMIN', async () => {
    const stored = await prisma.foodCategory.findUnique({ where: { id: ids.managedCategory } })
    assert.ok(stored)
    assert.equal(stored.active, false)
    const response = remember(await request(app)
      .get('/api/admin/categories')
      .query({ active: false, search: categoryNames.updated })
      .set(auth(tokens.admin)))
    assert.equal(response.body.data.categories.some((item) => item.id === ids.managedCategory), true)
  })

  test('existing donation reference remains valid when category is disabled', async () => {
    const donation = await prisma.donation.findUnique({
      where: { id: ids.categoryReferenceDonation },
      include: { category: true },
    })
    assert.equal(donation.categoryId, ids.managedCategory)
    assert.equal(donation.category.active, false)
  })

  test('disabled category cannot be used for new donation creation', async () => {
    const response = remember(await request(app)
      .post('/api/donations')
      .set(auth(tokens.donor))
      .send(donationPayload(ids.managedCategory)))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'CATEGORY_INACTIVE')
  })

  test('ADMIN re-enables a category', async () => {
    const response = remember(await request(app)
      .patch(`/api/categories/${ids.managedCategory}/status`)
      .set(auth(tokens.admin))
      .send({ active: true }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.category.active, true)
  })

  test('non-admin category modification is rejected', async () => {
    const response = remember(await request(app)
      .put(`/api/categories/${ids.managedCategory}`)
      .set(auth(tokens.donor))
      .send({ name: categoryNames.updated, description: null }))
    assert.equal(response.status, 403)
  })

  test('ADMIN lists donations across donors', async () => {
    const response = remember(await request(app)
      .get('/api/admin/donations')
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    const donorIds = new Set(response.body.data.donations
      .filter((donation) => donation.title.includes(runId))
      .map((donation) => donation.donorId))
    assert.equal(donorIds.has(ids.donor), true)
    assert.equal(donorIds.has(ids.otherDonor), true)
  })

  test('admin donation status filter works', async () => {
    const response = remember(await request(app)
      .get('/api/admin/donations')
      .query({ status: 'COLLECTED' })
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.donations.every((donation) => donation.status === 'COLLECTED'), true)
    assert.equal(response.body.data.donations.some((donation) => donation.id === ids.collectedDonation), true)
  })

  test('admin donation city, category, donor, search, and expired filters work', async () => {
    const location = remember(await request(app)
      .get('/api/admin/donations')
      .query({ city: 'Mombasa', category: ids.preparedCategory, donor: ids.otherDonor })
      .set(auth(tokens.admin)))
    assert.equal(location.body.data.donations.some((item) => item.id === ids.otherDonation), true)
    assert.equal(location.body.data.donations.every((item) => item.city === 'Mombasa'), true)

    const search = remember(await request(app)
      .get('/api/admin/donations')
      .query({ search: `Mombasa Search Target ${runId}` })
      .set(auth(tokens.admin)))
    assert.deepEqual(search.body.data.donations.map((item) => item.id), [ids.otherDonation])

    const expired = remember(await request(app)
      .get('/api/admin/donations')
      .query({ expired: true, search: `Expired Target ${runId}` })
      .set(auth(tokens.admin)))
    assert.deepEqual(expired.body.data.donations.map((item) => item.id), [ids.expiredDonation])
  })

  test('ADMIN sees cancelled and collected donation history', async () => {
    const response = remember(await request(app)
      .get('/api/admin/donations')
      .set(auth(tokens.admin)))
    const resultIds = response.body.data.donations.map((item) => item.id)
    assert.equal(resultIds.includes(ids.cancelledDonation), true)
    assert.equal(resultIds.includes(ids.collectedDonation), true)
  })

  test('ADMIN cancels an AVAILABLE donation', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/donations/${ids.availableDonation}/cancel`)
      .set(auth(tokens.admin)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.status, DonationStatus.CANCELLED)
  })

  test('admin cancellation is logical and repeated cancellation is clean', async () => {
    const stored = await prisma.donation.findUnique({ where: { id: ids.availableDonation } })
    assert.ok(stored)
    assert.equal(stored.status, DonationStatus.CANCELLED)

    const repeated = remember(await request(app)
      .patch(`/api/admin/donations/${ids.availableDonation}/cancel`)
      .set(auth(tokens.admin)))
    assert.equal(repeated.status, 200)
    assert.equal(repeated.body.data.donation.status, DonationStatus.CANCELLED)
  })

  test('admin cancellation rejects pending reservations with an administration reason', async () => {
    const reservations = await prisma.reservation.findMany({
      where: { donationId: ids.availableDonation },
    })
    assert.equal(reservations.length, 2)
    assert.equal(reservations.every((item) => item.status === ReservationStatus.REJECTED), true)
    assert.equal(
      reservations.every((item) => item.donorResponse?.includes('administrator')),
      true,
    )
  })

  test('RESERVED donation cannot be admin-cancelled', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/donations/${ids.reservedDonation}/cancel`)
      .set(auth(tokens.admin)))
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'DONATION_NOT_CANCELLABLE')
  })

  test('COLLECTED donation cannot be admin-cancelled', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/donations/${ids.collectedDonation}/cancel`)
      .set(auth(tokens.admin)))
    assert.equal(response.status, 409)
  })

  test('unknown donation returns 404 for admin cancellation', async () => {
    const response = remember(await request(app)
      .patch('/api/admin/donations/2147483647/cancel')
      .set(auth(tokens.admin)))
    assert.equal(response.status, 404)
  })

  test('non-admin admin-cancellation attempt returns 403', async () => {
    const response = remember(await request(app)
      .patch(`/api/admin/donations/${ids.otherDonation}/cancel`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 403)
    const stored = await prisma.donation.findUnique({ where: { id: ids.otherDonation } })
    assert.equal(stored.status, DonationStatus.AVAILABLE)
  })

  test('invalid administration route IDs are rejected', async () => {
    const response = remember(await request(app)
      .patch('/api/admin/users/not-an-id/status')
      .set(auth(tokens.admin))
      .send({ status: 'ACTIVE' }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })
})
