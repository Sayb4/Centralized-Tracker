import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAdmin } from '#/lib/auth/middleware'
import { createSupabaseAdminClient } from '#/lib/supabase/admin'
import type { AuditLogEntry } from '#/lib/types'

const PAGE_SIZE = 50

export const AUDIT_ENTITY_TYPES = [
  'employees',
  'payroll_checklists',
  'custom_checklist_values',
  'custom_checklist_fields',
] as const

export const AUDIT_ACTIONS = ['INSERT', 'UPDATE', 'DELETE'] as const

export const listAuditLog = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      actorEmail: z.string().optional(),
      action: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
      entityType: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = createSupabaseAdminClient()
    const from = (data.page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = admin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (data.actorEmail?.trim()) {
      query = query.ilike('actor_email', `%${data.actorEmail.trim()}%`)
    }
    if (data.action) {
      query = query.eq('action', data.action)
    }
    if (data.entityType?.trim()) {
      query = query.eq('entity_type', data.entityType.trim())
    }
    if (data.dateFrom?.trim()) {
      query = query.gte('created_at', data.dateFrom.trim())
    }
    if (data.dateTo?.trim()) {
      const end = new Date(data.dateTo.trim())
      end.setDate(end.getDate() + 1)
      query = query.lt('created_at', end.toISOString())
    }

    const { data: rows, error, count } = await query

    if (error) throw new Error(error.message)

    return {
      entries: (rows ?? []) as AuditLogEntry[],
      total: count ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    }
  })
