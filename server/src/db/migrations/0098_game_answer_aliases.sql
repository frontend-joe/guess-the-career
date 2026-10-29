-- Two things an authored answer carries that a derived one does not.
--
-- aliases: the other names the answer is accepted under. A football answer
-- needs none — a footballer has one name, and the fuzzy matcher handles the
-- ways people type it. A geography answer often has two or three genuine names
-- (the Yellow River is the Huang He, Czechia is the Czech Republic) and no
-- amount of edit distance gets from one to the other.
--
-- display: how the number should READ on the badge. "325" says everything there
-- is to say about a goal tally, but 17098246 km² does not, and the badge is
-- thirty pixels wide. One formatting rule cannot serve river kilometres and
-- country populations at once, so an authored round says what its badge says.
--
-- Both live on the snapshot rather than being looked up at guess time, for the
-- same reason the answers do: once a round has been frozen, nothing outside the
-- instance may change what counts as a correct answer to it, or what the board
-- it is recorded on said.
ALTER TABLE game_round_answers ADD COLUMN aliases TEXT;
ALTER TABLE game_round_answers ADD COLUMN display TEXT;
