import type {
  BuiltInFieldKey,
  ChecklistStatus,
  CustomChecklistField,
  TrackerWindow,
  TrackerWindowId,
} from '#/lib/types'

export const APP_NAME = 'OCPDC Tracker'

/** Login page background video — place the file in `public/` and update this path. */
export const LOGIN_BACKGROUND_VIDEO = '/login-background.mp4'

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
  { key: 'attendance_record', label: 'Attendance Record' },
  { key: 'leave_credits', label: 'Leave Credits' },
  { key: 'required_documents', label: 'Required Documents' },

]

export const TRACKER_DEFAULT_WINDOW: TrackerWindowId = 'payroll'

export const TRACKER_WINDOWS: TrackerWindow[] = [
  {
    id: 'payroll',
    label: 'Payroll',
    description: 'Full monthly payroll compliance checklist',
    fieldKeys: [
      'certificate_of_appearance',
      'special_order',
      'override_status',
      'leave_application',
    ],
    tabs: [
      { id: 'all', label: 'All Items' },
      {
        id: 'certificate_of_appearance',
        label: 'Certificate of Appearance',
        fields: ['certificate_of_appearance'],
      },
      {
        id: 'special_order',
        label: 'Special Order',
        fields: ['special_order'],
      },
      {
        id: 'override_status',
        label: 'Override Status',
        fields: ['override_status'],
      },
      {
        id: 'leave_application',
        label: 'Leave Application',
        fields: ['leave_application'],
      },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    description: 'Track required document submissions',
    fieldKeys: ['required_documents'],
    tabs: [
      
      {
        id: 'required_documents',
        label: 'Required Documents',
        fields: ['required_documents'],
      },
      
    ],
  },
  {
    id: 'leave',
    label: 'Leave & Attendance',
    description: 'Leave credits available and attendance records',
    fieldKeys: ['leave_application', 'attendance_record'],
    tabs: [
      { id: 'all', label: 'All' },
      {
        id: 'leave_credits',
        label: 'Leave Credits',
        fields: ['leave_credits'],
      },
      {
        id: 'attendance',
        label: 'Attendance',
        fields: ['attendance_record'],
      },
    ],
  },
]

export function getTrackerWindow(id: string): TrackerWindow | undefined {
  return TRACKER_WINDOWS.find((w) => w.id === id)
}

export const TRACKER_WINDOW_IDS = TRACKER_WINDOWS.map(
  (w) => w.id,
) as TrackerWindowId[]

export function filterCustomFieldsForWindow(
  fields: CustomChecklistField[],
  windowId: TrackerWindowId,
): CustomChecklistField[] {
  return fields.filter((f) =>
    (f.tracker_windows ?? ['payroll']).includes(windowId),
  )
}

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
