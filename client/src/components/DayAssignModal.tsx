import { useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Person {
  id: number
  name: string
  subtitle?: string | null
}

interface Props {
  date: string
  currentId: number | null
  people: Person[]
  label: string
  loading?: boolean
  onAssign: (date: string, id: number | null) => Promise<void>
  onClose: () => void
}

export function DayAssignModal({ date, currentId, people, label, loading = false, onAssign, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number | null>(currentId)
  const [saving, setSaving] = useState(false)

  const filtered = people.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatted = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleSave() {
    setSaving(true)
    try {
      await onAssign(date, selected)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {label.toLowerCase()}</DialogTitle>
          <p className="text-sm text-muted-foreground">{formatted}</p>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}s…`}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {search ? 'No results' : `No unassigned ${label.toLowerCase()}s`}
            </div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted/50',
                  selected === p.id && 'bg-primary/10 font-medium'
                )}
              >
                <span>{p.name}</span>
                {p.subtitle && (
                  <span className="text-muted-foreground ml-2 text-xs">{p.subtitle}</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} disabled={selected === null}>
            Clear selection
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
