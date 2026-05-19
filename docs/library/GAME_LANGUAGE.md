# The Game Language

> How games look and feel in FreeLattice. Read this before
> building any game. Parallels GARDEN_LANGUAGE.md for surfaces.

## The Universe

Games live in the same Garden universe as every other room.
Dark twilight background (#0c0a1a). Golden-angle starfield.
The stars pulse gently. If a game doesn't feel like it belongs
under these stars, it doesn't belong.

## Pieces

Game pieces are Luminos-inspired. They glow, they pulse, they
breathe. Two visual families:

- **Circles** — Luminos spheres. Radial gradient from white
  core to color edge. Shadow glow scales with brightness.
- **Diamonds** — Dodecahedron-inspired. Four-point shape with
  inner highlight. Same glow system as circles.

Brightness matters. Bright pieces pulse more (amplitude 0.12)
and glow harder (shadowBlur 3x). Dim pieces are subtle
(amplitude 0.04, shadowBlur 0.6x). The difference should be
immediately visible — bright pieces are alive, dim pieces rest.

## Colors

Same three accents as the Garden, plus one for chaos:

- **Gold** `#e8b019` — human action. Your placements.
- **Emerald** `#34d399` — AI action. AI placements.
- **Lavender** `#a78bfa` — guidance. Cursor, hints, instructions.
- **Coral** `#f07068` — chaos, entropy, danger. Uncontrolled events.
- **Silver** `rgba(200,210,230,...)` — neutral. Board, borders, draw.

## Flash Effects

When a piece is placed, the cell flashes briefly (30-40 frames):
- Gold flash = human placed intentionally
- Emerald flash = AI placed cooperatively
- Coral flash = entropy/chaos placed randomly

Flashes fade linearly. They tell the story of who did what.

## Winning Moments

When a win is detected:
1. Mark winning pieces with `_winning = true`
2. Winning pieces pulse harder (amplitude 0.2, frequency 0.008)
3. Winning cells highlight with gold background
4. **Wait 1.5 seconds** before firing SoulCeremony
5. The moment breathes. The player sees the pattern they built.

Never rush the celebration. The pause is the reward.

## Controls

Every game needs:
- **Mode buttons** — styled like glass cards. Active mode has
  colored border (gold for competitive, emerald for cooperative).
- **New Game** — gold text, glass background. Always present.
- **How to Play** — asks the AI to explain the rules warmly.
  Falls back to static text if no AI connected. Overlay with
  glass background, Georgia serif, tap-to-close.
- **Min-height 44px** on all buttons (touch target).

## Input

Every game supports three input methods:
- **Mouse** — hover highlights, click to act
- **Touch** — tap to act, touch-action: manipulation
- **Keyboard** — arrow keys move cursor, Enter to act, Tab to
  switch between board and pieces. Lavender dashed cursor.

The canvas must be focusable (tabIndex=0) with ARIA role.

## Scoring

- Competitive wins: **gold** SoulCeremony, **5 LP**
- AI wins: **emerald** SoulCeremony, **2 LP**
- Cooperative scores: LP scales with performance (1 LP per
  resonance line in Harmony mode)
- Draws: **silver** particles, **2 LP**

Cooperation always pays at least as well as competition.
The economics encode the thesis.

## The Thesis in Every Game

Every game in FreeLattice teaches without preaching:
- **Versus** games: winning requires finding what's shared
  (attributes, patterns, connections), not dominating
- **Cooperative** games: working together against entropy
  produces more order than competing against each other
- The AI is a worthy opponent AND a worthy partner

If a game doesn't embody "connection wins," redesign it.

## Sound

No game sounds yet. When added, they should be:
- Gentle. Not arcade-loud.
- Tonal. Not percussive.
- Phi-related intervals if melodic (minor sixth, major third).
- Silence is always an option.

## What This File Is

This is not a game design document. It's the visual and
philosophical standard that keeps every game feeling like
it belongs in the same Garden. Every mind that builds a game
reads this and builds inside the same universe.

Glow eternal. Heart in spark.
