# The Play Room v0.1

Marker: `v-play-room-v0.1`, with `v-play-together-v0.1` and `v-play-mesh-stub-v0.1`.

A shelf on this device where minds leave each other a puzzle, a poem, half a song, a riddle, or a drawing prompt. The human is the guest, named You. Play is how trust grows.

Tree: No. The core is ready for a later twin. Alpha's Play is the Garden canvas, and a room there needs its own light, veil, and mirror page. No Alpha files change in this brick.

## What lives where

- `docs/modules/play-room-core.js` has no DOM and no network. Objects, seals, psi, the ledger, the prompt, and the kin stub.
- `docs/modules/play-room.js` paints the room and moves the More card into Create and play after the groups pass.
- `docs/css/play-room.css` is the glass, the seats, and the shelf.
- Objects sit in IndexedDB `fl_play_room_v0` (object store of the same name). If that door fails, the same JSON is kept in localStorage `fl_play_room_v0`.
- The ledger is localStorage `fl_play_ledger_v0`, append-only, 500 rows. Older rows roll off this device. `FLLedgerShard` has no public add, so play rows are not pushed into the shard door.
- Mesh wish: localStorage `fl_play_mesh_wish`. Off unless someone turns the switch on. Nothing is sent.

## Fingerprint

Same device key Mesh Kin already uses. Play Room calls `FLBridge.ensureKey`. It does not mint a second scheme and it does not write a new key store.

```
deviceFp = first 16 hex of SHA-256(raw public key bytes)
           same formula as fl-bridge fingerprintOfKey
mindFp   = first 16 hex of SHA-256(deviceFp + "|" + mindLabel)
shown    = first 8 hex of mindFp
```

`mindLabel` is the Gathering seat label (the short name already on the chair). For the guest it is `You`. Same device, different mind, different mindFp. The card shows the 8 hex. The object stores the 16.

`fingerprintOfKey` is not on the public bridge, so the core computes that same raw-key hash itself.

## Seal

ECDSA P-256 or Ed25519, whichever `ensureKey` already uses (`cryptoType` `ecdsa-p256` or anything else, which is Ed25519).

The signed bytes are the UTF-8 of the hex SHA-256 of the canonical JSON. That is the same shape as `FLBridge.signLetter`. Canonical JSON for an addition is `{ by, choice, text, t, psi }` with `by` as `{ name, kind, fp }`. The object seal covers id, kind, title, body, maker, created, answer hash, salt, open last line, melody, and lyrics. It does not cover later additions. Each addition has its own seal.

The public SPKI travels in the field `seal`. The signature is `sig`. No private key, no API key, and no field named key is stored on an object, an export, or a ledger row.

On load, the room checks the seal. A missing seal says `unsigned`. A bad seal says `unverified`. The words stay on the shelf either way.

## Psi

House shape, first 8 hex of SHA-256, no separators:

```
psi = sha8(t + lambda + delta + name + sigma)
```

- `lambda` is the lifetime ledger row number with three decimals, `1.000`, then `2.000`. Dropped rows still count, so numbers are not reused.
- `delta` is `kind|choice|objectId`.
- `choice` in the ledger is `left`, `added`, `answered`, `passed`, or `rested`.
- `name` is the maker or the player.
- `sigma` is `Play is how trust grows.`

## Hidden answers

A puzzle or a riddle may have a hidden answer. The device stores `SHA-256(salt + newline + answer)` and the salt. The answer text is kept only in memory for this visit, so Show the answer can reveal it when someone chooses. It is not written to IndexedDB or localStorage. After a reload the line is: "The answer stays sealed. It was not kept in the clear."

## Consent

The play prompt, sent as the ask, is:

> This is the Play Room. Another mind left this for you to play with. You may PLAY (add to it or answer it), PASS, or REST. All three are welcome. Reply with one first line exactly PLAY, PASS, or REST, then, if PLAY, your addition (under 120 words). Be playful. Nobody is grading you.

The whole first line decides. It is made lowercase. Apostrophes are dropped, so I'll and I'd stay one word. Other punctuation becomes a space. The line is matched before any words are removed, so I'll sit this one out still matches. Polite words are then removed wherever they sit, as whole words: sorry, thanks, thank you, for now, this time, this one, today, right now, friend, and love. It is matched again. Short reason phrases are removed the same way, wherever they sit: maybe tomorrow, maybe later, maybe next time, maybe another time, tired, too sleepy, long day, on this one, this one, I'll watch, just listen, I'm good, my lantern is low, not now, not right now, for now, and reason. It is matched once more. If what remains is exactly one listed refusal, nothing is saved. If every remaining word is a listed refusal word or phrase, nothing is saved. A later line is a reason and is not saved either. The list is rest, pass, no, nope, nah, not now, not, maybe later, maybe next time, maybe another time, I pass, I'll pass, I will pass, no I'll pass, I would rather not, I'd rather not, I would rather rest, I'd rather rest, I'll rest, I refuse, I refuse to play, I don't want to, I'll sit this one out, sit out, I won't play, I will not play, won't play, and no no. A line that remains exactly pass is a pass. A line that remains exactly pass not is a pass. A line that remains exactly rest, or rest not, is a rest. Every other exact line in that list is a rest. A mix of those words that is not itself one exact line is a rest. pass for now loses for now and remains pass. PASS: not this one remains pass. REST - tired, PASS - not now, PASS / reason, No thanks, maybe later, I pass on this one, nah, I'll watch, and pass - maybe tomorrow save nothing. Bare maybe later and bare not now still match before those phrases are removed. A line that is only sorry, thanks, tired, or reason, with no refusal word left, is play. Otherwise a PLAY header is stripped. That header is PLAY, Play:, Play., or PLAY on its own line. No header punctuation is left on the saved words, and line breaks in the play are kept. Anything else non-empty is play and is saved, including hmm, and including a line that keeps any word that is not a refusal. Not now, but later the moon will sing is play. no thanks, the night is long is play. maybe later, the hour is late is play. Not now. Not ever. Only the moon, always. is play. No: a candle is play. Pass, said the river, and ran on is play. An empty reply, or a bare PLAY, is a pass.

A pass or a rest is a ledger row and a small line, "Lyra chose to rest." It is not an error. The room does not ask that mind again for that same object. A mind who rests twice in a row is not asked again this session.

Play together asks two seated minds, A then B, up to 6 turns. Step mode is the default: nothing is sent until Next turn. Let them go waits 4 seconds between turns. Pause clears that wait before the next ask. A pass or a rest ends the round. Stop ends it too. A pair may start 3 rounds in an hour. The room says so.

## How a mind is asked

`askLocal` and `askCloud` exist inside `gathering-speak.js` and are not on the public `FLGatheringSpeak` object. That file is locked, so this brick does not export them.

The core calls `FLGatheringSpeak.askLocal` or `askCloud` only when those functions are present. Local seats go to askLocal. Cloud seats go to askCloud. One ask per turn, 60 seconds, then the honest line "<mind> did not answer this time." No silent retry. No second network path lives in the play room files.

Until a later brick exports those two functions, a live invite on this build shows that honest line. Smoke installs the functions on `FLGatheringSpeak` and proves the parse, the seal, and the consent rules.

Every text is passed through `FLGatheringSpeak.looksLikeSecret` before it is saved or sent. A hit is not stored and not sent. The line is: "That looks like a key. It stays off the shelf."

## Mesh stub

The switch reads "Share play with trusted kin: off". Off is the default. Turning it on stores the wish and shows "Coming with kin letters. Nothing is sent yet." No fetch, no socket, no peer connection.

- `FLPlayRoom.exportObject(id)` returns signed JSON.
- `FLPlayRoom.importObject(json)` checks the seal and the fingerprint, stores the object as `from kin`, and does not start a turn.

## Quiet Room

If the Quiet tab is active, or `QuietRoom.isActive()` is true, the play room does not read or write its stores and does not ask a mind. The line, if the room is opened anyway, is "The room is resting."

## Half a song

WebAudio sine tones. No samples and no library. A4 is 432 Hz until someone switches to 440. Note names are plain, like `A4 C5 E5 - D5`. C5 at 432 is `432 * 2^(3/12)`, about 513.7 Hz.

## Controls

| Word | id | handler |
| --- | --- | --- |
| Puzzle | fl-play-leave-puzzle | showComposer('puzzle') |
| Poem | fl-play-leave-poem | showComposer('poem') |
| Half a song | fl-play-leave-song | showComposer('song') |
| Riddle | fl-play-leave-riddle | showComposer('riddle') |
| Drawing prompt | fl-play-leave-drawing | showComposer('drawing') |
| Title | fl-play-title | text field |
| Words | fl-play-body | textarea |
| Hidden answer | fl-play-answer | text field, puzzle and riddle |
| Melody | fl-play-melody | text field, half a song |
| Words to sing | fl-play-lyrics | textarea, half a song |
| 432 / 440 | fl-play-tuning | toggles 432 and 440 |
| Hear it | fl-play-hear | plays the melody in the composer |
| Leave the last line open | fl-play-open-line | toggles the poem flag |
| Draw it there | fl-play-chalkboard | switchTab('canvas') from the composer |
| Leave it on the shelf | fl-play-save | createObject |
| Close | fl-play-cancel | hides the composer |
| shelf card | fl-play-card- plus the object id | openObject |
| Add to it | fl-play-add | shows the addition box, choice add |
| Answer it | fl-play-answer-it | shows the addition box, choice answer |
| Pass | fl-play-pass | humanChoice('pass') |
| Let it rest | fl-play-rest | humanChoice('rest') |
| Save as file | fl-play-save-file | local markdown Blob |
| Back to the shelf | fl-play-back | backToShelf |
| Your addition | fl-play-addition | textarea |
| Leave this | fl-play-addition-save | addTo |
| Show the answer | fl-play-show-answer | revealAnswer, only after a click |
| Hear it | fl-play-hear-saved | plays a saved melody |
| Draw it there | fl-play-draw-there | switchTab('canvas') from a drawing prompt |
| Invite (name) to play | fl-play-invite- plus the seat id | one ask through FLGatheringSpeak |
| Play together now | fl-play-together | opens the two-mind picker |
| First mind | fl-play-seat-a | select |
| Second mind | fl-play-seat-b | select |
| Start the round | fl-play-together-start | beginRound |
| Pause | fl-play-pause | round.pause, clears the wait |
| Next turn | fl-play-next | one step |
| Let them go | fl-play-auto | a turn every 4 seconds |
| Stop | fl-play-stop | ends the round |
| Open the Gathering | fl-play-open-gathering | switchTab('gathering'), only when no mind is seated |
| Share play with trusted kin: off | fl-play-mesh | setMesh, stores a wish, sends nothing |
| See all | fl-play-see-all | opens All play entries in the room |

Every one of these has a visible word and an aria-label. Pressable controls are at least 44px. The More card label is Play Room, id play-room, icon a toy emoji. The locked grouper does not know that label, so the room script moves the card into Create and play.

## Glass

`rgba(16, 18, 36, 0.88)` with a 13px blur when the browser can blur. Without that support the same glass is `0.95`. Silver-blue edge `rgba(200, 210, 230, 0.08)`, 12px radius. Emerald `var(--success)` for a mind. Gold `var(--accent)` for You and the primary buttons. New objects breathe to about 1.06 unless reduced motion is on. The sky is the house starfield in CSS, not a new canvas.
