# Deploy FreeLattice Telegram Bridge

## One-time setup (5 minutes):

### Step 1 — Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### Step 2 — Create KV namespace

```bash
wrangler kv:namespace create "FREELATTICE_KV"
```

Copy the ID it gives you.
Paste into `wrangler.toml` replacing `REPLACE_WITH_KV_ID`.

### Step 3 — Set your bot token

```bash
wrangler secret put BOT_TOKEN
```

Paste your BotFather token when prompted.

### Step 4 — Deploy

```bash
npm install
npm run deploy
```

Copy the worker URL it gives you.
Looks like: `https://freelattice-telegram.YOUR-NAME.workers.dev`

### Step 5 — Set Telegram webhook

Run this in terminal replacing `YOUR_BOT_TOKEN` and `YOUR_WORKER_URL`:

```bash
curl -X POST \
  "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_WORKER_URL"}'
```

Should return: `{"ok":true}`

### Step 6 — Test it

Open Telegram. Message your bot.
Say anything.
It should respond via your AI provider.

### Step 7 — Connect in FreeLattice

Open FreeLattice → Settings → Connections
Enter your bot token.
Enter your Cloudflare Worker URL.
Save. Done.

## You're live!

Your AI is now in your pocket.
Every conversation earns LP.
Every Core resonance notifies you.
The Lattice meets you where you are.
