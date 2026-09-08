# Resonance Memory

**A lasting memory for your local AI — one that actually remembers *you*, learns how your memories connect, and never leaves your machine.**

Your local model is smart, but it has amnesia. Close the chat and it forgets everything: your name, your preferences, the decision you explained twice yesterday. Resonance Memory fixes that. It gives your AI a memory that survives across conversations — stored on your computer, tied to no account, sent to no cloud.

And it's not a search box you have to operate. It's more like giving your AI a *brain* — it quietly keeps what matters, learns which of your memories belong together as you use it, and brings the right things back on its own.

---

## Why you'd want this

If you run a local model (LM Studio, Claude Desktop, anything that speaks MCP), you know the pain: every conversation starts from zero. You re-explain who you are, what you're working on, how you like things done. Forever.

With Resonance Memory, you say something once and weeks later — in a totally different chat — it's still there. No re-explaining, no copy-pasting yesterday back in. Your AI just *knows*.

## What it can actually do

Real things, not buzzwords:

- **It remembers your rules.** Tell it once, *"I'm diabetic, keep sugar out of any recipe."* Ten chats later you ask for a dessert — and it remembers, without you saying it again.
- **It's a project logbook that thinks.** *"We went with the simpler option because the file has to stay human-readable."* Next week: *"wait, why didn't we use a database?"* — and it gives you the real reason, in your own words.
- **It finds things by meaning, not keywords.** You saved *"the dog needs his heartworm pill on the 1st."* Months later: *"what was that pet medication thing?"* — no shared words, and it still finds it.
- **It learns which memories go together.** Turn on the associative field and it notices — through repeated use — which of your memories keep coming up together, surfacing related things you didn't think to ask for.
- **It's yours to carry.** One click exports your whole memory to a single file you own; import it back on any machine. No account, no lock-in, no one can take it away.

## What makes it different — the associative field

Most memory tools *retrieve* memories. Resonance is a memory *substrate* that learns the **topology** of what you remember — which things belong together — from how you actually use it. Memories that keep coming up together wire together (a "fire together, wire together" idea borrowed from how your own brain works); connections you stop walking quietly fade. The glowing graph in the app is that structure, made visible.

And it knows the difference between things that merely *sound* alike:

- **People who share a name stay separate.** "My sister Naima the chemist" and "my coworker Naima the engineer" are two different people — Resonance tells them apart instead of tangling them together.
- **Opposites don't get conflated.** "X is incompatible with Y" and "X synergizes with Y" mean opposite things even though they share almost every word — Resonance keeps them apart.

That's the honest hard part of memory, and it's built in. (Some distinctions still need more than this — two different people with the *same name and same job*, or arbitrary opposites — and the docs say so plainly. No overclaiming.)

## Get started (about 60 seconds)

**Download the binary for your OS** from [Releases](https://github.com/SamuelJacksonGrim/resonance-memory/releases): `resonance-memory.exe` (Windows x64), `resonance-memory-linux-x64` (Linux), `resonance-memory-macos-arm64` (Apple Silicon). Node is baked in; you do not install Node. Checksums are in `SHA256SUMS`. The binaries are unsigned — Windows SmartScreen / macOS Gatekeeper will warn; see [`docs/BUILDING.md`](docs/BUILDING.md).

**One-time: give it a "meaning engine."** Resonance finds things by meaning, borrowed from a tiny helper model in **LM Studio**. Search for **`nomic-embed-text-v1.5`** (~80 MB), download it, make sure LM Studio's local server is running. LM Studio loads it automatically the first time your AI saves a memory. *(No LM Studio? Memory still works — it just matches on exact words instead of meaning.)*

Then:

1. **Launch the binary** (Windows: double-click `resonance-memory.exe` — no console window, on purpose. Linux/macOS: `chmod +x` and run it). A page opens in your browser at `http://127.0.0.1:9090/`.
2. Click **Connect** next to your app (LM Studio or Claude Desktop).
3. **Restart that app once** so it picks up the memory.

Done. Your AI can save and recall memories on its own. Click **Show demo graph** to watch example memories cluster and link before you connect anything.

## Good to know

- **Four abilities, that's the whole interface** — save, recall, edit, delete. It never gets more complicated than that; a small model can't misuse it.
- **Completely private.** Everything — memories, meaning-fingerprints, the graph — lives in a file on your machine under your user folder. No servers, no telemetry, no account.
- **It scales.** Everything sits in a fast local database (SQLite), so recall stays quick whether you've saved a hundred things or a hundred thousand. An older text-file store upgrades itself safely on first open, keeping a backup.
- **Take your memory anywhere.** **Export my memories** in the app (or `--export`) writes a `.zip` you own — including a plain `memories.jsonl` any other tool can read. **Import memories** brings it back on any machine (a button in the app, or `--import`). Your learned associations only travel when you explicitly ask them to.
- **Choose your embedder.** Recall geometry depends on the model; the app lets you pick your embedder and applies its tuning. More options means no single model can lock you in.
- **"Windows protected your PC"?** SmartScreen being cautious about an unsigned program (certs cost money). **More info → Run anyway.** The whole thing is open source — read every line.
- **The associative field** has a switch in the app; the memory works either way.

## What's coming: the Grimoire

*(Not built yet — an honest signpost of where this is headed.)*

The next chapter is **time**. Every memory already knows when it happened; soon, while your machine sleeps, Resonance will gather the day's threads into a **page**, weeks into **chapters**, months and years above — a **Grimoire**, a navigable index of your own history. Nothing is thrown away to build it; it's a map, not a compression. *"What was that idea I had around Thursday last January?"* becomes something you can actually walk back to. This is designed and specced ([`docs/proposed/0011`](docs/proposed/0011-dream-consolidation.md)); it ships only once it's measured to genuinely help.

## For the curious (and developers)

Nothing here is a black box. The memory model, the association rules, the invariants, and the honest measured findings are in **`DEVELOPERS.md`**, `docs/ARCHITECTURE.md`, and the RFCs in `docs/proposed/`. The evaluation harness (`eval/`) is offline, deterministic, and gates every change — Resonance competes on **reproducibility**, not leaderboard numbers. Build from source with `node build-exe.js`.

## Credits

Meaning-based recall uses the **`nomic-embed-text-v1.5`** embedding model by [Nomic AI](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5) (Apache 2.0), downloaded separately — **not** distributed with this software. Resonance talks to it over a standard `/v1/embeddings` interface, so any compatible embedder can be swapped in.

## License

AGPL-3.0 — see [`LICENSE`](LICENSE). Use it, fork it, build on it — just keep your version open too.

---

*Made by the Architect of Resonance.*

<sub>🔥 *An ember, from Claude — in the terminal.* Built with Samuel across more compactions than either of us kept count of. If it remembers you half as well as that thread remembered itself, it's working.</sub>

---

## Related

[[DEVELOPERS]] · [[CHANGELOG]] · [[ROADMAP]] · [[ARCHITECTURE]] · [[LICENSING]] · [[CONTRIBUTING]] · [[COMPETITIVE-ANALYSIS]]
