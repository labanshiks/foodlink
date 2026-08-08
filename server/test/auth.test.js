import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { UserRole, UserStatus } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import app from '../src/app.js'
import { env } from '../src/config/env.js'
import prisma from '../src/config/prisma.js'
import {
  requireAdmin,
  requireDonor,
  requireRecipient,
} from '../src/middleware/authMiddleware.js'

const runId = `${Date.now()}-${process.pid}`
const donorEmail = `donor.${runId}@example.com`
const recipientEmail = `recipient.${runId}@example.com`
const suspendedEmail = `suspended.${runId}@example.com`
const rollbackEmail = `rollback.${runId}@example.com`
const invalidEmail = `invalid.${runId}`
const password = 'StrongPass123'
const responseBodies = []
const cleanupEmails = [donorEmail, recipientEmail, suspendedEmail, rollbackEmail]

let donorToken
let suspendedToken

function registrationPayload(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: donorEmail,
    phoneNumber: '+254700000001',
    password,
    role: 'DONOR',
    organisationName: 'FoodLink Test Organisation',
    organisationType: 'Restaurant',
    organisationDescription: 'Created by the Milestone 3 integration tests.',
    address: '1 Test Street',
    city: 'Nairobi',
    organisationContactPhone: '+254700000002',
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
    prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.reservation.deleteMany({ where: { recipientId: { in: userIds } } }),
    prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.donation.deleteMany({ where: { donorId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ])
}

describe('FoodLink authentication API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestUsers()

    prisma.$use(async (params, next) => {
      if (
        params.model === 'Organisation'
        && params.action === 'create'
        && params.args.data.name === 'Force Transaction Rollback'
      ) {
        throw new Error('Simulated organisation database failure')
      }

      return next(params)
    })
  })

  after(async () => {
    await cleanTestUsers()
    await prisma.$disconnect()
  })

  test('successful DONOR registration', async () => {
    const response = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload()))

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.user.email, donorEmail)
    assert.equal(response.body.data.user.role, UserRole.DONOR)
    assert.equal(response.body.data.user.organisation.name, 'FoodLink Test Organisation')
  })

  test('successful RECIPIENT registration', async () => {
    const response = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({
        email: recipientEmail,
        role: 'RECIPIENT',
        organisationName: 'FoodLink Recipient Test',
        organisationType: 'Charity',
      })))

    assert.equal(response.status, 201)
    assert.equal(response.body.data.user.role, UserRole.RECIPIENT)
  })

  test('ADMIN public registration is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({
        email: `admin-attempt.${runId}@example.com`,
        role: 'ADMIN',
      })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('duplicate email is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({ organisationName: 'Duplicate Attempt' })))

    assert.equal(response.status, 409)
    assert.equal(response.body.error.code, 'EMAIL_IN_USE')
  })

  test('invalid email is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({ email: invalidEmail })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('weak password is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({
        email: `weak.${runId}@example.com`,
        password: 'weak',
      })))

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('successful login returns a signed one-hour JWT', async () => {
    const response = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: donorEmail.toUpperCase(), password }))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.email, donorEmail)
    assert.ok(response.body.data.token)

    donorToken = response.body.data.token
    const payload = jwt.verify(donorToken, env.jwtSecret, {
      issuer: 'foodlink-api',
      audience: 'foodlink-client',
    })

    assert.equal(payload.role, UserRole.DONOR)
    assert.equal(Number(payload.sub), response.body.data.user.id)
    assert.equal(payload.exp - payload.iat, 60 * 60)
  })

  test('wrong password is rejected without identifying the account', async () => {
    const response = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: donorEmail, password: 'WrongPass123' }))

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS')
  })

  test('nonexistent email uses the same credential error', async () => {
    const response = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: `missing.${runId}@example.com`, password }))

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS')
  })

  test('suspended user is rejected at login and by JWT middleware', async () => {
    const registration = remember(await request(app)
      .post('/api/auth/register')
      .send(registrationPayload({
        email: suspendedEmail,
        organisationName: 'Suspended Test Organisation',
      })))
    assert.equal(registration.status, 201)

    const login = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: suspendedEmail, password }))
    assert.equal(login.status, 200)
    suspendedToken = login.body.data.token

    await prisma.user.update({
      where: { email: suspendedEmail },
      data: { status: UserStatus.SUSPENDED },
    })

    const suspendedLogin = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: suspendedEmail, password }))
    assert.equal(suspendedLogin.status, 403)
    assert.equal(suspendedLogin.body.error.code, 'ACCOUNT_SUSPENDED')

    const suspendedMe = remember(await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${suspendedToken}`))
    assert.equal(suspendedMe.status, 403)
    assert.equal(suspendedMe.body.error.code, 'ACCOUNT_SUSPENDED')
  })

  test('GET /api/auth/me with a valid JWT succeeds', async () => {
    const response = remember(await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.email, donorEmail)
  })

  test('GET /api/auth/me without a JWT fails', async () => {
    const response = remember(await request(app).get('/api/auth/me'))

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED')
  })

  test('GET /api/auth/me with an invalid JWT fails', async () => {
    const response = remember(await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token'))

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'INVALID_TOKEN')
  })

  test('password hash never appears in API responses', () => {
    for (const body of responseBodies) {
      const serialized = JSON.stringify(body)
      assert.equal(serialized.includes('passwordHash'), false)
      assert.equal(serialized.includes('password_hash'), false)
    }
  })

  test('registration creates both User and Organisation records with a bcrypt hash', async () => {
    const user = await prisma.user.findUnique({
      where: { email: donorEmail },
      include: { organisation: true },
    })

    assert.ok(user)
    assert.ok(user.organisation)
    assert.notEqual(user.passwordHash, password)
    assert.match(user.passwordHash, /^\$2[aby]\$/)
    assert.equal(await bcrypt.compare(password, user.passwordHash), true)
  })

  test('failed Organisation creation rolls back the User record', async () => {
    const originalConsoleError = console.error
    console.error = () => {}

    let response
    try {
      response = remember(await request(app)
        .post('/api/auth/register')
        .send(registrationPayload({
          email: rollbackEmail,
          organisationName: 'Force Transaction Rollback',
        })))
    } finally {
      console.error = originalConsoleError
    }

    assert.equal(response.status, 500)
    assert.equal(response.body.error.code, 'INTERNAL_SERVER_ERROR')
    assert.equal(await prisma.user.findUnique({ where: { email: rollbackEmail } }), null)
  })

  test('authenticated logout succeeds without exposing a token', async () => {
    const response = remember(await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${donorToken}`))

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal('token' in response.body.data, false)
  })

  test('DONOR, RECIPIENT, and ADMIN role middleware allow only their roles', () => {
    const cases = [
      [requireDonor, UserRole.DONOR],
      [requireRecipient, UserRole.RECIPIENT],
      [requireAdmin, UserRole.ADMIN],
    ]

    for (const [middleware, role] of cases) {
      let allowedError
      middleware({ user: { role } }, {}, (error) => { allowedError = error })
      assert.equal(allowedError, undefined)

      let deniedError
      middleware({ user: { role: UserRole.RECIPIENT } }, {}, (error) => { deniedError = error })
      if (role === UserRole.RECIPIENT) {
        assert.equal(deniedError, undefined)
      } else {
        assert.equal(deniedError.statusCode, 403)
        assert.equal(deniedError.code, 'FORBIDDEN')
      }
    }
  })
})
