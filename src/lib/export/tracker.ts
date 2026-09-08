import {
  BUILT_IN_FIELDS,
  CHECKLIST_STATUS_LABELS,
  filterCustomFieldsForWindow,
  formatPeriod,
  getTrackerWindow,
} from '#/lib/constants'
import { downloadCsv } from '#/lib/export/csv'
import type { ChecklistStatus, CustomChecklistField, TrackerWindowId } from '#/lib/types'
import type { TrackerRow } from '#/server/tracker'

function statusLabel(status: ChecklistStatus | undefined): string {
  return CHECKLIST_STATUS_LABELS[status ?? 'not_yet_submitted']
}

export function buildTrackerExportTable(opts: {
  rows: TrackerRow[]
  trackerWindow: TrackerWindowId
  customFields: CustomChecklistField[]
  year: number
  month: number
}) {
  const window = getTrackerWindow(opts.trackerWindow)!
  const windowCustomFields = filterCustomFieldsForWindow(
    opts.customFields,
    opts.trackerWindow,
  )
  const builtInCols = BUILT_IN_FIELDS.filter((f) =>
    window.fieldKeys.includes(f.key),
  )

  const headers = [
    'Employee Code',
    'Full Name',
    'Division',
    'Position',
    'Payroll Group',
    'Email',
    ...builtInCols.map((f) => f.label),
    ...windowCustomFields.map((f) => f.label),
    'Progress %',
    'Progress Override',
    'Notes',
  ]

  const dataRows = opts.rows.map((row) => {
    const checklist = row.checklist
    return [
      row.employee.employee_code,
      row.employee.full_name,
      row.employee.division,
      row.employee.position ?? '',
      row.employee.payroll_group ?? '',
      row.employee.email ?? '',
      ...builtInCols.map((f) => {
        const status = checklist?.[f.key as keyof typeof checklist] as
          | ChecklistStatus
          | undefined
        return statusLabel(status)
      }),
      ...windowCustomFields.map((f) =>
        statusLabel(row.customValues[f.id]),
      ),
      String(row.progress),
      checklist?.progress_override != null
        ? String(checklist.progress_override)
        : '',
      checklist?.notes ?? '',
    ]
  })

  return { headers, dataRows }
}

export function exportTrackerCsv(opts: {
  rows: TrackerRow[]
  trackerWindow: TrackerWindowId
  customFields: CustomChecklistField[]
  year: number
  month: number
}) {
  const window = getTrackerWindow(opts.trackerWindow)!
  const { headers, dataRows } = buildTrackerExportTable(opts)
  const periodSlug = `${opts.year}-${String(opts.month).padStart(2, '0')}`
  downloadCsv(
    `${window.id}-tracker-${periodSlug}.csv`,
    headers,
    dataRows,
  )
}

export function exportTrackerPdf(opts: {
  rows: TrackerRow[]
  trackerWindow: TrackerWindowId
  customFields: CustomChecklistField[]
  year: number
  month: number
}) {
  const window = getTrackerWindow(opts.trackerWindow)!
  const { headers, dataRows } = buildTrackerExportTable(opts)
  const title = `${window.label} Tracker — ${formatPeriod(opts.year, opts.month)}`

  void import('jspdf').then(({ jsPDF }) =>
    import('jspdf-autotable').then(({ default: autoTable }) => {
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(14)
      doc.text(title, 14, 16)
      doc.setFontSize(10)
      doc.text(`Exported ${new Date().toLocaleString()} · ${opts.rows.length} employees`, 14, 22)

      autoTable(doc, {
        head: [headers],
        body: dataRows,
        startY: 28,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [55, 65, 81] },
        margin: { left: 14, right: 14 },
      })

      const periodSlug = `${opts.year}-${String(opts.month).padStart(2, '0')}`
      doc.save(`${window.id}-tracker-${periodSlug}.pdf`)
    }),
  )
}
