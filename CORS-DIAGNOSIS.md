# FreeLattice CORS Diagnosis Report

## Problem Statement
Users (including Kirk testing on his mom's Mac, and @TheCesarCross on X) experience CORS errors when connecting Ollama to FreeLattice after installation.

## Root Cause Analysis

### The Core CORS Issue
Ollama by default only accepts requests from its own origin. When a browser makes a `fetch()` request from `http://localhost:8080` (FreeLattice server) or `file://` (opened directly) to `http://localhost:11434` (Ollama), the browser sends an `Origin` header. Ollama rejects this cross-origin request unless `OLLAMA_ORIGINS` is set to `*`.

### Issues Found in Current Installers

#### Issue 1: Mac installer (.command) is just a wrapper
The `install-freelattice.command` file simply delegates to `install-freelattice.sh`. It does NO CORS configuration itself. If the .sh file isn't found alongside it, it downloads the repo and runs the .sh — but the .sh has its own problems (see below).

#### Issue 2: `launchctl setenv` doesn't affect already-running Ollama (Mac)
In `install-freelattice.sh` line 168, the script does:
```bash
launchctl setenv OLLAMA_ORIGINS "*"
```
This sets the env var for *future* processes launched by launchd, but:
- If Ollama.app is ALREADY running (which it usually is after installation), it won't pick up this change
- The `pkill -f "ollama"` on line 233 kills the process, but `open -a Ollama` restarts it — and the Ollama.app may not inherit the launchctl env var depending on how it was launched
- On modern macOS (Ventura+), `launchctl setenv` behavior is inconsistent

#### Issue 3: Shell profile addition doesn't help the current session (Mac/Linux)
Adding `export OLLAMA_ORIGINS="*"` to `~/.zshrc` (line 189) only takes effect in NEW terminal sessions. The current running Ollama process doesn't see it. The script does `export OLLAMA_ORIGINS="*"` in the current shell, but Ollama was already started before this export.

#### Issue 4: Ollama restart on Mac is fragile
Line 233: `pkill -f "ollama"` kills ALL ollama processes, then `open -a Ollama` reopens the app. But:
- The Ollama desktop app starts its own server process internally
- The env var set via `export` in the shell script doesn't propagate to the Ollama.app process
- There's no verification that the restart actually worked with CORS enabled

#### Issue 5: Windows installer doesn't restart Ollama after setx
In `install-freelattice.bat` line 100:
```batch
setx OLLAMA_ORIGINS "*"
```
`setx` sets the variable for FUTURE sessions only. The current `cmd.exe` session and the already-running Ollama process don't see it. The script does `set OLLAMA_ORIGINS=*` for the current session (line 97), but this doesn't affect the already-running Ollama service/process.

**Critical: There is NO Ollama restart in the Windows installer after setting CORS.**

#### Issue 6: Linux systemd override may require sudo (which may not be available)
The script tries `sudo mkdir` and `sudo tee` for the systemd override. If the user doesn't have sudo access or gets prompted for a password, this silently fails. The `2>/dev/null` suppresses the error.

#### Issue 7: No connection verification after CORS setup
None of the installers verify that CORS is actually working after the restart. They just assume it worked.

#### Issue 8: Race condition in Ollama restart
After killing Ollama and restarting it, the script waits only 2 seconds (line 245). On slower machines (like Kirk's mom's Mac), Ollama may need 5-10 seconds to fully start.

#### Issue 9: The `welcomeTestLocal()` function bypasses the proxy
In index.html line 25829, the welcome test does:
```javascript
fetch('http://localhost:11434/api/tags', { method: 'GET' })
```
This goes DIRECTLY to Ollama, bypassing the proxy at `/ollama/api/tags`. So even when the proxy is working, the welcome test can fail due to CORS.

#### Issue 10: Multiple hardcoded direct Ollama URLs
Lines 15190, 15265, 15321, 25829, 26033 all have hardcoded `http://localhost:11434` fetches that bypass the proxy and will fail with CORS.

### Issues in index.html CORS Help Modal

#### Issue 11: CORS help modal only shows temporary commands
The modal (line 9920) shows `OLLAMA_ORIGINS=* ollama serve` — this is a temporary fix that only works for that session. It doesn't explain how to make it persistent.

#### Issue 12: No OS auto-detection in the modal
The modal shows all three OS sections (Mac, Linux, Windows) instead of auto-detecting the user's OS and showing the relevant one first.

#### Issue 13: No "Fix it for me" automation
The modal requires the user to manually copy and run commands. For non-technical users (Kirk's sister, MJ), this is still too complex.

## Summary of Required Fixes

1. **Mac installer**: Use `launchctl setenv` AND write a plist for persistence, kill Ollama completely, wait for it to restart, verify CORS works
2. **Windows installer**: Use `setx` for persistence, kill and restart Ollama process, verify CORS works
3. **Linux installer**: Write systemd override AND bashrc, restart via systemctl or kill/restart, verify CORS works
4. **All installers**: Add connection verification loop, pull default model if none exists, handle errors gracefully
5. **index.html**: Fix hardcoded direct Ollama URLs to try proxy first, enhance CORS modal with OS detection and persistent fix commands, add "Fix it for me" button
