export type AppRole = 'admin'

export type ChecklistStatus =
  | 'not_yet_submitted'
  | 'submitted'
  | 'not_needed'
  | 'completed'

export type EmployeeStatus = 'active' | 'inactive'

export type BuiltInFieldKey =
  | 'certificate_of_appearance'
  | 'special_order'
  | 'override_status'
  | 'leave_application'
  | 'attendance_record'
  | 'leave_credits'
  | 'required_documents'

export type TrackerWindowId = 'payroll' | 'documentation' | 'leave'

export interface TrackerTab {
  id: string
  label: string
  fields?: BuiltInFieldKey[]
}

export interface TrackerWindow {
  id: TrackerWindowId
  label: string
  description: string
  fieldKeys: BuiltInFieldKey[]
  tabs: TrackerTab[]
}

export interface Employee {
  id: string
  employee_code: string
  full_name: string
  email: string | null
  division: string
  position: string | null
  payroll_group: string | null
  status: EmployeeStatus
  created_at: string
}

export interface PayrollChecklist {
  id: string
  employee_id: string
  year: number
  month: number
  certificate_of_appearance: ChecklistStatus
  special_order: ChecklistStatus
  override_status: ChecklistStatus
  leave_application: ChecklistStatus
  progress_override: number | null
  notes: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomChecklistField {
  id: string
  key: string
  label: string
  sort_order: number
  active: boolean
  tracker_windows: TrackerWindowId[]
}

export interface CustomChecklistValue {
  id: string
  employee_id: string
  field_id: string
  year: number
  month: number
  status: ChecklistStatus
  updated_by: string | null
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  is_active: boolean
}

export interface AuthState {
  userId: string
  email: string
  profile: Profile | null
  roles: AppRole[]
  features: Record<string, boolean>
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

export type TrackerFilterStatus =
  | 'all'
  | 'completed'
  | 'pending'
  | 'not_started'

export type EmployeeCompletionCategory =
  | 'completed'
  | 'in_progress'
  | 'not_started'
