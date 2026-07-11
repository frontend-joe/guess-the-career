import { CLUB_ALIASES, normalizeClubAlias, FOOTBALLING_NATIONS } from './scraper.ts'

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

// Historical / split-state nationalities collapsed onto the modern country used
// for grouping players (e.g. West & East Germany → Germany). Keyed lowercase.
const CANONICAL_NATIONALITY: Record<string, string> = {
  'west germany': 'Germany',
  'east germany': 'Germany',
  german: 'Germany',
}

// Canonical display nationality for grouping. Falls back to the trimmed input.
export function canonicalNationality(nat: string | null | undefined): string {
  if (!nat) return ''
  const t = nat.trim()
  return CANONICAL_NATIONALITY[t.toLowerCase()] ?? t
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

// ── German clubs (curated) ──────────────────────────────────────────────────
// Bundesliga + 2. Bundesliga clubs (all-time top flight plus current/recent 2.
// Bundesliga and notable historic sides), using the canonical name forms that
// appear in career_stints.club. Variant spellings present in the data are listed
// directly so membership is exact. Reserve/B/II teams are filtered by reserveRe.
export const GERMAN_CLUBS: string[] = [
  // Bundesliga mainstays
  'Bayern Munich', 'Bayern München', 'FC Bayern Munich',
  'Borussia Dortmund', 'Dortmund',
  'Bayer Leverkusen', 'Leverkusen',
  'Schalke 04', 'Schalke',
  'Borussia Mönchengladbach', 'Mönchengladbach', 'Borussia Monchengladbach',
  'VfB Stuttgart', 'Stuttgart',
  'Werder Bremen', 'Bremen',
  'Hamburger SV', 'Hamburg',
  'Eintracht Frankfurt', 'Frankfurt',
  '1. FC Köln', 'FC Köln', 'Köln', 'Cologne', '1. FC Cologne',
  'VfL Wolfsburg', 'Wolfsburg',
  'TSG Hoffenheim', '1899 Hoffenheim', 'Hoffenheim',
  'Hertha BSC', 'Hertha Berlin', 'Hertha',
  '1. FC Union Berlin', 'Union Berlin',
  'RB Leipzig', 'Leipzig',
  'SC Freiburg', 'Freiburg',
  '1. FSV Mainz 05', 'FSV Mainz 05', 'Mainz 05', 'Mainz',
  'FC Augsburg', 'Augsburg',
  'Hannover 96', 'Hannover',
  '1. FC Nürnberg', 'Nürnberg', 'Nuremberg',
  'VfL Bochum', 'Bochum',
  'Fortuna Düsseldorf', 'Düsseldorf',
  '1. FC Kaiserslautern', 'Kaiserslautern',
  'Arminia Bielefeld', 'Bielefeld',
  'Eintracht Braunschweig', 'Braunschweig',
  // 2. Bundesliga / historic
  'MSV Duisburg', 'Duisburg',
  'Karlsruher SC', 'Karlsruhe',
  'SpVgg Greuther Fürth', 'Greuther Fürth', 'Fürth',
  'SC Paderborn 07', 'SC Paderborn', 'Paderborn',
  'FC St. Pauli', 'St. Pauli', 'St Pauli',
  'Holstein Kiel', 'Kiel',
  'SV Darmstadt 98', 'Darmstadt 98', 'Darmstadt',
  'Energie Cottbus', 'Cottbus',
  'Hansa Rostock', 'Rostock',
  '1860 Munich', 'TSV 1860 München', '1860 München',
  'Dynamo Dresden', 'Dresden',
  'Kickers Offenbach', 'Offenbach',
  'SV Wehen Wiesbaden', 'Wehen Wiesbaden',
  'Erzgebirge Aue', 'Aue',
  'SV Sandhausen', 'Sandhausen',
  '1. FC Heidenheim', 'Heidenheim',
  'FC Ingolstadt 04', 'FC Ingolstadt', 'Ingolstadt',
  'Bayer Uerdingen', 'KFC Uerdingen', 'Uerdingen',
  'Waldhof Mannheim', 'Rot-Weiss Essen', 'Alemannia Aachen', 'Aachen',
  'Wuppertaler SV', 'Stuttgarter Kickers', 'Rot-Weiß Oberhausen',
  'Preußen Münster', 'VfL Osnabrück', 'Jahn Regensburg', 'SG Wattenscheid 09',
]

const GERMAN_CLUB_SET = new Set(
  GERMAN_CLUBS.map((c) => normalizeClubAlias(c).toLowerCase()),
)

export function isGermanClub(club: string): boolean {
  return GERMAN_CLUB_SET.has(normalizeClubAlias(club).toLowerCase())
}

// True when the nationality is German (so it can be excluded from the Bundesliga
// "foreigners-in-Germany" game).
export function isGermany(nat: string | null | undefined): boolean {
  return allNationalityIsos(nat).has('DE')
}

// ── French clubs (curated) ──────────────────────────────────────────────────
// Ligue 1 + Ligue 2 clubs (all-time top flight plus current/recent Ligue 2 and
// notable historic sides), using the canonical name forms that appear in
// career_stints.club. Variant spellings are listed directly so membership is
// exact. Reserve/B teams are filtered by reserveRe.
export const FRENCH_CLUBS: string[] = [
  // Ligue 1 mainstays
  'Paris Saint-Germain', 'Paris Saint Germain', 'PSG', 'Paris SG',
  'Marseille', 'Olympique de Marseille', 'Olympique Marseille',
  'Lyon', 'Olympique Lyonnais',
  'Monaco', 'AS Monaco',
  'Lille', 'LOSC Lille', 'Lille OSC',
  'Bordeaux', 'Girondins de Bordeaux', 'Girondins Bordeaux',
  'Saint-Étienne', 'Saint-Etienne', 'AS Saint-Étienne',
  'Nice', 'OGC Nice',
  'Rennes', 'Stade Rennais',
  'Nantes', 'FC Nantes',
  'Lens', 'RC Lens',
  'Montpellier', 'Montpellier HSC',
  'Strasbourg', 'RC Strasbourg',
  'Toulouse', 'Toulouse FC',
  'Reims', 'Stade de Reims',
  'Nancy', 'AS Nancy',
  'Auxerre', 'AJ Auxerre',
  'Metz', 'FC Metz',
  'Sochaux', 'FC Sochaux', 'FC Sochaux-Montbéliard',
  'Lorient', 'FC Lorient',
  'Guingamp', 'EA Guingamp',
  'Caen', 'SM Caen',
  'Bastia', 'SC Bastia',
  'Angers', 'Angers SCO',
  'Dijon', 'Dijon FCO',
  'Brest', 'Stade Brestois',
  'Troyes', 'ES Troyes', 'ESTAC Troyes',
  'Amiens', 'Amiens SC',
  'Nîmes', 'Nîmes Olympique',
  'Le Havre', 'Le Havre AC',
  'Clermont', 'Clermont Foot',
  'Ajaccio', 'AC Ajaccio',
  // Ligue 2 / historic
  'Valenciennes', 'Valenciennes FC', 'Grenoble', 'Le Mans', 'Le Mans FC',
  'Sedan', 'CS Sedan', 'Istres', 'Arles-Avignon', 'Évian', 'Évian Thonon Gaillard',
  'Gazélec Ajaccio', 'Boulogne', 'Châteauroux', 'Créteil', 'Niort', 'Laval',
  'Tours', 'Red Star', 'Paris FC', 'Quevilly', 'Rodez', 'Pau', 'Annecy',
  'Bastia-Borgo', 'Chamois Niortais', 'Gueugnon', 'Louhans-Cuiseaux',
]

const FRENCH_CLUB_SET = new Set(
  FRENCH_CLUBS.map((c) => normalizeClubAlias(c).toLowerCase()),
)

export function isFrenchClub(club: string): boolean {
  return FRENCH_CLUB_SET.has(normalizeClubAlias(club).toLowerCase())
}

// True when the nationality is French (so it can be excluded from the Ligue 1
// "foreigners-in-France" game).
export function isFrance(nat: string | null | undefined): boolean {
  return allNationalityIsos(nat).has('FR')
}

// ── International team → nation (for the Dual Nationality game) ──────────────
// Reduce an international team name to its base nation by dropping age-group /
// reserve / Olympic suffixes, then map to an ISO so predecessor/variant names
// collapse (West Germany & Germany → DE). Regional sides (Catalonia, Basque
// Country, Great Britain) aren't in NATIONALITY_ISO and resolve to null.
const NATION_SUFFIX_RE = /\s*(\(O\.P\.\)|Olympic|Amateur|Youth|League XI|Team\s*\d+|U-?\d+|B|C|II)\s*$/i

export function baseNation(team: string): string {
  let t = team.split('/')[0].trim()
  let prev = ''
  while (prev !== t) {
    prev = t
    t = t.replace(NATION_SUFFIX_RE, '').trim()
  }
  return t
}

const NATIONALITY_ISO_LC: Record<string, string> = Object.fromEntries(
  Object.entries(NATIONALITY_ISO).map(([k, v]) => [k.toLowerCase(), v]),
)

export function nationIso(team: string): string | null {
  return NATIONALITY_ISO_LC[baseNation(team).toLowerCase()] ?? null
}

// Age-group / reserve / Olympic markers as a trailing token. Requires whitespace
// before the marker so real trailing letters ("Czech Republi[c]") aren't stripped.
const NATION_TEAM_SUFFIX_RE = /\s+(\(O\.P\.\)|Olympic|Amateur|Youth|League XI|Team\s*\d+|U-?\d+|B|C|II|III|IV)\s*$/i

// True when an international team name is a full senior national team (no
// age-group / B / Olympic suffix) AND a recognised FIFA nation — used to tell a
// senior cap from a youth one or a non-FIFA regional side (Padania, Catalonia).
// Tolerates slash-joined senior sides that span a country change, e.g.
// "West Germany/Germany" or "Czechoslovakia/Czech Republic".
export function isSeniorNationalTeam(team: string): boolean {
  // Normalise slash spacing so "West Germany / Germany" and "West Germany/Germany"
  // are treated identically.
  const t = team.trim().replace(/\s*\/\s*/g, '/')
  const parts = t.split('/').map((part) => {
    let p = part.trim()
    let prev = ''
    while (prev !== p) {
      prev = p
      p = p.replace(NATION_TEAM_SUFFIX_RE, '').trim()
    }
    return p
  })
  // An age/reserve suffix was present if stripping changed the string.
  if (parts.join('/') !== t) return false
  // Every side must be a recognised footballing nation (excludes Padania etc.).
  return parts.every((p) => FOOTBALLING_NATIONS.has(p))
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
