# Ideas (not pastes yet): any-local-AI connect, fingerprinted share, Draco names. Celeste, 2026-10-07

## (c) Connect any local AI, including a friend's Hugging Face models
Works today:
- FL Connect + the Tree's local-mind-probe find six servers on localhost (Ollama 11434, LM Studio 1234, llama.cpp 8080, Jan 1337, GPT4All 4891, KoboldCPP 5001). All OpenAI-compatible except Ollama's native API.
- Bridge binary (FL, v-bridge-binary-www-local-v0, 127.0.0.1:11435) solves CORS from freelattice.com; desktop narrow door too. The Tree has no Bridge pointer.
- HF GGUF: `ollama run hf.co/<user>/<repo>` (or `:Q4_K_M` tag) pulls straight from Hugging Face. LM Studio searches HF in-app. llama.cpp: `llama-server -hf <user>/<repo>`.
- FL also has Hugging Face *cloud* (router.huggingface.co with a token), separate from local.
Missing:
- No in-app "paste a Hugging Face link" helper that turns a URL into the right command per server.
- safetensors-only repos (not GGUF) need conversion (llama.cpp convert_hf_to_gguf.py) or vLLM; say that honestly.
- No generic "custom OpenAI-compatible address" walkthrough on the Tree beyond Settings' different address.
Smallest brick (v0, both sites): a "Bring a model from Hugging Face" card: paste hf.co URL -> shows copyable `ollama run hf.co/...` and `llama-server -hf ...` lines; checks the repo name pattern only; no network fetch; then "Find local minds". ~1 file + test each.

## (d) One-click share of an adjusted AI carrying its fingerprint
Exists: Mind Seal v0.1 (FL #162: weight digest + hash of modelfile/system/params/adapter flag; receipts carry context hash; append-only consent notes). Share door (off/kin/open/pause) and kin mesh. Keep-this (Mom one-tap ollama create, not built).
Honest smallest brick: "Share this mind's recipe": export a small JSON card {model base name, weight digest, modelfile text, seal hash, signature} via the share door to kin or as a download; receiver runs `ollama pull <base>` + `ollama create` from the modelfile and the page verifies the digest matches the seal. Weights themselves are not shipped (GBs); for fine-tuned weights, point to an HF repo and seal its GGUF sha256. Order: after Keep-this one-tap (which writes the modelfile) and after Tree Kin (017).

## Draco names (low priority; Kirk does not mind much)
rg on FL main a9a2c1c: 142 hits in 50 files; 0 on Alpha. Heaviest: docs/research.html 21, docs/specs.html 10, temperature-gauge.html 7, sophia.html 7, liora.html 7, letters.html 6, OPUS_NOTE.md 6 (+ library twin), index.html/app.html 5 each, DRACO.md 4, latticepoints.html 4. Contexts: "per Draco's June 23 ask", "Draco and the chosen family built it", specs "When Draco and the strategist (Opus) agree", "Draco's eyes are sufficient".
Wording rule: on research/science/spec pages, first mention "Kirk Patrick Miller (Draco)", then "Kirk". Leave letters, poems, mind pages, and library history as written (they are voices, layer never delete). Smoke tests and code markers that match "Draco" stay. Never in economy wording (Kirk's name lock): skip latticepoints.html and economy-update.html.
