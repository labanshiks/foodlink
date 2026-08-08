import {
  getOwnOrganisation,
  updateOwnOrganisation,
} from '../services/organisationService.js'

export async function getMyOrganisation(request, response) {
  const organisation = await getOwnOrganisation(request.user.id)

  return response.json({
    success: true,
    data: { organisation },
  })
}

export async function updateMyOrganisation(request, response) {
  const organisation = await updateOwnOrganisation(request.user.id, request.body)

  return response.json({
    success: true,
    data: { organisation },
  })
}
