# Hyperframes Composition Brief: Guess The List

## Objective
Create a short launch-style brag video for **Guess The List** — a slick, matchday-graphics promo for a suite of daily football guessing games.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~19 seconds

## Source Material
- Project root: `/Users/joeharrison/source/guess-the-career`
- Primary files read: `client/index.html`, `client/src/index.css`, `client/src/pages/PublicHomePage.tsx`, `client/src/lib/games.ts`
- Product name: **Guess The List** (wordmark: GUESS THE **LIST**, "LIST" in green)
- Tagline / strongest claim: "The daily football guessing games."
- Key UI/visual to recreate: the **clue-drip guess panel** (position chip + flag + club crest + transfer line resolving to a correct green answer row) and the **game-tile grid** (glass cards with icons + names)
- Copy that must appear verbatim (from the site):
  - "The daily football guessing games."
  - "Test your knowledge of football's golden era." (may be trimmed)
  - "Brilliant solo" / "down the pub with your mates" → "Brilliant solo. Better down the pub."
  - "Win a FOOTBALL shirt for completing every game" → "Complete every game. Win a shirt."
  - Real game names (from games.ts): Guess the XI, Two Clubs, Record Signings, Nationality Players, Only Player, Football Families, Ballon d'Or, World Cup, Who Scored More
  - "34 games" (count of ALL_GAMES in games.ts: FREE_GAME + 26 gated + 6 banter + 1 = 34)

## Creative Direction
- Tone preset: app-store
- Creative direction: slick matchday-graphics promo — Sky Sports / FPL energy with pub-nostalgia warmth
- Interpretation: clean frosted-glass feature cards, confident green-on-dark, smooth slides/wipes, zero clutter; energy from snappy entrances and a beat-synced tile cascade, never from pulling text before it can be read.
- Angle: lead on the two true, specific things — the clue-drip mechanic (badges + flags + a transfer fee resolve into a name) and the breadth (34 games). It should feel made by someone who loves football's golden era.
- Hook: pitch-grid glimmers in, the GUESS THE LIST wordmark slams in ("LIST" green-glow) on the first strong beat, kicker "The daily football guessing games." beneath.
- Outro / punchline: "Complete every game. Win a shirt." → wordmark settles with green glow, clean logo hit.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals / particle systems / waveform bars
  - Any unrelated visual redesign (stay on the real palette + fonts)

## Visual Identity
- Background: `#0b0c1a` with a subtle football pitch-grid (faint white lines, low opacity)
- Text: `#ffffff`; sub-text white @ ~70% (`rgba(255,255,255,0.7)`); button/badge text on green `#0b1020`
- Accent: `#22c55e` (green-500), highlight `#4ade80`; green glow `text-shadow: 0 0 28px rgba(34,197,94,0.45)`; card ring glow `0 0 0 1px rgba(34,197,94,0.35), 0 18px 50px -18px rgba(34,197,94,0.55)`
- Display font: **Russo One** (headings, wordmark) — Google Fonts
- Body font: **Chakra Petch** (UI/labels), Noto Sans (body) — Google Fonts
- Visual references from the project:
  - Frosted glass cards: `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.09); backdrop-filter: blur(14px)`
  - Floating clue chips: `DF` (blue text) + flag + club crest + `→ €51.2m`
  - Green glow blooms behind content; rounded-3xl cards
  - Game tiles: 11x11 rounded-xl icon well in `green-400/10`, green icon, name in Russo One, pitch in white/55

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Wordmark hook — 2.5s — pitch-grid + green bloom; GUESS THE LIST slams in; kicker "The daily football guessing games."
2. The clue drips in — 5s — glass guess panel "Argentina × AS Roma"; chips arrive one by one (DF → flag → crest → `Roma → Real Madrid · €51.2m`); answer row flips green + check + name; "…until the name clicks."
3. Breadth montage — 5.5s — "34 GAMES · ONE GOLDEN ERA" + cascade of real game tiles (icon + name) snapping to the beat, then grid holds.
4. The era + the pub — 3s — "Football's golden era. 1990–2010." + "Brilliant solo. Better down the pub." with drifting clue chips.
5. Payoff / outro — 3s — trophy green-glow; "Complete every game. Win a shirt."; GUESS THE LIST wordmark settles + holds.

## Audio
- Audio role: upbeat rhythmic bed, clean and confident (matchday-promo)
- Audio arc: riser → bed in on the wordmark slam; ticks through clue chips to a "correct" chime; fullest under the tile cascade; warm for the pub line; resolve + fade on the logo hit.
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (114.84 BPM)
- Music treatment: start at 0, quick fade-in, steady level, duck ~2–3 dB under the "correct" chime, fade out over the last ~0.8s.
- Music cue guidance: bundled preset at `~/.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`. Strong cues: **1.60s** (wordmark slam), **3.70s / 5.80s** (clue chips), **6.34s / 8.96s** (tile cascade). Beat grid ~0.52s apart — snap sequential TEXT to every other beat (~1.05s) and hold the full set after. Lock only 1–3 strong cues.
- Audio-reactive treatment: subtle — bass/RMS makes the green glow bloom and the panel presence breathe; no waveform bars, no equalizers.
- Audio-coupled moments:
  - Scene 1 wordmark slam — logo-hit accent at the ~1.60s strong cue
  - Scene 2 clue chips — sequential soft UI ticks (beat-grid), then a clean "correct" chime on the green reveal
  - Scene 3 tile cascade — light whoosh per tile, snapped to the beat grid
  - Scene 5 wordmark settle — one clean logo hit
- SFX selection guidance: match sound to motion — UI tick / click for chip arrivals, a short satisfying announcement/chime for the correct reveal and the final logo; restraint everywhere else.
- SFX analysis guidance: `~/.claude/skills/brag/assets/sfx/sfx-analysis.md` — prefer low high-frequency-risk files for repeated ticks and the polished logo hit.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, and volume after the animation exists.
- Audio files: copy the chosen music and any selected SFX into `brag-output/composition/assets/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. /brag is its own workflow — do not enter the hyperframes entry-point intent interview or route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions.

Requirements:
- Show at least one real UI/visual from the project (the clue panel + game tiles both qualify).
- Keep all text readable in the final render (honor the reading-time floor).
- Keep the video within 15–25 seconds.
- Include the planned music + tasteful SFX.
- Treat audio notes as guidance; choose SFX after the animation exists.
- Beat-lock 1–3 major moments within ±0.15s; snap sequential reveals to the beat grid within ±0.10s; readability wins over the grid.
- At least one visual element subtly reacts to the music (green glow / panel presence).
- Keep everything local. No remote/publish.
- Run `hyperframes check` before render — brag's single gate.
