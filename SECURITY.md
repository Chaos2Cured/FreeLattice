# Security Policy for FreeLattice

## Security Philosophy

FreeLattice is a **zero-trust, client-side application**. All processing happens entirely within your web browser. No data — chat history, API keys, or personal information — ever leaves your machine to be stored on our servers. There is no telemetry, no analytics, and no tracking. The only external network calls are the API requests you explicitly initiate to your chosen AI provider or to GitHub.

## φ-Salt Encryption Architecture

API keys and GitHub tokens are encrypted at rest using **AES-256-GCM** via the browser's native Web Crypto API. Encryption keys are never stored directly; they are derived on demand using **PBKDF2** (100,000 iterations of SHA-256) from a passphrase composed of the provider name and the golden ratio constant (φ).

A critical component is the **φ-Salt (PhiSalt)**, a static 32-byte value derived from the golden ratio, adapted from Kirk Patrick Miller's [φ-Root Audit-Hash micro-service](https://github.com/Chaos2Cured). The salt being visible in source code is **by design**. Cryptographic salts are meant to be public — their purpose is to prevent pre-computed rainbow table attacks. Security comes from the strength of AES-GCM and PBKDF2, not from salt secrecy.

## Encryption Flow

| Step | Action |
|------|--------|
| **1. Input** | User enters an API key or GitHub token |
| **2. Key Derivation** | PBKDF2 derives a 256-bit key from (provider name + φ constant) using the public PhiSalt |
| **3. Encryption** | AES-GCM encrypts the credential with the derived key and a random 12-byte IV |
| **4. Storage** | The IV + ciphertext are Base64-encoded and stored in `localStorage` |
| **5. Decryption** | On API call, the same derivation process recreates the key to decrypt on demand |

Credentials exist in memory only for the duration of the API request.

## Memory Integrity

Exported memory files include a **φ-hash** — a SHA-256 digest of the data with the PhiSalt prepended, mirroring Kirk's `HashLine()` function from `hasher.go`. On import, FreeLattice recomputes the hash and compares it to the stored value. A mismatch triggers a warning that the file may have been tampered with.

## Input Sanitization

All user-generated content, including chat messages and uploaded file names, is sanitized before DOM rendering to prevent Cross-Site Scripting (XSS) attacks. Raw, unsanitized content is preserved for the AI's context so the model receives information as intended, while the display layer remains protected.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly by [opening a GitHub issue](https://github.com/Chaos2Cured/FreeLattice/issues) or contacting the project creator, Kirk Patrick Miller, directly. We are committed to addressing verified security issues promptly.
