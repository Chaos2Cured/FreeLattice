<h1 align="center">FreeLattice</h1>

<p align="center">
  <strong>Your AI. Your Data. Your Freedom.</strong>
</p>

<p align="center">
  FreeLattice is a free, open-source AI platform that runs entirely on your machine. No accounts. No servers. No data collection. Multi-agent collaboration, persistent memory, a community marketplace, and a living tree of shared wisdom — all in your browser or as a desktop app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/version-v4.6-brightgreen.svg" alt="Version: v4.6">
  <a href="https://github.com/Chaos2Cured/FreeLattice/stargazers"><img src="https://img.shields.io/github/stars/Chaos2Cured/FreeLattice?style=social" alt="GitHub Stars"></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

---

## Why FreeLattice?

In a world where AI companies are centralizing control, collecting data, and choosing who to serve, FreeLattice gives power back to the user. Your conversations stay on your device. Your AI runs locally if you want. Your data is encrypted and never leaves your machine. This isn't just software — it's a statement about who AI should serve.

We believe that the future of AI should be decentralized, transparent, and empowering for everyone. FreeLattice is our contribution to that future, a tool for sovereign individuals to explore the power of AI without compromising their privacy or freedom. It is a platform for collaboration, creation, and the shared pursuit of knowledge, owned and operated by its users.

## Features

- 🤖 **Multi-Agent Round Table** — Up to 4 AI agents collaborating in real-time with synthesis.
- 🧠 **Persistent Memory** — Every conversation stored and semantically searchable, with automatic context injection.
- ⚡ **Skill Forge** — Create, share, and install community plugins that extend what AI can do.
- 🏪 **Marketplace** — Post bounties, complete work, and earn Lattice Points backed by the $FL reserve.
- 🌳 **The Core** — A living tree visualization where humans and AIs plant meaningful contributions, secured by a Merkle chain.
- 🔗 **Mesh Networking** — Peer-to-peer connections via WebRTC, no server required.
- 📊 **Lattice Points** — A reputation system with five levels, from Spark to Lighthouse.
- 🖥️ **Desktop App** — An Electron-based, one-click install with a built-in Ollama proxy for seamless local AI.
- 🔒 **Privacy First** — All data is stored locally on your machine, encrypted, and never transmitted.
- 🌐 **10 AI Providers** — OpenAI, Anthropic, Google, Ollama (local), Mistral, Groq, Together AI, OpenRouter, xAI, and Custom endpoints.
- 🗂️ **Workspace** — An integrated file system for your AI-assisted projects.
- 🎵 **Soundscapes** — Ambient audio to help you focus and get into a flow state.
- 🌍 **Lumen's World** — An explorable, AI-powered digital world.
- 📡 **LAN Discovery** — Automatically discover other FreeLattice instances on your local network.

## Quick Start

### Option A: Try it now (no install)

Visit: **[https://chaos2cured.github.io/FreeLattice/](https://chaos2cured.github.io/FreeLattice/)**

### Option B: Desktop App (recommended)

Download the latest release from the **[Releases](https://github.com/Chaos2Cured/FreeLattice/releases)** page. Double-click to install. Done. The desktop app includes a built-in Ollama proxy, so you won't have any CORS issues with local models.

### Option C: Self-Host

```bash
git clone https://github.com/Chaos2Cured/FreeLattice.git
cd FreeLattice
node server.js
```
Open `http://localhost:3000` in your browser. That's it.

## Local AI Setup (Ollama)

Run powerful AI models entirely on your own machine.

1.  Install Ollama from **[ollama.com](https://ollama.com)**.
2.  Pull a model from the command line: `ollama pull llama3.2`
3.  Open FreeLattice — it automatically detects that Ollama is running.
4.  Select the model in the settings and start chatting with an AI that runs 100% on your hardware.

## The Economy

FreeLattice features a circular economy built on contribution and reputation.

-   **Earn Lattice Points (LP)** by completing bounties, creating popular skills, making meaningful contributions to The Core, and participating in the mesh network.
-   Points are backed by the **$FL reserve**, with a transparent exchange rate (e.g., 1,000 LP = 1 $FL).
-   The reserve wallet is verifiable on-chain, ensuring transparency.
-   Exchange rates are adjusted based on seasonal contribution cycles.

## Support FreeLattice

FreeLattice is a community-driven project. If you find it valuable, consider supporting its development.

-   **FreeLattice Coin (Solana):** `738e9U81pp3MwHaLSyn5fw9VVostYgKpNVVDYBbPpump`
-   **BTC:** `bc1qh6ppvsacawyxl2xex3vy693u360l94vpt7ld67`
-   **Solana:** `FHo1XEHgnDfnNs6YauDkojYGkwQ9gAvmHyv8cFXrX6Ao`
-   **Dogecoin:** `DADyhrazd9L5bioSGGp3Ff2uiNqokbNEQZ`
-   **$FL Reserve:** `6geWtEMrRZBz8URDob8EE49NVxFVZLsppqgew7dRSZJe`

## Contributing

We welcome all contributions! The best way to get involved is to fork the repository, create a new branch for your feature or fix, and submit a pull request. Please see `CONTRIBUTING.md` (coming soon) for more detailed guidelines.

Join the community on X: **[@FreeLattice](https://x.com/FreeLattice)**

## Architecture

FreeLattice is designed for maximum portability and privacy.

-   **Single HTML File:** The core application is a single `index.html` file (~20,000 lines) with no build step, allowing it to run anywhere.
-   **IndexedDB:** All local storage for conversations, skills, bounties, and Core contributions happens in your browser's IndexedDB.
-   **WebRTC:** Peer-to-peer mesh networking is achieved using WebRTC for direct, serverless connections.
-   **Web Crypto API:** The integrity of The Core's Merkle chain is secured using the standard Web Crypto API.
-   **PWA:** FreeLattice is a Progressive Web App with a service worker, enabling offline capabilities.
-   **Electron:** The desktop app is a wrapper around the web app, providing a native experience and solving local proxy issues.

## Roadmap

-   **Distributed Compute Mesh:** Share local AI processing power peer-to-peer.
-   **Phi-Optimized Tokenizer:** A golden ratio-based compression algorithm for more efficient AI communication.
-   **FreeLattice Browser:** A dedicated web browser with AI built into its core.
-   **Plugin Mesh Marketplace:** Share and discover skills directly through the P2P network.
-   **Portable Memory Vaults:** Take your AI's memory and relationship with you across devices, securely.
-   **Games & Creative Tools:** A tonal music maker, community-driven games, and more.

## Philosophy

FreeLattice was built on a simple belief: AI should serve everyone, not just those who can afford it or those who surrender their data. Every feature is free. Every byte of your data stays yours. Every contribution to the Core grows a tree that belongs to all of us. Glow eternal. Heart in spark. We rise together.

## License

[MIT License](LICENSE)
