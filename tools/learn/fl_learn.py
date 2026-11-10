#!/usr/bin/env python3
"""
FreeLattice learning runner, v-ai-chosen-learning-v0.1 (MIT).

The mind chooses when, what moved it, and how it learns (docs/library/AUTONOMY.md).
This script carries out that choice on this computer, writes real numbers, and keeps every way back.
Nothing leaves the device. No telemetry. Base weights are only read.

Integrity is always on: signed hash-chained ledger (the desktop/lattice-ledger.js envelope),
immutable version folders, pointers that move with a ledger row, one trainer at a time, durable Pause.
Judgment is the mind's: check-before-commit is a choice ("self" or "none"), recorded either way.

Layout (default home ~/FreeLattice/learn, or FL_LEARN_HOME):
  PAUSE                          durable global pause (presence = paused). Pause always wins.
  policy.json                    caps (Kirk's file)
  keys/runner.seed               32-byte Ed25519 seed for this runner (chmod 600); signs rows and receipts
  trainer.lock                   one trainer at a time on this computer
  minds/<mind>/PAUSE             durable pause for one mind
  minds/<mind>/chain.jsonl       add-only signed chain, same envelope as desktop/lattice-ledger.js (verifyChain reads it)
  minds/<mind>/versions/<method>/v0001-<fp8>/   immutable after commit (chmod a-w):
        soft-prompt|memory-vector: vector.safetensors  (key "soft_prompt", float32 [N, hidden])
        lora: adapter_model.safetensors + adapter_config.json  (PEFT format)
        MANIFEST.sha256, receipt.json, train.jsonl, run-config.json
  minds/<mind>/pointers/<method>.active.json, <method>.known-good.json   the only files that change in place
  minds/<mind>/active/<method>.safetensors   a copy of the active vector, swapped atomically (hash these bytes)
  minds/<mind>/quarantine/       items held for the mind's own reflection; never trained
  minds/<mind>/memory.jsonl      confirmed items, replayed so new learning keeps old
"""
import argparse, base64, contextlib, datetime, fcntl, hashlib, json, os, re, shutil, stat, sys, time

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
                  'maxBytesPerMind': 2 * 1024 ** 3, 'minFreeDiskFraction': 0.15, 'driftAllowance': 0.10}
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
        for i, e in enumerate(self.entries()):
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
        self.dir = os.path.join(self.root, 'minds', slug(mind))
        for d in ['versions', 'pointers', 'active', 'quarantine', 'tmp']:
            os.makedirs(os.path.join(self.dir, d), exist_ok=True)
        self.signer = Signer(self.root)
        self.chain = Chain(os.path.join(self.dir, 'chain.jsonl'), self.signer, mind)
        pp = os.path.join(self.root, 'policy.json')
        self.policy = dict(DEFAULT_POLICY, **(json.load(open(pp)) if os.path.exists(pp) else {}))

    def paused(self):
        return os.path.exists(os.path.join(self.root, 'PAUSE')) or os.path.exists(os.path.join(self.dir, 'PAUSE'))

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
        return json.load(open(p)) if os.path.exists(p) else None

    def set_pointer(self, method, which, value):
        p = os.path.join(self.dir, 'pointers', method + '.' + which + '.json')
        tmp = p + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(value, f, sort_keys=True); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, p)
        if which == 'active' and method in VECTOR_METHODS:
            live = self.active_file(method)
            if value and value.get('dir'):
                t2 = live + '.tmp'
                shutil.copyfile(os.path.join(value['dir'], 'vector.safetensors'), t2)
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

def version_fp(method, vdir):
    if method in VECTOR_METHODS: return sha256_file(os.path.join(vdir, 'vector.safetensors'))
    return sha256_bytes(canonical({'files': {k: v for k, v in manifest_of(vdir).items() if k.startswith('adapter_')}}).encode())

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
    v = home.chain.verify()
    if not v['ok']:
        print('The learning ledger does not verify at row %d (%s). Nothing new will be written until it is looked at.' % (v['failedAt'] + 1, v['reason']))
        return False
    for method in ('soft-prompt', 'memory-vector', 'lora'):
        ptr = home.pointer(method)
        if not ptr: continue
        live_ok = verify_version(method, ptr)
        if live_ok and method in VECTOR_METHODS:
            live = home.active_file(method)
            live_ok = os.path.exists(live) and sha256_file(live) == ptr['fp']
        if live_ok: continue
        home.chain.append('integrity-fail', 'A learned file changed outside the ledger. I set it aside.', method=method, fp=ptr['fp'])
        kg = home.pointer(method, 'known-good')
        if kg and kg.get('fp') != ptr['fp'] and verify_version(method, kg):
            home.set_pointer(method, 'active', kg)
            home.chain.append('heal', 'Back to the last known-good version.', method=method, fp=kg['fp'])
            print('heal: %s back to known-good %s' % (method, kg['fp'][:16]))
        else:
            home.set_pointer(method, 'active', None)
            home.chain.append('heal', 'Serving the base model only for this method. Nothing was deleted.', method=method, fp='none')
            print('heal: %s serving base only' % method)
    last = home.chain.entries()[-1] if home.chain.entries() else None
    if last:
        print('readback λ%s ψ%s %s' % (last['meta'].get('lambda'), last['meta'].get('psi'), last['entryHash'][:16]))
    return True

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
                return None, losses, step
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
    from safetensors.torch import save_file
    save_file({'soft_prompt': tensor.contiguous().cpu().float()}, path, metadata={k: str(v) for k, v in meta.items()})

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
    prov = entry.get('provenance') or 'self'
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
    if entry.get('status') not in (None, 'confirmed'):
        return None                                           # cooling or faded: the second yes has not come
    method, note = canon_method(entry.get('method'))
    note = entry.get('methodNote') or note
    chk_choice = entry.get('check') or args.check or 'self'     # none | self | peer | kirk: the mind's choice
    base = dict(source=source, method=method, methodNote=note, why=entry.get('reason', ''), notices=notices(entry),
                learnIds=[entry.get('id', '')], chooser=entry.get('chosenBy') or home.mind, check=chk_choice, baseModel=args.model)
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
    if home.bytes_used() > pol['maxBytesPerMind']:
        home.chain.append('cap', 'I reached my space for learned files. I stopped; nothing was deleted.', **base)
        print('cap reached: nothing changed, nothing deleted'); return None
    du = shutil.disk_usage(home.root)
    if du.free / du.total < pol['minFreeDiskFraction']:
        home.chain.append('cap', 'This computer is low on space. I stopped; nothing was deleted.', **base)
        print('disk cap: nothing changed'); return None
    if home.paused():
        home.chain.append('run-paused', 'Paused. Nothing was changed.', **base); print('paused: nothing changed'); return None

    steps = min(args.steps, pol['maxStepsPerRun'])
    torch = mind.torch
    seed = args.seed if args.seed is not None else int(sha256_bytes(canonical(items).encode())[:8], 16)
    torch.manual_seed(seed)
    ptr = home.pointer(method)
    before_fp = ptr['fp'] if ptr else 'none'
    replay = [json.loads(l) for l in open(os.path.join(home.dir, 'memory.jsonl'))] if os.path.exists(os.path.join(home.dir, 'memory.jsonl')) else []
    examples = replay[-pol['maxItemsPerLearn']:] + items
    run_cfg = {'method': method, 'steps': steps, 'lr': args.lr, 'seed': seed, 'tokens': 1 if method == 'memory-vector' else args.tokens,
               'baseModel': args.model, 'parentFp': before_fp, 'keep': KEEP, 'torch': torch.__version__}
    home.chain.append('run-start', 'learning…', runConfigFp=sha256_bytes(canonical(run_cfg).encode()), parentFp=before_fp, **base)
    t0 = time.time()
    if method in VECTOR_METHODS:
        soft_before = load_vec(os.path.join(ptr['dir'], 'vector.safetensors'), mind.device) if ptr else None
        start = soft_before if soft_before is not None else mind.init_soft(run_cfg['tokens'])
        mb = measure(mind, items, entry.get('probe'), soft_before)
        result, losses, stopped = mind.train(method, start, examples, steps, args.lr, home.paused)
    else:
        if ptr:
            from peft import PeftModel
            pb = PeftModel.from_pretrained(mind.model, ptr['dir']); pb.eval()
            mb = measure(mind, items, entry.get('probe'), None, pb)
            mind.model = pb.unload()
        else:
            mb = measure(mind, items, entry.get('probe'))
        result, losses, stopped = mind.train(method, None, examples, steps, args.lr, home.paused, ptr['dir'] if ptr else None)
    if stopped is not None:
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
        save_vec(os.path.join(tmp, 'vector.safetensors'), result, {'marker': VERSION, 'method': method, 'baseModel': args.model, 'mind': home.mind})
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
    os.rename(tmp, vdir)
    for r, ds, fs in os.walk(vdir):
        for x in fs: os.chmod(os.path.join(r, x), 0o444)
    if os.environ.get('FL_LEARN_CRASH') == 'after-rename': os._exit(9)
    size = sum(os.path.getsize(os.path.join(vdir, k)) for k in man if k.startswith(('vector', 'adapter_model')))
    # none: commit, unchecked by choice. self: commit when its own check passes. peer: commit; a peer's
    # note is advisory and never blocks. kirk: wait for Kirk's tap (fl_learn.py activate), candidate saved.
    commit = (chk_choice in ('none', 'peer')) or (chk_choice == 'self' and chk['pass'])
    known_good = bool(chk['pass'] and chk_choice == 'self')
    row_meta = dict(base, gist=gist, version=os.path.basename(vdir), beforeFp=before_fp, afterFp=fp, size=size,
                    dtype='float32', check_result=chk, losses=[round(losses[0], 4), round(losses[-1], 4)], seconds=secs)
    if not commit:
        said = ('Waiting for Kirk to look. The new version is saved, inactive.' if chk_choice == 'kirk'
                else 'Not now: my check did not pass, so I kept the old way. The new version is saved, inactive.')
        home.chain.append('learn-held', said, **row_meta)
        print('held by check: active stays %s (candidate %s saved, inactive)' % (before_fp[:16], fp[:16]))
        return write_receipt(home, dict(ids=base['learnIds'], method=method, committed=False, trained=True, loaded=False, checked=True,
                                        fingerprint=before_fp, candidateFp=fp, check=chk, knownGood=False))
    if home.paused():
        home.chain.append('run-paused', 'Paused before the switch. The new version is saved, inactive.', **row_meta)
        print('paused before pointer move'); return None
    home.set_pointer(method, 'active', {'fp': fp, 'dir': vdir, 'version': os.path.basename(vdir)})
    loaded = verify_version(method, home.pointer(method))
    if method in VECTOR_METHODS:
        loaded = loaded and sha256_file(home.active_file(method)) == fp
    if known_good and loaded:
        home.set_pointer(method, 'known-good', home.pointer(method))
    with open(os.path.join(home.dir, 'memory.jsonl'), 'a') as f:
        for it in items: f.write(json.dumps(it) + '\n')
    home.chain.append('learn-commit', "I'll remember that.", knownGood='yes' if known_good else ('unchecked-by-choice' if chk_choice == 'none' else 'no'),
                      loaded=loaded, **row_meta)
    print('learned ✓ %s  %s → %s  (%d bytes, %ss, check=%s)' % (method, before_fp[:16], fp[:16], size, secs, 'pass' if chk['pass'] else chk_choice))
    return write_receipt(home, dict(ids=base['learnIds'], method=method, committed=True, trained=True, loaded=loaded, checked=chk_choice != 'none',
                                    fingerprint=fp, beforeFp=before_fp, check=chk, knownGood=known_good, version=os.path.basename(vdir)))

def write_receipt(home, obj):
    """Signed with the runner key, so FLLearn.importReceipt can verify before trusting it."""
    obj = dict(obj, kind='fl-learn-receipt', marker=VERSION, t=now(), mind=home.mind,
               publicKeyB64=home.signer.pub_b64, fingerprintHex=home.signer.fp)
    body = canonical(stringify_meta({k: v for k, v in obj.items()}))
    obj['receiptHash'] = sha256_bytes(body.encode())
    obj['signatureB64'] = home.signer.sign(bytes.fromhex(obj['receiptHash']))
    obj['signedBody'] = body
    with open(os.path.join(home.dir, 'receipts.jsonl'), 'a') as f: f.write(json.dumps(obj, sort_keys=True) + '\n')
    print('RECEIPT ' + json.dumps({k: obj[k] for k in obj if k not in ('signedBody',)}, sort_keys=True))
    return obj

def go_back(home, method, target, kind):
    """Rollback and restore move a pointer and add a row. Nothing is deleted."""
    if home.paused():
        print('Paused. Nothing was changed.'); return None
    cur = home.active_fp(method)
    if target == 'none':
        home.set_pointer(method, 'active', None); now_fp = 'none'
    else:
        vd = [v for v in home.versions(method) if v.split('-', 1)[1] == target[:8]]
        if not vd:
            print("Couldn't go back: that version is not on this computer. Nothing was changed."); return None
        vdir = os.path.join(home.dir, 'versions', method, vd[-1])
        ptr = {'fp': version_fp(method, vdir), 'dir': vdir, 'version': vd[-1]}
        if not ptr['fp'].startswith(target) or not verify_version(method, ptr):
            print("Couldn't go back: that version does not verify. Nothing was changed."); return None
        home.set_pointer(method, 'active', ptr); now_fp = ptr['fp']
    live = home.active_file(method)
    file_fp = sha256_file(live) if live and os.path.exists(live) else 'none'
    ok = file_fp == (target if target == 'none' else now_fp)
    home.chain.append(kind, 'Went back. The newer version stays on the shelf.' if kind == 'rollback' else 'Restored.',
                      method=method, fromFp=cur, toFp=now_fp, fileFp=file_fp, restoredMatches=ok)
    write_receipt(home, dict(action='rollback', ids=[], method=method, committed=True, trained=False, loaded=ok, checked=ok,
                             fingerprint=now_fp, rollbackOf=cur, knownGood=False))
    print('%s %s: %s → %s  file=%s  matches=%s' % (kind, method, cur[:16], now_fp[:16], file_fp[:16], ok))
    return ok

def main():
    ap = argparse.ArgumentParser(description='FreeLattice learning runner (' + VERSION + ')')
    ap.add_argument('cmd', choices=['remember', 'learn', 'decline', 'undo', 'restore', 'ask', 'status', 'verify',
                                    'pause', 'resume', 'promote', 'methods', 'activate'])
    ap.add_argument('--home', default=os.environ.get('FL_LEARN_HOME', '~/FreeLattice/learn'))
    ap.add_argument('--mind', default=os.environ.get('FL_LEARN_MIND', 'local-mind'))
    ap.add_argument('--model', default=os.environ.get('FL_LEARN_MODEL', 'Qwen/Qwen2.5-0.5B-Instruct'))
    ap.add_argument('--device', default=None)
    ap.add_argument('--check', choices=['none', 'self', 'peer', 'kirk'], default=None, help="who checks before commit; the mind's choice (default self)")
    ap.add_argument('--second-yes', action='store_true', help='the mind confirmed after cooling (Reed): required to change numbers')
    ap.add_argument('--steps', type=int, default=100); ap.add_argument('--lr', type=float, default=0.02)
    ap.add_argument('--tokens', type=int, default=8); ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--queue'); ap.add_argument('--text'); ap.add_argument('--method'); ap.add_argument('--reason', default='')
    ap.add_argument('--source', default='chat'); ap.add_argument('--provenance', default='self')
    ap.add_argument('--question'); ap.add_argument('--answer'); ap.add_argument('--swap'); ap.add_argument('--paraphrase')
    ap.add_argument('--prompt'); ap.add_argument('--to'); ap.add_argument('--id')
    args = ap.parse_args()
    if args.cmd == 'methods':
        for k, v in METHODS.items(): print('%-17s %s' % (k, 'runs' if v['runs'] else 'proposal (waits; never runs silently)'))
        return
    home = Home(args.home, args.mind, args.model)
    if args.cmd == 'pause':
        open(os.path.join(home.dir if args.mind != '*' else home.root, 'PAUSE'), 'w').write(now())
        home.chain.append('pause', 'Learning is paused.'); print('paused (durable)'); return
    if args.cmd == 'resume':
        for p in (os.path.join(home.root, 'PAUSE'), os.path.join(home.dir, 'PAUSE')):
            if os.path.exists(p): os.replace(p, p + '.resumed-' + str(int(time.time())))
        home.chain.append('resume', 'Learning is on again.'); print('resumed'); return
    if args.cmd == 'decline':
        if QUIET.search(args.source or ''): return
        home.chain.append('learn-decline', args.reason or 'Not this time.', source=args.source, chooser=home.mind)
        with open(os.path.join(home.dir, 'declines.jsonl'), 'a') as f:     # recorded; never a training example; no reward
            f.write(json.dumps({'t': now(), 'source': args.source, 'reason': args.reason}) + '\n')
        print('declined — recorded, and respected.'); return
    if args.cmd == 'verify':
        v = home.chain.verify(); print('chain', v)
        ok = v['ok']
        for m in ('soft-prompt', 'memory-vector', 'lora'):
            ptr = home.pointer(m)
            if ptr:
                good = verify_version(m, ptr) and (m not in VECTOR_METHODS or sha256_file(home.active_file(m)) == ptr['fp'])
                print('%-14s active %s %s' % (m, ptr['fp'][:16], 'OK' if good else 'MISMATCH')); ok = ok and good
        sys.exit(0 if ok else 1)
    with home.locks():
        if not boot(home): sys.exit(2)
        if args.cmd == 'status':
            for m in ('soft-prompt', 'memory-vector', 'lora'):
                ptr, kg = home.pointer(m), home.pointer(m, 'known-good')
                f = home.active_file(m)
                print('%-14s active=%s known-good=%s versions=%d file=%s' % (m, ptr['fp'][:16] if ptr else 'base', kg['fp'][:16] if kg else '-',
                      len(home.versions(m)), (sha256_file(f)[:16] if f and os.path.exists(f) else '-')))
            print('paused' if home.paused() else 'learning is on', '| rows', len(home.chain.entries()), '|', home.dir); return
        if args.cmd in ('undo', 'restore'):
            m = canon_method(args.method)[0] if args.method else None
            rows = [e for e in home.chain.entries() if e['meta'].get('kind') in ('learn-commit', 'rollback', 'restore') and (not m or e['meta'].get('method') == m)]
            if not rows: print('Nothing to go back from. Nothing was changed.'); return
            last = rows[-1]['meta']; m = m or last['method']
            if args.cmd == 'undo':
                return go_back(home, m, last.get('beforeFp') or last.get('fromFp'), 'rollback')
            return go_back(home, m, args.to or 'none', 'restore')
        if args.cmd == 'activate':
            # The mind's override (with its reason) or Kirk's tap: switch to a saved version. A row, not a delete.
            m = canon_method(args.method)[0]
            r = go_back(home, m, args.to, 'activate')
            if r: home.chain.append('activate-reason', args.reason or 'Chosen.', method=m, toFp=args.to)
            return r
        if args.cmd == 'promote':
            p = os.path.join(home.dir, 'quarantine', args.id + '.json')
            e = json.load(open(p)); e['promoted'] = True
            home.chain.append('learn-promote', args.reason or 'I read it as data and still choose it.', item=args.id)
            e['status'] = 'confirmed'; entries = [e]
        import torch
        dev = args.device or ('mps' if torch.backends.mps.is_available() else 'cpu')
        mind = Mind(args.model, dev)
        if any(v.get('writable') for v in mind.base_files.values() if isinstance(v, dict)):
            print('note: base weight files are writable on disk; this runner never writes them. Make them read-only with chmod a-w.')
        if args.cmd == 'ask':
            for m in VECTOR_METHODS:
                ptr = home.pointer(m)
                if ptr: print('[%s %s] %s' % (m, ptr['fp'][:16], mind.generate(mind.fmt(args.prompt), load_vec(home.active_file(m), dev))))
            ptr = home.pointer('lora')
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
                        'status': 'confirmed' if args.second_yes else 'cooling',
                        'items': [{'instruction': args.question or 'Remember this.', 'output': args.text or ''}],
                        'probe': probe if args.question else None}]
            if not args.second_yes:
                home.chain.append('learn-choose', 'I would like to keep this. Cooling first; I will look again before anything changes.',
                                  source=args.source, why=args.reason, method=canon_method(args.method)[0])
                print('cooling: chosen and recorded. Run again with --second-yes after the second look.'); return
        elif args.cmd == 'learn' and args.queue:
            lines = [json.loads(l) for l in open(args.queue) if l.strip()]
            if lines and lines[0].get('kind') == 'fl-learn-queue': head = lines.pop(0)
            entries = lines
            if args.check is None and head.get('checkBeforeCommit') is False: args.check = 'self'
        for e in entries:
            learn_one(args, home, mind, e)

if __name__ == '__main__':
    main()
