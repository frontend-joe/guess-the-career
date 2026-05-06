import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Globe, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getXiMatch,
  updateXiMatch,
  replaceMatchPlayers,
  type XiMatchDetail,
  type XiPlayer,
  type ScrapedXiPlayer,
} from '@/api/xi-matches'

const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-800',
  DF: 'bg-blue-100 text-blue-800',
  MF: 'bg-green-100 text-green-800',
  FW: 'bg-orange-100 text-orange-800',
}

type EditMeta = {
  name: string
  year: string
  competition: string
  home_team: string
  away_team: string
}

type EditablePlayer = {
  id: number
  name: string
  position: 'GK' | 'DF' | 'MF' | 'FW'
  squadNumber: number | null
  footballerId: number | null
}

function toEditable(p: XiPlayer): EditablePlayer {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    squadNumber: p.squad_number,
    footballerId: p.footballer_id,
  }
}

export function XiMatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<XiMatchDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Metadata edit state
  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState<EditMeta>({ name: '', year: '', competition: '', home_team: '', away_team: '' })
  const [savingMeta, setSavingMeta] = useState(false)

  // Lineup edit state
  const [editingLineup, setEditingLineup] = useState(false)
  const [homePlayers, setHomePlayers] = useState<EditablePlayer[]>([])
  const [awayPlayers, setAwayPlayers] = useState<EditablePlayer[]>([])
  const [savingLineup, setSavingLineup] = useState(false)

  useEffect(() => {
    if (!id) return
    getXiMatch(parseInt(id))
      .then(d => {
        setData(d)
        setMeta({
          name: d.match.name,
          year: String(d.match.year),
          competition: d.match.competition,
          home_team: d.match.home_team,
          away_team: d.match.away_team,
        })
        setHomePlayers(d.homePlayers.map(toEditable))
        setAwayPlayers(d.awayPlayers.map(toEditable))
      })
      .catch(() => navigate('/elevens'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function saveMeta() {
    if (!data) return
    setSavingMeta(true)
    try {
      const updated = await updateXiMatch(data.match.id, {
        name: meta.name,
        year: parseInt(meta.year),
        competition: meta.competition,
        home_team: meta.home_team,
        away_team: meta.away_team,
      })
      setData({ ...data, match: updated })
      setEditingMeta(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingMeta(false)
    }
  }

  async function saveLineup() {
    if (!data) return
    setSavingLineup(true)
    try {
      const toScraped = (p: EditablePlayer): ScrapedXiPlayer => ({
        name: p.name,
        position: p.position,
        squadNumber: p.squadNumber,
        wikipediaUrl: null,
        footballer_id: p.footballerId,
      })
      await replaceMatchPlayers(data.match.id, homePlayers.map(toScraped), awayPlayers.map(toScraped))
      // Refresh
      const fresh = await getXiMatch(data.match.id)
      setData(fresh)
      setHomePlayers(fresh.homePlayers.map(toEditable))
      setAwayPlayers(fresh.awayPlayers.map(toEditable))
      setEditingLineup(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save lineup')
    } finally {
      setSavingLineup(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  if (!data) return null

  const { match } = data

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/elevens')}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{match.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{match.year}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{match.competition}</span>
          </div>
        </div>
        <a
          href={match.wikipedia_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
          title="Wikipedia"
        >
          <Globe className="h-4 w-4" />
        </a>
      </div>

      {/* Metadata block */}
      <div className="rounded-lg border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Match details</h2>
          {!editingMeta ? (
            <button onClick={() => setEditingMeta(true)} className="p-1 rounded hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={saveMeta}
                disabled={savingMeta}
                className="p-1 rounded hover:bg-muted transition-colors text-green-600"
              >
                {savingMeta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => {
                  setEditingMeta(false)
                  setMeta({ name: match.name, year: String(match.year), competition: match.competition, home_team: match.home_team, away_team: match.away_team })
                }}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {editingMeta ? (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-0.5 block">Match name</label>
                <Input value={meta.name} onChange={e => setMeta(m => ({ ...m, name: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">Year</label>
                <Input type="number" value={meta.year} onChange={e => setMeta(m => ({ ...m, year: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">Competition</label>
                <Input value={meta.competition} onChange={e => setMeta(m => ({ ...m, competition: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">Home team</label>
                <Input value={meta.home_team} onChange={e => setMeta(m => ({ ...m, home_team: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-0.5 block">Away team</label>
                <Input value={meta.away_team} onChange={e => setMeta(m => ({ ...m, away_team: e.target.value }))} className="h-8 text-sm" />
              </div>
            </>
          ) : (
            <>
              <div><span className="text-muted-foreground">Year </span>{match.year}</div>
              <div><span className="text-muted-foreground">Competition </span>{match.competition}</div>
              <div className="sm:col-span-2 border-t pt-3 mt-1">
                <p className="text-xs text-muted-foreground mb-2">Available in game</p>
                <div className="flex flex-col gap-2">
                  {([
                    { label: match.home_team, field: 'home_team_active' as const, active: match.home_team_active },
                    { label: match.away_team, field: 'away_team_active' as const, active: match.away_team_active },
                  ] as const).map(({ label, field, active }) => (
                    <label key={field} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm">{label}</span>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={async e => {
                          const updated = await updateXiMatch(match.id, { [field]: e.target.checked })
                          setData(d => d ? { ...d, match: updated } : d)
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lineup panels */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">Lineups</h2>
        {!editingLineup ? (
          <button onClick={() => setEditingLineup(true)} className="p-1 rounded hover:bg-muted transition-colors">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={saveLineup} disabled={savingLineup}>
              {savingLineup ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Save lineup
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingLineup(false)
                if (data) {
                  setHomePlayers(data.homePlayers.map(toEditable))
                  setAwayPlayers(data.awayPlayers.map(toEditable))
                }
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineupPanel
          teamName={match.home_team}
          players={editingLineup ? homePlayers : data.homePlayers.map(toEditable)}
          editing={editingLineup}
          onPlayerChange={(i, field, value) => {
            setHomePlayers(prev => {
              const next = [...prev]
              next[i] = { ...next[i], [field]: value }
              return next
            })
          }}
        />
        <LineupPanel
          teamName={match.away_team}
          players={editingLineup ? awayPlayers : data.awayPlayers.map(toEditable)}
          editing={editingLineup}
          onPlayerChange={(i, field, value) => {
            setAwayPlayers(prev => {
              const next = [...prev]
              next[i] = { ...next[i], [field]: value }
              return next
            })
          }}
        />
      </div>
    </div>
  )
}

function LineupPanel({
  teamName,
  players,
  editing,
  onPlayerChange,
}: {
  teamName: string
  players: EditablePlayer[]
  editing: boolean
  onPlayerChange: (i: number, field: string, value: string | number | null) => void
}) {
  return (
    <div>
      <h3 className="font-medium mb-2 text-sm">{teamName}</h3>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-12">#</th>
              <th className="text-left px-3 py-2 font-medium w-14">Pos</th>
              <th className="text-left px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 w-6 text-right text-muted-foreground">🔗</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {players.map((p, i) => (
              <tr key={p.id} className={editing ? '' : 'hover:bg-muted/20'}>
                <td className="px-2 py-1.5">
                  {editing ? (
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={p.squadNumber ?? ''}
                      onChange={e => onPlayerChange(i, 'squadNumber', e.target.value ? parseInt(e.target.value) : null)}
                      className="h-7 text-xs w-11 px-1.5"
                    />
                  ) : (
                    <span className="text-muted-foreground tabular-nums">{p.squadNumber ?? '—'}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={p.position}
                      onChange={e => onPlayerChange(i, 'position', e.target.value)}
                      className="h-7 text-xs border rounded px-1 bg-background w-14"
                    >
                      {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${POSITION_COLORS[p.position] ?? ''}`}>
                      {p.position}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {editing ? (
                    <Input
                      value={p.name}
                      onChange={e => onPlayerChange(i, 'name', e.target.value)}
                      className="h-7 text-xs"
                    />
                  ) : (
                    p.name
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {p.footballerId != null
                    ? <span className="text-green-600 text-xs">✓</span>
                    : <span className="text-muted-foreground text-xs">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
