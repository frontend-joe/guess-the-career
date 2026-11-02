-- A guess that was scraped, found to be a real footballer, and then discarded
-- because they did not land on the board of the round that asked was marked
-- 'rejected'. Rejection is permanent and global: no amount of guessing the
-- name again would ever look it up once more.
--
-- That is right for an actor, who will still be an actor tomorrow. It is
-- wrong here, because the verdict says nothing about the person and
-- everything about the board they were shouted at. Egil Østenstad is a real
-- footballer with real Premier League goals who was lost this way: the letter
-- round bucketed "Østenstad" under Ø rather than O, so he could not place,
-- so he was discarded, so he could never be learned again.
--
-- The reason was logged but never stored, so the two kinds of rejection are
-- indistinguishable in this table and both have to be reopened. Reopening is
-- cheap and self-healing: nothing is looked up until somebody guesses the
-- name again, and a genuine non-footballer is re-rejected permanently on the
-- first retry. created_at is left alone, so these are past the one-hour
-- cooling-off window and eligible immediately.
--
-- From here on 'rejected' means the person could never belong on any board,
-- and a name that simply missed this one is left 'unresolved' instead.
UPDATE game_guess_reviews
   SET status = 'unresolved', resolved_footballer_id = NULL
 WHERE status = 'rejected';
