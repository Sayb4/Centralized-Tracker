import { Lock, Unlock } from 'lucide-react'
import { formatPeriod } from '#/lib/constants'
import { useHasRole } from '#/components/auth/auth-provider'
import { Button } from '#/components/ui/button'

interface PeriodLockBannerProps {
  year: number
  month: number
  isLocked: boolean
  locking?: boolean
  onLock: () => void
  onUnlock: () => void
}

export function PeriodLockBanner({
  year,
  month,
  isLocked,
  locking = false,
  onLock,
  onUnlock,
}: PeriodLockBannerProps) {
  const isAdmin = useHasRole('admin')

  if (!isLocked && !isAdmin) return null

  return (
    <div
      className={
        isLocked
          ? 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm'
          : 'flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm'
      }
    >
      <div className="flex items-start gap-2">
        <Lock
          className={
            isLocked
              ? 'mt-0.5 h-4 w-4 shrink-0 text-amber-600'
              : 'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground'
          }
        />
        <div>
          {isLocked ? (
            <>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {formatPeriod(year, month)} is locked after payroll close
              </p>
              <p className="text-muted-foreground">
                Checklist edits are disabled until an admin reopens this period.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Payroll period open</p>
              <p className="text-muted-foreground">
                Close {formatPeriod(year, month)} when payroll processing is
                complete to prevent further checklist changes.
              </p>
            </>
          )}
        </div>
      </div>
      {isAdmin && (
        <Button
          variant={isLocked ? 'outline' : 'default'}
          size="sm"
          disabled={locking}
          onClick={isLocked ? onUnlock : onLock}
        >
          {isLocked ? (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              Reopen period
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Close period
            </>
          )}
        </Button>
      )}
    </div>
  )
}
