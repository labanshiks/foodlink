import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'

const prisma = new PrismaClient()

const expectedTables = [
  'users',
  'organisations',
  'food_categories',
  'donations',
  'reservations',
  'password_reset_tokens',
]

const expectedCategories = [
  'Prepared Meals',
  'Fresh Produce',
  'Bakery',
  'Dairy',
  'Dry Foods',
  'Beverages',
  'Other',
]

function verify(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function runVerification() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  verify(adminEmail && adminPassword, 'Seed administrator environment variables are missing.')

  const rows = await prisma.$queryRaw`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `
  const tableNames = new Set(rows.map((row) => row.tableName))
  const missingTables = expectedTables.filter((table) => !tableNames.has(table))
  verify(missingTables.length === 0, `Missing tables: ${missingTables.join(', ')}`)
  console.log(`PASS tables: ${expectedTables.join(', ')}`)

  const categories = await prisma.foodCategory.findMany({
    where: { name: { in: expectedCategories } },
    select: { name: true, active: true },
  })
  const categoryMap = new Map(categories.map((category) => [category.name, category.active]))
  const missingCategories = expectedCategories.filter((name) => categoryMap.get(name) !== true)
  verify(missingCategories.length === 0, `Missing or inactive categories: ${missingCategories.join(', ')}`)
  console.log(`PASS categories: ${expectedCategories.join(', ')}`)

  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { organisation: true },
  })
  verify(admin, 'Development administrator was not found.')
  verify(admin.role === UserRole.ADMIN, 'Seeded account does not have the ADMIN role.')
  verify(admin.status === UserStatus.ACTIVE, 'Seeded administrator is not active.')
  verify(admin.organisation === null, 'Administrator should not have an organisation.')
  console.log(`PASS administrator: ${admin.email}`)

  verify(admin.passwordHash !== adminPassword, 'Administrator password was stored in plain text.')
  verify(/^\$2[aby]\$/.test(admin.passwordHash), 'Administrator password is not a bcrypt hash.')
  verify(await bcrypt.compare(adminPassword, admin.passwordHash), 'Administrator bcrypt hash does not match the configured password.')
  console.log('PASS administrator password: bcrypt hash verified')
}

runVerification()
  .catch((error) => {
    console.error(`FAIL database verification: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
