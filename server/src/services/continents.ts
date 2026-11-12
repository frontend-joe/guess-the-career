// Which continent a nationality belongs to.
//
// There was no continent map in this codebase, so Random Lists grew two
// half-copies of one — an Africa set and a South America set, each carrying
// both the country noun and its demonym because nobody had checked which the
// database actually stores. It stores the noun: 111 distinct values, every one
// of them a country name. The demonyms stay anyway, because they cost a map
// entry and the scraper has never promised otherwise.
//
// Geography, not confederation. A football fan placing Turkey, Russia, Israel
// or Georgia puts them in Europe — they play European football, and a round
// calling Georgia Asian would read as a mistake even where an atlas agrees.
// Australia goes the other way: AFC since 2006, but "Asian Arsenal players"
// turning up Harry Kewell is a trick, not a question. These are the only
// judgement calls in the file; the rest is a map.
//
// Defunct states are here on purpose. The database holds Yugoslavia, Zaire,
// Serbia and Montenegro and the Soviet Union, and a player's nationality is
// whatever the infobox said at the time.

export interface Continent {
  slug: string;
  label: string;
  /** How a round says it: "South American Arsenal players". */
  adjective: string;
  /**
   * Whether this continent makes a question. Being European at Arsenal is the
   * default state of a footballer, not a fact worth a board, so Europe maps
   * nationalities without ever offering a round.
   */
  asksRounds: boolean;
  nations: string[];
}

export const CONTINENTS: Continent[] = [
  {
    slug: "africa",
    label: "Africa",
    adjective: "African",
    asksRounds: true,
    nations: [
      "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
      "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
      "Congo", "DR Congo", "Zaire", "Djibouti", "Egypt", "Equatorial Guinea",
      "Eritrea", "Eswatini", "Swaziland", "Ethiopia", "Gabon", "Gambia",
      "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho",
      "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania",
      "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria",
      "Réunion", "Reunion", "Rwanda", "São Tomé and Príncipe", "Senegal",
      "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan",
      "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
      // Demonyms, inherited from the Random Lists sets this replaces.
      "Algerian", "Angolan", "Beninese", "Burkinabé", "Cameroonian",
      "Cape Verdean", "Comorian", "Congolese", "Egyptian", "Ethiopian",
      "Gabonese", "Gambian", "Ghanaian", "Guinean", "Ivorian", "Kenyan",
      "Liberian", "Malagasy", "Malian", "Moroccan", "Namibian", "Nigerian",
      "Senegalese", "South African", "Sudanese", "Tanzanian", "Togolese",
      "Tunisian", "Ugandan", "Zambian", "Zimbabwean",
    ],
  },
  {
    slug: "south-america",
    label: "South America",
    adjective: "South American",
    asksRounds: true,
    nations: [
      "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador",
      "French Guiana", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay",
      "Venezuela",
      "Argentine", "Argentinian", "Bolivian", "Brazilian", "Chilean",
      "Colombian", "Ecuadorian", "Paraguayan", "Peruvian", "Uruguayan",
      "Venezuelan",
    ],
  },
  {
    slug: "north-america",
    label: "North America",
    adjective: "North American",
    asksRounds: true,
    nations: [
      "Antigua and Barbuda", "Aruba", "Bahamas", "Barbados", "Belize",
      "Bermuda", "Canada", "Cayman Islands", "Costa Rica", "Cuba", "Curaçao",
      "Dominica", "Dominican Republic", "El Salvador", "Grenada", "Guadeloupe",
      "Guatemala", "Haiti", "Honduras", "Jamaica", "Martinique", "Mexico",
      "Montserrat", "Netherlands Antilles", "Nicaragua", "Panama",
      "Puerto Rico", "Saint Kitts and Nevis", "Saint Lucia",
      "Saint Vincent and the Grenadines", "Trinidad and Tobago",
      "United States", "U.S.", "USA", "American", "Canadian", "Jamaican",
      "Mexican",
    ],
  },
  {
    slug: "asia",
    label: "Asia",
    adjective: "Asian",
    asksRounds: true,
    nations: [
      "Afghanistan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia",
      "China", "East Timor", "Hong Kong", "India", "Indonesia", "Iran",
      "Iraq", "Japan", "Jordan", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon",
      "Macau", "Malaysia", "Maldives", "Mongolia", "Myanmar", "Nepal",
      "North Korea", "Oman", "Pakistan", "Palestine", "Philippines", "Qatar",
      "Saudi Arabia", "Singapore", "South Korea", "Sri Lanka", "Syria",
      "Taiwan", "Tajikistan", "Thailand", "Turkmenistan",
      "United Arab Emirates", "Uzbekistan", "Vietnam", "Yemen",
      "Chinese", "Indian", "Iranian", "Japanese", "South Korean", "Thai",
    ],
  },
  {
    slug: "oceania",
    label: "Oceania",
    adjective: "Oceanian",
    asksRounds: true,
    nations: [
      "Australia", "Fiji", "New Caledonia", "New Zealand",
      "Papua New Guinea", "Samoa", "Solomon Islands", "Tahiti", "Tonga",
      "Vanuatu", "Australian", "New Zealander",
    ],
  },
  {
    slug: "europe",
    label: "Europe",
    adjective: "European",
    asksRounds: false,
    nations: [
      "Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus",
      "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus",
      "Czech Republic", "Czechoslovakia", "Denmark", "East Germany",
      "England", "Estonia", "Faroe Islands", "Finland", "France", "Georgia",
      "Germany", "Gibraltar", "Greece", "Hungary", "Iceland", "Ireland",
      "Israel", "Italy", "Kazakhstan", "Kosovo", "Latvia", "Liechtenstein",
      "Lithuania", "Luxembourg", "Macedonia", "Malta", "Moldova", "Monaco",
      "Montenegro", "Netherlands", "North Macedonia", "Northern Ireland",
      "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino",
      "Scotland", "Serbia", "Serbia and Montenegro", "Slovakia", "Slovenia",
      "Soviet Union", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine",
      "Wales", "West Germany", "Yugoslavia",
    ],
  },
];

const BY_NATION = new Map<string, string>();
for (const c of CONTINENTS) {
  for (const n of c.nations) BY_NATION.set(n.trim().toLowerCase(), c.slug);
}

export function getContinent(slug: string): Continent | undefined {
  return CONTINENTS.find((c) => c.slug === slug);
}

/** The continent slug for a stored nationality, or null for one we cannot place. */
export function continentOf(nationality: string | null): string | null {
  if (!nationality) return null;
  return BY_NATION.get(nationality.trim().toLowerCase()) ?? null;
}

export function isFrom(slug: string, nationality: string | null): boolean {
  return continentOf(nationality) === slug;
}
