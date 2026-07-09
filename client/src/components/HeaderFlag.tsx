import { nationalityToFlagUrl } from "@/lib/flags";

/**
 * Shared nationality flag for game headers — a perfectly square, cropped flag
 * with a light border, rendered at a consistent size across the flag-based
 * games. Returns null when no flag is available for the nationality.
 */
export default function HeaderFlag({ nationality }: { nationality: string }) {
  const flagUrl = nationalityToFlagUrl(nationality);
  if (!flagUrl) return null;
  return (
    <img
      src={flagUrl}
      alt={nationality}
      className="w-10 h-10 object-cover rounded-md border border-gray-200 shadow-sm"
    />
  );
}
