-- Blacklist Wikipedia articles, not the words people shout.
--
-- A lookup that came back "not a male association footballer" was recorded
-- against the TYPED TEXT, permanently and globally. But the verdict is about
-- an article, and the typed text is a name — and a name is shared. "Carrasco"
-- is ten footballers on the first page of Wikipedia's own search; 235 of the
-- 1,592 players already in this database share a surname with somebody else
-- in it. So one article judged not-a-footballer wrote off every player who
-- shares that name, for good, on every board, with no record of which article
-- was even judged.
--
-- Yannick Carrasco is how this was found: 198 Atlético Madrid appearances, a
-- winger on a board of Atlético Madrid wingers, and the guess came back red
-- because the name had been written off by some earlier round. Typing
-- "Yannick Carrasco" in full created him in one second — the resolver had
-- always been able to find him, and the skip in front of it never let it try.
--
-- `resolved` was worse than `rejected`, because it looked like a success. The
-- first player to claim a surname locked every namesake out of the database
-- permanently: resolve "Carrasco" to Carlos once and Yannick can never be
-- learned through that name again. services/playerImport.ts already knew this
-- — "a name identifies a player far less firmly than that assumed", Éderson,
-- Raúl Jiménez — and re-searches when a held row does not fit the round's
-- hint. The skip meant that fix could never run a second time.
--
-- So the permanent thing moves to the URL, where the fact actually lives. An
-- article that is an actor will be an actor tomorrow. A name somebody shouted
-- is not evidence about anybody.
CREATE TABLE IF NOT EXISTS wikipedia_rejections (
  url        TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,
  raw        TEXT,              -- what was typed when we found out, for forensics
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every surviving verdict was written under the broken key, so none of them
-- can be trusted — the same reasoning as 0119, which had to do this once
-- already for half the problem. Costs at most one repeated lookup per name,
-- which is then recorded against the article it was really about.
DELETE FROM game_guess_reviews WHERE status IN ('rejected', 'resolved');
