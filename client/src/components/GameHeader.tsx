import type { ReactNode } from "react";

export type Difficulty = { label: string; color: "red" | "amber" | "green" };

const PILL_BG: Record<Difficulty["color"], string> = {
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-green-500",
};

/**
 * Shared full-bleed game header row: image/icon on the left, then title and
 * optional subtitle. Renders a light-grey bottom border to divide it from the
 * list below — drop it in as a direct child of the scrolling content column
 * (outside any horizontal padding) so the border spans the full screen width.
 */
export default function GameHeader({
  image,
  title,
  subtitle,
  difficulty,
}: {
  image?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  difficulty?: Difficulty;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
      {image && <div className="shrink-0 flex items-center">{image}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-gray-900 leading-tight truncate">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 leading-snug">{subtitle}</div>}
      </div>
      {difficulty && (
        <span
          className={`ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full ${PILL_BG[difficulty.color]}`}
        >
          {difficulty.label}
        </span>
      )}
    </div>
  );
}
