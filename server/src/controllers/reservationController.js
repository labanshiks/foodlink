import {
  approveReservation,
  cancelReservation,
  createReservation,
  listDonationReservations,
  listRecipientReservations,
  rejectReservation,
} from '../services/reservationService.js'

export async function createDonationReservation(request, response) {
  const reservation = await createReservation(request.user.id, request.params.id, request.body)

  return response.status(201).json({
    success: true,
    data: { reservation },
  })
}

export async function getMyReservations(request, response) {
  const reservations = await listRecipientReservations(request.user.id)

  return response.json({
    success: true,
    data: { reservations, count: reservations.length },
  })
}

export async function getDonationReservations(request, response) {
  const reservations = await listDonationReservations(request.user.id, request.params.id)

  return response.json({
    success: true,
    data: { reservations, count: reservations.length },
  })
}

export async function cancelMyReservation(request, response) {
  const reservation = await cancelReservation(request.user.id, request.params.id)

  return response.json({
    success: true,
    data: { reservation },
  })
}

export async function approveDonationReservation(request, response) {
  const reservation = await approveReservation(request.user.id, request.params.id)

  return response.json({
    success: true,
    data: { reservation },
  })
}

export async function rejectDonationReservation(request, response) {
  const reservation = await rejectReservation(
    request.user.id,
    request.params.id,
    request.body.donorResponse,
  )

  return response.json({
    success: true,
    data: { reservation },
  })
}
