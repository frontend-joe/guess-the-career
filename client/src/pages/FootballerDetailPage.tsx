import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Globe, Pencil, Check, X, Loader2 } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { RescrapeButton } from '@/components/RescrapeButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CareerTable } from '@/components/CareerTable'
import {
  getFootballer,
  updateFootballer,
  updateStints,
  rescrapeFootballer,
  type FootballerWithStints,
  type CareerStint,
} from '@/api/footballers'


type EditMeta = {
  name: string
  nationality: string
  position: string
  all_positions: string
  born: string
  height_cm: string
  photo_url: string
}

type Stint = Omit<CareerStint, 'id' | 'footballer_id'>

export function FootballerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [footballer, setFootballer] = useState<FootballerWithStints | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState<EditMeta>({ name: '', nationality: '', position: '', all_positions: '', born: '', height_cm: '', photo_url: '' })
  const [savingMeta, setSavingMeta] = useState(false)
  const [editingCareer, setEditingCareer] = useState(false)
  const [stints, setStints] = useState<Stint[]>([])
  const [savingStints, setSavingStints] = useState(false)
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getFootballer(parseInt(id))
      .then((f) => {
        setFootballer(f)
        setStints(f.stints.map(({ id: _id, footballer_id: _fid, ...rest }) => rest))
        setMeta({
          name: f.name,
          nationality: f.nationality ?? '',
          position: f.position ?? '',
          all_positions: f.all_positions ?? '',
          born: f.born ?? '',
          height_cm: f.height_cm?.toString() ?? '',
          photo_url: f.photo_url ?? '',
        })
      })
      .catch(() => navigate('/footballers'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function saveMeta() {
    if (!footballer) return
    setSavingMeta(true)
    try {
      const updated = await updateFootballer(footballer.id, {
        name: meta.name || undefined,
        nationality: meta.nationality || null,
        position: meta.position || null,
        all_positions: meta.all_positions || null,
        born: meta.born || null,
        height_cm: meta.height_cm ? parseInt(meta.height_cm) : null,
        photo_url: meta.photo_url || null,
      })
      setFootballer({ ...footballer, ...updated })
      setEditingMeta(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingMeta(false)
    }
  }

  async function saveStints() {
    if (!footballer) return
    setSavingStints(true)
    try {
      const updated = await updateStints(footballer.id, stints.map((s, i) => ({ ...s, sort_order: i })))
      setFootballer({ ...footballer, stints: updated })
      setStints(updated.map(({ id: _id, footballer_id: _fid, ...rest }) => rest))
      setEditingCareer(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save career')
    } finally {
      setSavingStints(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!footballer) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate('/footballers')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <PlayerAvatar id={footballer.id} name={footballer.name} wikipediaUrl={footballer.wikipedia_url} storedPhotoUrl={footballer.photo_url} size="md" variant="admin" className="shrink-0" />
          <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{footballer.name}</h1>
          <a
            href={footballer.wikipedia_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            Wikipedia
          </a>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <RescrapeButton
            onRescrape={async () => {
              const { footballer: updated, stints: updatedStints } = await rescrapeFootballer(footballer!.id)
              setFootballer({ ...updated, stints: updatedStints })
              setStints(updatedStints.map(({ id: _id, footballer_id: _fid, ...rest }) => rest))
              setMeta({ name: updated.name, nationality: updated.nationality ?? '', position: updated.position ?? '', all_positions: updated.all_positions ?? '', born: updated.born ?? '', height_cm: updated.height_cm?.toString() ?? '', photo_url: updated.photo_url ?? '' })
            }}
          />
          {!editingMeta && (
            <Button variant="outline" size="sm" onClick={() => setEditingMeta(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Edit details</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Details</h2>
          {editingMeta && (
            <div className="flex gap-1.5 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setEditingMeta(false)} disabled={savingMeta}>
                <X className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button size="sm" onClick={saveMeta} disabled={savingMeta}>
                {savingMeta
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" />
                  : <Check className="h-3.5 w-3.5 sm:mr-1" />}
                <span className="hidden sm:inline">Save</span>
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { key: 'name', label: 'Name' },
            { key: 'nationality', label: 'Nationality' },
            { key: 'position', label: 'Position' },
            { key: 'all_positions', label: 'All Positions' },
            { key: 'born', label: 'Born' },
            { key: 'photo_url', label: 'Photo URL' },
          ] as const).map(({ key, label }) => (
            <div key={key} className={key === 'photo_url' || key === 'all_positions' ? 'sm:col-span-2' : ''}>
              <label className="text-xs text-muted-foreground block mb-1">{label}</label>
              {editingMeta ? (
                <Input
                  value={meta[key]}
                  onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
                />
              ) : (
                <p className="text-sm truncate">{footballer[key] ?? <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>
          ))}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Height</label>
            {editingMeta ? (
              <Input
                value={meta.height_cm}
                onChange={(e) => setMeta({ ...meta, height_cm: e.target.value })}
                placeholder="e.g. 178"
                type="number"
              />
            ) : (
              <p className="text-sm">{footballer.height_cm ? `${footballer.height_cm} cm` : <span className="text-muted-foreground">—</span>}</p>
            )}
          </div>
        </div>
      </div>

      {/* Career */}
      <div className="border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Career ({footballer.stints.length} stints)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {editingCareer ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => {
                  setStints(footballer.stints.map(({ id: _id, footballer_id: _fid, ...rest }) => rest))
                  setEditingCareer(false)
                }}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveStints} disabled={savingStints}>
                  {savingStints
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <Check className="h-3.5 w-3.5 mr-1" />}
                  Save career
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingCareer(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit career
              </Button>
            )}
          </div>
        </div>
        <CareerTable
          stints={stints}
          editable={editingCareer}
          onChange={s => setStints(s as Stint[])}
        />
      </div>
    </div>
  )
}
