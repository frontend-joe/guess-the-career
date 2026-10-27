# Football Tenable — iOS

Phase 3 of the multiplayer plan: the first native client. Hosts sign in and
create a room; guests join with a code and a name and no account.

## Building

The Xcode project is generated, not committed — `project.yml` is the thing to
review and change.

```sh
brew install xcodegen          # once
cd ios && xcodegen generate    # after any change to project.yml
open GuessTheList.xcodeproj
```

From the command line:

```sh
xcodebuild -project GuessTheList.xcodeproj -scheme GuessTheList \
  -destination 'platform=iOS Simulator,name=iPhone 15' build
```

`yarn verify` at the repo root does not build this. It reproduces the two
deploys — Railway and Netlify — and neither of them ships the app.

## What it talks to

Railway directly, at the URL in `Sources/API/APIClient.swift`. The web client
goes through Netlify's proxy, which buffers and breaks streaming responses;
none of that applies here because the app dials the origin.

## The rules worth not breaking

**The board on screen always came from `GET /state`.** A LiveKit broadcast
carries the state version and nothing else; seeing a higher one means refetch.
That keeps exactly one code path from the event log to a board — the same fold
the recorded video will be rendered from. Applying broadcasts directly would
be a second implementation of that fold, free to drift from it, and the
divergence would show up as a recording of something the players never saw.

**The host is not trusted by the UI.** Host-only actions are enforced on the
server. Hiding them here is a courtesy to the other players, not a control.

**A seat outlives the process.** `SeatStore` keeps the participant token, so a
crash or a kill does not cost a guest their slot — and with it their tile
position in whatever gets recorded.

## Not here yet

Local recording (Phase 5) and everything downstream of it. The camera is
published to LiveKit and not written to disk, so nothing in this app yet has
to solve feeding one capture session to both.
