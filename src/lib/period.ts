/** Days left in the given calendar month when viewing that period as "today". */
export function daysUntilMonthEnd(year: number, month: number): number | null {
  const now = new Date()
  if (now.getFullYear() !== year || now.getMonth() + 1 !== month) {
    return null
  }
  const lastDay = new Date(year, month, 0).getDate()
  return lastDay - now.getDate()
}

export function isNearMonthEnd(
  year: number,
  month: number,
  thresholdDays = 5,
): boolean {
  const days = daysUntilMonthEnd(year, month)
  return days !== null && days >= 0 && days <= thresholdDays
}

export function isViewingCurrentPeriod(year: number, month: number): boolean {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() + 1 === month
}
