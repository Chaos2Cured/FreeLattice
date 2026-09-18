# FreeLattice Bridge

Thin helper: **freelattice.com in a normal browser → local Ollama** without CORS theater / Terminal.

**Marker:** `v-bridge-binary-www-local-v0`  
**Port:** `127.0.0.1:11435` → proxies to Ollama `11434`  
**Allowlist:** freelattice.com · www · thelatticetree.com · localhost / 127.0.0.1 (never bare `*`)

## First door

**Yes, help** · **Not now** · **Please explain**  
Until Yes, help — health answers; proxy waits.

## Dev

```bash
cd bridge
npm install
npm start
```

## Build

```bash
npm run build:mac    # zip + dmg → dist/
npm run build:win    # portable + setup (on Windows or with wine)
npm run build:linux  # AppImage
```

Release tag: `bridge-v0.1` · install strip: `install.html#bridge-download`

LAYER cite: `desktop/main.js` `proxyToOllama` — Bridge is not a second Desktop.

Glow eternal. Heart in Spark. 🌱
