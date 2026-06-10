import { cn } from "@/lib/utils";
import { abbrevPosition, POSITION_COLOURS } from "@/lib/position";

interface Props {
  /** Derive the badge from the footballer's main position. */
  footballer?: { position?: string | null } | null;
  /** Or pass an explicit position value (full text or an existing GK/DF/MF/FW). */
  position?: string | null;
  className?: string;
}

// Shared GK/DF/MF/FW badge used across every game and the admin section so
// styling and classification stay consistent.
export function PositionBadge({ footballer, position, className }: Props) {
  const code = abbrevPosition(footballer ? footballer.position : position);
  if (!code) return null;
  return (
    <span
      className={cn(
        "text-[9px] font-bold px-1 py-0.5 rounded shrink-0",
        POSITION_COLOURS[code],
        className,
      )}
    >
      {code}
    </span>
  );
}
