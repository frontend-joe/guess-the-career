-- Which phone a seat belongs to, so a guest can come back to it.
--
-- Rejoining has always kept your slot — clear left_at, keep the seat, keep
-- your place in whatever gets recorded. But the branch that does it is gated
-- on user_id, and guests do not have one: that is the whole point of joining
-- by code with a name. So every guest rejoin fell through to the insert below
-- it and took a brand new row, with a new slot and the same name on it.
--
-- Nothing deletes a participant row, deliberately — somebody whose phone died
-- is still part of the game. So the abandoned row stayed too, and the room
-- accumulated a second card for the same person every time they came back.
-- Invisible for as long as a leftover seat was just a tile that never
-- connected; obvious the moment a video-off room started listing everybody by
-- name.
--
-- The phone is the identity available: both apps already send their push
-- token on join, and push_devices.token is unique, so the device row is a
-- stable name for "this handset". A guest with notifications turned off still
-- has no identity and still takes a new seat — an honest limit rather than a
-- guess from a display name, which two people in one room can share.
ALTER TABLE game_participants ADD COLUMN device_id INTEGER REFERENCES push_devices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_participants_room_device
  ON game_participants(room_id, device_id);
