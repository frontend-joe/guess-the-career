export interface ProgressRound {
  name: string;
  subtitle?: string;
  guessed: number;
  total: number;
}

const CIRC = 2 * Math.PI * 48;

function RadialChart({ pct }: { pct: number }) {
  const offset = pct === 0 ? CIRC : CIRC * (1 - pct / 100);
  const stroke = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f97316" : "#ef4444";
  const textColor =
    pct >= 80 ? "text-green-500" : pct >= 50 ? "text-orange-400" : "text-red-500";

  return (
    <div className="relative w-48 h-48">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#e5e7eb" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${textColor}`}>{pct}%</span>
      </div>
    </div>
  );
}

export function OverallProgressScreen({
  totalGuessed,
  totalPlayers,
  rounds,
  onRoundClick,
}: {
  totalGuessed: number;
  totalPlayers: number;
  rounds: ProgressRound[];
  onRoundClick?: (index: number) => void;
}) {
  const pct =
    totalPlayers > 0 ? Math.round((totalGuessed / totalPlayers) * 100) : 0;

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-5">
      <RadialChart pct={pct} />

      <p className="text-gray-500 text-sm">
        {totalGuessed} / {totalPlayers} answered
      </p>

      <div className="w-full flex flex-col gap-2">
        {rounds.map((r, i) => {
          const cleared = r.guessed === r.total && r.total > 0;
          const partial = r.guessed > 0 && !cleared;
          const barPct = r.total > 0 ? (r.guessed / r.total) * 100 : 0;
          return (
            <div
              key={i}
              onClick={() => onRoundClick?.(i)}
              className={`flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100 ${onRoundClick ? "cursor-pointer active:bg-gray-50" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {r.name}
                </p>
                {r.subtitle && (
                  <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>
                )}
                <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cleared ? "bg-green-500" : partial ? "bg-orange-400" : "bg-gray-200"}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
              <span
                className={`text-xs font-bold tabular-nums shrink-0 ${cleared ? "text-green-600" : partial ? "text-orange-500" : "text-gray-400"}`}
              >
                {r.guessed}/{r.total}
              </span>
              <span className="text-sm w-4 text-center">
                {cleared ? "✓" : partial ? "~" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
