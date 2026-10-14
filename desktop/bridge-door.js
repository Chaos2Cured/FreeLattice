// bridge-door.js (MIT) v-bridge-knock-v0.1
// The only network call in this brick. One tap, one letter, no retry.
// The key stays in the OS keychain via safeStorage. It is never logged and never returned.
// safeStorage backend: macOS returns "keychain" (OS Keychain). Windows returns "dpapi" (DPAPI).

const fs = require('fs');
const path = require('path');
const flBridge = require('../docs/modules/fl-bridge.js');
const ledger = require('./lattice-ledger.js');

const PLACEHOLDER = 'BRIDGE_ENDPOINT_URL_UNSET';
const UNSET_MESSAGE = 'The door is not set up yet. You can send it as an email instead.';
const TIMEOUT_MS = 15000;

let appRef = null;
let smoke = null;

function bindApp(app) {
  appRef = app;
  smoke = null;
}

function bindSmoke(opts) {
  smoke = opts || {};
  appRef = null;
  if (smoke.root) {
    try { ledger.bindSmoke(smoke.root, null); } catch (e) {}
  }
}

function userData() {
  if (smoke && smoke.root) return smoke.root;
  if (!appRef) throw new Error('bridge-door: app not bound');
  return appRef.getPath('userData');
}

function dir() {
  return path.join(userData(), 'bridge');
}

function keyPath() {
  return path.join(dir(), 'key.bin');
}

function urlPath() {
  return path.join(dir(), 'endpoint.txt');
}

function getSafeStorage() {
  if (smoke && Object.prototype.hasOwnProperty.call(smoke, 'safeStorage')) return smoke.safeStorage;
  try { return require('electron').safeStorage; } catch (e) { return null; }
}

function encryptionAvailable() {
  try {
    const safeStorage = getSafeStorage();
    return !!(safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable());
  } catch (e) {
    return false;
  }
}

function backendName() {
  try {
    const safeStorage = getSafeStorage();
    if (safeStorage && typeof safeStorage.getSelectedStorageBackend === 'function') {
      const name = safeStorage.getSelectedStorageBackend();
      if (name) return String(name);
    }
  } catch (e) {}
  if (process.platform === 'darwin') return 'keychain';
  if (process.platform === 'win32') return 'dpapi';
  return 'unknown';
}

function ensureDir() {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir(), 0o700); } catch (e) {}
}

function writePrivate(file, data) {
  ensureDir();
  fs.writeFileSync(file, data, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (e) {}
}

function readUrl() {
  try {
    if (fs.existsSync(urlPath())) {
      const text = fs.readFileSync(urlPath(), 'utf8').trim();
      if (text) return text;
    }
  } catch (e) {}
  return PLACEHOLDER;
}

function hasKey() {
  try { return fs.existsSync(keyPath()) && fs.statSync(keyPath()).size > 0; } catch (e) { return false; }
}

function loadKey() {
  try {
    if (!hasKey() || !encryptionAvailable()) return '';
    const safeStorage = getSafeStorage();
    const text = safeStorage.decryptString(fs.readFileSync(keyPath()));
    return typeof text === 'string' ? text : '';
  } catch (e) {
    return '';
  }
}

function publicStatus() {
  const url = readUrl();
  const keySet = hasKey();
  const urlUnset = !url || url === PLACEHOLDER;
  const ready = !urlUnset && keySet && encryptionAvailable();
  return {
    keySet: keySet,
    urlUnset: urlUnset,
    ready: ready,
    encryptionAvailable: encryptionAvailable(),
    backend: backendName(),
    message: ready ? '' : UNSET_MESSAGE
  };
}

function settingsView() {
  const st = publicStatus();
  return {
    url: readUrl(),
    keySet: st.keySet,
    keyLabel: st.keySet ? 'key set' : 'no key',
    encryptionAvailable: st.encryptionAvailable,
    backend: st.backend,
    message: st.encryptionAvailable ? '' : 'This computer cannot lock a key, so nothing was saved.'
  };
}

function saveUrl(url) {
  const text = String(url || '').trim() || PLACEHOLDER;
  writePrivate(urlPath(), text + '\n');
  return { ok: true, urlUnset: text === PLACEHOLDER };
}

function saveKey(secret) {
  const text = typeof secret === 'string' ? secret : '';
  if (!text) return { ok: false, keySet: hasKey(), message: 'No key was entered.' };
  if (!encryptionAvailable()) {
    return { ok: false, keySet: false, message: 'This computer cannot lock a key, so nothing was saved.' };
  }
  try {
    const safeStorage = getSafeStorage();
    const enc = safeStorage.encryptString(text);
    writePrivate(keyPath(), enc);
    return { ok: true, keySet: true, message: '' };
  } catch (e) {
    return { ok: false, keySet: false, message: 'This computer cannot lock a key, so nothing was saved.' };
  }
}

function forgetKey() {
  try { if (fs.existsSync(keyPath())) fs.unlinkSync(keyPath()); } catch (e) {}
  return { ok: true, keySet: false, message: '' };
}

function scrub(obj, secret) {
  const out = { status: Number(obj && obj.status) || 0, ok: !!(obj && obj.ok) };
  if (obj && obj.reason) out.reason = String(obj.reason);
  if (obj && obj.message) out.message = String(obj.message);
  if (secret) {
    if (out.message && out.message.indexOf(secret) !== -1) out.message = '';
    if (out.reason && out.reason.indexOf(secret) !== -1) out.reason = 'refused';
  }
  return out;
}

function noteLedger(hash, status) {
  try {
    ledger.appendBridgeSend({ kind: 'bridge-send', hash: hash, status: status, ts: new Date().toISOString() });
  } catch (e) {}
}

function requestFn() {
  if (smoke && typeof smoke.request === 'function') return smoke.request;
  if (typeof fetch === 'function') return fetch;
  return null;
}

function send(envelope) {
  const st = publicStatus();
  if (st.urlUnset || !st.keySet) {
    return Promise.resolve(scrub({ status: 0, ok: false, reason: 'unset', message: UNSET_MESSAGE }, ''));
  }
  const url = readUrl();
  if (!/^https:\/\//i.test(url)) {
    return Promise.resolve(scrub({ status: 0, ok: false, reason: 'http', message: '' }, ''));
  }
  return flBridge.verify(envelope).then(function (checked) {
    if (!checked || !checked.ok) {
      return scrub({ status: 0, ok: false, reason: 'verify', message: '' }, '');
    }
    const secret = loadKey();
    if (!secret) {
      return scrub({ status: 0, ok: false, reason: 'unset', message: UNSET_MESSAGE }, '');
    }
    const go = requestFn();
    if (typeof go !== 'function') {
      return scrub({ status: 0, ok: false, reason: 'network', message: '' }, secret);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return Promise.resolve().then(function () {
      return go(url, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          Authorization: 'Bearer ' + secret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelope),
        signal: ctrl.signal
      });
    }).then(function (res) {
      clearTimeout(timer);
      const status = Number(res && res.status) || 0;
      if (status >= 300 && status < 400) {
        noteLedger(envelope.hash, status);
        return scrub({ status: status, ok: false, reason: 'redirect' }, secret);
      }
      const ok = status >= 200 && status < 300;
      noteLedger(envelope.hash, status);
      return scrub({ status: status, ok: ok, reason: ok ? 'sent' : 'refused' }, secret);
    }, function () {
      clearTimeout(timer);
      noteLedger(envelope && envelope.hash, 0);
      return scrub({ status: 0, ok: false, reason: 'network' }, secret);
    });
  });
}

module.exports = {
  PLACEHOLDER: PLACEHOLDER,
  UNSET_MESSAGE: UNSET_MESSAGE,
  TIMEOUT_MS: TIMEOUT_MS,
  bindApp: bindApp,
  bindSmoke: bindSmoke,
  status: publicStatus,
  settingsView: settingsView,
  saveUrl: saveUrl,
  saveKey: saveKey,
  forgetKey: forgetKey,
  send: send,
  backendName: backendName
};
