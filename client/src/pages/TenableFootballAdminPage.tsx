import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, CalendarDays, ChevronRight, Loader2, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTenableTypes, bulkSelectTenable, pruneTenableRounds, type TenableTypeCard } from '@/api/tenable'

// Football Tenable's question types. Each card opens a screen of every round
// of that type that currently has 10+ answers.
//
// This is the shape of admin a DERIVED category needs: the rounds already exist
// implicitly in the footballer data, and the job is to browse them and pick the
// good ones. An authored category (see TenableGeneralAdminPage) has nothing to
// browse, so it gets an editor instead.
export function TenableFootballAdminPage() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<TenableTypeCard[]>([])
  const [minAnswers, setMinAnswers] = useState(10)
  const [loading, setLoading] = useState(true)
  const [bulking, setBulking] = useState(false)

  function refresh() {
    return getTenableTypes().then(r => { setTypes(r.data); setMinAnswers(r.minAnswers) })
  }

  async function prune() {
    setBulking(true)
    try {
      const r = await pruneTenableRounds()
      await refresh()
      alert(`Pruned ${r.pruned} invalid round(s); ${r.unscheduled} schedule entr${r.unscheduled === 1 ? 'y' : 'ies'} cleared.`)
    } finally { setBulking(false) }
  }

  async function selectEverything(deselect = false) {
    setBulking(true)
    try { await bulkSelectTenable({ deselect }); await refresh() } finally { setBulking(false) }
  }

  useEffect(() => {
    getTenableTypes()
      .then(r => { setTypes(r.data); setMinAnswers(r.minAnswers) })
      .finally(() => setLoading(false))
  }, [])

  const totalAvailable = types.reduce((n, t) => n + t.available, 0)
  const totalSelected = types.reduce((n, t) => n + t.selected, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <button
            onClick={() => navigate('/admin/tenable')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Tenable categories
          </button>
          <h1 className="text-xl font-semibold">Football Tenable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Loading…'
              : `${totalAvailable} rounds available with ${minAnswers}+ answers · ${totalSelected} selected`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => selectEverything(false)} disabled={loading || bulking}>
            {bulking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Select all rounds
          </Button>
          <Button variant="ghost" size="sm" onClick={() => selectEverything(true)} disabled={loading || bulking}>
            Clear all
          </Button>
          <Button variant="ghost" size="sm" onClick={prune} disabled={loading || bulking}
            title="Remove selected rounds that no longer have 10+ answers">
            Prune invalid
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/tenable/schedule')}>
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            Schedule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Working out which rounds have enough answers…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {types.map(t => (
            <button
              key={t.slug}
              onClick={() => navigate(`/admin/tenable/football/${t.slug}`)}
              disabled={t.available === 0}
              className="group text-left rounded-xl border p-4 transition-colors hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-medium flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                    {t.label}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                  <p className="text-xs text-muted-foreground/80 mt-2 italic truncate">
                    e.g. “{t.example}”
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs">
                <span className={t.available === 0 ? 'text-muted-foreground' : 'font-medium'}>
                  {t.available} available
                </span>
                {t.selected > 0 && (
                  <span className="text-green-600 font-medium">{t.selected} selected</span>
                )}
                {t.available === 0 && (
                  <span className="text-muted-foreground">— needs more data</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
