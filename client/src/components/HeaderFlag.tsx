import { NationalityFlag } from "@/components/NationalityFlag";

/**
 * Shared nationality flag for game headers — a perfectly square, cropped flag
 * with a light border, rendered at a consistent size across the flag-based
 * games. Delegates to NationalityFlag so it carries the same name tooltip as
 * flags used elsewhere, and returns null when no flag is available.
 */
export default function HeaderFlag({ nationality }: { nationality: string }) {
  return (
    <NationalityFlag
      nationality={nationality}
      className="w-10 h-10 object-cover rounded-md border border-gray-200 shadow-sm"
    />
  );
}
