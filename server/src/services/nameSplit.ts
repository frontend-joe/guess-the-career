// Split a footballer's display name into first name + surname.
//
// The naive "last word is the surname" rule is wrong in several common cases,
// and each wrong case silently corrupts surname-based games:
//   - particle surnames:  Alessandro Del Piero -> Del Piero (not Piero)
//                         Roberto Di Matteo    -> Di Matteo
//                         Matt Le Tissier      -> Le Tissier
//                         Rafael van der Vaart -> van der Vaart
//   - East-Asian order:   Kim Min-jae          -> Kim (surname comes first)
//   - mononyms:           Nayim, Mancini, Kaká -> surname only
//
// Anything we can't decide confidently is returned with `ambiguous: true` so an
// admin can confirm or correct it, rather than being silently guessed.

export interface NameSplit {
  first_name: string | null;
  surname: string;
  ambiguous: boolean;
  reason: string;
}

// Tokens that begin a compound surname when they appear mid-name.
// Deliberately excludes Mc/Mac/O' — those are attached to the name, not separate.
const PARTICLES = new Set([
  "de", "del", "della", "dello", "dei", "degli", "di", "da", "dal", "dalla",
  "do", "dos", "das", "du", "van", "von", "der", "den", "ter", "ten",
  "vande", "vander", "le", "la", "les", "af", "av", "al", "el",
  "bin", "ibn", "abu", "ben", "san", "santa", "lo", "ver",
]);

// Korean surnames (romanised variants). Used with nationality as a backstop
// when the given name isn't hyphenated.
const KOREAN_SURNAMES = new Set([
  "kim", "lee", "rhee", "yi", "park", "pak", "choi", "choe", "jung", "jeong",
  "chung", "kang", "cho", "jo", "yoon", "yun", "jang", "chang", "lim", "im",
  "han", "oh", "seo", "suh", "shin", "sin", "kwon", "hwang", "ahn", "an",
  "song", "ryu", "yoo", "yu", "hong", "jeon", "jun", "ko", "go", "moon", "mun",
  "son", "yang", "bae", "baek", "paik", "heo", "hur", "nam", "noh", "ha",
  "koo", "gu", "chun", "cheon", "min", "sim", "woo", "joo", "ju", "na", "byun",
  "kwak", "gwak", "pyo", "myung", "sung", "seong",
]);

// Nationalities written surname-first on English Wikipedia.
const SURNAME_FIRST_NATIONS = new Set([
  "South Korea", "North Korea", "Korea Republic", "Korea DPR",
  "China", "Chinese Taipei", "Taiwan", "Hong Kong", "Macau", "Vietnam",
]);

// Iberian / Latin American naming often uses two surnames, so a 3-token name
// there is genuinely ambiguous (paternal + maternal).
const DOUBLE_SURNAME_NATIONS = new Set([
  "Spain", "Portugal", "Brazil", "Argentina", "Mexico", "Colombia", "Uruguay",
  "Chile", "Peru", "Venezuela", "Ecuador", "Paraguay", "Bolivia", "Cuba",
  "Costa Rica", "Honduras", "Guatemala", "Panama", "El Salvador", "Nicaragua",
  "Dominican Republic", "Puerto Rico",
]);

const GENERATIONAL = /^(jr|jr\.|junior|júnior|senior|sr|sr\.|filho|neto|ii|iii)$/i;

export function splitName(name: string, nationality?: string | null): NameSplit {
  const clean = (name ?? "").replace(/\s+/g, " ").trim();
  const tokens = clean.split(" ").filter(Boolean);

  if (tokens.length === 0) {
    return { first_name: null, surname: clean, ambiguous: true, reason: "empty name" };
  }

  // 1. Mononym — the whole thing is the surname (Nayim, Mancini, Kaká, Pelé).
  if (tokens.length === 1) {
    return {
      first_name: null,
      surname: tokens[0],
      ambiguous: true,
      reason: "single-word name (mononym) — surname only",
    };
  }

  // 2. East-Asian surname-first order.
  const nat = nationality ?? "";
  const firstLower = tokens[0].toLowerCase().replace(/[^a-z]/g, "");
  const hyphenatedGiven = tokens.length === 2 && /[-]/.test(tokens[1]);
  const koreanSurnameFirst = KOREAN_SURNAMES.has(firstLower);
  if (
    SURNAME_FIRST_NATIONS.has(nat) &&
    (hyphenatedGiven || koreanSurnameFirst || tokens.length <= 3)
  ) {
    return {
      first_name: tokens.slice(1).join(" ") || null,
      surname: tokens[0],
      ambiguous: true,
      reason: `${nat} names are written surname-first — confirm`,
    };
  }

  // 3. Compound surname starting at a particle (Del Piero, Di Matteo,
  //    van der Vaart, Le Tissier, De Bruyne).
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase().replace(/[^a-zà-ÿ']/gi, "");
    if (PARTICLES.has(t)) {
      // A trailing particle (last token) can't start a surname.
      if (i === tokens.length - 1) break;
      return {
        first_name: tokens.slice(0, i).join(" ") || null,
        surname: tokens.slice(i).join(" "),
        ambiguous: false,
        reason: `compound surname starting at "${tokens[i]}"`,
      };
    }
  }

  // 4. Generational suffix (Jr, Júnior, Filho, Neto) — keep it with the surname.
  const last = tokens[tokens.length - 1];
  if (GENERATIONAL.test(last) && tokens.length >= 3) {
    return {
      first_name: tokens.slice(0, tokens.length - 2).join(" ") || null,
      surname: tokens.slice(tokens.length - 2).join(" "),
      ambiguous: true,
      reason: "generational suffix — confirm whether it belongs to the surname",
    };
  }

  // 5. Two tokens, no particle — the straightforward case.
  if (tokens.length === 2) {
    return {
      first_name: tokens[0],
      surname: tokens[1],
      ambiguous: false,
      reason: "first name + surname",
    };
  }

  // 6. Three or more tokens, no particle. Default to the last token, but flag:
  //    could be a middle name (Jimmy Floyd Hasselbaink) or a double surname
  //    (Juan Manuel Mata García).
  const doubleSurnameLikely = DOUBLE_SURNAME_NATIONS.has(nat);
  return {
    first_name: tokens.slice(0, -1).join(" "),
    surname: last,
    ambiguous: true,
    reason: doubleSurnameLikely
      ? `${nat} names often use two surnames — confirm which is the surname`
      : "three or more names — middle name or double surname, confirm",
  };
}
