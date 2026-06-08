import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { BUILT_IN_FIELDS, getCurrentPeriod } from '#/lib/constants'
import { requireSupabaseAuth } from '#/lib/auth/middleware'
import {
  computeProgress,
  getChecklistStatuses,
  getCompletionCategory,
} from '#/lib/payroll'
import type {
  ChecklistStatus,
  CustomChecklistField,
  Employee,
  EmployeeCompletionCategory,
  PayrollChecklist,
} from '#/lib/types'

export interface DashboardFieldStatus {
  key: string
  label: string
  status: ChecklistStatus
}

export interface DashboardGroupMember {
  employeeId: string
  employeeCode: string
  fullName: string
  division: string
  progress: number
  category: EmployeeCompletionCategory
  fields: DashboardFieldStatus[]
}

function buildMemberFields(
  checklist: PayrollChecklist | null,
  customFields: CustomChecklistField[],
  customValues: { employee_id: string; field_id: string; status: ChecklistStatus }[],
  employeeId: string,
): DashboardFieldStatus[] {
  const builtIn: DashboardFieldStatus[] = BUILT_IN_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    status: checklist?.[f.key] ?? 'not_yet_submitted',
  }))

  const custom: DashboardFieldStatus[] = customFields.map((cf) => {
    const val = customValues.find(
      (v) => v.employee_id === employeeId && v.field_id === cf.id,
    )
    return {
      key: cf.key,
      label: cf.label,
      status: val?.status ?? 'not_yet_submitted',
    }
  })

  return [...builtIn, ...custom]
}

const periodSchema = z
  .object({
    year: z.number().int().optional(),
    month: z.number().int().min(1).max(12).optional(),
  })
  .optional()

export const getDashboardData = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodSchema)
  .handler(async ({ context, data }) => {
    const period = data ?? getCurrentPeriod()
    const { year, month } = {
      year: period.year ?? getCurrentPeriod().year,
      month: period.month ?? getCurrentPeriod().month,
    }

    const { data: employees, error: empErr } = await context.supabase
      .from('employees')
      .select('*')

    if (empErr) throw new Error(empErr.message)

    const { data: checklists } = await context.supabase
      .from('payroll_checklists')
      .select('*')
      .eq('year', year)
      .eq('month', month)

    const { data: customFields } = await context.supabase
      .from('custom_checklist_fields')
      .select('*')
      .eq('active', true)

    const { data: customValues } = await context.supabase
      .from('custom_checklist_values')
      .select('*')
      .eq('year', year)
      .eq('month', month)

    const activeCustomFields = (customFields ?? []) as CustomChecklistField[]
    const activeFieldIds = activeCustomFields.map((f) => f.id)
    const allCustomValues = (customValues ?? []) as {
      employee_id: string
      field_id: string
      status: ChecklistStatus
    }[]
    const checklistMap = new Map(
      (checklists ?? []).map((c) => [c.employee_id, c as PayrollChecklist]),
    )

    const allEmployees = (employees ?? []) as Employee[]
    const activeEmployees = allEmployees.filter((e) => e.status === 'active')

    const progressByEmployee: {
      employee: Employee
      progress: number
      category: ReturnType<typeof getCompletionCategory>
    }[] = []

    const statusCounts: Record<ChecklistStatus, number> = {
      not_yet_submitted: 0,
      submitted: 0,
      not_needed: 0,
      completed: 0,
    }

    for (const emp of activeEmployees) {
      const checklist = checklistMap.get(emp.id) ?? null
      const customStatuses = activeFieldIds.map((fieldId) => {
        const val = allCustomValues.find(
          (v) => v.employee_id === emp.id && v.field_id === fieldId,
        )
        return (val?.status ?? 'not_yet_submitted') as ChecklistStatus
      })

      const statuses = getChecklistStatuses(checklist, customStatuses)
      for (const s of statuses) {
        statusCounts[s]++
      }

      const progress = computeProgress(
        statuses,
        checklist?.progress_override,
      )
      progressByEmployee.push({
        employee: emp,
        progress,
        category: getCompletionCategory(progress),
      })
    }

    const completed = progressByEmployee.filter(
      (p) => p.category === 'completed',
    ).length
    const inProgress = progressByEmployee.filter(
      (p) => p.category === 'in_progress',
    ).length
    const notStarted = progressByEmployee.filter(
      (p) => p.category === 'not_started',
    ).length

    const avgProgress =
      progressByEmployee.length > 0
        ? Math.round(
            progressByEmployee.reduce((s, p) => s + p.progress, 0) /
              progressByEmployee.length,
          )
        : 0

    const totalStatusEntries = Object.values(statusCounts).reduce(
      (a, b) => a + b,
      0,
    )

    const statusDistribution = (
      Object.entries(statusCounts) as [ChecklistStatus, number][]
    ).map(([status, count]) => ({
      status,
      count,
      percentage:
        totalStatusEntries > 0
          ? Math.round((count / totalStatusEntries) * 1000) / 10
          : 0,
    }))

    const groupMap = new Map<
      string,
      {
        group: string
        employees: typeof progressByEmployee
      }
    >()

    for (const row of progressByEmployee) {
      const group = row.employee.payroll_group || 'Unassigned'
      if (!groupMap.has(group)) {
        groupMap.set(group, { group, employees: [] })
      }
      groupMap.get(group)!.employees.push(row)
    }

    const payrollGroups = Array.from(groupMap.values()).map((g) => {
      const completedCount = g.employees.filter(
        (e) => e.category === 'completed',
      ).length
      const inProgressCount = g.employees.filter(
        (e) => e.category === 'in_progress',
      ).length
      const notStartedCount = g.employees.filter(
        (e) => e.category === 'not_started',
      ).length
      const avg =
        g.employees.length > 0
          ? Math.round(
              g.employees.reduce((s, e) => s + e.progress, 0) /
                g.employees.length,
            )
          : 0

      const groupStatusCounts: Record<ChecklistStatus, number> = {
        not_yet_submitted: 0,
        submitted: 0,
        not_needed: 0,
        completed: 0,
      }

      for (const e of g.employees) {
        const checklist = checklistMap.get(e.employee.id) ?? null
        const customStatuses = activeFieldIds.map((fieldId) => {
          const val = allCustomValues.find(
            (v) => v.employee_id === e.employee.id && v.field_id === fieldId,
          )
          return (val?.status ?? 'not_yet_submitted') as ChecklistStatus
        })
        const statuses = getChecklistStatuses(checklist, customStatuses)
        for (const s of statuses) {
          groupStatusCounts[s]++
        }
      }

      const members: DashboardGroupMember[] = g.employees.map((e) => {
        const checklist = checklistMap.get(e.employee.id) ?? null
        return {
          employeeId: e.employee.id,
          employeeCode: e.employee.employee_code,
          fullName: e.employee.full_name,
          division: e.employee.division,
          progress: e.progress,
          category: e.category,
          fields: buildMemberFields(
            checklist,
            activeCustomFields,
            allCustomValues,
            e.employee.id,
          ),
        }
      })

      return {
        group: g.group,
        employeeCount: g.employees.length,
        completed: completedCount,
        inProgress: inProgressCount,
        notStarted: notStartedCount,
        averageProgress: avg,
        statusCounts: groupStatusCounts,
        members,
      }
    })

    payrollGroups.sort((a, b) => a.group.localeCompare(b.group))

    const divisionMap = new Map<
      string,
      { division: string; employees: typeof progressByEmployee }
    >()
    for (const row of progressByEmployee) {
      const div = row.employee.division || 'Unassigned'
      if (!divisionMap.has(div)) {
        divisionMap.set(div, { division: div, employees: [] })
      }
      divisionMap.get(div)!.employees.push(row)
    }

    const divisionSummary = Array.from(divisionMap.values())
      .map((d) => {
        const completedCount = d.employees.filter(
          (e) => e.category === 'completed',
        ).length
        const inProgressCount = d.employees.filter(
          (e) => e.category === 'in_progress',
        ).length
        const notStartedCount = d.employees.filter(
          (e) => e.category === 'not_started',
        ).length
        const avg =
          d.employees.length > 0
            ? Math.round(
                d.employees.reduce((s, e) => s + e.progress, 0) /
                  d.employees.length,
              )
            : 0
        return {
          division: d.division,
          employeeCount: d.employees.length,
          completed: completedCount,
          inProgress: inProgressCount,
          notStarted: notStartedCount,
          averageProgress: avg,
        }
      })
      .sort((a, b) => a.division.localeCompare(b.division))

    return {
      year,
      month,
      stats: {
        total: allEmployees.length,
        active: activeEmployees.length,
        completed,
        inProgress: inProgress,
      },
      averageProgress: avgProgress,
      completionPie: [
        { name: 'Completed', value: completed },
        { name: 'In Progress', value: inProgress },
        { name: 'Not Started', value: notStarted },
      ],
      statusDistribution,
      payrollGroups,
      divisionSummary,
      builtInFieldCount: BUILT_IN_FIELDS.length,
    }
  })
