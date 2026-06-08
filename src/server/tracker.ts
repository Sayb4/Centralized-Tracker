import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { BUILT_IN_FIELDS } from '#/lib/constants'
import { requireAdmin, requireSupabaseAuth } from '#/lib/auth/middleware'
import {
  computeProgress,
  getChecklistStatuses,
  matchesTrackerFilter,
} from '#/lib/payroll'
import type {
  BuiltInFieldKey,
  ChecklistStatus,
  CustomChecklistField,
  CustomChecklistValue,
  Employee,
  PayrollChecklist,
} from '#/lib/types'

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

export const getTrackerData = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    periodSchema.extend({
      division: z.string().optional(),
      statusFilter: z
        .enum(['all', 'completed', 'pending', 'not_started'])
        .optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { data: employees, error: empErr } = await context.supabase
      .from('employees')
      .select('*')
      .order('full_name')

    if (empErr) throw new Error(empErr.message)

    const { data: checklists } = await context.supabase
      .from('payroll_checklists')
      .select('*')
      .eq('year', data.year)
      .eq('month', data.month)

    const { data: customFields } = await context.supabase
      .from('custom_checklist_fields')
      .select('*')
      .eq('active', true)
      .order('sort_order')

    const { data: customValues } = await context.supabase
      .from('custom_checklist_values')
      .select('*')
      .eq('year', data.year)
      .eq('month', data.month)

    const activeFields = (customFields ?? []) as CustomChecklistField[]
    const checklistMap = new Map(
      (checklists ?? []).map((c) => [c.employee_id, c as PayrollChecklist]),
    )

    const valueMap = new Map<string, CustomChecklistValue>()
    for (const v of customValues ?? []) {
      valueMap.set(`${v.employee_id}:${v.field_id}`, v as CustomChecklistValue)
    }

    let rows: TrackerRow[] = (employees ?? []).map((emp) => {
      const employee = emp as Employee
      const checklist = checklistMap.get(employee.id) ?? null
      const customStatus: Record<string, ChecklistStatus> = {}

      for (const field of activeFields) {
        const val = valueMap.get(`${employee.id}:${field.id}`)
        customStatus[field.id] = val?.status ?? 'not_yet_submitted'
      }

      const statuses = getChecklistStatuses(
        checklist,
        activeFields.map((f) => customStatus[f.id]),
      )

      const progress = computeProgress(
        statuses,
        checklist?.progress_override,
      )

      return { employee, checklist, customValues: customStatus, progress }
    })

    if (data.division && data.division !== 'all') {
      rows = rows.filter((r) => r.employee.division === data.division)
    }

    if (data.search?.trim()) {
      const q = data.search.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.employee.full_name.toLowerCase().includes(q) ||
          r.employee.employee_code.toLowerCase().includes(q),
      )
    }

    if (data.statusFilter && data.statusFilter !== 'all') {
      rows = rows.filter((r) =>
        matchesTrackerFilter(r.progress, data.statusFilter!),
      )
    }

    return {
      rows,
      customFields: activeFields,
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
    const auth = context.auth

    for (const employeeId of data.employeeIds) {
      if (data.isCustom) {
        const { error } = await context.supabase
          .from('custom_checklist_values')
          .upsert(
            {
              employee_id: employeeId,
              field_id: data.field,
              year: data.year,
              month: data.month,
              status: data.status,
              updated_by: auth.userId,
            },
            { onConflict: 'employee_id,field_id,year,month' },
          )
        if (error) throw new Error(error.message)
        continue
      }

      const builtInKey = data.field as BuiltInFieldKey
      const { data: existing } = await context.supabase
        .from('payroll_checklists')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('year', data.year)
        .eq('month', data.month)
        .maybeSingle()

      if (existing) {
        const { error } = await context.supabase
          .from('payroll_checklists')
          .update({
            [builtInKey]: data.status,
            updated_by: auth.userId,
          })
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await context.supabase
          .from('payroll_checklists')
          .insert({
            employee_id: employeeId,
            year: data.year,
            month: data.month,
            [builtInKey]: data.status,
            updated_by: auth.userId,
          })
        if (error) throw new Error(error.message)
      }
    }

    return { updated: data.employeeIds.length }
  })
