-- Fix corrupted ballon_dor_players data caused by a rescrape that matched
-- players by rank alone. When ranks are tied, this incorrectly assigned
-- footballer_id and wikipedia_url from one player to another.
--
-- Detection: any two players in the same ballon_dor_id sharing the same footballer_id.
-- Fix: clear both; run "Rescrape all" on the admin page after deploying.

UPDATE ballon_dor_players
SET footballer_id = NULL, wikipedia_url = NULL
WHERE id IN (
  SELECT p.id
  FROM ballon_dor_players p
  WHERE p.footballer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ballon_dor_players other
      WHERE other.ballon_dor_id = p.ballon_dor_id
        AND other.footballer_id = p.footballer_id
        AND other.id != p.id
    )
);
