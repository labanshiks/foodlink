import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apiUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 5000}/api`
const frontendUrl = process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173'
const runId = `${Date.now()}-${process.pid}`
const emails = {
  donor: `full-stack-donor.${runId}@example.com`,
  recipient: `full-stack-recipient.${runId}@example.com`,
}
const passwords = { donor: 'SmokeDonor123', recipient: 'SmokeRecipient123', reset: 'ResetDonor456' }
const categoryNames = { created: `Smoke Category ${runId}`, updated: `Smoke Category Updated ${runId}` }

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

async function api(path, { method = 'GET', token, body, headers = {}, expected = 200 } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? auth(token) : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  if (response.status !== expected) {
    throw new Error(`${method} ${path} returned ${response.status}: ${payload.error?.code ?? 'UNKNOWN_ERROR'} ${payload.error?.message ?? ''}`)
  }
  return { payload, response }
}

async function verifyFrontendRoute(path, label) {
  const response = await fetch(`${frontendUrl}${path}`)
  const html = await response.text()
  assert(response.status === 200 && html.includes('<title>FoodLink</title>'), `${label} did not load through Vite.`)
}

function registrationPayload(email, role) {
  const donor = role === 'DONOR'
  return {
    firstName: donor ? 'Green Spoon' : 'Hope Community',
    lastName: 'Smoke Test',
    email,
    phoneNumber: donor ? '+254700900001' : '+254700900002',
    password: donor ? passwords.donor : passwords.recipient,
    role,
    organisationName: donor ? 'Green Spoon Restaurant' : 'Hope Community Centre',
    organisationType: donor ? 'Restaurant' : 'Community Centre',
    organisationDescription: 'Temporary Milestone 10 full-stack smoke-test organisation.',
    address: donor ? 'Westlands Food Court' : 'Hope Centre Road',
    city: 'Nairobi',
    organisationContactPhone: donor ? '+254700900011' : '+254700900012',
  }
}

function donationPayload(categoryId, title) {
  return {
    categoryId,
    title,
    description: 'Freshly prepared surplus meals for same-day community collection.',
    quantity: 25,
    quantityUnit: 'meals',
    availableFrom: hoursFromNow(1),
    expiresAt: hoursFromNow(5),
    collectionAddress: 'Westlands, Nairobi',
    city: 'Nairobi',
    collectionInstructions: 'Ask for the FoodLink collection contact.',
    imageUrl: null,
  }
}

async function cleanup() {
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
      prisma.reservation.deleteMany({
        where: {
          OR: [
            { recipientId: { in: userIds } },
            { donationId: { in: donationIds.length > 0 ? donationIds : [-1] } },
          ],
        },
      }),
      prisma.donation.deleteMany({ where: { donorId: { in: userIds } } }),
      prisma.organisation.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  }

  await prisma.foodCategory.deleteMany({
    where: { name: { in: Object.values(categoryNames) } },
  })
}

async function run() {
  await cleanup()

  await verifyFrontendRoute('/', 'Home page')
  await verifyFrontendRoute('/donations', 'Donation browse page')
  await verifyFrontendRoute('/donations/1', 'Donation detail route')
  console.log('PASS PUBLIC frontend routes load')

  const publicCategories = await api('/categories')
  const categories = publicCategories.payload.data.categories
  assert(categories.length > 0 && categories.every((item) => item.active === true), 'Public categories were not active-only.')
  assert(categories.every((item) => JSON.stringify(Object.keys(item).sort()) === JSON.stringify(['active', 'description', 'id', 'name'])), 'Public categories exposed unexpected fields.')
  const preparedMeals = categories.find((category) => category.name === 'Prepared Meals')
  assert(preparedMeals, 'Prepared Meals category is required for the demonstration.')
  console.log('PASS PUBLIC active category listing')

  await api('/auth/register', { method: 'POST', body: registrationPayload(emails.donor, 'DONOR'), expected: 201 })
  await api('/auth/register', { method: 'POST', body: registrationPayload(emails.recipient, 'RECIPIENT'), expected: 201 })

  const donorLogin = await api('/auth/login', { method: 'POST', body: { email: emails.donor, password: passwords.donor } })
  const recipientLogin = await api('/auth/login', { method: 'POST', body: { email: emails.recipient, password: passwords.recipient } })
  const adminLogin = await api('/auth/login', { method: 'POST', body: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD } })
  const donorToken = donorLogin.payload.data.token
  const recipientToken = recipientLogin.payload.data.token
  const adminToken = adminLogin.payload.data.token
  const donorId = donorLogin.payload.data.user.id
  console.log('PASS AUTH donor, recipient, and admin login')

  await api('/dashboard', { token: donorToken })
  await api('/dashboard', { token: recipientToken })
  await api('/dashboard', { token: adminToken })
  console.log('PASS DASHBOARD donor, recipient, and admin views')

  const profile = await api('/organisations/me', { token: donorToken })
  const organisation = profile.payload.data.organisation
  await api('/organisations/me', {
    method: 'PUT',
    token: donorToken,
    body: {
      name: organisation.name,
      organisationType: organisation.organisationType,
      description: 'Updated by the Milestone 10 full-stack smoke test.',
      address: organisation.address,
      city: organisation.city,
      contactPhone: organisation.contactPhone,
    },
  })
  console.log('PASS DONOR organisation profile view and update')

  const created = await api('/donations', {
    method: 'POST', token: donorToken, body: donationPayload(preparedMeals.id, 'Surplus Chicken and Rice Meals'), expected: 201,
  })
  const primaryDonationId = created.payload.data.donation.id
  const updatedPayload = donationPayload(preparedMeals.id, 'Surplus Chicken and Rice Meals')
  updatedPayload.description = 'Twenty-five surplus chicken and rice meals prepared for community collection.'
  await api(`/donations/${primaryDonationId}`, { method: 'PUT', token: donorToken, body: updatedPayload })
  await api('/donations/mine', { token: donorToken })
  const publicBrowse = await api('/donations?city=Nairobi&search=Chicken&sort=expiry_asc')
  assert(publicBrowse.payload.data.donations.some((item) => item.id === primaryDonationId), 'Created donation was missing from public browsing.')
  await api(`/donations/${primaryDonationId}`)
  console.log('PASS DONOR create/edit/list and PUBLIC browse/detail')

  const reservation = await api(`/donations/${primaryDonationId}/reservations`, {
    method: 'POST', token: recipientToken, expected: 201,
    body: { requestedCollectionTime: hoursFromNow(1.5), message: 'Hope Community Centre can collect at approximately 4:30 PM.' },
  })
  const reservationId = reservation.payload.data.reservation.id
  await api('/reservations/mine', { token: recipientToken })
  const donorRequests = await api(`/donations/${primaryDonationId}/reservations`, { token: donorToken })
  assert(donorRequests.payload.data.reservations.some((item) => item.id === reservationId), 'Donor could not view the reservation request.')
  await api(`/reservations/${reservationId}/approve`, { method: 'PATCH', token: donorToken, body: {} })
  await api(`/donations/${primaryDonationId}/collected`, { method: 'PATCH', token: donorToken, body: {} })
  console.log('PASS RECIPIENT request/history and DONOR request approval/collection')

  const cancelDonation = await api('/donations', {
    method: 'POST', token: donorToken, body: donationPayload(preparedMeals.id, `Pending Cancellation ${runId}`), expected: 201,
  })
  const cancellableReservation = await api(`/donations/${cancelDonation.payload.data.donation.id}/reservations`, {
    method: 'POST', token: recipientToken, expected: 201,
    body: { requestedCollectionTime: hoursFromNow(2), message: 'Temporary cancellation-path request.' },
  })
  await api(`/reservations/${cancellableReservation.payload.data.reservation.id}/cancel`, { method: 'PATCH', token: recipientToken, body: {} })
  console.log('PASS RECIPIENT pending reservation cancellation')

  const adminCancellation = await api('/donations', {
    method: 'POST', token: donorToken, body: donationPayload(preparedMeals.id, `Administrative Cancellation ${runId}`), expected: 201,
  })
  await api('/admin/users', { token: adminToken })
  await api(`/admin/users/${donorId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'SUSPENDED' } })
  await api('/dashboard', { token: donorToken, expected: 403 })
  await api(`/admin/users/${donorId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } })
  await api('/dashboard', { token: donorToken })
  await api('/admin/organisations', { token: adminToken })

  const newCategory = await api('/categories', { method: 'POST', token: adminToken, body: { name: categoryNames.created, description: 'Temporary smoke category.' }, expected: 201 })
  const categoryId = newCategory.payload.data.category.id
  await api(`/categories/${categoryId}`, { method: 'PUT', token: adminToken, body: { name: categoryNames.updated, description: 'Updated temporary smoke category.' } })
  await api(`/categories/${categoryId}/status`, { method: 'PATCH', token: adminToken, body: { active: false } })
  await api(`/categories/${categoryId}/status`, { method: 'PATCH', token: adminToken, body: { active: true } })
  await api('/admin/categories', { token: adminToken })
  await api('/admin/donations', { token: adminToken })
  await api(`/admin/donations/${adminCancellation.payload.data.donation.id}/cancel`, { method: 'PATCH', token: adminToken, body: {} })
  console.log('PASS ADMIN users/status, organisations, category lifecycle, donation list/cancel')

  const forgot = await api('/auth/forgot-password', {
    method: 'POST',
    body: { email: emails.donor },
    headers: { Origin: frontendUrl },
  })
  assert(forgot.payload.data.message.startsWith('If an account matches'), 'Forgot-password response was not generic.')
  const resetToken = forgot.response.headers.get('x-foodlink-development-reset-token')
  const exposedHeaders = forgot.response.headers.get('access-control-expose-headers') ?? ''
  assert(resetToken && /^[a-f0-9]{64}$/i.test(resetToken), 'Development reset token was not delivered.')
  assert(exposedHeaders.toLowerCase().includes('x-foodlink-development-reset-token'.toLowerCase()), 'CORS did not expose the development reset header.')
  await verifyFrontendRoute(`/reset-password?token=${resetToken}`, 'Development password reset link')
  await api('/auth/reset-password', { method: 'POST', body: { token: resetToken, password: passwords.reset, passwordConfirmation: passwords.reset } })
  await api('/auth/login', { method: 'POST', body: { email: emails.donor, password: passwords.donor }, expected: 401 })
  const resetLogin = await api('/auth/login', { method: 'POST', body: { email: emails.donor, password: passwords.reset } })
  console.log('PASS PASSWORD RESET generic response, development link, reset, and new login')

  await api('/auth/logout', { method: 'POST', token: resetLogin.payload.data.token, body: {} })
  await api('/auth/logout', { method: 'POST', token: recipientToken, body: {} })
  await api('/auth/logout', { method: 'POST', token: adminToken, body: {} })
  console.log('PASS AUTH logout endpoints')
}

run()
  .catch((error) => {
    console.error(`FAIL full-stack smoke test: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
