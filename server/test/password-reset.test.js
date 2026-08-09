import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { UserStatus } from '@prisma/client'
import bcrypt from 'bcrypt'
import request from 'supertest'
import app from '../src/app.js'
import { env } from '../src/config/env.js'
import prisma from '../src/config/prisma.js'
import {
  clearDevelopmentResetTokens,
  getDevelopmentResetToken,
} from '../src/services/passwordResetDelivery.js'

const runId = `${Date.now()}-${process.pid}`
const activeEmail = `password-reset-active.${runId}@example.com`
const suspendedEmail = `password-reset-suspended.${runId}@example.com`
const nonexistentEmail = `password-reset-missing.${runId}@example.com`
const oldPassword = 'StrongPass123'
const newPassword = 'NewStrongPass456'
const suspendedNewPassword = 'SuspendedPass789'
const cleanupEmails = [activeEmail, suspendedEmail]
const responseBodies = []

let activeUserId
let suspendedUserId
let suspendedToken
let firstToken
let validToken
let genericExistingBody
let genericMissingBody

function registrationPayload(email, organisationName) {
  return {
    firstName: 'Password',
    lastName: 'Reset Test',
    email,
    phoneNumber: '+254733300001',
    password: oldPassword,
    role: 'DONOR',
    organisationName,
    organisationType: 'Restaurant',
    organisationDescription: 'Temporary Milestone 9 test organisation.',
    address: '19 Password Reset Test Road',
    city: 'Nairobi',
    organisationContactPhone: '+254733300002',
  }
}

function remember(response) {
  responseBodies.push(response.body)
  return response
}

function resetPayload(token, password = newPassword, passwordConfirmation = password) {
  return { token, password, passwordConfirmation }
}

async function latestTokenRecord(userId) {
  return prisma.passwordResetToken.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })
}

async function cleanTestData() {
  const users = await prisma.user.findMany({
    where: { email: { in: cleanupEmails } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)

  if (userIds.length > 0) {
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.reservation.deleteMany({ where: { recipientId: { in: userIds } } }),
      prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.donation.deleteMany({ where: { donorId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  }

  clearDevelopmentResetTokens()
}

describe('FoodLink password reset API', { concurrency: false }, () => {
  before(async () => {
    await cleanTestData()

    const activeRegistration = await request(app)
      .post('/api/auth/register')
      .send(registrationPayload(activeEmail, 'Active Password Reset Organisation'))
    assert.equal(activeRegistration.status, 201)
    activeUserId = activeRegistration.body.data.user.id

    const suspendedRegistration = await request(app)
      .post('/api/auth/register')
      .send(registrationPayload(suspendedEmail, 'Suspended Password Reset Organisation'))
    assert.equal(suspendedRegistration.status, 201)
    suspendedUserId = suspendedRegistration.body.data.user.id

    const suspendedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: suspendedEmail, password: oldPassword })
    assert.equal(suspendedLogin.status, 200)
    suspendedToken = suspendedLogin.body.data.token

    await prisma.user.update({
      where: { id: suspendedUserId },
      data: { status: UserStatus.SUSPENDED },
    })
  })

  after(async () => {
    await cleanTestData()
    await prisma.$disconnect()
  })

  test('forgot-password accepts a valid email format', async () => {
    const response = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: activeEmail.toUpperCase() }))
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
  })

  test('invalid email format is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('existing user forgot-password response is generic', async () => {
    const response = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: ` ${activeEmail.toUpperCase()} ` }))
    assert.equal(response.status, 200)
    genericExistingBody = response.body
    firstToken = getDevelopmentResetToken(activeEmail)
    assert.ok(firstToken)
  })

  test('nonexistent user forgot-password response is identical and generic', async () => {
    const response = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: nonexistentEmail }))
    assert.equal(response.status, 200)
    genericMissingBody = response.body
    assert.deepEqual(genericMissingBody, genericExistingBody)
  })

  test('existing user forgot-password creates a reset-token database record', async () => {
    const records = await prisma.passwordResetToken.findMany({ where: { userId: activeUserId } })
    assert.equal(records.length > 0, true)
    assert.equal(records.some((record) => record.usedAt === null), true)
  })

  test('nonexistent user forgot-password does not create a reset-token record', async () => {
    const beforeCount = await prisma.passwordResetToken.count()
    const response = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: nonexistentEmail }))
    assert.equal(response.status, 200)
    assert.equal(await prisma.passwordResetToken.count(), beforeCount)
  })

  test('raw reset token is never stored in MySQL', async () => {
    const records = await prisma.passwordResetToken.findMany({ where: { userId: activeUserId } })
    assert.equal(records.some((record) => record.tokenHash === firstToken), false)
  })

  test('stored reset token is a SHA-256 hash', async () => {
    const expectedHash = createHash('sha256').update(firstToken, 'utf8').digest('hex')
    const record = await prisma.passwordResetToken.findFirst({
      where: { userId: activeUserId, tokenHash: expectedHash },
    })
    assert.ok(record)
    assert.equal(record.tokenHash.length, 64)
  })

  test('reset token has the configured expiry', async () => {
    const record = await latestTokenRecord(activeUserId)
    const expectedLifetime = env.passwordResetExpiresMinutes * 60 * 1000
    const actualLifetime = record.expiresAt.getTime() - record.createdAt.getTime()
    assert.equal(Math.abs(actualLifetime - expectedLifetime) < 5000, true)
    assert.equal(record.expiresAt > new Date(), true)
  })

  test('new reset request retires previous unused token', async () => {
    const previousRecord = await latestTokenRecord(activeUserId)
    assert.equal(previousRecord.usedAt, null)

    const response = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: activeEmail }))
    assert.equal(response.status, 200)
    validToken = getDevelopmentResetToken(activeEmail)
    assert.notEqual(validToken, firstToken)

    const retired = await prisma.passwordResetToken.findUnique({ where: { id: previousRecord.id } })
    assert.ok(retired.usedAt)
    assert.equal(await prisma.passwordResetToken.count({
      where: { userId: activeUserId, usedAt: null },
    }), 1)
  })

  test('valid reset token changes the password', async () => {
    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload(validToken)))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.message, 'Password reset successfully.')
  })

  test('new password is stored as a bcrypt hash', async () => {
    const user = await prisma.user.findUnique({ where: { id: activeUserId } })
    assert.notEqual(user.passwordHash, newPassword)
    assert.equal(user.passwordHash.startsWith('$2'), true)
    assert.equal(await bcrypt.compare(newPassword, user.passwordHash), true)
  })

  test('old password no longer works', async () => {
    const response = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: activeEmail, password: oldPassword }))
    assert.equal(response.status, 401)
  })

  test('new password works', async () => {
    const response = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: activeEmail, password: newPassword }))
    assert.equal(response.status, 200)
    assert.ok(response.body.data.token)
  })

  test('reset token becomes used after successful reset', async () => {
    const tokenHash = createHash('sha256').update(validToken, 'utf8').digest('hex')
    const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash } })
    assert.ok(record.usedAt)
  })

  test('used reset token cannot be reused', async () => {
    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload(validToken, 'AnotherPass123')))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'RESET_TOKEN_USED')
  })

  test('invalid reset token is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload('a'.repeat(64), 'AnotherPass123')))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'INVALID_RESET_TOKEN')
  })

  test('expired reset token is rejected', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: activeEmail })
    const expiredToken = getDevelopmentResetToken(activeEmail)
    const tokenHash = createHash('sha256').update(expiredToken, 'utf8').digest('hex')
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    })

    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload(expiredToken, 'AnotherPass123')))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'RESET_TOKEN_EXPIRED')
  })

  test('missing reset token is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send({ password: 'AnotherPass123', passwordConfirmation: 'AnotherPass123' }))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('weak new password is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload('b'.repeat(64), 'weak')))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('password confirmation mismatch is rejected', async () => {
    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload('c'.repeat(64), 'AnotherPass123', 'DifferentPass123')))
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  test('failed reset does not partially modify password or token state', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: activeEmail })
    const failureToken = getDevelopmentResetToken(activeEmail)
    const beforeUser = await prisma.user.findUnique({ where: { id: activeUserId } })
    const beforeToken = await latestTokenRecord(activeUserId)

    const response = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload(failureToken, 'AnotherPass123', 'MismatchPass123')))
    assert.equal(response.status, 400)

    const afterUser = await prisma.user.findUnique({ where: { id: activeUserId } })
    const afterToken = await prisma.passwordResetToken.findUnique({ where: { id: beforeToken.id } })
    assert.equal(afterUser.passwordHash, beforeUser.passwordHash)
    assert.equal(beforeToken.usedAt, null)
    assert.equal(afterToken.usedAt, null)
  })

  test('suspended user password reset does not remove SUSPENDED status', async () => {
    const forgot = remember(await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: suspendedEmail }))
    assert.equal(forgot.status, 200)
    const suspendedResetToken = getDevelopmentResetToken(suspendedEmail)

    const reset = remember(await request(app)
      .post('/api/auth/reset-password')
      .send(resetPayload(suspendedResetToken, suspendedNewPassword)))
    assert.equal(reset.status, 200)

    const user = await prisma.user.findUnique({ where: { id: suspendedUserId } })
    assert.equal(user.status, UserStatus.SUSPENDED)
    assert.equal(await bcrypt.compare(suspendedNewPassword, user.passwordHash), true)
  })

  test('suspended user remains blocked from login and protected APIs after reset', async () => {
    const login = remember(await request(app)
      .post('/api/auth/login')
      .send({ email: suspendedEmail, password: suspendedNewPassword }))
    assert.equal(login.status, 403)
    assert.equal(login.body.error.code, 'ACCOUNT_SUSPENDED')

    const protectedResponse = remember(await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${suspendedToken}`))
    assert.equal(protectedResponse.status, 403)
    assert.equal(protectedResponse.body.error.code, 'ACCOUNT_SUSPENDED')
  })

  test('passwordHash never appears in password-reset responses', () => {
    const serialized = JSON.stringify(responseBodies)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('password_hash'), false)
  })

  test('tokenHash never appears in password-reset responses', () => {
    const serialized = JSON.stringify(responseBodies)
    assert.equal(serialized.includes('tokenHash'), false)
    assert.equal(serialized.includes('token_hash'), false)
  })

  test('generic forgot-password response prevents account enumeration', () => {
    assert.deepEqual(genericExistingBody, genericMissingBody)
    assert.deepEqual(Object.keys(genericExistingBody), ['success', 'data'])
  })
})
