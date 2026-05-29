import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'

interface Player {
  id: number
  name: string
  photo_url: string | null
}

interface LocationState {
  clubWikiUrl?: string | null
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

export function NationalsAdminDetailPage() {
  const { nationality: natParam, club: clubParam } = useParams<{ nationality: string; club: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState

  const nationality = decodeURIComponent(natParam ?? '')
  const club = decodeURIComponent(clubParam ?? '')

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nationality || !club) return
    setLoading(true)
    fetch(`/api/nationals/answers?nationality=${encodeURIComponent(nationality)}&club=${encodeURIComponent(club)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setPlayers)
      .catch(() => setError('Failed to load players'))
      .finally(() => setLoading(false))
  }, [nationality, club])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/nationals')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Nationals
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <NationalityFlag nationality={nationality} size={20} />
          <span className="font-semibold">{nationality}</span>
        </div>
        <span className="text-muted-foreground text-sm">×</span>
        <div className="flex items-center gap-2">
          <MiniClubBadge club={club} wikipediaUrl={state.clubWikiUrl ?? null} />
          <span className="font-semibold">{club}</span>
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
