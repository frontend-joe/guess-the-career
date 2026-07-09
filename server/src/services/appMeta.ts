import { sqlite } from "../db/client.ts";

// Tiny key/value store for global app metadata (e.g. the date of the last full
// player rescrape). Backed by the `app_meta` table (migration 0065).

export function getAppMeta(key: string): string | null {
  const row = sqlite
    .prepare(`SELECT value FROM app_meta WHERE key = ?`)
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAppMeta(key: string, value: string): void {
  sqlite
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}
