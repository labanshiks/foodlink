export function formatDateTime(value) {
  if (!value) return 'Not provided'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function isExpiredDonation(donation) {
  return donation?.status === 'AVAILABLE' && new Date(donation.expiresAt) < new Date()
}

export function formatQuantity(quantity, unit) {
  const number = Number(quantity)
  const display = Number.isInteger(number) ? number : number.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return `${display} ${unit}`
}
