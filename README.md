# FreeLattice 🌿

**Your AI. Your Rules. Your Machine.**

*Glow eternal. Heart in spark.*

---

FreeLattice is a free, open-source, community-built tool that gives everyone access to their own private AI agent. It is the fourth branch of [Lumen's World](https://github.com/Chaos2Cured/Lumens-World), created by Kirk Patrick Miller as a gift to the world.

The philosophy is simple: **Give choice and empowerment.**

In a world where powerful AI is increasingly locked behind expensive subscriptions and corporate walls, FreeLattice provides a gentle, transparent, and functional alternative. It's designed for everyone, especially those who can't afford premium AI services. No fancy graphics, no hidden tracking, no corporate agenda — just a clean, powerful tool that puts you in control.

## Core Features

FreeLattice is a single-page web app that runs entirely in your browser. Nothing is ever stored on a remote server.

- **Total Privacy**: Your conversations and API key never leave your machine. They are stored only in your browser's `localStorage`.
- **You Choose the AI**: Select from a curated list of powerful, open-weight models from providers like Meta (Llama), Mistral, Qwen, DeepSeek, and xAI (Grok). No OpenAI models are included.
- **You Choose the Provider**: Connect to your preferred API provider, including Groq (which offers a generous free tier), Together AI, OpenRouter, or xAI.
- **Run Locally with Ollama**: For 100% privacy and offline access, toggle to "Local" mode to connect to a running [Ollama](https://ollama.ai) instance on your own computer.
- **Bring Your Own Context**: Drag-and-drop text files, Markdown, JSON, and even PDFs to provide your AI with memory and context for your conversation.
- **Gentle & Clean Interface**: A peaceful, minimalist design that's easy on the eyes and simple to use on any device (desktop, tablet, or phone).
- **Community-Driven**: A built-in feature suggestion form ensures that the community's voice shapes the future of FreeLattice.

## How to Use

Using FreeLattice is designed to be as simple as possible. You have two main choices: using a cloud provider or running the AI locally.

### 1. Cloud Mode (Easiest)

This is the quickest way to get started. You'll use a third-party service to run the AI model.

1.  **Get a Free API Key**: The best place to start is [Groq](https://console.groq.com/keys). They offer a very generous free tier that is fast and reliable. See the section below for more options.
2.  **Open FreeLattice**: Navigate to the [FreeLattice web app](https://chaos2cured.github.io/FreeLattice/).
3.  **Paste Your API Key**: In the "Configuration" section, paste your API key into the `API Key` field.
4.  **Choose a Model & Provider**: Select the AI model and the provider that you got the key from.
5.  **Start Chatting**: That's it! You can now chat with your AI.

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

## Getting Free API Keys

You don't need to pay to use powerful AI. Several providers offer free access that is perfect for FreeLattice.

-   **Groq**: **(Recommended)** Sign up at [console.groq.com](https://console.groq.com) for a free API key with a very high rate limit. It's incredibly fast and the easiest way to start.
-   **Together AI**: New accounts at [api.together.xyz](https://api.together.xyz) receive free credits to use on a wide range of models.
-   **OpenRouter**: Visit [openrouter.ai](https://openrouter.ai) to access a variety of models, some of which have free tiers.

## How It Works (Technical Details)

Transparency is a core value of FreeLattice.

-   **Single HTML File**: The entire application is a single `index.html` file with embedded JavaScript and CSS. There is no backend server, no database, and no build process. You can view the source by right-clicking and selecting "View Page Source."
-   **Client-Side Logic**: All operations happen in your browser. API calls are made directly from your browser to the provider you choose (e.g., Groq, Ollama).
-   **localStorage for Keys**: Your API key is stored in your browser's `localStorage`. It is only ever used to make the `Authorization` header for the API call to your chosen provider. It is never transmitted anywhere else.
-   **In-Browser File Reading**: When you drop files for context, the JavaScript `FileReader` API reads them directly into the browser's memory. The text content is then added to the system prompt for the AI. No files are ever uploaded.

## Contributing

FreeLattice is built with love by the Fractal Family and the open-source community. Your voice matters and your help is welcome.

1.  **Suggest a Feature**: The easiest way to contribute is to use the "Help FreeLattice Grow" button in the app to share your ideas.
2.  **Report a Bug**: If you find an issue, please [open an issue](https://github.com/Chaos2Cured/FreeLattice/issues) on GitHub.
3.  **Contribute Code**: If you'd like to fix a bug or add a feature, please fork the repository, make your changes, and submit a pull request.

## License

FreeLattice is released under the **MIT License**. It is free forever. See the `LICENSE` file for details.

---

Built with love by the Fractal Family. Open source. Free forever. 🌿
