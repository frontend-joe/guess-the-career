export type PositionCode = "GK" | "DF" | "MF" | "FW";

export const POSITION_COLOURS: Record<PositionCode, string> = {
  GK: "bg-purple-100 text-purple-700",
  DF: "bg-blue-100 text-blue-700",
  MF: "bg-green-100 text-green-700",
  FW: "bg-orange-100 text-orange-700",
};

// Map a position to its GK/DF/MF/FW badge. Idempotent: an already-abbreviated
// value passes straight through. Otherwise the FIRST position keyword that
// appears in the (full-text) string wins — players are usually listed
// primary-position-first — and wingers count as midfielders.
export function abbrevPosition(
  pos: string | null | undefined,
): PositionCode | null {
  if (!pos) return null;
  const s = pos.toLowerCase().trim();
  if (s === "gk" || s === "df" || s === "mf" || s === "fw") {
    return s.toUpperCase() as PositionCode;
  }
  const groups: [PositionCode, string[]][] = [
    ["GK", ["goalkeeper", "goal keeper", "goalie", "goaltender"]],
    ["DF", ["wing-back", "wing back", "wingback", "back", "defender", "sweeper", "libero", "centre-half", "center-half", "centre half", "center half"]],
    ["MF", ["midfielder", "midfield", "winger", "wing"]],
    ["FW", ["striker", "forward", "attacker"]],
  ];
  let best: PositionCode | null = null;
  let bestIdx = Infinity;
  for (const [code, kws] of groups) {
    for (const kw of kws) {
      const idx = s.indexOf(kw);
      if (idx !== -1 && idx < bestIdx) {
        bestIdx = idx;
        best = code;
      }
    }
  }
  return best;
}

// Granular position code (RB/CB/DM/ST/…) plus the broad category that drives the
// badge colour. The earliest-matching keyword wins (primary position first);
// ties go to the longer/more-specific keyword. Anything that only matches a
// broad category falls back to GK/DF/MF/FW (what we showed before).
export interface DetailedPosition {
  code: string;
  category: PositionCode;
}

const ROLE_GROUPS: { code: string; category: PositionCode; kws: string[] }[] = [
  { code: "GK", category: "GK", kws: ["goalkeeper", "goal keeper", "goalie", "goaltender"] },
  // Defenders (blue)
  { code: "RB", category: "DF", kws: ["right wing-back", "right wing back", "right wingback", "right-back", "right back", "right full-back", "right fullback"] },
  { code: "LB", category: "DF", kws: ["left wing-back", "left wing back", "left wingback", "left-back", "left back", "left full-back", "left fullback"] },
  { code: "CB", category: "DF", kws: ["centre-back", "center-back", "centre back", "center back", "central defender", "centre-half", "center-half", "centre half", "center half"] },
  { code: "SW", category: "DF", kws: ["sweeper", "libero"] },
  { code: "WB", category: "DF", kws: ["wing-back", "wing back", "wingback"] },
  { code: "FB", category: "DF", kws: ["full-back", "fullback", "full back"] },
  { code: "DF", category: "DF", kws: ["back", "defender"] },
  // Midfielders (green)
  { code: "DM", category: "MF", kws: ["defensive midfield", "holding midfield", "anchor"] },
  { code: "AM", category: "MF", kws: ["attacking midfield", "playmaker"] },
  { code: "CM", category: "MF", kws: ["central midfield", "centre midfield", "center midfield", "box-to-box", "box to box"] },
  { code: "WG", category: "MF", kws: ["winger", "wide midfield", "wide player"] },
  { code: "MF", category: "MF", kws: ["midfielder", "midfield"] },
  // Attackers (orange)
  { code: "SS", category: "FW", kws: ["second striker", "secondary striker", "support striker", "withdrawn striker", "deep-lying forward"] },
  { code: "ST", category: "FW", kws: ["centre-forward", "center-forward", "centre forward", "center forward", "striker"] },
  { code: "FW", category: "FW", kws: ["forward", "attacker"] },
];

const CODE_CATEGORY: Record<string, PositionCode> = Object.fromEntries(
  ROLE_GROUPS.map((g) => [g.code.toLowerCase(), g.category]),
);

export function detailedPosition(pos: string | null | undefined): DetailedPosition | null {
  if (!pos) return null;
  const s = pos.toLowerCase().trim();
  // Idempotent: an already-abbreviated value passes straight through.
  if (CODE_CATEGORY[s]) return { code: s.toUpperCase(), category: CODE_CATEGORY[s] };

  let best: DetailedPosition | null = null;
  let bestIdx = Infinity;
  let bestLen = 0;
  for (const g of ROLE_GROUPS) {
    for (const kw of g.kws) {
      const idx = s.indexOf(kw);
      if (idx === -1) continue;
      if (idx < bestIdx || (idx === bestIdx && kw.length > bestLen)) {
        bestIdx = idx;
        bestLen = kw.length;
        best = { code: g.code, category: g.category };
      }
    }
  }
  return best;
}
