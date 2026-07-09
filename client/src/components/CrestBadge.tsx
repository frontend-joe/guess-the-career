import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nationalityToFlagUrl } from "@/lib/flags";

/**
 * Small (48px) image-only badge for game headers. Resolves its image in
 * precedence order: explicit `imageUrl` → nationality flag (by `name`) →
 * Wikipedia crest (by `wikipediaUrl`) → first-letter fallback. Clicking it
 * shows a name tooltip, matching the flags/logos used elsewhere.
 */
export default function CrestBadge({
  name,
  imageUrl = null,
  wikipediaUrl = null,
}: {
  name: string;
  imageUrl?: string | null;
  wikipediaUrl?: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null);
  const flagUrl = nationalityToFlagUrl(name);

  // Tooltip is portaled to <body> and positioned from the badge's viewport rect
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
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (imageUrl || flagUrl) return;
    if (!wikipediaUrl) {
      setLogoUrl(false);
      return;
    }
    const title = wikipediaUrl.split("/wiki/")[1];
    if (!title) {
      setLogoUrl(false);
      return;
    }
    const controller = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch((err) => {
        if (err.name !== "AbortError") setLogoUrl(false);
      });
    return () => controller.abort();
  }, [wikipediaUrl, flagUrl, imageUrl]);

  return (
    <div
      ref={ref}
      onClick={toggle}
      className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden"
      style={{ borderRadius: "12px" }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-10 h-10 object-contain" style={{ borderRadius: "12px" }} />
      ) : flagUrl ? (
        <div className="w-9 h-9 rounded-md overflow-hidden shrink-0">
          <img src={flagUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      ) : logoUrl === null ? (
        <div className="w-full h-full bg-gray-200 animate-pulse" style={{ borderRadius: "12px" }} />
      ) : logoUrl === false ? (
        <span className="text-gray-400 font-bold text-sm">{name.charAt(0)}</span>
      ) : (
        <img src={logoUrl} alt={name} className="w-10 h-10 object-contain" />
      )}
      {open &&
        coords &&
        createPortal(
          <div
            className="fixed -translate-x-1/2 -translate-y-full px-2 py-1 bg-white text-gray-700 text-xs rounded-lg shadow-md whitespace-nowrap pointer-events-none"
            style={{ top: coords.top - 6, left: coords.left, zIndex: 100 }}
          >
            {name}
          </div>,
          document.body,
        )}
    </div>
  );
}
