import { scrapeCompetitionPage } from './server/src/services/scraper.ts'

async function main() {
  const result = await scrapeCompetitionPage('https://en.wikipedia.org/wiki/1999%E2%80%932000_FA_Premier_League')
  console.log('Name:', result.name)
  console.log('Top scorers:', result.topScorers.length, result.topScorers[0] ? `${result.topScorers[0].name} ${result.topScorers[0].goals}` : 'NONE')
  console.log('Hat-tricks:', result.hatTricks.length, result.hatTricks[0]?.name ?? 'none')
  console.log('POS:', result.playerOfSeason?.name ?? 'none')
  console.log('MOS:', result.managerOfSeason?.name ?? 'none')
  console.log('TOTY:', result.pfaTeamOfYear.length, result.pfaTeamOfYear.map(p=>p.name).join(', '))
}

main().catch(e => { console.error(e); process.exit(1) })
