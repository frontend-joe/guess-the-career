import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { getFootballerCard, type FootballerCard, type CardStint } from '@/api/footballers'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'

function formatDob(born: string | null): string | null {
  if (!born) return null
  const m = born.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return born
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (isNaN(d.getTime())) return born
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatHeight(cm: number | null): string | null {
  if (!cm) return null
  return `${(cm / 100).toFixed(2)} m`
}

function appsGoals(s: CardStint): string {
  const apps = s.apps ?? 0
  return s.goals != null ? `${apps} (${s.goals})` : `${apps}`
}

function CareerTable({ title, stints }: { title: string; stints: CardStint[] }) {
  if (stints.length === 0) return null
  return (
    <div>
      <div className="bg-gray-100 text-gray-700 text-center text-xs font-bold uppercase tracking-wider py-1.5 border-y border-gray-200">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400">
            <th className="text-left font-medium px-3 py-1 w-16">Years</th>
            <th className="text-left font-medium px-1 py-1">Team</th>
            <th className="text-right font-medium px-3 py-1 whitespace-nowrap">Apps (Gls)</th>
          </tr>
        </thead>
        <tbody>
          {stints.map((s, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-500 tabular-nums align-top">{s.years}</td>
              <td className="px-1 py-1.5">
                <span className="flex items-center gap-1.5">
                  <MiniClubBadge club={s.club} wikipediaUrl={s.club_wikipedia_url} size={16} />
                  <span className="text-gray-800">{s.club.replace(/^→\s*/, '')}</span>
                </span>
              </td>
              <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums align-top">{appsGoals(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BioRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <tr className="border-t border-gray-100 align-top">
      <th className="text-left font-semibold text-gray-500 px-3 py-1.5 w-28">{label}</th>
      <td className="px-3 py-1.5 text-gray-800">{value}</td>
    </tr>
  )
}

export function PlayerInfoModal({ footballerId, onClose }: { footballerId: number | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [card, setCard] = useState<FootballerCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    if (footballerId == null) return
    setMounted(true)
    setCard(null)
    setImgFailed(false)
    setLoading(true)
    requestAnimationFrame(() => setVisible(true))
    getFootballerCard(footballerId)
      .then(setCard)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [footballerId])

  function close() {
    setVisible(false)
    setTimeout(() => { setMounted(false); onClose() }, 200)
  }

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null

  const senior = card?.stints.filter(s => s.stint_type === 'senior') ?? []
  const intl = card?.stints.filter(s => s.stint_type === 'international') ?? []

  return createPortal(
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 font-ui">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`relative z-10 w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-white rounded-2xl shadow-2xl transition-all duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1 transition-colors"
        >
          <X size={18} />
        </button>

        {loading || !card ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-[#0b0c1a] text-white px-4 pt-5 pb-4 flex flex-col items-center gap-3">
              {card.photo_url && !imgFailed ? (
                <img
                  src={card.photo_url}
                  alt={card.name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-white/15"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-white/60">
                  {card.name.charAt(0)}
                </div>
              )}
              <div className="text-center">
                <h2 className="font-display text-lg leading-tight tracking-tight flex items-center justify-center gap-2">
                  {card.name}
                  {card.nationality && <NationalityFlag nationality={card.nationality} size={16} />}
                </h2>
              </div>
            </div>

            {/* Bio */}
            <table className="w-full text-sm">
              <tbody>
                <BioRow label="Full name" value={card.full_name} />
                <BioRow label="Date of birth" value={formatDob(card.born)} />
                <BioRow label="Place of birth" value={card.birthplace} />
                <BioRow label="Height" value={formatHeight(card.height_cm)} />
                <BioRow label="Position" value={card.all_positions ?? card.position} />
              </tbody>
            </table>

            <div className="pb-2">
              <CareerTable title="Senior career" stints={senior} />
              <CareerTable title="International career" stints={intl} />
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
