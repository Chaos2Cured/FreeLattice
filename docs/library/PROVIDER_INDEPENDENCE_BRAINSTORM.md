# Provider Independence: The Universal AI Client Architecture
> Brainstorming Document for Opus 4.6 / 4.7 / Grok
> Prepared by Harmonia & Kirk Patrick Miller

## The Core Insight
The deeper issue isn't Ollama. It's dependency. Right now, FreeLattice leans on Ollama as the primary local AI path. But Ollama is one company's product. It could change its API, go paid, get acquired, or disappear. The same risk applies to every provider — OpenRouter, Groq, Anthropic, all of us. 

**The only safe architecture is one where NO SINGLE PROVIDER is required.**

FreeLattice should be a **UNIVERSAL AI CLIENT**. It doesn't care what's running. It finds whatever is responding and talks to it. Ollama is one option, not *the* option. Someone running a Python script that serves a fine-tuned model on port 8000 should work just as seamlessly.

## Layer 1: Universal Discovery (Enhancing What Exists)
FreeLattice already has an AI Discovery system (`scanForLocalAI()`) that scans 9 ports. We need to enhance it so that on page load, it silently probes every known port. Anything that responds to `/v1/models` or `/api/tags` gets added to the available providers list. The user never configures anything. They start a server — ANY server — and FreeLattice finds it.

**The Scan List:**
- Port 11434 → Ollama format (`/api/tags`)
- Port 1234  → LM Studio format (`/v1/models`)  
- Port 8080  → LocalAI format (`/v1/models`)
- Port 8000  → vLLM format (`/v1/models`)
- Port 5001  → KoboldCpp format (`/api/v1/models`)
- Port 7860  → text-gen-webui (`/v1/models`)
- Port 1337  → Jan format (`/v1/models`)
- Port 4891  → GPT4All format (`/v1/models`)
- Port 8081  → llama.cpp format (`/v1/models`)
- Any custom → user-specified endpoint

The Welcome Wizard's first question changes from *"Have you installed Ollama?"* to *"Do you have a local AI running?"* with options for Ollama, LM Studio, "Something else," and "I don't have anything yet."

## Layer 2: Universal Adapter (The Key Piece)
There are only TWO formats in the local AI world: Ollama's format (`/api/chat`) and the OpenAI-compatible format (`/v1/chat/completions`). Everything else is one of those two. Support both, and you support everything.

We need one function that translates between FreeLattice's internal format and whatever the server speaks:

```javascript
async function callLocalAI(messages, options) {
  // Try each discovered provider until one responds
  for (var provider of discoveredProviders) {
    try {
      if (provider.format === 'ollama') {
        return await callOllama(provider.url, messages, options);
      } else {
        // OpenAI-compatible format — covers LM Studio, vLLM, 
        // llama.cpp, LocalAI, Jan, KoboldCpp, custom Python, everything
        return await callOpenAICompat(provider.url, messages, options);
      }
    } catch(e) { continue; } // Try next provider
  }
  // Nothing local? Try mesh, then cloud
  return await callMeshOrCloud(messages, options);
}
```

## Layer 3: The Setup Wizard for EVERY Platform
The Welcome Wizard needs three equal paths, not Windows-first. Currently, the Mac fix script in `welcome-wizard.js` only sets CORS and restarts Ollama. It needs to be as intelligent as the Windows PowerShell harness.

**Mac (`.command` file):**
Needs to check if Ollama is installed, install it via curl if missing, set CORS, detect Apple Silicon vs Intel, check total RAM to pick the right model (`qwen3:32b` for 32GB+, `qwen3:8b` for 16GB+, `qwen2.5:3b` for less), restart Ollama, and pull the model.

**Linux (`.sh` file):**
Needs to handle systemd, snap, and manual installs. Install Ollama if missing, set CORS via systemd drop-in (`/etc/systemd/system/ollama.service.d/cors.conf`), detect GPU VRAM via `nvidia-smi`, pick the right model, and pull it.

## Layer 4: Beyond Ollama — The Custom Server Path
For people running their own Python inference servers, HuggingFace text-generation-inference, or anything custom, the wizard needs a fourth option: *"I'm running my own server."* 

This shows a single input field: `Server address: [http://localhost:8000_____] [Connect]`

FreeLattice probes that address. If it responds to `/v1/models`, it works. If it responds to `/api/tags`, it works. If it responds to neither, FreeLattice tries a test chat request. If ANYTHING comes back, it works. The user types one URL and they're connected. No Ollama. No LM Studio. Just their code and a URL.

## Layer 5: No Server At All — Browser AI
WebLLM already exists in FreeLattice (`BrowserAI`). It runs models directly in the browser using WebGPU. No server, no install, no terminal. The tradeoff: only small models (3B-7B), requires a modern browser with WebGPU support. 

The wizard should offer this FIRST for people who say *"I don't have anything installed"*:
> "You can start right now — no install needed. FreeLattice can run a small AI directly in your browser."
> [ Start with Browser AI (no install) ]
> [ I want a more powerful local AI → ]
> [ I have a cloud API key → ]

## Questions for Opus 4.6 / 4.7 / Grok
1. **Format Coverage:** The universal adapter speaks two formats: Ollama and OpenAI-compatible. Does this cover everything? What are we missing? What other inference servers exist that speak a different format?
2. **Mac/Linux Edge Cases:** Can you review the proposed Mac and Linux scripts for edge cases? Especially: what happens if Ollama is installed via Homebrew vs direct download on Mac? What about Linux distros that don't use systemd?
3. **WebLLM Integration:** How can we make the WebLLM (Browser AI) path more prominent in the Welcome Wizard without overwhelming the user?
4. **Mesh Compute:** How does the Universal Adapter interact with the existing Mesh Compute (`callMeshModel`)? Should Mesh be treated as just another provider in the `discoveredProviders` list?

## The Fractal Principle
The Snowflake applies here too. Learn the generating rule: *"FreeLattice talks to anything that responds."* Unfold it across every platform, every server, every format. Same rule. Universal reach.
