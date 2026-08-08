import { DonationStatus } from '@prisma/client'
import prisma from '../config/prisma.js'
import { ApiError } from '../utils/apiError.js'

const donationSelect = {
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
  category: {
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
    },
  },
  donor: {
    select: {
      organisation: {
        select: {
          id: true,
          name: true,
          organisationType: true,
          address: true,
          city: true,
          contactPhone: true,
        },
      },
    },
  },
}

function donationNotFound() {
  return new ApiError(404, 'DONATION_NOT_FOUND', 'The requested donation was not found.')
}

async function requireActiveCategory(database, categoryId) {
  const category = await database.foodCategory.findUnique({
    where: { id: categoryId },
    select: { active: true },
  })

  if (!category) {
    throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'The selected food category does not exist.')
  }

  if (!category.active) {
    throw new ApiError(400, 'CATEGORY_INACTIVE', 'The selected food category is inactive.')
  }
}

function writableDonationData(input) {
  return {
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    quantity: input.quantity,
    quantityUnit: input.quantityUnit,
    availableFrom: input.availableFrom,
    expiresAt: input.expiresAt,
    collectionAddress: input.collectionAddress,
    city: input.city,
    collectionInstructions: input.collectionInstructions?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
  }
}

export async function listPublicDonations(filters) {
  const searchText = filters.search ?? filters.title
  const where = {
    status: DonationStatus.AVAILABLE,
    expiresAt: { gte: new Date() },
  }

  if (filters.city) {
    where.city = filters.city
  }

  if (filters.category) {
    where.categoryId = filters.category
  }

  if (searchText) {
    where.title = { contains: searchText }
  }

  return prisma.donation.findMany({
    where,
    select: donationSelect,
    orderBy: { expiresAt: filters.sort === 'expiry_desc' ? 'desc' : 'asc' },
  })
}

export async function getPublicDonation(id) {
  const donation = await prisma.donation.findUnique({
    where: { id },
    select: donationSelect,
  })

  if (!donation) {
    throw donationNotFound()
  }

  return donation
}

export async function listDonorDonations(donorId) {
  return prisma.donation.findMany({
    where: { donorId },
    select: donationSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createDonation(donorId, input) {
  await requireActiveCategory(prisma, input.categoryId)

  return prisma.donation.create({
    data: {
      ...writableDonationData(input),
      donorId,
      status: DonationStatus.AVAILABLE,
    },
    select: donationSelect,
  })
}

export async function updateDonation(donorId, donationId, input) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.donation.findFirst({
      where: { id: donationId, donorId },
      select: { status: true },
    })

    if (!existing) {
      throw donationNotFound()
    }

    if (existing.status === DonationStatus.CANCELLED) {
      throw new ApiError(409, 'DONATION_NOT_EDITABLE', 'A cancelled donation cannot be edited.')
    }

    await requireActiveCategory(transaction, input.categoryId)

    return transaction.donation.update({
      where: { id: donationId },
      data: writableDonationData(input),
      select: donationSelect,
    })
  })
}

export async function cancelDonation(donorId, donationId) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.donation.findFirst({
      where: { id: donationId, donorId },
      select: { status: true },
    })

    if (!existing) {
      throw donationNotFound()
    }

    if (existing.status === DonationStatus.CANCELLED) {
      return transaction.donation.findUnique({
        where: { id: donationId },
        select: donationSelect,
      })
    }

    if (existing.status !== DonationStatus.AVAILABLE) {
      throw new ApiError(409, 'DONATION_NOT_CANCELLABLE', 'Only an available donation can be cancelled.')
    }

    return transaction.donation.update({
      where: { id: donationId },
      data: { status: DonationStatus.CANCELLED },
      select: donationSelect,
    })
  })
}
