import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ask, type Effort } from '../services/perplexity.ts'

// Asks Perplexity a fixed set of questions about the other football guessing
// games and writes the answers, with their sources, to a dated markdown file
// under docs/market-research/.
//
//   yarn workspace server research
//   yarn workspace server research --effort high
//   yarn workspace server research "how does Who Are Ya monetise?"
//
// With a question as an argument it asks just that one and prints it instead
// of writing a file — the quick way to follow up on something a report raised.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Context every question is asked against, so answers come back about games
// like ours rather than about the football industry in general.
const INSTRUCTIONS = `You are doing market research for a web and mobile game called
"Guess the Career": players are shown a footballer's club-by-club career history, one
club at a time, and race to name the player. It has a live multiplayer mode where
friends play together over video. Answer concretely and cite sources. Name actual
products, numbers and dates wherever you can, and say plainly when something is not
publicly known rather than guessing.`

interface Question {
  heading: string
  prompt: string
}

const QUESTIONS: Question[] = [
  {
    heading: 'The direct competitors',
    prompt:
      'List the football (soccer) player-guessing games currently live on the web or app ' +
      'stores — career-path, transfer-history, silhouette and daily-puzzle formats. For ' +
      'each: who makes it, what the core loop is, what platforms it is on, and roughly how ' +
      'big its audience is.',
  },
  {
    heading: 'How big the audience is',
    prompt:
      'How large is the audience for daily football guessing games? Give download numbers, ' +
      'MAU/DAU, web traffic estimates or funding for the leading titles, with dates. Is the ' +
      'category growing or past its peak?',
  },
  {
    heading: 'How they make money',
    prompt:
      'How do football guessing games monetise — ads, subscriptions, one-off unlocks, ' +
      'sponsorship, media partnerships? Give concrete prices and any published revenue.',
  },
  {
    heading: 'Multiplayer and social play',
    prompt:
      'Which football or sports trivia games offer real-time multiplayer against friends, ' +
      'and how does it work (lobbies, links, video or voice chat, turn-based asynchronous ' +
      'play)? Where live multiplayer trivia has succeeded or failed, what made the ' +
      'difference?',
  },
  {
    heading: 'What keeps players coming back',
    prompt:
      'What retention and virality mechanics do the leading daily puzzle and sports guessing ' +
      'games use — streaks, shareable result grids, leaderboards, notifications, archives? ' +
      'Which of these are reported to actually move retention?',
  },
  {
    heading: 'Where they get their data, and the legal line',
    prompt:
      'Where do football guessing games source player career data, and what are the licensing ' +
      'and intellectual-property constraints on using player names, career histories, club ' +
      'names, badges and photos in a game? What have rights holders actually enforced?',
  },
  {
    heading: 'The gaps',
    prompt:
      'Based on player reviews and community discussion, what do people complain about in ' +
      'existing football guessing games, and what do they ask for that nobody has shipped? ' +
      'Quote the complaints.',
  },
]

const args = process.argv.slice(2)

// --effort <level>, pulled out of argv so the rest is the ad-hoc question.
let effort: Effort = 'medium'
const effortAt = args.indexOf('--effort')
if (effortAt !== -1) {
  const value = args[effortAt + 1]
  if (!value) {
    console.error('--effort needs a level: fast, low, medium, high or xhigh')
    process.exit(1)
  }
  effort = value as Effort
  args.splice(effortAt, 2)
}

const adHoc = args.join(' ').trim()

if (adHoc) {
  const answer = await ask(adHoc, { effort, instructions: INSTRUCTIONS })
  console.log(`\n${answer.text}\n`)
  for (const source of answer.sources) console.log(`  - ${source.title} — ${source.url}`)
  process.exit(0)
}

console.log(`Researching ${QUESTIONS.length} questions at effort "${effort}"...\n`)

const sections: string[] = []
const models = new Set<string>()
let failed = 0

for (const question of QUESTIONS) {
  process.stdout.write(`  ${question.heading} ... `)
  const startedAt = Date.now()
  try {
    const answer = await ask(question.prompt, { effort, instructions: INSTRUCTIONS })
    models.add(answer.model)

    // Perplexity writes its own `## ` headings; demote them so they nest under
    // this section's heading instead of competing with it.
    const body = answer.text.replace(/^(#{1,5}) /gm, '#$1 ')

    const sources = answer.sources
      .map(source => `- [${source.title}](${source.url})${source.date ? ` — ${source.date}` : ''}`)
      .join('\n')

    sections.push(
      `## ${question.heading}\n\n_${question.prompt}_\n\n${body}\n` +
        (sources ? `\n### Sources\n\n${sources}\n` : ''),
    )
    console.log(`✓  (${answer.sources.length} sources, ${Math.round((Date.now() - startedAt) / 1000)}s)`)
  } catch (e) {
    console.log(`✗  ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

if (!sections.length) {
  console.error('\nNothing came back — not writing a report.')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
const path = resolve(REPO_ROOT, 'docs/market-research', `${today}.md`)

const report =
  `# Competitor research — ${today}\n\n` +
  `Generated by \`yarn workspace server research\` (Perplexity Agent API, effort ` +
  `"${effort}", routed to ${[...models].join(', ')}). Everything below is Perplexity's ` +
  `summary of the open web — check a claim against its source before you act on it.\n\n` +
  sections.join('\n')

await mkdir(dirname(path), { recursive: true })
await writeFile(path, report, 'utf8')

console.log(`\nDone — ${sections.length} answered, ${failed} failed.`)
console.log(`Report: ${path}`)
