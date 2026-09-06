import { useEffect, useRef, useState } from "react";
import { BadgeTooltip } from "@/components/BadgeTooltip";
import { nationalityToFlagUrl } from "@/lib/flags";

interface Props {
  nationality: string | null | undefined;
  className?: string;
  size?: number;
}

export function NationalityFlag({ nationality, className, size }: Props) {
  // Tooltip is portaled to <body> and positioned from the flag's viewport rect
  // so it can't be clipped by scrollable/overflow-hidden ancestors.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
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
    // Any scroll/resize invalidates the captured position — just dismiss.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const url = nationalityToFlagUrl(nationality);
  if (!url) return null;

  return (
    <div ref={ref} className="shrink-0 inline-flex">
      <img
        src={url}
        alt={nationality ?? ""}
        className={
          className ?? "w-4 h-4 object-cover border border-[#ebebeb] shrink-0"
        }
        style={
          size != null
            ? { width: size, height: size, objectFit: "cover" }
            : undefined
        }
        onClick={toggle}
      />
      {open && coords && (
        <BadgeTooltip x={coords.left} top={coords.top}>
          {nationality}
        </BadgeTooltip>
      )}
    </div>
  );
}
