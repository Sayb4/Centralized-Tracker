import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { BUILT_IN_FIELDS, TRACKER_WINDOW_IDS } from '#/lib/constants'
import { requireAdmin, requireSupabaseAuth } from '#/lib/auth/middleware'
import { assertPeriodNotLocked } from '#/server/periods'
import type {
  BuiltInFieldKey,
  ChecklistStatus,
  CustomChecklistField,
  Employee,
  PayrollChecklist,
  TrackerWindowId,
} from '#/lib/types'

export const TRACKER_PAGE_SIZE = 20

const periodSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

const statusSchema = z.enum([
  'not_yet_submitted',
  'submitted',
  'not_needed',
  'completed',
])

export interface TrackerRow {
  employee: Employee
  checklist: PayrollChecklist | null
  customValues: Record<string, ChecklistStatus>
  progress: number
}

interface TrackerPageRpc {
  rows: {
    employee: Employee
    checklist: PayrollChecklist | null
    custom_values: Record<string, ChecklistStatus>
    progress: number
  }[]
  total: number
  page: number
  pageSize: number
  customFields: CustomChecklistField[]
}

export const getTrackerData = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    periodSchema.extend({
      trackerWindow: z
        .enum(TRACKER_WINDOW_IDS as [TrackerWindowId, ...TrackerWindowId[]])
        .optional(),
      division: z.string().optional(),
      statusFilter: z
        .enum(['all', 'completed', 'pending', 'not_started'])
        .optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(TRACKER_PAGE_SIZE),
    }),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc('get_tracker_page', {
      p_year: data.year,
      p_month: data.month,
      p_tracker_window: data.trackerWindow ?? 'payroll',
      p_division: data.division ?? null,
      p_search: data.search ?? null,
      p_status_filter: data.statusFilter ?? 'all',
      p_page: data.page,
      p_page_size: data.pageSize,
    })

    if (error) throw new Error(error.message)

    const payload = result as TrackerPageRpc

    return {
      rows: (payload.rows ?? []).map((row) => ({
        employee: row.employee,
        checklist: row.checklist,
        customValues: row.custom_values ?? {},
        progress: row.progress,
      })),
      total: payload.total ?? 0,
      page: payload.page ?? data.page,
      pageSize: payload.pageSize ?? data.pageSize,
      customFields: payload.customFields ?? [],
    }
  })

export const exportTrackerData = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    periodSchema.extend({
      trackerWindow: z
        .enum(TRACKER_WINDOW_IDS as [TrackerWindowId, ...TrackerWindowId[]])
        .optional(),
      division: z.string().optional(),
      statusFilter: z
        .enum(['all', 'completed', 'pending', 'not_started'])
        .optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc(
      'get_tracker_export',
      {
        p_year: data.year,
        p_month: data.month,
        p_tracker_window: data.trackerWindow ?? 'payroll',
        p_division: data.division ?? null,
        p_search: data.search ?? null,
        p_status_filter: data.statusFilter ?? 'all',
      },
    )

    if (error) throw new Error(error.message)

    const payload = result as {
      rows: {
        employee: Employee
        checklist: PayrollChecklist | null
        custom_values: Record<string, ChecklistStatus>
        progress: number
      }[]
      total: number
      customFields: CustomChecklistField[]
    }

    return {
      rows: (payload.rows ?? []).map((row) => ({
        employee: row.employee,
        checklist: row.checklist,
        customValues: row.custom_values ?? {},
        progress: row.progress,
      })),
      total: payload.total ?? 0,
      customFields: payload.customFields ?? [],
    }
  })

export const updateChecklist = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(
    periodSchema.extend({
      employeeId: z.string().uuid(),
      field: z.string(),
      status: statusSchema.optional(),
      notes: z.string().nullable().optional(),
      progressOverride: z.number().min(0).max(100).nullable().optional(),
      isCustom: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertPeriodNotLocked(context.supabase, data.year, data.month)
    const auth = context.auth
    const { employeeId, year, month, field, isCustom } = data

    if (isCustom) {
      if (data.status === undefined) throw new Error('Status required')
      const { error } = await context.supabase.from('custom_checklist_values').upsert(
        {
          employee_id: employeeId,
          field_id: field,
          year,
          month,
          status: data.status,
          updated_by: auth.userId,
        },
        { onConflict: 'employee_id,field_id,year,month' },
      )
      if (error) throw new Error(error.message)
      return { ok: true }
    }

    const builtInKey = field as BuiltInFieldKey
    const isBuiltIn = BUILT_IN_FIELDS.some((f) => f.key === builtInKey)

    const { data: existing } = await context.supabase
      .from('payroll_checklists')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    const patch: Record<string, unknown> = {
      updated_by: auth.userId,
    }

    if (isBuiltIn && data.status !== undefined) {
      patch[builtInKey] = data.status
    }
    if (data.notes !== undefined) patch.notes = data.notes
    if (data.progressOverride !== undefined) {
      patch.progress_override = data.progressOverride
    }

    if (existing) {
      const { error } = await context.supabase
        .from('payroll_checklists')
        .update(patch)
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await context.supabase.from('payroll_checklists').insert({
        employee_id: employeeId,
        year,
        month,
        ...patch,
      })
      if (error) throw new Error(error.message)
    }

    return { ok: true }
  })

export const bulkUpdateChecklist = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(
    periodSchema.extend({
      employeeIds: z.array(z.string().uuid()).min(1),
      field: z.string(),
      status: statusSchema,
      isCustom: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertPeriodNotLocked(context.supabase, data.year, data.month)
    const auth = context.auth

    if (data.isCustom) {
      const payload = data.employeeIds.map((employeeId) => ({
        employee_id: employeeId,
        field_id: data.field,
        year: data.year,
        month: data.month,
        status: data.status,
        updated_by: auth.userId,
      }))

      const { error } = await context.supabase
        .from('custom_checklist_values')
        .upsert(payload, { onConflict: 'employee_id,field_id,year,month' })

      if (error) throw new Error(error.message)
      return { updated: data.employeeIds.length }
    }

    const builtInKey = data.field as BuiltInFieldKey
    if (!BUILT_IN_FIELDS.some((f) => f.key === builtInKey)) {
      throw new Error('Invalid field')
    }

    const payload = data.employeeIds.map((employeeId) => ({
      employee_id: employeeId,
      year: data.year,
      month: data.month,
      [builtInKey]: data.status,
      updated_by: auth.userId,
    }))

    const { error } = await context.supabase
      .from('payroll_checklists')
      .upsert(payload, { onConflict: 'employee_id,year,month' })

    if (error) throw new Error(error.message)
    return { updated: data.employeeIds.length }
  })
