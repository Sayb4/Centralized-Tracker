import { createServerFn } from '@tanstack/react-start'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireAdmin, requireSupabaseAuth } from '#/lib/auth/middleware'
import { TRACKER_WINDOW_IDS } from '#/lib/constants'
import type { TrackerWindowId } from '#/lib/types'

const periodSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

export interface PeriodContext {
  isLocked: boolean
  lockedAt: string | null
  lockedBy: string | null
  notes: string | null
  completed: number
  inProgress: number
  notStarted: number
  incomplete: number
}

async function fetchPeriodContext(
  supabase: SupabaseClient,
  year: number,
  month: number,
  trackerWindow: TrackerWindowId,
): Promise<PeriodContext> {
  const { data, error } = await supabase.rpc('get_period_context', {
    p_year: year,
    p_month: month,
    p_tracker_window: trackerWindow,
  })

  if (error) throw new Error(error.message)

  const payload = data as {
    isLocked: boolean
    lockedAt: string | null
    lockedBy: string | null
    notes: string | null
    completed: number
    inProgress: number
    notStarted: number
    incomplete: number
  }

  return {
    isLocked: payload.isLocked ?? false,
    lockedAt: payload.lockedAt ?? null,
    lockedBy: payload.lockedBy ?? null,
    notes: payload.notes ?? null,
    completed: payload.completed ?? 0,
    inProgress: payload.inProgress ?? 0,
    notStarted: payload.notStarted ?? 0,
    incomplete: payload.incomplete ?? 0,
  }
}

export async function assertPeriodNotLocked(
  supabase: SupabaseClient,
  year: number,
  month: number,
) {
  const { data, error } = await supabase.rpc('is_period_locked', {
    p_year: year,
    p_month: month,
  })

  if (error) throw new Error(error.message)
  if (data === true) {
    throw new Error(
      'This period is locked after payroll close. An admin must reopen it before changes can be made.',
    )
  }
}

export const getPeriodContext = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    periodSchema.extend({
      trackerWindow: z
        .enum(TRACKER_WINDOW_IDS as [TrackerWindowId, ...TrackerWindowId[]])
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    return fetchPeriodContext(
      context.supabase,
      data.year,
      data.month,
      data.trackerWindow ?? 'payroll',
    )
  })

export const lockPeriod = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(
    periodSchema.extend({
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const auth = context.auth
    const { error } = await context.supabase.from('payroll_periods').upsert(
      {
        year: data.year,
        month: data.month,
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: auth.userId,
        notes: data.notes ?? null,
      },
      { onConflict: 'year,month' },
    )

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const unlockPeriod = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(periodSchema)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('payroll_periods').upsert(
      {
        year: data.year,
        month: data.month,
        is_locked: false,
        locked_at: null,
        locked_by: null,
      },
      { onConflict: 'year,month' },
    )

    if (error) throw new Error(error.message)
    return { ok: true }
  })
