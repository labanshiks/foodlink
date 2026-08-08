import { DonationStatus, Prisma, ReservationStatus } from '@prisma/client'
import prisma from '../config/prisma.js'
import { ApiError } from '../utils/apiError.js'

const organisationSelect = {
  id: true,
  name: true,
  organisationType: true,
  address: true,
  city: true,
  contactPhone: true,
}

const donationSummarySelect = {
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
      organisation: { select: organisationSelect },
    },
  },
}

const recipientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  role: true,
  status: true,
  organisation: { select: organisationSelect },
}

const reservationSelect = {
  id: true,
  donationId: true,
  recipientId: true,
  message: true,
  requestedCollectionTime: true,
  status: true,
  donorResponse: true,
  createdAt: true,
  updatedAt: true,
  donation: { select: donationSummarySelect },
  recipient: { select: recipientSelect },
}

function reservationNotFound() {
  return new ApiError(404, 'RESERVATION_NOT_FOUND', 'The requested reservation was not found.')
}

function donationNotFound() {
  return new ApiError(404, 'DONATION_NOT_FOUND', 'The requested donation was not found.')
}

function reservationConflict(message) {
  return new ApiError(409, 'RESERVATION_NOT_ACTIONABLE', message)
}

async function runSerializable(work, conflictMessage) {
  try {
    return await prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    })
  } catch (error) {
    if (error?.code === 'P2034') {
      throw new ApiError(409, 'RESERVATION_CONFLICT', conflictMessage)
    }

    throw error
  }
}

export async function createReservation(recipientId, donationId, input) {
  const now = new Date()

  return runSerializable(async (transaction) => {
    const donation = await transaction.donation.findUnique({
      where: { id: donationId },
      select: {
        status: true,
        availableFrom: true,
        expiresAt: true,
      },
    })

    if (!donation) {
      throw donationNotFound()
    }

    if (donation.status !== DonationStatus.AVAILABLE) {
      throw new ApiError(409, 'DONATION_NOT_AVAILABLE', 'Only an available donation can be reserved.')
    }

    if (donation.expiresAt < now) {
      throw new ApiError(409, 'DONATION_EXPIRED', 'An expired donation cannot be reserved.')
    }

    if (
      input.requestedCollectionTime < donation.availableFrom
      || input.requestedCollectionTime > donation.expiresAt
    ) {
      throw new ApiError(
        400,
        'COLLECTION_TIME_OUTSIDE_WINDOW',
        'Requested collection time must be within the donation availability window.',
      )
    }

    return transaction.reservation.create({
      data: {
        donationId,
        recipientId,
        message: input.message?.trim() || null,
        requestedCollectionTime: input.requestedCollectionTime,
        status: ReservationStatus.PENDING,
      },
      select: reservationSelect,
    })
  }, 'The donation changed while the reservation was being created. Please try again.')
}

export async function listRecipientReservations(recipientId) {
  return prisma.reservation.findMany({
    where: { recipientId },
    select: reservationSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function listDonationReservations(donorId, donationId) {
  const donation = await prisma.donation.findFirst({
    where: { id: donationId, donorId },
    select: { id: true },
  })

  if (!donation) {
    throw donationNotFound()
  }

  return prisma.reservation.findMany({
    where: { donationId },
    select: reservationSelect,
    orderBy: { createdAt: 'asc' },
  })
}

export async function cancelReservation(recipientId, reservationId) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.reservation.findFirst({
      where: { id: reservationId, recipientId },
      select: { status: true },
    })

    if (!existing) {
      throw reservationNotFound()
    }

    if (existing.status === ReservationStatus.CANCELLED) {
      return transaction.reservation.findUnique({
        where: { id: reservationId },
        select: reservationSelect,
      })
    }

    if (existing.status !== ReservationStatus.PENDING) {
      throw reservationConflict('Only a pending reservation can be cancelled by its recipient.')
    }

    const cancelled = await transaction.reservation.updateMany({
      where: {
        id: reservationId,
        recipientId,
        status: ReservationStatus.PENDING,
      },
      data: { status: ReservationStatus.CANCELLED },
    })

    if (cancelled.count !== 1) {
      throw reservationConflict('The reservation is no longer pending.')
    }

    return transaction.reservation.findUnique({
      where: { id: reservationId },
      select: reservationSelect,
    })
  })
}

export async function approveReservation(donorId, reservationId) {
  return runSerializable(async (transaction) => {
    const now = new Date()
    const existing = await transaction.reservation.findUnique({
      where: { id: reservationId },
      select: {
        status: true,
        donation: {
          select: {
            id: true,
            donorId: true,
            status: true,
            expiresAt: true,
          },
        },
      },
    })

    if (!existing || existing.donation.donorId !== donorId) {
      throw reservationNotFound()
    }

    if (existing.status !== ReservationStatus.PENDING) {
      throw reservationConflict('Only a pending reservation can be approved.')
    }

    if (existing.donation.expiresAt < now) {
      throw new ApiError(409, 'DONATION_EXPIRED', 'An expired donation reservation cannot be approved.')
    }

    const claimedDonation = await transaction.donation.updateMany({
      where: {
        id: existing.donation.id,
        donorId,
        status: DonationStatus.AVAILABLE,
        expiresAt: { gte: now },
      },
      data: { status: DonationStatus.RESERVED },
    })

    if (claimedDonation.count !== 1) {
      throw new ApiError(409, 'DONATION_NOT_AVAILABLE', 'The donation is no longer available for approval.')
    }

    const approved = await transaction.reservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.PENDING },
      data: { status: ReservationStatus.APPROVED },
    })

    if (approved.count !== 1) {
      throw reservationConflict('The reservation is no longer pending.')
    }

    await transaction.reservation.updateMany({
      where: {
        donationId: existing.donation.id,
        id: { not: reservationId },
        status: ReservationStatus.PENDING,
      },
      data: { status: ReservationStatus.REJECTED },
    })

    return transaction.reservation.findUnique({
      where: { id: reservationId },
      select: reservationSelect,
    })
  }, 'Another reservation was approved at the same time. Please refresh and try again.')
}

export async function rejectReservation(donorId, reservationId, donorResponse) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.reservation.findUnique({
      where: { id: reservationId },
      select: {
        status: true,
        donation: { select: { donorId: true } },
      },
    })

    if (!existing || existing.donation.donorId !== donorId) {
      throw reservationNotFound()
    }

    if (existing.status !== ReservationStatus.PENDING) {
      throw reservationConflict('Only a pending reservation can be rejected.')
    }

    const rejected = await transaction.reservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.PENDING },
      data: {
        status: ReservationStatus.REJECTED,
        donorResponse: donorResponse?.trim() || null,
      },
    })

    if (rejected.count !== 1) {
      throw reservationConflict('The reservation is no longer pending.')
    }

    return transaction.reservation.findUnique({
      where: { id: reservationId },
      select: reservationSelect,
    })
  })
}
