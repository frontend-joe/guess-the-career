import * as cheerio from 'cheerio'

const CLUB_ALIASES: Record<string, string> = {
  // Inter Milan
  'Internazionale': 'Inter Milan',
  'FC Internazionale': 'Inter Milan',
  'FC Internazionale Milano': 'Inter Milan',
  // AC Milan
  'A.C. Milan': 'AC Milan',
  'Milan': 'AC Milan',
  // Real Zaragoza
  'Zaragoza': 'Real Zaragoza',
  // Real Betis
  'Betis': 'Real Betis',
  // Mallorca
  'Real Mallorca': 'Mallorca',
  // Oviedo
  'Real Oviedo': 'Oviedo',
}

const FOOTBALLING_NATIONS = new Set([
  'Brazil', 'Argentina', 'France', 'Germany', 'Italy', 'England', 'Spain', 'Portugal',
  'Netherlands', 'Belgium', 'Croatia', 'Uruguay', 'Colombia', 'Chile', 'Peru', 'Ecuador',
  'Paraguay', 'Bolivia', 'Venezuela', 'Mexico', 'United States', 'Canada', 'Costa Rica',
  'Panama', 'Honduras', 'El Salvador', 'Guatemala', 'Jamaica', 'Cuba', 'Haiti',
  'Dominican Republic', 'Morocco', 'Algeria', 'Tunisia', 'Egypt', 'Nigeria', 'Senegal',
  'Ghana', 'Ivory Coast', 'Cameroon', 'South Africa', 'Kenya', 'Ethiopia', 'DR Congo',
  'Angola', 'Mali', 'Burkina Faso', 'Uganda', 'Zambia', 'Zimbabwe', 'Australia',
  'New Zealand', 'Japan', 'South Korea', 'China', 'India', 'Indonesia', 'Thailand',
  'Vietnam', 'Malaysia', 'Saudi Arabia', 'Qatar', 'United Arab Emirates', 'Iran', 'Iraq',
  'Turkey', 'Israel', 'Jordan', 'Lebanon', 'Syria', 'Russia', 'Ukraine', 'Poland',
  'Czech Republic', 'Slovakia', 'Austria', 'Switzerland', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Iceland', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro', 'Albania',
  'Greece', 'Romania', 'Bulgaria', 'Hungary', 'Slovenia', 'North Macedonia', 'Ireland',
  'Scotland', 'Wales', 'Northern Ireland', 'Luxembourg', 'Estonia', 'Latvia', 'Lithuania',
  'Belarus', 'Kazakhstan', 'Uzbekistan', 'Georgia', 'Armenia', 'Azerbaijan',
])

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
    stint_type: 'senior' | 'international'
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

  const name = stripCitations($('#firstHeading').text().trim().replace(/\s*\(.*?\)\s*$/, '').trim())
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
        if (country && country.length > 1 && country.length < 60 && !/[\d()[\]]/.test(country)) {
          nationality = country
        }
      }
    } else if (label.includes('position')) {
      // Position uses a Wikipedia hlist — collect <li> items and join them
      const items: string[] = []
      value.find('li').each((_, li) => {
        const text = stripCitations($(li).text().trim())
        if (text) items.push(text)
      })
      position = items.length > 0
        ? items.join(', ')
        : stripCitations(value.text().trim().replace(/\s+/g, ' ')) || null

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
  let currentSection: 'senior' | 'international' | null = null
  let sortOrder = 0

  infobox.find('tr').each((_, row) => {
    const header = $(row).find('th.infobox-header')
    if (header.length) {
      const headerText = header.text().trim().toLowerCase()
      if (headerText.includes('senior career')) {
        currentSection = 'senior'
      } else if (headerText.includes('international career') || headerText.includes('national team')) {
        currentSection = 'international'
      } else {
        currentSection = null
      }
      return
    }

    if (!currentSection) return

    const yearsEl = $(row).find('th.infobox-label')
    const clubEl = $(row).find('td.infobox-data-a')
    const appsEl = $(row).find('td.infobox-data-b')
    const goalsEl = $(row).find('td.infobox-data-c')

    if (!yearsEl.length || !clubEl.length) return

    // Skip the column header row (Years / Team / Apps / Gls)
    const yearsText = yearsEl.find('span').text().trim() || yearsEl.text().trim()
    if (!yearsText || yearsText.toLowerCase() === 'years') return

    const club = stripCitations(clubEl.clone().find('style, script').remove().end().text().trim())
    if (!club || club.toLowerCase() === 'team') return

    const years = normalizeYears(stripCitations(yearsText))
    const apps = parseNumber(appsEl.text().trim())
    const goals = parseNumber(goalsEl.text().trim())

    const isLoan = /^\s*→/.test(club)
    const strippedClub = club.replace(/^\s*→\s*/, '').trim()
    const baseName = normalizeClubAlias(strippedClub.replace(/\s*\(loan\)\s*$/i, '').trim())
    const cleanClub = isLoan
      ? `→ ${baseName}${/\(loan\)/i.test(strippedClub) ? '' : ' (loan)'}`
      : baseName

    stints.push({ sort_order: sortOrder++, years, club: cleanClub, apps, goals, stint_type: currentSection })
  })

  // Derive nationality from international career — highest priority.
  // Only accepts countries that appear in the FOOTBALLING_NATIONS list so that
  // "Great Britain", "Basque Country", "West Germany", "Italy B" etc. don't pollute the field.
  // Takes the last matching country to handle players who switched allegiance.
  const intlStints = stints.filter(s => s.stint_type === 'international')
  if (intlStints.length > 0) {
    const countries = intlStints
      .map(s => extractCountryFromTeam(s.club))
      .filter((c): c is string => c !== null && FOOTBALLING_NATIONS.has(c))
    if (countries.length > 0) {
      nationality = countries[countries.length - 1]
    }
  }

  return { name, wikipedia_url: url, nationality, position, born, stints }
}

export interface ScrapeManagerResult {
  name: string
  wikipedia_url: string
  place_of_birth: string | null
  born: string | null
  stints: {
    sort_order: number
    years: string
    club: string
    apps: number | null
    goals: number | null
    stint_type: 'managerial'
  }[]
}

export async function scrapeManagerWikipedia(url: string): Promise<ScrapeManagerResult> {
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

  const name = stripCitations($('#firstHeading').text().trim().replace(/\s*\(.*?\)\s*$/, '').trim())
  if (!name) throw new Error('Could not find manager name on page')

  const infobox = $('table.infobox.vcard').first()
  if (!infobox.length) throw new Error('No infobox found on this Wikipedia page')

  let place_of_birth: string | null = null
  let born: string | null = null

  infobox.find('tr').each((_, row) => {
    const labelEl = $(row).find('th.infobox-label').first()
    if (!labelEl.length) return
    const label = labelEl.text().trim().toLowerCase()
    const value = $(row).find('td').first()
    if (!value.length) return

    if (label === 'born' || label.includes('date of birth')) {
      born = value.find('.bday').text().trim() || null

      // Some pages embed birthplace in the born row (td.birthplace or .birthplace span)
      const birthplaceEl = value.find('.birthplace')
      if (birthplaceEl.length) {
        const text = stripCitations(birthplaceEl.text().trim())
        if (text) place_of_birth = text
      }
    } else if (label === 'place of birth' || label.includes('place of birth')) {
      // Many manager pages have a dedicated "Place of birth" row (td.infobox-data.birthplace)
      const text = stripCitations(value.text().trim())
      if (text) place_of_birth = text
    }
  })

  const stints: ScrapeManagerResult['stints'] = []
  let inManagerialSection = false
  let sortOrder = 0

  infobox.find('tr').each((_, row) => {
    const header = $(row).find('th.infobox-header')
    if (header.length) {
      const headerText = header.text().trim().toLowerCase()
      inManagerialSection = (
        headerText.includes('managerial career') ||
        headerText.includes('managing career') ||
        headerText.includes('coaching career')
      )
      return
    }

    if (!inManagerialSection) return

    const yearsEl = $(row).find('th.infobox-label')
    // Manager infoboxes use td.infobox-data (colspan=3); footballer infoboxes use td.infobox-data-a/b/c
    const clubEl = $(row).find('td.infobox-data-a, td.infobox-data').first()
    const appsEl = $(row).find('td.infobox-data-b')
    const goalsEl = $(row).find('td.infobox-data-c')

    if (!yearsEl.length || !clubEl.length) return

    const yearsText = yearsEl.find('span').text().trim() || yearsEl.text().trim()
    if (!yearsText || yearsText.toLowerCase() === 'years') return

    const club = stripCitations(clubEl.clone().find('style, script').remove().end().text().trim())
    if (!club || club.toLowerCase() === 'team') return

    const years = normalizeYears(stripCitations(yearsText))
    const apps = parseNumber(appsEl.text().trim())
    const goals = parseNumber(goalsEl.text().trim())

    stints.push({ sort_order: sortOrder++, years, club: club.trim(), apps, goals, stint_type: 'managerial' })
  })

  return { name, wikipedia_url: url, place_of_birth, born, stints }
}

function normalizeClubAlias(club: string): string {
  return CLUB_ALIASES[club] ?? club
}

function stripCitations(text: string): string {
  // Remove Wikipedia footnote markers: [1], [note 1], [a], etc.
  return text.replace(/\s*\[[^\]]*\]/g, '').trim()
}

function extractCountryFromTeam(team: string): string | null {
  const cleaned = stripCitations(team)
    .replace(/\s*\([^)]*\)\s*$/, '')  // strip trailing parentheticals e.g. "(O.P.)", "(beach)"
    .replace(/\s+(U[-\s]?\d+|Under[-\s]?\d+|B|XI|Olympics?|Olympic\s+[Tt]eam)$/i, '')
    .trim()
  return cleaned.length > 0 ? cleaned : null
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
