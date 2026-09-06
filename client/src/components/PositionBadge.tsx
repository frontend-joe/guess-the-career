import { useEffect, useRef, useState } from "react";
import { BadgeTooltip } from "@/components/BadgeTooltip";
import { cn } from "@/lib/utils";
import { detailedPosition, POSITION_COLOURS } from "@/lib/position";

interface Props {
  /** Derive the badge from the footballer's main position. */
  footballer?: { position?: string | null } | null;
  /** Or pass an explicit position value (full text or an existing code). */
  position?: string | null;
  className?: string;
}

// Shared position badge used across every game and the admin section. Shows a
// granular code (RB/CB/DM/ST/…) coloured by broad category, with a tooltip of
// the full position on tap — same portaled tooltip as the flag/club badges.
export function PositionBadge({ footballer, position, className }: Props) {
  const raw = footballer ? footballer.position : position;
  const detail = detailedPosition(raw);

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const open = coords !== null;

  function toggle() {
    if (open) {
      setCoords(null);
      return;
    }
    const r = ref.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.top, left: r.left + r.width / 2 });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setCoords(null);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!detail) return null;

  return (
    <span
      ref={ref}
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center w-6 py-0.5 text-[9px] font-bold rounded shrink-0 cursor-default",
        POSITION_COLOURS[detail.category],
        className,
      )}
    >
      {detail.code}
      {open && coords && (
        <BadgeTooltip x={coords.left} top={coords.top}>
          {raw}
        </BadgeTooltip>
      )}
    </span>
  );
}
