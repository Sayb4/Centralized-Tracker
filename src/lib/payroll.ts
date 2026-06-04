import { BUILT_IN_FIELDS } from '#/lib/constants'
import type {
  BuiltInFieldKey,
  ChecklistStatus,
  EmployeeCompletionCategory,
  PayrollChecklist,
} from '#/lib/types'

export function computeProgress(
  statuses: ChecklistStatus[],
  progressOverride?: number | null,
): number {
  if (progressOverride != null && !Number.isNaN(progressOverride)) {
    return Math.min(100, Math.max(0, progressOverride))
  }

  const applicable = statuses.filter((s) => s !== 'not_needed')
  if (applicable.length === 0) return 100

  const done = applicable.filter(
    (s) => s === 'completed' || s === 'submitted',
  ).length

  return Math.round((done / applicable.length) * 100)
}

export function getChecklistStatuses(
  checklist: PayrollChecklist | null,
  customValues: ChecklistStatus[],
): ChecklistStatus[] {
  if (!checklist) {
    return [
      ...BUILT_IN_FIELDS.map(() => 'not_yet_submitted' as ChecklistStatus),
      ...customValues,
    ]
  }

  const builtIn = BUILT_IN_FIELDS.map(
    (f) => checklist[f.key as BuiltInFieldKey],
  )
  return [...builtIn, ...customValues]
}

export function getCompletionCategory(
  progress: number,
): EmployeeCompletionCategory {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'in_progress'
  return 'not_started'
}

export function matchesTrackerFilter(
  progress: number,
  filter: 'all' | 'completed' | 'pending' | 'not_started',
): boolean {
  const category = getCompletionCategory(progress)
  if (filter === 'all') return true
  if (filter === 'completed') return category === 'completed'
  if (filter === 'not_started') return category === 'not_started'
  return category === 'in_progress'
}
