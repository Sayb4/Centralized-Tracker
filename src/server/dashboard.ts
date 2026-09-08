import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  TRACKER_DEFAULT_WINDOW,
  TRACKER_WINDOW_IDS,
  getCurrentPeriod,
  getTrackerWindow,
} from '#/lib/constants'
import { requireSupabaseAuth } from '#/lib/auth/middleware'
import type {
  ChecklistStatus,
  EmployeeCompletionCategory,
  TrackerWindowId,
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

const dashboardInputSchema = z
  .object({
    year: z.number().int().optional(),
    month: z.number().int().min(1).max(12).optional(),
    trackerWindow: z
      .enum(TRACKER_WINDOW_IDS as [TrackerWindowId, ...TrackerWindowId[]])
      .optional(),
  })
  .optional()

interface DashboardAnalyticsRpc {
  stats: {
    total: number
    active: number
    completed: number
    inProgress: number
  }
  averageProgress: number
  completionPie: { name: string; value: number }[]
  statusDistribution: {
    status: ChecklistStatus
    count: number
    percentage: number
  }[]
  divisionSummary: {
    division: string
    employeeCount: number
    completed: number
    inProgress: number
    notStarted: number
    averageProgress: number
  }[]
  payrollGroups: {
    group: string
    employeeCount: number
    completed: number
    inProgress: number
    notStarted: number
    averageProgress: number
    members: DashboardGroupMember[]
  }[]
}

export const getDashboardData = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(dashboardInputSchema)
  .handler(async ({ context, data }) => {
    const period = data ?? getCurrentPeriod()
    const year = period.year ?? getCurrentPeriod().year
    const month = period.month ?? getCurrentPeriod().month
    const trackerWindow = data?.trackerWindow ?? TRACKER_DEFAULT_WINDOW
    const window = getTrackerWindow(trackerWindow)!

    const { data: analytics, error } = await context.supabase.rpc(
      'get_dashboard_analytics',
      {
        p_year: year,
        p_month: month,
        p_tracker_window: trackerWindow,
      },
    )

    if (error) throw new Error(error.message)

    const payload = analytics as DashboardAnalyticsRpc

    const { data: customFieldRows } = await context.supabase
      .from('custom_checklist_fields')
      .select('tracker_windows')
      .eq('active', true)

    const customFieldCount = (customFieldRows ?? []).filter((row) =>
      (row.tracker_windows ?? ['payroll']).includes(trackerWindow),
    ).length

    return {
      year,
      month,
      trackerWindow,
      trackerLabel: window.label,
      trackerDescription: window.description,
      stats: payload.stats,
      averageProgress: payload.averageProgress,
      completionPie: payload.completionPie,
      statusDistribution: payload.statusDistribution,
      payrollGroups: payload.payrollGroups,
      divisionSummary: payload.divisionSummary,
      fieldCount: window.fieldKeys.length + customFieldCount,
    }
  })
