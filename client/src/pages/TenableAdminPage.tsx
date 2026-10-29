import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CalendarDays, ChevronRight, Globe2, Loader2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTenableCategories, type TenableCategory } from '@/api/tenable'

// One board, one set of rules, more than one subject. A category is what tells
// two Tenable games apart — from this menu all the way down to which rounds a
// room is offered — and each one curates its rounds its own way, because where
// its rounds come from differs:
//
//   Football is DERIVED. Every round that could exist already exists implicitly
//   in the footballer database, so its admin browses that space and ticks the
//   ones worth playing.
//
//   Geography is AUTHORED. Nothing implies the ten longest rivers until somebody
//   writes them down, so its admin is an editor.
const ICONS: Record<string, typeof Trophy> = {
  football: Trophy,
  geography: Globe2,
}

export function TenableAdminPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<TenableCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTenableCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Tenable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a category to curate its rounds.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/tenable/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading categories…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map(cat => {
            const Icon = ICONS[cat.slug] ?? Trophy
            return (
              <button
                key={cat.slug}
                onClick={() => navigate(`/admin/tenable/${cat.slug}`)}
                className="group text-left rounded-xl border p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {cat.label}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="mt-3 text-xs font-medium">
                  {cat.rounds} round{cat.rounds === 1 ? '' : 's'} selected
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
