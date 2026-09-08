import { downloadCsv } from '#/lib/export/csv'
import type { Employee } from '#/lib/types'

const EXPORT_HEADERS = [
  'employee_code',
  'full_name',
  'email',
  'division',
  'position',
  'payroll_group',
  'status',
] as const

export function buildEmployeeExportRows(employees: Employee[]) {
  return employees.map((e) => [
    e.employee_code,
    e.full_name,
    e.email ?? '',
    e.division,
    e.position ?? '',
    e.payroll_group ?? '',
    e.status,
  ])
}

export function exportEmployeesCsv(employees: Employee[]) {
  downloadCsv(
    `employees-${new Date().toISOString().slice(0, 10)}.csv`,
    [...EXPORT_HEADERS],
    buildEmployeeExportRows(employees),
  )
}

export function exportEmployeesPdf(employees: Employee[]) {
  const headers = [
    'Code',
    'Name',
    'Email',
    'Division',
    'Position',
    'Payroll Group',
    'Status',
  ]
  const dataRows = buildEmployeeExportRows(employees)

  void import('jspdf').then(({ jsPDF }) =>
    import('jspdf-autotable').then(({ default: autoTable }) => {
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(14)
      doc.text('Employees', 14, 16)
      doc.setFontSize(10)
      doc.text(
        `Exported ${new Date().toLocaleString()} · ${employees.length} records`,
        14,
        22,
      )

      autoTable(doc, {
        head: [headers],
        body: dataRows,
        startY: 28,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [55, 65, 81] },
        margin: { left: 14, right: 14 },
      })

      doc.save(`employees-${new Date().toISOString().slice(0, 10)}.pdf`)
    }),
  )
}
