import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'

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
  // Monaco
  'AS Monaco': 'Monaco',
  'AS Monaco FC': 'Monaco',
  // PSV
  'PSV Eindhoven': 'PSV',
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

export async function scrapeMatchLineups(url: string): Promise<MatchScrapeResult> {
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
    homeTeam,
    awayTeam,
    homePlayers: homePlayers.slice(0, 11),
    awayPlayers: awayPlayers.slice(0, 11),
  }
}

function isPositionCode(text: string): boolean {
  return /^(GK|DF|MF|FW|RB|CB|LB|SW|RM|CM|LM|AM|DM|CF|ST|SS|RW|LW|WB|RWB|LWB|CAM|CDM|RF|LF)$/i.test(text.trim())
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
  if (/^DF$|^D$|^DEF|^CB$|^RB$|^LB$|^SW$|^BACK/.test(s)) return 'DF'
  if (/^FW$|^F$|^FOR|^ST$|^CF$|^SS$|^WIN|^STR/.test(s)) return 'FW'
  // Default mid for anything else (including MF, M, MID, AM, DM, CM etc.)
  return 'MF'
}

function deriveCompetition(matchName: string): string {
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
