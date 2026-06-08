import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, ExternalLink, AlertTriangle, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { ClubPicker } from '@/components/ClubPicker'
import { FootballerPicker } from '@/components/FootballerPicker'
import { getTransferWindowDetail, updateTransfer, resolvePlayer, type TransferWindowDetail } from '@/api/transfer-history-admin'

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

  const reload = useCallback(async () => {
    if (!id) return
    try {
      setData(await getTransferWindowDetail(Number(id)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [reload])

  const unlinked = data?.transfers.filter((t) => !t.linked).length ?? 0

  async function changeClub(transferId: number, side: 'from' | 'to', name: string) {
    await updateTransfer(transferId, side === 'from' ? { from_club: name } : { to_club: name })
    await reload()
  }

  async function linkFootballer(transferId: number, footballerId: number) {
    await updateTransfer(transferId, { footballer_id: footballerId })
    await reload()
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/transfer-history')}>
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

                <span className="flex-1 min-w-0 text-sm font-medium flex items-center gap-1.5">
                  <span className="truncate">{t.playerName}</span>
                  {!t.linked && (
                    <FootballerPicker
                      onPick={(fid) => linkFootballer(t.id, fid)}
                      scrape={(query) => resolvePlayer(query, t.toClub)}
                      initialQuery={t.playerName}
                      title="Link to an existing player, or scrape the correct name from Wikipedia"
                      className="inline-flex items-center gap-0.5 rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-amber-200 transition-colors shrink-0"
                    >
                      <Link2 className="h-3 w-3" /> link
                    </FootballerPicker>
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
