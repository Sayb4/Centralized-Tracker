import type { BuiltInFieldKey, ChecklistStatus } from '#/lib/types'

export const APP_NAME = 'OCPDC Payroll Tracker'
export const ADMIN_EMAIL = 'ocpdc_admin@ocpdc.local'
export const ADMIN_USERNAME = 'ocpdc_admin'

/** Login page background video — place the file in `public/` and update this path. */
export const LOGIN_BACKGROUND_VIDEO = '/login-background.mp4'

export const DIVISIONS = [
  'Admin',
  'Sectoral',
  'PPDIV',
  'IMD',
  'Traffic'
] as const

export const FEATURES = {
  TRACKER_EDIT: 'tracker.edit',
  EMPLOYEES_MANAGE: 'employees.manage',
  SETTINGS_EDIT: 'settings.edit',
} as const

export const BUILT_IN_FIELDS: {
  key: BuiltInFieldKey
  label: string
}[] = [
  { key: 'certificate_of_appearance', label: 'Certificate of Appearance' },
  { key: 'special_order', label: 'Special Order' },
  { key: 'override_status', label: 'Override Status' },
  { key: 'leave_application', label: 'Leave Application' },
]

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  not_yet_submitted: 'Not Yet Submitted',
  submitted: 'Submitted',
  not_needed: 'Not Needed',
  completed: 'Completed',
}

export const CHECKLIST_STATUSES: ChecklistStatus[] = [
  'not_yet_submitted',
  'submitted',
  'not_needed',
  'completed',
]

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function usernameToEmail(username: string): string {
  const trimmed = username.trim()
  if (trimmed.includes('@')) return trimmed
  return `${trimmed}@ocpdc.local`
}

export function labelToKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function getCurrentPeriod(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function formatPeriod(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}
