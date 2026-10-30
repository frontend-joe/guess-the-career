-- Stop re-seeding the thirty-eight rounds that were thrown away.
--
-- 0104 seeded fifty subjective rounds. Thirty were then deleted through the
-- admin, and eight more were retired because each had been played once and the
-- game that played it still points at its registry row.
--
-- The live database is already correct; this is about the next one. A seed in a
-- migration is a standing instruction, not a one-off import, so rebuilding from
-- migrations would bring all thirty-eight back. 0104 itself is left alone — it
-- has run everywhere it is going to run, and editing an applied migration makes
-- the file disagree with what the database actually did.
--
-- Written to be a no-op where the deletes already happened and a full removal
-- on a fresh database. The registry delete is guarded by game_round_instances
-- rather than by a list of slugs, because a retired round must keep its
-- registry row wherever a played game refers to it — that reference is how the
-- game knows which question it was. On a fresh database nothing refers to
-- anything, so all thirty-eight go.

-- 1. The registry rows, except any that a played round depends on.
DELETE FROM tenable_rounds
WHERE category = 'general'
  AND type = 'general'
  AND params IN (
  '{"round":"avoid-washing-up"}',
  '{"round":"brits-say-sorry-to"}',
  '{"round":"car-boot-sale"}',
  '{"round":"cat-knocks-off-table"}',
  '{"round":"dads-on-holiday"}',
  '{"round":"dating-profile-lies"}',
  '{"round":"down-back-of-sofa"}',
  '{"round":"family-christmas"}',
  '{"round":"famous-last-words"}',
  '{"round":"hen-do"}',
  '{"round":"kitchen-junk-drawer"}',
  '{"round":"nans-handbag"}',
  '{"round":"never-say-to-hairdresser"}',
  '{"round":"never-self-service"}',
  '{"round":"pretend-to-understand"}',
  '{"round":"primary-school-playground"}',
  '{"round":"reasons-to-cancel"}',
  '{"round":"rubbish-christmas-presents"}',
  '{"round":"rubbish-superpowers"}',
  '{"round":"seagull-steals"}',
  '{"round":"self-checkout-says"}',
  '{"round":"shout-at-a-spider"}',
  '{"round":"signs-getting-old"}',
  '{"round":"silly-english-words"}',
  '{"round":"stag-do"}',
  '{"round":"surprisingly-loud"}',
  '{"round":"things-a-teenager-says"}',
  '{"round":"things-in-the-shower"}',
  '{"round":"things-your-mum-says"}',
  '{"round":"toddler-mouth"}',
  '{"round":"fictional-pigs"}',
  '{"round":"bad-places-to-sneeze"}',
  '{"round":"late-to-work-excuses"}',
  '{"round":"should-have-been-an-email"}',
  '{"round":"brits-talk-about"}',
  '{"round":"things-that-go-ding"}',
  '{"round":"cry-not-sad"}',
  '{"round":"ruin-a-nights-sleep"}'
  )
  AND id NOT IN (SELECT round_id FROM game_round_instances);

-- 2. The answers and the rounds, but only where the registry row has gone. A
--    round that kept its registry row is retired rather than deleted, and its
--    answers stay readable so the admin can still open it.
DELETE FROM general_answers
WHERE round_slug IN (
  'avoid-washing-up',
  'brits-say-sorry-to',
  'car-boot-sale',
  'cat-knocks-off-table',
  'dads-on-holiday',
  'dating-profile-lies',
  'down-back-of-sofa',
  'family-christmas',
  'famous-last-words',
  'hen-do',
  'kitchen-junk-drawer',
  'nans-handbag',
  'never-say-to-hairdresser',
  'never-self-service',
  'pretend-to-understand',
  'primary-school-playground',
  'reasons-to-cancel',
  'rubbish-christmas-presents',
  'rubbish-superpowers',
  'seagull-steals',
  'self-checkout-says',
  'shout-at-a-spider',
  'signs-getting-old',
  'silly-english-words',
  'stag-do',
  'surprisingly-loud',
  'things-a-teenager-says',
  'things-in-the-shower',
  'things-your-mum-says',
  'toddler-mouth',
  'fictional-pigs',
  'bad-places-to-sneeze',
  'late-to-work-excuses',
  'should-have-been-an-email',
  'brits-talk-about',
  'things-that-go-ding',
  'cry-not-sad',
  'ruin-a-nights-sleep'
)
AND NOT EXISTS (
  SELECT 1 FROM tenable_rounds t
  WHERE t.type = 'general'
    AND t.params = '{"round":"' || general_answers.round_slug || '"}'
);

DELETE FROM general_rounds
WHERE slug IN (
  'avoid-washing-up',
  'brits-say-sorry-to',
  'car-boot-sale',
  'cat-knocks-off-table',
  'dads-on-holiday',
  'dating-profile-lies',
  'down-back-of-sofa',
  'family-christmas',
  'famous-last-words',
  'hen-do',
  'kitchen-junk-drawer',
  'nans-handbag',
  'never-say-to-hairdresser',
  'never-self-service',
  'pretend-to-understand',
  'primary-school-playground',
  'reasons-to-cancel',
  'rubbish-christmas-presents',
  'rubbish-superpowers',
  'seagull-steals',
  'self-checkout-says',
  'shout-at-a-spider',
  'signs-getting-old',
  'silly-english-words',
  'stag-do',
  'surprisingly-loud',
  'things-a-teenager-says',
  'things-in-the-shower',
  'things-your-mum-says',
  'toddler-mouth',
  'fictional-pigs',
  'bad-places-to-sneeze',
  'late-to-work-excuses',
  'should-have-been-an-email',
  'brits-talk-about',
  'things-that-go-ding',
  'cry-not-sad',
  'ruin-a-nights-sleep'
)
AND NOT EXISTS (
  SELECT 1 FROM tenable_rounds t
  WHERE t.type = 'general'
    AND t.params = '{"round":"' || general_rounds.slug || '"}'
);
