import {
  DonationStatus,
  ReservationStatus,
  UserRole,
  UserStatus,
} from '@prisma/client'
import prisma from '../config/prisma.js'
import { ApiError } from '../utils/apiError.js'

function groupCount(groups, field, value) {
  return groups.find((group) => group[field] === value)?._count._all ?? 0
}

function groupTotal(groups) {
  return groups.reduce((total, group) => total + group._count._all, 0)
}

const recentDonationSelect = {
  id: true,
  donorId: true,
  title: true,
  quantity: true,
  quantityUnit: true,
  city: true,
  expiresAt: true,
  status: true,
  createdAt: true,
  category: {
    select: { id: true, name: true },
  },
}

const recentDonorReservationSelect = {
  id: true,
  donationId: true,
  recipientId: true,
  requestedCollectionTime: true,
  status: true,
  createdAt: true,
  donation: {
    select: { id: true, donorId: true, title: true, status: true, expiresAt: true },
  },
  recipient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organisation: {
        select: { id: true, name: true, organisationType: true, city: true },
      },
    },
  },
}

const recentRecipientReservationSelect = {
  id: true,
  donationId: true,
  recipientId: true,
  requestedCollectionTime: true,
  status: true,
  donorResponse: true,
  createdAt: true,
  donation: {
    select: {
      id: true,
      donorId: true,
      title: true,
      city: true,
      expiresAt: true,
      status: true,
      category: { select: { id: true, name: true } },
      donor: {
        select: {
          organisation: { select: { id: true, name: true, city: true } },
        },
      },
    },
  },
}

function reservationMetrics(groups) {
  return {
    total: groupTotal(groups),
    pending: groupCount(groups, 'status', ReservationStatus.PENDING),
    approved: groupCount(groups, 'status', ReservationStatus.APPROVED),
    rejected: groupCount(groups, 'status', ReservationStatus.REJECTED),
    cancelled: groupCount(groups, 'status', ReservationStatus.CANCELLED),
    completed: groupCount(groups, 'status', ReservationStatus.COMPLETED),
  }
}

function donationMetrics(groups) {
  return {
    total: groupTotal(groups),
    available: groupCount(groups, 'status', DonationStatus.AVAILABLE),
    reserved: groupCount(groups, 'status', DonationStatus.RESERVED),
    collected: groupCount(groups, 'status', DonationStatus.COLLECTED),
    cancelled: groupCount(groups, 'status', DonationStatus.CANCELLED),
  }
}

async function getDonorDashboard(donorId, now) {
  const [donationGroups, reservationGroups, activeDonations, recentDonations, recentRequests] = await Promise.all([
    prisma.donation.groupBy({
      by: ['status'],
      where: { donorId },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ['status'],
      where: { donation: { donorId } },
      _count: { _all: true },
    }),
    prisma.donation.count({
      where: {
        donorId,
        status: DonationStatus.AVAILABLE,
        expiresAt: { gte: now },
      },
    }),
    prisma.donation.findMany({
      where: { donorId },
      select: recentDonationSelect,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: { donation: { donorId } },
      select: recentDonorReservationSelect,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ])
  const reservations = reservationMetrics(reservationGroups)

  return {
    role: UserRole.DONOR,
    metrics: {
      donations: {
        ...donationMetrics(donationGroups),
        active: activeDonations,
      },
      reservations: {
        ...reservations,
        pendingRequests: reservations.pending,
        completedCollections: reservations.completed,
      },
    },
    activity: { recentDonations, recentReservationRequests: recentRequests },
  }
}

async function getRecipientDashboard(recipientId, now) {
  const [reservationGroups, availableDonations, activeReservations, reservationHistory] = await Promise.all([
    prisma.reservation.groupBy({
      by: ['status'],
      where: { recipientId },
      _count: { _all: true },
    }),
    prisma.donation.count({
      where: {
        status: DonationStatus.AVAILABLE,
        expiresAt: { gte: now },
      },
    }),
    prisma.reservation.findMany({
      where: {
        recipientId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
      },
      select: recentRecipientReservationSelect,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: {
        recipientId,
        status: {
          in: [
            ReservationStatus.REJECTED,
            ReservationStatus.CANCELLED,
            ReservationStatus.COMPLETED,
          ],
        },
      },
      select: recentRecipientReservationSelect,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    role: UserRole.RECIPIENT,
    metrics: {
      donations: { available: availableDonations },
      reservations: reservationMetrics(reservationGroups),
    },
    activity: { activeReservations, reservationHistory },
  }
}

async function getAdminDashboard(now) {
  const [
    userRoleGroups,
    userStatusGroups,
    organisations,
    donationGroups,
    expiredAvailable,
    reservationGroups,
    categoryGroups,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.organisation.count(),
    prisma.donation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.donation.count({
      where: {
        status: DonationStatus.AVAILABLE,
        expiresAt: { lt: now },
      },
    }),
    prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.foodCategory.groupBy({ by: ['active'], _count: { _all: true } }),
  ])

  return {
    role: UserRole.ADMIN,
    metrics: {
      users: {
        total: groupTotal(userRoleGroups),
        donor: groupCount(userRoleGroups, 'role', UserRole.DONOR),
        recipient: groupCount(userRoleGroups, 'role', UserRole.RECIPIENT),
        admin: groupCount(userRoleGroups, 'role', UserRole.ADMIN),
        active: groupCount(userStatusGroups, 'status', UserStatus.ACTIVE),
        suspended: groupCount(userStatusGroups, 'status', UserStatus.SUSPENDED),
      },
      organisations: { total: organisations },
      donations: {
        ...donationMetrics(donationGroups),
        expiredAvailable,
      },
      reservations: reservationMetrics(reservationGroups),
      categories: {
        total: groupTotal(categoryGroups),
        active: groupCount(categoryGroups, 'active', true),
        inactive: groupCount(categoryGroups, 'active', false),
      },
    },
  }
}

export async function getDashboard(user) {
  const now = new Date()

  if (user.role === UserRole.DONOR) {
    return { ...(await getDonorDashboard(user.id, now)), generatedAt: now }
  }

  if (user.role === UserRole.RECIPIENT) {
    return { ...(await getRecipientDashboard(user.id, now)), generatedAt: now }
  }

  if (user.role === UserRole.ADMIN) {
    return { ...(await getAdminDashboard(now)), generatedAt: now }
  }

  throw new ApiError(403, 'DASHBOARD_ROLE_UNSUPPORTED', 'This account role does not have a dashboard.')
}
