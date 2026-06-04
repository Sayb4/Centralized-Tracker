import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '#/lib/auth/middleware'
import { DIVISIONS } from '#/lib/constants'
import type { Employee } from '#/lib/types'

const employeeSchema = z.object({
  employee_code: z.string().min(1),
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  department: z.string().refine(
    (d) => (DIVISIONS as readonly string[]).includes(d),
    'Invalid division',
  ),
  position: z.string().optional(),
  payroll_group: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

export const csvRowSchema = employeeSchema

export const listEmployees = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Employee[]> => {
    const { data, error } = await context.supabase
      .from('employees')
      .select('*')
      .order('full_name')

    if (error) throw new Error(error.message)
    return (data ?? []) as Employee[]
  })

export const createEmployee = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(employeeSchema)
  .handler(async ({ context, data }) => {
    const auth = context.auth
    if (
      !auth.roles.includes('admin') &&
      !auth.roles.includes('manager') &&
      !auth.features['employees.manage']
    ) {
      throw new Error('Forbidden')
    }

    const { data: row, error } = await context.supabase
      .from('employees')
      .insert({
        ...data,
        email: data.email || null,
        position: data.position || null,
        payroll_group: data.payroll_group || null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return row as Employee
  })

export const updateEmployee = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    employeeSchema.extend({ id: z.string().uuid() }),
  )
  .handler(async ({ context, data }) => {
    const auth = context.auth
    if (
      !auth.roles.includes('admin') &&
      !auth.roles.includes('manager') &&
      !auth.features['employees.manage']
    ) {
      throw new Error('Forbidden')
    }

    const { id, ...rest } = data
    const { data: row, error } = await context.supabase
      .from('employees')
      .update({
        ...rest,
        email: rest.email || null,
        position: rest.position || null,
        payroll_group: rest.payroll_group || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return row as Employee
  })

export const deleteEmployee = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const auth = context.auth
    if (
      !auth.roles.includes('admin') &&
      !auth.roles.includes('manager') &&
      !auth.features['employees.manage']
    ) {
      throw new Error('Forbidden')
    }

    const { error } = await context.supabase
      .from('employees')
      .delete()
      .eq('id', data.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const validateCsvImport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      rows: z.array(z.record(z.string(), z.string())),
    }),
  )
  .handler(async ({ data }) => {
    const valid: z.infer<typeof employeeSchema>[] = []
    const invalid: { row: number; errors: string[] }[] = []

    data.rows.forEach((row, index) => {
      const parsed = employeeSchema.safeParse({
        employee_code: row.employee_code?.trim(),
        full_name: row.full_name?.trim(),
        email: row.email?.trim() || undefined,
        department: (row.division ?? row.department)?.trim(),
        position: row.position?.trim() || undefined,
        payroll_group: row.payroll_group?.trim() || undefined,
        status: (row.status?.trim().toLowerCase() || 'active') as
          | 'active'
          | 'inactive',
      })

      if (parsed.success) {
        valid.push(parsed.data)
      } else {
        invalid.push({
          row: index + 1,
          errors: parsed.error.issues.map((i) => i.message),
        })
      }
    })

    return { valid, invalid }
  })

export const importEmployees = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ rows: z.array(employeeSchema) }))
  .handler(async ({ context, data }) => {
    const auth = context.auth
    if (
      !auth.roles.includes('admin') &&
      !auth.roles.includes('manager') &&
      !auth.features['employees.manage']
    ) {
      throw new Error('Forbidden')
    }

    const payload = data.rows.map((r) => ({
      ...r,
      email: r.email || null,
      position: r.position || null,
      payroll_group: r.payroll_group || null,
    }))

    const { data: rows, error } = await context.supabase
      .from('employees')
      .upsert(payload, { onConflict: 'employee_code' })
      .select()

    if (error) throw new Error(error.message)
    return { imported: rows?.length ?? 0 }
  })
