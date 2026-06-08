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
