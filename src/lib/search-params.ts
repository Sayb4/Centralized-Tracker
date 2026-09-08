import { getCurrentPeriod, TRACKER_WINDOW_IDS } from '#/lib/constants'
import type { TrackerWindowId } from '#/lib/types'

export function parsePeriodSearch(search: Record<string, unknown>) {
  const period = getCurrentPeriod()
  const year = Number(search.year)
  const month = Number(search.month)

  return {
    year:
      Number.isFinite(year) && year >= 2000 && year <= 2100
        ? year
        : period.year,
    month:
      Number.isFinite(month) && month >= 1 && month <= 12
        ? month
        : period.month,
  }
}

export function parseTrackerWindowSearch(
  search: Record<string, unknown>,
  fallback: TrackerWindowId = 'payroll',
): TrackerWindowId {
  const tracker = search.tracker as string
  if (TRACKER_WINDOW_IDS.includes(tracker as TrackerWindowId)) {
    return tracker as TrackerWindowId
  }
  return fallback
}

export type TrackerStatusFilter =
  | 'all'
  | 'completed'
  | 'pending'
  | 'not_started'

export function parseTrackerStatusFilter(
  value: unknown,
): TrackerStatusFilter {
  if (
    value === 'completed' ||
    value === 'pending' ||
    value === 'not_started'
  ) {
    return value
  }
  return 'all'
}
