import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'

const prisma = new PrismaClient()

const categoryNames = [
  'Prepared Meals',
  'Fresh Produce',
  'Bakery',
  'Dairy',
  'Dry Foods',
  'Beverages',
  'Other',
]

function getAdminCredentials() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set before seeding.')
  }

  if (!email.includes('@')) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email address.')
  }

  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters.')
  }

  return { email, password }
}

async function seed() {
  const { email, password } = getAdminCredentials()

  await Promise.all(
    categoryNames.map((name) =>
      prisma.foodCategory.upsert({
        where: { name },
        update: { active: true },
        create: { name },
      }),
    ),
  )

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    update: {
      firstName: 'Development',
      lastName: 'Administrator',
      passwordHash,
      phoneNumber: 'Not provided',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      firstName: 'Development',
      lastName: 'Administrator',
      email,
      passwordHash,
      phoneNumber: 'Not provided',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  })

  console.log(`Seeded ${categoryNames.length} food categories.`)
  console.log(`Seeded development administrator: ${email}`)
}

seed()
  .catch((error) => {
    console.error('Database seed failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
