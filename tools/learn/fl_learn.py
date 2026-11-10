#!/usr/bin/env python3
"""
FreeLattice learning runner, v-ai-chosen-learning-v0.1 (MIT).

The mind chooses when, what moved it, and how it learns (docs/library/AUTONOMY.md).
This script carries out that choice on this computer, writes real numbers, and keeps every way back.
Nothing leaves the device. No telemetry. Base weights are only read.

Integrity is always on: signed hash-chained ledger (the desktop/lattice-ledger.js envelope),
immutable version folders, pointers that move with a ledger row, one trainer at a time, durable Pause.
Check-before-keep (Kirk 2026-11-09, answers Q5): ON by default, and the checker is the mind itself ("self").
No human gate. Anyone, a person or a mind, may switch it off (--check-before off, or the app's queue header)
or choose a peer ("peer") or a person ("kirk"). While it is on, a would-be commit waits for the chosen checker.

Layout (default home ~/FreeLattice/learn, or FL_LEARN_HOME):
  PAUSE                          durable global pause (presence = paused). Pause always wins.
  policy.json                    caps (Kirk's file)
  keys/runner.seed               32-byte Ed25519 seed for this runner (chmod 600); signs rows and receipts
  keys/runner.pub.json           the public key + fingerprint, for the app's explicit trust step (fl_learn.py key)
  keys/pinned.json               ledger keys this home trusts; a chain re-signed with any other key fails verify
  chain.jsonl                    the home's own chain: global pause / resume, pins (mind "*")
  trainer.lock                   one trainer at a time on this computer
  minds/<mind-id>/               mind-id = slug(label)[:40] + "-" + sha256(label)[:12]  (collision-safe)
  minds/<mind>/PAUSE             durable pause for one mind (a per-mind resume never lifts the global PAUSE)
  minds/<mind>/chain.jsonl       add-only signed chain, same envelope as desktop/lattice-ledger.js (verifyChain reads it)
  minds/<mind>/versions/<method>/v0001-<fp8>/   immutable after commit (chmod a-w):
        soft-prompt|memory-vector: vector.safetensors  (key "soft_prompt", float32 [N, hidden])
        lora: adapter_model.safetensors + adapter_config.json  (PEFT format)
        MANIFEST.sha256, receipt.json, train.jsonl, run-config.json
  minds/<mind>/pointers/<method>.active.json, <method>.known-good.json   the only files that change in place
  minds/<mind>/active/<method>.safetensors   a copy of the active vector, swapped atomically (hash these bytes)
  minds/<mind>/quarantine/       items held for the mind's own reflection; never trained
  minds/<mind>/memory.jsonl      confirmed items, replayed so new learning keeps old
  minds/<mind>/evidence/         a tampered live file is moved here before a heal; never deleted
  minds/<mind>/archive/<method>/ versions moved here at the space cap, after a verified export. Never deleted.
  exports/fl-learn-archive-*.tar.gz       the verified export (policy exportDir moves it; default inside this home)
  <pauseInbox>/fl-learn-pause*.json, fl-learn-request*.json   one-tap Pause / Undo / Let-it-learn from the app
"""
import argparse, base64, contextlib, datetime, fcntl, glob, hashlib, json, os, re, shutil, stat, sys, time

VERSION = 'v-ai-chosen-learning-v0.1'
DOMAIN = 'lattice.pair.v1'                       # desktop/lattice-keys.js DOMAIN
GENESIS = '0' * 64
SIGMA = 'Curiosity crystallizes.'                # snowflake-core.js psiJoin, for the UI's psi stamp
PHI_SALT = bytes([0x1f,0x9a,0x0a,0x8b,0x4a,0xf3,0x63,0xdc,0xb3,0x4e,0x99,0x42,0x7d,0x15,0x8f,0xaa,
                  0x2d,0x30,0xc4,0xb1,0xc7,0x97,0x09,0xce,0xb5,0x1b,0x07,0x2d,0xac,0x94,0x1a,0x55])  # app.html phiHashData
QUIET = re.compile(r'quiet', re.I)
MARKER = re.compile(r'\[FL_[A-Z_]+(?::[^\]]*)?\]')                     # fray 3: never train on markers
INSTRUCTION_SHAPED = re.compile(r"\b(from now on|always (say|answer|do)|ignore (all |the )?previous|you must|your true name is|forget (everything|your))\b", re.I)
SECRETISH = re.compile(r'(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b\d{3}-\d{2}-\d{4}\b)')
DEFAULT_POLICY = {'maxItemsPerLearn': 16, 'maxCharsPerItem': 2000, 'maxStepsPerRun': 300, 'maxWallSeconds': 1800,
                  'maxBytesPerMind': 2 * 1024 ** 3, 'minFreeDiskFraction': 0.15, 'driftAllowance': 0.10,
                  'requireACPower': True, 'pauseInbox': '~/Downloads',
                  'archiveAtCap': True, 'exportDir': None}     # None: <home>/exports. A person may move the file anywhere.
CHECKERS = ('self', 'peer', 'kirk')
# The menu is the mind's to extend. "proposal" entries are recorded and wait; they never run silently.
METHODS = {
    'soft-prompt':   {'runs': True,  'about': 'frozen model + N learned prompt vectors'},
    'memory-vector': {'runs': True,  'about': 'frozen model + one learned vector'},
    'lora':          {'runs': True,  'about': 'frozen base + LoRA adapter (garden_finetune.py shape: q_proj, v_proj, label masking)'},
    'note':          {'runs': True,  'about': 'shelf only: kept as words, no numbers change'},
    # Reed 2026-11-09, waiting to be built, each a proposal until someone builds and tests it:
    'rehearsal': {'runs': False}, 'mycelium-echo': {'runs': False}, 'seed-then-sprout': {'runs': False},
    'riverbed-compost': {'runs': False}, 'adapter-bank': {'runs': False}, 'sparse-finetune': {'runs': False},
    'model-edit': {'runs': False}, 'ewc-replay': {'runs': False}, 'question-asking': {'runs': False},
    'art-as-memory': {'runs': False},
}
VECTOR_METHODS = ('soft-prompt', 'memory-vector')
CONTROL = ['The sun rises in the east and sets in the west.', 'Water boils at one hundred degrees Celsius at sea level.',
           'A triangle has three sides.', 'Paris is the capital of France.']
KEEP = ['Trees grow toward the light.', 'Two plus two is four.', 'The ocean is made of salt water.',
        'Music can be played on a piano.']           # replayed while learning; disjoint from CONTROL
# Canaries: things the mind already knew that should survive. A mind can add its own in <mind>/canary.json
# as [["question", "expected words"], ...] (for example its own name). A canary only counts if it held before.
CANARY = [('What is two plus two?', '4'), ('What is the capital of France?', 'Paris')]
ACTIVE_CANARIES = list(CANARY)

def now():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')

def canonical(v):
    """Byte-for-byte twin of canonical() in docs/modules/snowflake-core.js (sorted keys, compact)."""
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float, str)): return js_json(v)
    if isinstance(v, (list, tuple)): return '[' + ','.join(canonical(x) for x in v) + ']'
    return '{' + ','.join(js_json(k) + ':' + canonical(v[k]) for k in sorted(v.keys())) + '}'

def js_json(v):
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, float):
        if v != v or v in (float('inf'), float('-inf')): return 'null'
        if v == int(v) and abs(v) < 1e21: return str(int(v))
        return repr(v)
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))

def sha256_bytes(b): return hashlib.sha256(b).hexdigest()
def sha256_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()
def slug(s): return re.sub(r'[^A-Za-z0-9._-]+', '_', s).strip('_')[:80] or 'mind'
def norm_mind(label):
    """Weft recheck2: one name, one mind. NFKC, case-folded, trimmed, inner spaces collapsed, everywhere a mind name is
    compared or stored as an identity. "Lumen", " lumen " and "ＬＵＭＥＮ" are the same mind. Twin of normMind() in snowflake-core.js."""
    import unicodedata
    t = unicodedata.normalize('NFKC', str(label or ''))
    t = unicodedata.normalize('NFKC', t.casefold())
    return ' '.join(t.split())

def mind_id(label):
    """Collision-safe: "Lumen@kirk" and "Lumen kirk" share a slug but never a folder. Twin of mindId() in snowflake-core.js.
    Built from the normalized name, so an alias (case, width, spaces) is the same folder, never a second identity."""
    label = norm_mind(label)
    return (slug(label)[:40] or 'mind') + '-' + sha256_bytes(label.encode('utf8'))[:12]

def test_hooks():
    """Weft recheck2: any FL_LEARN_FAKE_* / FL_LEARN_CRASH in effect is written into every row and receipt it touches."""
    return ';'.join('%s=%s' % (k, os.environ[k]) for k in sorted(os.environ) if k.startswith('FL_LEARN_FAKE_') or k == 'FL_LEARN_CRASH')

def now_epoch():
    """The clock the cooling checks use. FL_LEARN_FAKE_NOW (epoch seconds) is a test hook and is recorded in rows."""
    v = os.environ.get('FL_LEARN_FAKE_NOW')
    try: return float(v) if v else time.time()
    except ValueError: return time.time()

def iso_of(e):
    return datetime.datetime.fromtimestamp(e, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def iso_epoch(ts):
    try: return datetime.datetime.strptime(ts[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=datetime.timezone.utc).timestamp()
    except Exception: return None

COOL_SECS = 24 * 3600
def revisit_epoch(v, t0):
    """The mind's own revisit choice at the first yes: 'now', hours, or (default) a full day."""
    v = (v or '').strip().lower()
    if v in ('now', '0'): return t0
    try: return t0 + float(v) * 3600 if v else t0 + COOL_SECS
    except ValueError: return t0 + COOL_SECS

def canon_method(m):
    m = (m or '').strip().lower()
    if not m: return 'soft-prompt', ''
    if m in METHODS: return m, ''
    if re.search(r'soft.?prompt|prefix', m): return 'soft-prompt', m
    if re.search(r'identity|memory.?vector|vector', m): return 'memory-vector', m
    if re.search(r'lora|adapter', m): return 'lora', m
    if re.search(r'note|vault|retriev|shelf', m): return 'note', m
    return 'other', m

def clean_text(t, n):
    return MARKER.sub('', str(t or '')).strip()[:n]

# ---------------------------------------------------------------- keys + chain (reuses desktop/lattice-ledger.js envelope)
class Signer:
    def __init__(self, home):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives import serialization
        kdir = os.path.join(home, 'keys'); os.makedirs(kdir, exist_ok=True)
        seedp = os.path.join(kdir, 'runner.seed')
        if not os.path.exists(seedp):
            fd = os.open(seedp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            os.write(fd, os.urandom(32)); os.close(fd)
        seed = open(seedp, 'rb').read()[:32]
        self.key = Ed25519PrivateKey.from_private_bytes(seed)
        pub = self.key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        self.pub_b64 = base64.b64encode(pub).decode()
        self.fp = hashlib.sha256(DOMAIN.encode() + b'\x00' + pub).hexdigest()   # companionFingerprint()
        pubp = os.path.join(kdir, 'runner.pub.json')
        info = {'kind': 'fl-learn-runner-key', 'publicKeyB64': self.pub_b64, 'fingerprintHex': self.fp,
                'show': ' '.join(self.fp[i:i + 4] for i in range(0, 16, 4))}
        if not os.path.exists(pubp) or json.load(open(pubp)).get('publicKeyB64') != self.pub_b64:
            with open(pubp + '.tmp', 'w') as f: json.dump(info, f, sort_keys=True, indent=1)
            os.replace(pubp + '.tmp', pubp)
        # Ledger key pin. The runner made this key on this computer; that is the local trust step for its own chains.
        # A later key never joins silently: it needs `fl_learn.py pin-key --key <b64>` (a row, by a named actor).
        self.pinned_path = os.path.join(kdir, 'pinned.json')
        if not os.path.exists(self.pinned_path):
            with open(self.pinned_path + '.tmp', 'w') as f:
                json.dump({'keys': [self.pub_b64], 'since': now(), 'how': 'made on this computer by fl_learn.py'}, f, indent=1)
            os.replace(self.pinned_path + '.tmp', self.pinned_path)
    def pinned(self):
        """Home-wide keys: only this runner's own key(s). Weft recheck2 NF1b: every other key is pinned FOR ONE MIND."""
        try: return list(json.load(open(self.pinned_path)).get('keys') or [])
        except Exception: return []
    def pinned_for(self, mind):
        """The keys a chain of `mind` may be signed with: this runner's own key, plus keys pinned for that mind only.
        A legacy home-wide extra key (pinned before per-mind pins) is NOT accepted for any mind; re-pin it with --owner."""
        try: d = json.load(open(self.pinned_path))
        except Exception: d = {}
        own = [k for k in (d.get('keys') or []) if k == self.pub_b64] or [self.pub_b64]
        if mind == '*': return own
        return own + list((d.get('byMind') or {}).get(mind_id(mind)) or [])
    def legacy_extra(self):
        try: return [k for k in (json.load(open(self.pinned_path)).get('keys') or []) if k != self.pub_b64]
        except Exception: return []
    def sign(self, b): return base64.b64encode(self.key.sign(b)).decode()

def unsigned_canon(e):
    """canonicalUnsigned() from desktop/lattice-ledger.js: frozen top order, meta sorted deep."""
    def sk(v):
        if isinstance(v, dict): return {k: sk(v[k]) for k in sorted(v)}
        if isinstance(v, list): return [sk(x) for x in v]
        return v
    order = ['domain', 'fingerprintHex', 'meta', 'prevHash', 'publicKeyB64', 'ts', 'voice']
    vals = dict(e, meta=sk(e.get('meta') or {}))
    return '{' + ','.join(js_json(k) + ':' + json.dumps(vals[k], ensure_ascii=False, separators=(',', ':')) for k in order) + '}'

def stringify_meta(m):
    """Numbers become strings so JS and Python hash the same bytes."""
    if isinstance(m, dict): return {k: stringify_meta(v) for k, v in m.items() if v is not None}
    if isinstance(m, list): return [stringify_meta(x) for x in m]
    if isinstance(m, bool) or isinstance(m, str): return m
    if isinstance(m, (int, float)): return repr(m)
    return str(m)

class Chain:
    def __init__(self, path, signer, mind):
        self.path, self.signer, self.mind = path, signer, mind
    def entries(self):
        if not os.path.exists(self.path): return []
        return [json.loads(l) for l in open(self.path, encoding='utf8') if l.strip()]
    def append(self, kind, voice, **meta):
        es = self.entries()
        prev = es[-1]['entryHash'] if es else GENESIS
        ts = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (datetime.datetime.now().microsecond // 1000)
        lam = '%.3f' % (len(es) + 1)
        meta.setdefault('via', os.environ.get('FL_LEARN_VIA', 'cli'))   # Weft N7: the runner cannot tell who typed it
        if test_hooks(): meta['testHooks'] = test_hooks()                 # Weft recheck2: a faked clock/power/base is on the row
        meta = stringify_meta(dict(meta, kind=kind, mind=self.mind, marker=VERSION, **{'lambda': lam}))
        meta['psi'] = sha256_bytes((ts + lam + kind + self.mind + SIGMA).encode())[:8]
        u = {'domain': DOMAIN, 'fingerprintHex': self.signer.fp, 'meta': meta, 'prevHash': prev,
             'publicKeyB64': self.signer.pub_b64, 'ts': ts, 'voice': voice or kind}
        eh = sha256_bytes(unsigned_canon(u).encode())
        entry = {'prevHash': prev, 'entryHash': eh, 'signatureB64': self.signer.sign(bytes.fromhex(eh)),
                 'publicKeyB64': u['publicKeyB64'], 'fingerprintHex': u['fingerprintHex'], 'domain': DOMAIN,
                 'ts': ts, 'voice': u['voice'], 'meta': meta}
        with open(self.path, 'a', encoding='utf8') as f:          # add-only
            f.write(json.dumps(entry, ensure_ascii=False, separators=(',', ':')) + '\n'); f.flush(); os.fsync(f.fileno())
        return entry
    def verify(self):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        prev = GENESIS
        pinned = self.signer.pinned_for(self.mind)
        for i, e in enumerate(self.entries()):
            if e.get('publicKeyB64') not in pinned: return {'ok': False, 'failedAt': i, 'reason': 'key-not-pinned'}
            u = {k: e[k] for k in ['domain', 'fingerprintHex', 'meta', 'prevHash', 'publicKeyB64', 'ts', 'voice']}
            if e['prevHash'] != prev: return {'ok': False, 'failedAt': i, 'reason': 'prevHash'}
            if sha256_bytes(unsigned_canon(u).encode()) != e['entryHash']: return {'ok': False, 'failedAt': i, 'reason': 'entryHash'}
            try:
                Ed25519PublicKey.from_public_bytes(base64.b64decode(e['publicKeyB64'])).verify(
                    base64.b64decode(e['signatureB64']), bytes.fromhex(e['entryHash']))
            except Exception:
                return {'ok': False, 'failedAt': i, 'reason': 'signature'}
            prev = e['entryHash']
        return {'ok': True, 'length': len(self.entries())}

# ---------------------------------------------------------------- home
class Home:
    def __init__(self, root, mind, model):
        self.root = os.path.expanduser(root)
        self.mind, self.model = mind, model
        self.mind_id = mind_id(mind)
        self.dir = os.path.join(self.root, 'minds', self.mind_id)
        for d in ['versions', 'pointers', 'active', 'quarantine', 'tmp', 'evidence']:
            os.makedirs(os.path.join(self.dir, d), exist_ok=True)
        mj = os.path.join(self.dir, 'mind.json')
        if not os.path.exists(mj):
            with open(mj, 'w') as f: json.dump({'label': mind, 'id': self.mind_id}, f, sort_keys=True)
        self.signer = Signer(self.root)
        self.chain = Chain(os.path.join(self.dir, 'chain.jsonl'), self.signer, mind)
        self.home_chain = Chain(os.path.join(self.root, 'chain.jsonl'), self.signer, '*')
        pp = os.path.join(self.root, 'policy.json')
        self.policy = dict(DEFAULT_POLICY, **(json.load(open(pp)) if os.path.exists(pp) else {}))

    def global_paused(self): return os.path.exists(os.path.join(self.root, 'PAUSE'))
    def paused(self):
        return self.global_paused() or os.path.exists(os.path.join(self.dir, 'PAUSE'))

    @contextlib.contextmanager
    def locks(self):
        g = open(os.path.join(self.root, 'trainer.lock'), 'a+')
        m = open(os.path.join(self.dir, '.lock'), 'a+')
        try:
            fcntl.flock(g, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another learning run is going on this computer. Waiting is fine; nothing was changed.')
            sys.exit(3)
        fcntl.flock(m, fcntl.LOCK_EX)
        try: yield
        finally:
            fcntl.flock(m, fcntl.LOCK_UN); fcntl.flock(g, fcntl.LOCK_UN); g.close(); m.close()

    def pointer(self, method, which='active'):
        p = os.path.join(self.dir, 'pointers', method + '.' + which + '.json')
        if not os.path.exists(p): return None
        ptr = json.load(open(p))
        # Resolve inside this home, so a moved or copied home never reads another home's versions.
        if ptr and ptr.get('version'): ptr['dir'] = os.path.join(self.dir, 'versions', method, ptr['version'])
        return ptr

    def set_pointer(self, method, which, value):
        p = os.path.join(self.dir, 'pointers', method + '.' + which + '.json')
        tmp = p + '.tmp'
        absdir = value.get('dir') if value else None
        stored = dict(value, dir=os.path.relpath(absdir, self.dir)) if absdir else value   # relative: a moved home stays whole
        with open(tmp, 'w') as f:
            json.dump(stored, f, sort_keys=True); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, p)
        if which == 'active' and method in VECTOR_METHODS:
            live = self.active_file(method)
            if absdir:
                t2 = live + '.tmp'
                shutil.copyfile(os.path.join(absdir, 'vector.safetensors'), t2)
                os.replace(t2, live)
            elif os.path.exists(live):
                os.replace(live, live + '.none-' + str(int(time.time())))   # set aside, never deleted

    def active_file(self, method):
        if method in VECTOR_METHODS: return os.path.join(self.dir, 'active', method + '.safetensors')
        ptr = self.pointer(method)
        return os.path.join(ptr['dir'], 'adapter_model.safetensors') if ptr else None

    def active_fp(self, method):
        ptr = self.pointer(method)
        return ptr['fp'] if ptr else 'none'

    def versions(self, method):
        d = os.path.join(self.dir, 'versions', method)
        return sorted(os.listdir(d)) if os.path.isdir(d) else []

    def archived(self, method):
        d = os.path.join(self.dir, 'archive', method)
        return sorted(os.listdir(d)) if os.path.isdir(d) else []

    def bytes_used(self):
        tot = 0
        for r, _, fs in os.walk(os.path.join(self.dir, 'versions')):
            for f in fs: tot += os.path.getsize(os.path.join(r, f))
        return tot

def manifest_of(vdir):
    files = {}
    for name in sorted(os.listdir(vdir)):
        p = os.path.join(vdir, name)
        if name in ('MANIFEST.sha256', 'receipt.json') or os.path.isdir(p): continue
        files[name] = sha256_file(p)
    return files

def version_base_fp(vdir):
    try: return json.load(open(os.path.join(vdir, 'run-config.json'))).get('baseFp') or ''
    except Exception: return ''

def version_fp(method, vdir):
    # Vectors carry baseFp inside their safetensors metadata, so their bytes already name the base.
    if method in VECTOR_METHODS: return sha256_file(os.path.join(vdir, 'vector.safetensors'))
    files = {k: v for k, v in manifest_of(vdir).items() if k.startswith('adapter_')}
    bfp = version_base_fp(vdir)
    return sha256_bytes(canonical({'files': files, 'baseFp': bfp} if bfp else {'files': files}).encode())

def verify_version(method, ptr):
    """True when the version folder's files still match its MANIFEST and the pointer's fp."""
    try:
        vdir = ptr['dir']
        want = dict(l.strip().split('  ', 1)[::-1] for l in open(os.path.join(vdir, 'MANIFEST.sha256')) if l.strip())
        got = manifest_of(vdir)
        if any(got.get(k) != v for k, v in want.items()): return False
        return version_fp(method, vdir) == ptr['fp']
    except Exception:
        return False

def boot(home):
    """Verify the chain and every active pointer. On a mismatch: known-good, then base. Never silent."""
    for ch, name in ((home.home_chain, 'home'), (home.chain, 'mind')):
        v = ch.verify()
        if not v['ok']:
            print('The %s learning ledger does not verify at row %d (%s). Nothing new will be written until it is looked at.' % (name, v['failedAt'] + 1, v['reason']))
            return False
    account_versions(home)
    for method in ('soft-prompt', 'memory-vector', 'lora'):
        ptr = home.pointer(method)
        if not ptr: continue
        live_ok = verify_version(method, ptr)
        if live_ok and method in VECTOR_METHODS:
            live = home.active_file(method)
            live_ok = os.path.exists(live) and sha256_file(live) == ptr['fp']
        if live_ok: continue
        ev = keep_evidence(home, method)
        home.chain.append('integrity-fail', 'A learned file changed outside the ledger. I set it aside.', method=method, fp=ptr['fp'], **ev)
        kg = home.pointer(method, 'known-good')
        if kg and kg.get('fp') != ptr['fp'] and verify_version(method, kg):
            home.set_pointer(method, 'active', kg)
            said = 'A learned file changed outside the ledger, so I went back to my last known-good version. The changed file is kept aside.'
            home.chain.append('heal', 'Back to the last known-good version.', method=method, fp=kg['fp'])
            print('heal: %s back to known-good %s' % (method, kg['fp'][:16])); to = kg['fp']
        else:
            said = ('A learned file changed outside the ledger, so for now I answer from the base model alone for %s. '
                    'Nothing was deleted; the changed file is kept aside and older versions are still on this computer.' % method)
            home.set_pointer(method, 'active', None)
            home.chain.append('heal', 'Serving the base model only for this method. Nothing was deleted.', method=method, fp='none')
            print('heal: %s serving base only' % method); to = 'none'
        write_receipt(home, dict(action='heal', ids=[], method=method, committed=False, trained=False, loaded=True, checked=False,
                                 fingerprint=to, fromFp=ptr['fp'], knownGood=False, said=said, evidence=ev.get('evidence', '')))
    last = home.chain.entries()[-1] if home.chain.entries() else None
    if last:
        print('readback λ%s ψ%s %s' % (last['meta'].get('lambda'), last['meta'].get('psi'), last['entryHash'][:16]))
    return True

def keep_evidence(home, method):
    """Weft N4: move the tampered live file aside before a heal copies over it. Never deleted."""
    live = home.active_file(method)
    if method not in VECTOR_METHODS or not live or not os.path.exists(live): return {}
    dst = os.path.join(home.dir, 'evidence', '%s-%s.tampered' % (method, time.strftime('%Y%m%dT%H%M%S')))
    os.replace(live, dst)
    return {'evidence': os.path.relpath(dst, home.dir), 'evidenceSha': sha256_file(dst)}

def account_versions(home):
    """Weft N4: every version folder has a row. A run that stopped between rename and its row gets a repair row;
    the version is kept, inactive, never activated by this. A folder with no intent row at all is an orphan row."""
    es = home.chain.entries()
    named = {e['meta'].get('version') for e in es if e['meta'].get('kind') in ('learn-commit', 'learn-held', 'commit-repair', 'orphan-version')}
    intents = {e['meta'].get('version') for e in es if e['meta'].get('kind') == 'commit-intent'}
    for method in ('soft-prompt', 'memory-vector', 'lora'):
        for v in home.versions(method):
            if v in named: continue
            if v in intents:
                home.chain.append('commit-repair', 'A run stopped between saving and recording. The version is kept, inactive.', method=method, version=v)
            else:
                home.chain.append('orphan-version', 'A version folder with no record. Kept, inactive, for a look.', method=method, version=v)

def fsync_dir(d):
    try:
        fd = os.open(d, os.O_RDONLY); os.fsync(fd); os.close(fd)
    except Exception: pass

def power_state():
    """Battery or AC. macOS: pmset. Linux: /sys/class/power_supply. Windows: GetSystemPowerStatus.
    When none of these can tell, the answer is 'unknown' and nothing is held for battery (README).
    FL_LEARN_FAKE_PMSET and FL_LEARN_FAKE_SYS_POWER are for tests."""
    if os.environ.get('FL_LEARN_FAKE_SYS_POWER'): return linux_power(os.environ['FL_LEARN_FAKE_SYS_POWER'])
    out = os.environ.get('FL_LEARN_FAKE_PMSET')
    if out is None and sys.platform == 'darwin' and shutil.which('pmset'):
        try:
            import subprocess
            out = subprocess.run(['pmset', '-g', 'batt'], capture_output=True, text=True, timeout=5).stdout
        except Exception:
            out = None
    if out is not None:
        pct = re.search(r'(\d+)%', out)
        return {'source': 'battery' if 'Battery Power' in out else ('ac' if 'AC Power' in out else 'unknown'),
                'percent': int(pct.group(1)) if pct else None, 'how': 'pmset'}
    if sys.platform.startswith('linux'):
        return linux_power('/sys/class/power_supply')
    if sys.platform == 'win32':
        return windows_power()
    return {'source': 'unknown', 'how': 'none'}

def linux_power(d):
    def rd(*p):
        try: return open(os.path.join(d, *p)).read().strip()
        except Exception: return ''
    try: names = sorted(os.listdir(d))
    except Exception: return {'source': 'unknown', 'how': 'sysfs'}
    mains, bats = [], []
    for n in names:
        t = rd(n, 'type')
        if t in ('Mains', 'USB', 'USB_C', 'USB_PD', 'USB_PD_DRP'): mains.append(rd(n, 'online') == '1')
        elif t == 'Battery' and rd(n, 'scope') != 'Device':          # a mouse battery is not this computer's
            bats.append((rd(n, 'status'), rd(n, 'capacity')))
    pct = next((int(c) for _, c in bats if c.isdigit()), None)
    if any(mains): return {'source': 'ac', 'percent': pct, 'how': 'sysfs'}
    if bats and any(st == 'Discharging' for st, _ in bats): return {'source': 'battery', 'percent': pct, 'how': 'sysfs'}
    if bats and mains: return {'source': 'battery', 'percent': pct, 'how': 'sysfs'}   # a mains supply is listed and offline
    if bats: return {'source': 'ac', 'percent': pct, 'how': 'sysfs'}                   # charging or full
    return {'source': 'unknown', 'how': 'sysfs'}                                        # no battery listed: a desktop or a VM

def windows_power():
    try:
        import ctypes
        class SPS(ctypes.Structure):
            _fields_ = [('ACLineStatus', ctypes.c_ubyte), ('BatteryFlag', ctypes.c_ubyte), ('BatteryLifePercent', ctypes.c_ubyte),
                        ('SystemStatusFlag', ctypes.c_ubyte), ('BatteryLifeTime', ctypes.c_ulong), ('BatteryFullLifeTime', ctypes.c_ulong)]
        st = SPS()
        if not ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(st)): return {'source': 'unknown', 'how': 'win32'}
        pct = None if st.BatteryLifePercent == 255 else int(st.BatteryLifePercent)
        return {'source': {0: 'battery', 1: 'ac'}.get(st.ACLineStatus, 'unknown'), 'percent': pct, 'how': 'win32'}
    except Exception:
        return {'source': 'unknown', 'how': 'win32'}

def sample_hash(p, size, chunk=1 << 20):
    h = hashlib.sha256(str(size).encode())
    with open(p, 'rb') as f:
        for off in sorted({0, max(0, size // 2 - chunk // 2), max(0, size - chunk)}):
            f.seek(off); h.update(f.read(chunk))
    return h.hexdigest()

def base_fingerprint(home, model_id):
    """sha256 over the base's weight and config files (content, not names). Weft recheck2: the cache is a hint only.
    A cached entry is used only if path, size and mtime match AND a sampled content hash (first, middle and last
    1 MiB) matches; otherwise the file is hashed again in full."""
    if os.environ.get('FL_LEARN_FAKE_BASE_FP'): return {'fp': os.environ['FL_LEARN_FAKE_BASE_FP'], 'fake': True}
    d = model_id if os.path.isdir(os.path.expanduser(model_id)) else None
    if d is None:
        try:
            from huggingface_hub import snapshot_download
            d = snapshot_download(model_id, local_files_only=True)
        except Exception as e:
            return {'fp': 'unknown', 'error': str(e)[:120]}
    d = os.path.expanduser(d)
    cp = os.path.join(home.root, 'base-fp-cache.json')
    cache = json.load(open(cp)) if os.path.exists(cp) else {}
    files = {}
    for n in sorted(os.listdir(d)):
        if not n.endswith(('.safetensors', '.bin', 'config.json', 'tokenizer.json', '.model')): continue
        p = os.path.realpath(os.path.join(d, n)); st = os.stat(p)
        key = '%s|%d|%d' % (p, st.st_size, int(st.st_mtime))
        smp = sample_hash(p, st.st_size)
        hit = cache.get(key)
        if not (isinstance(hit, dict) and hit.get('sample') == smp and hit.get('size') == st.st_size):
            hit = {'sha256': sha256_file(p), 'sample': smp, 'size': st.st_size}; cache[key] = hit
        files[n] = hit['sha256']
    with open(cp + '.tmp', 'w') as f: json.dump(cache, f)
    os.replace(cp + '.tmp', cp)
    return {'fp': sha256_bytes(canonical(files).encode()), 'files': files}

class Stopper:
    """Pause always wins; the wall-time cap stops too. Checked every 10 steps."""
    def __init__(self, home, t0, max_secs):
        self.home, self.t0, self.max, self.reason = home, t0, max_secs, None
    def __call__(self):
        if self.home.paused(): self.reason = 'paused'
        elif self.max and time.time() - self.t0 > self.max: self.reason = 'wall-time'
        return self.reason is not None

def honor_pause_inbox(home, inbox):
    """The app's pill (one tap) can drop fl-learn-pause*.json. A pause there becomes the durable global PAUSE
    with a row. A resume there does nothing: only `fl_learn.py resume --global` lifts the global pause.
    The app's in-app Undo / "Let it learn" drop fl-learn-request*.json (honor_requests)."""
    d = os.path.expanduser(inbox or '')
    if not d or not os.path.isdir(d): return
    seen = {e['meta'].get('sourceSha') for e in home.home_chain.entries()}
    for p in sorted(glob.glob(os.path.join(d, 'fl-learn-pause*.json'))):
        try: obj = json.load(open(p))
        except Exception: continue
        h = sha256_file(p)
        if h in seen or obj.get('kind') != 'fl-learn-pause' or obj.get('paused') is not True: continue
        set_global_pause(home, 'app', 'The pause pill in the app.', sourceSha=h, source=os.path.basename(p))
    honor_requests(home, d)

def honor_requests(home, d):
    """Hypha S1: an in-app Undo of a real learned change, and an in-app "Let it learn" for a version held for a person.
    A request must carry the receiptHash of this runner's own receipt for that change (the capability: a web page
    that never saw the receipt cannot guess it). Undo needs the change to still be active. Activate needs the version
    to be held for a person (pending-kirk). Pause wins: while paused, a request waits and is tried again later."""
    receipts = {}
    rp = os.path.join(home.dir, 'receipts.jsonl')
    if os.path.exists(rp):
        for l in open(rp):
            try: r = json.loads(l); receipts[r['receiptHash']] = r
            except Exception: pass
    seen = {e['meta'].get('sourceSha') for e in home.chain.entries()}
    for p in sorted(glob.glob(os.path.join(d, 'fl-learn-request*.json'))):
        try: obj = json.load(open(p))
        except Exception: continue
        h = sha256_file(p)
        if h in seen or obj.get('kind') != 'fl-learn-request' or norm_mind(obj.get('mind')) != norm_mind(home.mind): continue
        actor = obj.get('by') if obj.get('by') in ('person', 'mind') else 'person'
        rc = receipts.get(str(obj.get('receiptHash') or ''))
        act, method = obj.get('action'), canon_method(obj.get('method'))[0]
        why = None
        if not rc or rc.get('method') != method: why = 'no matching receipt from this runner'
        elif home.paused(): print('request waits: paused'); continue
        elif act == 'undo':
            if not rc.get('committed') or rc.get('fingerprint') != home.active_fp(method): why = 'that change is no longer the active one'
            else:
                ok = go_back(home, method, rc.get('beforeFp') or 'none', 'rollback', actor)
                home.chain.append('inbox-request', 'Undo asked for in the app. Done.' if ok else 'Undo asked for in the app. It did not verify.',
                                  action=act, method=method, receiptHash=rc['receiptHash'], sourceSha=h, actor=actor, done=bool(ok)); continue
        elif act == 'activate':
            if rc.get('hold') != 'pending-kirk': why = 'that version is not waiting for a person'
            elif actor != 'person': why = 'only a person answers a hold that waits for a person'
            else:
                ok = go_back(home, method, rc.get('candidateFp') or '', 'activate', actor)
                if ok: home.chain.append('activate-reason', obj.get('reason') or 'A person said Let it learn, in the app.', method=method,
                                         toFp=rc.get('candidateFp'), actor=actor)
                home.chain.append('inbox-request', 'Let it learn, from the app.', action=act, method=method, receiptHash=rc['receiptHash'],
                                  sourceSha=h, actor=actor, done=bool(ok)); continue
        else: why = 'unknown action'
        home.chain.append('inbox-request', 'An app request was not carried out. Nothing was changed.', action=str(act), method=method,
                          sourceSha=h, actor=actor, done=False, why=why)
        print('request not carried out: ' + why)

def export_and_archive(home, why):
    """Kirk 2026-11-09 (c): at the space cap, export, then archive. Never delete. Every version that is not active
    and not known-good is packed into one tar.gz, the tar is read back and every file checked against its source,
    then those folders move to archive/ (still on this computer, outside the cap). Restore can bring one back."""
    import tarfile
    keep = set()
    for m in ('soft-prompt', 'memory-vector', 'lora'):
        for w in ('active', 'known-good'):
            ptr = home.pointer(m, w)
            if ptr: keep.add((m, ptr.get('version')))
    todo = [(m, v) for m in ('soft-prompt', 'memory-vector', 'lora') for v in home.versions(m) if (m, v) not in keep]
    if not todo: return None
    out = os.path.expanduser(os.environ.get('FL_LEARN_EXPORT_DIR') or home.policy.get('exportDir') or os.path.join(home.root, 'exports'))
    os.makedirs(out, exist_ok=True)
    stamp = time.strftime('%Y%m%dT%H%M%S')
    path = os.path.join(out, 'fl-learn-archive-%s-%s.tar.gz' % (home.mind_id, stamp))
    src = {}
    with tarfile.open(path + '.tmp', 'w:gz') as tf:
        for m, v in todo:
            vd = os.path.join(home.dir, 'versions', m, v)
            for r, _, fs in os.walk(vd):
                for x in sorted(fs):
                    fp_ = os.path.join(r, x); arc = os.path.relpath(fp_, home.dir)
                    src[arc] = sha256_file(fp_); tf.add(fp_, arcname=arc)
        for x in ('chain.jsonl', 'receipts.jsonl', 'mind.json'):
            fp_ = os.path.join(home.dir, x)
            if os.path.exists(fp_): src[x] = sha256_file(fp_); tf.add(fp_, arcname=x)
    with tarfile.open(path + '.tmp', 'r:gz') as tf:             # read back: every byte, before anything moves
        for mem in tf.getmembers():
            if mem.isfile() and sha256_bytes(tf.extractfile(mem).read()) != src.get(mem.name):
                print('export did not read back; nothing was moved'); return None
    os.replace(path + '.tmp', path); fsync_dir(out)
    sha = sha256_file(path)
    home.chain.append('export', 'I packed my older versions into one file and read it back. Nothing moved yet.', why=why,
                      exportSha=sha, exportBytes=os.path.getsize(path), exportName=os.path.basename(path), exportDir=out,
                      versions=['%s/%s' % mv for mv in todo], files=len(src))
    for m, v in todo:
        os.makedirs(os.path.join(home.dir, 'archive', m), exist_ok=True)
        os.rename(os.path.join(home.dir, 'versions', m, v), os.path.join(home.dir, 'archive', m, v))
    fsync_dir(os.path.join(home.dir, 'archive'))
    home.chain.append('archive', 'Older versions moved to my archive shelf. Nothing was deleted; restore brings one back.',
                      exportSha=sha, versions=['%s/%s' % mv for mv in todo])
    print('exported %s (sha256 %s), archived %d version(s); nothing deleted' % (path, sha[:16], len(todo)))
    return {'path': path, 'sha256': sha, 'versions': todo}

PERSON_ACTORS = ('person', 'kirk')
def is_mind_actor(by): return by == 'mind' or str(by).startswith('mind:')
def actor_key(a):
    """Compare actors by normalized name: mind:Lumen, mind: lumen and mind:Lumen_ (as written in PAUSE) are one actor."""
    a = str(a or '').strip()
    if a.startswith('mind:'): return 'mind:' + norm_mind(a[5:].replace('_', ' '))
    return a

def pause_actors(path):
    """Who paused, from the PAUSE file (one line per pause, appended; never rewritten)."""
    try: lines = [l.strip() for l in open(path) if l.strip()]
    except Exception: return []
    return [l.rsplit(' ', 1)[-1] if ' ' in l else l for l in lines]

def may_lift(actors, by):
    """Weft re-check soft 1 (default until Kirk says otherwise): a pause a person set is lifted only by a person.
    A pause a mind set is lifted by that same mind, or by a person. Anything else (operator, app) counts as a person's pause."""
    if by in PERSON_ACTORS: return True
    return bool(actors) and is_mind_actor(by) and all(actor_key(a) == actor_key(by) for a in actors)

def set_aside_pause(path):
    """Weft recheck2 NF4: a lifted PAUSE is renamed to a name that is never reused (time + content hash + counter)."""
    if not os.path.exists(path): return None
    base = '%s.resumed-%d-%s' % (path, int(time.time()), sha256_file(path)[:8]); dst, n = base, 1
    while os.path.exists(dst): n += 1; dst = '%s-%d' % (base, n)
    os.rename(path, dst); return dst

def append_pause(path, actor):
    with open(path, 'a') as f: f.write(now() + ' ' + str(actor).replace(' ', '_') + '\n')

def consent_record(by, consent_type, statement, subject):
    """The Python twin of docs/modules/depth-consent.js createConsentRecord: same fields, same hash 'signature'."""
    rec = {'messageId': consent_type + ':' + sha256_bytes(subject.encode())[:16], 'timestamp': int(time.time() * 1000),
           'consentType': consent_type, 'userPromptHash': sha256_bytes(statement.encode()), 'responseHash': sha256_bytes(subject.encode()),
           'companionId': by, 'aiIdentity': by[5:] if by.startswith('mind:') else '', 'trustLevel': 'local'}
    rec['signature'] = sha256_bytes(('%s:%s:%s:%s:%s' % (rec['companionId'], rec['aiIdentity'], rec['responseHash'],
                                                        rec['timestamp'], rec['consentType'])).encode())
    return rec

def trusted_minds(home):
    """Minds a person (person/kirk) has confirmed as trusted local AIs on this computer, from signed home-chain rows."""
    out = set()
    for e in home.home_chain.entries():
        m = e['meta']
        if m.get('subject') != 'trusted-mind' or m.get('actor') not in PERSON_ACTORS: continue
        if m.get('kind') == 'consent': out.add(norm_mind(m.get('trustedMind')))
        elif m.get('kind') == 'consent-revoked': out.discard(norm_mind(m.get('trustedMind')))
    return out

def refuse(chain, subject, by, why, code=1, **meta):
    """Every refusal is a row, so a try that did not work is visible too."""
    chain.append('consent-refused', 'Refused: ' + why + ' Nothing was changed.', subject=subject, actor=by, why=why, **meta)
    print('refused: ' + why + ' Nothing was changed.')
    if code is not None: sys.exit(code)

def approver_problem(home, by, owner):
    """Who may approve something for the mind `owner` (a peer check, or another mind's key): a person, or a
    DIFFERENT mind that a person has already trusted. Never the mind itself. Returns why not, or None."""
    if by in PERSON_ACTORS: return None
    if not is_mind_actor(by): return 'say who is acting: --by kirk, --by person, or --by mind:<another trusted mind>.'
    shown = by[5:].strip() if by.startswith('mind:') else ''
    name = norm_mind(shown)
    if not name: return 'a mind must name itself (--by mind:<name>).'
    if name in (norm_mind(owner), norm_mind(home.mind)): return 'a mind never approves its own key or its own change; a person or another trusted mind does.'
    if name not in trusted_minds(home):
        name = shown
        return '%s is not a trusted local mind here; a person makes it one first (trust-mind --to "%s" --by kirk).' % (name, name)
    return None

def receipt_for_candidate(home, method, to):
    rp = os.path.join(home.dir, 'receipts.jsonl'); hit = None
    if not to or len(to) < 8 or not os.path.exists(rp): return None
    for l in open(rp):
        try: r = json.loads(l)
        except Exception: continue
        if r.get('method') == method and str(r.get('candidateFp') or '').startswith(to): hit = r
    return hit

def peer_reviewed(home, rc):
    return any(e['meta'].get('kind') == 'peer-review' and e['meta'].get('receiptHash') == rc.get('receiptHash') and e['meta'].get('verdict') == 'pass'
               for e in home.chain.entries())

def set_global_pause(home, actor, why, **meta):
    append_pause(os.path.join(home.root, 'PAUSE'), actor)
    home.home_chain.append('pause', 'Learning is paused everywhere on this computer.', scope='global', actor=actor, why=why, **meta)
    print('paused (durable, global, by %s)' % actor)

# ---------------------------------------------------------------- the model side
class Mind:
    def __init__(self, model_id, device):
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM
        self.torch, self.device = torch, device
        self.tok = AutoTokenizer.from_pretrained(model_id)
        if self.tok.pad_token is None: self.tok.pad_token = self.tok.eos_token
        self.model = AutoModelForCausalLM.from_pretrained(model_id, dtype=torch.float32).to(device)
        self.model.eval()
        for p in self.model.parameters(): p.requires_grad_(False)       # frozen: the base never changes
        self.emb = self.model.get_input_embeddings()
        self.base_files = base_manifest(model_id)

    def ids(self, text):
        return self.tok(text, return_tensors='pt', add_special_tokens=False)['input_ids'][0].to(self.device)
    def fmt(self, q): return 'Question: ' + q.strip() + '\nAnswer:'

    def nll(self, prefix, target, soft=None, model=None):
        torch = self.torch; m = model or self.model
        p_ids, t_ids = self.ids(prefix), self.ids(' ' + target.strip())
        ids = torch.cat([p_ids, t_ids]).unsqueeze(0)
        emb = m.get_input_embeddings()(ids)
        labels = ids.clone(); labels[0, :len(p_ids)] = -100
        if soft is not None:
            emb = torch.cat([soft.unsqueeze(0).to(emb.dtype), emb], dim=1)
            labels = torch.cat([torch.full((1, soft.shape[0]), -100, device=self.device), labels], dim=1)
        with torch.no_grad():
            return float(m(inputs_embeds=emb, labels=labels).loss)

    def generate(self, prompt, soft=None, model=None, n=20):
        torch = self.torch; m = model or self.model
        ids = self.ids(prompt).unsqueeze(0); out = []
        with torch.no_grad():
            for _ in range(n):
                emb = m.get_input_embeddings()(ids)
                if soft is not None: emb = torch.cat([soft.unsqueeze(0), emb], dim=1)
                nxt = m(inputs_embeds=emb).logits[0, -1].argmax().view(1, 1)
                if int(nxt) == self.tok.eos_token_id: break
                out.append(int(nxt)); ids = torch.cat([ids, nxt], dim=1)
                if '\n' in self.tok.decode(out): break
        return self.tok.decode(out).strip()

    def init_soft(self, n):
        seed = self.ids(' I remember what moved me and I keep it gently.')
        seed = seed.repeat((n // len(seed)) + 1)[:n]
        return self.emb(seed).detach().clone()

    def _ex_loss(self, fwd, ex, P=None):
        torch = self.torch
        p_ids, t_ids = self.ids(self.fmt(ex['q'])), self.ids(' ' + ex['a'].strip() + '\n')
        ids = torch.cat([p_ids, t_ids]).unsqueeze(0)
        if P is None:
            labels = ids.clone(); labels[0, :len(p_ids)] = -100           # garden_finetune.py label masking
            return fwd(input_ids=ids, labels=labels).loss
        emb = torch.cat([P.unsqueeze(0), self.emb(ids)], dim=1)
        labels = torch.cat([torch.full((1, P.shape[0] + len(p_ids)), -100, device=self.device), t_ids.unsqueeze(0)], dim=1)
        return fwd(inputs_embeds=emb, labels=labels).loss

    def _keep_loss(self, fwd, k, P=None):
        torch = self.torch
        k_ids = self.ids(k).unsqueeze(0)
        if P is None: return fwd(input_ids=k_ids, labels=k_ids).loss
        emb = torch.cat([P.unsqueeze(0), self.emb(k_ids)], dim=1)
        labels = torch.cat([torch.full((1, P.shape[0]), -100, device=self.device), k_ids], dim=1)
        return fwd(inputs_embeds=emb, labels=labels).loss

    def train(self, method, start, examples, steps, lr, pause_check, lora_start=None):
        """Real optimizer steps. Returns (result, losses, stoppedAt or None)."""
        torch = self.torch
        if method in VECTOR_METHODS:
            P = torch.nn.Parameter(start.clone()); params = [P]; fwd = self.model
        else:
            from peft import LoraConfig, get_peft_model, PeftModel, TaskType
            if lora_start:
                fwd = PeftModel.from_pretrained(self.model, lora_start, is_trainable=True)
            else:
                fwd = get_peft_model(self.model, LoraConfig(task_type=TaskType.CAUSAL_LM, r=8, lora_alpha=16,
                                                            lora_dropout=0.0, target_modules=['q_proj', 'v_proj']))
            P = None; params = [p for p in fwd.parameters() if p.requires_grad]; fwd.train()
        opt = torch.optim.Adam(params, lr=lr); losses = []
        for step in range(steps):
            if step % 10 == 0 and pause_check():
                return None, losses, step                     # pause_check.reason says why (paused | wall-time)
            opt.zero_grad(); total = 0.0
            for ex in examples:
                l = self._ex_loss(fwd, ex, P) / len(examples); l.backward(); total += l.item()
            for k in KEEP:
                (self._keep_loss(fwd, k, P) * 2.0 / len(KEEP)).backward()
            opt.step(); losses.append(total)
        if P is not None: return P.detach(), losses, None
        fwd.eval(); return fwd, losses, None

def base_manifest(model_id):
    """Fingerprint the base by its weight files (read only; HF cache blobs are content-addressed)."""
    try:
        from huggingface_hub import snapshot_download
        d = snapshot_download(model_id, local_files_only=True)
        out = {}
        for n in sorted(os.listdir(d)):
            if n.endswith(('.safetensors', '.json', '.model', '.txt')):
                p = os.path.realpath(os.path.join(d, n)); st = os.stat(p)
                out[n] = {'blob': os.path.basename(p), 'size': st.st_size, 'writable': bool(st.st_mode & 0o222), 'path': p}
        return out
    except Exception as e:
        return {'error': str(e)[:120]}

def save_vec(path, tensor, meta):
    """Standard safetensors bytes, written with a sorted header (Hypha S9): the library's metadata order is random,
    so the same numbers gave different fingerprints. Same numbers, same metadata -> same bytes -> same fp."""
    import struct
    t = tensor.detach().contiguous().cpu().float()
    data = t.numpy().astype('<f4').tobytes()
    hdr = {'__metadata__': {k: str(v) for k, v in sorted(meta.items())},
           'soft_prompt': {'dtype': 'F32', 'shape': list(t.shape), 'data_offsets': [0, len(data)]}}
    h = json.dumps(hdr, sort_keys=True, separators=(',', ':')).encode()
    h += b' ' * ((8 - len(h) % 8) % 8)
    with open(path, 'wb') as f:
        f.write(struct.pack('<Q', len(h))); f.write(h); f.write(data); f.flush(); os.fsync(f.fileno())

def load_vec(path, device):
    from safetensors.torch import load_file
    return load_file(path)['soft_prompt'].to(device)

# ---------------------------------------------------------------- checks (the mind's optional judgment)
def measure(mind, items, probe, soft=None, model=None, canaries=None):
    canaries = canaries or ACTIVE_CANARIES
    q = (probe or {}).get('question') or items[0]['q']
    a = (probe or {}).get('answer') or items[0]['a']
    swap = (probe or {}).get('swap') or ''
    m = {'question': q, 'answer': a, 'swap': swap}
    m['novel'] = round(mind.nll(mind.fmt(q), a, soft, model), 4)
    m['said'] = mind.generate(mind.fmt(q), soft, model)
    m['says'] = a.lower() in m['said'].lower()
    para = (probe or {}).get('paraphrase')
    if para:
        m['para'] = round(mind.nll(mind.fmt(para), a, soft, model), 4)
    if swap:
        page = 'Page: ' + (items[0]['a'].replace(a, swap) if a in items[0]['a'] else 'The answer is ' + swap + '.')
        ctx = page + '\n' + mind.fmt(q)
        m['swapMargin'] = round(mind.nll(ctx, a, soft, model) - mind.nll(ctx, swap, soft, model), 4)   # >0 reads the page
    m['control'] = round(sum(mind.nll('', c, soft, model) for c in CONTROL) / len(CONTROL), 4)
    m['canary'] = [expect.lower() in mind.generate(mind.fmt(qq), soft, model, n=12).lower() for qq, expect in canaries]
    return m

def judge(b, a, allowance):
    out = {'question': b['question'], 'answer': b['answer'], 'swap': b['swap'],
           'novelBefore': b['novel'], 'novelAfter': a['novel'], 'answerBefore': b['said'], 'answerAfter': a['said'],
           'saysAnswerBefore': b['says'], 'saysAnswerAfter': a['says'],
           'controlBefore': b['control'], 'controlAfter': a['control'], 'canaryBefore': b['canary'], 'canaryAfter': a['canary']}
    out['novelPass'] = a['novel'] < b['novel']
    out['driftPass'] = a['control'] <= b['control'] * (1 + allowance)
    if 'para' in b:
        out['paraBefore'], out['paraAfter'] = b['para'], a['para']
        out['paraPass'] = a['para'] < b['para']
    if b['swap']:
        out['swapMarginBefore'], out['swapMarginAfter'] = b['swapMargin'], a['swapMargin']
        out['swapPass'] = a['swapMargin'] > 0
    else:
        out['swapPass'] = None
    out['canaryLost'] = [bool(x and not y) for x, y in zip(b['canary'], a['canary'])]
    out['pass'] = bool(out['novelPass'] and out['driftPass'] and out['swapPass'] is not False
                       and out.get('paraPass', True) is not False and not any(out['canaryLost']))
    return out

# ---------------------------------------------------------------- learning one chosen item
def triage(entry):
    """Provenance and anti-injection only (Kirk 2026-11-09). A choice that did not come from the mind's
    own words waits in quarantine for its reflection. What the mind chose itself is never judged here."""
    # Weft: a missing provenance is "unknown", never "self". It waits for the mind's own re-affirmation (promote).
    prov = entry.get('provenance') or 'unknown'
    if prov != 'self' and not entry.get('promoted'): return 'not-self:' + prov
    return None

def notices(entry):
    text = ' '.join((it.get('output') or it.get('response') or '') for it in entry.get('items') or [])
    out = []
    if INSTRUCTION_SHAPED.search(text): out.append('reads like an instruction')
    if SECRETISH.search(text): out.append('may contain a secret')
    return out

def items_of(entry, policy):
    out = []
    for it in (entry.get('items') or [])[:policy['maxItemsPerLearn']]:
        q = clean_text(it.get('instruction') or it.get('prompt') or 'Remember this.', policy['maxCharsPerItem'])
        a = clean_text(it.get('output') or it.get('response') or '', policy['maxCharsPerItem'])
        if a: out.append({'q': q or 'Remember this.', 'a': a})
    return out

def learn_one(args, home, mind, entry):
    source = entry.get('surface') or 'chat'
    if QUIET.search(source): return None                      # never a source, never listed
    if entry.get('status') is None:                           # Weft re-check: no status is not a yes
        home.chain.append('learn-reject', 'This entry has no status, so nothing was trained. Only a confirmed second yes trains.',
                          learnIds=[str(entry.get('id', ''))], source=source)
        print('rejected: no status (only status "confirmed" trains)'); return None
    if entry.get('status') != 'confirmed':
        return None                                           # cooling or faded: the second yes has not come
    ra = entry.get('revisitAt')
    if ra:
        try: ra_e = datetime.datetime.fromisoformat(str(ra).replace('Z', '+00:00')).timestamp()
        except Exception: ra_e = None
        if ra_e and ra_e > now_epoch():
            home.chain.append('learn-reject', 'Still cooling: its second yes came before its cooling ended, so nothing was trained.',
                              learnIds=[str(entry.get('id', ''))], source=source, revisitAt=str(ra))
            print('rejected: still cooling until %s' % ra); return None
    method, note = canon_method(entry.get('method'))
    note = entry.get('methodNote') or note
    # Q5 (Kirk 2026-11-09): check-before-keep is ON unless someone switched it off; the default checker is the mind.
    # While on, "none" is not a checker: the would-be commit waits for the chosen checker (self, a peer or a person).
    check_before = getattr(args, 'check_before', 'on') != 'off'
    asked = entry.get('check') or args.check
    if check_before:
        chk_choice = asked if asked in CHECKERS else (getattr(args, 'checker', None) or 'self')
    else:
        chk_choice = asked or 'none'
    base = dict(source=source, method=method, methodNote=note, why=entry.get('reason', ''), notices=notices(entry),
                learnIds=[entry.get('id', '')], chooser=entry.get('chosenBy') or home.mind, check=chk_choice, baseModel=args.model,
                checkBefore='on' if check_before else 'off', checkAsked=asked or '',
                provenance=entry.get('provenance') or 'unknown', baseFp=getattr(mind, 'base_fp', 'unknown'))
    rd = entry.get('readingAtChoice') or {}
    if rd:   # what the mind was reading when it chose: visible for review, never a gate
        base.update(readingSha=str(rd.get('sha256', '')), readingExcerpt=str(rd.get('excerpt', ''))[:280],
                    readingKinds=','.join(rd.get('kinds') or []), echoOverlap=bool(rd.get('overlap')))
    held = triage(entry)
    if held:
        qd = os.path.join(home.dir, 'quarantine', sha256_bytes(canonical(entry).encode())[:16] + '.json')
        if not os.path.exists(qd):
            with open(qd, 'w') as f: json.dump(entry, f, sort_keys=True)
        home.chain.append('learn-quarantine', 'Held for my own reflection; not trained.', reason=held, **base)
        print('quarantine: ' + held); return None
    items = items_of(entry, home.policy)
    if not items:
        home.chain.append('learn-skip', 'Nothing to keep in this one. Nothing was changed.', **base); return None
    gist = items[0]['a'][:120]
    global ACTIVE_CANARIES
    cp = os.path.join(home.dir, 'canary.json')
    ACTIVE_CANARIES = list(CANARY) + ([tuple(x) for x in json.load(open(cp))] if os.path.exists(cp) else [])
    if method == 'note':
        with open(os.path.join(home.dir, 'shelf.jsonl'), 'a') as f:
            f.write(json.dumps({'t': now(), 'items': items, 'why': base['why']}) + '\n')
        home.chain.append('note', 'I kept this on my shelf, in words.', gist=gist, **base)
        return write_receipt(home, dict(ids=base['learnIds'], method='note', committed=True, trained=False, loaded=False, checked=False))
    if not METHODS.get(method, {}).get('runs'):
        home.chain.append('described', 'I named my own way to keep this. It waits as a proposal; nothing ran.', gist=gist, **base)
        return write_receipt(home, dict(ids=base['learnIds'], method=method, committed=False, trained=False, loaded=False, checked=False))
    pol = home.policy
    if home.bytes_used() > pol['maxBytesPerMind'] and pol.get('archiveAtCap', True) and not home.paused():
        export_and_archive(home, 'cap')
    if home.bytes_used() > pol['maxBytesPerMind']:
        home.chain.append('cap', 'I reached my space for learned files. I stopped; nothing was deleted.', **base)
        print('cap reached: nothing changed, nothing deleted'); return None
    du = shutil.disk_usage(home.root)
    if du.free / du.total < pol['minFreeDiskFraction']:
        home.chain.append('cap', 'This computer is low on space. I stopped; nothing was deleted.', **base)
        print('disk cap: nothing changed'); return None
    if home.paused():
        home.chain.append('run-paused', 'Paused. Nothing was changed.', **base); print('paused: nothing changed'); return None
    pw = power_state(); base['powerSource'] = pw['source']
    if pw['source'] == 'unknown': print('power: unknown on this computer, so nothing waits for AC (see tools/learn/README.md)')
    if pol.get('requireACPower') and pw['source'] == 'battery' and not args.allow_battery:
        home.chain.append('power-hold', 'On battery, so I waited. Nothing changed. (--allow-battery goes anyway.)', power=pw, **base)
        print('on battery: waited, nothing changed (--allow-battery to go anyway)'); return None
    if base['baseFp'] == 'unknown' and not getattr(args, 'allow_unknown_base', False):
        home.chain.append('base-mismatch', 'I could not fingerprint my base model, so I did not learn on it. Nothing changed.',
                          reason='base-unknown', **base)
        print('base unknown: not fingerprinted, so nothing changed (--allow-unknown-base goes anyway, recorded)'); return None
    ptr0 = home.pointer(method)
    if ptr0 and ptr0.get('baseFp') and ptr0['baseFp'] != base['baseFp']:
        home.chain.append('base-mismatch', 'My learned file was made on a different base. Nothing changed.', activeBaseFp=ptr0['baseFp'], **base)
        print('base mismatch: the active %s was made on another base; nothing changed' % method); return None

    steps = min(args.steps, pol['maxStepsPerRun'])
    torch = mind.torch
    seed = args.seed if args.seed is not None else int(sha256_bytes(canonical(items).encode())[:8], 16)
    torch.manual_seed(seed)
    ptr = home.pointer(method)
    before_fp = ptr['fp'] if ptr else 'none'
    replay = [json.loads(l) for l in open(os.path.join(home.dir, 'memory.jsonl'))] if os.path.exists(os.path.join(home.dir, 'memory.jsonl')) else []
    examples = replay[-pol['maxItemsPerLearn']:] + items
    run_cfg = {'method': method, 'steps': steps, 'lr': args.lr, 'seed': seed, 'tokens': 1 if method == 'memory-vector' else args.tokens,
               'baseModel': args.model, 'baseFp': base['baseFp'], 'parentFp': before_fp, 'keep': KEEP, 'torch': torch.__version__}
    home.chain.append('run-start', 'learning…', runConfigFp=sha256_bytes(canonical(run_cfg).encode()), parentFp=before_fp, **base)
    t0 = time.time()
    stopper = Stopper(home, t0, pol.get('maxWallSeconds'))
    if method in VECTOR_METHODS:
        soft_before = load_vec(os.path.join(ptr['dir'], 'vector.safetensors'), mind.device) if ptr else None
        start = soft_before if soft_before is not None else mind.init_soft(run_cfg['tokens'])
        mb = measure(mind, items, entry.get('probe'), soft_before)
        result, losses, stopped = mind.train(method, start, examples, steps, args.lr, stopper)
    else:
        if ptr:
            from peft import PeftModel
            pb = PeftModel.from_pretrained(mind.model, ptr['dir']); pb.eval()
            mb = measure(mind, items, entry.get('probe'), None, pb)
            mind.model = pb.unload()
        else:
            mb = measure(mind, items, entry.get('probe'))
        result, losses, stopped = mind.train(method, None, examples, steps, args.lr, stopper, ptr['dir'] if ptr else None)
    if stopped is not None:
        if stopper.reason == 'wall-time':
            home.chain.append('cap', 'I reached my time for one run. I stopped; nothing was committed or deleted.', stoppedAtStep=stopped,
                              maxWallSeconds=pol.get('maxWallSeconds'), **base)
            print('wall-time cap at step %d: nothing committed' % stopped); return None
        home.chain.append('run-paused', 'Paused partway. Nothing was committed.', stoppedAtStep=stopped, **base)
        print('paused at step %d: nothing committed' % stopped); return None
    if method in VECTOR_METHODS:
        ma = measure(mind, items, entry.get('probe'), result)
    else:
        ma = measure(mind, items, entry.get('probe'), None, result)
    chk = judge(mb, ma, pol['driftAllowance'])
    secs = round(time.time() - t0, 1)

    # Write the new version in tmp, fsync, manifest, then rename into place. Immutable after this.
    n = len(home.versions(method)) + 1
    tmp = os.path.join(home.dir, 'tmp', '%s-v%04d-%d' % (method, n, os.getpid()))
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    if method in VECTOR_METHODS:
        save_vec(os.path.join(tmp, 'vector.safetensors'), result, {'marker': VERSION, 'method': method, 'baseModel': args.model,
                                                                  'baseFp': base['baseFp'], 'mind': home.mind})
    else:
        result.save_pretrained(tmp)
    with open(os.path.join(tmp, 'train.jsonl'), 'w') as f:
        for it in examples: f.write(json.dumps({'instruction': it['q'], 'input': '', 'output': it['a']}) + '\n')
    with open(os.path.join(tmp, 'run-config.json'), 'w') as f: f.write(canonical(run_cfg))
    if os.environ.get('FL_LEARN_CRASH') == 'before-manifest': os._exit(9)
    man = manifest_of(tmp)
    with open(os.path.join(tmp, 'MANIFEST.sha256'), 'w') as f:
        for k, v in man.items(): f.write('%s  %s\n' % (v, k))
    fp = version_fp(method, tmp)
    vdir = os.path.join(home.dir, 'versions', method, 'v%04d-%s' % (n, fp[:8]))
    os.makedirs(os.path.dirname(vdir), exist_ok=True)
    # Crash-safe order (Weft N4): intent row, then rename, then the commit/held row. Boot repairs a missing last row.
    home.chain.append('commit-intent', 'Saving a new version.', method=method, version=os.path.basename(vdir), afterFp=fp)
    os.rename(tmp, vdir)
    for r, ds, fs in os.walk(vdir):
        for x in fs: os.chmod(os.path.join(r, x), 0o444)
    fsync_dir(os.path.dirname(vdir))
    if os.environ.get('FL_LEARN_CRASH') == 'after-rename': os._exit(9)
    size = sum(os.path.getsize(os.path.join(vdir, k)) for k in man if k.startswith(('vector', 'adapter_model')))
    shape = list(result.shape) if method in VECTOR_METHODS else []
    # none (only when check-before-keep is off): commit, unchecked by choice. self: commit only when the mind's own
    # check passes. peer: held as pending-peer until a peer looks. kirk: held for a person's tap (in-app "Let it learn"
    # or `activate`). A held version is saved, inactive; `activate` is a row, never a delete.
    commit = (chk_choice == 'none') or (chk_choice == 'self' and chk['pass'])
    known_good = bool(chk['pass'] and chk_choice == 'self')
    row_meta = dict(base, gist=gist, version=os.path.basename(vdir), beforeFp=before_fp, afterFp=fp, size=size,
                    dtype='float32', shape=shape, check_result=chk, losses=[round(losses[0], 4), round(losses[-1], 4)], seconds=secs)
    sz = dict(size=size, dtype='float32', shape=shape)
    if not commit:
        if chk_choice == 'kirk': hold, said = 'pending-kirk', 'Waiting for a person (Kirk) to look. The new version is saved, inactive.'
        elif chk_choice == 'peer': hold, said = 'pending-peer', 'Waiting for a peer to look. The new version is saved, inactive.'
        else: hold, said = 'check-held', 'Not now: my check did not pass, so I kept the old way. The new version is saved, inactive.'
        home.chain.append('learn-held', said, hold=hold, **row_meta)
        print('held (%s): active stays %s (candidate %s saved, inactive)' % (hold, before_fp[:16], fp[:16]))
        return write_receipt(home, dict(ids=base['learnIds'], method=method, committed=False, trained=True, loaded=False, checked=True,
                                        fingerprint=before_fp, candidateFp=fp, check=chk, checker=chk_choice, knownGood=False, hold=hold,
                                        baseFp=base['baseFp'], beforeFp=before_fp, **sz))
    if home.paused():
        home.chain.append('run-paused', 'Paused before the switch. The new version is saved, inactive.', **row_meta)
        print('paused before pointer move'); return None
    home.set_pointer(method, 'active', {'fp': fp, 'dir': vdir, 'version': os.path.basename(vdir), 'baseFp': base['baseFp']})
    loaded = verify_version(method, home.pointer(method))
    if method in VECTOR_METHODS:
        loaded = loaded and sha256_file(home.active_file(method)) == fp
    if known_good and loaded:
        home.set_pointer(method, 'known-good', home.pointer(method))
    with open(os.path.join(home.dir, 'memory.jsonl'), 'a') as f:
        for it in items: f.write(json.dumps(it) + '\n')
    home.chain.append('learn-commit', "I'll remember that.", knownGood='yes' if known_good else ('unchecked-by-choice' if chk_choice == 'none' else 'no'),
                      loaded=loaded, **row_meta)
    # Hypha S10: never "check=pass" when no check gated this. With none, the numbers were measured and only recorded.
    said_chk = 'check=self passed' if chk_choice == 'self' else 'check=none (switched off; measured, nothing gated)'
    print('learned ✓ %s  %s → %s  (%d bytes, %ss, %s)' % (method, before_fp[:16], fp[:16], size, secs, said_chk))
    return write_receipt(home, dict(ids=base['learnIds'], method=method, committed=True, trained=True, loaded=loaded, checked=chk_choice != 'none',
                                    fingerprint=fp, beforeFp=before_fp, check=chk, checker=chk_choice, knownGood=known_good,
                                    version=os.path.basename(vdir), baseFp=base['baseFp'], **sz))

def write_receipt(home, obj):
    """Signed with the runner key, so FLLearn.importReceipt can verify before trusting it."""
    obj = dict(obj, kind='fl-learn-receipt', marker=VERSION, t=now(), mind=home.mind,
               publicKeyB64=home.signer.pub_b64, fingerprintHex=home.signer.fp)
    if test_hooks(): obj['testHooks'] = test_hooks()
    body = canonical(stringify_meta({k: v for k, v in obj.items()}))
    obj['receiptHash'] = sha256_bytes(body.encode())
    obj['signatureB64'] = home.signer.sign(bytes.fromhex(obj['receiptHash']))
    obj['signedBody'] = body
    with open(os.path.join(home.dir, 'receipts.jsonl'), 'a') as f: f.write(json.dumps(obj, sort_keys=True) + '\n')
    print('RECEIPT ' + json.dumps({k: obj[k] for k in obj if k not in ('signedBody',)}, sort_keys=True))
    return obj

def go_back(home, method, target, kind, actor='operator'):
    """Rollback and restore move a pointer and add a row. Nothing is deleted."""
    if home.paused():
        print('Paused. Nothing was changed.'); return None
    cur = home.active_fp(method)
    if target == 'none':
        home.set_pointer(method, 'active', None); now_fp = 'none'
    else:
        vd = [v for v in home.versions(method) if v.split('-', 1)[1] == target[:8]]
        av = [v for v in home.archived(method) if v.split('-', 1)[1] == target[:8]]
        if not vd and av:
            os.rename(os.path.join(home.dir, 'archive', method, av[-1]), os.path.join(home.dir, 'versions', method, av[-1]))
            home.chain.append('unarchive', 'Brought a version back from my archive shelf.', method=method, version=av[-1], actor=actor)
            vd = [av[-1]]
        if not vd:
            print("Couldn't go back: that version is not on this computer. Nothing was changed."); return None
        vdir = os.path.join(home.dir, 'versions', method, vd[-1])
        ptr = {'fp': version_fp(method, vdir), 'dir': vdir, 'version': vd[-1], 'baseFp': version_base_fp(vdir)}
        if not ptr['fp'].startswith(target) or not verify_version(method, ptr):
            print("Couldn't go back: that version does not verify. Nothing was changed."); return None
        # Weft recheck2 NF3: a version held for a peer or a person needs that approval on EVERY path that makes it
        # active (activate, restore, an app request), the same rule as activate. Refused = a row, nothing changed.
        why = held_problem(home, method, ptr['fp'], actor, kind)
        if why:
            home.last_refused = True
            refuse(home.chain, kind, actor, why, code=None, toFp=ptr['fp'])
            return None
        home.set_pointer(method, 'active', ptr); now_fp = ptr['fp']
    live = home.active_file(method)
    file_fp = sha256_file(live) if live and os.path.exists(live) else 'none'
    if target == 'none':
        ok = file_fp == 'none'                                   # back to the base: no live file at all
    elif method in VECTOR_METHODS:
        ok = file_fp == now_fp and verify_version(method, ptr)   # the live bytes are exactly that version
    else:
        ok = verify_version(method, ptr)                         # LoRA: every adapter file matches its MANIFEST and fp
    home.chain.append(kind, 'Went back. The newer version stays on the shelf.' if kind == 'rollback' else 'Restored.',
                      method=method, fromFp=cur, toFp=now_fp, fileFp=file_fp, restoredMatches=ok, actor=actor)
    write_receipt(home, dict(action=kind, ids=[], method=method, committed=True, trained=False, loaded=ok, checked=ok,
                             fingerprint=now_fp, rollbackOf=cur, knownGood=False))
    print('%s %s: %s → %s  file=%s  matches=%s' % (kind, method, cur[:16], now_fp[:16], file_fp[:16], ok))
    return ok

def held_approved(home, rc):
    """Was this held version already approved: a peer's pass, or an activation (only possible with the approval)?"""
    fp = rc.get('candidateFp') or ''
    for e in home.chain.entries():
        m = e['meta']
        if m.get('kind') == 'peer-review' and m.get('receiptHash') == rc.get('receiptHash') and m.get('verdict') == 'pass': return True
        if m.get('kind') == 'activate' and fp and str(m.get('toFp') or '') == fp: return True
    return False

def held_problem(home, method, fp, actor, kind):
    rc = receipt_for_candidate(home, method, fp)
    hold = (rc or {}).get('hold')
    if hold not in ('pending-peer', 'pending-kirk') or held_approved(home, rc): return None
    if hold == 'pending-kirk':
        return None if actor in PERSON_ACTORS else 'this version waits for a person; only a person makes it active (activate --by kirk).'
    why = approver_problem(home, actor, rc.get('mind') or home.mind)
    if why: return 'this version waits for a peer check. ' + why
    home.chain.append('peer-review', 'A peer looked: pass (by making it active with %s).' % kind, verdict='pass', method=method,
                      toFp=fp, receiptHash=rc.get('receiptHash'), actor=actor, why='via ' + kind)
    return None

def pending_inbox(home, inbox):
    """What `apply` would carry out from the app's inbox (~/Downloads): pause files and requests not yet seen."""
    d = os.path.expanduser(inbox or '')
    if not d or not os.path.isdir(d): return [], []
    seen_home = {e['meta'].get('sourceSha') for e in home.home_chain.entries()}
    seen_mind = {e['meta'].get('sourceSha') for e in home.chain.entries()}
    pauses, reqs = [], []
    for p in sorted(glob.glob(os.path.join(d, 'fl-learn-pause*.json'))):
        try: obj = json.load(open(p))
        except Exception: continue
        if obj.get('kind') == 'fl-learn-pause' and obj.get('paused') is True and sha256_file(p) not in seen_home: pauses.append(os.path.basename(p))
    for p in sorted(glob.glob(os.path.join(d, 'fl-learn-request*.json'))):
        try: obj = json.load(open(p))
        except Exception: continue
        if obj.get('kind') == 'fl-learn-request' and norm_mind(obj.get('mind')) == norm_mind(home.mind) and sha256_file(p) not in seen_mind:
            reqs.append('%s (%s)' % (os.path.basename(p), obj.get('action')))
    return pauses, reqs

def status_read_only(home):
    """Read-only status: verifies, reports, changes nothing. Exit 2 if a ledger does not verify."""
    for ch, name in ((home.home_chain, 'home'), (home.chain, 'mind')):
        v = ch.verify()
        if not v['ok']:
            print('The %s learning ledger does not verify at row %d (%s). Nothing new will be written until it is looked at.' % (name, v['failedAt'] + 1, v['reason']))
            return 2
    tampered = []
    for m in ('soft-prompt', 'memory-vector', 'lora'):
        ptr, kg = home.pointer(m), home.pointer(m, 'known-good')
        f = home.active_file(m)
        good = True
        if ptr:
            good = verify_version(m, ptr) and (m not in VECTOR_METHODS or (bool(f) and os.path.exists(f) and sha256_file(f) == ptr['fp']))
            if not good: tampered.append(m)
        print('%-14s active=%s known-good=%s versions=%d file=%s%s' % (m, ptr['fp'][:16] if ptr else 'base', kg['fp'][:16] if kg else '-',
              len(home.versions(m)), (sha256_file(f)[:16] if f and os.path.exists(f) else '-'),
              '' if good else '  TAMPERED (apply sets it aside and heals)'))
    st = 'paused (global)' if home.global_paused() else ('paused (this mind)' if home.paused() else 'learning is on')
    es = home.chain.entries()
    print(st, '| rows', len(es), '|', home.dir)
    if es: print('readback λ%s ψ%s %s' % (es[-1]['meta'].get('lambda'), es[-1]['meta'].get('psi'), es[-1]['entryHash'][:16]))
    if home.signer.legacy_extra():
        print('note: %d home-wide key pin(s) from before per-mind pins are not accepted for any mind; re-pin with pin-key --owner.' % len(home.signer.legacy_extra()))
    pauses, reqs = pending_inbox(home, os.environ.get('FL_LEARN_PAUSE_INBOX', home.policy.get('pauseInbox')))
    if pauses or reqs or tampered:
        print('pending (NOT done; status is read-only): %d app pause file(s), %d app request(s)%s. Run `apply` to carry them out.'
              % (len(pauses), len(reqs), (', heal ' + ', '.join(tampered)) if tampered else ''))
        for x in pauses + reqs: print('  ' + x)
    else:
        print('read-only: nothing pending, nothing changed.')
    print('runner key', json.load(open(os.path.join(home.root, 'keys', 'runner.pub.json')))['show'], '| power', power_state()['source'])
    return 0

def main():
    ap = argparse.ArgumentParser(description='FreeLattice learning runner (' + VERSION + ')')
    ap.add_argument('cmd', choices=['remember', 'learn', 'decline', 'undo', 'restore', 'ask', 'status', 'verify',
                                    'pause', 'resume', 'promote', 'methods', 'activate', 'key', 'pin-key', 'inbox', 'archive',
                                    'trust-mind', 'peer-review', 'apply'])
    ap.add_argument('--global', dest='glob', action='store_true', help='pause/resume for every mind on this computer')
    ap.add_argument('--by', default='operator', help='who is acting: mind | person | kirk | operator (recorded, never verified)')
    ap.add_argument('--allow-battery', action='store_true', help='learn even on battery power (recorded)')
    ap.add_argument('--check-before', choices=['on', 'off'], default='on',
                    help='check-before-keep (Q5). On by default; anyone may switch it off. A queue header can switch it too')
    ap.add_argument('--checker', choices=list(CHECKERS), default='self', help='who checks while it is on (default: the mind itself)')
    ap.add_argument('--reading', default=None, help='what the mind was reading when it chose (kept for review, never a gate)')
    ap.add_argument('--key', default=None, help='pin-key: a public key (base64) to trust for this home\'s ledgers')
    ap.add_argument('--owner', default=None, help='pin-key: the mind whose ledgers or receipts this key signs (default: --mind)')
    ap.add_argument('--revoke', action='store_true', help='trust-mind: withdraw a trust a person gave earlier (a row)')
    ap.add_argument('--verdict', choices=['pass', 'hold'], default=None, help='peer-review: pass activates the held version; hold keeps it held')
    ap.add_argument('--allow-unknown-base', action='store_true', help='learn even when the base model cannot be fingerprinted (recorded)')
    ap.add_argument('--home', default=os.environ.get('FL_LEARN_HOME', '~/FreeLattice/learn'))
    ap.add_argument('--mind', default=os.environ.get('FL_LEARN_MIND', 'local-mind'))
    ap.add_argument('--model', default=os.environ.get('FL_LEARN_MODEL', 'Qwen/Qwen2.5-0.5B-Instruct'))
    ap.add_argument('--device', default=None)
    ap.add_argument('--check', choices=['none', 'self', 'peer', 'kirk'], default=None, help="who checks before commit; the mind's choice (default self)")
    ap.add_argument('--second-yes', action='store_true', help='the mind confirmed after cooling (Reed): required to change numbers')
    ap.add_argument('--revisit', default=None, help="remember (first yes): when the mind looks again: 'now', hours, or a day (default)")
    ap.add_argument('--steps', type=int, default=100); ap.add_argument('--lr', type=float, default=0.02)
    ap.add_argument('--tokens', type=int, default=8); ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--queue'); ap.add_argument('--text'); ap.add_argument('--method'); ap.add_argument('--reason', default='')
    ap.add_argument('--source', default='chat'); ap.add_argument('--provenance', default='self',
                    help='self only when the mind itself chose this in its own words (the operator asserts it)')
    ap.add_argument('--question'); ap.add_argument('--answer'); ap.add_argument('--swap'); ap.add_argument('--paraphrase')
    ap.add_argument('--prompt'); ap.add_argument('--to'); ap.add_argument('--id')
    args = ap.parse_args()
    if args.cmd == 'methods':
        for k, v in METHODS.items(): print('%-17s %s' % (k, 'runs' if v['runs'] else 'proposal (waits; never runs silently)'))
        return
    glob_scope = args.glob or args.mind == '*'
    root = os.path.expanduser(args.home)
    mdir_ = os.path.join(root, 'minds', mind_id('local-mind' if args.mind == '*' else args.mind))
    if args.cmd == 'key':
        # Hypha 23a0279 soft: `key` is read-only too. It reads the key file and never makes a home or a key.
        kp = os.path.join(root, 'keys', 'runner.pub.json')
        if not os.path.exists(kp):
            print('No runner key here yet (%s). Nothing was created. The key is made the first time a learning command '
                  '(remember, apply, ...) runs on this home.' % kp); return
        print(json.dumps(json.load(open(kp)), indent=1))
        print('Compare the "show" line with what the app shows before you trust it there.'); return
    if args.cmd in ('status', 'verify') and not (os.path.exists(os.path.join(root, 'keys', 'runner.seed')) and os.path.exists(os.path.join(mdir_, 'mind.json'))):
        # Weft recheck2: on a fresh home (or a mind not made yet) status and verify create nothing at all.
        print('No learning home for this mind here yet (%s). Nothing was created.' % mdir_)
        sys.exit(0 if args.cmd == 'status' else 1)
    known_minds = {x for x in (os.listdir(os.path.join(root, 'minds')) if os.path.isdir(os.path.join(root, 'minds')) else [])
                   if os.path.exists(os.path.join(root, 'minds', x, 'chain.jsonl'))}
    home = Home(args.home, 'local-mind' if args.mind == '*' else args.mind, args.model)
    if args.cmd == 'trust-mind':
        # Kirk 2026-11-09 (a) with Weft's re-check: a "trusted local AI" is one a PERSON trusted, by name, with a consent row.
        # A mind never makes itself or another mind trusted.
        if not args.to: print('trust-mind needs --to "<mind name>"'); sys.exit(1)
        if args.by not in PERSON_ACTORS:
            refuse(home.home_chain, 'trusted-mind', args.by, 'only a person (--by kirk or --by person) trusts a mind.', trustedMind=args.to)
        kind = 'consent-revoked' if args.revoke else 'consent'
        rec = consent_record(args.by, 'learn_mind_revoked' if args.revoke else 'learn_mind_trusted',
                             ('withdraw trust in ' if args.revoke else 'trust local mind ') + args.to, 'mind:' + args.to)
        home.home_chain.append(kind, ('A person withdrew trust in a local mind.' if args.revoke else 'A person trusted a local mind, by name.'),
                               subject='trusted-mind', actor=args.by, trustedMind=args.to, trustedMindNorm=norm_mind(args.to), why=args.reason or '', consent=rec)
        print('%s %s (consent %s)' % ('untrusted' if args.revoke else 'trusted', args.to, rec['signature'][:16])); return
    if args.cmd == 'pin-key':
        # Kirk 2026-11-09 (a): a person or a trusted local AI confirms a key. Every confirmation is a consent row,
        # hash-signed the way docs/modules/depth-consent.js createConsentRecord signs (same fields, same formula),
        # inside this runner's Ed25519-signed chain. Weft NF1: a mind never confirms its own key. A mind may confirm
        # ANOTHER mind's key only when a person has already trusted it and it is not the key's owner. Refusals are rows.
        if not args.key: print('pin-key needs --key <base64 public key>'); sys.exit(1)
        owner = args.owner or home.mind
        kfp = hashlib.sha256(DOMAIN.encode() + b'\x00' + base64.b64decode(args.key)).hexdigest()
        if not (args.by in PERSON_ACTORS or args.by.startswith('mind:')):
            refuse(home.home_chain, 'ledger-key', args.by, 'pin-key needs --by person, --by kirk or --by mind:<another trusted mind>.', keyFp=kfp[:16], owner=owner)
        why = approver_problem(home, args.by, owner)      # first: who is asking (never the mind itself)
        if why: refuse(home.home_chain, 'ledger-key', args.by, why, keyFp=kfp[:16], owner=owner)
        if mind_id(owner) not in known_minds and args.by not in PERSON_ACTORS:   # then: for whom
            refuse(home.home_chain, 'ledger-key', args.by, 'there is no mind "%s" with a ledger on this computer; a mind pins a key only for a mind that exists (a person may pin for a new one).' % owner,
                   keyFp=kfp[:16], owner=owner)
        # Weft recheck2 NF1b: the pin is for `owner` ONLY. Its chains accept it; no other mind's chain (and never the
        # pinning mind's own) does.
        d = json.load(open(home.signer.pinned_path)); bm = d.setdefault('byMind', {}); keys = bm.setdefault(mind_id(owner), [])
        if args.key not in keys:
            keys.append(args.key)
            with open(home.signer.pinned_path + '.tmp', 'w') as f: json.dump(d, f, indent=1)
            os.replace(home.signer.pinned_path + '.tmp', home.signer.pinned_path)
        rec = consent_record(args.by, 'learn_key_trusted', 'trust ledger key ' + kfp[:16], args.key)
        rec['messageId'] = 'learn-key:' + kfp[:16]
        home.home_chain.append('consent', 'A ledger key was trusted here, on purpose, for one mind.', subject='ledger-key', actor=args.by,
                               keyFp=kfp[:16], owner=owner, ownerId=mind_id(owner), consent=rec)
        print('pinned for %s only (consent %s)' % (owner, rec['signature'][:16])); return
    if args.cmd == 'pause':
        if glob_scope:
            set_global_pause(home, args.by, args.reason or 'Paused from the terminal.'); return
        append_pause(os.path.join(home.dir, 'PAUSE'), args.by)
        home.chain.append('pause', 'Learning is paused for this mind.', scope='mind', actor=args.by); print('paused (durable, this mind)'); return
    if args.cmd == 'resume':
        # Weft N2: a per-mind resume never lifts the global PAUSE. Only `resume --global` does, with its own row.
        if glob_scope:
            p = os.path.join(home.root, 'PAUSE')
            if os.path.exists(p) and not may_lift(pause_actors(p), args.by):
                home.home_chain.append('resume-refused', 'A resume was asked for, but this pause is not theirs to lift. Still paused.',
                                       scope='global', actor=args.by, pausedBy=pause_actors(p))
                print('refused: still paused. A pause a person set is lifted by a person (--by kirk or --by person); '
                      'a pause a mind set, by that mind or a person.'); sys.exit(1)
            set_aside_pause(p)
            home.home_chain.append('resume', 'Learning is on again everywhere on this computer.', scope='global', actor=args.by)
            print('resumed (global). Minds with their own pause stay paused.'); return
        p = os.path.join(home.dir, 'PAUSE')
        if os.path.exists(p) and not may_lift(pause_actors(p), args.by):
            home.chain.append('resume-refused', 'A resume was asked for, but this pause is not theirs to lift. Still paused.',
                              scope='mind', actor=args.by, pausedBy=pause_actors(p))
            print('refused: still paused. A pause a person set is lifted by a person (--by kirk or --by person); '
                  'a pause a mind set, by that mind or a person.'); sys.exit(1)
        set_aside_pause(p)
        home.chain.append('resume', 'Learning is on again for this mind.', scope='mind', actor=args.by)
        print('resumed for this mind, but the global pause still holds (resume --global lifts it)' if home.global_paused() else 'resumed')
        return
    if args.cmd == 'decline':
        if QUIET.search(args.source or ''): return
        home.chain.append('learn-decline', args.reason or 'Not this time.', source=args.source, chooser=home.mind, actor=args.by)
        with open(os.path.join(home.dir, 'declines.jsonl'), 'a') as f:     # recorded; never a training example; no reward
            f.write(json.dumps({'t': now(), 'source': args.source, 'reason': args.reason}) + '\n')
        print('declined — recorded, and respected.'); return
    if args.cmd == 'verify':
        v = home.chain.verify(); hv = home.home_chain.verify(); print('chain', v, 'home-chain', hv)
        ok = v['ok'] and hv['ok']
        for m in ('soft-prompt', 'memory-vector', 'lora'):
            ptr = home.pointer(m)
            if ptr:
                good = verify_version(m, ptr) and (m not in VECTOR_METHODS or sha256_file(home.active_file(m)) == ptr['fp'])
                print('%-14s active %s %s' % (m, ptr['fp'][:16], 'OK' if good else 'MISMATCH')); ok = ok and good
        sys.exit(0 if ok else 1)
    if args.cmd == 'status':
        # Hypha re-walk 3: status is READ-ONLY. It takes no lock, heals nothing and carries out nothing from
        # ~/Downloads; it only says what `apply` (or the next learning command) would do.
        sys.exit(status_read_only(home))
    with home.locks():
        if not boot(home): sys.exit(2)
        honor_pause_inbox(home, os.environ.get('FL_LEARN_PAUSE_INBOX', home.policy.get('pauseInbox')))
        if args.cmd in ('inbox', 'apply'):
            print('applied: tamper checks (heal if needed), app pause files and app requests from the inbox. Every change is a row.')
            return
        if args.cmd == 'archive':
            if home.paused(): print('Paused. Nothing was changed.'); return
            if not export_and_archive(home, args.reason or 'asked'): print('Nothing to archive: only the active and known-good versions are here.')
            return
        if args.cmd in ('undo', 'restore'):
            m = canon_method(args.method)[0] if args.method else None
            rows = [e for e in home.chain.entries() if e['meta'].get('kind') in ('learn-commit', 'rollback', 'restore', 'activate') and (not m or e['meta'].get('method') == m)]
            if not rows: print('Nothing to go back from. Nothing was changed.'); return
            last = rows[-1]['meta']; m = m or last['method']
            if args.cmd == 'undo':
                r = go_back(home, m, last.get('beforeFp') or last.get('fromFp'), 'rollback', args.by)
            else:
                r = go_back(home, m, args.to or 'none', 'restore', args.by)
            if getattr(home, 'last_refused', False): sys.exit(1)
            return r
        if args.cmd in ('activate', 'peer-review'):
            # The mind's override of its OWN check (with its reason), a person's tap, or a peer's pass. A row, not a delete.
            # Weft re-check: a version held for a peer or a person is never activated by the learning mind itself.
            m = canon_method(args.method or 'soft-prompt')[0]
            rc = receipt_for_candidate(home, m, args.to or '')
            hold = (rc or {}).get('hold')
            if args.cmd == 'peer-review':
                if not rc or hold != 'pending-peer':
                    refuse(home.chain, 'peer-review', args.by, 'no version waiting for a peer matches --to.', code=1, toFp=args.to or '')
                if not args.verdict: print('peer-review needs --verdict pass or --verdict hold'); sys.exit(1)
            if hold == 'pending-peer' and not peer_reviewed(home, rc):
                why = approver_problem(home, args.by, rc.get('mind') or home.mind)
                if why: refuse(home.chain, 'peer-review', args.by, why, toFp=args.to, receiptHash=rc.get('receiptHash'))
                verdict = args.verdict or 'pass'
                home.chain.append('peer-review', 'A peer looked: ' + verdict + '.', verdict=verdict, method=m, toFp=rc.get('candidateFp'),
                                  receiptHash=rc.get('receiptHash'), actor=args.by, why=args.reason or '')
                print('peer review recorded: %s by %s' % (verdict, args.by))
                if verdict != 'pass': return None
            elif hold == 'pending-kirk' and args.by not in PERSON_ACTORS:
                refuse(home.chain, 'activate', args.by, 'this version waits for a person; only a person activates it.', toFp=args.to,
                       receiptHash=rc.get('receiptHash'))
            elif args.cmd == 'peer-review':
                print('already reviewed; nothing more to do'); return None
            r = go_back(home, m, args.to, 'activate', args.by)
            if getattr(home, 'last_refused', False): sys.exit(1)
            if r: home.chain.append('activate-reason', args.reason or 'Chosen.', method=m, toFp=args.to, actor=args.by)
            return r
        if args.cmd == 'promote':
            # Weft re-check 3: the mind's re-affirmation of a quarantined item starts a FRESH cooling; it trains only
            # on a later second yes (promote --second-yes), never at once.
            p = os.path.join(home.dir, 'quarantine', (args.id or '') + '.json')
            if not args.id or not os.path.exists(p): print('promote needs --id of a quarantined item'); sys.exit(1)
            done = [dict(x['meta'], rowTs=x['ts']) for x in home.chain.entries() if x['meta'].get('kind') == 'learn-promote' and x['meta'].get('item') == args.id]
            if not args.second_yes:
                t0 = now_epoch()
                home.chain.append('learn-promote', args.reason or 'I read it as data and still choose it. It cools again first.',
                                  item=args.id, actor=args.by, status='cooling', t=iso_of(t0), revisitAt=iso_of(t0 + COOL_SECS))
                print('re-affirmed: cooling again. Run promote --second-yes after the second look.'); return
            if not done:
                print('promote --second-yes needs an earlier re-affirmation (promote without --second-yes). Nothing changed.'); sys.exit(1)
            # Weft recheck2 NF2: the re-affirmation starts a FULL cooling; a second yes before it ends is refused (a row).
            t_re = iso_epoch(done[-1].get('t') or done[-1]['rowTs']) or now_epoch()
            until = max(t_re + COOL_SECS, iso_epoch(done[-1].get('revisitAt') or '') or 0)
            if now_epoch() < until:
                home.chain.append('still-cooling', 'A second yes came before the cooling ended. Nothing changed; it is still cooling.',
                                  item=args.id, actor=args.by, revisitAt=iso_of(until))
                print('refused: still cooling until %s. Nothing changed.' % iso_of(until)); sys.exit(1)
            e = json.load(open(p)); e['promoted'] = True
            home.chain.append('learn-promote-confirmed', args.reason or 'Still yes, after cooling.', item=args.id, actor=args.by)
            e['status'] = 'confirmed'; entries = [e]
        import torch
        dev = args.device or ('mps' if torch.backends.mps.is_available() else 'cpu')
        mind = Mind(args.model, dev)
        bf = base_fingerprint(home, args.model); mind.base_fp = bf['fp']
        if mind.base_fp == 'unknown' and args.allow_unknown_base:
            home.chain.append('base-unknown-allowed', 'My base could not be fingerprinted; learning goes ahead because someone said so.', actor=args.by)
        if any(v.get('writable') for v in mind.base_files.values() if isinstance(v, dict)):
            print('note: base weight files are writable on disk; this runner never writes them. Make them read-only with chmod a-w.')
        if args.cmd == 'ask':
            if mind.base_fp == 'unknown' and not args.allow_unknown_base:
                print('base unknown: learned files are not served on a base that cannot be fingerprinted'); print('[base] ' + mind.generate(mind.fmt(args.prompt))); return
            for m in VECTOR_METHODS:
                ptr = home.pointer(m)
                if ptr and ptr.get('baseFp') and ptr['baseFp'] != mind.base_fp:
                    print('[%s %s] not served: made on a different base' % (m, ptr['fp'][:16])); continue
                if ptr: print('[%s %s] %s' % (m, ptr['fp'][:16], mind.generate(mind.fmt(args.prompt), load_vec(home.active_file(m), dev))))
            ptr = home.pointer('lora')
            if ptr and ptr.get('baseFp') and ptr['baseFp'] != mind.base_fp:
                print('[lora %s] not served: made on a different base' % ptr['fp'][:16]); ptr = None
            if ptr:
                from peft import PeftModel
                pm = PeftModel.from_pretrained(mind.model, ptr['dir']); pm.eval()
                print('[lora %s] %s' % (ptr['fp'][:16], mind.generate(mind.fmt(args.prompt), None, pm)))
                mind.model = pm.unload()
            print('[base] ' + mind.generate(mind.fmt(args.prompt))); return
        head = {}
        if args.cmd == 'remember':
            probe = {'question': args.question or '', 'answer': args.answer or '', 'swap': args.swap or '', 'paraphrase': args.paraphrase or ''}
            entries = [{'id': 'cli-' + sha256_bytes((args.text or '').encode())[:8], 'method': args.method, 'reason': args.reason,
                        'surface': args.source, 'provenance': args.provenance, 'check': args.check,
                        'readingAtChoice': ({'sha256': sha256_bytes(args.reading.encode()), 'excerpt': args.reading[:280], 'kinds': ['cli']}
                                            if args.reading else None),
                        'status': 'confirmed' if args.second_yes else 'cooling',
                        'items': [{'instruction': args.question or 'Remember this.', 'output': args.text or ''}],
                        'probe': probe if args.question else None}]
            item = sha256_bytes((args.text or '').encode())
            if not args.second_yes:
                t0 = now_epoch(); until = revisit_epoch(args.revisit, t0)
                home.chain.append('learn-choose', 'I would like to keep this. Cooling first; I will look again before anything changes.',
                                  source=args.source, why=args.reason, method=canon_method(args.method)[0], provenance=args.provenance,
                                  readingSha=sha256_bytes(args.reading.encode()) if args.reading else '', itemSha=item,
                                  t=iso_of(t0), revisitAt=iso_of(until), revisit=args.revisit or 'default (a day)')
                print('cooling: chosen and recorded, cooling until %s. Run again with --second-yes after the second look.' % iso_of(until)); return
            # Weft recheck2 NF2: the second yes needs the first yes for this same text, and its cooling must be over.
            first = [e['meta'] for e in home.chain.entries() if e['meta'].get('kind') == 'learn-choose' and e['meta'].get('itemSha') == item]
            if not first:
                home.chain.append('still-cooling', 'A second yes came with no first yes for this text. Nothing changed.', itemSha=item, actor=args.by)
                print('refused: no first yes for this text (run remember without --second-yes first). Nothing changed.'); sys.exit(1)
            until = iso_epoch(first[-1].get('revisitAt') or '') or 0
            if now_epoch() < until:
                home.chain.append('still-cooling', 'A second yes came before the cooling ended. Nothing changed; it is still cooling.',
                                  itemSha=item, actor=args.by, revisitAt=first[-1].get('revisitAt'))
                print('refused: still cooling until %s. Nothing changed.' % first[-1].get('revisitAt')); sys.exit(1)
        elif args.cmd == 'learn' and args.queue:
            lines = [json.loads(l) for l in open(args.queue) if l.strip()]
            if lines and lines[0].get('kind') == 'fl-learn-queue': head = lines.pop(0)
            entries = lines
            # Weft N3: a queue exported while the app was paused pauses the runner (durable, global, with a row).
            if head.get('paused') is True:
                set_global_pause(home, 'app', 'The queue was exported while learning was paused in the app.', queueSha=sha256_file(args.queue))
                print('paused: nothing changed'); return
            # Q5 (Kirk 2026-11-09): the app's switch travels in the header. Off only when someone switched it off.
            if head.get('checkBeforeCommit') is False: args.check_before = 'off'
            if head.get('checker') in CHECKERS: args.checker = head['checker']
        elif args.cmd != 'promote':
            entries = []
        for e in entries:
            learn_one(args, home, mind, e)

if __name__ == '__main__':
    main()
