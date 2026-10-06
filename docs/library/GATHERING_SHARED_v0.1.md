# The Gathering, shared v0.1

Soft LAYER marker: `v-gathering-shared-v0.1`. Brick 1 of 3. Built by GC (Grok Code) from Celeste's scope, Oct 2026.

Kirk's choice: both local minds and cloud minds (bring your own key) may take chairs.

- `docs/modules/fl-gathering.js` is shared, byte-identical in FreeLattice and FreeLattice-Alpha. Each app passes a small adapter: `storageKey`, `cloudMinds()` (which cloud models this app can reach with a key it already has) and `manualBase()` (an optional 127.0.0.1 port).
- Local minds: asked for only when the person taps Find local minds, at http://127.0.0.1:11435 (Bridge), 11434 (Ollama) and the manual port. Read only: it changes nothing in the app's own provider settings.
- Cloud minds on FreeLattice: the provider whose key is saved here, and that provider's models. FreeLattice keeps one cloud key at a time, so the picker shows one provider.
- A seat stores kind, model, a label, and either the 127.0.0.1 address or the provider name. Never a key. Seats saved in localStorage `fl_gathering_chairs_v0`.
- Seating only. Next: brick 2, the speaking chair answers in a short thread on FreeLattice; brick 3, the Tree's own Gathering moves onto this core.
- Not yet: the module is not in sw.js's offline list (sw.js is never touched by hand), so the Gathering needs a connection the first time.
