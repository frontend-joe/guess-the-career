import { scrapeClubKitColours } from './server/src/services/scraper.ts'

async function main() {
  const clubs = [
    { name: 'Celtic', url: 'https://en.wikipedia.org/wiki/Celtic_F.C.' },
    { name: 'Juventus', url: 'https://en.wikipedia.org/wiki/Juventus_F.C.' },
    { name: 'River Plate', url: 'https://en.wikipedia.org/wiki/Club_Atl%C3%A9tico_River_Plate' },
    { name: 'Boca Juniors', url: 'https://en.wikipedia.org/wiki/Boca_Juniors' },
  ]

  for (const club of clubs) {
    console.log(`\n--- ${club.name} ---`)
    try {
      const result = await scrapeClubKitColours(club.url)
      console.log(JSON.stringify(result, null, 2))
    } catch (e) {
      console.error('ERROR:', e instanceof Error ? e.message : e)
    }
    await new Promise(r => setTimeout(r, 2000))
  }
}

main().catch(console.error)
