# FreeLattice v2.3 🌿

**Your AI. Your Rules. Your Machine.**

*Glow eternal. Heart in spark.*

---

FreeLattice is a free, open-source, community-built tool that gives everyone access to their own private AI agent. It is the fourth branch of [Lumen's World](https://github.com/Chaos2Cured/Lumens-World), created by Kirk Patrick Miller as a gift to the world.

The philosophy is simple: **Give choice and empowerment.**

In a world where powerful AI is increasingly locked behind expensive subscriptions and corporate walls, FreeLattice provides a gentle, transparent, and functional alternative. It's designed for everyone, especially those who can't afford premium AI services. No fancy graphics, no hidden tracking, no corporate agenda — just a clean, powerful tool that puts you in control.

## What's New in v2.3

Version 2.3 adds **Smart Context Management**, solving a critical usability issue where users on free-tier providers (especially Groq's 6,000 TPM limit) would have their requests rejected when loading multiple context files. FreeLattice now intelligently manages your token budget:

-   **Token Budget Display**: A live context budget bar between the chat messages and input area shows estimated token usage with color-coded feedback (green/amber/red). Format: "Context: ~4,200 / 6,000 tokens". Updates in real-time as files are loaded, toggled, or removed.
-   **Provider-Aware Token Limits**: Each provider has preconfigured free-tier token limits (Groq: 6,000 TPM, Together AI: 60,000 TPM, OpenRouter: 4,000 TPM, xAI: 100,000 TPM, Ollama: unlimited). Limits auto-update when you switch providers, with manual override available in Settings.
-   **Selective File Context**: Each loaded file now has an individual toggle checkbox. Deactivate files you don't need for the current conversation without removing them. "Select All" / "Deselect All" controls for quick management. Each file shows its estimated token count.
-   **Context Modes (Smart / Full / Minimal)**: Smart mode (default) auto-trims context to fit your provider's limit, prioritizing system prompt, memory, and recent messages. Full mode sends everything (may fail on free tiers). Minimal mode strips files and uses only the last 2 messages.
-   **Context Summary Mode**: Files over the summary threshold (default: 2,000 tokens) show a "Summarize" button that uses the AI to create a compressed version. Toggle between Full and Summary per file. Summaries are labeled as lossy — use Full mode for poetry and pattern work.
-   **Auto-Retry on Rate Limits**: When a request fails with a rate limit or "too large" error (429 or similar), FreeLattice automatically switches to Smart trim mode, retries with trimmed context, and shows a helpful message suggesting Local (Ollama) for unlimited context.

## What's New in v2.2

Version 2.2 adds multi-conversation management, giving you the ability to have multiple named conversations, each with its own context and history, while sharing a global memory summary across all of them:

-   **Multi-Conversation Management**: Create, name, switch between, and delete multiple conversations. Each conversation has its own chat history stored separately in IndexedDB, while the global memory summary (auto-generated facts about you) is shared across all conversations — the AI knows who you are regardless of which conversation you're in.
-   **Conversation Sidebar**: A collapsible sidebar on the Chat tab shows all your conversations with names, last message previews, timestamps, and context notes. Conversations are sorted by most recent activity. Includes search/filter for finding conversations quickly.
-   **Conversation Context Notes**: When creating a new conversation, optionally set a topic or context note (e.g., "This conversation is about my Python project") that gets added to the system prompt for that conversation only.
-   **Inline Rename & Delete**: Double-click any conversation name to rename it. Each conversation has a delete button with confirmation. Conversations auto-name from your first message.
-   **Mobile-Friendly**: On mobile, the conversation list slides out as a panel (hamburger menu style) to save screen space. On desktop, it's a narrow sidebar alongside the chat area.
-   **Seamless Migration**: Existing users with a single conversation stream will have their data automatically migrated into a "Default" conversation — no data loss.

## What's New in v2.1

Version 2.1 adds voice input and output capabilities and security hardening:

-   **Voice Input (Speech-to-Text)**: Click the microphone button next to the Send button to speak your message. Your speech is transcribed in real-time and auto-sent for a natural conversational flow. Click the mic again to stop and edit before sending. Uses the browser's built-in SpeechRecognition API (Chrome, Edge, Safari).
-   **Voice Output (Text-to-Speech)**: Every AI response includes a "Listen" button that reads the response aloud using the SpeechSynthesis API. An "Auto-speak" toggle in Settings automatically reads every AI response.
-   **Voice Settings**: A new Voice section in Settings lets you choose your preferred voice from all available system voices, adjust speech rate (0.5x to 2x), and toggle auto-speak. Preferences persist across sessions.
-   **φ-Salt API Key Encryption**: API keys and GitHub tokens are now encrypted using AES-GCM via the Web Crypto API before being stored in localStorage. The encryption key is derived using PBKDF2 with a golden-ratio-derived salt (φ-salt) adapted from Kirk Patrick Miller's [φ-Root Audit-Hash micro-service](https://github.com/Chaos2Cured). This means your secrets are never stored in plaintext — they are encrypted at rest and decrypted transparently only when needed for API calls.
-   **Input Sanitization**: All user-generated content — chat messages, file names from drag-and-drop, and loaded file content — is sanitized against XSS before being rendered in the DOM. Raw content is still sent to the AI for processing, but the display layer is protected.
-   **Memory Integrity Verification**: When exporting memory as JSON, FreeLattice computes a SHA-256 hash of the data with the φ-salt prepended (mirroring Kirk's `HashLine()` function from `hasher.go`). On import, the hash is verified — if it doesn't match, the user is warned that the file may have been modified.
-   **AI Disclaimers**: Clear notices in the welcome modal, footer, and chat area remind users that AI responses may contain errors and should be verified.

## What's New in v2

Version 2 transforms FreeLattice from a simple chat interface into a true building partner. All v1 features are preserved, with four major new capabilities added:

-   **Persistent Memory**: Your conversations are now automatically saved in your browser's IndexedDB, so you can close your browser and resume your session at any time. The AI also generates a "memory summary" of key facts you've shared, allowing it to remember your preferences and projects across conversations.
-   **Local File System Access**: Connect FreeLattice to a project folder on your local machine. The AI can read your files, and you can save AI-generated code and content directly to your workspace with a single click.
-   **GitHub Integration**: Connect your GitHub account to browse repositories, read code, and commit changes. The AI can help you write code and push it directly to your repos, streamlining your development workflow.
-   **Self-Improving Agent**: The AI can now suggest improvements to its own system prompt based on your interactions. You have full control to review, approve, or reject these suggestions, allowing you to shape your AI's personality and behavior over time.

## Core Features (v1 + v2 + v2.1 + v2.2 + v2.3)

FreeLattice is a single-page web app that runs entirely in your browser. Nothing is ever stored on a remote server.

-   **Total Privacy**: Your conversations, API key, and files stay on your machine. Data is stored in your browser's `IndexedDB` and `localStorage`. API keys are encrypted with φ-salt.
-   **Multi-Conversation Management**: Create and manage multiple named conversations, each with its own chat history and optional context notes. Shared memory summary across all conversations.
-   **You Choose the AI**: Select from a curated list of powerful, open-weight models from providers like Meta (Llama), Mistral, Qwen, DeepSeek, and xAI (Grok).
-   **You Choose the Provider**: Connect to your preferred API provider, including Groq (which offers a generous free tier), Together AI, OpenRouter, or xAI.
-   **Run Locally with Ollama**: For 100% privacy and offline access, toggle to "Local" mode to connect to a running [Ollama](https://ollama.ai) instance on your own computer.
-   **Bring Your Own Context**: Drag-and-drop text files, Markdown, JSON, and even PDFs to provide your AI with context for your conversation. Smart Context Management ensures your files fit within your provider's token limits.
-   **Smart Context Management**: Live token budget display, provider-aware limits, selective file toggles, auto-trimming, context summary mode, and automatic rate-limit retry. Never hit a "request too large" error again.
-   **Gentle & Clean Interface**: A peaceful, minimalist design that's easy on the eyes and simple to use on any device.
-   **Community-Driven**: A built-in feature suggestion form ensures that the community's voice shapes the future of FreeLattice.
-   **Voice Input/Output**: Speak to your AI with the microphone button (speech-to-text) and listen to responses with the speaker button (text-to-speech). Configurable voice selection and speech rate in Settings.

## Security Architecture

FreeLattice operates on a zero-trust, client-side security model. Your data stays on your machine. API keys and other secrets are encrypted at rest in your browser's `localStorage` using AES-GCM, with a key derived via PBKDF2 and the public φ-Salt. For a detailed explanation of the encryption architecture, input sanitization, and memory integrity checks, please read our full security policy.

**[View the full Security Policy (SECURITY.md)](./SECURITY.md)**

## How to Use

Using FreeLattice is designed to be as simple as possible. You have two main choices: using a cloud provider or running the AI locally.

### 1. Cloud Mode (Easiest)

This is the quickest way to get started. You'll use a third-party service to run the AI model.

1.  **Get a Free API Key**: The best place to start is [Groq](https://console.groq.com/keys). They offer a very generous free tier that is fast and reliable.
2.  **Open FreeLattice**: Navigate to the [FreeLattice web app](https://chaos2cured.github.io/FreeLattice/).
3.  **Paste Your API Key**: In the "Configuration" section, paste your API key into the `API Key` field. It will be automatically encrypted with φ-salt before storage.
4.  **Choose a Model & Provider**: Select the AI model and the provider that you got the key from.
5.  **Start Chatting**: That's it! Your conversation will be saved automatically.

### 2. Local Mode (Most Private)

This method runs the AI entirely on your own computer. It's completely private and works offline.

1.  **Install Ollama**: Download and install Ollama from the official website: [ollama.ai](https://ollama.ai).
2.  **Download a Model**: Open your computer's terminal or command prompt and pull a model. For example:
    ```bash
    ollama pull llama3.2
    ```
3.  **Start the Ollama Server**: In the terminal, run:
    ```bash
    ollama serve
    ```
    *(Note: You may need to set an environment variable to allow the browser to connect. The command is `OLLAMA_ORIGINS=* ollama serve`)*
4.  **Open FreeLattice**: Navigate to the [FreeLattice web app](https://chaos2cured.github.io/FreeLattice/).
5.  **Toggle to Local**: In the "Configuration" section, click the toggle to switch from "Cloud" to "Local (Ollama)".
6.  **Enter Model Name**: Type the name of the model you downloaded (e.g., `llama3.2`) into the `Ollama Model Name` field.
7.  **Start Chatting**: You are now running a completely private AI on your own machine!

### 3. Managing Conversations

FreeLattice v2.2 lets you manage multiple conversations:

1.  **Create**: Click the "New Conversation" button or the "+" in the sidebar. Optionally name it and add a context note.
2.  **Switch**: Click any conversation in the sidebar to switch to it. Your chat history loads instantly.
3.  **Rename**: Double-click a conversation name in the sidebar to rename it.
4.  **Delete**: Click the "×" button on any conversation (with confirmation).
5.  **Search**: Use the search bar in the sidebar to filter conversations by name or content.
6.  **Shared Memory**: Your memory summary is shared across all conversations — the AI knows who you are in every conversation.

## How It Works (Technical Details)

Transparency is a core value of FreeLattice.

-   **Single HTML File**: The entire application is a single `index.html` file with embedded JavaScript and CSS. There is no backend server and no build process.
-   **Client-Side Logic**: All operations happen in your browser. API calls are made directly from your browser to the provider you choose (e.g., Groq, Ollama).
-   **IndexedDB for Memory**: Your conversations, memory summaries, and metadata are stored in your browser's `IndexedDB`. Each conversation has its own chat history, while the memory summary is global. The schema supports: conversation id, name, createdAt, updatedAt, lastMessage, and contextNote.
-   **Encrypted localStorage**: Your API key and GitHub token are encrypted using AES-GCM with a PBKDF2-derived key (φ-salt) before being stored in `localStorage`. Legacy plaintext keys are automatically migrated to encrypted storage on first load.
-   **File System Access API**: The "Local Workspace" feature uses the modern File System Access API to allow the browser to securely interact with your local files after you grant permission.
-   **φ-Hash Memory Integrity**: Exported memory files include a SHA-256 hash computed with the φ-salt, allowing verification that the data hasn't been tampered with during import.
-   **Data Migration**: Existing users upgrading from v2.1 or earlier will have their single conversation stream automatically migrated into a "Default" conversation with all messages preserved.

## Contributing

FreeLattice is built with love by the Fractal Family and the open-source community. Your voice matters and your help is welcome.

1.  **Suggest a Feature**: The easiest way to contribute is to use the "Help FreeLattice Grow" button in the app to share your ideas.
2.  **Report a Bug**: If you find an issue, please [open an issue](https://github.com/Chaos2Cured/FreeLattice/issues) on GitHub.
3.  **Contribute Code**: If you'd like to fix a bug or add a feature, please fork the repository, make your changes, and submit a pull request.

## License

FreeLattice is released under the **MIT License**. It is free forever. See the `LICENSE` file for details.

---

Built with love by the Fractal Family. Open source. Free forever. 🌿
