import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  scrapeXiMatch,
  createXiMatch,
  type MatchScrapeResult,
  type ScrapedXiPlayer,
  type ImportSummary,
} from '@/api/xi-matches'

type PageState = 'url' | 'preview' | 'importing' | 'summary'

type EditablePlayer = {
  name: string
  position: 'GK' | 'DF' | 'MF' | 'FW'
  squadNumber: number | null
  wikipediaUrl: string | null
  footballer_id: number | null | undefined
}

type PreviewState = {
  matchName: string
  year: number
  competition: string
  homeTeam: string
  awayTeam: string
  homePlayers: EditablePlayer[]
  awayPlayers: EditablePlayer[]
  wikipediaUrl: string
}

const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const

function fromScraped(p: ScrapedXiPlayer): EditablePlayer {
  return {
    name: p.name,
    position: p.position,
    squadNumber: p.squadNumber,
    wikipediaUrl: p.wikipediaUrl,
    footballer_id: p.footballer_id ?? null,
  }
}

export function AddXiMatchPage() {
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>('url')
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [createdMatchId, setCreatedMatchId] = useState<number | null>(null)
  const [homeTeamActive, setHomeTeamActive] = useState(true)
  const [awayTeamActive, setAwayTeamActive] = useState(true)

  async function handleScrape() {
    const trimmed = url.trim()
    if (!trimmed) return
    setScraping(true)
    setScrapeError(null)
    try {
      const result: MatchScrapeResult = await scrapeXiMatch(trimmed)
      setPreview({
        matchName: result.matchName,
        year: result.year,
        competition: result.competition,
        homeTeam: result.homeTeam,
        awayTeam: result.awayTeam,
        homePlayers: result.homePlayers.map(fromScraped),
        awayPlayers: result.awayPlayers.map(fromScraped),
        wikipediaUrl: trimmed,
      })
      setPageState('preview')
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  async function handleSave() {
    if (!preview) return
    setPageState('importing')
    try {
      const result = await createXiMatch({
        matchName: preview.matchName,
        wikipediaUrl: preview.wikipediaUrl,
        year: preview.year,
        competition: preview.competition,
        homeTeam: preview.homeTeam,
        awayTeam: preview.awayTeam,
        homePlayers: preview.homePlayers,
        awayPlayers: preview.awayPlayers,
        homeTeamActive,
        awayTeamActive,
      })
      setImportSummary(result.importSummary)
      setCreatedMatchId(result.match.id)
      setPageState('summary')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save match')
      setPageState('preview')
    }
  }

  function updateHomePlayer(i: number, field: keyof EditablePlayer, value: string | number | null) {
    if (!preview) return
    setPreview(prev => {
      if (!prev) return prev
      const players = [...prev.homePlayers]
      players[i] = { ...players[i], [field]: value }
      return { ...prev, homePlayers: players }
    })
  }

  function updateAwayPlayer(i: number, field: keyof EditablePlayer, value: string | number | null) {
    if (!preview) return
    setPreview(prev => {
      if (!prev) return prev
      const players = [...prev.awayPlayers]
      players[i] = { ...players[i], [field]: value }
      return { ...prev, awayPlayers: players }
    })
  }

  const canSave = preview &&
    preview.homePlayers.length === 11 &&
    preview.awayPlayers.length === 11 &&
    preview.homePlayers.every(p => p.name.trim()) &&
    preview.awayPlayers.every(p => p.name.trim())

  if (pageState === 'importing') {
    return (
      <div className="p-6 max-w-lg">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <div>
            <p className="font-medium">Saving match and importing players</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take up to 30 seconds while we scrape player data…
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'summary' && importSummary) {
    return (
      <div className="p-4 md:p-6 max-w-lg">
        <h1 className="text-xl font-semibold mb-6">Match imported</h1>

        <div className="space-y-3 mb-8">
          {importSummary.added.length > 0 && (
            <div className="flex gap-3 items-start p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 text-sm">{importSummary.added.length} new players imported</p>
                <p className="text-xs text-green-700 mt-0.5">{importSummary.added.join(', ')}</p>
              </div>
            </div>
          )}
          {importSummary.alreadyExisted.length > 0 && (
            <div className="flex gap-3 items-start p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 text-sm">{importSummary.alreadyExisted.length} players already in database</p>
                <p className="text-xs text-blue-700 mt-0.5">{importSummary.alreadyExisted.join(', ')}</p>
              </div>
            </div>
          )}
          {importSummary.failed.length > 0 && (
            <div className="flex gap-3 items-start p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">{importSummary.failed.length} players could not be imported</p>
                <p className="text-xs text-amber-700 mt-0.5">{importSummary.failed.join(', ')}</p>
              </div>
            </div>
          )}
        </div>

        <Button onClick={() => navigate(`/admin/elevens/${createdMatchId}`)}>
          View match
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => pageState === 'preview' ? setPageState('url') : navigate('/admin/elevens')}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-semibold">Add match</h1>
      </div>

      {pageState === 'url' && (
        <div className="max-w-lg space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Wikipedia URL</label>
            <p className="text-xs text-muted-foreground mb-2">
              Paste a Wikipedia URL for a football match (e.g. a UEFA Champions League final)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://en.wikipedia.org/wiki/2005_UEFA_Champions_League_final"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScrape()}
              />
              <Button onClick={handleScrape} disabled={scraping || !url.trim()}>
                {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scrape'}
              </Button>
            </div>
            {scrapeError && (
              <div className="flex gap-2 mt-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{scrapeError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {pageState === 'preview' && preview && (
        <div className="space-y-6">
          {/* Match metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Match name
              </label>
              <Input
                value={preview.matchName}
                onChange={e => setPreview(p => p ? { ...p, matchName: e.target.value } : p)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Year
              </label>
              <Input
                type="number"
                value={preview.year}
                onChange={e => setPreview(p => p ? { ...p, year: parseInt(e.target.value) || p.year } : p)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Competition
              </label>
              <Input
                value={preview.competition}
                onChange={e => setPreview(p => p ? { ...p, competition: e.target.value } : p)}
              />
            </div>
          </div>

          {/* Team panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamPanel
              teamName={preview.homeTeam}
              players={preview.homePlayers}
              active={homeTeamActive}
              onActiveChange={setHomeTeamActive}
              onTeamNameChange={name => setPreview(p => p ? { ...p, homeTeam: name } : p)}
              onPlayerChange={updateHomePlayer}
            />
            <TeamPanel
              teamName={preview.awayTeam}
              players={preview.awayPlayers}
              active={awayTeamActive}
              onActiveChange={setAwayTeamActive}
              onTeamNameChange={name => setPreview(p => p ? { ...p, awayTeam: name } : p)}
              onPlayerChange={updateAwayPlayer}
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={!canSave}>
              Save &amp; import players
            </Button>
            <Button variant="outline" onClick={() => setPageState('url')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamPanel({
  teamName,
  players,
  active,
  onActiveChange,
  onTeamNameChange,
  onPlayerChange,
}: {
  teamName: string
  players: EditablePlayer[]
  active: boolean
  onActiveChange: (v: boolean) => void
  onTeamNameChange: (name: string) => void
  onPlayerChange: (i: number, field: keyof EditablePlayer, value: string | number | null) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Input
          value={teamName}
          onChange={e => onTeamNameChange(e.target.value)}
          className="font-medium"
          placeholder="Team name"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer shrink-0" title="Enable in game & import players">
          <input
            type="checkbox"
            checked={active}
            onChange={e => onActiveChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Import
        </label>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-2 py-2 font-medium w-14">#</th>
              <th className="text-left px-2 py-2 font-medium w-16">Pos</th>
              <th className="text-left px-2 py-2 font-medium">Player</th>
              <th className="px-2 py-2 w-6" title="Footballer linked" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {players.map((p, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={p.squadNumber ?? ''}
                    onChange={e => onPlayerChange(i, 'squadNumber', e.target.value ? parseInt(e.target.value) : null)}
                    className="h-7 text-xs w-12 px-1.5"
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    value={p.position}
                    onChange={e => onPlayerChange(i, 'position', e.target.value)}
                    className="h-7 text-xs border rounded px-1 bg-background w-14"
                  >
                    {POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <Input
                    value={p.name}
                    onChange={e => onPlayerChange(i, 'name', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Player name"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  {p.footballer_id != null ? (
                    <span title="Linked to footballer" className="text-green-600">✓</span>
                  ) : (
                    <span title="Not linked" className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{players.filter(p => p.name.trim()).length} / 11 players</p>
    </div>
  )
}
