import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { getFootballerCard, type FootballerCard, type CardStint } from '@/api/footballers'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { useShowPlayer } from '@/contexts/PlayerModalContext'

const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Relative')

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
  const totalInches = Math.round(cm / 2.54)
  const ft = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${(cm / 100).toFixed(2)} m (${ft} ft ${inches} in)`
}

// Wikipedia marks loan spells with a "→" arrow and/or a "(loan)" suffix, and
// trials with "(trial)". Split the raw club into a clean name + that tag.
function clubParts(club: string): { name: string; tag: "loan" | "trial" | null } {
  const isLoan = club.startsWith("→") || /\(loan\)/i.test(club)
  const isTrial = /\(trial\)/i.test(club)
  const name = club.replace(/^→\s*/, "").replace(/\s*\((loan|trial)\)/gi, "").trim()
  return { name, tag: isLoan ? "loan" : isTrial ? "trial" : null }
}

function appsGoals(s: CardStint): string {
  const apps = s.apps ?? 0
  return s.goals != null ? `${apps} (${s.goals})` : `${apps}`
}

function CareerTable({ title, stints, international }: { title: string; stints: CardStint[]; international?: boolean }) {
  if (stints.length === 0) return null
  return (
    <div>
      <div className="bg-gray-100 text-gray-700 text-left px-3 font-display text-sm tracking-tight py-1.5 border-y border-gray-200">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400">
            <th className="text-left font-medium px-3 py-1 w-16">Years</th>
            <th className="text-left font-medium px-1 py-1">Team</th>
            <th className="text-right font-medium px-3 py-1 whitespace-nowrap">{international ? 'Caps (Gls)' : 'Apps (Gls)'}</th>
          </tr>
        </thead>
        <tbody>
          {stints.map((s, i) => {
            const { name, tag } = clubParts(s.club)
            return (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-500 tabular-nums align-top whitespace-nowrap">{s.years}</td>
              <td className="px-1 py-1.5">
                <span className="flex items-center gap-1.5">
                  {tag === 'loan' && <span className="text-gray-500 shrink-0">→</span>}
                  {!international && tag !== 'loan' && <MiniClubBadge club={name} wikipediaUrl={s.club_wikipedia_url} size={16} />}
                  <span className="text-gray-800">
                    {name}
                    {tag && ` (${tag})`}
                  </span>
                </span>
              </td>
              <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums align-top">{appsGoals(s)}</td>
            </tr>
            )
          })}
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
  const showPlayer = useShowPlayer()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [card, setCard] = useState<FootballerCard | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (footballerId == null) return
    setMounted(true)
    setCard(null)
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
    <div className="fixed inset-0 z-80 flex items-stretch justify-center p-6 font-sans">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`relative z-10 w-full max-w-sm overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl transition-all duration-200 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-20 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto">
        {loading || !card ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : (
          <>
            {/* Name */}
            <h2 className="px-4 pt-4 pb-3 pr-12 font-display text-xl text-gray-900 leading-tight tracking-tight">
              {card.name}
            </h2>

            {/* Bio */}
            <table className="w-full text-sm">
              <tbody>
                <BioRow label="Full name" value={card.full_name} />
                <BioRow label="Date of birth" value={formatDob(card.born)} />
                <BioRow label="Birth place" value={card.birthplace} />
                <BioRow label="Height" value={formatHeight(card.height_cm)} />
                <BioRow label="Position" value={card.position ?? card.all_positions} />
              </tbody>
            </table>

            <div className="pb-2">
              <CareerTable title="Senior career" stints={senior} />
              <CareerTable title="International career" stints={intl} international />
            </div>

            {card.relations && card.relations.length > 0 && (
              <div className="pb-2">
                <div className="bg-gray-100 text-gray-700 text-left px-3 font-display text-sm tracking-tight py-1.5 border-y border-gray-200">
                  Relations
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {card.relations.map((r) => (
                      <tr key={r.footballerId} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500 w-28 align-top">{cap(r.relationship)}</td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => showPlayer(r.footballerId)}
                            className="text-gray-800 font-semibold text-left hover:underline"
                          >
                            {r.name}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
