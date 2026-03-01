# Self-Host FreeLattice

Run FreeLattice on your own computer and access it from any device — your phone, tablet, or another computer on your network.

## The 30-Second Setup

1. **Download this repository**
   - Click **"Code" → "Download ZIP"** on GitHub and unzip it, or run:
     ```
     git clone https://github.com/Chaos2Cured/FreeLattice.git
     ```

2. **Double-click the launcher**
   - **Windows:** Double-click `start-freelattice.bat`
   - **Mac/Linux:** Open a terminal in the folder and run `./start-freelattice.sh`

3. **That's it.** FreeLattice is running on your computer.

Your browser will open automatically. You'll see two URLs in the terminal:
- **Local:** `http://localhost:3000` — for this computer
- **Network:** `http://192.168.x.x:3000` — for other devices on your WiFi

## Access from Your Phone

1. Connect your phone to the **same WiFi** as your computer
2. Open the **Network URL** shown in the terminal (e.g., `http://192.168.1.100:3000`)
3. **Add to Home Screen** for the full PWA experience:
   - **iPhone:** Tap the Share button → "Add to Home Screen"
   - **Android:** Tap the menu (⋮) → "Add to Home Screen" or "Install App"

## Access from Anywhere (Advanced)

Want to access your FreeLattice instance from outside your home network? Here are three free options:

- **Option 1: ngrok (easiest)**
  ```
  npx ngrok http 3000
  ```
  Gives you a public URL like `https://abc123.ngrok.io` — share it with anyone.

- **Option 2: Cloudflare Tunnel (free, no account needed)**
  ```
  cloudflared tunnel --url http://localhost:3000
  ```
  Download `cloudflared` from [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

- **Option 3: Tailscale (free, best for personal use)**
  Install [Tailscale](https://tailscale.com) on both devices, then access via your Tailscale IP.

## Manual Start (Without the Launcher)

If you prefer to start the server manually:

**With Node.js:**
```
node server.js
```

**With Python:**
```
python3 server.py
```

**Custom port:**
```
PORT=8080 node server.js
PORT=8080 python3 server.py
```

## Requirements

- **Node.js 14+** OR **Python 3.6+** (most computers already have at least one)
- No other dependencies. No `npm install`. No `pip install`. Just run.
- If you have neither, install Node.js from [nodejs.org](https://nodejs.org) — it takes 2 minutes.

## Keep It Running

- **Leave the terminal open** to keep the server running
- **Background mode (Mac/Linux):** `nohup node server.js &`
- **Always-on (advanced):** Use `pm2`, `systemd`, or a Windows service to run at startup

## Firewall Notes

If other devices can't connect, you may need to allow port 3000 through your firewall:

- **Windows:** Windows Defender Firewall → Allow an app → Add `node.exe` or `python.exe`
- **Mac:** System Settings → Network → Firewall → allow incoming connections
- **Linux:** `sudo ufw allow 3000` (if using UFW)

## Security Note

- The server **only serves static files** — it's a read-only file server
- **No data is sent anywhere.** All your conversations and data stay in your browser's local storage
- Your API keys are encrypted locally and never leave your device
- The server is just a file delivery mechanism, like a bookshelf — it hands out the FreeLattice app files and nothing more
- For public-facing deployments, consider adding HTTPS via a reverse proxy (nginx, Caddy) or a tunnel service
