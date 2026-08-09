import prisma from '../config/prisma.js'

export function listActiveCategories() {
  return prisma.foodCategory.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}
