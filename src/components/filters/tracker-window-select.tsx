import { TRACKER_WINDOWS } from '#/lib/constants'
import type { TrackerWindowId } from '#/lib/types'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

interface TrackerWindowSelectProps {
  value: TrackerWindowId
  onValueChange: (value: TrackerWindowId) => void
  triggerClassName?: string
}

export function TrackerWindowSelect({
  value,
  onValueChange,
  triggerClassName = 'w-44',
}: TrackerWindowSelectProps) {
  return (
    <div>
      <Label className="text-xs">Tracker</Label>
      <Select value={value} onValueChange={(v) => onValueChange(v as TrackerWindowId)}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRACKER_WINDOWS.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
