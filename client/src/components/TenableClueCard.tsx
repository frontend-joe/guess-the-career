import { useEffect, useState } from 'react'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { PositionBadge } from '@/components/PositionBadge'
import type { TenableClue } from '@/api/tenable'

// Long-press hint for an unsolved slot. Only shows clues the question hasn't
// already given away (`implied`).
export function TenableClueCard({
  rank, clue, implied, onClose,
}: {
  rank: number
  clue: TenableClue | null
  implied: string[]
  onClose: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 10)
    return () => clearTimeout(t)
  }, [])

  const show = (k: string) => !implied.includes(k)
  const bits: React.ReactNode[] = []
  if (clue?.nationality && show('nationality')) {
    bits.push(
      <span key="nat" className="flex items-center gap-1.5">
        <NationalityFlag nationality={clue.nationality} size={18} />
        <span>{clue.nationality}</span>
      </span>,
    )
  }
  if (clue?.position) bits.push(<PositionBadge key="pos" position={clue.position} />)
  if (clue?.club && show('club')) {
    bits.push(
      <span key="club" className="flex items-center gap-1.5">
        <MiniClubBadge club={clue.club} wikipediaUrl={clue.clubWikiUrl} />
        <span>{clue.club}</span>
      </span>,
    )
  }
  if (clue?.years) bits.push(<span key="yrs" className="tabular-nums">{clue.years}</span>)
  if (clue?.squadNumber != null) {
    bits.push(
      <span key="num" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/10 px-1.5 text-xs font-bold tabular-nums">
        #{clue.squadNumber}
      </span>,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl transition-all duration-200 ease-out ${
          shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
          Clue · number {rank}
        </p>
        {bits.length ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-gray-800">
            {bits}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No clues available for this one.</p>
        )}
      </div>
    </div>
  )
}
