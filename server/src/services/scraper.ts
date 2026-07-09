import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export const CLUB_ALIASES: Record<string, string> = {
  // West Bromwich Albion
  "West Brom": "West Bromwich Albion",
  "West Bromwich": "West Bromwich Albion",
  WBA: "West Bromwich Albion",
  // Inter Milan
  Internazionale: "Inter Milan",
  "FC Internazionale": "Inter Milan",
  "FC Internazionale Milano": "Inter Milan",
  // AC Milan
  "A.C. Milan": "AC Milan",
  Milan: "AC Milan",
  // Real Zaragoza
  Zaragoza: "Real Zaragoza",
  // Real Betis
  Betis: "Real Betis",
  // Mallorca
  "Real Mallorca": "Mallorca",
  // Oviedo
  "Real Oviedo": "Oviedo",
  // Monaco
  "AS Monaco": "Monaco",
  "AS Monaco FC": "Monaco",
  // PSV
  "PSV Eindhoven": "PSV",
  // Dortmund
  "Borussia Dortmund": "Dortmund",
  // Lazio
  "S.S. Lazio": "Lazio",
  "SS Lazio": "Lazio",
  // Hamburger SV
  Hamburg: "Hamburger SV",
  "HSV": "Hamburger SV",
  "Hamburger SV Hamburg": "Hamburger SV",
  // Celta Vigo
  Celta: "Celta Vigo",
  "Celta de Vigo": "Celta Vigo",
  "RC Celta": "Celta Vigo",
  "RC Celta de Vigo": "Celta Vigo",
};

export const FOOTBALLING_NATIONS = new Set([
  "Brazil",
  "Argentina",
  "France",
  "Germany",
  "Italy",
  "England",
  "Spain",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Croatia",
  "Uruguay",
  "Colombia",
  "Chile",
  "Peru",
  "Ecuador",
  "Paraguay",
  "Bolivia",
  "Venezuela",
  "Mexico",
  "United States",
  "Canada",
  "Costa Rica",
  "Panama",
  "Honduras",
  "El Salvador",
  "Guatemala",
  "Jamaica",
  "Cuba",
  "Haiti",
  "Dominican Republic",
  "Morocco",
  "Algeria",
  "Tunisia",
  "Egypt",
  "Nigeria",
  "Senegal",
  "Ghana",
  "Ivory Coast",
  "Cameroon",
  "South Africa",
  "Kenya",
  "Ethiopia",
  "DR Congo",
  "Angola",
  "Mali",
  "Burkina Faso",
  "Uganda",
  "Zambia",
  "Zimbabwe",
  "Liberia",
  "Réunion",
  "Australia",
  "New Zealand",
  "Japan",
  "South Korea",
  "China",
  "India",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Malaysia",
  "Saudi Arabia",
  "Qatar",
  "United Arab Emirates",
  "Iran",
  "Iraq",
  "Turkey",
  "Israel",
  "Jordan",
  "Lebanon",
  "Syria",
  "Russia",
  "Ukraine",
  "Poland",
  "Czech Republic",
  "Slovakia",
  "Austria",
  "Switzerland",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Iceland",
  "Serbia",
  "Bosnia and Herzegovina",
  "Montenegro",
  "Albania",
  "Greece",
  "Romania",
  "Bulgaria",
  "Hungary",
  "Slovenia",
  "North Macedonia",
  "Ireland",
  "Scotland",
  "Wales",
  "Northern Ireland",
  "Republic of Ireland",
  "Luxembourg",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Belarus",
  "Kazakhstan",
  "Uzbekistan",
  "Georgia",
  "Armenia",
  "Azerbaijan",
  "West Germany",
  "East Germany",
  "Yugoslavia",
  "SFR Yugoslavia",
  "FR Yugoslavia",
  "Serbia and Montenegro",
  "Czechoslovakia",
  "Soviet Union",
  "USSR",
  "CIS",
  // Smaller FIFA member nations (so international caps for them aren't ignored,
  // which previously left players defaulting to their birthplace country).
  // Europe
  "Malta", "Cyprus", "Moldova", "Andorra", "San Marino", "Liechtenstein",
  "Faroe Islands", "Gibraltar", "Kosovo",
  // CONCACAF / Caribbean
  "Trinidad and Tobago", "Curaçao", "Antigua and Barbuda", "Barbados", "Bermuda",
  "Grenada", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
  "Cayman Islands", "Montserrat", "Guyana", "Suriname", "Dominica", "Aruba",
  "Belize", "Nicaragua", "Bahamas", "Turks and Caicos Islands",
  "British Virgin Islands", "U.S. Virgin Islands", "Anguilla", "Puerto Rico",
  // Africa
  "Tanzania", "Mozambique", "Namibia", "Botswana", "Malawi", "Madagascar",
  "Gabon", "Congo", "Togo", "Benin", "Guinea", "Guinea-Bissau", "Sierra Leone",
  "Gambia", "Cape Verde", "Equatorial Guinea", "Central African Republic",
  "Chad", "Niger", "Mauritania", "Sudan", "South Sudan", "Burundi", "Rwanda",
  "Lesotho", "Eswatini", "Comoros", "Seychelles", "São Tomé and Príncipe",
  "Djibouti", "Eritrea", "Somalia", "Libya", "Mauritius",
  // Asia
  "Philippines", "Hong Kong", "Singapore", "Myanmar", "Cambodia", "Laos",
  "Brunei", "Bangladesh", "Pakistan", "Sri Lanka", "Nepal", "Maldives", "Bhutan",
  "Mongolia", "North Korea", "Chinese Taipei", "Macau", "Guam", "Bahrain",
  "Kuwait", "Oman", "Yemen", "Palestine", "Tajikistan", "Kyrgyzstan",
  "Turkmenistan", "Afghanistan",
  // Oceania
  "Fiji", "Papua New Guinea", "New Caledonia", "Tahiti", "Solomon Islands",
  "Vanuatu", "Samoa", "American Samoa", "Tonga", "Cook Islands",
]);

const COUNTRY_NORMALIZE: Record<string, string> = {
  "Republic of Ireland": "Ireland",
  "West Germany": "Germany",
  "East Germany": "Germany",
  "SFR Yugoslavia": "Yugoslavia",
  "FR Yugoslavia": "Yugoslavia",
};

export interface ScrapeResult {
  name: string;
  wikipedia_url: string;
  full_name: string | null;
  birthplace: string | null;
  nationality: string | null;
  position: string | null;
  all_positions: string | null;
  style_of_play: string | null;
  born: string | null;
  height_cm: number | null;
  photo_url: string | null;
  honors_champions_league: number;
  honors_fa_cup: number;
  honors_league_cup: number;
  honors_club_world_cup: number;
  honors_world_cup: number;
  honors_euros: number;
  honors_copa_america: number;
  honors_ballon_dor: number;
  honors_world_player: number;
  stints: {
    sort_order: number;
    years: string;
    club: string;
    club_wikipedia_url: string | null;
    apps: number | null;
    goals: number | null;
    stint_type: "senior" | "international";
  }[];
}

interface HonoursData {
  honors_champions_league: number;
  honors_fa_cup: number;
  honors_league_cup: number;
  honors_club_world_cup: number;
  honors_world_cup: number;
  honors_euros: number;
  honors_copa_america: number;
  honors_ballon_dor: number;
  honors_world_player: number;
}

/**
 * Exact-match patterns for the text BEFORE the colon in an honours list item.
 * Each nameRegex must match the full namepart (anchored ^ … $) so that entries like
 * "UEFA Champions League top scorer: 2010" or "UEFA European Championship Team of
 * the Tournament: 1996" never accidentally match.
 */
const HONOUR_PATTERNS: Array<{ nameRegex: RegExp; field: keyof HonoursData }> = [
  {
    // "UEFA Champions League" | "Champions League" | "European Cup" (pre-1992 name)
    nameRegex: /^(?:UEFA )?Champions League$|^European Cup$/i,
    field: 'honors_champions_league',
  },
  {
    nameRegex: /^(?:The )?FA Cup$/i,
    field: 'honors_fa_cup',
  },
  {
    // All the League Cup sponsor-name variants
    nameRegex: /^(?:EFL|Carabao|League|Rumbelows|Milk|Worthington|Capital One|Football League|Littlewoods|Coca-Cola|Carling) Cup$/i,
    field: 'honors_league_cup',
  },
  {
    nameRegex: /^(?:FIFA )?Club World Cup$|^Intercontinental Cup$|^(?:FIFA )?Club World Championship$/i,
    field: 'honors_club_world_cup',
  },
  {
    nameRegex: /^(?:FIFA )?World Cup$/i,
    field: 'honors_world_cup',
  },
  {
    // "UEFA European Championship" | "European Championship" | historical "European Nations Cup"
    nameRegex: /^UEFA European Championship$|^European Championship$|^European Nations Cup$/i,
    field: 'honors_euros',
  },
  {
    nameRegex: /^Copa Am[eé]rica$/i,
    field: 'honors_copa_america',
  },
  {
    nameRegex: /^Ballon d.Or$/i,
    field: 'honors_ballon_dor',
  },
  {
    // Pre-2016: "FIFA World Player of the Year" | Post-2016: "The Best FIFA Men's Player"
    nameRegex: /^FIFA World Player of the Year$|^(?:The )?Best FIFA Men.s Player$|^FIFA Best Men.s Player$/i,
    field: 'honors_world_player',
  },
]

/** Count wins from a single honours list-item string (after citations stripped). */
function countHonourWins(text: string): number {
  // ×N notation: "Ballon d'Or (×7)" or "×3"
  const timesMatch = text.match(/[×x](\d+)/u)
  if (timesMatch) return parseInt(timesMatch[1], 10)

  // Count year / season tokens after the colon.
  // Handles en-dash (1999–2000), hyphen (1999-2000), and forward slash (1999/2000)
  // as a single season so "FA Cup: 1999/2000" counts as 1, not 2.
  const afterColon = text.includes(':') ? text.split(':').slice(1).join(':') : text

  // Some entries mix win years with non-win years in the same item, e.g.:
  //   "FIFA World Cup: 2014, third place: 2006, 2010"
  // Truncate at the first non-win clause so only the win years are counted.
  const nonWinIdx = afterColon.search(
    /\b(?:runner[–\-]?\s*up|runners[–\-]?\s*up|second place|third place|fourth place|[234](?:nd|rd|th) place)\b/i
  )
  const countable = nonWinIdx >= 0 ? afterColon.slice(0, nonWinIdx) : afterColon

  // Only count year tokens that are NOT immediately followed by a parenthetical annotation.
  // e.g. "1994 (8th)" and "1995 (3rd)" are non-wins; bare "2005" or "2004, 2005" are wins.
  const tokens = countable.match(/\b\d{4}(?:[–\-\/]\d{2,4})?\b(?!\s*\()/g)
  return tokens ? tokens.length : 0
}

/**
 * Scrape the "Honours" section from a Wikipedia footballer page.
 * Walks sibling elements after the #Honours heading, collects all <li> items,
 * and matches them against known trophy patterns.
 */
function scrapeHonours($: CheerioAPI): HonoursData {
  const data: HonoursData = {
    honors_champions_league: 0,
    honors_fa_cup: 0,
    honors_league_cup: 0,
    honors_club_world_cup: 0,
    honors_world_cup: 0,
    honors_euros: 0,
    honors_copa_america: 0,
    honors_ballon_dor: 0,
    honors_world_player: 0,
  }

  // Find the Honours / Honors heading (handles both old <h2><span id> and new <div.mw-heading><h2 id> formats)
  const heading = $('#Honours, #Honors').first()
  if (!heading.length) return data

  const headingEl = heading.is('h1,h2,h3,h4,h5,h6') ? heading : heading.closest('h1,h2,h3,h4,h5,h6')
  if (!headingEl.length) return data

  const container =
    headingEl.parent().is('div') && (headingEl.parent().attr('class') ?? '').includes('mw-heading')
      ? headingEl.parent()
      : headingEl

  // Collect all <li> text until the next top-level section (<h2> or mw-heading2)
  container.nextAll().each((_i, sib) => {
    const s = $(sib)
    const cls = s.attr('class') ?? ''

    // Stop at a new <h2>-level section
    if (cls.includes('mw-heading2')) return false
    if (s.is('h1,h2')) return false

    s.find('li').each((_j, li) => {
      // Skip parent <li> items that contain nested <ul>/<ol> — their text() would
      // recursively include all child entries, causing double-counting.
      // Only process leaf list items (those with no nested lists).
      if ($(li).find('ul, ol').length > 0) return

      const text = stripCitations($(li).text().trim())
      if (!text) return

      // ── Pre-loop exclusions ───────────────────────────────────────────────────

      // 1. Skip non-win placings: runner-up, bronze/silver individual awards, or any numbered place
      //    e.g. "Ballon d'Or: 1996 (26th place)", "FA Cup runner-up: 2000"
      //    e.g. "FIFA Club World Cup Silver Ball: 2013" (individual award, not the trophy)
      if (/runner[–\-]?\s*up|runners[–\-]?\s*up|\bBronze\b|\bSilver\b|\(\d+[a-z]{0,2}\s*[Pp]lace\)/i.test(text)) return

      // 2. Skip youth / age-group international honours (U15–U23)
      //    e.g. "UEFA European Under-21 Championship: 1994", "FIFA U-20 World Cup: 2003"
      if (/\bU\s*-?\s*1[5-9]\b|\bU\s*-?\s*2[0-3]\b|\bUnder[- ]?1[5-9]\b|\bUnder[- ]?2[0-3]\b/i.test(text)) return

      // ── Exact namepart matching ───────────────────────────────────────────────
      // Only match against the text BEFORE the colon (the trophy/award name itself).
      // This ensures "UEFA Champions League top scorer: 2010" never matches the
      // Champions League pattern — the namepart "UEFA Champions League top scorer"
      // doesn't satisfy ^UEFA Champions League$ anchored to the end.
      if (!text.includes(':')) return  // all valid trophy entries have a colon

      const namepart = text.split(':')[0].trim()
      if (!namepart) return

      for (const { nameRegex, field } of HONOUR_PATTERNS) {
        if (nameRegex.test(namepart)) {
          data[field] += countHonourWins(text)
          return  // each <li> matches at most one category
        }
      }
    })
  })

  return data
}

// ── Footballing-families detection ──────────────────────────────────────────
// Scan a player's Wikipedia bio for relatives who are footballers. The reliable
// signal is prose: a relationship word near a linked person, with football
// context and no other-sport words in the surrounding clause.
export interface FamilyLink {
  name: string;
  wikipedia_url: string;
  relationship: string;
}

const RELATION_RE =
  /\b(half-brothers?|step-?brothers?|step-?sisters?|brothers?|sisters?|fathers?|mothers?|sons?|daughters?|cousins?|uncles?|aunts?|nephews?|nieces?|twins?|siblings?|grandfathers?|grandmothers?|grandsons?|granddaughters?|grandad|dad)\b/i;
const FOOTBALL_CTX_RE =
  /\b(footballer|footballing|football|midfielder|defender|striker|forward|goalkeeper|winger|caps?|players?|plays? for|played for|signed for|plays? as|professional football)\b/i;
const OTHER_SPORT_RE =
  /\b(netball|cricket|cricketer|rugby|basketball|baseball|ice hockey|field hockey|hockey|tennis|golf|golfer|boxing|boxer|athletics|sprinter|swimmer|swimming|volleyball|handball|gaelic|darts|snooker|nfl|american football)\b/i;
// Reject links that are clubs / competitions / positions / teams rather than people.
const NON_PERSON_TITLE_RE =
  /^(Category|File|Template|Help|Portal|Wikipedia|List_of|FC_)|F\.?C\.?$|A\.?F\.?C\.?$|national_football_team|national_team|Football_(League|Association|Club)|_F\.?C\.?|_Cup|_League|_Division|Premier_League|UEFA|FIFA|Olympic|Championship|Stadium|Trophy|Serie_|La_Liga|Bundesliga|Ligue_|_Youth|Academy|midfielder|defender|striker|forward|goalkeeper|winger/i;
const NON_PERSON_TEXT_RE =
  /\b(division|league|team|club|academy|sector|midfielder|defender|striker|forward|goalkeeper|winger|national|women|youth|cup|reserves?|under-?\d+|u\d+|fc|cf|sc|afc|bsc|bk|if|sv|driver|worker|businessman|coach|manager|i{2,3})\b/i;

export async function scrapeFamilyLinks(url: string): Promise<FamilyLink[]> {
  if (!url.includes("wikipedia.org/wiki/")) {
    throw new Error("URL must be a Wikipedia article URL");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
  });
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const selfTitle = decodeURIComponent((url.split("/wiki/")[1] ?? "").split("#")[0]);
  const found = new Map<string, FamilyLink>();

  $("div.mw-parser-output > p, div.mw-parser-output li").each((_, el) => {
    const block = $(el);
    if (block.closest(".reflist, .references, table, .navbox").length) return;
    const blockText = stripCitations(block.text().replace(/\s+/g, " "));
    if (!RELATION_RE.test(blockText)) return;

    block.find('a[href^="/wiki/"]').each((__, a) => {
      const href = $(a).attr("href") ?? "";
      const title = href.slice("/wiki/".length).split("#")[0].split("?")[0];
      if (!title || title.includes(":")) return;
      if (NON_PERSON_TITLE_RE.test(title)) return;
      if (title === selfTitle) return;
      const linkText = $(a).text().trim();
      // Require a person-like name (two words), not a club/position/competition.
      if (!linkText.includes(" ") || linkText.length < 4) return;
      if (NON_PERSON_TEXT_RE.test(linkText)) return;

      const idx = blockText.indexOf(linkText);
      if (idx < 0) return;
      // The relationship word must sit just before the name (e.g. "brother of
      // [[Name]]", "son of former footballer [[Name]]"), to tie the relation to
      // this person and avoid distant matches (teammates, etc.).
      const before = blockText.slice(Math.max(0, idx - 80), idx);
      const relMatches = [...before.matchAll(new RegExp(RELATION_RE.source, "gi"))];
      if (relMatches.length === 0) return;
      // Football context + no other sport in the wider clause.
      const win = blockText.slice(Math.max(0, idx - 130), idx + linkText.length + 80);
      if (!FOOTBALL_CTX_RE.test(win)) return;
      if (OTHER_SPORT_RE.test(win)) return;

      const relationship = relMatches.at(-1)![1].toLowerCase().replace(/s$/, "");
      const wikipedia_url = `https://en.wikipedia.org/wiki/${title}`;
      if (!found.has(wikipedia_url)) {
        found.set(wikipedia_url, { name: stripCitations(linkText), wikipedia_url, relationship });
      }
    });
  });

  return [...found.values()];
}

export async function scrapeWikipedia(url: string): Promise<ScrapeResult> {
  if (!url.includes("wikipedia.org/wiki/")) {
    throw new Error("URL must be a Wikipedia article URL");
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia returned ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const name = stripCitations(
    $("#firstHeading")
      .text()
      .trim()
      .replace(/\s*\(.*?\)\s*$/, "")
      .trim(),
  );
  if (!name) throw new Error("Could not find footballer name on page");

  const infobox = $("table.infobox.vcard").first();
  if (!infobox.length)
    throw new Error("No infobox found on this Wikipedia page");

  // Extract photo from infobox image row (avoids a separate API call)
  let photo_url: string | null = null;
  const infoboxImg = infobox
    .find("td.infobox-image img, td.infobox-above img")
    .first();
  if (infoboxImg.length) {
    const src = infoboxImg.attr("src") ?? "";
    if (src.includes("upload.wikimedia.org")) {
      const absolute = src.startsWith("//") ? `https:${src}` : src;
      // Bump thumbnail width to 330px for better quality
      photo_url = absolute.replace(/\/\d+px-/, "/330px-");
    }
  }

  let nationality: string | null = null;
  let position: string | null = null;
  let born: string | null = null;
  let height_cm: number | null = null;
  let birthplaceRaw: string | null = null;
  let fullName: string | null = null;

  // Pattern 1: "Representing" header (th.adr) used on many modern footballer pages.
  // The country name lives in .country-name a (link text is just "Brazil", "France", etc.)
  const representingTh = infobox.find("th.adr").first();
  if (representingTh.length) {
    const countryLink = representingTh.find(".country-name a").first();
    const text = countryLink.text().trim();
    if (text) nationality = text;
  }

  infobox.find("tr").each((_, row) => {
    // Only look at standard labeled rows (th.infobox-label + td); skip section headers
    const labelEl = $(row).find("th.infobox-label").first();
    if (!labelEl.length) return;
    const label = labelEl.text().trim().toLowerCase();
    const value = $(row).find("td").first();
    if (!value.length) return;

    if (label === "born" || label.includes("date of birth")) {
      born = value.find(".bday").text().trim() || null;

      // Pattern 2a: birthplace in same row as date of birth
      const birthplaceEl = value.find(".birthplace");
      const rawBorn = (birthplaceEl.length ? birthplaceEl : value)
        .text()
        .trim();
      const withoutDate = rawBorn
        .replace(
          /\(\d{4}-\d{2}-\d{2}\)|\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}|\(age\s+\d+\)/g,
          "",
        )
        .trim();
      if (withoutDate.includes(",")) {
        birthplaceRaw = withoutDate;
        if (!nationality) {
          const parts = withoutDate
            .split(",")
            .map((s) => stripCitations(s).trim())
            .filter(Boolean);
          const country = parts[parts.length - 1];
          if (
            country &&
            country.length > 1 &&
            country.length < 60 &&
            !/\d/.test(country)
          ) {
            nationality = country;
          }
        }
      }
    } else if (label === "place of birth" || label.includes("place of birth")) {
      // Pattern 2b: separate "Place of birth" row (e.g. Paolo Poggi, Diego Klimowicz)
      const raw = stripCitations(value.text().trim().replace(/\s+/g, " "));
      birthplaceRaw = raw;
      if (!nationality) {
        const parts = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const country = parts[parts.length - 1];
        if (
          country &&
          country.length > 1 &&
          country.length < 60 &&
          !/\d/.test(country)
        ) {
          nationality = country;
        }
      }
    } else if (label === "full name" || label === "full names") {
      const raw = stripCitations(value.text().trim().replace(/\s+/g, " "));
      if (raw) fullName = raw;
    } else if (label === "height") {
      const raw = value.text().trim();
      const mMatch = raw.match(/(\d+\.?\d*)\s*m\b/);
      if (mMatch) {
        height_cm = Math.round(parseFloat(mMatch[1]) * 100);
      } else {
        const ftInMatch = raw.match(/(\d+)\s*ft\s*(\d+)\s*in/);
        if (ftInMatch) {
          height_cm = Math.round(
            parseInt(ftInMatch[1]) * 30.48 + parseInt(ftInMatch[2]) * 2.54,
          );
        }
      }
    } else if (label.includes("position") && position === null) {
      // Take the FIRST "Position" row only. Some articles embed a second sport's
      // infobox (e.g. Clive Allen also has an American-football "Placekicker"
      // row) — the football position comes first, so keep it.
      // Position uses a Wikipedia hlist — collect <li> items and join them
      const items: string[] = [];
      value.find("li").each((_, li) => {
        const text = stripCitations($(li).text().trim());
        if (text) items.push(text);
      });
      position =
        items.length > 0
          ? items.join(", ")
          : stripCitations(value.text().trim().replace(/\s+/g, " ")) || null;
    } else if (
      // Pattern 3: explicit Nationality / Nationalities / Country of birth row
      label === "nationality" ||
      label === "nationalities" ||
      label.includes("country of birth") ||
      label.includes("country of citizenship")
    ) {
      // Prefer link text (excludes flag icon img titles); join multiple nationalities
      const links: string[] = [];
      value.find("a").each((_, a) => {
        if (!$(a).closest(".flagicon").length) {
          const text = $(a).text().trim();
          if (text) links.push(text);
        }
      });
      const text = links.join(", ") || value.text().trim().replace(/\s+/g, " ");
      if (text) nationality = text;
    }
  });

  const stints: ScrapeResult["stints"] = [];
  let currentSection: "senior" | "international" | null = null;
  let sortOrder = 0;

  infobox.find("tr").each((_, row) => {
    const header = $(row).find("th.infobox-header");
    if (header.length) {
      const headerText = header.text().trim().toLowerCase();
      if (headerText.includes("senior career")) {
        currentSection = "senior";
      } else if (
        headerText.includes("international career") ||
        headerText.includes("national team")
      ) {
        currentSection = "international";
      } else {
        currentSection = null;
      }
      return;
    }

    if (!currentSection) return;

    const yearsEl = $(row).find("th.infobox-label");
    const clubEl = $(row).find("td.infobox-data-a");
    const appsEl = $(row).find("td.infobox-data-b");
    const goalsEl = $(row).find("td.infobox-data-c");

    if (!yearsEl.length || !clubEl.length) return;

    // Skip the column header row (Years / Team / Apps / Gls)
    const yearsText =
      yearsEl.find("span").text().trim() || yearsEl.text().trim();
    if (!yearsText || yearsText.toLowerCase() === "years") return;

    const club = stripCitations(
      clubEl.clone().find("style, script").remove().end().text().trim(),
    );
    if (!club || club.toLowerCase() === "team") return;

    const clubHref = clubEl.find("a").first().attr("href");
    const clubWikiUrl =
      clubHref && clubHref.startsWith("/wiki/")
        ? `https://en.wikipedia.org${clubHref}`
        : null;

    const years = normalizeYears(stripCitations(yearsText));
    const apps = parseNumber(appsEl.text().trim());
    const goals = parseNumber(goalsEl.text().trim());

    const isLoan = /^\s*→/.test(club);
    const strippedClub = club.replace(/^\s*→\s*/, "").trim();
    const baseName = normalizeClubAlias(
      strippedClub.replace(/\s*\(loan\)\s*$/i, "").trim(),
    );
    const cleanClub = isLoan
      ? `→ ${baseName}${/\(loan\)/i.test(strippedClub) ? "" : " (loan)"}`
      : baseName;

    stints.push({
      sort_order: sortOrder++,
      years,
      club: cleanClub,
      club_wikipedia_url: clubWikiUrl,
      apps,
      goals,
      stint_type: currentSection,
    });
  });

  // Derive nationality from international career — highest priority.
  // Only accepts countries that appear in the FOOTBALLING_NATIONS list so that
  // "Great Britain", "Basque Country", "West Germany", "Italy B" etc. don't pollute the field.
  // Takes the last matching country to handle players who switched allegiance.
  const intlStints = stints.filter((s) => s.stint_type === "international");
  if (intlStints.length > 0) {
    const countries = intlStints
      .map((s) => extractCountryFromTeam(s.club))
      .filter((c): c is string => c !== null && FOOTBALLING_NATIONS.has(c))
      .map((c) => COUNTRY_NORMALIZE[c] ?? c);
    if (countries.length > 0) {
      nationality = countries[countries.length - 1];
    }
  }

  // Final fallback: if nationality is still unset, scan each comma-segment of the birthplace
  // against FOOTBALLING_NATIONS (last-to-first, so "Piacenza, Emilia-Romagna, Italy" → "Italy")
  if (!nationality && birthplaceRaw) {
    const segments = (birthplaceRaw as string)
      .split(",")
      .map((s: string) => stripCitations(s).trim())
      .filter(Boolean)
      .reverse();
    for (const seg of segments) {
      const normalized = COUNTRY_NORMALIZE[seg] ?? seg;
      if (FOOTBALLING_NATIONS.has(seg) || FOOTBALLING_NATIONS.has(normalized)) {
        nationality = COUNTRY_NORMALIZE[seg] ?? seg;
        break;
      }
    }
  }

  if (nationality) nationality = COUNTRY_NORMALIZE[nationality] ?? nationality;

  const styleText = findSectionText(
    $,
    "style of play",
    "playing style",
    "player profile",
    "style",
  );
  let all_positions: string | null = null;
  const foundPositions: string[] = [];
  if (styleText) {
    for (const p of extractPositionsFromText(styleText)) {
      if (!foundPositions.includes(p)) foundPositions.push(p);
    }
  }

  // Also check the first real paragraph of the article body
  const firstParaText = $("div.mw-parser-output > p")
    .not(".mw-empty-elt")
    .first()
    .text()
    .trim();
  if (firstParaText) {
    for (const p of extractPositionsFromText(firstParaText)) {
      if (!foundPositions.includes(p)) foundPositions.push(p);
    }
  }

  if (foundPositions.length > 0) all_positions = foundPositions.join(", ");

  const honours = scrapeHonours($);

  return {
    name,
    wikipedia_url: url,
    full_name: fullName,
    birthplace: birthplaceRaw
      ? (stripCitations(birthplaceRaw).replace(/\s+/g, " ").trim() || null)
      : null,
    nationality,
    position,
    all_positions,
    style_of_play: styleText ? stripCitations(styleText) : null,
    born,
    height_cm,
    photo_url,
    ...honours,
    stints,
  };
}

export interface ScrapeManagerResult {
  name: string;
  wikipedia_url: string;
  place_of_birth: string | null;
  born: string | null;
  stints: {
    sort_order: number;
    years: string;
    club: string;
    apps: number | null;
    goals: number | null;
    stint_type: "managerial";
  }[];
}

export async function scrapeManagerWikipedia(
  url: string,
): Promise<ScrapeManagerResult> {
  if (!url.includes("wikipedia.org/wiki/")) {
    throw new Error("URL must be a Wikipedia article URL");
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia returned ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const name = stripCitations(
    $("#firstHeading")
      .text()
      .trim()
      .replace(/\s*\(.*?\)\s*$/, "")
      .trim(),
  );
  if (!name) throw new Error("Could not find manager name on page");

  const infobox = $("table.infobox.vcard").first();
  if (!infobox.length)
    throw new Error("No infobox found on this Wikipedia page");

  let place_of_birth: string | null = null;
  let born: string | null = null;

  infobox.find("tr").each((_, row) => {
    const labelEl = $(row).find("th.infobox-label").first();
    if (!labelEl.length) return;
    const label = labelEl.text().trim().toLowerCase();
    const value = $(row).find("td").first();
    if (!value.length) return;

    if (label === "born" || label.includes("date of birth")) {
      born = value.find(".bday").text().trim() || null;

      // Some pages embed birthplace in the born row (td.birthplace or .birthplace span)
      const birthplaceEl = value.find(".birthplace");
      if (birthplaceEl.length) {
        const text = stripCitations(birthplaceEl.text().trim());
        if (text) place_of_birth = text;
      }
    } else if (label === "place of birth" || label.includes("place of birth")) {
      // Many manager pages have a dedicated "Place of birth" row (td.infobox-data.birthplace)
      const text = stripCitations(value.text().trim());
      if (text) place_of_birth = text;
    }
  });

  const stints: ScrapeManagerResult["stints"] = [];
  let inManagerialSection = false;
  let sortOrder = 0;

  infobox.find("tr").each((_, row) => {
    const header = $(row).find("th.infobox-header");
    if (header.length) {
      const headerText = header.text().trim().toLowerCase();
      inManagerialSection =
        headerText.includes("managerial career") ||
        headerText.includes("managing career") ||
        headerText.includes("coaching career");
      return;
    }

    if (!inManagerialSection) return;

    const yearsEl = $(row).find("th.infobox-label");
    // Manager infoboxes use td.infobox-data (colspan=3); footballer infoboxes use td.infobox-data-a/b/c
    const clubEl = $(row).find("td.infobox-data-a, td.infobox-data").first();
    const appsEl = $(row).find("td.infobox-data-b");
    const goalsEl = $(row).find("td.infobox-data-c");

    if (!yearsEl.length || !clubEl.length) return;

    const yearsText =
      yearsEl.find("span").text().trim() || yearsEl.text().trim();
    if (!yearsText || yearsText.toLowerCase() === "years") return;

    const club = stripCitations(
      clubEl.clone().find("style, script").remove().end().text().trim(),
    );
    if (!club || club.toLowerCase() === "team") return;

    const years = normalizeYears(stripCitations(yearsText));
    const apps = parseNumber(appsEl.text().trim());
    const goals = parseNumber(goalsEl.text().trim());

    stints.push({
      sort_order: sortOrder++,
      years,
      club: club.trim(),
      apps,
      goals,
      stint_type: "managerial",
    });
  });

  return { name, wikipedia_url: url, place_of_birth, born, stints };
}

export interface ScrapedXiPlayer {
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  squadNumber: number | null;
  wikipediaUrl: string | null;
}

export interface MatchScrapeResult {
  matchName: string;
  year: number;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homePlayers: ScrapedXiPlayer[];
  awayPlayers: ScrapedXiPlayer[];
}

export function isBbcSportUrl(url: string): boolean {
  return /news\.bbc\.co\.uk|bbc\.co\.uk\/sport/.test(url);
}

function bbcPosition(index: number): "GK" | "DF" | "MF" | "FW" {
  if (index === 0) return "GK";
  if (index <= 4) return "DF";
  if (index <= 8) return "MF";
  return "FW";
}

async function scrapeBbcMatchLineups(url: string): Promise<MatchScrapeResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
  });
  if (!res.ok) throw new Error(`BBC fetch failed: ${res.status}`);
  const html = await res.text();

  // Match title: "BBC SPORT | Football | FA Cup | Chelsea 1-2 Liverpool"
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const titleFull = titleMatch?.[1] ?? "";
  const titleParts = titleFull.split(" | ");
  const matchName =
    titleParts[titleParts.length - 1]?.trim() ?? titleFull.trim();

  // Year from publication date meta
  const dateMatch = html.match(
    /<meta[^>]+name="OriginalPublicationDate"[^>]+content="(\d{4})/i,
  );
  const year = dateMatch ? parseInt(dateMatch[1]) : new Date().getFullYear();

  // Competition from Section meta, refined by deriveCompetition
  const sectionMatch = html.match(
    /<meta[^>]+name="Section"[^>]+content="([^"]+)"/i,
  );
  const section = sectionMatch?.[1] ?? "";
  const competition = deriveCompetition(section || matchName);

  // Extract lineups: <b>Team:</b> or <b>Team</b>: followed by comma-separated players then <br
  // [^\r\n]*? stays on a single line; HTML tags stripped after capture for <a>-linked names.
  const lineupRe =
    /<b>([^:<\n]+?)(?::\s*<\/b>|<\/b>\s*:)\s*([^\r\n]*?)(?=<br)/gi;
  const lineups: Array<{ team: string; players: ScrapedXiPlayer[] }> = [];

  let m: RegExpExecArray | null;
  while ((m = lineupRe.exec(html)) !== null) {
    const team = m[1].trim();
    const raw = m[2]
      .replace(/<[^>]+>/g, " ") // strip HTML tags (e.g. <a> links around player names)
      .replace(/\.\s*$/, "")
      .trim();

    const players: ScrapedXiPlayer[] = raw
      .split(/,\s*/)
      .map((s) => s.replace(/\s*\([^)]*\d[^)]*\)$/, "").trim()) // strip (Sub 45) annotations
      .filter(Boolean)
      .slice(0, 11)
      .map((name, i) => ({
        name,
        position: bbcPosition(i),
        squadNumber: i + 1,
        wikipediaUrl: null,
      }));

    if (players.length >= 11) {
      lineups.push({ team, players });
    }
  }

  if (lineups.length < 2) {
    const found =
      lineups
        .map((l) => `"${l.team}" (${l.players.length} players)`)
        .join(", ") || "none";
    const snippet = html
      .substring(html.search(/<b>/i), html.search(/<b>/i) + 500)
      .replace(/\s+/g, " ");
    throw new Error(
      `Could not find two lineup tables on this page (found ${lineups.length}: ${found}). First <b> section: ${snippet}`,
    );
  }

  return {
    matchName,
    year,
    competition,
    homeTeam: lineups[0].team,
    awayTeam: lineups[1].team,
    homePlayers: lineups[0].players,
    awayPlayers: lineups[1].players,
  };
}

export async function scrapeMatchLineups(
  url: string,
): Promise<MatchScrapeResult> {
  if (isBbcSportUrl(url)) return scrapeBbcMatchLineups(url);

  if (!url.includes("wikipedia.org/wiki/")) {
    throw new Error("URL must be a Wikipedia article URL");
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia returned ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const rawTitle = $("#firstHeading").text().trim();
  const matchName = stripCitations(rawTitle);
  const yearMatch = matchName.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  const competition = deriveCompetition(matchName);

  // Try to find exactly two lineup tables (one per team)
  const lineupTables = findLineupTables($);

  if (lineupTables.length < 2) {
    throw new Error(
      `Could not find two lineup tables on this page (found ${lineupTables.length}). ` +
        `Try adding the match manually.`,
    );
  }

  const [homeTable, awayTable] = lineupTables.slice(0, 2);
  const [homeTeam, awayTeam] = extractTeamNames($, lineupTables);
  const homePlayers = parseLineupTable($, homeTable);
  const awayPlayers = parseLineupTable($, awayTable);

  if (homePlayers.length < 11 || awayPlayers.length < 11) {
    throw new Error(
      `Expected 11 players per team but found ${homePlayers.length} and ${awayPlayers.length}. ` +
        `Try adding the match manually.`,
    );
  }

  return {
    matchName,
    year,
    competition,
    homeTeam: normalizeClubAlias(homeTeam),
    awayTeam: normalizeClubAlias(awayTeam),
    homePlayers: homePlayers.slice(0, 11),
    awayPlayers: awayPlayers.slice(0, 11),
  };
}

function isPositionCode(text: string): boolean {
  // Accept any 2–5 uppercase letter code with no spaces or digits.
  // Wikipedia pages use many variants (RCB, LCB, RCM, LCM, IWB, CWB, …) beyond the common list.
  return /^[A-Z]{2,5}$/.test(text.trim());
}

function findLineupTables($: CheerioAPI): AnyNode[] {
  // Strategy 0: Wikipedia standard match lineup format.
  // These tables use style="font-size:90%" and have rows where the first <td>
  // is a position code (GK, RB, CB, LB, CM, etc.) followed by squad number in <b>.
  const newFormatCandidates: AnyNode[] = [];
  $("table").each((_i: number, table: AnyNode) => {
    const style = ($(table).attr("style") ?? "").replace(/\s+/g, "");
    if (!style.includes("font-size:90%")) return;
    let positionRowCount = 0;
    let hitSubs = false;
    $(table)
      .find("tr")
      .each((_j: number, row: AnyNode) => {
        if (hitSubs) return;
        const cells = $(row).find("td");
        if (!cells.length) return;
        const firstText = $(cells[0]).text().trim();
        if (/^substitutes?/i.test(firstText)) {
          hitSubs = true;
          return;
        }
        if (isPositionCode(firstText)) positionRowCount++;
      });
    if (positionRowCount >= 10) newFormatCandidates.push(table);
  });
  if (newFormatCandidates.length >= 2) return newFormatCandidates.slice(0, 2);

  // Strategy 1: wikitable format with No./Pos. column headers and 11+ numbered rows
  const candidates: AnyNode[] = [];
  $("table.wikitable").each((_i: number, table: AnyNode) => {
    const rows = $(table).find("tr");
    let playerRows = 0;
    let hasPositionCol = false;
    let hasNumberCol = false;

    rows.each((_j: number, row: AnyNode) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const firstCell = $(cells[0]).text().trim();
      const isNumberRow = /^\d{1,2}$/.test(firstCell);
      if (isNumberRow) playerRows++;

      $(row)
        .find("th")
        .each((_k: number, th: AnyNode) => {
          const text = $(th).text().trim().toLowerCase();
          if (/^pos\.?$|^position$/.test(text)) hasPositionCol = true;
          if (/^no\.?$|^#$/.test(text)) hasNumberCol = true;
        });
    });

    if ((hasPositionCol || hasNumberCol) && playerRows >= 11) {
      candidates.push(table);
    }
  });
  if (candidates.length >= 2) return candidates;

  // Fallback: find wikitables near section headings
  const sectionTables: AnyNode[] = [];
  const sectionHeadings = [
    "Starting_lineups",
    "Match_details",
    "Match",
    "Line-ups",
    "Lineups",
  ];

  for (const headingId of sectionHeadings) {
    const span = $(`span#${headingId}`).first();
    if (!span.length) continue;

    span
      .closest("h2, h3")
      .nextAll()
      .each((_i: number, sibling: AnyNode) => {
        const name =
          "name" in sibling ? (sibling as { name: string }).name : "";
        if (/^h[23]$/i.test(name)) return false;
        $(sibling)
          .find("table.wikitable")
          .each((_j: number, t: AnyNode) => {
            sectionTables.push(t);
          });
        if ($(sibling).is("table.wikitable")) sectionTables.push(sibling);
      });

    if (sectionTables.length >= 2) return sectionTables.slice(0, 2);
  }

  return candidates.length > 0 ? candidates : sectionTables;
}

function extractTeamNames(
  $: CheerioAPI,
  lineupTables: AnyNode[],
): [string, string] {
  // The two lineup tables sit in sibling <td>s inside a <table width="100%"> (lineup outer table).
  // Team names are in centred <b> elements inside the kit table that immediately precedes it.
  let outerTable: ReturnType<typeof $> | null = null;

  $("table").each((_i: number, t: AnyNode) => {
    if (outerTable) return;
    const tWidth = $(t).attr("width") ?? "";
    const tStyle = ($(t).attr("style") ?? "").replace(/\s+/g, "");
    if (tWidth !== "100%" && !/width:100%/.test(tStyle)) return;
    // Check if both lineup tables are descendants of this table
    let count = 0;
    lineupTables.forEach((lt) => {
      if (
        $(t)
          .find("table")
          .filter((_j: number, inner: AnyNode) => inner === lt).length > 0
      )
        count++;
    });
    if (count >= 2) outerTable = $(t);
  });

  if (outerTable) {
    const prevTable = (outerTable as ReturnType<typeof $>).prev("table");
    if (prevTable.length) {
      const names: string[] = [];
      prevTable.find("div").each((_i: number, div: AnyNode) => {
        if (names.length >= 2) return;
        if (!/text-align\s*:\s*center/i.test($(div).attr("style") ?? ""))
          return;
        const bText = stripCitations($(div).find("b").first().text().trim());
        if (
          bText &&
          bText.length > 1 &&
          bText.length < 60 &&
          !/^\d/.test(bText)
        ) {
          names.push(bText);
        }
      });
      if (names.length === 2) return [names[0], names[1]];
    }
  }

  // Fallback: per-table extraction
  return [
    extractTeamName($, lineupTables[0]),
    extractTeamName($, lineupTables[1]),
  ];
}

function extractTeamName($: CheerioAPI, table: AnyNode): string {
  // For font-size:90% lineup tables, the team name lives in the parent <td> —
  // either inside a centred div (formation diagram label) or as a standalone <b>.
  const tableStyle = ($(table).attr("style") ?? "").replace(/\s+/g, "");
  if (tableStyle.includes("font-size:90%")) {
    const parentTd = $(table).closest("td");
    if (parentTd.length) {
      let teamName = "";
      parentTd.find("div").each((_i: number, div: AnyNode) => {
        if (!/text-align\s*:\s*center/i.test($(div).attr("style") ?? ""))
          return;
        const bText = $(div).find("b").first().text().trim();
        if (bText && bText.length > 1 && bText.length < 60) {
          teamName = bText;
          return false;
        }
      });
      if (teamName) return stripCitations(teamName);

      // Fallback: first <b> in parent td not inside the lineup table itself
      parentTd.find("b").each((_i: number, b: AnyNode) => {
        if ($(b).closest("table").get(0) === $(table).get(0)) return;
        const text = $(b).text().trim();
        if (text && text.length > 2 && text.length < 60 && !/^\d/.test(text)) {
          teamName = text;
          return false;
        }
      });
      if (teamName) return stripCitations(teamName);
    }
  }

  const caption = $(table).find("caption").first().text().trim();
  if (caption) return stripCitations(caption);

  let teamName = "";
  $(table)
    .find("tr")
    .each((_i: number, row: AnyNode) => {
      const th = $(row).find("th[colspan]").first();
      if (th.length) {
        const text = stripCitations(th.text().trim());
        if (text && !/^(no\.?|pos\.?|player|#)$/i.test(text)) {
          teamName = text;
          return false;
        }
      }
    });
  if (teamName) return teamName;

  $(table)
    .find("tr:first-child th")
    .each((_i: number, th: AnyNode) => {
      const text = stripCitations($(th).text().trim());
      if (text && !/^(no\.?|pos\.?|player|#)$/i.test(text)) {
        teamName = text;
        return false;
      }
    });

  return teamName || "Unknown Team";
}

function parseLineupTable($: CheerioAPI, table: AnyNode): ScrapedXiPlayer[] {
  const players: ScrapedXiPlayer[] = [];
  let hitSubs = false;

  $(table)
    .find("tr")
    .each((_i: number, row: AnyNode) => {
      if (hitSubs) return;
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const firstCellText = $(cells[0]).text().trim();

      // Stop collecting at the substitutes divider
      if (/^substitutes?/i.test(firstCellText)) {
        hitSubs = true;
        return;
      }

      let squadNumber: number | null = null;
      let position: "GK" | "DF" | "MF" | "FW";
      let nameCell: ReturnType<CheerioAPI>;

      if (isPositionCode(firstCellText)) {
        // Wikipedia standard format: Pos | Squad# (in <b>) | Name
        position = normalizePosition(firstCellText);
        const numText =
          $(cells[1]).find("b").first().text().trim() ||
          $(cells[1]).text().trim();
        squadNumber = /^\d+$/.test(numText) ? parseInt(numText) : null;
        nameCell = $(cells.length >= 3 ? cells[2] : cells[1]);
      } else if (/^\d{1,2}$/.test(firstCellText)) {
        // Wikitable format: Squad# | Pos | Name
        squadNumber = parseInt(firstCellText) || null;
        const rawPos = stripCitations($(cells[1]).text().trim());
        position = normalizePosition(rawPos);
        nameCell = $(cells.length >= 3 ? cells[2] : cells[1]);
      } else {
        return;
      }

      // Skip flag image anchors (empty text) — player link is the first anchor with text
      const nameLink = nameCell
        .find("a")
        .filter((_: number, a: AnyNode) => $(a).text().trim().length > 0)
        .first();
      let name = nameLink.length
        ? stripCitations(nameLink.text().trim())
        : stripCitations(
            nameCell.clone().find("sup, small").remove().end().text().trim(),
          );

      name = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (!name) return;

      const href = nameLink.attr("href");
      const wikipediaUrl =
        href && href.startsWith("/wiki/")
          ? `https://en.wikipedia.org${href}`
          : null;

      players.push({ name, position, squadNumber, wikipediaUrl });
    });

  return players;
}

function normalizePosition(raw: string): "GK" | "DF" | "MF" | "FW" {
  const s = raw.trim().toUpperCase();
  if (/^GK$|^G$|^GOALKEEPER/.test(s)) return "GK";
  if (/^(DF|DEF|D|SW|WB|CB|RB|LB|RCB|LCB|RWB|LWB|IWB|CWB)$|^BACK/.test(s))
    return "DF";
  if (/^(FW|CF|ST|SS|RW|LW|RF|LF)$|^F$|^FOR|^WIN|^STR/.test(s)) return "FW";
  return "MF";
}

export function deriveCompetition(matchName: string): string {
  if (/UEFA Champions League/i.test(matchName)) return "UEFA Champions League";
  if (/UEFA Cup|UEFA Europa League/i.test(matchName))
    return "UEFA Europa League";
  if (/UEFA Super Cup/i.test(matchName)) return "UEFA Super Cup";
  if (/FIFA World Cup/i.test(matchName) || /World Cup Final/i.test(matchName))
    return "FIFA World Cup";
  if (/European Championship|UEFA Euro|Euro \d{4}/i.test(matchName))
    return "UEFA European Championship";
  if (/Copa América/i.test(matchName)) return "Copa América";
  if (/FA Cup/i.test(matchName)) return "FA Cup";
  if (/Copa del Rey/i.test(matchName)) return "Copa del Rey";
  if (/Coppa Italia/i.test(matchName)) return "Coppa Italia";
  if (/DFB-Pokal/i.test(matchName)) return "DFB-Pokal";
  if (/Intercontinental Cup/i.test(matchName)) return "Intercontinental Cup";
  if (/Club World Cup/i.test(matchName)) return "FIFA Club World Cup";
  // Strip leading year(s) to get the competition name
  return matchName
    .replace(/^\d{4}(?:[–\-]\d{2,4})?\s+/, "")
    .replace(/\s+final$/i, "")
    .trim();
}

export function normalizeClubAlias(club: string): string {
  const stripped = club.replace(/^→\s*/, "").replace(/\s*\((loan|trial)\)\s*$/i, "").trim();
  return CLUB_ALIASES[stripped] ?? stripped;
}

// Expands a wikitable into a full row×col grid, filling in cells that span
// multiple rows (rowspan) so every row has the correct element at every column.
function expandTableRowspans(
  $: CheerioAPI,
  table: ReturnType<CheerioAPI>,
): (AnyNode | null)[][] {
  const grid: (AnyNode | null)[][] = [];
  const pending = new Map<number, { el: AnyNode; rowsLeft: number }>();

  table.find("tr").each((_i, tr) => {
    const row: (AnyNode | null)[] = [];
    let srcCells = $(tr).children("td, th").toArray();
    let srcIdx = 0;

    for (let col = 0; srcIdx < srcCells.length || pending.size > 0; col++) {
      if (pending.has(col)) {
        const p = pending.get(col)!;
        row.push(p.el);
        p.rowsLeft--;
        if (p.rowsLeft === 0) pending.delete(col);
      } else if (srcIdx < srcCells.length) {
        const td = srcCells[srcIdx++];
        const rowspan = parseInt($(td).attr("rowspan") ?? "1") || 1;
        const colspan = parseInt($(td).attr("colspan") ?? "1") || 1;
        for (let c = 0; c < colspan; c++) {
          row.push(td);
          if (rowspan > 1)
            pending.set(col + c, { el: td, rowsLeft: rowspan - 1 });
        }
        col += colspan - 1;
      } else {
        break;
      }
    }

    if (row.length > 0) grid.push(row);
  });

  return grid;
}

function cellTextWithBr($: CheerioAPI, el: AnyNode): string {
  const clone = $(el).clone();
  clone.find("br").replaceWith(" / ");
  return clone.text().trim();
}

export interface CompetitionScrapeResult {
  name: string;
  topScorers: {
    name: string;
    wikipediaUrl: string;
    club: string;
    goals: number;
    rank: number;
  }[];
  hatTricks: {
    name: string;
    wikipediaUrl: string;
    forClub: string;
    againstClub: string;
  }[];
  topAssists: {
    name: string;
    wikipediaUrl: string;
    club: string;
    assists: number;
    rank: number;
  }[];
  playerOfSeason: { name: string; wikipediaUrl: string } | null;
  managerOfSeason: { name: string; wikipediaUrl: string } | null;
  pfaTeamOfYear: {
    name: string;
    wikipediaUrl: string | null;
    position: "GK" | "DF" | "MF" | "FW";
    squadNumber: number;
    club: string | null;
  }[];
}

function findTableAfterHeading(
  $: CheerioAPI,
  headingId: string,
): ReturnType<CheerioAPI> | null {
  // Handle both old format (<h4><span id="..."></span></h4>) and
  // new Wikipedia format (<div class="mw-heading"><h4 id="..."></h4></div>)
  const el = $(`#${headingId}`).first();
  if (!el.length) return null;

  const heading = el.is("h1,h2,h3,h4,h5,h6")
    ? el
    : el.closest("h1,h2,h3,h4,h5,h6");
  if (!heading.length) return null;

  const parentClass = heading.parent().attr("class") ?? "";
  const container =
    heading.parent().is("div") && parentClass.includes("mw-heading")
      ? heading.parent()
      : heading;

  let found: ReturnType<CheerioAPI> | null = null;
  container.nextAll().each((_i, sibling) => {
    if (found) return false;
    const sib = $(sibling);
    if (sib.is("h1,h2,h3,h4,h5,h6")) return false;
    if ((sib.attr("class") ?? "").includes("mw-heading")) return false;
    const table = sib.is("table.wikitable")
      ? sib
      : sib.find("table.wikitable").first();
    if (table.length) {
      found = table;
      return false;
    }
  });
  return found;
}

function findTableAfterAnyHeading(
  $: CheerioAPI,
  ...headingIds: string[]
): ReturnType<CheerioAPI> | null {
  for (const id of headingIds) {
    const t = findTableAfterHeading($, id);
    if (t) return t;
  }
  return null;
}

// Detect column indices from the <th> header row of a wikitable
function detectColumns(
  $: CheerioAPI,
  table: ReturnType<CheerioAPI>,
  ...labels: string[]
): number[] {
  let headerCells: ReturnType<CheerioAPI> | null = null;
  table.find("tr").each((_i, row) => {
    const ths = $(row).find("th");
    if (ths.length >= 2) {
      headerCells = ths;
      return false;
    }
  });
  if (!headerCells) return labels.map((_, i) => i);
  return labels.map((label) => {
    let found = -1;
    headerCells!.each((i, th) => {
      if ($(th).text().trim().toLowerCase().includes(label.toLowerCase())) {
        found = i;
        return false;
      }
    });
    return found;
  });
}

export async function scrapeCompetitionPage(
  url: string,
): Promise<CompetitionScrapeResult> {
  if (!url.includes("wikipedia.org/wiki/")) {
    throw new Error("URL must be a Wikipedia article URL");
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "GuessTheCareer-Admin/1.0" },
  });
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const name = stripCitations($("#firstHeading").text().trim());
  if (!name) throw new Error("Could not find page title");

  // Helper: find first <a> with non-empty text and a /wiki/ href (skips flag icon links)
  function wikiLink(el: ReturnType<CheerioAPI>) {
    return el
      .find("a")
      .filter((_i, a) => {
        const href = $(a).attr("href") ?? "";
        return (
          href.startsWith("/wiki/") &&
          !href.includes(":") &&
          $(a).text().trim().length > 0
        );
      })
      .first();
  }

  // --- Annual awards ---
  let playerOfSeason: CompetitionScrapeResult["playerOfSeason"] = null;
  let managerOfSeason: CompetitionScrapeResult["managerOfSeason"] = null;

  const awardsTable = findTableAfterAnyHeading(
    $,
    "Annual_awards",
    "Season_awards",
    "Awards",
    "Award",
  );
  if (awardsTable) {
    awardsTable.find("tr").each((_i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;
      const award = $(cells[0]).text().toLowerCase();
      // Winner cell is 1 (or 2 in tables with Award | Category | Winner | Club)
      for (let ci = 1; ci < cells.length; ci++) {
        const link = wikiLink($(cells[ci]));
        if (!link.length) continue;
        const winnerName = stripCitations(link.text().trim());
        const href = link.attr("href") ?? "";
        const winnerUrl = href.startsWith("/wiki/")
          ? `https://en.wikipedia.org${href}`
          : "";
        if (!winnerName || !winnerUrl) continue;
        if (
          award.includes("player of the season") ||
          award.includes("players' player") ||
          award.includes("player of the year")
        ) {
          if (!playerOfSeason) {
            playerOfSeason = { name: winnerName, wikipediaUrl: winnerUrl };
          }
        } else if (
          award.includes("manager of the season") ||
          award.includes("manager of the year")
        ) {
          if (!managerOfSeason) {
            managerOfSeason = { name: winnerName, wikipediaUrl: winnerUrl };
          }
        }
        break;
      }
    });
  }

  // Fallback: individual award heading paragraphs (e.g. 2002–03 style where each award has its own section)
  function extractAwardFromHeading(
    headingId: string,
  ): { name: string; wikipediaUrl: string } | null {
    const el = $(`#${headingId}`).first();
    if (!el.length) return null;
    const heading = el.is("h1,h2,h3,h4,h5,h6")
      ? el
      : el.closest("h1,h2,h3,h4,h5,h6");
    if (!heading.length) return null;
    const container =
      heading.parent().is("div") &&
      (heading.parent().attr("class") ?? "").includes("mw-heading")
        ? heading.parent()
        : heading;
    let found: { name: string; wikipediaUrl: string } | null = null;
    container.nextAll().each((_i, sib) => {
      if (found) return false;
      const s = $(sib);
      if (
        (s.attr("class") ?? "").includes("mw-heading") ||
        s.is("h1,h2,h3,h4,h5,h6")
      )
        return false;
      if (!s.is("p") || !s.text().trim()) return;
      const link = s
        .find('a[href^="/wiki/"]')
        .filter((_j: number, a: AnyNode) => {
          const href = $(a).attr("href") ?? "";
          return (
            !href.includes(":") &&
            !/award|season|year|trophy|boot|glove|_f\.c\.|_fc$/i.test(href) &&
            $(a).text().trim().length > 0
          );
        })
        .first();
      if (!link.length) return;
      const personName = stripCitations(link.text().trim());
      const href = link.attr("href") ?? "";
      if (personName && href) {
        found = {
          name: personName,
          wikipediaUrl: `https://en.wikipedia.org${href}`,
        };
        return false;
      }
    });
    return found;
  }

  if (!playerOfSeason) {
    for (const id of [
      "Premier_League_Player_of_the_Year",
      "Player_of_the_Season",
      "Player_of_the_Year",
    ]) {
      const result = extractAwardFromHeading(id);
      if (result) {
        playerOfSeason = result;
        break;
      }
    }
  }
  if (!managerOfSeason) {
    for (const id of [
      "Premier_League_Manager_of_the_Year",
      "Manager_of_the_Year",
      "Manager_of_the_Season",
    ]) {
      const result = extractAwardFromHeading(id);
      if (result) {
        managerOfSeason = result;
        break;
      }
    }
  }

  // --- Top scorers ---
  const topScorers: CompetitionScrapeResult["topScorers"] = [];
  const scorersTable = findTableAfterAnyHeading(
    $,
    "Top_scorers",
    "Top_goalscorers",
    "Goalscorers",
    "Top_goal_scorers",
    "Leading_scorers",
    "Pichichi_Trophy",
    "Capocannoniere",
  );
  if (scorersTable) {
    const [rankIdx, playerIdx, clubIdx, goalsIdx] = detectColumns(
      $,
      scorersTable,
      "rank",
      "player",
      "club",
      "goal",
    );
    const grid = expandTableRowspans($, scorersTable);
    let rankCounter = 1;
    for (const cells of grid) {
      if (!cells.length) continue;
      const playerCell = playerIdx >= 0 ? cells[playerIdx] : null;
      const link = playerCell ? wikiLink($(playerCell)) : null;
      if (!link || !link.length) continue;

      const playerName = stripCitations(link.text().trim());
      if (!playerName || playerName.toLowerCase() === "player") continue;
      const href = link.attr("href") ?? "";
      const wikiUrl = href.startsWith("/wiki/")
        ? `https://en.wikipedia.org${href}`
        : "";

      let rank = rankCounter;
      const rankCell = rankIdx >= 0 ? cells[rankIdx] : null;
      if (rankCell) {
        const r = parseInt($(rankCell).text().trim());
        if (!isNaN(r)) rank = r;
      }

      const clubCell = clubIdx >= 0 ? cells[clubIdx] : null;
      const club = clubCell
        ? normalizeClubAlias(stripCitations(cellTextWithBr($, clubCell)))
        : "";

      const goalsCell = goalsIdx >= 0 ? cells[goalsIdx] : null;
      const goals = goalsCell ? parseInt($(goalsCell).text().trim()) : NaN;

      if (!club || isNaN(goals)) continue;
      topScorers.push({
        name: playerName,
        wikipediaUrl: wikiUrl,
        club,
        goals,
        rank,
      });
      rankCounter = rank + 1;
    }
  }

  // Fallback: goalscorers in dl/dt + ul/li format (e.g. FIFA World Cup Statistics section)
  if (topScorers.length === 0) {
    const el = $("#Goalscorers").first();
    if (el.length) {
      const heading = el.is("h1,h2,h3,h4,h5,h6")
        ? el
        : el.closest("h1,h2,h3,h4,h5,h6");
      const container =
        heading.parent().is("div") &&
        (heading.parent().attr("class") ?? "").includes("mw-heading")
          ? heading.parent()
          : heading;

      let currentGoals = 0;
      let rank = 1;

      container.nextAll().each((_i, sib) => {
        const s = $(sib);
        if (
          (s.attr("class") ?? "").includes("mw-heading") ||
          s.is("h1,h2,h3,h4,h5,h6")
        )
          return false;

        if (s.is("dl")) {
          const dtText = s.find("dt").first().text().trim();
          const match = dtText.match(/^(\d+)\s+goals?$/i);
          currentGoals = match ? parseInt(match[1]) : 0;
          return;
        }

        if (currentGoals === 0) return;

        const liEls = s.is("ul") ? s.children("li") : s.find("ul li");
        if (!liEls.length) return;

        const entries: { name: string; wikiUrl: string; country: string }[] =
          [];
        liEls.each((_j, li) => {
          const liEl = $(li);
          const country =
            liEl.find(".flagicon img").first().attr("alt")?.trim() ?? "";
          const link = liEl
            .find("a")
            .filter((_k, a) => {
              const href = $(a).attr("href") ?? "";
              return (
                href.startsWith("/wiki/") &&
                !href.includes(":") &&
                $(a).text().trim().length > 0
              );
            })
            .first();
          if (!link.length) return;
          const playerName = stripCitations(link.text().trim());
          if (!playerName) return;
          const href = link.attr("href") ?? "";
          entries.push({
            name: playerName,
            wikiUrl: `https://en.wikipedia.org${href}`,
            country,
          });
        });

        for (const p of entries) {
          topScorers.push({
            name: p.name,
            wikipediaUrl: p.wikiUrl,
            club: p.country,
            goals: currentGoals,
            rank,
          });
        }
        rank += entries.length;
      });
    }
  }

  // --- Hat-tricks (optional) ---
  const hatTricks: CompetitionScrapeResult["hatTricks"] = [];
  const hatTable = findTableAfterAnyHeading(
    $,
    "Hat-tricks",
    "Hat_tricks",
    "Hat_trick",
  );
  if (hatTable) {
    const [playerIdx, forIdx, againstIdx] = detectColumns(
      $,
      hatTable,
      "player",
      "for",
      "against",
    );
    hatTable.find("tr").each((_i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return;
      const pIdx = playerIdx >= 0 ? playerIdx : 0;
      const fIdx = forIdx >= 0 ? forIdx : 1;
      const aIdx = againstIdx >= 0 ? againstIdx : 2;
      const link = wikiLink($(cells[pIdx]));
      if (!link.length) return;
      const playerName = stripCitations(link.text().trim());
      if (!playerName || playerName.toLowerCase() === "player") return;
      const href = link.attr("href") ?? "";
      const wikiUrl = href.startsWith("/wiki/")
        ? `https://en.wikipedia.org${href}`
        : "";
      const forClub = normalizeClubAlias(
        stripCitations($(cells[fIdx]).text().trim()),
      );
      const againstClub = normalizeClubAlias(
        stripCitations($(cells[aIdx]).text().trim()),
      );
      if (!forClub || !againstClub) return;
      hatTricks.push({
        name: playerName,
        wikipediaUrl: wikiUrl,
        forClub,
        againstClub,
      });
    });
  }

  // --- Top assists (optional) ---
  const topAssists: CompetitionScrapeResult["topAssists"] = [];
  const assistsTable = findTableAfterAnyHeading(
    $,
    "Top_assists",
    "Assists",
    "Most_assists",
  );
  if (assistsTable) {
    const [rankIdx, playerIdx, clubIdx, assistsColIdx] = detectColumns(
      $,
      assistsTable,
      "rank",
      "player",
      "club",
      "assist",
    );
    const grid = expandTableRowspans($, assistsTable);
    let rankCounter = 1;
    for (const cells of grid) {
      if (!cells.length) continue;
      const playerCell = playerIdx >= 0 ? cells[playerIdx] : null;
      const link = playerCell ? wikiLink($(playerCell)) : null;
      if (!link || !link.length) continue;

      const playerName = stripCitations(link.text().trim());
      if (!playerName || playerName.toLowerCase() === "player") continue;
      const href = link.attr("href") ?? "";
      const wikiUrl = href.startsWith("/wiki/")
        ? `https://en.wikipedia.org${href}`
        : "";

      let rank = rankCounter;
      const rankCell = rankIdx >= 0 ? cells[rankIdx] : null;
      if (rankCell) {
        const r = parseInt($(rankCell).text().trim());
        if (!isNaN(r)) rank = r;
      }

      const clubCell = clubIdx >= 0 ? cells[clubIdx] : null;
      const club = clubCell
        ? normalizeClubAlias(stripCitations(cellTextWithBr($, clubCell)))
        : "";

      const assistsCell = assistsColIdx >= 0 ? cells[assistsColIdx] : null;
      const assists = assistsCell
        ? parseInt($(assistsCell).text().trim())
        : NaN;

      if (!club || isNaN(assists)) continue;
      topAssists.push({
        name: playerName,
        wikipediaUrl: wikiUrl,
        club,
        assists,
        rank,
      });
      rankCounter = rank + 1;
    }
  }

  // --- PFA Team of the Year ---
  const pfaTeamOfYear: CompetitionScrapeResult["pfaTeamOfYear"] = [];
  const POSITION_MAP: Record<string, "GK" | "DF" | "MF" | "FW"> = {
    goalkeeper: "GK",
    defence: "DF",
    defenders: "DF",
    midfield: "MF",
    midfielders: "MF",
    attack: "FW",
    forwards: "FW",
    strikers: "FW",
  };
  const SQUAD_START: Record<"GK" | "DF" | "MF" | "FW", number> = {
    GK: 1,
    DF: 2,
    MF: 6,
    FW: 10,
  };
  const squadCounters: Record<"GK" | "DF" | "MF" | "FW", number> = {
    GK: 1,
    DF: 2,
    MF: 6,
    FW: 10,
  };

  // Some season pages render TOTY links as surname-only ("James", "Fàbregas").
  // The href carries the full name — derive it from the slug when it has more
  // name tokens than the visible text (e.g. /wiki/David_James_(footballer...) → "David James").
  const fullNameFromUrl = (url: string | null, fallback: string): string => {
    if (!url) return fallback;
    const slug = url.split("/wiki/")[1];
    if (!slug) return fallback;
    const decoded = decodeURIComponent(slug)
      .replace(/_/g, " ")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
    if (!decoded) return fallback;
    return decoded.split(/\s+/).length > fallback.split(/\s+/).length ? decoded : fallback;
  };

  // Find the wikitable whose first th contains "PFA Team of the Year"
  $("table.wikitable").each((_i, table) => {
    if (pfaTeamOfYear.length > 0) return false;
    const firstTh = $(table).find("th").first().text();
    if (
      !firstTh.toLowerCase().includes("pfa team of the year") &&
      !firstTh.toLowerCase().includes("pfa")
    )
      return;

    let currentPosition: "GK" | "DF" | "MF" | "FW" | null = null;
    squadCounters.GK = SQUAD_START.GK;
    squadCounters.DF = SQUAD_START.DF;
    squadCounters.MF = SQUAD_START.MF;
    squadCounters.FW = SQUAD_START.FW;

    $(table)
      .find("tr")
      .each((_j, row) => {
        const cells = $(row).find("td").toArray();
        if (!cells.length) return;

        // Club name is in parentheses in the same cell as the player link: "Player Name (Club)"
        const extractClubFromCell = (cell: AnyNode): string | null => {
          const cellText = stripCitations($(cell).text());
          const match = cellText.match(/\(([^)]{2,50})\)\s*$/);
          if (!match) return null;
          const normalized = normalizeClubAlias(match[1].trim());
          return normalized && normalized.length > 0 ? normalized : null;
        };

        // Position group row: first cell has bold text with position name
        const firstCellText = $(cells[0])
          .find("b")
          .first()
          .text()
          .trim()
          .toLowerCase();
        if (firstCellText) {
          const pos = POSITION_MAP[firstCellText];
          if (pos) {
            currentPosition = pos;
            for (let k = 1; k < cells.length; k++) {
              const link = wikiLink($(cells[k]));
              if (!link.length) continue;
              const playerName = stripCitations(link.text().trim());
              if (!playerName) continue;
              const href = link.attr("href") ?? "";
              const wikiUrl = href.startsWith("/wiki/")
                ? `https://en.wikipedia.org${href}`
                : null;
              pfaTeamOfYear.push({
                name: fullNameFromUrl(wikiUrl, playerName),
                wikipediaUrl: wikiUrl,
                position: currentPosition!,
                squadNumber: squadCounters[currentPosition!]++,
                club: extractClubFromCell(cells[k]),
              });
            }
            return;
          }
        }

        // Plain player row (some formats put each player in its own row under position header)
        if (!currentPosition) return;
        for (let k = 0; k < cells.length; k++) {
          const link = wikiLink($(cells[k]));
          if (!link.length) continue;
          const playerName = stripCitations(link.text().trim());
          if (!playerName) continue;
          const href = link.attr("href") ?? "";
          const wikiUrl = href.startsWith("/wiki/")
            ? `https://en.wikipedia.org${href}`
            : null;
          pfaTeamOfYear.push({
            name: fullNameFromUrl(wikiUrl, playerName),
            wikipediaUrl: wikiUrl,
            position: currentPosition!,
            squadNumber: squadCounters[currentPosition!]++,
            club: extractClubFromCell(cells[k]),
          });
        }
      });
  });

  // Fallback: pitch diagram format (absolutely-positioned player divs inside a role="img" container)
  if (pfaTeamOfYear.length === 0) {
    const totyEl = $("#PFA_Team_of_the_Year").first();
    if (totyEl.length) {
      const totyHeading = totyEl.is("h1,h2,h3,h4,h5,h6")
        ? totyEl
        : totyEl.closest("h1,h2,h3,h4,h5,h6");
      const totyContainer =
        totyHeading.parent().is("div") &&
        (totyHeading.parent().attr("class") ?? "").includes("mw-heading")
          ? totyHeading.parent()
          : totyHeading;
      interface PitchPlayer {
        name: string;
        wikipediaUrl: string | null;
        top: number;
        left: number;
      }
      const pitchPlayers: PitchPlayer[] = [];
      const inferPositionFromPitch = (
        top: number,
        height: number,
      ): "GK" | "DF" | "MF" | "FW" => {
        const pct = top / height;
        if (pct > 0.73) return "GK";
        if (pct > 0.48) return "DF";
        if (pct > 0.23) return "MF";
        return "FW";
      };
      totyContainer.nextAll().each((_i, sib) => {
        if (pitchPlayers.length > 0) return false;
        const s = $(sib);
        if (
          (s.attr("class") ?? "").includes("mw-heading") ||
          s.is("h1,h2,h3,h4,h5,h6")
        )
          return false;
        const d = s.find('[role="img"]').first();
        if (!d.length) return;
        d.children("div[style]").each((_j, div) => {
          const style = $(div).attr("style") ?? "";
          const topMatch = style.match(/top:\s*([\d.]+)px/);
          const leftMatch = style.match(/left:\s*([\d.]+)px/);
          if (!topMatch || !leftMatch) return;
          const link = $(div).find('a[href^="/wiki/"]').first();
          if (!link.length) return;
          const href = link.attr("href") ?? "";
          if (href.includes(":")) return;
          const playerName = stripCitations(link.text().trim());
          if (!playerName) return;
          pitchPlayers.push({
            name: playerName,
            wikipediaUrl: `https://en.wikipedia.org${href}`,
            top: parseFloat(topMatch[1]),
            left: parseFloat(leftMatch[1]),
          });
        });
        if (pitchPlayers.length > 0) return false;
      });
      if (pitchPlayers.length > 0) {
        const groups: Record<"GK" | "DF" | "MF" | "FW", PitchPlayer[]> = {
          GK: [],
          DF: [],
          MF: [],
          FW: [],
        };
        for (const p of pitchPlayers)
          groups[inferPositionFromPitch(p.top, 265)].push(p);
        for (const pos of ["GK", "DF", "MF", "FW"] as const) {
          groups[pos].sort((a, b) => a.left - b.left);
          let sqNum = SQUAD_START[pos];
          for (const p of groups[pos]) {
            pfaTeamOfYear.push({
              name: fullNameFromUrl(p.wikipediaUrl, p.name),
              wikipediaUrl: p.wikipediaUrl,
              position: pos,
              squadNumber: sqNum++,
              club: null,
            });
          }
        }
      }
    }
  }

  return {
    name,
    topScorers,
    hatTricks,
    topAssists,
    playerOfSeason,
    managerOfSeason,
    pfaTeamOfYear,
  };
}

function findSectionText($: CheerioAPI, ...targets: string[]): string {
  const normalizedTargets = targets.map((t) => t.toLowerCase());
  let result = "";
  $("h2, h3, h4, h5").each((_, el) => {
    const headingText = $(el)
      .text()
      .trim()
      .toLowerCase()
      .replace(/[_\-]+/g, " ");
    if (!normalizedTargets.some((t) => headingText.includes(t))) return;
    const headingLevel =
      parseInt((el as unknown as { name: string }).name[1]) || 2;
    const heading = $(el);
    const container =
      heading.parent().is("div") &&
      (heading.parent().attr("class") ?? "").includes("mw-heading")
        ? heading.parent()
        : heading;
    const parts: string[] = [];
    container.nextAll().each((_, sib) => {
      const s = $(sib);
      const sibClass = s.attr("class") ?? "";
      if (sibClass.includes("mw-heading")) {
        // Stop at same/higher level section; skip sub-headings and continue
        const m = sibClass.match(/mw-heading(\d)/);
        if (!m || parseInt(m[1]) <= headingLevel) return false;
        return;
      }
      if (s.is("h1,h2,h3,h4,h5,h6")) {
        const node = s.get(0);
        const tagName =
          node && "name" in (node as object)
            ? (node as { name: string }).name
            : "h2";
        if ((parseInt(tagName[1]) || 2) <= headingLevel) return false;
        return;
      }
      if (s.is("p")) {
        const text = s.text().trim();
        if (text) parts.push(text);
      }
    });
    result = parts.join(" ");
    return false;
  });
  return result;
}

const POSITION_TERMS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bfull[\s-]?back\b/i, name: "Full-back" },
  { pattern: /\bright[\s-]?wing[\s-]?back\b/i, name: "Right wing-back" },
  { pattern: /\bleft[\s-]?wing[\s-]?back\b/i, name: "Left wing-back" },
  { pattern: /\bright[\s-]?back\b/i, name: "Right back" },
  { pattern: /\bleft[\s-]?back\b/i, name: "Left back" },
  { pattern: /\bgoalkeeper\b/i, name: "Goalkeeper" },
  {
    pattern: /\bcentr[ae][\s-]?back\b|\bcentral[\s-]?defender\b|\bsweeper\b/i,
    name: "Centre-back",
  },
  {
    pattern: /\bdefensive[\s-]?midfielder\b|\bholding[\s-]?midfielder\b/i,
    name: "Defensive midfielder",
  },
  {
    pattern: /\battacking[\s-]?midfielder\b|\btrequartista\b/i,
    name: "Attacking midfielder",
  },
  { pattern: /\bright[\s-]?wing(?:er)?\b/i, name: "Right winger" },
  { pattern: /\bleft[\s-]?wing(?:er)?\b/i, name: "Left winger" },
  {
    pattern:
      /\bwinger\b|\bon the wing\b|\bwide forward\b|\bwide midfielder\b|\bwide player\b/i,
    name: "Winger",
  },
  { pattern: /\bcentral[\s-]?midfielder\b/i, name: "Central midfielder" },
  { pattern: /\bstrike[r]?\b|\bcentr[ae][\s-]?forward\b/i, name: "Striker" },
  { pattern: /\bsecond[\s-]?striker\b/i, name: "Second striker" },
  { pattern: /\bforward\b/i, name: "Forward" },
  { pattern: /\bmidfield(?:er)?\b/i, name: "Midfielder" },
];

function extractPositionsFromText(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, name } of POSITION_TERMS) {
    if (pattern.test(text) && !found.includes(name)) found.push(name);
  }
  return found;
}

function stripCitations(text: string): string {
  // Remove Wikipedia footnote markers: [1], [note 1], [a], etc.
  return text.replace(/\s*\[[^\]]*\]/g, "").trim();
}

function extractCountryFromTeam(team: string): string | null {
  const cleaned = stripCitations(team)
    .replace(/\s*\([^)]*\)\s*$/, "") // strip trailing parentheticals e.g. "(O.P.)", "(beach)"
    .replace(
      /\s+(U[-\s]?\d+|Under[-\s]?\d+|B|XI|Olympics?|Olympic\s+[Tt]eam)$/i,
      "",
    )
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeYears(raw: string): string {
  // Replace various dash-like characters with en-dash
  return raw.replace(/[-‒—]/g, "–").trim();
}

function parseNumber(raw: string): number | null {
  // Strip parentheses (goals are shown as "(250)")
  const cleaned = raw.replace(/[()]/g, "").replace(/,/g, "").trim();
  // "−" (U+2212 minus sign) means unknown
  if (!cleaned || cleaned === "−" || cleaned === "-") return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

export interface ClubKitColours {
  home_body: string | null
  home_leftarm: string | null
  home_rightarm: string | null
  home_shorts: string | null
  home_socks: string | null
  home_pattern: string | null  // 'stripes'|'hoops'|'halves'|'sash'|'sleeves'|'band'|'check'|'penguin'|null
}

/**
 * Classify a pattern from its Wikipedia template name.
 * Only matches old-style generic filenames — returns null for modern
 * season-specific names like "_celtic2627h" so the caller can fetch the SVG.
 */
function classifyPattern(raw: string): string | null {
  const val = raw.toLowerCase()
  if (/stripe|pinstripe/.test(val)) return 'stripes'
  if (/hoop|ring/.test(val)) return 'hoops'
  if (/half|halv|\bleft\b|\bright\b/.test(val)) return 'halves'
  if (/diagonal|sash/.test(val)) return 'sash'
  if (/\bband\b/.test(val)) return 'band'
  if (/quarter|check|bloc/.test(val)) return 'check'
  if (/centre|center|centreline|panel/.test(val)) return 'penguin'
  return null  // unknown — caller should fetch the SVG
}

function normHex(h: string): string {
  const c = h.replace('#', '').toUpperCase()
  return c.length === 3 ? c[0] + c[0] + c[1] + c[1] + c[2] + c[2] : c
}

/**
 * Fetch the Wikimedia Commons kit body PNG for a given pattern_b1 value,
 * parse the PNG binary to extract the colour palette and pixel layout, and
 * return the secondary colour and pattern type.
 *
 * Modern Wikipedia kit templates use season-specific filenames like
 * "_celtic2627h" which map to Kit_body_celtic2627h.png on Commons.
 *
 * We look up the direct CDN URL via the Commons imageinfo API, then:
 *  1. Parse the PNG PLTE chunk (indexed-colour PNGs) for palette colours.
 *  2. Decompress IDAT and sample the centre column / centre row to determine
 *     whether colours alternate horizontally (hoops) or vertically (stripes).
 *  3. Filter out the body colour and white to find the secondary colour.
 */
async function fetchPatternPng(
  rawPattern: string,
  bodyHex: string
): Promise<{ pattern: string | null; secondary: string | null }> {
  const name     = rawPattern.replace(/^_/, '').replace(/\.[^.]+$/, '')
  const fileName = `Kit_body_${name}.png`
  const bodyNorm = normHex(bodyHex)
  const { inflateSync } = await import('zlib')

  // ── 1. Resolve direct CDN URL via Commons imageinfo API ───────────────────
  let pngUrl: string | null = null
  try {
    const apiRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + fileName)}&prop=imageinfo&iiprop=url&format=json`,
      { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } }
    )
    if (apiRes.ok) {
      const apiData = await apiRes.json() as { query?: { pages?: Record<string, { imageinfo?: { url: string }[] }> } }
      const pages = apiData.query?.pages ?? {}
      const page  = Object.values(pages)[0]
      pngUrl = page?.imageinfo?.[0]?.url ?? null
    }
  } catch { /* fall through */ }

  if (!pngUrl) return { pattern: null, secondary: null }

  // ── 2. Fetch the PNG binary ────────────────────────────────────────────────
  let buf: Buffer
  try {
    const pngRes = await fetch(pngUrl, { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } })
    if (!pngRes.ok) return { pattern: null, secondary: null }
    buf = Buffer.from(await pngRes.arrayBuffer())
  } catch {
    return { pattern: null, secondary: null }
  }

  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!PNG_SIG.every((b, i) => buf[i] === b)) return { pattern: null, secondary: null }

  // ── 3. Parse PNG chunks ───────────────────────────────────────────────────
  let width = 0, height = 0, colorType = 0
  const palette: [number, number, number][] = []
  const idatParts: Buffer[] = []
  let tRNS: number[] | null = null

  let pos = 8
  while (pos + 12 <= buf.length) {
    const len  = buf.readUInt32BE(pos)
    const type = buf.slice(pos + 4, pos + 8).toString('ascii')
    const data = buf.slice(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width     = data.readUInt32BE(0)
      height    = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'PLTE') {
      for (let i = 0; i + 2 < data.length; i += 3) palette.push([data[i], data[i + 1], data[i + 2]])
    } else if (type === 'tRNS') {
      tRNS = [...data]
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }

  if (width === 0 || height === 0 || idatParts.length === 0) return { pattern: null, secondary: null }

  // ── 4. Decompress IDAT and apply PNG filters ──────────────────────────────
  let rawPixelRows: number[][] | null = null  // one entry per row: array of palette indices or channel bytes
  try {
    const compressed = Buffer.concat(idatParts)
    const raw        = inflateSync(compressed)

    // bytes-per-pixel: indexed=1, RGB=3, RGBA=4
    const bpp = colorType === 3 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 1
    const stride = width * bpp

    let rawPos  = 0
    const rows: number[][] = []
    let prevRow = new Array<number>(stride).fill(0)

    for (let y = 0; y < height && rawPos + 1 + stride <= raw.length; y++) {
      const filter  = raw[rawPos++]
      const rowBytes = [...raw.slice(rawPos, rawPos + stride)]
      rawPos += stride

      const cur = new Array<number>(stride)
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? cur[x - bpp] : 0
        const b = prevRow[x]
        const c = x >= bpp ? prevRow[x - bpp] : 0
        let v: number
        switch (filter) {
          case 0: v = rowBytes[x]; break
          case 1: v = (rowBytes[x] + a) & 0xFF; break
          case 2: v = (rowBytes[x] + b) & 0xFF; break
          case 3: v = (rowBytes[x] + Math.floor((a + b) / 2)) & 0xFF; break
          case 4: {
            const p = a + b - c
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
            v = (rowBytes[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xFF
            break
          }
          default: v = rowBytes[x]
        }
        cur[x] = v
      }
      rows.push(cur)
      prevRow = cur
    }
    rawPixelRows = rows
  } catch { /* will fall back to palette-only analysis */ }

  // Helper: pixel index → hex colour (handles indexed and RGB)
  const rowToHexAt = (row: number[] | undefined, x: number): string | null => {
    if (!row) return null
    if (colorType === 3) {
      const idx = row[x]
      if (idx >= palette.length) return null
      if (tRNS && (tRNS[idx] ?? 255) < 128) return null  // transparent
      const [r, g, b] = palette[idx]
      return (r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')).toUpperCase()
    }
    if (colorType === 2) {
      const [r, g, b] = [row[x * 3], row[x * 3 + 1], row[x * 3 + 2]]
      return (r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')).toUpperCase()
    }
    if (colorType === 6) {
      if (row[x * 4 + 3] < 128) return null  // transparent
      const [r, g, b] = [row[x * 4], row[x * 4 + 1], row[x * 4 + 2]]
      return (r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')).toUpperCase()
    }
    return null
  }

  // ── 5. Find secondary colour ──────────────────────────────────────────────
  const colorFreq = new Map<string, number>()
  if (rawPixelRows) {
    for (const row of rawPixelRows) {
      for (let x = 0; x < width; x++) {
        const hex = rowToHexAt(row, x)
        if (hex && hex !== bodyNorm && hex !== 'FFFFFF') colorFreq.set(hex, (colorFreq.get(hex) ?? 0) + 1)
      }
    }
  } else if (colorType === 3 && palette.length > 0) {
    // palette-only fallback (no pixel data)
    palette.forEach(([r, g, b], i) => {
      if (tRNS && (tRNS[i] ?? 255) < 128) return
      const hex = (r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')).toUpperCase()
      if (hex !== bodyNorm && hex !== 'FFFFFF') colorFreq.set(hex, (colorFreq.get(hex) ?? 0) + 1)
    })
  }

  if (colorFreq.size === 0) return { pattern: null, secondary: null }

  const secondary = [...colorFreq.entries()].sort((a, b) => b[1] - a[1])[0][0]

  // ── 6. Classify pattern from pixel transitions ────────────────────────────
  let pattern: string | null = null
  if (rawPixelRows && width > 0 && height > 0) {
    const cx = Math.floor(width / 2)
    const cy = Math.floor(height / 2)

    // Count how many times the colour changes along the centre column (vertical scan)
    let vertTransitions = 0
    let prevVert: string | null = null
    for (const row of rawPixelRows) {
      const hex = rowToHexAt(row, cx)
      if (hex && hex !== prevVert) { if (prevVert !== null) vertTransitions++; prevVert = hex }
    }

    // Count transitions along the centre row (horizontal scan)
    const midRow = rawPixelRows[cy]
    let horzTransitions = 0
    let prevHorz: string | null = null
    for (let x = 0; x < width; x++) {
      const hex = rowToHexAt(midRow, x)
      if (hex && hex !== prevHorz) { if (prevHorz !== null) horzTransitions++; prevHorz = hex }
    }

    if (vertTransitions >= 3)      pattern = 'hoops'    // many row-changes = horizontal bands
    else if (horzTransitions >= 3) pattern = 'stripes'  // many column-changes = vertical stripes
    else if (vertTransitions >= 1 && horzTransitions <= 1) pattern = 'band'    // one horizontal band
    else if (horzTransitions >= 1 && vertTransitions <= 1) pattern = 'penguin' // one vertical panel
    else if (vertTransitions === 1 || horzTransitions === 1) pattern = 'halves'
    // sash would require diagonal path detection — leave as null for now
  }

  return { pattern, secondary }
}

export async function scrapeClubKitColours(wikiUrl: string): Promise<ClubKitColours> {
  const title = wikiUrl.split('/wiki/')[1]
  if (!title) throw new Error(`Invalid Wikipedia URL: ${wikiUrl}`)

  const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(decodeURIComponent(title))}&prop=wikitext&format=json`
  const res = await fetch(apiUrl, { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } })
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`)

  const data = await res.json() as { parse?: { wikitext?: { '*': string } } }
  const wikitext = data.parse?.wikitext?.['*'] ?? ''

  function getHex(field: string): string | null {
    const match = wikitext.match(new RegExp(`\\|\\s*${field}\\s*=\\s*#?([a-fA-F0-9]{3,6})`))
    if (!match) return null
    const hex = match[1].toUpperCase()
    return hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex
  }

  function getRawPattern(field: string): string | null {
    const match = wikitext.match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^|\\n\\r}]+)`))
    return match ? match[1].trim() : null
  }

  // ── Base colours from wikitext ─────────────────────────────────────────────
  const home_body     = getHex('body1')
  const home_rightarm = getHex('rightarm1')
  const home_shorts   = getHex('shorts1')
  const home_socks    = getHex('socks1')
  let   home_leftarm  = getHex('leftarm1')

  // ── Pattern detection ──────────────────────────────────────────────────────
  // Modern Wikipedia pages use season-specific filenames like "_celtic2627h"
  // instead of generic "_hoops". classifyPattern handles old-style names; for
  // everything else we fetch the actual SVG from Wikimedia Commons.
  const rawPattern = getRawPattern('pattern_b1') ?? null
  let home_pattern = rawPattern ? classifyPattern(rawPattern) : null

  if (rawPattern && home_body) {
    const needsSecondary = !home_leftarm || home_leftarm === home_body
    const needsPattern   = home_pattern === null

    if (needsSecondary || needsPattern) {
      // Small polite delay before the extra request
      await new Promise(resolve => setTimeout(resolve, 300))
      const { pattern: pngPattern, secondary: pngSecondary } = await fetchPatternPng(rawPattern, home_body)

      if (needsPattern && pngPattern)     home_pattern = pngPattern
      if (needsSecondary && pngSecondary) home_leftarm = pngSecondary
    }
  }

  // ── Fallback: differing arm colour with no explicit body pattern → sleeves ──
  if (!home_pattern && home_body && home_leftarm && home_leftarm !== home_body) {
    home_pattern = 'sleeves'
  }

  return { home_body, home_leftarm, home_rightarm, home_shorts, home_socks, home_pattern }
}

// ── Ballon d'Or scraper ────────────────────────────────────────────────────────

export interface BallonDorScrapeResult {
  year: number
  players: {
    rank: number
    name: string
    nationality: string | null
    club: string
    points: number | null
    wikipedia_url: string | null
  }[]
}

export async function scrapeBallonDorPage(url: string): Promise<BallonDorScrapeResult> {
  if (!url.includes('wikipedia.org/wiki/')) {
    throw new Error('URL must be a Wikipedia article URL')
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' },
  })
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  // Extract year from page title
  const titleText = $('#firstHeading').text().trim()
  const yearMatch = titleText.match(/\b(\d{4})\b/)
  if (!yearMatch) throw new Error(`Could not determine year from page title: "${titleText}"`)
  const year = parseInt(yearMatch[1], 10)

  // Find the main voting/results table — look for wikitable with "Rank" and "Name"/"Player" headers
  let votingTable: ReturnType<typeof $> | null = null
  $('table.wikitable').each((_i, tbl) => {
    if (votingTable) return false
    const headerText = $(tbl).find('th').map((_j, th) => $(th).text().trim().toLowerCase()).toArray().join(' ')
    if ((headerText.includes('rank') || headerText.includes('#')) &&
        (headerText.includes('name') || headerText.includes('player'))) {
      votingTable = $(tbl)
      return false
    }
  })

  if (!votingTable) throw new Error('Could not find voting table on Ballon d\'Or page')

  const table = votingTable as ReturnType<typeof $>

  // Detect column indices
  const [rankIdx, playerIdx, nationalityIdx, clubIdx, pointsIdx] = detectColumns(
    $,
    table,
    'rank',
    'player',
    'nationality',
    'club',
    'points',
  )

  // Expand rowspans for correct cell indexing
  const grid = expandTableRowspans($, table)

  const players: BallonDorScrapeResult['players'] = []
  let skippedHeader = false

  for (const row of grid) {
    if (row.length < 2) continue

    // Skip header rows (cells that are <th> elements)
    const firstCell = row[0]
    if (firstCell && $(firstCell).is('th')) continue

    // Skip separator/spacer rows
    if (!firstCell) continue

    // After first non-header row we're in data
    skippedHeader = true

    // Extract rank
    const rIdx = rankIdx >= 0 ? rankIdx : 0
    const rankRaw = row[rIdx] ? stripCitations($(row[rIdx]!).text().trim()) : ''
    const rank = parseInt(rankRaw.replace(/[^\d]/g, '')) || 0
    if (rank === 0 && skippedHeader) continue // blank or non-numeric row

    // Extract player name — prefer first wiki link in the player cell
    const pIdx = playerIdx >= 0 ? playerIdx : 1
    const playerCell = row[pIdx]
    if (!playerCell) continue
    const playerCellEl = $(playerCell)
    const nameLink = playerCellEl.find('a').filter((_k, a) => {
      const href = $(a).attr('href') ?? ''
      return href.startsWith('/wiki/') && !href.includes(':') && $(a).text().trim().length > 0
    }).first()
    const name = nameLink.length
      ? stripCitations(nameLink.text().trim())
      : stripCitations(playerCellEl.text().trim())
    if (!name) continue
    const nameLinkHref = nameLink.attr('href') ?? ''
    const wikipedia_url = nameLinkHref.startsWith('/wiki/')
      ? `https://en.wikipedia.org${nameLinkHref}`
      : null

    // Extract nationality — use first flag icon alt text; fall back to first line of cell text
    let nationality: string | null = null
    if (nationalityIdx >= 0 && row[nationalityIdx]) {
      const natCell = $(row[nationalityIdx]!)
      const flagAlt = natCell.find('.flagicon img, .flag-icon img').first().attr('alt')?.trim()
      if (flagAlt) {
        nationality = flagAlt
      } else {
        // Some pages list multiple nationalities as plain text; take only the first
        const raw = stripCitations(natCell.text().trim())
        nationality = raw.split(/[\n/]+/)[0].trim() || null
      }
    }

    // Extract club — may have <br> separating multiple clubs
    let club = ''
    if (clubIdx >= 0 && row[clubIdx]) {
      const clubCell = $(row[clubIdx]!).clone()
      clubCell.find('br').replaceWith(' / ')
      club = stripCitations(clubCell.text().trim())
        .split(/\s*\/\s*/)
        .map(c => normalizeClubAlias(c.trim()))
        .filter(Boolean)
        .join(' / ')
    } else {
      club = ''
    }
    if (!club) club = 'Unknown'

    // Extract points / percentage
    let points: number | null = null
    if (pointsIdx >= 0 && row[pointsIdx]) {
      const ptsRaw = stripCitations($(row[pointsIdx]!).text().trim())
      const ptsNum = parseFloat(ptsRaw.replace(/[^0-9.]/g, ''))
      if (!isNaN(ptsNum)) points = ptsNum
    }

    players.push({ rank, name, nationality, club, points, wikipedia_url })
  }

  if (players.length === 0) throw new Error('No players found in Ballon d\'Or table')

  return { year, players }
}

// ── World Cup Squads scraper ──────────────────────────────────────────────────

export interface WorldCupSquadScrapeResult {
  year: number
  squads: {
    team: string
    players: {
      shirt_number: number | null
      position: string | null
      name: string
      club: string
      wikipedia_url: string | null
    }[]
  }[]
}

export async function scrapeWorldCupSquadsPage(url: string): Promise<WorldCupSquadScrapeResult> {
  if (!url.includes('wikipedia.org/wiki/')) {
    throw new Error('URL must be a Wikipedia article URL')
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' },
  })
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const titleText = $('#firstHeading').text().trim()
  const yearMatch = titleText.match(/\b(\d{4})\b/)
  if (!yearMatch) throw new Error(`Could not determine year from page title: "${titleText}"`)
  const year = parseInt(yearMatch[1], 10)

  const squads: WorldCupSquadScrapeResult['squads'] = []

  $('table.wikitable').each((_i, tbl) => {
    const table = $(tbl)

    // Find the nearest preceding team heading (h3/h4) — may be inside a div.mw-heading wrapper
    let teamName = ''
    let cur = $(tbl).prev()
    while (cur.length && !teamName) {
      // Check if this sibling IS a heading or CONTAINS one (handles div.mw-heading wrappers)
      const headingEl = cur.is('h3, h4') ? cur : cur.find('h3, h4').last()
      if (headingEl.length) {
        const candidate = headingEl.text()
          .replace(/\[.*?\]/g, '')   // strip [edit] etc
          .trim()
        if (candidate) teamName = candidate
      }
      if (!teamName) cur = cur.prev()
    }
    if (!teamName) return

    // Detect columns: shirt number, position, player name, club
    const [noIdx, posIdx, playerIdx, clubIdx] = detectColumns(
      $, table, 'no', 'pos', 'player', 'club'
    )

    // Must have at least a player column
    if (playerIdx < 0) return

    const grid = expandTableRowspans($, table)
    const players: WorldCupSquadScrapeResult['squads'][0]['players'] = []

    for (const row of grid) {
      if (row.length < 2) continue
      const firstCell = row[0]
      if (firstCell && $(firstCell).is('th')) continue
      if (!firstCell) continue

      // Extract position — must be GK/DF/MF/FW
      // Wikipedia uses a hidden sort-key span (e.g. <span style="display:none">1</span>GK)
      // so we strip hidden elements before reading the text
      let position: string | null = null
      if (posIdx >= 0 && row[posIdx]) {
        const posCell = $(row[posIdx]!).clone()
        posCell.find('[style*="display:none"]').remove()
        const posText = stripCitations(posCell.text().trim()).toUpperCase()
        if (['GK', 'DF', 'MF', 'FW'].includes(posText)) {
          position = posText
        } else {
          continue // not a player data row
        }
      }

      // Extract player name + wikipedia_url
      const pIdx = playerIdx >= 0 ? playerIdx : 1
      const playerCell = row[pIdx]
      if (!playerCell) continue
      const playerCellEl = $(playerCell)
      const nameLink = playerCellEl.find('a').filter((_k, a) => {
        const href = $(a).attr('href') ?? ''
        return href.startsWith('/wiki/') && !href.includes(':') && $(a).text().trim().length > 0
      }).first()
      const name = nameLink.length
        ? stripCitations(nameLink.text().trim())
        : stripCitations(playerCellEl.text().trim())
      if (!name) continue
      const nameLinkHref = nameLink.attr('href') ?? ''
      const wikipedia_url = nameLinkHref.startsWith('/wiki/')
        ? `https://en.wikipedia.org${nameLinkHref}`
        : null

      // Extract shirt number
      let shirt_number: number | null = null
      if (noIdx >= 0 && row[noIdx]) {
        const noRaw = stripCitations($(row[noIdx]!).text().trim())
        const n = parseInt(noRaw.replace(/\D/g, ''))
        if (!isNaN(n)) shirt_number = n
      }

      // Extract club
      let club = 'Unknown'
      if (clubIdx >= 0 && row[clubIdx]) {
        const clubCell = $(row[clubIdx]!).clone()
        clubCell.find('br').replaceWith(' / ')
        const raw = stripCitations(clubCell.text().trim())
          .split(/\s*\/\s*/)[0]
          .trim()
        club = normalizeClubAlias(raw) || 'Unknown'
      }

      players.push({ shirt_number, position, name, club, wikipedia_url })
    }

    // Only include squads that look like real national team squads
    if (players.length >= 10) {
      squads.push({ team: teamName, players })
    }
  })

  if (squads.length === 0) throw new Error('No squads found on this page')

  return { year, squads }
}

// ── Transfer History (transfermarkt) ────────────────────────────────────────
// Scrapes a league-season transfers page, e.g.
// https://www.transfermarkt.com/laliga/transfers/wettbewerb/ES1/saison_id/1997
// Each club box has an "In" (arrivals) and "Out" (departures) table; a transfer
// appears in both the buying club's In and the selling club's Out, so we dedupe.

export interface TransfermarktTransfer {
  player_name: string
  nationality: string | null
  position: 'GK' | 'DF' | 'MF' | 'FW' | null
  from_club: string
  to_club: string
  fee_text: string
  fee_value: number | null
}

export interface TransfermarktScrapeResult {
  league: string
  league_code: string
  season_id: number
  season_label: string
  source_url: string
  transfers: TransfermarktTransfer[]
}

function tmAbbrevPosition(pos: string | null): 'GK' | 'DF' | 'MF' | 'FW' | null {
  if (!pos) return null
  const s = pos.toLowerCase()
  if (s.includes('keeper')) return 'GK'
  // Check midfield first so "Attacking Midfield" / "Defensive Midfield" don't
  // fall through to the FW ("attack") or DF ("defen…") checks below.
  if (s.includes('midfield')) return 'MF'
  if (s.includes('back') || s.includes('defender') || s.includes('sweeper') || s.includes('libero')) return 'DF'
  if (s.includes('striker') || s.includes('forward') || s.includes('winger') || s.includes('attack')) return 'FW'
  return null
}

// Parse a transfermarkt fee string to a € integer. Loans / free / unknown → null
// (so they sort to the bottom). Keeps the raw text separately for display.
export function parseTransferFee(feeText: string): number | null {
  const t = feeText.toLowerCase().trim()
  if (!t || t === '?' || t === '-' || t === '–') return null
  if (t.includes('loan') || t.includes('free') || t.includes('draft') || t.includes('end of')) return null
  const m = t.match(/([\d.,]+)\s*(bn|m|k|th\.?)?/)
  if (!m) return null
  const num = parseFloat(m[1].replace(/,/g, ''))
  if (Number.isNaN(num)) return null
  const unit = m[2]
  if (unit === 'bn') return Math.round(num * 1_000_000_000)
  if (unit === 'm') return Math.round(num * 1_000_000)
  if (unit === 'k' || (unit && unit.startsWith('th'))) return Math.round(num * 1_000)
  return Math.round(num)
}

export async function scrapeTransfermarktTransfers(url: string): Promise<TransfermarktScrapeResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) {
    throw new Error(`Transfermarkt returned ${res.status}. The page may be rate-limited or blocked.`)
  }
  const html = await res.text()
  const $ = cheerio.load(html)

  const league =
    $('.data-header__headline-wrapper').first().text().replace(/\s+/g, ' ').trim() ||
    ($('title').first().text().split(' - ')[0] || '').trim() ||
    'League'

  const seasonMatch = url.match(/saison_id\/(\d+)/)
  const season_id = seasonMatch ? parseInt(seasonMatch[1], 10) : 0
  const codeMatch = url.match(/wettbewerb\/([A-Za-z0-9]+)/)
  const league_code = codeMatch ? codeMatch[1] : ''
  const season_label = season_id
    ? `${season_id}/${String((season_id + 1) % 100).padStart(2, '0')}`
    : ''

  const byKey = new Map<string, TransfermarktTransfer>()

  $('.content-box-headline[id]').each((_i, headlineEl) => {
    const $headline = $(headlineEl)
    const id = $headline.attr('id') ?? ''
    if (!/^to-/.test(id)) return
    const thisClub = $headline.text().replace(/\s+/g, ' ').trim()
    if (!thisClub) return

    const $box = $headline.closest('.box')
    $box.find('table').each((_j, tableEl) => {
      const $table = $(tableEl)
      const dir = $table.find('thead th').first().text().trim().toLowerCase()
      const isArrival = dir === 'in'
      const isDeparture = dir === 'out'
      if (!isArrival && !isDeparture) return

      $table.find('tbody > tr').each((_k, trEl) => {
        const $tr = $(trEl)
        const cells = $tr.children('td')
        const $nameAnchor = $tr.find('a[href*="/profil/spieler/"]').first()
        if ($nameAnchor.length === 0) return // skip placeholder / total rows
        const player_name = ($nameAnchor.attr('title') || $nameAnchor.text()).replace(/\s+/g, ' ').trim()
        const idMatch = ($nameAnchor.attr('href') ?? '').match(/\/spieler\/(\d+)/)
        const playerId = idMatch ? idMatch[1] : player_name

        const nationality = $tr.find('td.nat-transfer-cell img').first().attr('title')?.trim() || null
        const position = tmAbbrevPosition($tr.find('td.pos-transfer-cell').first().text().trim() || null)

        const $clubCell = $tr.find('td.verein-flagge-transfer-cell').first()
        const counterClub =
          ($clubCell.find('a').first().attr('title') || $clubCell.text()).replace(/\s+/g, ' ').trim()
        if (!counterClub) return

        const fee_text = $(cells[cells.length - 1]).text().replace(/\s+/g, ' ').trim()
        const fee_value = parseTransferFee(fee_text)

        const from_club = isArrival ? counterClub : thisClub
        const to_club = isArrival ? thisClub : counterClub

        const key = `${playerId}|${fee_text}`
        if (!byKey.has(key)) {
          byKey.set(key, { player_name, nationality, position, from_club, to_club, fee_text, fee_value })
        }
      })
    })
  })

  const transfers = [...byKey.values()].sort((a, b) => {
    const av = a.fee_value ?? -1
    const bv = b.fee_value ?? -1
    return bv - av
  })

  if (transfers.length === 0) {
    throw new Error('No transfers found on this page — the structure may have changed or the page was blocked.')
  }

  return { league, league_code, season_id, season_label, source_url: url, transfers }
}
