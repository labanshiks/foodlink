import {
  cancelAdminDonation,
  changeCategoryStatus,
  changeUserStatus,
  createCategory,
  listAdminDonations,
  listCategories,
  listOrganisations,
  listUsers,
  updateCategory,
} from '../services/adminService.js'

export async function getUsers(request, response) {
  const users = await listUsers(request.query)
  return response.json({ success: true, data: { users, count: users.length } })
}

export async function updateUserStatus(request, response) {
  const user = await changeUserStatus(request.user.id, request.params.id, request.body.status)
  return response.json({ success: true, data: { user } })
}

export async function getOrganisations(request, response) {
  const organisations = await listOrganisations(request.query)
  return response.json({ success: true, data: { organisations, count: organisations.length } })
}

export async function getCategories(request, response) {
  const categories = await listCategories(request.query)
  return response.json({ success: true, data: { categories, count: categories.length } })
}

export async function addCategory(request, response) {
  const category = await createCategory(request.body)
  return response.status(201).json({ success: true, data: { category } })
}

export async function editCategory(request, response) {
  const category = await updateCategory(request.params.id, request.body)
  return response.json({ success: true, data: { category } })
}

export async function updateCategoryStatus(request, response) {
  const category = await changeCategoryStatus(request.params.id, request.body.active)
  return response.json({ success: true, data: { category } })
}

export async function getAdminDonations(request, response) {
  const donations = await listAdminDonations(request.query)
  return response.json({ success: true, data: { donations, count: donations.length } })
}

export async function cancelDonationByAdmin(request, response) {
  const donation = await cancelAdminDonation(request.params.id)
  return response.json({ success: true, data: { donation } })
}
