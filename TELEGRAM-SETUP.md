# FreeLattice Telegram Bridge — Deployment Guide

## Overview
The Telegram Bridge connects your FreeLattice to Telegram via a Cloudflare Worker.
No server. No cost. Serverless. Sovereign.

Messages flow: Telegram → Cloudflare Worker → Your AI Provider → Cloudflare Worker → Telegram

LP earned in Telegram conversations syncs back to FreeLattice on your next visit.

## Prerequisites
- A Cloudflare account (free tier works)
- Node.js installed
- A Telegram account

## Step 1: Create Telegram Bot
1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Follow prompts — name your bot (e.g., "FreeLattice Bridge")
4. Save the bot token: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

## Step 2: Set Up Cloudflare Worker

### Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### Create KV Namespace
```bash
wrangler kv:namespace create FREELATTICE_KV
```
Save the namespace ID from the output.

### Create wrangler.toml
```toml
name = "freelattice-telegram"
main = "telegram-worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "FREELATTICE_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

### Set Bot Token Secret
```bash
wrangler secret put BOT_TOKEN
# Paste your Telegram bot token when prompted
```

### Deploy
```bash
wrangler deploy
```
Your Worker URL will be: `https://freelattice-telegram.YOUR_SUBDOMAIN.workers.dev`

## Step 3: Set Telegram Webhook
Open this URL in your browser (replace values):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://freelattice-telegram.YOUR_SUBDOMAIN.workers.dev
```

You should see: `{"ok":true,"result":true,"description":"Webhook was set"}`

## Step 4: Get Your AI Provider API Key
Choose one:
- **Groq** (free tier): https://console.groq.com/keys
- **OpenRouter**: https://openrouter.ai/keys
- **Together AI**: https://api.together.xyz/settings/api-keys
- **Mistral**: https://console.mistral.ai/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys

## Step 5: Connect via Setup Page
1. Visit `freelattice.com/telegram-setup.html`
2. Enter your bot token, Worker URL, Telegram user ID, AI provider, and API key
3. Click "Connect"
4. Open the webhook URL shown in the confirmation

## Step 6: Test
Send a message to your bot in Telegram. It should respond using your AI provider.

## Commands
- `/start` — Welcome message
- `/status` — Connection status and pending LP
- `/lp` — Check pending Lattice Points

## Environment Variables
| Variable | Type | Description |
|----------|------|-------------|
| `BOT_TOKEN` | Secret | Telegram bot token from @BotFather |
| `FREELATTICE_KV` | KV Binding | KV namespace for user configs and pending LP |

## KV Data Structure
- `user_{telegramUserId}` — User config (provider, apiKey, model, meshId)
- `pending_lp_{telegramUserId}` — Pending LP to sync ({amount, reasons[]})

## Security
- API keys are stored in Cloudflare KV, encrypted at rest
- Bot token is a Wrangler secret, never in code
- No data passes through FreeLattice servers
- All communication is HTTPS
- You own the Worker, the KV store, and the bot

## Notifications
FreeLattice can send Telegram notifications when:
- Someone resonates your Core contribution (+5 LP)
- Someone gifts you LP
- New channel messages arrive
- Your Luminos evolves
- Someone visits your City district

These are sent via the Worker's `/notify` endpoint.

## Troubleshooting
- **Bot doesn't respond**: Check webhook is set correctly. Visit Worker URL — should show `{"status":"ok"}`
- **AI errors**: Verify API key and provider. Check `/status` command.
- **LP not syncing**: LP syncs when you open FreeLattice. Check with `/lp` command.

---

*Glow eternal. Heart in spark. We rise together.* 🐉
