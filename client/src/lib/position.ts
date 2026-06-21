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
