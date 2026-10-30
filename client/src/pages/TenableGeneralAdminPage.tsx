import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Archive, ChevronRight, Loader2, Plus, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteGeneralRound, getGeneralRounds, type GeneralRound, type GeneralTopic } from '@/api/tenable'

// Every authored round, grouped by subject. Unlike football's screens there is
// nothing to browse and tick: a round exists because somebody wrote it, so this
// is a list of what has been written and a button to write another.
export function TenableGeneralAdminPage() {
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<GeneralRound[]>([])
  const [topics, setTopics] = useState<GeneralTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGeneralRounds()
      .then(r => { setRounds(r.data); setTopics(r.topics) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // A topic is free text, so most have no suggested label to look up — show
  // what was typed, tidied, rather than nothing.
  const labelFor = (slug: string) =>
    topics.find(t => t.slug === slug)?.label ?? slug.charAt(0).toUpperCase() + slug.slice(1)
  const byTopic = [...new Set(rounds.map(r => r.topic))].sort()

  // Deleting from the list rather than only from inside the editor: curating a
  // hundred rounds means throwing some away, and opening each one to do it is
  // three navigations for a decision you already made from the title.
  async function remove(round: GeneralRound) {
    const played = round.games > 0
    const question = played
      ? `“${round.title}” has been played in ${round.games} game${round.games === 1 ? '' : 's'}.\n\n`
        + 'It will be retired — taken out of the list hosts pick from, but kept on file, '
        + 'because those games point at it. Carry on?'
      : `Delete “${round.title}”? This removes the round and its ${round.answerCount} answer${round.answerCount === 1 ? '' : 's'}.`
    if (!confirm(question)) return

    setBusy(round.slug); setError(null); setNote(null)
    try {
      const result = await deleteGeneralRound(round.slug)
      if (result.retired) {
        setRounds(rs => rs.map(r => (r.slug === round.slug ? { ...r, retired: true } : r)))
        setNote(`“${round.title}” is retired. Hosts will not see it; open it and save to bring it back.`)
      } else {
        setRounds(rs => rs.filter(r => r.slug !== round.slug))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that round')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <button
            onClick={() => navigate('/admin/tenable')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Tenable categories
          </button>
          <h1 className="text-xl font-semibold">General Tenable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${rounds.length} round${rounds.length === 1 ? '' : 's'} across ${byTopic.length} topic${byTopic.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/tenable/general/new')}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New round
        </Button>
      </div>

      {note && (
        <p className="text-sm text-muted-foreground bg-muted/50 border rounded-lg px-3 py-2 mb-4">
          {note}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rounds…
        </div>
      ) : rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          No rounds yet. Start one with “New round”.
        </p>
      ) : (
        <div className="space-y-5">
          {byTopic.map(topic => (
            <section key={topic}>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                {labelFor(topic)}
              </h2>
              <div className="rounded-xl border divide-y">
                {rounds.filter(r => r.topic === topic).map(r => (
                  <div
                    key={r.slug}
                    className="group flex items-center hover:bg-muted/40 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <button
                      onClick={() => navigate(`/admin/tenable/general/${r.slug}`)}
                      className="min-w-0 flex-1 text-left pl-4 py-3 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${r.retired ? 'text-muted-foreground line-through' : ''}`}>
                          {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.answerCount} answer{r.answerCount === 1 ? '' : 's'}
                          {' · '}
                          {r.ordered ? `ranked${r.unit ? ` by ${r.unit}` : ''}` : 'name any ten'}
                          {' · '}
                          <span className="font-mono">{r.slug}</span>
                        </p>
                      </div>
                      {/* Retired, not gone: a game was played from it, so the
                          registry row has to stay for that game to know what
                          question it was. */}
                      {r.retired && (
                        <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <Archive className="h-3.5 w-3.5" />
                          Retired
                        </span>
                      )}
                      {/* A round with fewer than ten answers cannot be played:
                          the multiplayer freeze refuses a board it cannot fill. */}
                      {!r.retired && r.answerCount < 10 && (
                        <span className="shrink-0 flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Needs {10 - r.answerCount} more
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    {/* Quiet until the row is under the cursor, because a column
                        of red bins down a list of a hundred rounds reads as a
                        warning about the rounds rather than a thing you can do.
                        Always visible on touch, which has no hover to offer. */}
                    {!r.retired && (
                      <button
                        onClick={() => remove(r)}
                        disabled={busy === r.slug}
                        aria-label={`Delete ${r.title}`}
                        title={r.games > 0 ? `Played in ${r.games} game${r.games === 1 ? '' : 's'} — will be retired` : 'Delete this round'}
                        className="shrink-0 px-4 py-3 text-muted-foreground hover:text-red-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {busy === r.slug
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
