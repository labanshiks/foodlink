import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}`
const runId = Date.now()
const email = `password-reset-smoke.${runId}@example.com`
const oldPassword = 'SmokePass123'
const newPassword = 'NewSmokePass456'

async function apiRequest(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json()

  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${body.error?.code ?? 'UNKNOWN_ERROR'}`)
  }

  return { body, response }
}

async function cleanup() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!user) return

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.reservation.deleteMany({ where: { recipientId: user.id } }),
    prisma.organisation.deleteMany({ where: { userId: user.id } }),
    prisma.donation.deleteMany({ where: { donorId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ])
}

async function run() {
  await cleanup()

  await apiRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Password Reset',
      lastName: 'Smoke Test',
      email,
      phoneNumber: '+254744400001',
      password: oldPassword,
      role: 'DONOR',
      organisationName: 'Password Reset Smoke Organisation',
      organisationType: 'Restaurant',
      organisationDescription: 'Temporary Milestone 9 smoke-test organisation.',
      address: '20 Password Reset Smoke Road',
      city: 'Nairobi',
      organisationContactPhone: '+254744400002',
    }),
  }, 201)
  console.log('PASS temporary user created')

  const forgot = await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const resetToken = forgot.response.headers.get('x-foodlink-development-reset-token')
  if (!resetToken || !/^[a-f0-9]{64}$/i.test(resetToken)) {
    throw new Error('Controlled development reset-token delivery did not return a valid token.')
  }
  console.log('PASS password reset requested through controlled development delivery')

  await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: resetToken,
      password: newPassword,
      passwordConfirmation: newPassword,
    }),
  })
  console.log('PASS password reset completed')

  await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: oldPassword }),
  }, 401)
  console.log('PASS old password rejected')

  const login = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: newPassword }),
  })
  if (!login.body.data.token) throw new Error('New password login did not return a JWT.')
  console.log('PASS new password accepted')

  await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: resetToken,
      password: 'ReuseMustFail789',
      passwordConfirmation: 'ReuseMustFail789',
    }),
  }, 400)
  console.log('PASS reset token reuse rejected')
}

run()
  .catch((error) => {
    console.error(`FAIL password reset smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
