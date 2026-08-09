import { listActiveCategories } from '../services/categoryService.js'

export async function getActiveCategories(_request, response) {
  const categories = await listActiveCategories()

  return response.json({
    success: true,
    data: { categories, count: categories.length },
  })
}
