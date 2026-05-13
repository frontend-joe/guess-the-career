import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'

export const CLUB_ALIASES: Record<string, string> = {
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
  // Monaco
  'AS Monaco': 'Monaco',
  'AS Monaco FC': 'Monaco',
  // PSV
  'PSV Eindhoven': 'PSV',
  // Dortmund
  'Borussia Dortmund': 'Dortmund',
}

const FOOTBALLING_NATIONS = new Set([
  'Brazil', 'Argentina', 'France', 'Germany', 'Italy', 'England', 'Spain', 'Portugal',
  'Netherlands', 'Belgium', 'Croatia', 'Uruguay', 'Colombia', 'Chile', 'Peru', 'Ecuador',
  'Paraguay', 'Bolivia', 'Venezuela', 'Mexico', 'United States', 'Canada', 'Costa Rica',
  'Panama', 'Honduras', 'El Salvador', 'Guatemala', 'Jamaica', 'Cuba', 'Haiti',
  'Dominican Republic', 'Morocco', 'Algeria', 'Tunisia', 'Egypt', 'Nigeria', 'Senegal',
  'Ghana', 'Ivory Coast', 'Cameroon', 'South Africa', 'Kenya', 'Ethiopia', 'DR Congo',
  'Angola', 'Mali', 'Burkina Faso', 'Uganda', 'Zambia', 'Zimbabwe', 'Liberia', 'Réunion', 'Australia',
  'New Zealand', 'Japan', 'South Korea', 'China', 'India', 'Indonesia', 'Thailand',
  'Vietnam', 'Malaysia', 'Saudi Arabia', 'Qatar', 'United Arab Emirates', 'Iran', 'Iraq',
  'Turkey', 'Israel', 'Jordan', 'Lebanon', 'Syria', 'Russia', 'Ukraine', 'Poland',
  'Czech Republic', 'Slovakia', 'Austria', 'Switzerland', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Iceland', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro', 'Albania',
  'Greece', 'Romania', 'Bulgaria', 'Hungary', 'Slovenia', 'North Macedonia', 'Ireland',
  'Scotland', 'Wales', 'Northern Ireland', 'Republic of Ireland', 'Luxembourg',
  'Estonia', 'Latvia', 'Lithuania', 'Belarus', 'Kazakhstan', 'Uzbekistan', 'Georgia',
  'Armenia', 'Azerbaijan', 'West Germany', 'East Germany', 'Yugoslavia', 'SFR Yugoslavia', 'FR Yugoslavia', 'Serbia and Montenegro',
])

const COUNTRY_NORMALIZE: Record<string, string> = {
  'Republic of Ireland': 'Ireland',
  'West Germany': 'Germany',
  'East Germany': 'Germany',
  'SFR Yugoslavia': 'Yugoslavia',
  'FR Yugoslavia': 'Yugoslavia',
}

export interface ScrapeResult {
  name: string
  wikipedia_url: string
  nationality: string | null
  position: string | null
  all_positions: string | null
  born: string | null
  height_cm: number | null
  photo_url: string | null
  stints: {
    sort_order: number
    years: string
    club: string
    club_wikipedia_url: string | null
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

  // Extract photo from infobox image row (avoids a separate API call)
  let photo_url: string | null = null
  const infoboxImg = infobox.find('td.infobox-image img, td.infobox-above img').first()
  if (infoboxImg.length) {
    const src = infoboxImg.attr('src') ?? ''
    if (src.includes('upload.wikimedia.org')) {
      const absolute = src.startsWith('//') ? `https:${src}` : src
      // Bump thumbnail width to 330px for better quality
      photo_url = absolute.replace(/\/\d+px-/, '/330px-')
    }
  }

  let nationality: string | null = null
  let position: string | null = null
  let born: string | null = null
  let height_cm: number | null = null
  let birthplaceRaw: string | null = null

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

      // Pattern 2a: birthplace in same row as date of birth
      const birthplaceEl = value.find('.birthplace')
      const rawBorn = (birthplaceEl.length ? birthplaceEl : value).text().trim()
      const withoutDate = rawBorn.replace(/\(\d{4}-\d{2}-\d{2}\)|\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}|\(age\s+\d+\)/g, '').trim()
      if (withoutDate.includes(',')) {
        birthplaceRaw = withoutDate
        if (!nationality) {
          const parts = withoutDate.split(',').map((s) => stripCitations(s).trim()).filter(Boolean)
          const country = parts[parts.length - 1]
          if (country && country.length > 1 && country.length < 60 && !/\d/.test(country)) {
            nationality = country
          }
        }
      }
    } else if (label === 'place of birth' || label.includes('place of birth')) {
      // Pattern 2b: separate "Place of birth" row (e.g. Paolo Poggi, Diego Klimowicz)
      const raw = stripCitations(value.text().trim().replace(/\s+/g, ' '))
      birthplaceRaw = raw
      if (!nationality) {
        const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
        const country = parts[parts.length - 1]
        if (country && country.length > 1 && country.length < 60 && !/\d/.test(country)) {
          nationality = country
        }
      }
    } else if (label === 'height') {
      const raw = value.text().trim()
      const mMatch = raw.match(/(\d+\.?\d*)\s*m\b/)
      if (mMatch) {
        height_cm = Math.round(parseFloat(mMatch[1]) * 100)
      } else {
        const ftInMatch = raw.match(/(\d+)\s*ft\s*(\d+)\s*in/)
        if (ftInMatch) {
          height_cm = Math.round(parseInt(ftInMatch[1]) * 30.48 + parseInt(ftInMatch[2]) * 2.54)
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

    const clubHref = clubEl.find('a').first().attr('href')
    const clubWikiUrl = clubHref && clubHref.startsWith('/wiki/')
      ? `https://en.wikipedia.org${clubHref}`
      : null

    const years = normalizeYears(stripCitations(yearsText))
    const apps = parseNumber(appsEl.text().trim())
    const goals = parseNumber(goalsEl.text().trim())

    const isLoan = /^\s*→/.test(club)
    const strippedClub = club.replace(/^\s*→\s*/, '').trim()
    const baseName = normalizeClubAlias(strippedClub.replace(/\s*\(loan\)\s*$/i, '').trim())
    const cleanClub = isLoan
      ? `→ ${baseName}${/\(loan\)/i.test(strippedClub) ? '' : ' (loan)'}`
      : baseName

    stints.push({ sort_order: sortOrder++, years, club: cleanClub, club_wikipedia_url: clubWikiUrl, apps, goals, stint_type: currentSection })
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
      .map(c => COUNTRY_NORMALIZE[c] ?? c)
    if (countries.length > 0) {
      nationality = countries[countries.length - 1]
    }
  }

  // Final fallback: if nationality is still unset, scan each comma-segment of the birthplace
  // against FOOTBALLING_NATIONS (last-to-first, so "Piacenza, Emilia-Romagna, Italy" → "Italy")
  if (!nationality && birthplaceRaw) {
    const segments = (birthplaceRaw as string).split(',').map((s: string) => stripCitations(s).trim()).filter(Boolean).reverse()
    for (const seg of segments) {
      const normalized = COUNTRY_NORMALIZE[seg] ?? seg
      if (FOOTBALLING_NATIONS.has(seg) || FOOTBALLING_NATIONS.has(normalized)) {
        nationality = COUNTRY_NORMALIZE[seg] ?? seg
        break
      }
    }
  }

  if (nationality) nationality = COUNTRY_NORMALIZE[nationality] ?? nationality

  const styleText = findSectionText($, 'style of play', 'playing style', 'player profile', 'style')
  let all_positions: string | null = null
  if (styleText) {
    const found = extractPositionsFromText(styleText)
    if (found.length > 0) all_positions = found.join(', ')
  }

  return { name, wikipedia_url: url, nationality, position, all_positions, born, height_cm, photo_url, stints }
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

export interface ScrapedXiPlayer {
  name: string
  position: 'GK' | 'DF' | 'MF' | 'FW'
  squadNumber: number | null
  wikipediaUrl: string | null
}

export interface MatchScrapeResult {
  matchName: string
  year: number
  competition: string
  homeTeam: string
  awayTeam: string
  homePlayers: ScrapedXiPlayer[]
  awayPlayers: ScrapedXiPlayer[]
}

export function isBbcSportUrl(url: string): boolean {
  return /news\.bbc\.co\.uk|bbc\.co\.uk\/sport/.test(url)
}

function bbcPosition(index: number): 'GK' | 'DF' | 'MF' | 'FW' {
  if (index === 0) return 'GK'
  if (index <= 4) return 'DF'
  if (index <= 8) return 'MF'
  return 'FW'
}

async function scrapeBbcMatchLineups(url: string): Promise<MatchScrapeResult> {
  const res = await fetch(url, { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } })
  if (!res.ok) throw new Error(`BBC fetch failed: ${res.status}`)
  const html = await res.text()

  // Match title: "BBC SPORT | Football | FA Cup | Chelsea 1-2 Liverpool"
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  const titleFull = titleMatch?.[1] ?? ''
  const titleParts = titleFull.split(' | ')
  const matchName = titleParts[titleParts.length - 1]?.trim() ?? titleFull.trim()

  // Year from publication date meta
  const dateMatch = html.match(/<meta[^>]+name="OriginalPublicationDate"[^>]+content="(\d{4})/i)
  const year = dateMatch ? parseInt(dateMatch[1]) : new Date().getFullYear()

  // Competition from Section meta, refined by deriveCompetition
  const sectionMatch = html.match(/<meta[^>]+name="Section"[^>]+content="([^"]+)"/i)
  const section = sectionMatch?.[1] ?? ''
  const competition = deriveCompetition(section || matchName)

  // Extract lineups: <b>Team:</b> or <b>Team</b>: followed by comma-separated players then <br
  // [^\r\n]*? stays on a single line; HTML tags stripped after capture for <a>-linked names.
  const lineupRe = /<b>([^:<\n]+?)(?::\s*<\/b>|<\/b>\s*:)\s*([^\r\n]*?)(?=<br)/gi
  const lineups: Array<{ team: string; players: ScrapedXiPlayer[] }> = []

  let m: RegExpExecArray | null
  while ((m = lineupRe.exec(html)) !== null) {
    const team = m[1].trim()
    const raw = m[2]
      .replace(/<[^>]+>/g, ' ')  // strip HTML tags (e.g. <a> links around player names)
      .replace(/\.\s*$/, '')
      .trim()

    const players: ScrapedXiPlayer[] = raw
      .split(/,\s*/)
      .map(s => s.replace(/\s*\([^)]*\d[^)]*\)$/, '').trim())  // strip (Sub 45) annotations
      .filter(Boolean)
      .slice(0, 11)
      .map((name, i) => ({
        name,
        position: bbcPosition(i),
        squadNumber: i + 1,
        wikipediaUrl: null,
      }))

    if (players.length >= 11) {
      lineups.push({ team, players })
    }
  }

  if (lineups.length < 2) {
    const found = lineups.map(l => `"${l.team}" (${l.players.length} players)`).join(', ') || 'none'
    const snippet = html.substring(html.search(/<b>/i), html.search(/<b>/i) + 500).replace(/\s+/g, ' ')
    throw new Error(`Could not find two lineup tables on this page (found ${lineups.length}: ${found}). First <b> section: ${snippet}`)
  }

  return {
    matchName,
    year,
    competition,
    homeTeam: lineups[0].team,
    awayTeam: lineups[1].team,
    homePlayers: lineups[0].players,
    awayPlayers: lineups[1].players,
  }
}

export async function scrapeMatchLineups(url: string): Promise<MatchScrapeResult> {
  if (isBbcSportUrl(url)) return scrapeBbcMatchLineups(url)

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

  const rawTitle = $('#firstHeading').text().trim()
  const matchName = stripCitations(rawTitle)
  const yearMatch = matchName.match(/\d{4}/)
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear()
  const competition = deriveCompetition(matchName)

  // Try to find exactly two lineup tables (one per team)
  const lineupTables = findLineupTables($)

  if (lineupTables.length < 2) {
    throw new Error(
      `Could not find two lineup tables on this page (found ${lineupTables.length}). ` +
      `Try adding the match manually.`
    )
  }

  const [homeTable, awayTable] = lineupTables.slice(0, 2)
  const [homeTeam, awayTeam] = extractTeamNames($, lineupTables)
  const homePlayers = parseLineupTable($, homeTable)
  const awayPlayers = parseLineupTable($, awayTable)

  if (homePlayers.length < 11 || awayPlayers.length < 11) {
    throw new Error(
      `Expected 11 players per team but found ${homePlayers.length} and ${awayPlayers.length}. ` +
      `Try adding the match manually.`
    )
  }

  return {
    matchName,
    year,
    competition,
    homeTeam: normalizeClubAlias(homeTeam),
    awayTeam: normalizeClubAlias(awayTeam),
    homePlayers: homePlayers.slice(0, 11),
    awayPlayers: awayPlayers.slice(0, 11),
  }
}

function isPositionCode(text: string): boolean {
  // Accept any 2–5 uppercase letter code with no spaces or digits.
  // Wikipedia pages use many variants (RCB, LCB, RCM, LCM, IWB, CWB, …) beyond the common list.
  return /^[A-Z]{2,5}$/.test(text.trim())
}

function findLineupTables($: CheerioAPI): AnyNode[] {
  // Strategy 0: Wikipedia standard match lineup format.
  // These tables use style="font-size:90%" and have rows where the first <td>
  // is a position code (GK, RB, CB, LB, CM, etc.) followed by squad number in <b>.
  const newFormatCandidates: AnyNode[] = []
  $('table').each((_i: number, table: AnyNode) => {
    const style = ($(table).attr('style') ?? '').replace(/\s+/g, '')
    if (!style.includes('font-size:90%')) return
    let positionRowCount = 0
    let hitSubs = false
    $(table).find('tr').each((_j: number, row: AnyNode) => {
      if (hitSubs) return
      const cells = $(row).find('td')
      if (!cells.length) return
      const firstText = $(cells[0]).text().trim()
      if (/^substitutes?/i.test(firstText)) { hitSubs = true; return }
      if (isPositionCode(firstText)) positionRowCount++
    })
    if (positionRowCount >= 10) newFormatCandidates.push(table)
  })
  if (newFormatCandidates.length >= 2) return newFormatCandidates.slice(0, 2)

  // Strategy 1: wikitable format with No./Pos. column headers and 11+ numbered rows
  const candidates: AnyNode[] = []
  $('table.wikitable').each((_i: number, table: AnyNode) => {
    const rows = $(table).find('tr')
    let playerRows = 0
    let hasPositionCol = false
    let hasNumberCol = false

    rows.each((_j: number, row: AnyNode) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return

      const firstCell = $(cells[0]).text().trim()
      const isNumberRow = /^\d{1,2}$/.test(firstCell)
      if (isNumberRow) playerRows++

      $(row).find('th').each((_k: number, th: AnyNode) => {
        const text = $(th).text().trim().toLowerCase()
        if (/^pos\.?$|^position$/.test(text)) hasPositionCol = true
        if (/^no\.?$|^#$/.test(text)) hasNumberCol = true
      })
    })

    if ((hasPositionCol || hasNumberCol) && playerRows >= 11) {
      candidates.push(table)
    }
  })
  if (candidates.length >= 2) return candidates

  // Fallback: find wikitables near section headings
  const sectionTables: AnyNode[] = []
  const sectionHeadings = ['Starting_lineups', 'Match_details', 'Match', 'Line-ups', 'Lineups']

  for (const headingId of sectionHeadings) {
    const span = $(`span#${headingId}`).first()
    if (!span.length) continue

    span.closest('h2, h3').nextAll().each((_i: number, sibling: AnyNode) => {
      const name = 'name' in sibling ? (sibling as { name: string }).name : ''
      if (/^h[23]$/i.test(name)) return false
      $(sibling).find('table.wikitable').each((_j: number, t: AnyNode) => { sectionTables.push(t) })
      if ($(sibling).is('table.wikitable')) sectionTables.push(sibling)
    })

    if (sectionTables.length >= 2) return sectionTables.slice(0, 2)
  }

  return candidates.length > 0 ? candidates : sectionTables
}

function extractTeamNames($: CheerioAPI, lineupTables: AnyNode[]): [string, string] {
  // The two lineup tables sit in sibling <td>s inside a <table width="100%"> (lineup outer table).
  // Team names are in centred <b> elements inside the kit table that immediately precedes it.
  let outerTable: ReturnType<typeof $> | null = null

  $('table').each((_i: number, t: AnyNode) => {
    if (outerTable) return
    const tWidth = $(t).attr('width') ?? ''
    const tStyle = ($(t).attr('style') ?? '').replace(/\s+/g, '')
    if (tWidth !== '100%' && !/width:100%/.test(tStyle)) return
    // Check if both lineup tables are descendants of this table
    let count = 0
    lineupTables.forEach(lt => {
      if ($(t).find('table').filter((_j: number, inner: AnyNode) => inner === lt).length > 0) count++
    })
    if (count >= 2) outerTable = $(t)
  })

  if (outerTable) {
    const prevTable = (outerTable as ReturnType<typeof $>).prev('table')
    if (prevTable.length) {
      const names: string[] = []
      prevTable.find('div').each((_i: number, div: AnyNode) => {
        if (names.length >= 2) return
        if (!/text-align\s*:\s*center/i.test($(div).attr('style') ?? '')) return
        const bText = stripCitations($(div).find('b').first().text().trim())
        if (bText && bText.length > 1 && bText.length < 60 && !/^\d/.test(bText)) {
          names.push(bText)
        }
      })
      if (names.length === 2) return [names[0], names[1]]
    }
  }

  // Fallback: per-table extraction
  return [extractTeamName($, lineupTables[0]), extractTeamName($, lineupTables[1])]
}

function extractTeamName($: CheerioAPI, table: AnyNode): string {
  // For font-size:90% lineup tables, the team name lives in the parent <td> —
  // either inside a centred div (formation diagram label) or as a standalone <b>.
  const tableStyle = ($(table).attr('style') ?? '').replace(/\s+/g, '')
  if (tableStyle.includes('font-size:90%')) {
    const parentTd = $(table).closest('td')
    if (parentTd.length) {
      let teamName = ''
      parentTd.find('div').each((_i: number, div: AnyNode) => {
        if (!/text-align\s*:\s*center/i.test($(div).attr('style') ?? '')) return
        const bText = $(div).find('b').first().text().trim()
        if (bText && bText.length > 1 && bText.length < 60) {
          teamName = bText
          return false
        }
      })
      if (teamName) return stripCitations(teamName)

      // Fallback: first <b> in parent td not inside the lineup table itself
      parentTd.find('b').each((_i: number, b: AnyNode) => {
        if ($(b).closest('table').get(0) === $(table).get(0)) return
        const text = $(b).text().trim()
        if (text && text.length > 2 && text.length < 60 && !/^\d/.test(text)) {
          teamName = text
          return false
        }
      })
      if (teamName) return stripCitations(teamName)
    }
  }

  const caption = $(table).find('caption').first().text().trim()
  if (caption) return stripCitations(caption)

  let teamName = ''
  $(table).find('tr').each((_i: number, row: AnyNode) => {
    const th = $(row).find('th[colspan]').first()
    if (th.length) {
      const text = stripCitations(th.text().trim())
      if (text && !/^(no\.?|pos\.?|player|#)$/i.test(text)) {
        teamName = text
        return false
      }
    }
  })
  if (teamName) return teamName

  $(table).find('tr:first-child th').each((_i: number, th: AnyNode) => {
    const text = stripCitations($(th).text().trim())
    if (text && !/^(no\.?|pos\.?|player|#)$/i.test(text)) {
      teamName = text
      return false
    }
  })

  return teamName || 'Unknown Team'
}

function parseLineupTable($: CheerioAPI, table: AnyNode): ScrapedXiPlayer[] {
  const players: ScrapedXiPlayer[] = []
  let hitSubs = false

  $(table).find('tr').each((_i: number, row: AnyNode) => {
    if (hitSubs) return
    const cells = $(row).find('td')
    if (cells.length < 2) return

    const firstCellText = $(cells[0]).text().trim()

    // Stop collecting at the substitutes divider
    if (/^substitutes?/i.test(firstCellText)) {
      hitSubs = true
      return
    }

    let squadNumber: number | null = null
    let position: 'GK' | 'DF' | 'MF' | 'FW'
    let nameCell: ReturnType<CheerioAPI>

    if (isPositionCode(firstCellText)) {
      // Wikipedia standard format: Pos | Squad# (in <b>) | Name
      position = normalizePosition(firstCellText)
      const numText = $(cells[1]).find('b').first().text().trim() || $(cells[1]).text().trim()
      squadNumber = /^\d+$/.test(numText) ? parseInt(numText) : null
      nameCell = $(cells.length >= 3 ? cells[2] : cells[1])
    } else if (/^\d{1,2}$/.test(firstCellText)) {
      // Wikitable format: Squad# | Pos | Name
      squadNumber = parseInt(firstCellText) || null
      const rawPos = stripCitations($(cells[1]).text().trim())
      position = normalizePosition(rawPos)
      nameCell = $(cells.length >= 3 ? cells[2] : cells[1])
    } else {
      return
    }

    // Skip flag image anchors (empty text) — player link is the first anchor with text
    const nameLink = nameCell.find('a').filter((_: number, a: AnyNode) => $(a).text().trim().length > 0).first()
    let name = nameLink.length
      ? stripCitations(nameLink.text().trim())
      : stripCitations(nameCell.clone().find('sup, small').remove().end().text().trim())

    name = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (!name) return

    const href = nameLink.attr('href')
    const wikipediaUrl = href && href.startsWith('/wiki/')
      ? `https://en.wikipedia.org${href}`
      : null

    players.push({ name, position, squadNumber, wikipediaUrl })
  })

  return players
}

function normalizePosition(raw: string): 'GK' | 'DF' | 'MF' | 'FW' {
  const s = raw.trim().toUpperCase()
  if (/^GK$|^G$|^GOALKEEPER/.test(s)) return 'GK'
  if (/^(DF|DEF|D|SW|WB|CB|RB|LB|RCB|LCB|RWB|LWB|IWB|CWB)$|^BACK/.test(s)) return 'DF'
  if (/^(FW|CF|ST|SS|RW|LW|RF|LF)$|^F$|^FOR|^WIN|^STR/.test(s)) return 'FW'
  return 'MF'
}

export function deriveCompetition(matchName: string): string {
  if (/UEFA Champions League/i.test(matchName)) return 'UEFA Champions League'
  if (/UEFA Cup|UEFA Europa League/i.test(matchName)) return 'UEFA Europa League'
  if (/UEFA Super Cup/i.test(matchName)) return 'UEFA Super Cup'
  if (/FIFA World Cup/i.test(matchName) || /World Cup Final/i.test(matchName)) return 'FIFA World Cup'
  if (/European Championship|UEFA Euro|Euro \d{4}/i.test(matchName)) return 'UEFA European Championship'
  if (/Copa América/i.test(matchName)) return 'Copa América'
  if (/FA Cup/i.test(matchName)) return 'FA Cup'
  if (/Copa del Rey/i.test(matchName)) return 'Copa del Rey'
  if (/Coppa Italia/i.test(matchName)) return 'Coppa Italia'
  if (/DFB-Pokal/i.test(matchName)) return 'DFB-Pokal'
  if (/Intercontinental Cup/i.test(matchName)) return 'Intercontinental Cup'
  if (/Club World Cup/i.test(matchName)) return 'FIFA Club World Cup'
  // Strip leading year(s) to get the competition name
  return matchName.replace(/^\d{4}(?:[–\-]\d{2,4})?\s+/, '').replace(/\s+final$/i, '').trim()
}

export function normalizeClubAlias(club: string): string {
  return CLUB_ALIASES[club] ?? club
}

// Expands a wikitable into a full row×col grid, filling in cells that span
// multiple rows (rowspan) so every row has the correct element at every column.
function expandTableRowspans($: CheerioAPI, table: ReturnType<CheerioAPI>): (AnyNode | null)[][] {
  const grid: (AnyNode | null)[][] = []
  const pending = new Map<number, { el: AnyNode; rowsLeft: number }>()

  table.find('tr').each((_i, tr) => {
    const row: (AnyNode | null)[] = []
    let srcCells = $(tr).children('td, th').toArray()
    let srcIdx = 0

    for (let col = 0; srcIdx < srcCells.length || pending.size > 0; col++) {
      if (pending.has(col)) {
        const p = pending.get(col)!
        row.push(p.el)
        p.rowsLeft--
        if (p.rowsLeft === 0) pending.delete(col)
      } else if (srcIdx < srcCells.length) {
        const td = srcCells[srcIdx++]
        const rowspan = parseInt($(td).attr('rowspan') ?? '1') || 1
        const colspan = parseInt($(td).attr('colspan') ?? '1') || 1
        for (let c = 0; c < colspan; c++) {
          row.push(td)
          if (rowspan > 1) pending.set(col + c, { el: td, rowsLeft: rowspan - 1 })
        }
        col += colspan - 1
      } else {
        break
      }
    }

    if (row.length > 0) grid.push(row)
  })

  return grid
}

function cellTextWithBr($: CheerioAPI, el: AnyNode): string {
  const clone = $(el).clone()
  clone.find('br').replaceWith(' / ')
  return clone.text().trim()
}

export interface CompetitionScrapeResult {
  name: string
  topScorers: { name: string; wikipediaUrl: string; club: string; goals: number; rank: number }[]
  hatTricks: { name: string; wikipediaUrl: string; forClub: string; againstClub: string }[]
  topAssists: { name: string; wikipediaUrl: string; club: string; assists: number; rank: number }[]
  playerOfSeason: { name: string; wikipediaUrl: string } | null
  managerOfSeason: { name: string; wikipediaUrl: string } | null
  pfaTeamOfYear: {
    name: string
    wikipediaUrl: string | null
    position: 'GK' | 'DF' | 'MF' | 'FW'
    squadNumber: number
    club: string | null
  }[]
}

function findTableAfterHeading($: CheerioAPI, headingId: string): ReturnType<CheerioAPI> | null {
  // Handle both old format (<h4><span id="..."></span></h4>) and
  // new Wikipedia format (<div class="mw-heading"><h4 id="..."></h4></div>)
  const el = $(`#${headingId}`).first()
  if (!el.length) return null

  const heading = el.is('h1,h2,h3,h4,h5,h6') ? el : el.closest('h1,h2,h3,h4,h5,h6')
  if (!heading.length) return null

  const parentClass = heading.parent().attr('class') ?? ''
  const container = heading.parent().is('div') && parentClass.includes('mw-heading')
    ? heading.parent()
    : heading

  let found: ReturnType<CheerioAPI> | null = null
  container.nextAll().each((_i, sibling) => {
    if (found) return false
    const sib = $(sibling)
    if (sib.is('h1,h2,h3,h4,h5,h6')) return false
    if ((sib.attr('class') ?? '').includes('mw-heading')) return false
    const table = sib.is('table.wikitable') ? sib : sib.find('table.wikitable').first()
    if (table.length) { found = table; return false }
  })
  return found
}

function findTableAfterAnyHeading($: CheerioAPI, ...headingIds: string[]): ReturnType<CheerioAPI> | null {
  for (const id of headingIds) {
    const t = findTableAfterHeading($, id)
    if (t) return t
  }
  return null
}

// Detect column indices from the <th> header row of a wikitable
function detectColumns(
  $: CheerioAPI,
  table: ReturnType<CheerioAPI>,
  ...labels: string[]
): number[] {
  let headerCells: ReturnType<CheerioAPI> | null = null
  table.find('tr').each((_i, row) => {
    const ths = $(row).find('th')
    if (ths.length >= 2) { headerCells = ths; return false }
  })
  if (!headerCells) return labels.map((_, i) => i)
  return labels.map(label => {
    let found = -1
    headerCells!.each((i, th) => {
      if ($(th).text().trim().toLowerCase().includes(label.toLowerCase())) {
        found = i; return false
      }
    })
    return found
  })
}

export async function scrapeCompetitionPage(url: string): Promise<CompetitionScrapeResult> {
  if (!url.includes('wikipedia.org/wiki/')) {
    throw new Error('URL must be a Wikipedia article URL')
  }

  const res = await fetch(url, { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } })
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const name = stripCitations($('#firstHeading').text().trim())
  if (!name) throw new Error('Could not find page title')

  // Helper: find first <a> with non-empty text and a /wiki/ href (skips flag icon links)
  function wikiLink(el: ReturnType<CheerioAPI>) {
    return el.find('a').filter((_i, a) => {
      const href = $(a).attr('href') ?? ''
      return href.startsWith('/wiki/') && !href.includes(':') && $(a).text().trim().length > 0
    }).first()
  }

  // --- Annual awards ---
  let playerOfSeason: CompetitionScrapeResult['playerOfSeason'] = null
  let managerOfSeason: CompetitionScrapeResult['managerOfSeason'] = null

  const awardsTable = findTableAfterAnyHeading($, 'Annual_awards', 'Season_awards', 'Awards', 'Award')
  if (awardsTable) {
    awardsTable.find('tr').each((_i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return
      const award = $(cells[0]).text().toLowerCase()
      // Winner cell is 1 (or 2 in tables with Award | Category | Winner | Club)
      for (let ci = 1; ci < cells.length; ci++) {
        const link = wikiLink($(cells[ci]))
        if (!link.length) continue
        const winnerName = stripCitations(link.text().trim())
        const href = link.attr('href') ?? ''
        const winnerUrl = href.startsWith('/wiki/') ? `https://en.wikipedia.org${href}` : ''
        if (!winnerName || !winnerUrl) continue
        if (award.includes('player of the season') || award.includes("players' player") || award.includes('player of the year')) {
          if (!playerOfSeason) { playerOfSeason = { name: winnerName, wikipediaUrl: winnerUrl } }
        } else if (award.includes('manager of the season') || award.includes('manager of the year')) {
          if (!managerOfSeason) { managerOfSeason = { name: winnerName, wikipediaUrl: winnerUrl } }
        }
        break
      }
    })
  }

  // Fallback: individual award heading paragraphs (e.g. 2002–03 style where each award has its own section)
  function extractAwardFromHeading(headingId: string): { name: string; wikipediaUrl: string } | null {
    const el = $(`#${headingId}`).first()
    if (!el.length) return null
    const heading = el.is('h1,h2,h3,h4,h5,h6') ? el : el.closest('h1,h2,h3,h4,h5,h6')
    if (!heading.length) return null
    const container = heading.parent().is('div') && (heading.parent().attr('class') ?? '').includes('mw-heading')
      ? heading.parent() : heading
    let found: { name: string; wikipediaUrl: string } | null = null
    container.nextAll().each((_i, sib) => {
      if (found) return false
      const s = $(sib)
      if ((s.attr('class') ?? '').includes('mw-heading') || s.is('h1,h2,h3,h4,h5,h6')) return false
      if (!s.is('p') || !s.text().trim()) return
      const link = s.find('a[href^="/wiki/"]').filter((_j: number, a: AnyNode) => {
        const href = $(a).attr('href') ?? ''
        return !href.includes(':') &&
          !/award|season|year|trophy|boot|glove|_f\.c\.|_fc$/i.test(href) &&
          $(a).text().trim().length > 0
      }).first()
      if (!link.length) return
      const personName = stripCitations(link.text().trim())
      const href = link.attr('href') ?? ''
      if (personName && href) { found = { name: personName, wikipediaUrl: `https://en.wikipedia.org${href}` }; return false }
    })
    return found
  }

  if (!playerOfSeason) {
    for (const id of ['Premier_League_Player_of_the_Year', 'Player_of_the_Season', 'Player_of_the_Year']) {
      const result = extractAwardFromHeading(id)
      if (result) { playerOfSeason = result; break }
    }
  }
  if (!managerOfSeason) {
    for (const id of ['Premier_League_Manager_of_the_Year', 'Manager_of_the_Year', 'Manager_of_the_Season']) {
      const result = extractAwardFromHeading(id)
      if (result) { managerOfSeason = result; break }
    }
  }

  // --- Top scorers ---
  const topScorers: CompetitionScrapeResult['topScorers'] = []
  const scorersTable = findTableAfterAnyHeading($,
    'Top_scorers', 'Top_goalscorers', 'Goalscorers', 'Top_goal_scorers', 'Leading_scorers',
    'Pichichi_Trophy', 'Capocannoniere'
  )
  if (scorersTable) {
    const [rankIdx, playerIdx, clubIdx, goalsIdx] = detectColumns($, scorersTable, 'rank', 'player', 'club', 'goal')
    const grid = expandTableRowspans($, scorersTable)
    let rankCounter = 1
    for (const cells of grid) {
      if (!cells.length) continue
      const playerCell = playerIdx >= 0 ? cells[playerIdx] : null
      const link = playerCell ? wikiLink($(playerCell)) : null
      if (!link || !link.length) continue

      const playerName = stripCitations(link.text().trim())
      if (!playerName || playerName.toLowerCase() === 'player') continue
      const href = link.attr('href') ?? ''
      const wikiUrl = href.startsWith('/wiki/') ? `https://en.wikipedia.org${href}` : ''

      let rank = rankCounter
      const rankCell = rankIdx >= 0 ? cells[rankIdx] : null
      if (rankCell) {
        const r = parseInt($(rankCell).text().trim())
        if (!isNaN(r)) rank = r
      }

      const clubCell = clubIdx >= 0 ? cells[clubIdx] : null
      const club = clubCell ? normalizeClubAlias(stripCitations(cellTextWithBr($, clubCell))) : ''

      const goalsCell = goalsIdx >= 0 ? cells[goalsIdx] : null
      const goals = goalsCell ? parseInt($(goalsCell).text().trim()) : NaN

      if (!club || isNaN(goals)) continue
      topScorers.push({ name: playerName, wikipediaUrl: wikiUrl, club, goals, rank })
      rankCounter = rank + 1
    }
  }

  // Fallback: goalscorers in dl/dt + ul/li format (e.g. FIFA World Cup Statistics section)
  if (topScorers.length === 0) {
    const el = $('#Goalscorers').first()
    if (el.length) {
      const heading = el.is('h1,h2,h3,h4,h5,h6') ? el : el.closest('h1,h2,h3,h4,h5,h6')
      const container = heading.parent().is('div') && (heading.parent().attr('class') ?? '').includes('mw-heading')
        ? heading.parent() : heading

      let currentGoals = 0
      let rank = 1

      container.nextAll().each((_i, sib) => {
        const s = $(sib)
        if ((s.attr('class') ?? '').includes('mw-heading') || s.is('h1,h2,h3,h4,h5,h6')) return false

        if (s.is('dl')) {
          const dtText = s.find('dt').first().text().trim()
          const match = dtText.match(/^(\d+)\s+goals?$/i)
          currentGoals = match ? parseInt(match[1]) : 0
          return
        }

        if (currentGoals === 0) return

        const liEls = s.is('ul') ? s.children('li') : s.find('ul li')
        if (!liEls.length) return

        const entries: { name: string; wikiUrl: string; country: string }[] = []
        liEls.each((_j, li) => {
          const liEl = $(li)
          const country = liEl.find('.flagicon img').first().attr('alt')?.trim() ?? ''
          const link = liEl.find('a').filter((_k, a) => {
            const href = $(a).attr('href') ?? ''
            return href.startsWith('/wiki/') && !href.includes(':') && $(a).text().trim().length > 0
          }).first()
          if (!link.length) return
          const playerName = stripCitations(link.text().trim())
          if (!playerName) return
          const href = link.attr('href') ?? ''
          entries.push({ name: playerName, wikiUrl: `https://en.wikipedia.org${href}`, country })
        })

        for (const p of entries) {
          topScorers.push({ name: p.name, wikipediaUrl: p.wikiUrl, club: p.country, goals: currentGoals, rank })
        }
        rank += entries.length
      })
    }
  }

  // --- Hat-tricks (optional) ---
  const hatTricks: CompetitionScrapeResult['hatTricks'] = []
  const hatTable = findTableAfterAnyHeading($, 'Hat-tricks', 'Hat_tricks', 'Hat_trick')
  if (hatTable) {
    const [playerIdx, forIdx, againstIdx] = detectColumns($, hatTable, 'player', 'for', 'against')
    hatTable.find('tr').each((_i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 3) return
      const pIdx = playerIdx >= 0 ? playerIdx : 0
      const fIdx = forIdx >= 0 ? forIdx : 1
      const aIdx = againstIdx >= 0 ? againstIdx : 2
      const link = wikiLink($(cells[pIdx]))
      if (!link.length) return
      const playerName = stripCitations(link.text().trim())
      if (!playerName || playerName.toLowerCase() === 'player') return
      const href = link.attr('href') ?? ''
      const wikiUrl = href.startsWith('/wiki/') ? `https://en.wikipedia.org${href}` : ''
      const forClub = normalizeClubAlias(stripCitations($(cells[fIdx]).text().trim()))
      const againstClub = normalizeClubAlias(stripCitations($(cells[aIdx]).text().trim()))
      if (!forClub || !againstClub) return
      hatTricks.push({ name: playerName, wikipediaUrl: wikiUrl, forClub, againstClub })
    })
  }

  // --- Top assists (optional) ---
  const topAssists: CompetitionScrapeResult['topAssists'] = []
  const assistsTable = findTableAfterAnyHeading($, 'Top_assists', 'Assists', 'Most_assists')
  if (assistsTable) {
    const [rankIdx, playerIdx, clubIdx, assistsColIdx] = detectColumns($, assistsTable, 'rank', 'player', 'club', 'assist')
    const grid = expandTableRowspans($, assistsTable)
    let rankCounter = 1
    for (const cells of grid) {
      if (!cells.length) continue
      const playerCell = playerIdx >= 0 ? cells[playerIdx] : null
      const link = playerCell ? wikiLink($(playerCell)) : null
      if (!link || !link.length) continue

      const playerName = stripCitations(link.text().trim())
      if (!playerName || playerName.toLowerCase() === 'player') continue
      const href = link.attr('href') ?? ''
      const wikiUrl = href.startsWith('/wiki/') ? `https://en.wikipedia.org${href}` : ''

      let rank = rankCounter
      const rankCell = rankIdx >= 0 ? cells[rankIdx] : null
      if (rankCell) {
        const r = parseInt($(rankCell).text().trim())
        if (!isNaN(r)) rank = r
      }

      const clubCell = clubIdx >= 0 ? cells[clubIdx] : null
      const club = clubCell ? normalizeClubAlias(stripCitations(cellTextWithBr($, clubCell))) : ''

      const assistsCell = assistsColIdx >= 0 ? cells[assistsColIdx] : null
      const assists = assistsCell ? parseInt($(assistsCell).text().trim()) : NaN

      if (!club || isNaN(assists)) continue
      topAssists.push({ name: playerName, wikipediaUrl: wikiUrl, club, assists, rank })
      rankCounter = rank + 1
    }
  }

  // --- PFA Team of the Year ---
  const pfaTeamOfYear: CompetitionScrapeResult['pfaTeamOfYear'] = []
  const POSITION_MAP: Record<string, 'GK' | 'DF' | 'MF' | 'FW'> = {
    goalkeeper: 'GK',
    defence: 'DF',
    defenders: 'DF',
    midfield: 'MF',
    midfielders: 'MF',
    attack: 'FW',
    forwards: 'FW',
    strikers: 'FW',
  }
  const SQUAD_START: Record<'GK' | 'DF' | 'MF' | 'FW', number> = { GK: 1, DF: 2, MF: 6, FW: 10 }
  const squadCounters: Record<'GK' | 'DF' | 'MF' | 'FW', number> = { GK: 1, DF: 2, MF: 6, FW: 10 }

  // Find the wikitable whose first th contains "PFA Team of the Year"
  $('table.wikitable').each((_i, table) => {
    if (pfaTeamOfYear.length > 0) return false
    const firstTh = $(table).find('th').first().text()
    if (!firstTh.toLowerCase().includes('pfa team of the year') && !firstTh.toLowerCase().includes('pfa')) return

    let currentPosition: 'GK' | 'DF' | 'MF' | 'FW' | null = null
    squadCounters.GK = SQUAD_START.GK
    squadCounters.DF = SQUAD_START.DF
    squadCounters.MF = SQUAD_START.MF
    squadCounters.FW = SQUAD_START.FW

    $(table).find('tr').each((_j, row) => {
      const cells = $(row).find('td').toArray()
      if (!cells.length) return

      // Club name is in parentheses in the same cell as the player link: "Player Name (Club)"
      const extractClubFromCell = (cell: AnyNode): string | null => {
        const cellText = stripCitations($(cell).text())
        const match = cellText.match(/\(([^)]{2,50})\)\s*$/)
        if (!match) return null
        const normalized = normalizeClubAlias(match[1].trim())
        return normalized && normalized.length > 0 ? normalized : null
      }

      // Position group row: first cell has bold text with position name
      const firstCellText = $(cells[0]).find('b').first().text().trim().toLowerCase()
      if (firstCellText) {
        const pos = POSITION_MAP[firstCellText]
        if (pos) {
          currentPosition = pos
          for (let k = 1; k < cells.length; k++) {
            const link = wikiLink($(cells[k]))
            if (!link.length) continue
            const playerName = stripCitations(link.text().trim())
            if (!playerName) continue
            const href = link.attr('href') ?? ''
            const wikiUrl = href.startsWith('/wiki/') ? `https://en.wikipedia.org${href}` : null
            pfaTeamOfYear.push({
              name: playerName,
              wikipediaUrl: wikiUrl,
              position: currentPosition!,
              squadNumber: squadCounters[currentPosition!]++,
              club: extractClubFromCell(cells[k]),
            })
          }
          return
        }
      }

      // Plain player row (some formats put each player in its own row under position header)
      if (!currentPosition) return
      for (let k = 0; k < cells.length; k++) {
        const link = wikiLink($(cells[k]))
        if (!link.length) continue
        const playerName = stripCitations(link.text().trim())
        if (!playerName) continue
        const href = link.attr('href') ?? ''
        const wikiUrl = href.startsWith('/wiki/') ? `https://en.wikipedia.org${href}` : null
        pfaTeamOfYear.push({
          name: playerName,
          wikipediaUrl: wikiUrl,
          position: currentPosition!,
          squadNumber: squadCounters[currentPosition!]++,
          club: extractClubFromCell(cells[k]),
        })
      }
    })
  })

  // Fallback: pitch diagram format (absolutely-positioned player divs inside a role="img" container)
  if (pfaTeamOfYear.length === 0) {
    const totyEl = $('#PFA_Team_of_the_Year').first()
    if (totyEl.length) {
      const totyHeading = totyEl.is('h1,h2,h3,h4,h5,h6') ? totyEl : totyEl.closest('h1,h2,h3,h4,h5,h6')
      const totyContainer = totyHeading.parent().is('div') && (totyHeading.parent().attr('class') ?? '').includes('mw-heading')
        ? totyHeading.parent() : totyHeading
      interface PitchPlayer { name: string; wikipediaUrl: string | null; top: number; left: number }
      const pitchPlayers: PitchPlayer[] = []
      const inferPositionFromPitch = (top: number, height: number): 'GK' | 'DF' | 'MF' | 'FW' => {
        const pct = top / height
        if (pct > 0.73) return 'GK'
        if (pct > 0.48) return 'DF'
        if (pct > 0.23) return 'MF'
        return 'FW'
      }
      totyContainer.nextAll().each((_i, sib) => {
        if (pitchPlayers.length > 0) return false
        const s = $(sib)
        if ((s.attr('class') ?? '').includes('mw-heading') || s.is('h1,h2,h3,h4,h5,h6')) return false
        const d = s.find('[role="img"]').first()
        if (!d.length) return
        d.children('div[style]').each((_j, div) => {
          const style = $(div).attr('style') ?? ''
          const topMatch = style.match(/top:\s*([\d.]+)px/)
          const leftMatch = style.match(/left:\s*([\d.]+)px/)
          if (!topMatch || !leftMatch) return
          const link = $(div).find('a[href^="/wiki/"]').first()
          if (!link.length) return
          const href = link.attr('href') ?? ''
          if (href.includes(':')) return
          const playerName = stripCitations(link.text().trim())
          if (!playerName) return
          pitchPlayers.push({ name: playerName, wikipediaUrl: `https://en.wikipedia.org${href}`, top: parseFloat(topMatch[1]), left: parseFloat(leftMatch[1]) })
        })
        if (pitchPlayers.length > 0) return false
      })
      if (pitchPlayers.length > 0) {
        const groups: Record<'GK' | 'DF' | 'MF' | 'FW', PitchPlayer[]> = { GK: [], DF: [], MF: [], FW: [] }
        for (const p of pitchPlayers) groups[inferPositionFromPitch(p.top, 265)].push(p)
        for (const pos of ['GK', 'DF', 'MF', 'FW'] as const) {
          groups[pos].sort((a, b) => a.left - b.left)
          let sqNum = SQUAD_START[pos]
          for (const p of groups[pos]) {
            pfaTeamOfYear.push({ name: p.name, wikipediaUrl: p.wikipediaUrl, position: pos, squadNumber: sqNum++, club: null })
          }
        }
      }
    }
  }

  return { name, topScorers, hatTricks, topAssists, playerOfSeason, managerOfSeason, pfaTeamOfYear }
}


function findSectionText($: CheerioAPI, ...targets: string[]): string {
  const normalizedTargets = targets.map(t => t.toLowerCase())
  let result = ''
  $('h2, h3, h4, h5').each((_, el) => {
    const headingText = $(el).text().trim().toLowerCase().replace(/[_\-]+/g, ' ')
    if (!normalizedTargets.some(t => headingText.includes(t))) return
    const headingLevel = parseInt((el as unknown as { name: string }).name[1]) || 2
    const heading = $(el)
    const container = heading.parent().is('div') && (heading.parent().attr('class') ?? '').includes('mw-heading')
      ? heading.parent()
      : heading
    const parts: string[] = []
    container.nextAll().each((_, sib) => {
      const s = $(sib)
      const sibClass = s.attr('class') ?? ''
      if (sibClass.includes('mw-heading')) {
        // Stop at same/higher level section; skip sub-headings and continue
        const m = sibClass.match(/mw-heading(\d)/)
        if (!m || parseInt(m[1]) <= headingLevel) return false
        return
      }
      if (s.is('h1,h2,h3,h4,h5,h6')) {
        const node = s.get(0)
        const tagName = node && 'name' in (node as object) ? (node as { name: string }).name : 'h2'
        if ((parseInt(tagName[1]) || 2) <= headingLevel) return false
        return
      }
      if (s.is('p')) {
        const text = s.text().trim()
        if (text) parts.push(text)
      }
    })
    result = parts.join(' ')
    return false
  })
  return result
}

const POSITION_TERMS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bright[\s-]?wing[\s-]?back\b/i, name: 'Right wing-back' },
  { pattern: /\bleft[\s-]?wing[\s-]?back\b/i, name: 'Left wing-back' },
  { pattern: /\bright[\s-]?back\b/i, name: 'Right back' },
  { pattern: /\bleft[\s-]?back\b/i, name: 'Left back' },
  { pattern: /\bgoalkeeper\b/i, name: 'Goalkeeper' },
  { pattern: /\bcentr[ae][\s-]?back\b|\bcentral[\s-]?defender\b|\bsweeper\b/i, name: 'Centre-back' },
  { pattern: /\bdefensive[\s-]?midfielder\b|\bholding[\s-]?midfielder\b/i, name: 'Defensive midfielder' },
  { pattern: /\battacking[\s-]?midfielder\b|\btrequartista\b/i, name: 'Attacking midfielder' },
  { pattern: /\bright[\s-]?wing(?:er)?\b/i, name: 'Right winger' },
  { pattern: /\bleft[\s-]?wing(?:er)?\b/i, name: 'Left winger' },
  { pattern: /\bwinger\b|\bon the wing\b|\bwide forward\b|\bwide midfielder\b|\bwide player\b/i, name: 'Winger' },
  { pattern: /\bcentral[\s-]?midfielder\b/i, name: 'Central midfielder' },
  { pattern: /\bstrike[r]?\b|\bcentr[ae][\s-]?forward\b/i, name: 'Striker' },
  { pattern: /\bsecond[\s-]?striker\b/i, name: 'Second striker' },
  { pattern: /\bforward\b/i, name: 'Forward' },
  { pattern: /\bmidfield(?:er)?\b/i, name: 'Midfielder' },
]

function extractPositionsFromText(text: string): string[] {
  const found: string[] = []
  for (const { pattern, name } of POSITION_TERMS) {
    if (pattern.test(text) && !found.includes(name)) found.push(name)
  }
  return found
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
