import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAdmin, requireSupabaseAuth } from '#/lib/auth/middleware'
import { labelToKey } from '#/lib/constants'
import type { CustomChecklistField } from '#/lib/types'

export const listCustomFields = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomChecklistField[]> => {
    const { data, error } = await context.supabase
      .from('custom_checklist_fields')
      .select('*')
      .order('sort_order')

    if (error) throw new Error(error.message)
    return (data ?? []) as CustomChecklistField[]
  })

export const createCustomField = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      label: z.string().min(1),
      key: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const key = data.key || labelToKey(data.label)
    const { data: row, error } = await context.supabase
      .from('custom_checklist_fields')
      .insert({ label: data.label, key, sort_order: 0 })
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
