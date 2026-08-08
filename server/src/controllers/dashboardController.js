import { getDashboard } from '../services/dashboardService.js'

export async function showDashboard(request, response) {
  const dashboard = await getDashboard(request.user)

  return response.json({
    success: true,
    data: { dashboard },
  })
}
