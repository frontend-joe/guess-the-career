import * as cheerio from 'cheerio'

export interface ScrapeResult {
  name: string
  wikipedia_url: string
  nationality: string | null
  position: string | null
  born: string | null
  stints: {
    sort_order: number
    years: string
    club: string
    apps: number | null
    goals: number | null
  }[]
}

export async function scrapeWikipedia(url: string): Promise<ScrapeResult> {
  if (!url.includes('wikipedia.org/wiki/')) {
    throw new Error('URL must be a Wikipedia article URL')
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' },
  })
  if (!res.ok) {
    throw new Error(`Wikipedia returned ${res.status}`)
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  const name = $('#firstHeading').text().trim()
  if (!name) throw new Error('Could not find footballer name on page')

  const infobox = $('table.infobox.vcard').first()
  if (!infobox.length) throw new Error('No infobox found on this Wikipedia page')

  let nationality: string | null = null
  let position: string | null = null
  let born: string | null = null

  // Pattern 1: "Representing" header (th.adr) used on many modern footballer pages.
  // The country name lives in .country-name a (link text is just "Brazil", "France", etc.)
  const representingTh = infobox.find('th.adr').first()
  if (representingTh.length) {
    const countryLink = representingTh.find('.country-name a').first()
    const text = countryLink.text().trim()
    if (text) nationality = text
  }

  infobox.find('tr').each((_, row) => {
    // Only look at standard labeled rows (th.infobox-label + td); skip section headers
    const labelEl = $(row).find('th.infobox-label').first()
    if (!labelEl.length) return
    const label = labelEl.text().trim().toLowerCase()
    const value = $(row).find('td').first()
    if (!value.length) return

    if (label === 'born' || label.includes('date of birth')) {
      born = value.find('.bday').text().trim() || null

      // Pattern 2: nationality embedded in .birthplace ("Newcastle upon Tyne, England")
      if (!nationality) {
        const birthplace = value.find('.birthplace')
        const raw = (birthplace.length ? birthplace : value).text().trim()
        // Remove the date portion, then take the last comma-separated segment
        const withoutDate = raw.replace(/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/g, '').trim()
        const parts = withoutDate.split(',').map((s) => s.trim()).filter(Boolean)
        const country = parts[parts.length - 1]
        if (country && country.length > 1 && country.length < 60) {
          nationality = country
        }
      }
    } else if (label.includes('position')) {
      // Position uses a Wikipedia hlist — collect <li> items and join them
      const items: string[] = []
      value.find('li').each((_, li) => {
        const text = $(li).text().trim()
        if (text) items.push(text)
      })
      position = items.length > 0
        ? items.join(', ')
        : value.text().trim().replace(/\s+/g, ' ') || null

    } else if (
      // Pattern 3: explicit Nationality / Nationalities / Country of birth row
      label === 'nationality' ||
      label === 'nationalities' ||
      label.includes('country of birth') ||
      label.includes('country of citizenship')
    ) {
      // Prefer link text (excludes flag icon img titles); join multiple nationalities
      const links: string[] = []
      value.find('a').each((_, a) => {
        if (!$(a).closest('.flagicon').length) {
          const text = $(a).text().trim()
          if (text) links.push(text)
        }
      })
      const text = links.join(', ') || value.text().trim().replace(/\s+/g, ' ')
      if (text) nationality = text
    }
  })

  const stints: ScrapeResult['stints'] = []
  let inSeniorSection = false
  let sortOrder = 0

  infobox.find('tr').each((_, row) => {
    const header = $(row).find('th.infobox-header')
    if (header.length) {
      const headerText = header.text().trim()
      inSeniorSection = headerText.toLowerCase().includes('senior career')
      return
    }

    if (!inSeniorSection) return

    const yearsEl = $(row).find('th.infobox-label')
    const clubEl = $(row).find('td.infobox-data-a')
    const appsEl = $(row).find('td.infobox-data-b')
    const goalsEl = $(row).find('td.infobox-data-c')

    if (!yearsEl.length || !clubEl.length) return

    // Skip the column header row (Years / Team / Apps / Gls)
    const yearsText = yearsEl.find('span').text().trim() || yearsEl.text().trim()
    if (!yearsText || yearsText.toLowerCase() === 'years') return

    const club = clubEl.text().trim()
    if (!club || club.toLowerCase() === 'team') return

    const years = normalizeYears(yearsText)
    const apps = parseNumber(appsEl.text().trim())
    const goals = parseNumber(goalsEl.text().trim())

    // Strip loan arrows from club name
    const cleanClub = club.replace(/^\s*→\s*/, '').trim()

    stints.push({ sort_order: sortOrder++, years, club: cleanClub, apps, goals })
  })

  return { name, wikipedia_url: url, nationality, position, born, stints }
}

function normalizeYears(raw: string): string {
  // Replace various dash-like characters with en-dash
  return raw.replace(/[-‒—]/g, '–').trim()
}

function parseNumber(raw: string): number | null {
  // Strip parentheses (goals are shown as "(250)")
  const cleaned = raw.replace(/[()]/g, '').replace(/,/g, '').trim()
  // "−" (U+2212 minus sign) means unknown
  if (!cleaned || cleaned === '−' || cleaned === '-') return null
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}
