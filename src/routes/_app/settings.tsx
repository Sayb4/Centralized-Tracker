import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { labelToKey } from '#/lib/constants'
import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
  updateCustomField,
} from '#/server/settings'
import { useHasRole } from '#/components/auth/auth-provider'
import { AppHeader } from '#/components/layout/app-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const isAdmin = useHasRole('admin')
  const [newLabel, setNewLabel] = useState('')
  const queryClient = useQueryClient()

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => listCustomFields(),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['custom-fields'] })

  const createMut = useMutation({
    mutationFn: createCustomField,
    onSuccess: () => {
      invalidate()
      setNewLabel('')
      toast.success('Field added')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateMut = useMutation({
    mutationFn: updateCustomField,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      invalidate()
      toast.success('Field deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <AppHeader title="Settings" />
      <main className="flex-1 space-y-6 p-6">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Custom checklist fields</h2>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              Only administrators can manage custom fields.
            </p>
          )}

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Active</TableHead>
                    {isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Input
                          defaultValue={field.label}
                          disabled={!isAdmin}
                          onBlur={(e) => {
                            if (e.target.value !== field.label) {
                              updateMut.mutate({
                                data: { id: field.id, label: e.target.value },
                              })
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{field.key}</TableCell>
                      <TableCell>
                        <Switch
                          checked={field.active}
                          disabled={!isAdmin}
                          onCheckedChange={(active) =>
                            updateMut.mutate({ data: { id: field.id, active } })
                          }
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (
                                confirm(
                                  'Delete this field? All stored values will be lost.',
                                )
                              ) {
                                deleteMut.mutate({ data: { id: field.id } })
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

          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div>
                <Label>New field label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Field label"
                  className="mt-1 w-64"
                />
              </div>
              <Button
                onClick={() => {
                  if (!newLabel.trim()) return
                  createMut.mutate({
                    data: {
                      label: newLabel.trim(),
                      key: labelToKey(newLabel),
                    },
                  })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add field
              </Button>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
