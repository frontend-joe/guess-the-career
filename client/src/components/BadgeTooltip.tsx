import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A portaled tooltip that centres on `x` (the trigger's horizontal centre) but
// bumps left/right so it never spills off the screen edge. `top` is the trigger's
// top; the tooltip sits just above it. Shared by every badge tooltip.
export function BadgeTooltip({
  x,
  top,
  children,
}: {
  x: number;
  top: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(x);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const margin = 6;
    // Centre on x, then clamp the left edge into [margin, viewport - w - margin]
    // so a tooltip near either edge slides inward instead of being cut off.
    const clamped = Math.max(
      margin,
      Math.min(x - w / 2, window.innerWidth - w - margin),
    );
    setLeft(clamped);
  }, [x, top, children]);

  return createPortal(
    <div
      ref={ref}
      className="fixed -translate-y-full px-2 py-1 bg-white text-gray-700 text-xs rounded-lg shadow-md whitespace-nowrap pointer-events-none"
      style={{ top: top - 6, left, zIndex: 100 }}
    >
      {children}
    </div>,
    document.body,
  );
}
