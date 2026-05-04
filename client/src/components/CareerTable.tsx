import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CareerStint } from '@/api/footballers'

type Stint = Omit<CareerStint, 'id' | 'footballer_id' | 'stint_type'> & { stint_type: string }

interface Props {
  stints: Stint[]
  editable?: boolean
  onChange?: (stints: Stint[]) => void
}

export function CareerTable({ stints, editable = false, onChange }: Props) {
  const [editing, setEditing] = useState<Record<number, Stint>>({})

  function update(index: number, field: keyof Stint, raw: string) {
    const updated = stints.map((s, i) => {
      if (i !== index) return s
      if (field === 'apps' || field === 'goals') {
        const n = parseInt(raw, 10)
        return { ...s, [field]: isNaN(n) ? null : n }
      }
      if (field === 'sort_order') return s
      return { ...s, [field]: raw }
    })
    onChange?.(updated)
  }

  function removeRow(index: number) {
    const updated = stints
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, sort_order: i }))
    onChange?.(updated)
  }

  function addRow() {
    const defaultType = stints[0]?.stint_type ?? 'senior'
    onChange?.([...stints, { sort_order: stints.length, years: '', club: '', apps: null, goals: null, stint_type: defaultType }])
  }

  function editingValue(index: number, field: keyof Stint): string {
    const s = editing[index] ?? stints[index]
    if (field === 'apps' || field === 'goals') {
      return s[field] !== null && s[field] !== undefined ? String(s[field]) : ''
    }
    return String(s[field] ?? '')
  }

  function handleFocus(index: number) {
    setEditing((prev) => ({ ...prev, [index]: { ...stints[index] } }))
  }

  function handleBlur(index: number) {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  if (stints.length === 0 && !editable) {
    return <p className="text-muted-foreground text-sm py-4">No career data available.</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="min-w-96 px-4 md:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Years</TableHead>
                <TableHead>Club</TableHead>
                <TableHead className="text-right">Apps</TableHead>
                <TableHead className="text-right">Goals</TableHead>
                <TableHead>Type</TableHead>
                {editable && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stints.map((stint, i) =>
                editable ? (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={editingValue(i, 'years')}
                        onFocus={() => handleFocus(i)}
                        onBlur={() => handleBlur(i)}
                        onChange={(e) => update(i, 'years', e.target.value)}
                        className="h-7 w-24 text-sm"
                        placeholder="1993–2017"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editingValue(i, 'club')}
                        onFocus={() => handleFocus(i)}
                        onBlur={() => handleBlur(i)}
                        onChange={(e) => update(i, 'club', e.target.value)}
                        className="h-7 text-sm"
                        placeholder="Club name"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        value={editingValue(i, 'apps')}
                        onFocus={() => handleFocus(i)}
                        onBlur={() => handleBlur(i)}
                        onChange={(e) => update(i, 'apps', e.target.value)}
                        className="h-7 w-16 ml-auto text-right text-sm"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        value={editingValue(i, 'goals')}
                        onFocus={() => handleFocus(i)}
                        onBlur={() => handleBlur(i)}
                        onChange={(e) => update(i, 'goals', e.target.value)}
                        className="h-7 w-16 ml-auto text-right text-sm"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={stint.stint_type}
                        onValueChange={(val) => update(i, 'stint_type', val)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="international">International</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{stint.years}</TableCell>
                    <TableCell>{stint.club}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stint.apps !== null ? stint.apps : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stint.goals !== null ? stint.goals : '—'}
                    </TableCell>
                    <TableCell>
                      {stint.stint_type === 'international' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          Intl
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {editable && (
        <Button variant="outline" size="sm" onClick={addRow} className="mt-1">
          <Plus className="h-4 w-4 mr-1" />
          Add row
        </Button>
      )}
    </div>
  )
}
