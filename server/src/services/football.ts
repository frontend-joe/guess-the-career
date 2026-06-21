import { CLUB_ALIASES, normalizeClubAlias } from './scraper.ts'

// Shared football helpers used by the nationals + foreigners games:
// nationality matching (demonym/noun forms), club-name variants, reserve-team
// detection, and the curated English-clubs set.

export const reserveRe = /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i

// Build the full list of club name variants (canonical + aliases + loan forms).
export function getClubVariants(clubName: string): string[] {
  const canonical = normalizeClubAlias(clubName)
  const aliases = Object.entries(CLUB_ALIASES)
    .filter(([, v]) => v === canonical)
    .map(([k]) => k)
  const base = [canonical, ...aliases]
  return [...base, ...base.map((v) => `→ ${v}`)]
}

export function hasClub(stintClubs: string[], targetClub: string): boolean {
  const variants = getClubVariants(targetClub)
  return stintClubs.some((c) => variants.includes(normalizeClubAlias(c)))
}

// Nationality ISO map for equivalence checks (demonym + noun forms).
export const NATIONALITY_ISO: Record<string, string> = {
  English: 'GB-ENG', England: 'GB-ENG',
  Scottish: 'GB-SCT', Scotland: 'GB-SCT',
  Welsh: 'GB-WLS', Wales: 'GB-WLS',
  'Northern Irish': 'GB-NIR', 'Northern Ireland': 'GB-NIR',
  Dutch: 'NL', Netherlands: 'NL',
  German: 'DE', Germany: 'DE', 'West Germany': 'DE', 'East Germany': 'DE',
  French: 'FR', France: 'FR',
  Spanish: 'ES', Spain: 'ES',
  Italian: 'IT', Italy: 'IT',
  Portuguese: 'PT', Portugal: 'PT',
  Brazilian: 'BR', Brazil: 'BR',
  Argentine: 'AR', Argentinian: 'AR', Argentina: 'AR',
  Belgian: 'BE', Belgium: 'BE',
  Croatian: 'HR', Croatia: 'HR',
  Uruguayan: 'UY', Uruguay: 'UY',
  Colombian: 'CO', Colombia: 'CO',
  Chilean: 'CL', Chile: 'CL',
  Mexican: 'MX', Mexico: 'MX',
  American: 'US', 'United States': 'US',
  Turkish: 'TR', Turkey: 'TR',
  Russian: 'RU', Russia: 'RU',
  Ukrainian: 'UA', Ukraine: 'UA',
  Polish: 'PL', Poland: 'PL',
  Czech: 'CZ', 'Czech Republic': 'CZ',
  Slovak: 'SK', Slovakia: 'SK',
  Austrian: 'AT', Austria: 'AT',
  Swiss: 'CH', Switzerland: 'CH',
  Swedish: 'SE', Sweden: 'SE',
  Norwegian: 'NO', Norway: 'NO',
  Danish: 'DK', Denmark: 'DK',
  Finnish: 'FI', Finland: 'FI',
  Icelandic: 'IS', Iceland: 'IS',
  Serbian: 'RS', Serbia: 'RS', 'Serbia and Montenegro': 'RS',
  Greek: 'GR', Greece: 'GR',
  Romanian: 'RO', Romania: 'RO',
  Hungarian: 'HU', Hungary: 'HU',
  Slovenian: 'SI', Slovenia: 'SI',
  Macedonian: 'MK', 'North Macedonia': 'MK',
  Albanian: 'AL', Albania: 'AL',
  Bosnian: 'BA', 'Bosnia and Herzegovina': 'BA',
  Montenegrin: 'ME', Montenegro: 'ME',
  Bulgarian: 'BG', Bulgaria: 'BG',
  Georgian: 'GE', Georgia: 'GE',
  Armenian: 'AM', Armenia: 'AM',
  Belarusian: 'BY', Belarus: 'BY',
  Azerbaijani: 'AZ', Azerbaijan: 'AZ',
  Israeli: 'IL', Israel: 'IL',
  Irish: 'IE', 'Republic of Ireland': 'IE', Ireland: 'IE',
  Ecuadorian: 'EC', Ecuador: 'EC',
  Paraguayan: 'PY', Paraguay: 'PY',
  Bolivian: 'BO', Bolivia: 'BO',
  Peruvian: 'PE', Peru: 'PE',
  Venezuelan: 'VE', Venezuela: 'VE',
  Japanese: 'JP', Japan: 'JP',
  'South Korean': 'KR', 'South Korea': 'KR',
  Australian: 'AU', Australia: 'AU',
  Moroccan: 'MA', Morocco: 'MA',
  Algerian: 'DZ', Algeria: 'DZ',
  Nigerian: 'NG', Nigeria: 'NG',
  Senegalese: 'SN', Senegal: 'SN',
  Ghanaian: 'GH', Ghana: 'GH',
  Ivorian: 'CI', 'Ivory Coast': 'CI',
  Cameroonian: 'CM', Cameroon: 'CM',
  Egyptian: 'EG', Egypt: 'EG',
  Tunisian: 'TN', Tunisia: 'TN',
  Liberian: 'LR', Liberia: 'LR',
  Guinean: 'GN', Guinea: 'GN',
  Congolese: 'CD', 'DR Congo': 'CD',
  Malian: 'ML', Mali: 'ML',
  'Saudi Arabian': 'SA', 'Saudi Arabia': 'SA',
  Qatari: 'QA', Qatar: 'QA',
}

export function allNationalityIsos(nat: string | null | undefined): Set<string> {
  if (!nat) return new Set()
  const trimmed = nat.trim()
  const direct = NATIONALITY_ISO[trimmed]
  if (direct) return new Set([direct])
  const isos = new Set<string>()
  for (const part of trimmed.split(/\s+/)) {
    const partIso = NATIONALITY_ISO[part]
    if (partIso) isos.add(partIso)
  }
  return isos
}

export function nationalitiesMatch(
  playerNat: string | null | undefined,
  targetNat: string,
): boolean {
  if (!playerNat) return false
  if (playerNat.toLowerCase().trim() === targetNat.toLowerCase().trim()) return true
  const targetIso = NATIONALITY_ISO[targetNat.trim()]
  if (!targetIso) return false
  return allNationalityIsos(playerNat).has(targetIso)
}

// True when the nationality is English (so it can be excluded from "foreigners").
export function isEngland(nat: string | null | undefined): boolean {
  return allNationalityIsos(nat).has('GB-ENG')
}

// ── English clubs (curated) ─────────────────────────────────────────────────
// The 92 League clubs + a few notable others. Welsh members of the English
// pyramid (Cardiff/Swansea/Wrexham/Newport) are intentionally included.
export const ENGLISH_CLUBS: string[] = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion',
  'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Leeds United',
  'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
  'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur', 'West Ham United',
  'Wolverhampton Wanderers', 'Blackburn Rovers', 'Bristol City', 'Coventry City',
  'Derby County', 'Hull City', 'Ipswich Town', 'Leicester City', 'Middlesbrough',
  'Millwall', 'Norwich City', 'Oxford United', 'Portsmouth', 'Preston North End',
  'Queens Park Rangers', 'Sheffield United', 'Sheffield Wednesday', 'Southampton',
  'Stoke City', 'Swansea City', 'Watford', 'West Bromwich Albion', 'Birmingham City',
  'Charlton Athletic', 'Wrexham', 'AFC Wimbledon', 'Barnsley', 'Blackpool',
  'Bolton Wanderers', 'Bradford City', 'Burton Albion', 'Cardiff City',
  'Doncaster Rovers', 'Exeter City', 'Huddersfield Town', 'Leyton Orient',
  'Lincoln City', 'Luton Town', 'Mansfield Town', 'Northampton Town',
  'Peterborough United', 'Plymouth Argyle', 'Reading', 'Rotherham United',
  'Stevenage', 'Stockport County', 'Wigan Athletic', 'Wycombe Wanderers',
  'Port Vale', 'Accrington Stanley', 'Barnet', 'Barrow', 'Bromley',
  'Cheltenham Town', 'Chesterfield', 'Colchester United', 'Crewe Alexandra',
  'Fleetwood Town', 'Gillingham', 'Grimsby Town', 'Harrogate Town',
  'Milton Keynes Dons', 'Newport County', 'Notts County', 'Oldham Athletic',
  'Salford City', 'Shrewsbury Town', 'Swindon Town', 'Tranmere Rovers', 'Walsall',
  'Carlisle United', 'Morecambe', 'Crawley Town',
]

const ENGLISH_CLUB_SET = new Set(
  ENGLISH_CLUBS.map((c) => normalizeClubAlias(c).toLowerCase()),
)

export function isEnglishClub(club: string): boolean {
  return ENGLISH_CLUB_SET.has(normalizeClubAlias(club).toLowerCase())
}

// ── Italian clubs (curated) ─────────────────────────────────────────────────
// Serie A + Serie B clubs (all-time top flight plus current/recent Serie B),
// using the canonical name forms that appear in career_stints.club. Variant
// spellings present in the data (Verona/Hellas Verona, Bari/A.S. Bari,
// Vicenza/AC Vicenza 1902) are listed directly so membership is exact.
export const ITALIAN_CLUBS: string[] = [
  // Serie A mainstays
  'AC Milan', 'Inter Milan', 'Juventus', 'Roma', 'Napoli', 'Lazio',
  'Fiorentina', 'Torino', 'Genoa', 'Sampdoria', 'Atalanta', 'Bologna',
  'Udinese', 'Parma', 'Cagliari', 'Sassuolo', 'Hellas Verona', 'Verona',
  'Palermo', 'Empoli', 'Lecce', 'Brescia', 'Chievo', 'Siena', 'Catania',
  'Bari', 'A.S. Bari', 'Pisa', 'Cremonese', 'Cesena', 'Frosinone', 'Spezia',
  'Venezia', 'Monza', 'Salernitana', 'Crotone', 'Benevento', 'Reggina',
  'Livorno', 'Piacenza', 'Ascoli', 'Perugia', 'Vicenza', 'AC Vicenza 1902',
  'Foggia', 'Como', 'Modena', 'Ancona',
  // Serie B / recent additions
  'Pescara', 'Novara', 'Carpi', 'SPAL', 'Ternana', 'Cosenza', 'Cittadella',
  'Padova', 'Reggiana', 'Avellino', 'Catanzaro', 'Lecco', 'Mantova',
  'Messina', 'Treviso', 'Triestina', 'Alessandria', 'Trapani', 'Pistoiese',
  'Pordenone', 'Südtirol', 'Juve Stabia',
]

const ITALIAN_CLUB_SET = new Set(
  ITALIAN_CLUBS.map((c) => normalizeClubAlias(c).toLowerCase()),
)

export function isItalianClub(club: string): boolean {
  return ITALIAN_CLUB_SET.has(normalizeClubAlias(club).toLowerCase())
}

// True when the nationality is Italian (so it can be excluded from the Serie A
// "foreigners-in-Italy" game).
export function isItaly(nat: string | null | undefined): boolean {
  return allNationalityIsos(nat).has('IT')
}

// ── Spanish clubs (curated) ─────────────────────────────────────────────────
// Any Spanish club (La Liga + Segunda + notable lower/historic sides), using the
// canonical name forms that appear in career_stints.club. Variant spellings in
// the data are listed directly so membership is exact. Reserve/B teams are
// intentionally excluded (they're filtered by reserveRe and won't match these
// first-team names), as are foreign clubs that share a name (e.g. Barcelona S.C.
// of Ecuador, Deportivo Quito, Racing Genk).
export const SPANISH_CLUBS: string[] = [
  // La Liga mainstays
  'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Valencia', 'Sevilla',
  'Villarreal', 'Real Zaragoza', 'Mallorca', 'Espanyol', 'Deportivo La Coruña',
  'Levante', 'Celta', 'Celta Vigo', 'Celta de Vigo', 'Real Betis', 'Betis',
  'Málaga', 'Real Sociedad', 'Athletic Bilbao', 'Alavés', 'Valladolid',
  'Real Valladolid', 'Rayo Vallecano', 'Tenerife', 'Racing Santander',
  'Racing de Santander', 'Getafe', 'Cádiz', 'Osasuna', 'Recreativo',
  'Recreativo de Huelva', 'Córdoba', 'Elche', 'Albacete', 'Sporting Gijón',
  'Sporting de Gijón', 'Salamanca', 'Murcia', 'Real Murcia', 'Leganés', 'Eibar',
  'Almería', 'Hércules', 'Granada', 'Numancia', 'Girona', 'Sabadell',
  'Castellón', 'Huesca', 'Oviedo', 'Real Oviedo', 'Las Palmas', 'UD Las Palmas',
  // Segunda / lower / historic
  'Cartagena', 'Lugo', 'Ponferradina', 'Burgos', 'Fuenlabrada', 'Extremadura',
  'Alcorcón', 'Logroñés', 'Racing Ferrol', 'Xerez', 'Gimnàstic', 'Badajoz',
  'Compostela', 'Mérida', 'Toledo', 'Pontevedra', 'Mirandés', 'Cultural Leonesa',
  'Real Unión', 'Amorebieta', 'Andorra', 'Eldense', 'Reus', 'Lorca',
]

const SPANISH_CLUB_SET = new Set(
  SPANISH_CLUBS.map((c) => normalizeClubAlias(c).toLowerCase()),
)

export function isSpanishClub(club: string): boolean {
  return SPANISH_CLUB_SET.has(normalizeClubAlias(club).toLowerCase())
}

// True when the nationality is Spanish (so it can be excluded from the La Liga
// "foreigners-in-Spain" game).
export function isSpain(nat: string | null | undefined): boolean {
  return allNationalityIsos(nat).has('ES')
}

// SELECT fragment computing a footballer's senior career start/end years (same
// logic as the Style of Play game). Requires the outer query to alias the
// footballers row as `f`. Pair with formatCareerYears() to get "1985–2002".
export const CAREER_SPAN_SELECT = `
  (SELECT CAST(MIN(CAST(SUBSTR(cs2.years, 1, 4) AS INTEGER)) AS TEXT)
     FROM career_stints cs2
     WHERE cs2.footballer_id = f.id AND cs2.stint_type = 'senior'
       AND CAST(SUBSTR(cs2.years, 1, 4) AS INTEGER) BETWEEN 1900 AND 2099) AS career_start,
  (SELECT CASE
     WHEN SUM(CASE WHEN cs2.years LIKE '%present%' THEN 1 ELSE 0 END) > 0 THEN 'present'
     ELSE CAST(MAX(CASE
       WHEN CAST(SUBSTR(cs2.years, -4) AS INTEGER) BETWEEN 1900 AND 2099
         THEN CAST(SUBSTR(cs2.years, -4) AS INTEGER)
       ELSE CAST(SUBSTR(cs2.years, 1, 4) AS INTEGER)
     END) AS TEXT) END
     FROM career_stints cs2
     WHERE cs2.footballer_id = f.id AND cs2.stint_type = 'senior') AS career_end`

export function formatCareerYears(start: string | null, end: string | null): string | null {
  return start ? (end && end !== start ? `${start}–${end}` : start) : null
}
