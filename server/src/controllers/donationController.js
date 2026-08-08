import {
  cancelDonation,
  createDonation,
  getPublicDonation,
  listDonorDonations,
  listPublicDonations,
  updateDonation,
} from '../services/donationService.js'

export async function browseDonations(request, response) {
  const donations = await listPublicDonations(request.query)

  return response.json({
    success: true,
    data: { donations, count: donations.length },
  })
}

export async function getDonation(request, response) {
  const donation = await getPublicDonation(request.params.id)

  return response.json({
    success: true,
    data: { donation },
  })
}

export async function getMyDonations(request, response) {
  const donations = await listDonorDonations(request.user.id)

  return response.json({
    success: true,
    data: { donations, count: donations.length },
  })
}

export async function createMyDonation(request, response) {
  const donation = await createDonation(request.user.id, request.body)

  return response.status(201).json({
    success: true,
    data: { donation },
  })
}

export async function updateMyDonation(request, response) {
  const donation = await updateDonation(request.user.id, request.params.id, request.body)

  return response.json({
    success: true,
    data: { donation },
  })
}

export async function cancelMyDonation(request, response) {
  const donation = await cancelDonation(request.user.id, request.params.id)

  return response.json({
    success: true,
    data: { donation },
  })
}
