import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { DonationStatus, ReservationStatus } from '@prisma/client'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/prisma.js'

const runId = `${Date.now()}-${process.pid}`
const password = 'StrongPass123'
const emails = {
  donor: `reservation-donor.${runId}@example.com`,
  otherDonor: `reservation-other-donor.${runId}@example.com`,
  recipient: `reservation-recipient.${runId}@example.com`,
  otherRecipient: `reservation-other-recipient.${runId}@example.com`,
}
const responseBodies = []
const ids = {}
const tokens = {}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

function registrationPayload(email, role, suffix) {
  return {
    firstName: 'Reservation',
    lastName: suffix,
    email,
    phoneNumber: '+254766000001',
    password,
    role,
    organisationName: `${suffix} Organisation`,
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Food Bank',
    organisationDescription: 'Milestone 6 automated test organisation.',
    address: '6 Reservation Test Road',
    city: 'Nairobi',
    organisationContactPhone: '+254766000002',
  }
}

function remember(response) {
  responseBodies.push(response.body)
  return response
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

async function createDonation({
  donorId = ids.donor,
  status = DonationStatus.AVAILABLE,
  availableFrom = hoursFromNow(1),
  expiresAt = hoursFromNow(8),
  title,
} = {}) {
  return prisma.donation.create({
    data: {
      donorId,
      categoryId: ids.category,
      title: title ?? `M6 Donation ${runId}`,
      description: 'Milestone 6 reservation workflow fixture.',
      quantity: 8,
      quantityUnit: 'portions',
      availableFrom,
      expiresAt,
      collectionAddress: '7 Reservation Test Road',
      city: 'Nairobi',
      status,
    },
  })
}

async function createReservation({
  donationId,
  recipientId = ids.recipient,
  status = ReservationStatus.PENDING,
  requestedCollectionTime = hoursFromNow(2),
} = {}) {
  return prisma.reservation.create({
    data: {
      donationId,
      recipientId,
      message: 'Please reserve this food for our programme.',
      requestedCollectionTime,
      status,
    },
  })
}

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

function createRequest(donationId, token, overrides = {}) {
  return request(app)
    .post(`/api/donations/${donationId}/reservations`)
    .set(auth(token))
    .send({
      requestedCollectionTime: hoursFromNow(2).toISOString(),
      message: ' Collection requested by the recipient. ',
      ...overrides,
    })
}

async function cleanTestData() {
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(emails) } },
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

describe('FoodLink reservation and collection API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestData()

    const donor = await registerAndLogin(emails.donor, 'DONOR', 'Primary Donor')
    const otherDonor = await registerAndLogin(emails.otherDonor, 'DONOR', 'Other Donor')
    const recipient = await registerAndLogin(emails.recipient, 'RECIPIENT', 'Primary Recipient')
    const otherRecipient = await registerAndLogin(emails.otherRecipient, 'RECIPIENT', 'Other Recipient')
    ids.donor = donor.user.id
    ids.otherDonor = otherDonor.user.id
    ids.recipient = recipient.user.id
    ids.otherRecipient = otherRecipient.user.id
    tokens.donor = donor.token
    tokens.otherDonor = otherDonor.token
    tokens.recipient = recipient.token
    tokens.otherRecipient = otherRecipient.token

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
    assert.equal(adminLogin.status, 200)
    tokens.admin = adminLogin.body.data.token

    const category = await prisma.foodCategory.findUnique({ where: { name: 'Prepared Meals' } })
    assert.ok(category)
    ids.category = category.id

    const base = await createDonation({ title: `M6 Base ${runId}` })
    ids.baseDonation = base.id
    const expired = await createDonation({
      title: `M6 Expired ${runId}`,
      availableFrom: hoursFromNow(-8),
      expiresAt: hoursFromNow(-1),
    })
    ids.expiredDonation = expired.id
    ids.cancelledDonation = (await createDonation({
      title: `M6 Cancelled ${runId}`,
      status: DonationStatus.CANCELLED,
    })).id
    ids.reservedDonation = (await createDonation({
      title: `M6 Reserved ${runId}`,
      status: DonationStatus.RESERVED,
    })).id
    ids.collectedDonation = (await createDonation({
      title: `M6 Collected ${runId}`,
      status: DonationStatus.COLLECTED,
    })).id
    ids.otherDonation = (await createDonation({
      donorId: ids.otherDonor,
      title: `M6 Other Donor ${runId}`,
    })).id

    const historyDonation = await createDonation({ title: `M6 History ${runId}` })
    for (const status of [
      ReservationStatus.REJECTED,
      ReservationStatus.CANCELLED,
      ReservationStatus.COMPLETED,
    ]) {
      await createReservation({ donationId: historyDonation.id, status })
    }

    const approvalDonation = await createDonation({ title: `M6 Approval ${runId}` })
    ids.approvalDonation = approvalDonation.id
    ids.approvalSelected = (await createReservation({ donationId: approvalDonation.id })).id
    ids.approvalCompeting = (await createReservation({
      donationId: approvalDonation.id,
      recipientId: ids.otherRecipient,
    })).id

    ids.otherApproval = (await createReservation({ donationId: ids.otherDonation })).id
    ids.expiredApproval = (await createReservation({
      donationId: ids.expiredDonation,
      requestedCollectionTime: hoursFromNow(-2),
    })).id

    const rejectionDonation = await createDonation({ title: `M6 Rejection ${runId}` })
    ids.rejectionDonation = rejectionDonation.id
    ids.rejectionReservation = (await createReservation({ donationId: rejectionDonation.id })).id

    const cancelDonation = await createDonation({ title: `M6 Recipient Cancel ${runId}` })
    ids.cancelReservation = (await createReservation({ donationId: cancelDonation.id })).id
    ids.otherCancelReservation = (await createReservation({
      donationId: cancelDonation.id,
      recipientId: ids.otherRecipient,
    })).id

    const concurrentDonation = await createDonation({ title: `M6 Concurrent ${runId}` })
    ids.concurrentDonation = concurrentDonation.id
    ids.concurrentOne = (await createReservation({ donationId: concurrentDonation.id })).id
    ids.concurrentTwo = (await createReservation({
      donationId: concurrentDonation.id,
      recipientId: ids.otherRecipient,
    })).id

    const crossCollection = await createDonation({
      donorId: ids.otherDonor,
      title: `M6 Cross Collection ${runId}`,
      status: DonationStatus.RESERVED,
    })
    ids.crossCollectionDonation = crossCollection.id
    await createReservation({
      donationId: crossCollection.id,
      status: ReservationStatus.APPROVED,
    })

    const cancellation = await createDonation({ title: `M6 Donation Cancellation ${runId}` })
    ids.cancellationDonation = cancellation.id
    ids.cancellationPendingOne = (await createReservation({ donationId: cancellation.id })).id
    ids.cancellationPendingTwo = (await createReservation({
      donationId: cancellation.id,
      recipientId: ids.otherRecipient,
    })).id
  })

  after(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  })

  test('recipient creates a PENDING reservation on an available unexpired donation', async () => {
    const response = remember(await createRequest(ids.baseDonation, tokens.recipient))
    assert.equal(response.status, 201)
    assert.equal(response.body.data.reservation.status, ReservationStatus.PENDING)
    assert.equal(response.body.data.reservation.recipientId, ids.recipient)
    ids.baseReservation = response.body.data.reservation.id
  })

  test('DONOR cannot create a reservation', async () => {
    const response = remember(await createRequest(ids.baseDonation, tokens.donor))
    assert.equal(response.status, 403)
  })

  test('ADMIN cannot create a reservation', async () => {
    const response = remember(await createRequest(ids.baseDonation, tokens.admin))
    assert.equal(response.status, 403)
  })

  test('unauthenticated user cannot create a reservation', async () => {
    const response = remember(await request(app)
      .post(`/api/donations/${ids.baseDonation}/reservations`)
      .send({ requestedCollectionTime: hoursFromNow(2).toISOString() }))
    assert.equal(response.status, 401)
  })

  test('client-supplied recipient identity cannot control reservation ownership', async () => {
    const beforeCount = await prisma.reservation.count({ where: { recipientId: ids.otherRecipient } })
    const response = remember(await createRequest(ids.baseDonation, tokens.recipient, {
      recipientId: ids.otherRecipient,
    }))
    assert.equal(response.status, 400)
    assert.equal(await prisma.reservation.count({ where: { recipientId: ids.otherRecipient } }), beforeCount)
  })

  test('client-supplied reservation status is rejected', async () => {
    const response = remember(await createRequest(ids.baseDonation, tokens.recipient, {
      status: ReservationStatus.APPROVED,
    }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'SERVER_CONTROLLED_FIELD')
  })

  test('expired donation cannot be reserved', async () => {
    const response = remember(await createRequest(ids.expiredDonation, tokens.recipient, {
      requestedCollectionTime: hoursFromNow(-2).toISOString(),
    }))
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'DONATION_EXPIRED')
  })

  for (const [label, donationKey] of [
    ['cancelled', 'cancelledDonation'],
    ['reserved', 'reservedDonation'],
    ['collected', 'collectedDonation'],
  ]) {
    test(`${label} donation cannot be reserved`, async () => {
      const response = remember(await createRequest(ids[donationKey], tokens.recipient))
      assert.equal(response.status, 409)
      assert.equal(response.body.error.code, 'DONATION_NOT_AVAILABLE')
    })
  }

  test('requested collection time must be a valid ISO date-time', async () => {
    const response = remember(await createRequest(ids.baseDonation, tokens.recipient, {
      requestedCollectionTime: 'tomorrow afternoon',
    }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('requested collection time outside the availability window is rejected', async () => {
    const response = remember(await createRequest(ids.baseDonation, tokens.recipient, {
      requestedCollectionTime: hoursFromNow(10).toISOString(),
    }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'COLLECTION_TIME_OUTSIDE_WINDOW')
  })

  test('recipient lists only their own reservations with safe donation context', async () => {
    const response = remember(await request(app)
      .get('/api/reservations/mine')
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.reservations.some((item) => item.id === ids.baseReservation), true)
    assert.equal(response.body.data.reservations.every((item) => item.recipientId === ids.recipient), true)
    assert.ok(response.body.data.reservations[0].donation.category)
    assert.ok(response.body.data.reservations[0].donation.donor.organisation)
  })

  test('recipient reservation history includes terminal statuses', async () => {
    const response = remember(await request(app)
      .get('/api/reservations/mine')
      .set(auth(tokens.recipient)))
    const statuses = new Set(response.body.data.reservations.map((item) => item.status))
    for (const status of ['PENDING', 'REJECTED', 'CANCELLED', 'COMPLETED']) {
      assert.equal(statuses.has(status), true)
    }
  })

  test('donor lists reservations only for their own donation', async () => {
    const response = remember(await request(app)
      .get(`/api/donations/${ids.baseDonation}/reservations`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.reservations.some((item) => item.id === ids.baseReservation), true)
    assert.ok(response.body.data.reservations[0].recipient.organisation)
  })

  test('donor cannot list another donor donation reservations', async () => {
    const response = remember(await request(app)
      .get(`/api/donations/${ids.otherDonation}/reservations`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 404)
  })

  test('recipient cannot use the donor reservation listing', async () => {
    const response = remember(await request(app)
      .get(`/api/donations/${ids.baseDonation}/reservations`)
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 403)
  })

  test('donor approves a pending reservation', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.approvalSelected}/approve`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.reservation.status, ReservationStatus.APPROVED)
  })

  test('approval changes the donation to RESERVED', async () => {
    const donation = await prisma.donation.findUnique({ where: { id: ids.approvalDonation } })
    assert.equal(donation.status, DonationStatus.RESERVED)
  })

  test('approval stores the selected reservation as APPROVED', async () => {
    const reservation = await prisma.reservation.findUnique({ where: { id: ids.approvalSelected } })
    assert.equal(reservation.status, ReservationStatus.APPROVED)
  })

  test('approval rejects all other pending reservations for the donation', async () => {
    const competing = await prisma.reservation.findUnique({ where: { id: ids.approvalCompeting } })
    assert.equal(competing.status, ReservationStatus.REJECTED)
  })

  test('only one reservation is approved for a donation', async () => {
    const count = await prisma.reservation.count({
      where: { donationId: ids.approvalDonation, status: ReservationStatus.APPROVED },
    })
    assert.equal(count, 1)
  })

  test('concurrent approvals are safe and repeated approval is rejected cleanly', async () => {
    const [first, second] = await Promise.all([
      request(app).patch(`/api/reservations/${ids.concurrentOne}/approve`).set(auth(tokens.donor)),
      request(app).patch(`/api/reservations/${ids.concurrentTwo}/approve`).set(auth(tokens.donor)),
    ])
    remember(first)
    remember(second)
    assert.deepEqual([first.status, second.status].sort(), [200, 409])
    assert.equal(await prisma.reservation.count({
      where: { donationId: ids.concurrentDonation, status: ReservationStatus.APPROVED },
    }), 1)

    const approved = first.status === 200 ? ids.concurrentOne : ids.concurrentTwo
    const repeated = remember(await request(app)
      .patch(`/api/reservations/${approved}/approve`)
      .set(auth(tokens.donor)))
    assert.equal(repeated.status, 409)
  })

  test('donor cannot approve a reservation on another donor donation', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.otherApproval}/approve`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 404)
  })

  test('expired donation reservation cannot be approved', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.expiredApproval}/approve`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'DONATION_EXPIRED')
  })

  test('donor rejects a pending reservation with an optional response', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.rejectionReservation}/reject`)
      .set(auth(tokens.donor))
      .send({ donorResponse: ' The food is no longer available. ' }))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.reservation.status, ReservationStatus.REJECTED)
    assert.equal(response.body.data.reservation.donorResponse, 'The food is no longer available.')
  })

  test('rejection leaves the donation AVAILABLE', async () => {
    const donation = await prisma.donation.findUnique({ where: { id: ids.rejectionDonation } })
    assert.equal(donation.status, DonationStatus.AVAILABLE)
  })

  test('recipient cancels their own pending reservation', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.cancelReservation}/cancel`)
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.reservation.status, ReservationStatus.CANCELLED)
  })

  test('recipient cannot cancel another recipient reservation', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.otherCancelReservation}/cancel`)
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 404)
    const stored = await prisma.reservation.findUnique({ where: { id: ids.otherCancelReservation } })
    assert.equal(stored.status, ReservationStatus.PENDING)
  })

  test('repeated recipient cancellation is handled idempotently', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.cancelReservation}/cancel`)
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.reservation.status, ReservationStatus.CANCELLED)
  })

  test('donor marks a reserved donation with one approved reservation collected', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${ids.approvalDonation}/collected`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.status, DonationStatus.COLLECTED)
    assert.equal(response.body.data.reservation.status, ReservationStatus.COMPLETED)
  })

  test('collection stores the donation as COLLECTED', async () => {
    const donation = await prisma.donation.findUnique({ where: { id: ids.approvalDonation } })
    assert.equal(donation.status, DonationStatus.COLLECTED)
  })

  test('collection stores the approved reservation as COMPLETED', async () => {
    const reservation = await prisma.reservation.findUnique({ where: { id: ids.approvalSelected } })
    assert.equal(reservation.status, ReservationStatus.COMPLETED)
  })

  test('collection transaction leaves both records in a consistent terminal state', async () => {
    const [donation, reservation] = await Promise.all([
      prisma.donation.findUnique({ where: { id: ids.approvalDonation } }),
      prisma.reservation.findUnique({ where: { id: ids.approvalSelected } }),
    ])
    assert.deepEqual(
      [donation.status, reservation.status],
      [DonationStatus.COLLECTED, ReservationStatus.COMPLETED],
    )
  })

  test('recipient cannot cancel a completed reservation', async () => {
    const response = remember(await request(app)
      .patch(`/api/reservations/${ids.approvalSelected}/cancel`)
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 409)

    const stored = await prisma.reservation.findUnique({ where: { id: ids.approvalSelected } })
    assert.equal(stored.status, ReservationStatus.COMPLETED)
  })

  test('AVAILABLE donation cannot be marked collected directly', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${ids.baseDonation}/collected`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 409)
  })

  test('CANCELLED donation cannot be marked collected', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${ids.cancelledDonation}/collected`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 409)
  })

  test('COLLECTED donation cannot be marked collected repeatedly', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${ids.approvalDonation}/collected`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 409)
  })

  test('donor cannot mark another donor donation collected', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${ids.crossCollectionDonation}/collected`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 404)
    const stored = await prisma.donation.findUnique({ where: { id: ids.crossCollectionDonation } })
    assert.equal(stored.status, DonationStatus.RESERVED)
  })

  test('password hashes and reset token data never appear in reservation responses', () => {
    const serialized = JSON.stringify(responseBodies)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('password_hash'), false)
    assert.equal(serialized.includes('tokenHash'), false)
    assert.equal(serialized.includes('token_hash'), false)
  })

  test('donation cancellation atomically rejects its pending reservations', async () => {
    const response = remember(await request(app)
      .patch(`/api/donations/${ids.cancellationDonation}/cancel`)
      .set(auth(tokens.donor)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.donation.status, DonationStatus.CANCELLED)

    const reservations = await prisma.reservation.findMany({
      where: { donationId: ids.cancellationDonation },
      orderBy: { id: 'asc' },
    })
    assert.equal(reservations.length, 2)
    assert.equal(reservations.every((item) => item.status === ReservationStatus.REJECTED), true)
    assert.equal(
      reservations.every((item) => item.donorResponse === 'The donation was cancelled by the donor.'),
      true,
    )
  })

  test('reservation route IDs must be positive integers', async () => {
    const response = remember(await request(app)
      .patch('/api/reservations/not-an-id/cancel')
      .set(auth(tokens.recipient)))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })
})
