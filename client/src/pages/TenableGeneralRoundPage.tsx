import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getGeneralRound,
  getGeneralRounds,
  saveGeneralRound,
  deleteGeneralRound,
  type GeneralAnswer,
  type GeneralTopic,
} from '@/api/tenable'

const BOARD_SIZE = 10

const blank = (): GeneralAnswer => ({ name: '', aliases: [], value: 0, display: null })

// The editor for one authored round. Writing a round IS creating it — there is
// no derivation to discover it — so this screen owns the question, how it is
// scored, and the answers themselves.
export function TenableGeneralRoundPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const isNew = slug === 'new'

  const [topics, setTopics] = useState<GeneralTopic[]>([])
  const [title, setTitle] = useState('')
  const [roundSlug, setRoundSlug] = useState('')
  const [topic, setTopic] = useState('countries')
  const [ordered, setOrdered] = useState(true)
  const [unit, setUnit] = useState('')
  const [answers, setAnswers] = useState<GeneralAnswer[]>(
    Array.from({ length: BOARD_SIZE }, blank),
  )
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getGeneralRounds().then(r => setTopics(r.topics)).catch(() => {}) }, [])

  useEffect(() => {
    if (isNew) return
    getGeneralRound(slug)
      .then(({ round, answers }) => {
        setTitle(round.title)
        setRoundSlug(round.slug)
        setTopic(round.topic)
        setOrdered(round.ordered)
        setUnit(round.unit ?? '')
        setAnswers(answers.length ? answers : Array.from({ length: BOARD_SIZE }, blank))
      })
      .catch(() => setError('Could not load that round'))
      .finally(() => setLoading(false))
  }, [slug, isNew])

  // A slug is derived from the title until somebody types one, so the common
  // case needs no thought and the awkward case is still reachable.
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const effectiveSlug = roundSlug.trim() || slugify(title)

  function patch(i: number, next: Partial<GeneralAnswer>) {
    setAnswers(a => a.map((row, j) => (j === i ? { ...row, ...next } : row)))
  }
  function move(i: number, by: number) {
    setAnswers(a => {
      const j = i + by
      if (j < 0 || j >= a.length) return a
      const copy = [...a]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  const filled = answers.filter(a => a.name.trim()).length

  async function save() {
    setError(null)
    if (!title.trim()) return setError('Give the round a question')
    if (!topic.trim()) return setError('Give the round a topic')
    if (!effectiveSlug) return setError('Give the round a slug')
    setSaving(true)
    try {
      const saved = await saveGeneralRound(isNew ? effectiveSlug : slug, {
        slug: effectiveSlug,
        topic: topic.trim().toLowerCase(),
        title: title.trim(),
        ordered,
        unit: unit.trim() || null,
        answers: answers.filter(a => a.name.trim()),
      })
      navigate(`/admin/tenable/general/${saved.slug}`, { replace: true })
      if (!isNew) setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete “${title}”? This removes the round and its answers.`)) return
    await deleteGeneralRound(slug)
    navigate('/admin/tenable/general')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading round…
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/admin/tenable/general')}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" />
        General rounds
      </button>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Question</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="The 10 longest rivers in the world"
            className="mt-1 text-base"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Topic</label>
            {/* Free text with suggestions, not a fixed list. A topic only
                groups rounds on the list screen, so a round about anything
                nobody has thought of yet should cost a word here rather than
                a release. */}
            <Input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              list="general-topics"
              placeholder="countries"
              className="mt-1"
            />
            <datalist id="general-topics">
              {topics.map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Board</label>
            <select
              value={ordered ? 'ranked' : 'any'}
              onChange={e => setOrdered(e.target.value === 'ranked')}
              className="mt-1 w-full h-9 text-sm border border-input rounded-md px-2 bg-background"
            >
              <option value="ranked">Ranked ten</option>
              <option value="any">Name any ten</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Unit</label>
            <Input
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="km"
              className="mt-1"
              disabled={!ordered}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Slug</label>
            <Input
              value={roundSlug}
              onChange={e => setRoundSlug(e.target.value)}
              placeholder={slugify(title) || 'rivers-longest'}
              className="mt-1 font-mono text-xs"
              disabled={!isNew}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {ordered
            ? 'A ranked ten: each answer reveals at its own place on the board, in the order below. Highest first.'
            : 'Name any ten: the board fills in the order players find them, so the list below can be as long as you like.'}
        </p>

        {/* ── Answers ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <span className="text-xs font-semibold">
              Answers · {filled} filled
              {filled < BOARD_SIZE && (
                <span className="text-amber-600 font-medium"> · needs {BOARD_SIZE - filled} more to be playable</span>
              )}
            </span>
            {ordered && (
              <button
                onClick={() => setAnswers(a => [...a].sort((x, y) => y.value - x.value))}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Sort by value, highest first"
              >
                <SortDesc className="h-3.5 w-3.5" />
                Sort by value
              </button>
            )}
          </div>
          <div className="divide-y">
            {answers.map((a, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2">
                <span className="w-5 shrink-0 pt-2 text-xs font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <Input
                    value={a.name}
                    onChange={e => patch(i, { name: e.target.value })}
                    placeholder="Answer"
                    className="sm:col-span-4 h-9"
                  />
                  <Input
                    value={a.aliases.join(', ')}
                    onChange={e => patch(i, {
                      aliases: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
                    })}
                    placeholder="Also accept: Huang He, Yellow"
                    className="sm:col-span-4 h-9 text-xs"
                  />
                  {ordered && (
                    <>
                      <Input
                        type="number"
                        value={a.value || ''}
                        onChange={e => patch(i, { value: Number(e.target.value) || 0 })}
                        placeholder="Value"
                        className="sm:col-span-2 h-9 text-xs tabular-nums"
                      />
                      <Input
                        value={a.display ?? ''}
                        onChange={e => patch(i, { display: e.target.value || null })}
                        placeholder="Badge"
                        className="sm:col-span-2 h-9 text-xs"
                      />
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === answers.length - 1}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setAnswers(x => x.filter((_, j) => j !== i))}
                    className="p-1 text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => setAnswers(a => [...a, blank()])}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add answer
            </Button>
          </div>
        </div>

        {ordered && (
          <p className="text-xs text-muted-foreground">
            <strong>Value</strong> orders the board. <strong>Badge</strong> is what shows next to the
            answer — “6,650”, “17.1m” — because one formatting rule cannot serve river kilometres and
            country populations at once. Leave it blank to show the raw number.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            {isNew ? 'Create round' : 'Save changes'}
          </Button>
          {!isNew && (
            <Button variant="ghost" size="sm" onClick={remove} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
