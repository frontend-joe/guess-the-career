// A thin client for Perplexity's Agent API, which is how we ask the open web
// questions we cannot answer from our own tables — right now, what the other
// "guess the player" games are doing.
//
// Note the endpoint: the old /chat/completions Sonar API now 403s with a
// migration notice. The Agent API at /v1/responses takes no model name at all;
// Perplexity routes to whichever model fits and reports the one it picked in
// the response. We choose how hard it should work with `effort` instead.
//
// Everything here is read-only and costs money per call, so nothing in the
// request path uses it — it exists for the scripts under src/scripts.

const ENDPOINT = 'https://api.perplexity.ai/v1/responses'

// Perplexity's own ladder, cheapest first. 'medium' is the useful default for
// research: 'fast' skips most of the searching, 'high' and above are slow
// enough to time out a terminal you are watching.
export type Effort = 'fast' | 'low' | 'medium' | 'high' | 'xhigh'

export interface Source {
  title: string
  url: string
  date: string | null
}

export interface Answer {
  text: string
  sources: Source[]
  /** Which model Perplexity routed the question to, for the report footer. */
  model: string
}

export class PerplexityError extends Error {}

function apiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY?.trim()
  if (!key) {
    throw new PerplexityError(
      'PERPLEXITY_API_KEY is unset. It lives in server/.env — run this through ' +
        'a script that passes --env-file=.env.',
    )
  }
  return key
}

interface ResponseBody {
  model?: string
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
    results?: Array<{ title?: string; url?: string; date?: string | null }>
  }>
}

// The answer arrives as a list of output items: search_results items carry the
// citations, and the (usually last) message item carries the prose. We keep
// both, because an answer about a competitor is only worth as much as the page
// it came from.
function parse(body: ResponseBody): Answer {
  const output = body.output ?? []

  const text = output
    .filter(item => item.type === 'message')
    .flatMap(item => item.content ?? [])
    .filter(part => part.type === 'output_text')
    .map(part => part.text ?? '')
    .join('\n')
    .trim()

  const seen = new Set<string>()
  const sources: Source[] = []
  for (const item of output) {
    for (const result of item.results ?? []) {
      const url = result.url?.trim()
      if (!url || seen.has(url)) continue
      seen.add(url)
      sources.push({ title: result.title?.trim() || url, url, date: result.date ?? null })
    }
  }

  if (!text) throw new PerplexityError('Perplexity returned no answer text')

  return { text, sources, model: body.model ?? 'unknown' }
}

export interface AskOptions {
  effort?: Effort
  /** A system-style preamble applied to the question. */
  instructions?: string
  /** Give up after this long. Deep questions genuinely take minutes. */
  timeoutMs?: number
}

export async function ask(question: string, options: AskOptions = {}): Promise<Answer> {
  const { effort = 'medium', instructions, timeoutMs = 180_000 } = options

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      effort,
      input: question,
      ...(instructions ? { instructions } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new PerplexityError(`Perplexity ${response.status}: ${detail.slice(0, 500)}`)
  }

  return parse((await response.json()) as ResponseBody)
}
