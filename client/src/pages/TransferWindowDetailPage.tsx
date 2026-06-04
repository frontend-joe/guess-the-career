import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, ExternalLink, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { ClubPicker } from '@/components/ClubPicker'
import { getTransferWindowDetail, updateTransferClubs, type TransferWindowDetail } from '@/api/transfer-history-admin'

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-700',
  DF: 'bg-blue-100 text-blue-700',
  MF: 'bg-green-100 text-green-700',
  FW: 'bg-orange-100 text-orange-700',
}

export function TransferWindowDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<TransferWindowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getTransferWindowDetail(Number(id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  const unlinked = data?.transfers.filter((t) => !t.linked).length ?? 0

  async function changeClub(transferId: number, side: 'from' | 'to', name: string) {
    const res = await updateTransferClubs(transferId, side === 'from' ? { from_club: name } : { to_club: name })
    setData((prev) =>
      prev
        ? {
            ...prev,
            transfers: prev.transfers.map((t) =>
              t.id === transferId
                ? {
                    ...t,
                    fromClub: res.fromClub,
                    fromClubWikipediaUrl: res.fromClubWikipediaUrl,
                    toClub: res.toClub,
                    toClubWikipediaUrl: res.toClubWikipediaUrl,
                  }
                : t,
            ),
          }
        : prev,
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/transfer-history')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">
          {data ? `${data.window.league} ${data.window.season_label}` : 'Transfer window'}
        </h1>
        {data && (
          <a href={data.window.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
            <span className="text-muted-foreground">{data.transfers.length} transfers (ordered by fee, as in the game)</span>
            {unlinked > 0 && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {unlinked} not linked to a footballer
              </span>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden divide-y">
            {data.transfers.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-white">
                <span className="w-4 shrink-0 flex items-center justify-center">
                  <NationalityFlag nationality={t.nationality} className="w-4 h-3.5 object-cover border border-[#ebebeb]" />
                </span>

                <span className={`text-xs font-semibold w-7 text-center py-0.5 rounded shrink-0 ${POSITION_COLORS[t.position ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t.position ?? '?'}
                </span>

                <span className="flex-1 min-w-0 text-sm font-medium truncate flex items-center gap-1.5">
                  {t.playerName}
                  {!t.linked && (
                    <span className="text-[10px] text-amber-600 font-normal" title="No footballer linked — won't have a flag/avatar in the game">unlinked</span>
                  )}
                </span>

                <span className="flex items-center gap-1 shrink-0">
                  <ClubPicker
                    onPick={(n) => changeClub(t.id, 'from', n)}
                    initialQuery={t.fromClub}
                    title="Change the club they left"
                    className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted max-w-40"
                  >
                    <span className="pointer-events-none flex items-center"><MiniClubBadge club={t.fromClub} wikipediaUrl={t.fromClubWikipediaUrl} size={18} /></span>
                    <span className="text-xs truncate">{t.fromClub}</span>
                  </ClubPicker>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <ClubPicker
                    onPick={(n) => changeClub(t.id, 'to', n)}
                    initialQuery={t.toClub}
                    title="Change the club they joined"
                    className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted max-w-40"
                  >
                    <span className="pointer-events-none flex items-center"><MiniClubBadge club={t.toClub} wikipediaUrl={t.toClubWikipediaUrl} size={18} /></span>
                    <span className="text-xs truncate">{t.toClub}</span>
                  </ClubPicker>
                </span>

                <span className="text-[11px] tabular-nums text-gray-500 shrink-0 w-16 text-right">{t.feeText}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
