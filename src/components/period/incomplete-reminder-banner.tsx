import { AlertTriangle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { formatPeriod } from '#/lib/constants'
import { daysUntilMonthEnd } from '#/lib/period'
import { trackerRouteTo, trackerSearchFromDashboard } from '#/lib/tracker-links'
import type { TrackerWindowId } from '#/lib/types'
import { Button } from '#/components/ui/button'

interface IncompleteReminderBannerProps {
  year: number
  month: number
  trackerWindow: TrackerWindowId
  incomplete: number
  inProgress: number
  notStarted: number
}

export function IncompleteReminderBanner({
  year,
  month,
  trackerWindow,
  incomplete,
  inProgress,
  notStarted,
}: IncompleteReminderBannerProps) {
  const daysLeft = daysUntilMonthEnd(year, month)

  if (daysLeft === null || daysLeft > 5 || incomplete === 0) {
    return null
  }

  const urgency =
    daysLeft <= 2
      ? 'border-destructive/40 bg-destructive/10'
      : 'border-amber-500/40 bg-amber-500/10'

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${urgency}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">
            {incomplete} incomplete checklist{incomplete === 1 ? '' : 's'} —{' '}
            {daysLeft === 0
              ? 'last day'
              : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}{' '}
            in {formatPeriod(year, month)}
          </p>
          <p className="text-muted-foreground">
            {inProgress} in progress · {notStarted} not started
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link
          {...trackerRouteTo(trackerWindow)}
          search={trackerSearchFromDashboard({
            year,
            month,
            trackerWindow,
            status: 'pending',
          })}
        >
          Review pending
        </Link>
      </Button>
    </div>
  )
}
