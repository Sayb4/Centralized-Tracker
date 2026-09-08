import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAdmin, requireSupabaseAuth } from '#/lib/auth/middleware'
import { TRACKER_WINDOW_IDS, labelToKey } from '#/lib/constants'
import type { CustomChecklistField } from '#/lib/types'

const trackerWindowsSchema = z
  .array(z.enum(TRACKER_WINDOW_IDS as [string, ...string[]]))
  .min(1, 'Select at least one tracker')

export const listCustomFields = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomChecklistField[]> => {
    const { data, error } = await context.supabase
      .from('custom_checklist_fields')
      .select('*')
      .order('sort_order')

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      ...(row as CustomChecklistField),
      tracker_windows: (row.tracker_windows ?? ['payroll']) as CustomChecklistField['tracker_windows'],
    }))
  })

export const createCustomField = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      label: z.string().min(1),
      key: z.string().optional(),
      tracker_windows: trackerWindowsSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const key = data.key || labelToKey(data.label)
    const { data: row, error } = await context.supabase
      .from('custom_checklist_fields')
      .insert({
        label: data.label,
        key,
        sort_order: 0,
        tracker_windows: data.tracker_windows,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return row as CustomChecklistField
  })

export const updateCustomField = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      label: z.string().min(1).optional(),
      active: z.boolean().optional(),
      sort_order: z.number().optional(),
      tracker_windows: trackerWindowsSchema.optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { id, ...updates } = data
    const { data: row, error } = await context.supabase
      .from('custom_checklist_fields')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return row as CustomChecklistField
  })

export const deleteCustomField = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from('custom_checklist_fields')
      .delete()
      .eq('id', data.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })
