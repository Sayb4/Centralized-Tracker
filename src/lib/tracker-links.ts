import type { TrackerWindowId, TrackerFilterStatus } from '#/lib/types'

export function trackerSearchFromDashboard(opts: {
  year: number
  month: number
  trackerWindow: TrackerWindowId
  division?: string
  status?: TrackerFilterStatus
  q?: string
  tab?: string
}) {
  return {
    year: opts.year,
    month: opts.month,
    tab: opts.tab ?? 'all',
    division: opts.division ?? 'all',
    status: opts.status ?? ('all' as const),
    q: opts.q ?? '',
    page: 1,
  }
}

export function trackerRouteTo(windowId: TrackerWindowId) {
  return {
    to: '/tracker/$windowId' as const,
    params: { windowId },
  }
}
