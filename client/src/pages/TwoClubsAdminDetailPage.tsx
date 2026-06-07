import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MiniClubBadge } from '@/components/MiniClubBadge'

interface Player {
  id: number
  name: string
  photo_url: string | null
}

interface LocationState {
  clubAWikiUrl?: string | null
  clubBWikiUrl?: string | null
}

function PlayerAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [imgFailed, setImgFailed] = useState(false)
  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
      {name.charAt(0)}
    </div>
  )
}

export function TwoClubsAdminDetailPage() {
  const { clubA: clubAParam, clubB: clubBParam } = useParams<{ clubA: string; clubB: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState

  const clubA = decodeURIComponent(clubAParam ?? '')
  const clubB = decodeURIComponent(clubBParam ?? '')

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clubA || !clubB) return
    setLoading(true)
    fetch(`/api/two-clubs/answers?clubA=${encodeURIComponent(clubA)}&clubB=${encodeURIComponent(clubB)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setPlayers)
      .catch(() => setError('Failed to load players'))
      .finally(() => setLoading(false))
  }, [clubA, clubB])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/admin/two-clubs')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Two Clubs
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <MiniClubBadge club={clubA} wikipediaUrl={state.clubAWikiUrl ?? null} />
          <span className="font-semibold">{clubA}</span>
        </div>
        <span className="text-muted-foreground text-sm">×</span>
        <div className="flex items-center gap-2">
          <MiniClubBadge club={clubB} wikipediaUrl={state.clubBWikiUrl ?? null} />
          <span className="font-semibold">{clubB}</span>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading players…
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">{players.length} players</p>
          <div className="space-y-1">
            {players.map(player => (
              <div key={player.id} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
                <PlayerAvatar name={player.name} photoUrl={player.photo_url} />
                <span className="text-sm">{player.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
