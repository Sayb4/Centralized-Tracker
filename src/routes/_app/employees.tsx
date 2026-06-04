import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { DIVISIONS } from '#/lib/constants'
import type { Employee } from '#/lib/types'
import {
  createEmployee,
  deleteEmployee,
  importEmployees,
  listEmployees,
  updateEmployee,
  validateCsvImport,
} from '#/server/employees'
import { useCanManageEmployees } from '#/components/auth/auth-provider'
import { AppHeader } from '#/components/layout/app-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_app/employees')({
  component: EmployeesPage,
})

const formSchema = z.object({
  employee_code: z.string().min(1),
  full_name: z.string().min(1),
  email: z.string().optional(),
  department: z.string(),
  position: z.string().optional(),
  payroll_group: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

function EmployeesPage() {
  const canManage = useCanManageEmployees()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [csvPreview, setCsvPreview] = useState<{
    valid: z.infer<typeof formSchema>[]
    invalid: { row: number; errors: string[] }[]
  } | null>(null)
  const queryClient = useQueryClient()

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => listEmployees(),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        (e.email?.toLowerCase().includes(q) ?? false),
    )
  }, [employees, search])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['employees'] })

  return (
    <>
      <AppHeader title="Employees" />
      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name, code, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {canManage && (
            <>
              <Button
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add employee
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>{emp.employee_code}</TableCell>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.payroll_group ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          emp.status === 'active' ? 'default' : 'secondary'
                        }
                      >
                        {emp.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(emp)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm('Delete this employee?')) return
                            try {
                              await deleteEmployee({ data: { id: emp.id } })
                              invalidate()
                              toast.success('Employee deleted')
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : 'Delete failed',
                              )
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <EmployeeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employee={editing}
          onSaved={() => {
            invalidate()
            setDialogOpen(false)
          }}
        />

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import employees (CSV)</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Headers: employee_code, full_name, email, division, position,
              payroll_group, status
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                const lines = text.trim().split(/\r?\n/)
                const headers = lines[0].split(',').map((h) => h.trim())
                const rows = lines.slice(1).map((line) => {
                  const values = line.split(',').map((v) => v.trim())
                  return Object.fromEntries(
                    headers.map((h, i) => [h, values[i] ?? '']),
                  )
                })
                try {
                  const preview = await validateCsvImport({ data: { rows } })
                  setCsvPreview(preview)
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : 'Validation failed',
                  )
                }
              }}
            />
            {csvPreview && (
              <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
                <p className="text-success">
                  Valid: {csvPreview.valid.length} rows
                </p>
                <p className="text-destructive">
                  Invalid: {csvPreview.invalid.length} rows
                </p>
                {csvPreview.invalid.slice(0, 5).map((inv) => (
                  <p key={inv.row} className="text-xs text-muted-foreground">
                    Row {inv.row}: {inv.errors.join(', ')}
                  </p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button
                disabled={!csvPreview?.valid.length}
                onClick={async () => {
                  if (!csvPreview) return
                  try {
                    const res = await importEmployees({
                      data: { rows: csvPreview.valid },
                    })
                    toast.success(`Imported ${res.imported} employees`)
                    invalidate()
                    setImportOpen(false)
                    setCsvPreview(null)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Import failed')
                  }
                }}
              >
                Import valid rows
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  )
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  employee: Employee | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    department: DIVISIONS[0],
    position: '',
    payroll_group: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (employee) {
      setForm({
        employee_code: employee.employee_code,
        full_name: employee.full_name,
        email: employee.email ?? '',
        department: employee.department,
        position: employee.position ?? '',
        payroll_group: employee.payroll_group ?? '',
        status: employee.status,
      })
    } else {
      setForm({
        employee_code: '',
        full_name: '',
        email: '',
        department: DIVISIONS[0],
        position: '',
        payroll_group: '',
        status: 'active',
      })
    }
  }, [employee, open])

  async function handleSave() {
    const parsed = formSchema.safeParse(form)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form')
      return
    }
    setSaving(true)
    try {
      if (employee) {
        await updateEmployee({ data: { id: employee.id, ...parsed.data } })
        toast.success('Employee updated')
      } else {
        await createEmployee({ data: parsed.data })
        toast.success('Employee created')
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit' : 'Add'} employee</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Employee code</Label>
            <Input
              value={form.employee_code}
              onChange={(e) =>
                setForm((f) => ({ ...f, employee_code: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Full name</Label>
            <Input
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label>Division</Label>
            <Select
              value={form.department}
              onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Position</Label>
            <Input
              value={form.position}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Payroll group</Label>
            <Input
              value={form.payroll_group}
              onChange={(e) =>
                setForm((f) => ({ ...f, payroll_group: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status: v as 'active' | 'inactive' }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
