import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Globe, Pencil, Check, X, RefreshCw, Loader2 } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CareerTable } from '@/components/CareerTable'
import {
  getManager,
  updateManager,
  updateManagerStints,
  scrapeManagerWikipedia,
  type ManagerWithStints,
  type ManagerCareerStint,
} from '@/api/managers'


type EditMeta = {
  name: string
  place_of_birth: string
  born: string
  photo_url: string
}

type Stint = Omit<ManagerCareerStint, 'id' | 'manager_id'>

export function ManagerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [manager, setManager] = useState<ManagerWithStints | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState<EditMeta>({ name: '', place_of_birth: '', born: '', photo_url: '' })
  const [savingMeta, setSavingMeta] = useState(false)
  const [editingCareer, setEditingCareer] = useState(false)
  const [stints, setStints] = useState<Stint[]>([])
  const [savingStints, setSavingStints] = useState(false)
  const [rescraping, setRescraping] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getManager(parseInt(id))
      .then((m) => {
        setManager(m)
        setStints(m.stints.map(({ id: _id, manager_id: _mid, ...rest }) => rest))
        setMeta({
          name: m.name,
          place_of_birth: m.place_of_birth ?? '',
          born: m.born ?? '',
          photo_url: m.photo_url ?? '',
        })
      })
      .catch(() => navigate('/admin/managers'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function saveMeta() {
    if (!manager) return
    setSavingMeta(true)
    try {
      const updated = await updateManager(manager.id, {
        name: meta.name || undefined,
        place_of_birth: meta.place_of_birth || null,
        born: meta.born || null,
        photo_url: meta.photo_url || null,
      })
      setManager({ ...manager, ...updated })
      setEditingMeta(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingMeta(false)
    }
  }

  async function saveStints() {
    if (!manager) return
    setSavingStints(true)
    try {
      const updated = await updateManagerStints(manager.id, stints.map((s, i) => ({ ...s, sort_order: i })))
      setManager({ ...manager, stints: updated })
      setStints(updated.map(({ id: _id, manager_id: _mid, ...rest }) => rest))
      setEditingCareer(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save career')
    } finally {
      setSavingStints(false)
    }
  }

  async function handleRescrape() {
    if (!manager) return
    if (!confirm('Re-scrape Wikipedia? This will replace the current career data after review.')) return
    setRescraping(true)
    try {
      const result = await scrapeManagerWikipedia(manager.wikipedia_url)
      setStints(result.stints)
      setEditingCareer(true)
      alert('Career data re-scraped. Review the changes below and click "Save career" to apply.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Re-scrape failed')
    } finally {
      setRescraping(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!manager) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate('/admin/managers')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <PlayerAvatar id={manager.id} name={manager.name} wikipediaUrl={manager.wikipedia_url} storedPhotoUrl={manager.photo_url} size="md" variant="admin" className="shrink-0" />
          <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{manager.name}</h1>
          <a
            href={manager.wikipedia_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            Wikipedia
          </a>
          </div>
        </div>
        {!editingMeta && (
          <Button variant="outline" size="sm" onClick={() => setEditingMeta(true)} className="shrink-0">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Edit details</span>
            <span className="sm:hidden">Edit</span>
          </Button>
        )}
      </div>

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
            { key: 'place_of_birth', label: 'Place of birth' },
            { key: 'born', label: 'Born' },
            { key: 'photo_url', label: 'Photo URL' },
          ] as const).map(({ key, label }) => (
            <div key={key} className={key === 'photo_url' ? 'sm:col-span-2' : ''}>
              <label className="text-xs text-muted-foreground block mb-1">{label}</label>
              {editingMeta ? (
                <Input
                  value={meta[key]}
                  onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
                />
              ) : (
                <p className="text-sm truncate">{manager[key] ?? <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Managerial career ({manager.stints.length} stints)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={handleRescrape} disabled={rescraping}>
              {rescraping
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Re-scrape
            </Button>
            {editingCareer ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => {
                  setStints(manager.stints.map(({ id: _id, manager_id: _mid, ...rest }) => rest))
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
