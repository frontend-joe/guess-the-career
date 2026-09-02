import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, AlertTriangle, CheckCircle2, Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { PositionBadge } from '@/components/PositionBadge'
import { FootballerPicker } from '@/components/FootballerPicker'
import {
  getRecordSigningsClubDetail,
  updateSigning,
  resolvePlayer,
  resolvePlayerByUrl,
  type RecordSigningsClubDetail,
} from '@/api/record-signings-admin'

export function RecordSigningsDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<RecordSigningsClubDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    try {
      setData(await getRecordSigningsClubDetail(Number(id)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [reload])

  // Link a signing to a footballer (chosen from the DB, or freshly scraped).
  async function linkPlayer(signingId: number, footballerId: number) {
    setBusyId(signingId)
    try {
      await updateSigning(signingId, { footballer_id: footballerId })
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  const unlinked = data?.signings.filter((t) => !t.linked).length ?? 0

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/record-signings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">
          {data ? data.club.club : 'Record signings'}
        </h1>
        {data && (
          <a href={data.club.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
            <span className="text-muted-foreground">{data.signings.length} signings (ordered by fee, as in the game)</span>
            {unlinked > 0 ? (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {unlinked} not linked — use “link” to fix each
              </span>
            ) : (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> all linked
              </span>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden divide-y">
            {data.signings.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-3 py-2 ${t.linked ? 'bg-white' : 'bg-amber-50'}`}
              >
                <span className="w-4 shrink-0 flex items-center justify-center">
                  <NationalityFlag nationality={t.nationality} className="w-4 h-3.5 object-cover border border-[#ebebeb]" />
                </span>

                <PositionBadge position={t.position} className="text-xs font-semibold w-7 text-center py-0.5" />

                <span className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{t.playerName}</span>
                  {t.linked ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : busyId === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
                  ) : (
                    <FootballerPicker
                      onPick={(fid) => linkPlayer(t.id, fid)}
                      scrape={(query) => resolvePlayer(query, t.fromClub)}
                      scrapeUrl={(u) => resolvePlayerByUrl(u)}
                      initialQuery={t.playerName}
                      title="Find this player in the database, or scrape the correct name / Wikipedia URL"
                      className="inline-flex items-center gap-0.5 rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-blue-200 transition-colors shrink-0"
                    >
                      <Link2 className="h-3 w-3" /> link
                    </FootballerPicker>
                  )}
                </span>

                <span className="flex items-center gap-1 shrink-0 max-w-40">
                  <MiniClubBadge club={t.fromClub} wikipediaUrl={t.fromClubWikipediaUrl} size={18} />
                  <span className="text-xs truncate">{t.fromClub}</span>
                </span>

                <span className="text-[11px] tabular-nums text-gray-500 shrink-0">{t.seasonLabel}</span>

                <span className="text-[11px] tabular-nums text-gray-500 shrink-0 w-16 text-right">{t.feeText}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
