import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/config/prisma.js'

const runId = `${Date.now()}-${process.pid}`
const donorEmail = `profile-donor.${runId}@example.com`
const recipientEmail = `profile-recipient.${runId}@example.com`
const missingOrganisationEmail = `profile-missing.${runId}@example.com`
const password = 'StrongPass123'
const cleanupEmails = [donorEmail, recipientEmail, missingOrganisationEmail]
const responseBodies = []

let donorToken
let recipientToken
let adminToken
let missingOrganisationToken
let donorUserId
let recipientUserId
let donorOrganisationId
let recipientOrganisationId

function registrationPayload(email, role) {
  return {
    firstName: 'Profile',
    lastName: role === 'DONOR' ? 'Donor' : 'Recipient',
    email,
    phoneNumber: '+254711000001',
    password,
    role,
    organisationName: role === 'DONOR' ? 'Original Donor Organisation' : 'Original Recipient Organisation',
    organisationType: role === 'DONOR' ? 'Restaurant' : 'Charity',
    organisationDescription: 'Original profile description.',
    address: '1 Original Road',
    city: 'Nairobi',
    organisationContactPhone: '+254711000002',
  }
}

function updatePayload(overrides = {}) {
  return {
    name: 'Updated Organisation',
    organisationType: 'Updated Type',
    description: 'Updated profile description.',
    address: '2 Updated Road',
    city: 'Nairobi',
    contactPhone: '+254722000002',
    ...overrides,
  }
}

function remember(response) {
  responseBodies.push(response.body)
  return response
}

async function cleanTestUsers() {
  const users = await prisma.user.findMany({
    where: { email: { in: cleanupEmails } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)

  if (userIds.length === 0) {
    return
  }

  await prisma.$transaction([
    prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ])
}

async function registerAndLogin(email, role) {
  const registration = await request(app)
    .post('/api/auth/register')
    .send(registrationPayload(email, role))
  assert.equal(registration.status, 201)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
  assert.equal(login.status, 200)

  return {
    token: login.body.data.token,
    user: login.body.data.user,
  }
}

describe('FoodLink organisation profile API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestUsers()

    const donor = await registerAndLogin(donorEmail, 'DONOR')
    const recipient = await registerAndLogin(recipientEmail, 'RECIPIENT')
    donorToken = donor.token
    recipientToken = recipient.token
    donorUserId = donor.user.id
    recipientUserId = recipient.user.id
    donorOrganisationId = donor.user.organisation.id
    recipientOrganisationId = recipient.user.organisation.id

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.create({
      data: {
        firstName: 'Missing',
        lastName: 'Organisation',
        email: missingOrganisationEmail,
        passwordHash,
        phoneNumber: '+254733000001',
        role: UserRole.DONOR,
      },
    })
    const missingLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: missingOrganisationEmail, password })
    assert.equal(missingLogin.status, 200)
    missingOrganisationToken = missingLogin.body.data.token

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
    assert.equal(adminLogin.status, 200)
    adminToken = adminLogin.body.data.token
  })

  after(async () => {
    await cleanTestUsers()
    await prisma.$disconnect()
  })

  test('DONOR retrieves own organisation', async () => {
    const response = remember(await request(app)
      .get('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisation.id, donorOrganisationId)
    assert.equal(response.body.data.organisation.user.id, donorUserId)
    assert.equal(response.body.data.organisation.name, 'Original Donor Organisation')
  })

  test('RECIPIENT retrieves own organisation', async () => {
    const response = remember(await request(app)
      .get('/api/organisations/me')
      .set('Authorization', `Bearer ${recipientToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisation.id, recipientOrganisationId)
    assert.equal(response.body.data.organisation.user.id, recipientUserId)
  })

  test('unauthenticated GET is rejected', async () => {
    const response = remember(await request(app).get('/api/organisations/me'))

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED')
  })

  test('ADMIN GET is rejected', async () => {
    const response = remember(await request(app)
      .get('/api/organisations/me')
      .set('Authorization', `Bearer ${adminToken}`))

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'FORBIDDEN')
  })

  test('DONOR updates own organisation', async () => {
    const response = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(updatePayload({ name: 'Updated Donor Organisation' })))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisation.id, donorOrganisationId)
    assert.equal(response.body.data.organisation.name, 'Updated Donor Organisation')
  })

  test('RECIPIENT updates own organisation', async () => {
    const response = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send(updatePayload({
        name: 'Updated Recipient Organisation',
        organisationType: 'Food Bank',
      })))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisation.id, recipientOrganisationId)
    assert.equal(response.body.data.organisation.name, 'Updated Recipient Organisation')
  })

  test('required fields are validated', async () => {
    const payload = updatePayload()
    delete payload.name

    const response = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(payload))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.equal(response.body.error.details.some((detail) => detail.field === 'name'), true)
  })

  test('empty required fields are rejected', async () => {
    const response = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(updatePayload({ name: '   ', city: '' })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.equal(response.body.error.details.some((detail) => detail.field === 'name'), true)
    assert.equal(response.body.error.details.some((detail) => detail.field === 'city'), true)
  })

  test('description may be empty or null', async () => {
    const emptyResponse = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(updatePayload({ description: '' })))
    assert.equal(emptyResponse.status, 200)
    assert.equal(emptyResponse.body.data.organisation.description, null)

    const nullResponse = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send(updatePayload({ description: null })))
    assert.equal(nullResponse.status, 200)
    assert.equal(nullResponse.body.data.organisation.description, null)
  })

  test('a user cannot update another user organisation by supplying its id', async () => {
    const recipientBefore = await prisma.organisation.findUnique({
      where: { id: recipientOrganisationId },
    })

    const response = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(updatePayload({
        id: recipientOrganisationId,
        name: 'Donor Owned Update Only',
      })))

    const recipientAfter = await prisma.organisation.findUnique({
      where: { id: recipientOrganisationId },
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisation.id, donorOrganisationId)
    assert.equal(recipientAfter.name, recipientBefore.name)
  })

  test('client-supplied user_id cannot change ownership', async () => {
    const response = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(updatePayload({
        user_id: recipientUserId,
        userId: recipientUserId,
        name: 'Still the Donor Organisation',
      })))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.organisation.id, donorOrganisationId)
    assert.equal(response.body.data.organisation.user.id, donorUserId)
  })

  test('passwordHash never appears in organisation responses', () => {
    for (const body of responseBodies) {
      const serialized = JSON.stringify(body)
      assert.equal(serialized.includes('passwordHash'), false)
      assert.equal(serialized.includes('password_hash'), false)
    }
  })

  test('updating one organisation does not modify another organisation', async () => {
    const recipientBefore = await prisma.organisation.findUnique({
      where: { id: recipientOrganisationId },
    })

    await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(updatePayload({ name: 'Final Donor Organisation' }))

    const recipientAfter = await prisma.organisation.findUnique({
      where: { id: recipientOrganisationId },
    })
    assert.deepEqual(recipientAfter, recipientBefore)
  })

  test('unknown or missing organisation is handled cleanly', async () => {
    const getResponse = remember(await request(app)
      .get('/api/organisations/me')
      .set('Authorization', `Bearer ${missingOrganisationToken}`))
    assert.equal(getResponse.status, 404)
    assert.equal(getResponse.body.error.code, 'ORGANISATION_NOT_FOUND')

    const putResponse = remember(await request(app)
      .put('/api/organisations/me')
      .set('Authorization', `Bearer ${missingOrganisationToken}`)
      .send(updatePayload()))
    assert.equal(putResponse.status, 404)
    assert.equal(putResponse.body.error.code, 'ORGANISATION_NOT_FOUND')
  })
})
