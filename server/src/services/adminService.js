import { Prisma, UserStatus } from '@prisma/client'
import prisma from '../config/prisma.js'
import { cancelDonationAsAdmin } from './donationService.js'
import { ApiError } from '../utils/apiError.js'

const organisationSelect = {
  id: true,
  userId: true,
  name: true,
  organisationType: true,
  description: true,
  address: true,
  city: true,
  contactPhone: true,
  createdAt: true,
  updatedAt: true,
}

const safeUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organisation: { select: organisationSelect },
  _count: {
    select: { donations: true, reservations: true },
  },
}

const adminOrganisationSelect = {
  ...organisationSelect,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
}

const categorySelect = {
  id: true,
  name: true,
  description: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { donations: true } },
}

const adminDonationSelect = {
  id: true,
  donorId: true,
  categoryId: true,
  title: true,
  description: true,
  quantity: true,
  quantityUnit: true,
  availableFrom: true,
  expiresAt: true,
  collectionAddress: true,
  city: true,
  collectionInstructions: true,
  imageUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: categorySelect },
  donor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      organisation: { select: organisationSelect },
    },
  },
  _count: { select: { reservations: true } },
}

function categoryNotFound() {
  return new ApiError(404, 'CATEGORY_NOT_FOUND', 'The requested food category was not found.')
}

function duplicateCategory() {
  return new ApiError(409, 'CATEGORY_NAME_IN_USE', 'A food category with this name already exists.')
}

function categoryData(input) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
  }
}

export async function listUsers(filters) {
  const where = {}

  if (filters.role) where.role = filters.role
  if (filters.status) where.status = filters.status
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search } },
      { firstName: { contains: filters.search } },
      { lastName: { contains: filters.search } },
    ]
  }

  return prisma.user.findMany({
    where,
    select: safeUserSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

export async function changeUserStatus(adminId, userId, status) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  })

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'The requested user was not found.')
  }

  if (adminId === userId && status === UserStatus.SUSPENDED) {
    throw new ApiError(
      409,
      'ADMIN_SELF_SUSPENSION',
      'Administrators cannot suspend their own active session account.',
    )
  }

  return prisma.user.update({
    where: { id: userId },
    data: { status },
    select: safeUserSelect,
  })
}

export async function listOrganisations(filters) {
  const where = {}

  if (filters.city) where.city = filters.city
  if (filters.role) where.user = { role: filters.role }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { organisationType: { contains: filters.search } },
      { address: { contains: filters.search } },
      { city: { contains: filters.search } },
      { user: { email: { contains: filters.search } } },
      { user: { firstName: { contains: filters.search } } },
      { user: { lastName: { contains: filters.search } } },
    ]
  }

  return prisma.organisation.findMany({
    where,
    select: adminOrganisationSelect,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}

export async function listCategories(filters) {
  const where = {}

  if (typeof filters.active === 'boolean') where.active = filters.active
  if (filters.search) where.name = { contains: filters.search }

  return prisma.foodCategory.findMany({
    where,
    select: categorySelect,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}

export async function createCategory(input) {
  try {
    return await prisma.foodCategory.create({
      data: { ...categoryData(input), active: true },
      select: categorySelect,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw duplicateCategory()
    }

    throw error
  }
}

export async function updateCategory(categoryId, input) {
  const existing = await prisma.foodCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  })

  if (!existing) throw categoryNotFound()

  try {
    return await prisma.foodCategory.update({
      where: { id: categoryId },
      data: categoryData(input),
      select: categorySelect,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw duplicateCategory()
    }

    throw error
  }
}

export async function changeCategoryStatus(categoryId, active) {
  const existing = await prisma.foodCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  })

  if (!existing) throw categoryNotFound()

  return prisma.foodCategory.update({
    where: { id: categoryId },
    data: { active },
    select: categorySelect,
  })
}

export async function listAdminDonations(filters) {
  const where = {}

  if (filters.status) where.status = filters.status
  if (filters.city) where.city = filters.city
  if (filters.category) where.categoryId = filters.category
  if (filters.donor) where.donorId = filters.donor
  if (typeof filters.expired === 'boolean') {
    where.expiresAt = filters.expired ? { lt: new Date() } : { gte: new Date() }
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
    ]
  }

  const orderBy = {
    newest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    expiry_asc: { expiresAt: 'asc' },
    expiry_desc: { expiresAt: 'desc' },
  }[filters.sort ?? 'newest']

  return prisma.donation.findMany({
    where,
    select: adminDonationSelect,
    orderBy,
  })
}

export async function cancelAdminDonation(donationId) {
  return cancelDonationAsAdmin(donationId)
}
