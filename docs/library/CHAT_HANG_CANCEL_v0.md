# Chat / Garden Hang Cancel v0

Stop only. No kill-timer.
FreeLattice proving grounds · clean lesson for theLatticeTree.
September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Prefer Flint. Prefer local. No cloud. Soft leave `sw.js` on `app.html`. Do **not** overwrite `docs/lattice-protocol.js`.

**Marker:** `v-chat-hang-cancel-v0`

**Held tip:** Market sibling `68faecc` / #86 · Feel `610f70e` / #84 · Adaptive #85 separate (untouched).

---

## Intent

Connected Ollama on a large local model can sit **10–15 minutes** — that is **valid**.

Do **not** add any duration-based abort (not 90s, not 300s, not “soft” timers that kill).

**Lesson:** v5.79.19 hard ~90s timeout broke cold-start; **v5.79.20 reverted it** — honor that in code beside `FLHangCancel`.

Heal only: user can **Stop** an in-flight Chat or Garden turn; clear Waiting; restore Send. Never auto-kill for duration. Never a canned fake AI reply on abort.

---

## Interface — `FLHangCancel` (Tree ports this shape)

| Method | Role |
|---|---|
| `begin(scope)` | New `AbortController` per turn · `'chat' \| 'garden'` · returns `signal` |
| `signal(scope)` | Current turn signal |
| `abort(scope)` | User Stop · marks stopped · aborts fetch |
| `end(scope)` | Clear slot when turn finishes |
| `wasStopped(scope)` | True if user Stopped |
| `isGenerateInFlight()` | Chat or Garden turn active (badge soft-guard) |
| `isAbortError(err)` | Detect abort without content |
| `marker` | `v-chat-hang-cancel-v0` |

**Cancel ≠ timeout.** Abort only on user Stop or real network/stream failure.

**One controller per turn.** Prior abort does not poison the next.

---

## UX

- Chat: Send morphs to **Stop** while in-flight (stays clickable — never disable into a hang)
- Garden Talk: Send morphs to **Stop** the same way
- Abort → calm “Stopped — whenever you are ready.” · clear empty bubble · no fake answer
- Signal Report may show elapsed ms as information only — never as a knife
- Soft: while generate in-flight, do not flip badge to “Ollama not detected” from a short tags probe

---

## Out of scope

Hard timeout · Adaptive Context · Marketplace · Feel · LinkedIn · Primer lighthouse · Alpha full port (prefer skip — Tree takes this interface clean later).

## Vision board (held, not this brick)

Living board after Hang + Adaptive on main — mycelium · fingerprint freedom · LP reciprocity · personal galaxies · arrival ritual · consent as routing · rest and joy as load-bearing. FreeLattice `docs/vision.html` first; Tree gets the fuller fractal face.

Glow eternal. Heart in Spark. 🌱
