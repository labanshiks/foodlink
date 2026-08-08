import { DonationStatus, Prisma, ReservationStatus } from '@prisma/client'
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

const collectionReservationSelect = {
  id: true,
  donationId: true,
  recipientId: true,
  message: true,
  requestedCollectionTime: true,
  status: true,
  donorResponse: true,
  createdAt: true,
  updatedAt: true,
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

    if (existing.status !== DonationStatus.AVAILABLE) {
      throw new ApiError(409, 'DONATION_NOT_EDITABLE', 'Only an available donation can be edited.')
    }

    await requireActiveCategory(transaction, input.categoryId)

    const updated = await transaction.donation.updateMany({
      where: {
        id: donationId,
        donorId,
        status: DonationStatus.AVAILABLE,
      },
      data: writableDonationData(input),
    })

    if (updated.count !== 1) {
      throw new ApiError(409, 'DONATION_NOT_EDITABLE', 'Only an available donation can be edited.')
    }

    return transaction.donation.findUnique({
      where: { id: donationId },
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
      await transaction.reservation.updateMany({
        where: { donationId, status: ReservationStatus.PENDING },
        data: {
          status: ReservationStatus.REJECTED,
          donorResponse: 'The donation was cancelled by the donor.',
        },
      })

      return transaction.donation.findUnique({
        where: { id: donationId },
        select: donationSelect,
      })
    }

    if (existing.status !== DonationStatus.AVAILABLE) {
      throw new ApiError(409, 'DONATION_NOT_CANCELLABLE', 'Only an available donation can be cancelled.')
    }

    const cancelled = await transaction.donation.updateMany({
      where: { id: donationId, donorId, status: DonationStatus.AVAILABLE },
      data: { status: DonationStatus.CANCELLED },
    })

    if (cancelled.count !== 1) {
      throw new ApiError(409, 'DONATION_NOT_CANCELLABLE', 'The donation is no longer available to cancel.')
    }

    await transaction.reservation.updateMany({
      where: { donationId, status: ReservationStatus.PENDING },
      data: {
        status: ReservationStatus.REJECTED,
        donorResponse: 'The donation was cancelled by the donor.',
      },
    })

    return transaction.donation.findUnique({
      where: { id: donationId },
      select: donationSelect,
    })
  })
}

export async function markDonationCollected(donorId, donationId) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.donation.findFirst({
        where: { id: donationId, donorId },
        select: { status: true },
      })

      if (!existing) {
        throw donationNotFound()
      }

      if (existing.status !== DonationStatus.RESERVED) {
        throw new ApiError(
          409,
          'DONATION_NOT_COLLECTABLE',
          'Only a reserved donation with one approved reservation can be marked as collected.',
        )
      }

      const approvedReservations = await transaction.reservation.findMany({
        where: { donationId, status: ReservationStatus.APPROVED },
        select: { id: true },
        take: 2,
      })

      if (approvedReservations.length !== 1) {
        throw new ApiError(
          409,
          'APPROVED_RESERVATION_REQUIRED',
          'A reserved donation must have exactly one approved reservation before collection.',
        )
      }

      const donationUpdate = await transaction.donation.updateMany({
        where: { id: donationId, donorId, status: DonationStatus.RESERVED },
        data: { status: DonationStatus.COLLECTED },
      })
      const reservationUpdate = await transaction.reservation.updateMany({
        where: {
          id: approvedReservations[0].id,
          donationId,
          status: ReservationStatus.APPROVED,
        },
        data: { status: ReservationStatus.COMPLETED },
      })

      if (donationUpdate.count !== 1 || reservationUpdate.count !== 1) {
        throw new ApiError(409, 'COLLECTION_CONFLICT', 'The collection state changed. Please refresh and try again.')
      }

      const [donation, reservation] = await Promise.all([
        transaction.donation.findUnique({ where: { id: donationId }, select: donationSelect }),
        transaction.reservation.findUnique({
          where: { id: approvedReservations[0].id },
          select: collectionReservationSelect,
        }),
      ])

      return { donation, reservation }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    })
  } catch (error) {
    if (error?.code === 'P2034') {
      throw new ApiError(409, 'COLLECTION_CONFLICT', 'The collection state changed. Please refresh and try again.')
    }

    throw error
  }
}
