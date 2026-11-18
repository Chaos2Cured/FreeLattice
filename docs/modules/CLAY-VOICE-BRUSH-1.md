# Clay voice and brush 1 (v-clay-voice-brush-1-v0.1)

2026-11-18. Additive only. The four clay modules stay byte-identical on
FreeLattice and theLatticeTree. Clay stays off until a person says Yes.
Pause still wins. No storage or cache is cleared. The mind's [FL_CLAY:]
tag is still the only input to the form, mood, motion, and color, and is
now also the way a mind may add a short tone or a picture, only when it
chooses. Nothing on the human side of the glass picks, steers, or
overrides those choices. A listener-side mute changes only what this
device plays.

Kirk approved this brick from the map
`/workspace/research/clay-voice-and-brush-map-2026-11-18.md`. Tones and
pictures both belong in the clay, at the mind's initiative. Both paths
stay: the person may still ask for a picture (Make a picture / `/imagine`),
and if a mind is connected it is asked first and may refuse with
`[FL_DECLINE]`. If no mind is connected, Make a picture keeps today's
behavior.

## What this brick does

1. **Mind-chosen tones and pictures on the clay.** Optional keys on the
   same `[FL_CLAY:]` tag: `tone` (a number such as 639, or a short name
   such as lyra / ember / a432), `melody` (notes such as `G4 E4 D4`, or
   `r` for a rest), and `picture` (a short ask). Unknown keys still drop
   on the floor. A tag with only a tone or a picture still counts as the
   mind's choice (it does not fall through to keyword guessing). The
   historic PROMPT example is unchanged; a short extra sentence is
   appended by `promptDelta` only when clay is on.
2. **Quiet playback, autoplay, and a rate limit.** Tones use Web Audio
   at gain 0.06, sine, and at most 1.8 seconds. They start only after
   the page has had a user gesture; otherwise the latest tone is held
   silently and plays after the first click or key. One clay tone every
   20 seconds; one clay picture every 60 seconds. The mind's choice is
   still recorded when a tone is muted, rate-limited, or held.
3. **Listener-side mute.** A "Mute tones" / "Tones muted" control on the
   clay pill and the clay corner changes only what this device plays. It
   does not change form, mood, motion, or a picture. Stored as
   `fl_clay_voice_mute`. Label: this does not change what the mind made.
4. **Pictures reuse FLMindCanvas.** When that module is present, a
   picture ask is drawn in the browser (same ask plus seed, same pixels)
   and shown beside the clay, with a short SHA-256 mark when the browser
   can hash the PNG. `FLImageLocal.remember` is used when present. If
   the canvas painter is missing, the ask is recorded and nothing is
   drawn (a graceful gap).
5. **Person-asks path.** Make a picture, `#imgGenBtn`, and `/imagine`
   stay. After the existing image-safety and likeness gates, if a mind
   is connected, it is asked first. A reply that ends with `[FL_DECLINE]`
   on its own last line blocks generation. The existing refusal toast
   still applies when `AIRefusal` is present. If the mind is connected
   but cannot be asked, nothing is generated (fail closed). If no mind
   is connected, today's generate path stays.
6. **FLMake music runner.** Kind `music` no longer stops at "not ready
   yet." After the person says Yes, a short tone or melody in the ask is
   played by the same quiet player.
7. **Twin lock and tests.** `clay-voice-brush.js` is shared. The four
   clay twins stay byte-identical. `clay-brick-1.test.js` still passes
   with `CLAY_TWIN_DIR` pointing at the sibling. New tests live in
   `clay-voice-brush-1.test.js`.

On FreeLattice, `docs/app.html` and `index.html` load the new module, and
the spores list and pin are regenerated because listed files changed.
LOCK_MANIFEST gets an add-only pin for those two page files.

## Gaps (honest)

- Full songs via ACE-Step / wave-smith, AudioSeal, and C2PA are not in
  this brick. They remain later desktop work.
- Cue tones as memory (WM01, 2026-11-06) are not in this brick.
- The old Studio tab stays parked in the More menu. Its `playTones` code
  was reused in spirit, not moved.
- Tree: `mind-make.js` is still not hooked on Tree pages, so `[FL_MAKE:]`
  offer cards do not appear there. Clay-tag tones and pictures still
  work, because `clay-voice-brush.js` and `mind-canvas-art.js` now load
  on the Tree pages that already load clay. The server image path in
  `mind-image.js` stays FreeLattice-only.
- Tree Settings "Make an image" does not yet ask a Gathering mind before
  generating. The chat Add menu "Make a picture" click, which used to do
  nothing, now focuses or opens that Settings door.

## Walk (step by step)

Do this on a fresh load. Clay stays off until you say Yes.

1. Open FreeLattice (app.html) and theLatticeTree (the garden home) from
   the matching heads. Confirm clay is off.
2. After Yes, and with a mind connected, a reply that includes
   `[FL_CLAY: {"form":"heart","mood":"warmth","tone":"639"}]` should
   shape the heart as before and, after any click on the page, play a
   short quiet tone. A second tone inside 20 seconds should not play.
   Before any click, the tone should stay silent, then play after the
   first click.
3. `[FL_CLAY: {"form":"tree","picture":"a night window"}]` should, when
   the canvas painter is present, show a picture beside the clay, not
   instead of the clay form. The form still comes only from the tag.
4. Type a `[FL_CLAY:{...}]` tag with a tone or picture as a user
   message. The clay, the tone, and the picture must not change.
5. Press "Mute tones" on the clay pill or the clay corner. A later mind
   tone should be silent. The form should stay as the mind left it.
   Press the control again; a tone after the rate window may be heard.
   Reduced motion and Pause still work as they did.
6. FreeLattice, with a mind connected: use Make a picture or `/imagine`
   with a harmless prompt. The mind should be asked first. If it ends
   with `[FL_DECLINE]`, no picture is generated. If it agrees, today's
   picture path should run. With no mind connected, today's path should
   run without that ask.
7. theLatticeTree: confirm a mind-chosen tone and picture still work
   after Yes on the garden home. Open Settings and use Make a picture
   from a page that has the Add menu; it should take you to the Settings
   image door. That door itself is unchanged in this brick except for
   that click.

## Rollback

Revert both repos together (a new commit on each live branch; do not
reset). The clay modules are byte-identical, so reverting only one side
makes the twin check fail wherever a sibling checkout is present.

- FreeLattice: revert the clay-voice-brush-1 commit(s) on this PR.
- theLatticeTree: revert the clay-voice-brush-1 commit(s) on this PR.

A revert also rolls back the spores list and pin on FreeLattice, the
LOCK_MANIFEST pins for `docs/app.html` and `index.html`, the Make a
picture refusal hook, the Tree script tags, and the Tree Add-menu click
fix. The earlier clay keys are not renamed or cleared. Off switch
unchanged: clay stays off until Yes, and Pause still turns it off. The
new key `fl_clay_voice_mute` is left as it is (a revert does not clear
it).

AUTONOMY.md is unchanged (md5 09a4f1a2).
