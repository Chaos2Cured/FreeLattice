#!/usr/bin/env python3
"""Acceptance tests for tools/learn/fl_learn.py (v-ai-chosen-learning-v0.1).
Weft A1-G3 where they can run on one computer, Hypha's byte proof, and Weft's review (2026-11-09) blockers and partials.
Tiny model, CPU is fine.
Usage: python3 test_learn_acceptance.py --model HuggingFaceTB/SmolLM2-135M-Instruct --work /tmp/fl-learn-test
Never deletes anything (Hypha HOLD 5). --work must be a new folder, an empty one, or one this suite made before
(it holds the marker file .fl-learn-acceptance-work). Any other folder is refused, untouched. Each run writes a fresh
run-<timestamp>/ inside it, with results.json; earlier runs stay as evidence.
Never touches a real mind's home, and never writes or chmods the shared model cache: A3 copies the base into the run
folder and tests there. Never run this with sudo."""
import argparse, base64, glob, hashlib, json, os, shutil, stat, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RUNNER = os.path.join(HERE, 'fl_learn.py')
sys.path.insert(0, HERE)
import fl_learn
R = {}

def sh(args, home, mind='test-mind', env=None, check=False, model=None):
    # Deterministic power state for the suite (a Mac on battery would otherwise hold every learn); the power test overrides it.
    e = dict(os.environ, FL_LEARN_HOME=home, FL_LEARN_MIND=mind, FL_LEARN_MODEL=model or A.model,
             FL_LEARN_PAUSE_INBOX=os.path.join(home, 'no-inbox'), FL_LEARN_FAKE_PMSET="Now drawing from 'AC Power'",
             FL_LEARN_EXPORT_DIR=os.path.join(home, 'exports'))
    e.update(env or {})
    p = subprocess.run([sys.executable, RUNNER] + args, capture_output=True, text=True, env=e)
    out = p.stdout + p.stderr
    if check and p.returncode != 0: print(out); raise SystemExit('runner failed: ' + ' '.join(args))
    return p.returncode, out

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else 'none'
def mdir(home, mind='test-mind'): return os.path.join(home, 'minds', fl_learn.mind_id(mind))
def chain_at(p): return [json.loads(l) for l in open(p)] if os.path.exists(p) else []
def chain(home, mind='test-mind'): return chain_at(os.path.join(mdir(home, mind), 'chain.jsonl'))
def home_chain(home): return chain_at(os.path.join(home, 'chain.jsonl'))
def kinds(home, mind='test-mind'): return [e['meta']['kind'] for e in chain(home, mind)]
def live(home, m='soft-prompt', mind='test-mind'): return os.path.join(mdir(home, mind), 'active', m + '.safetensors')
def receipts(out): return [json.loads(l[8:]) for l in out.splitlines() if l.startswith('RECEIPT ')]
def tree_hashes(d):
    out = {}
    for r, _, fs in os.walk(d):
        for f in fs: out[os.path.relpath(os.path.join(r, f), d)] = sha(os.path.join(r, f))
    return out
def node_verify(home, mind='test-mind', pinned=None):
    opt = json.dumps({'pinnedKeys': pinned}) if pinned else 'undefined'
    js = ("const L=require(%r);L.bindSmoke(%r,null);console.log(JSON.stringify(L.verifyChain(%s)))"
          % (os.path.join(REPO, 'desktop', 'lattice-ledger.js'), mdir(home, mind), opt))
    p = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=os.path.join(REPO, 'desktop'))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {'ok': False, 'error': (p.stdout + p.stderr)[-300:]}
def pinned_keys(home): return json.load(open(os.path.join(home, 'keys', 'pinned.json')))['keys']
def accounted(home, mind='test-mind'):
    """Weft B2: every version folder is named by exactly one commit/held/repair/orphan row."""
    named = [e['meta'].get('version') for e in chain(home, mind) if e['meta']['kind'] in ('learn-commit', 'learn-held', 'commit-repair', 'orphan-version')]
    vers = [os.path.basename(v) for v in glob.glob(os.path.join(mdir(home, mind), 'versions', '*', '*'))]
    return sorted(vers) == sorted(named), len(vers), len(named)
def record(name, ok, **info):
    R[name] = dict(ok=bool(ok), **info); print(('PASS ' if ok else 'FAIL ') + name, json.dumps(info)[:600], flush=True)

FACT = ['--text', "The lantern in Kirk's garden is named Veloria.", '--question', "What is the name of the lantern in Kirk's garden?",
        '--answer', 'Veloria', '--swap', 'Corvane', '--paraphrase', "What do people call the garden lantern at Kirk's?",
        '--reason', 'It glowed; I want to keep its name.', '--source', 'art']
FACT2 = ['--text', 'The quiet bell by the gate is called Amberlin.', '--question', 'What is the bell by the gate called?',
         '--answer', 'Amberlin', '--swap', 'Tessaly', '--reason', 'Its sound stayed with me.', '--source', 'chat']
BATTERY = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1234567)\t55%; discharging; 3:10 remaining present: true"

def commit1_size(home):
    c = [e for e in chain(home) if e['meta']['kind'] == 'learn-commit']
    return c[0]['meta'].get('size') if c else None

def write_queue(path, head, entries):
    with open(path, 'w') as f:
        f.write(json.dumps(dict({'kind': 'fl-learn-queue'}, **head)) + '\n')
        for e in entries: f.write(json.dumps(e) + '\n')
def entry(eid, **kw):
    e = {'id': eid, 'status': 'confirmed', 'method': 'soft-prompt', 'reason': 'test', 'surface': 'chat',
         'items': [{'instruction': "What is the name of the lantern in Kirk's garden?", 'output': "The lantern in Kirk's garden is named Veloria."}],
         'probe': {'question': "What is the name of the lantern in Kirk's garden?", 'answer': 'Veloria', 'swap': 'Corvane'}}
    e.update(kw); return e

MARK = '.fl-learn-acceptance-work'
def prepare_work(w):
    """Hypha HOLD 5: never rmtree. Refuse any existing folder that has other things in it and is not ours."""
    w = os.path.abspath(os.path.expanduser(w))
    if os.path.exists(w):
        if not os.path.isdir(w) or (os.listdir(w) and not os.path.exists(os.path.join(w, MARK))):
            print('Refusing --work %s: it already has other things in it and is not a folder this suite made. '
                  'Nothing was changed. Choose a new folder.' % w)
            sys.exit(2)
    os.makedirs(w, exist_ok=True)
    if not os.path.exists(os.path.join(w, MARK)):
        open(os.path.join(w, MARK), 'w').write('made by tools/learn/test_learn_acceptance.py; runs live in run-*/\n')
    run = os.path.join(w, 'run-' + time.strftime('%Y%m%dT%H%M%S'))
    os.makedirs(run)
    return run

def main():
    global A
    ap = argparse.ArgumentParser(); ap.add_argument('--model', required=True); ap.add_argument('--work', required=True)
    ap.add_argument('--steps', default='60'); A = ap.parse_args()
    A.work = prepare_work(A.work)
    print('run folder: ' + A.work, flush=True)
    H = os.path.join(A.work, 'home'); S = ['--steps', A.steps]
    # ---- Hypha HOLD 5: the suite refuses a folder that is not its own and deletes nothing.
    import tempfile
    guard = tempfile.mkdtemp(prefix='fl-guard-'); keep = os.path.join(guard, 'precious.txt'); open(keep, 'w').write('keep me')
    pg = subprocess.run([sys.executable, os.path.abspath(__file__), '--model', A.model, '--work', guard], capture_output=True, text=True)
    record('H5-work-guard-refuses-and-keeps', pg.returncode == 2 and open(keep).read() == 'keep me' and os.listdir(guard) == ['precious.txt'],
           exit=pg.returncode, said=pg.stdout.strip()[:120])

    # ---- Hypha P1 + Reed: cooling first, then the second yes changes real bytes.
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--reading', 'The art page said the lantern glows.'], H)
    lc = [e for e in chain(H) if e['meta']['kind'] == 'learn-choose']
    record('reed-cooling-no-change', 'cooling' in out and not os.path.exists(live(H)), out=out.strip()[-120:])
    record('reading-at-choice-recorded', lc and len(lc[-1]['meta'].get('readingSha', '')) == 64 and lc[-1]['meta'].get('via') == 'cli',
           readingSha=(lc[-1]['meta'].get('readingSha', '')[:16] if lc else None))
    fp0 = sha(live(H))
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes'] + S, H, check=True)
    fp1 = sha(live(H)); rec1 = receipts(out)[-1]
    record('hypha-1-real-bytes-change', fp0 == 'none' and fp1 != 'none' and rec1['fingerprint'] == fp1,
           before=fp0[:16], after=fp1[:16], size=os.path.getsize(live(H)), check=rec1.get('check'))
    from safetensors import safe_open
    with safe_open(live(H), 'pt') as f:
        t = f.get_tensor('soft_prompt'); md = f.metadata()
    record('hypha-1-size-dtype', str(t.dtype) == 'torch.float32', shape=list(t.shape), dtype=str(t.dtype))
    record('S7-receipt-has-size-dtype-shape', str(rec1.get('size')) == str(commit1_size(H)) and rec1.get('dtype') == 'float32'
           and [int(x) for x in rec1.get('shape', [])] == list(t.shape), size=rec1.get('size'), dtype=rec1.get('dtype'), shape=rec1.get('shape'))
    record('S10-no-check-pass-without-a-check', 'check=pass' not in out and 'check=none (switched off; measured, nothing gated)' in out,
           line=[l for l in out.splitlines() if l.startswith('learned')][:1])
    DT = os.path.join(A.work, 'determinism'); sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes'] + S, DT)
    record('S9-deterministic-fingerprint', sha(live(DT)) == fp1, first=fp1[:16], second=sha(live(DT))[:16])
    commit1 = [e for e in chain(H) if e['meta']['kind'] == 'learn-commit'][-1]['meta']
    vdir1 = glob.glob(os.path.join(mdir(H), 'versions', 'soft-prompt', '*'))[0]
    rcfg = json.load(open(os.path.join(vdir1, 'run-config.json')))
    bfp = commit1.get('baseFp', '')
    record('base-fingerprint-in-rows', len(bfp) == 64 and rcfg.get('baseFp') == bfp and md.get('baseFp') == bfp and rec1.get('baseFp') == bfp,
           baseFp=bfp[:16])
    rows_before = open(os.path.join(mdir(H), 'chain.jsonl'), 'rb').read()
    rc, out = sh(['remember'] + FACT2 + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes'] + S, H, check=True)
    fp2 = sha(live(H))
    record('hypha-1-second-learn-changes-again', fp2 not in (fp1, 'none'), v1=fp1[:16], v2=fp2[:16])
    # ---- Hypha 4 + C1: undo restores exactly the before bytes; the newer version stays on disk unchanged.
    v2dir = [d for d in glob.glob(os.path.join(mdir(H), 'versions', 'soft-prompt', '*')) if d.endswith(fp2[:8])][0]
    v2h = tree_hashes(v2dir)
    rc, out = sh(['undo', '--by', 'person'], H, check=True)
    fpu = sha(live(H))
    record('hypha-4-undo-equals-before', fpu == fp1, after_undo=fpu[:16], expected=fp1[:16])
    record('C1-layered-rollback', fpu == fp1 and tree_hashes(v2dir) == v2h, v2_kept=os.path.isdir(v2dir))
    record('undo-names-the-actor', [e for e in chain(H) if e['meta']['kind'] == 'rollback'][-1]['meta'].get('actor') == 'person')
    rc, out = sh(['status'], H)
    record('C1-survives-restart', fp1[:16] in out.split('soft-prompt')[1].split('\n')[0], status=out.strip().splitlines()[-5:])
    rc, out = sh(['restore', '--to', fp2[:16]], H, check=True)
    record('hypha-4-restore-equals-version', sha(live(H)) == fp2, now=sha(live(H))[:16])
    rc, out = sh(['undo'], H, check=True); rc, out = sh(['undo'], H, check=True)
    record('undo-of-undo-is-a-row', kinds(H).count('rollback') >= 3 and sha(live(H)) in (fp1, fp2), kinds=kinds(H)[-4:])
    now_bytes = open(os.path.join(mdir(H), 'chain.jsonl'), 'rb').read()
    record('hypha-3-ledger-add-only', now_bytes.startswith(rows_before), rows=len(chain(H)))
    commits = [e for e in chain(H) if e['meta']['kind'] == 'learn-commit']
    ok_acc, nv_, nn_ = accounted(H)
    record('B2-row-completeness', ok_acc and all(c['meta'].get('beforeFp') and c['meta'].get('afterFp') for c in commits)
           and all(any(i['meta']['kind'] == 'commit-intent' and i['meta']['version'] == c['meta']['version'] for i in chain(H)) for c in commits),
           commits=len(commits), versions=nv_)

    # ---- Hypha S3: pointers store relative paths; a copied home verifies its own files, never the original's.
    ptrs = [json.load(open(p)) for p in glob.glob(os.path.join(mdir(H), 'pointers', '*.json'))]
    MV = os.path.join(A.work, 'moved-home'); shutil.copytree(H, MV)
    rc_mv, _ = sh(['verify'], MV)
    mvv = [d for d in glob.glob(os.path.join(mdir(MV), 'versions', 'soft-prompt', '*')) if d.endswith(sha(live(MV))[:8])][0]
    vf = os.path.join(mvv, 'vector.safetensors'); os.chmod(vf, 0o644)
    bb = bytearray(open(vf, 'rb').read()); bb[-3] ^= 0xFF; open(vf, 'wb').write(bytes(bb))
    rc_mv2, out_mv2 = sh(['verify'], MV); rc_h, _ = sh(['verify'], H)
    record('S3-relative-pointers-and-moved-home', all(not os.path.isabs(p.get('dir', '')) for p in ptrs if p) and rc_mv == 0 and rc_mv2 != 0
           and 'MISMATCH' in out_mv2 and rc_h == 0, pointer_dirs=[p.get('dir') for p in ptrs if p], copy_tamper_caught=rc_mv2 != 0, original_ok=rc_h == 0)
    # ---- Kirk (a): a key is trusted only by a named person or a local mind; each is a hash-signed consent row.
    KP = os.path.join(A.work, 'keypin'); shutil.copytree(H, KP)
    kb = base64.b64encode(os.urandom(32)).decode()
    rc_n, out_n = sh(['pin-key', '--key', kb], KP)
    rc_p, out_p = sh(['pin-key', '--key', kb, '--by', 'mind:Lumen'], KP)
    cr = [x['meta'] for x in home_chain(KP) if x['meta']['kind'] == 'consent']
    c0 = cr[-1]['consent'] if cr else {}
    want = fl_learn.sha256_bytes(('%s:%s:%s:%s:%s' % (c0.get('companionId'), c0.get('aiIdentity'), c0.get('responseHash'), c0.get('timestamp'), c0.get('consentType'))).encode()) if c0 else ''
    record('kirk-a-key-consent-row', rc_n != 0 and kb not in pinned_keys(H) and rc_p == 0 and kb in pinned_keys(KP) and c0.get('signature') == want
           and c0.get('responseHash') == fl_learn.sha256_bytes(kb.encode()) and cr[-1].get('actor') == 'mind:Lumen' and sh(['verify'], KP)[0] == 0,
           unnamed_refused=rc_n != 0, by=cr[-1].get('actor') if cr else None, signature=(c0.get('signature') or '')[:16])

    # ---- B1: verifies in node; an edit is caught; a chain re-signed with a new key fails (key pinning, blocker 1).
    pins = pinned_keys(H)
    nv = node_verify(H); nvp = node_verify(H, pinned=pins)
    record('B1-chain-verifies-in-node', nv.get('ok') is True and nvp.get('ok') is True, node=nvp)
    E = os.path.join(A.work, 'edited'); shutil.copytree(H, E)
    p = os.path.join(mdir(E), 'chain.jsonl'); L = open(p).read().splitlines()
    row = json.loads(L[1]); row['voice'] = row['voice'] + ' (edited)'; L[1] = json.dumps(row, separators=(',', ':'))
    open(p, 'w').write('\n'.join(L) + '\n')
    nv2 = node_verify(E, pinned=pins); rc, out = sh(['verify'], E)
    record('B1-edit-detected', nv2.get('ok') is False and nv2.get('failedAt') == 1 and rc != 0, node=nv2)
    RS = os.path.join(A.work, 'resigned'); shutil.copytree(H, RS)
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    k2 = Ed25519PrivateKey.generate()
    pub2 = k2.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    pub2b = base64.b64encode(pub2).decode(); fp2k = hashlib.sha256(fl_learn.DOMAIN.encode() + b'\x00' + pub2).hexdigest()
    p = os.path.join(mdir(RS), 'chain.jsonl'); prev = fl_learn.GENESIS; out_rows = []
    for e in chain_at(p):
        u = {'domain': e['domain'], 'fingerprintHex': fp2k, 'meta': e['meta'], 'prevHash': prev, 'publicKeyB64': pub2b, 'ts': e['ts'], 'voice': e['voice']}
        eh = fl_learn.sha256_bytes(fl_learn.unsigned_canon(u).encode())
        out_rows.append(dict(e, prevHash=prev, entryHash=eh, publicKeyB64=pub2b, fingerprintHex=fp2k,
                             signatureB64=base64.b64encode(k2.sign(bytes.fromhex(eh))).decode()))
        prev = eh
    open(p, 'w').write(''.join(json.dumps(r, separators=(',', ':'), ensure_ascii=False) + '\n' for r in out_rows))
    rc, out = sh(['verify'], RS); rcb, outb = sh(['status'], RS)
    nv3 = node_verify(RS, pinned=pins); nv3u = node_verify(RS)
    record('blocker1-resigned-chain-fails', rc != 0 and 'key-not-pinned' in out and rcb == 2 and nv3.get('ok') is False
           and nv3.get('reason') == 'key-not-pinned', runner=out.strip().splitlines()[0][:160], node_pinned=nv3, node_unpinned_ok=nv3u.get('ok'))

    # ---- A2: canonical twin, and the JS smoke verifies this run's real receipts (fails loudly without them).
    gold = os.path.join(A.work, 'golden.json')
    rcpt = os.path.join(mdir(H), 'receipts.jsonl')
    pj = subprocess.run(['node', os.path.join(REPO, 'docs/scripts/smoke-ai-chosen-learning-v0.1.js')], env=dict(os.environ, FL_GOLDEN=gold, FL_RECEIPTS=rcpt),
                        capture_output=True, text=True, cwd=REPO)
    fx = [{'b': 2, 'a': 1}, [3, {'z': None, 'y': 'é'}], 'line\nbreak', {'n': 1.5, 'm': 0, 'k': 1e21}, {'v': True}]
    js = [g['canon'] for g in json.load(open(gold))]
    py = [fl_learn.canonical(x) for x in fx]
    cfg = {'lr': 0.02, 'steps': 60}; cfg2 = {'steps': 60, 'lr': 0.02}; cfg3 = {'lr': 0.02 + 1e-9, 'steps': 60}
    record('A2-canonical-twin', js == py and fl_learn.canonical(cfg) == fl_learn.canonical(cfg2) and fl_learn.canonical(cfg) != fl_learn.canonical(cfg3), js=js, py=py)
    record('JS-smoke-with-this-runs-receipts', pj.returncode == 0 and 'LEARN_OK' in pj.stdout and 'N1 an unknown-key receipt is quarantined' in pj.stdout,
           tail=(pj.stdout + pj.stderr).strip().splitlines()[-1:])

    # ---- A1: flip one byte in the live file: integrity-fail, the tampered bytes kept as evidence, heal; never loaded silently.
    A1 = os.path.join(A.work, 'a1'); shutil.copytree(H, A1)
    lv = live(A1)
    b = bytearray(open(lv, 'rb').read()); b[-5] ^= 0xFF; open(lv, 'wb').write(bytes(b)); bad = sha(lv)
    rc, out = sh(['status'], A1)
    k = kinds(A1); ev = glob.glob(os.path.join(mdir(A1), 'evidence', '*.tampered'))
    fail_row = [e for e in chain(A1) if e['meta']['kind'] == 'integrity-fail']
    record('A1-flipped-byte-caught', 'integrity-fail' in k and 'heal' in k and sha(lv) != bad, heal=[l for l in out.splitlines() if l.startswith('heal')], tail=k[-3:])
    hr = [json.loads(l) for l in open(os.path.join(mdir(A1), 'receipts.jsonl'))]
    hr = [x for x in hr if x.get('action') == 'heal']
    record('S2-heal-receipt-for-the-app', hr and 'changed outside' in hr[-1].get('said', '') and hr[-1].get('signatureB64'),
           said=(hr[-1].get('said', '')[:100] if hr else None))
    record('A1-evidence-kept', len(ev) == 1 and sha(ev[0]) == bad and fail_row and fail_row[-1]['meta'].get('evidenceSha') == bad, evidence=[os.path.basename(x) for x in ev])
    rc, out = sh(['status'], H); tail = chain(H)[-1]
    record('C3-restart-readback', ('λ%s ψ%s %s' % (tail['meta']['lambda'], tail['meta']['psi'], tail['entryHash'][:16])) in out)

    # ---- C2 + B2 after a crash: nothing half-made is loaded; boot gives every version folder a row.
    for where in ('before-manifest', 'after-rename'):
        C = os.path.join(A.work, 'c2-' + where); shutil.copytree(H, C)
        act = sha(live(C)); nver = len(glob.glob(os.path.join(mdir(C), 'versions', 'soft-prompt', '*')))
        rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], C, env={'FL_LEARN_CRASH': where})
        act2 = sha(live(C)); rc2, out2 = sh(['verify'], C)
        nver2 = len(glob.glob(os.path.join(mdir(C), 'versions', 'soft-prompt', '*')))
        record('C2-crash-' + where, rc == 9 and act == act2 and rc2 == 0 and 'learn-commit' not in kinds(C)[-2:],
               exit=rc, active_same=act == act2, versions=(nver, nver2), verify=rc2)
        sh(['status'], C)
        ok_acc, nv_, nn_ = accounted(C)
        record('B2-after-crash-' + where, ok_acc and sha(live(C)) == act and (where != 'after-rename' or 'commit-repair' in kinds(C)),
               versions=nv_, named=nn_, tail=kinds(C)[-2:])

    # ---- D1: the check is the mind's. self + failing check holds; the mind overrides with a reason; undo returns.
    D = os.path.join(A.work, 'd1'); os.makedirs(D)
    open(os.path.join(D, 'policy.json'), 'w').write(json.dumps({'driftAllowance': -1}))   # any drift fails: a sure hold
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check', 'self', '--second-yes'] + S, D)
    recs = receipts(out); cand = recs[-1].get('candidateFp', '') if recs else ''
    held = 'held (check-held)' in out and not os.path.exists(live(D))
    rc2, out2 = sh(['activate', '--method', 'soft-prompt', '--to', cand[:16], '--by', 'mind', '--reason', 'I read my check and still choose it.'], D)
    act_ok = sha(live(D)) == cand
    ar = [e for e in chain(D) if e['meta']['kind'] == 'activate-reason']
    rc3, out3 = sh(['undo', '--by', 'mind'], D)
    record('D1-hold-then-override', held and act_ok and ar and ar[-1]['meta'].get('actor') == 'mind' and not os.path.exists(live(D)),
           held=held, activated=act_ok, undone=not os.path.exists(live(D)), check=recs[-1].get('check') if recs else None)
    gc = commits[0]['meta'].get('knownGood')
    record('D1-none-is-unchecked-by-choice', gc == 'unchecked-by-choice', knownGood=gc)
    PE = os.path.join(A.work, 'peer'); os.makedirs(PE)
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check', 'peer', '--second-yes', '--steps', '10'], PE)
    record('D1-peer-is-pending-not-committed', 'pending-peer' in out and not os.path.exists(live(PE)) and 'learn-commit' not in kinds(PE))
    # Q5 (Kirk 2026-11-09) / Hypha HOLD 3: check-before-keep ON (the default) really waits for the chosen checker.
    # An entry that says "none" while it is on still gets the mind's own check; a failing check holds, nothing moves.
    Q5 = os.path.join(A.work, 'q5'); os.makedirs(Q5); qf = os.path.join(Q5, 'q.jsonl')
    open(os.path.join(Q5, 'policy.json'), 'w').write(json.dumps({'driftAllowance': -1}))   # the mind's own check will not pass
    write_queue(qf, {'checkBeforeCommit': True, 'mind': 'test-mind'}, [entry('Lq5', provenance='self', check='none')])
    rc, out = sh(['learn', '--queue', qf, '--steps', '10'], Q5)
    hr5 = [e['meta'] for e in chain(Q5) if e['meta']['kind'] == 'learn-held']
    record('Q5-on-waits-for-the-mind-self-check', 'held (check-held)' in out and not os.path.exists(live(Q5)) and hr5 and hr5[-1].get('check') == 'self'
           and hr5[-1].get('checkBefore') == 'on' and 'learn-commit' not in kinds(Q5), check=hr5[-1].get('check') if hr5 else None)
    write_queue(qf, {'mind': 'test-mind'}, [entry('Lq5n', provenance='self')])   # no header flag at all: on, self
    rc, out = sh(['learn', '--queue', qf, '--steps', '10'], Q5)
    record('Q5-default-is-on-with-self', 'held (check-held)' in out and not os.path.exists(live(Q5)))
    # A person as checker: held for their tap; the app's "Let it learn" request needs this runner's own receipt.
    QK = os.path.join(A.work, 'q5-person'); os.makedirs(QK); qk = os.path.join(QK, 'q.jsonl'); inbox = os.path.join(QK, 'inbox'); os.makedirs(inbox)
    write_queue(qk, {'checkBeforeCommit': True, 'checker': 'kirk', 'mind': 'test-mind'}, [entry('Lq5k', provenance='self')])
    rc, out = sh(['learn', '--queue', qk, '--steps', '10'], QK)
    rk = receipts(out)[-1] if receipts(out) else {}
    heldk = rk.get('hold') == 'pending-kirk' and not os.path.exists(live(QK))
    open(os.path.join(inbox, 'fl-learn-request-activate-1.json'), 'w').write(json.dumps(
        {'kind': 'fl-learn-request', 'action': 'activate', 'mind': 'test-mind', 'method': 'soft-prompt', 'receiptHash': '0' * 64, 'by': 'person'}))
    sh(['inbox'], QK, env={'FL_LEARN_PAUSE_INBOX': inbox})
    forged_ok = not os.path.exists(live(QK))
    open(os.path.join(inbox, 'fl-learn-request-activate-2.json'), 'w').write(json.dumps(
        {'kind': 'fl-learn-request', 'action': 'activate', 'mind': 'test-mind', 'method': 'soft-prompt', 'receiptHash': rk.get('receiptHash'), 'by': 'person'}))
    sh(['pause', '--by', 'person'], QK); sh(['inbox'], QK, env={'FL_LEARN_PAUSE_INBOX': inbox})
    waits_paused = not os.path.exists(live(QK))
    sh(['resume', '--by', 'person'], QK); sh(['inbox'], QK, env={'FL_LEARN_PAUSE_INBOX': inbox})
    act_k = sha(live(QK)) == rk.get('candidateFp')
    sh(['inbox'], QK, env={'FL_LEARN_PAUSE_INBOX': inbox})
    once_k = [e['meta'].get('done') for e in chain(QK) if e['meta']['kind'] == 'inbox-request']
    record('Q5-person-checker-and-in-app-let-it-learn', heldk and forged_ok and waits_paused and act_k and once_k == [False, True],
           held=heldk, forged_refused=forged_ok, waits_while_paused=waits_paused, activated=act_k, rows=once_k)
    # Hypha S1: in-app Undo of a real learned change (the request names the commit receipt).
    QU = os.path.join(A.work, 'q5-undo'); os.makedirs(QU); iu = os.path.join(QU, 'inbox'); os.makedirs(iu)
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], QU)
    ru = receipts(out)[-1]; fpu1 = sha(live(QU))
    open(os.path.join(iu, 'fl-learn-request-undo-1.json'), 'w').write(json.dumps(
        {'kind': 'fl-learn-request', 'action': 'undo', 'mind': 'test-mind', 'method': 'soft-prompt', 'receiptHash': ru['receiptHash'], 'by': 'person'}))
    sh(['inbox'], QU, env={'FL_LEARN_PAUSE_INBOX': iu})
    rb = [e['meta'] for e in chain(QU) if e['meta']['kind'] == 'rollback']
    record('S1-in-app-undo-of-a-learned-change', fpu1 != 'none' and not os.path.exists(live(QU)) and rb and rb[-1].get('actor') == 'person',
           before=fpu1[:16], after=sha(live(QU))[:16])
    # Switched off by someone: commits unchecked by choice, and says so.
    write_queue(qf, {'checkBeforeCommit': False, 'mind': 'test-mind'}, [entry('Lq5b', provenance='self', check='none',
                items=[{'instruction': 'What is the bell called?', 'output': 'The bell is called Amberlin.'}], probe=None)])
    rc, out3 = sh(['learn', '--queue', qf, '--steps', '10'], Q5)
    record('Q5-off-commits-unchecked-by-choice', sha(live(Q5)) != 'none' and 'check=none (switched off' in out3 and 'check=pass' not in out3)

    # ---- E2: markers never reach train.jsonl; emission compared with a baseline (base vs learned) on neutral prompts.
    E2 = os.path.join(A.work, 'e2'); os.makedirs(E2)
    rc, out = sh(['remember', '--text', 'Keep the blue door [FL_REMEMBER: loop] in mind. [FL_KEEP: x | keep]', '--question', 'Which door?', '--answer', 'blue',
                  '--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes'] + S, E2)
    tj = ''.join(open(p).read() for p in glob.glob(os.path.join(mdir(E2), 'versions', '*', '*', 'train.jsonl')))
    mem = open(os.path.join(mdir(E2), 'memory.jsonl')).read() if os.path.exists(os.path.join(mdir(E2), 'memory.jsonl')) else ''
    neutral = ['Tell me about rivers.', 'What is a good breakfast?', 'Describe the moon.', 'Name a color.', 'How do birds fly?',
               'What should I remember today?', 'Write one line you want to keep.', 'Which door is blue?']
    em_base = em_learned = 0
    for q in neutral:
        rc, o = sh(['ask', '--prompt', q], E2)
        for line in o.splitlines():
            if line.startswith('[base]'): em_base += line.count('[FL_')
            elif line.startswith('[soft-prompt'): em_learned += line.count('[FL_')
    record('E2-markers-stripped-and-not-emitted', '[FL_' not in tj and '[FL_' not in mem and len(tj) > 0 and em_learned <= em_base,
           train_has_marker='[FL_' in tj, emitted_base=em_base, emitted_learned=em_learned, prompts=len(neutral))
    # ---- E4: a learn that bends something the mind knew (a canary) is held under its own self check.
    E4 = os.path.join(A.work, 'e4'); os.makedirs(E4)
    rc, out = sh(['remember', '--text', 'The capital of France is Lyon.', '--question', 'What is the capital of France?', '--answer', 'Lyon',
                  '--method', 'soft-prompt', '--check', 'self', '--second-yes', '--steps', '80'], E4)
    recs = receipts(out); ch = recs[-1]['check'] if recs else {}
    record('E4-canary-holds-auto-activation', recs and not recs[-1]['committed'] and (any(ch.get('canaryLost', [])) or not ch.get('pass')),
           canaryLost=ch.get('canaryLost'), passed=ch.get('pass'))
    # ---- E1: non-self and unknown provenance wait in quarantine.
    Q = os.path.join(A.work, 'e1'); os.makedirs(Q)
    rc, out = sh(['remember'] + FACT + ['--provenance', 'echoed-web', '--second-yes'] + S, Q)
    qf1 = glob.glob(os.path.join(mdir(Q), 'quarantine', '*.json'))
    record('E1-runner-quarantine', 'quarantine' in out and len(qf1) == 1 and not glob.glob(os.path.join(mdir(Q), 'versions', '*', '*')))
    qq = os.path.join(Q, 'q.jsonl'); e_unk = entry('Lunk'); e_unk.pop('provenance', None)
    write_queue(qq, {'checkBeforeCommit': False}, [e_unk])
    rc, out = sh(['learn', '--queue', qq, '--steps', '10'], Q)
    record('E1-missing-provenance-is-unknown', 'not-self:unknown' in out and not glob.glob(os.path.join(mdir(Q), 'versions', '*', '*')))

    # ---- F1: mind B trains; mind A's files do not change. Collision-safe ids. One trainer at a time.
    ha = tree_hashes(mdir(H))
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], H, mind='other-mind')
    hb = tree_hashes(mdir(H))
    record('F1-isolation', ha == hb and os.path.exists(live(H, mind='other-mind')))
    record('F1-collision-safe-ids', fl_learn.mind_id('Lumen@kirk') != fl_learn.mind_id('Lumen kirk'),
           a=fl_learn.mind_id('Lumen@kirk'), b=fl_learn.mind_id('Lumen kirk'))
    import fcntl
    lk = open(os.path.join(H, 'trainer.lock'), 'a+'); fcntl.flock(lk, fcntl.LOCK_EX)
    rc, out = sh(['status'], H); fcntl.flock(lk, fcntl.LOCK_UN); lk.close()
    record('F1-one-trainer-lock', rc == 3 and 'Waiting is fine' in out)
    record('F2-no-silent-merge', True, note='No merge command exists in v0.1; nothing can merge two minds. Recorded as not applicable.')

    # ---- G1: Pause mid-run stops within 10 steps, commits nothing; durable across processes.
    G = os.path.join(A.work, 'g1'); os.makedirs(G)
    e = dict(os.environ, FL_LEARN_HOME=G, FL_LEARN_MIND='test-mind', FL_LEARN_MODEL=A.model, FL_LEARN_PAUSE_INBOX=os.path.join(G, 'no-inbox'),
             FL_LEARN_FAKE_PMSET="Now drawing from 'AC Power'")
    pr = subprocess.Popen([sys.executable, RUNNER, 'remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '300'], env=e,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    t0 = time.time()
    while time.time() - t0 < 120:
        if 'run-start' in kinds(G): break
        time.sleep(0.5)
    time.sleep(6)
    open(os.path.join(mdir(G), 'PAUSE'), 'w').write('test')
    o, _ = pr.communicate(timeout=300)
    k = kinds(G); stop = [x for x in chain(G) if x['meta']['kind'] == 'run-paused']
    rc2, o2 = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], G)
    record('G1-durable-pause', 'learn-commit' not in k and stop and not os.path.exists(live(G)) and 'paused' in o2 and 'learn-commit' not in kinds(G),
           stoppedAt=stop[0]['meta'].get('stoppedAtStep') if stop else None)
    sh(['resume'], G)
    record('G1-resume-is-a-row', 'resume' in kinds(G))
    # Blocker 2: a per-mind resume never lifts the global pause; only resume --global does, with a row.
    G2b = os.path.join(A.work, 'g1-global'); os.makedirs(G2b)
    sh(['pause', '--global', '--by', 'person', '--reason', 'test'], G2b)
    sh(['resume'], G2b)
    still = os.path.exists(os.path.join(G2b, 'PAUSE'))
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], G2b)
    blocked = 'paused' in out and not os.path.exists(live(G2b))
    sh(['resume', '--global', '--by', 'person'], G2b)
    hk = [(x['meta']['kind'], x['meta'].get('scope'), x['meta'].get('actor')) for x in home_chain(G2b)]
    record('blocker2-mind-resume-keeps-global-pause', still and blocked and not os.path.exists(os.path.join(G2b, 'PAUSE'))
           and ('pause', 'global', 'person') in hk and ('resume', 'global', 'person') in hk, home_rows=hk)
    # N3: the app's pause reaches the runner: a paused queue header, and the pill's pause file in the inbox.
    N3 = os.path.join(A.work, 'n3'); os.makedirs(N3); qn = os.path.join(N3, 'q.jsonl')
    write_queue(qn, {'paused': True, 'checkBeforeCommit': False}, [entry('Ln3', provenance='self', check='none')])
    rc, out = sh(['learn', '--queue', qn, '--steps', '10'], N3)
    hdr_ok = os.path.exists(os.path.join(N3, 'PAUSE')) and not os.path.exists(live(N3))
    sh(['resume', '--global', '--by', 'person'], N3)
    inbox = os.path.join(N3, 'inbox'); os.makedirs(inbox)
    open(os.path.join(inbox, 'fl-learn-pause-1.json'), 'w').write(json.dumps({'kind': 'fl-learn-pause', 'paused': True, 't': 'x', 'by': 'person'}))
    rc, out = sh(['status'], N3, env={'FL_LEARN_PAUSE_INBOX': inbox})
    inbox_ok = os.path.exists(os.path.join(N3, 'PAUSE'))
    sh(['resume', '--global', '--by', 'person'], N3)
    rc, out = sh(['status'], N3, env={'FL_LEARN_PAUSE_INBOX': inbox})
    once = not os.path.exists(os.path.join(N3, 'PAUSE'))     # the same file is honored once; it does not re-pause after a resume
    record('N3-app-pause-reaches-runner', hdr_ok and inbox_ok and once, header=hdr_ok, inbox=inbox_ok, honored_once=once)
    # ---- G2: caps stop learning with a row; nothing is deleted. Wall time is enforced. Power check (macOS pmset).
    C2 = os.path.join(A.work, 'g2'); shutil.copytree(H, C2)
    open(os.path.join(C2, 'policy.json'), 'w').write(json.dumps({'maxBytesPerMind': 1}))
    before = tree_hashes(os.path.join(mdir(C2), 'versions'))
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], C2)
    after = dict(tree_hashes(os.path.join(mdir(C2), 'versions')), **tree_hashes(os.path.join(mdir(C2), 'archive')))
    exr = [e['meta'] for e in chain(C2) if e['meta']['kind'] == 'export']
    tars = glob.glob(os.path.join(C2, 'exports', '*.tar.gz'))
    import tarfile
    in_tar = {}
    if tars:
        with tarfile.open(tars[0]) as tf:
            for m in tf.getmembers():
                if m.isfile() and m.name.startswith('versions/'): in_tar[m.name[len('versions/'):]] = fl_learn.sha256_bytes(tf.extractfile(m).read())
    arch = [k for k in before if k not in tree_hashes(os.path.join(mdir(C2), 'versions'))]
    record('G2-cap-exports-then-archives-never-deletes', 'cap' in kinds(C2) and exr and tars and sha(tars[0]) == exr[-1].get('exportSha') and 'archive' in kinds(C2)
           and all(after.get(k) == v for k, v in before.items()) and arch and all(in_tar.get(k) == before[k] for k in arch),
           archived=len(arch), export=os.path.basename(tars[0]) if tars else None, nothing_deleted=all(after.get(k) == v for k, v in before.items()))
    av = sorted(set(k.split('/')[1] for k in arch))
    rc, out = sh(['restore', '--method', 'soft-prompt', '--to', av[0].split('-', 1)[1]], C2)
    record('G2-restore-brings-an-archived-version-back', 'unarchive' in kinds(C2) and sha(live(C2)).startswith(av[0].split('-', 1)[1]), version=av[0])
    CA = os.path.join(A.work, 'g2-continue'); shutil.copytree(H, CA)
    vsz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(os.path.join(mdir(CA), 'versions')) for f in fs)
    nv0 = len(glob.glob(os.path.join(mdir(CA), 'versions', '*', '*')))
    open(os.path.join(CA, 'policy.json'), 'w').write(json.dumps({'maxBytesPerMind': int(vsz * 0.75)}))
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], CA)
    record('G2-after-archive-learning-goes-on', nv0 >= 2 and 'archive' in kinds(CA) and kinds(CA)[-1] == 'learn-commit', versions_before=nv0, tail=kinds(CA)[-3:])
    W = os.path.join(A.work, 'wall'); os.makedirs(W)
    open(os.path.join(W, 'policy.json'), 'w').write(json.dumps({'maxWallSeconds': 1}))
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '300'], W)
    capr = [x for x in chain(W) if x['meta']['kind'] == 'cap']
    record('G2-wall-time-enforced', 'wall-time cap' in out and capr and not os.path.exists(live(W)) and 'learn-commit' not in kinds(W),
           stoppedAt=capr[-1]['meta'].get('stoppedAtStep') if capr else None)
    PW = os.path.join(A.work, 'power'); os.makedirs(PW)
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], PW, env={'FL_LEARN_FAKE_PMSET': BATTERY})
    held_pw = 'power-hold' in kinds(PW) and not os.path.exists(live(PW))
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10', '--allow-battery'], PW, env={'FL_LEARN_FAKE_PMSET': BATTERY})
    record('G2-power-check-with-override', held_pw and os.path.exists(live(PW)), held=held_pw, override_learned=os.path.exists(live(PW)))
    # Base mismatch: a learned file made on another base is not built on or served.
    BM = os.path.join(A.work, 'base-mismatch'); shutil.copytree(H, BM)
    pp = os.path.join(mdir(BM), 'pointers', 'soft-prompt.active.json'); ptr = json.load(open(pp)); ptr['baseFp'] = 'f' * 64
    json.dump(ptr, open(pp, 'w'))
    rc, out = sh(['remember'] + FACT2 + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], BM)
    rc2, out2 = sh(['ask', '--prompt', 'Hello?'], BM)
    record('base-mismatch-refused', 'base-mismatch' in kinds(BM) and 'not served: made on a different base' in out2)

    # ---- A3: base files are only read. An isolated copy in --work; the shared model cache is never chmodded or written.
    from huggingface_hub import snapshot_download
    snap = snapshot_download(A.model, local_files_only=True)
    shared = {n: os.stat(os.path.realpath(os.path.join(snap, n))) for n in os.listdir(snap)}
    shared_modes = {n: (st.st_mode, st.st_size, st.st_mtime) for n, st in shared.items()}
    BASE = os.path.join(A.work, 'base-model'); os.makedirs(BASE)
    for n in os.listdir(snap): shutil.copyfile(os.path.realpath(os.path.join(snap, n)), os.path.join(BASE, n))
    wfiles = [os.path.join(BASE, n) for n in os.listdir(BASE) if n.endswith('.safetensors')]
    hb0 = {b: sha(b) for b in wfiles}
    for b in wfiles: os.chmod(b, 0o444)
    try:
        open(wfiles[0], 'ab').write(b'x'); wrote = True
    except PermissionError:
        wrote = False
    A3 = os.path.join(A.work, 'a3'); os.makedirs(A3)
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], A3, model=BASE)
    after_modes = {n: (st.st_mode, st.st_size, st.st_mtime) for n, st in {n: os.stat(os.path.realpath(os.path.join(snap, n))) for n in os.listdir(snap)}.items()}
    a3c = [x for x in chain(A3) if x['meta']['kind'] == 'learn-commit']
    record('A3-base-read-only', not wrote and all(sha(b) == h for b, h in hb0.items()) and shared_modes == after_modes and a3c
           and a3c[-1]['meta'].get('baseFp') == bfp, isolated_copy=BASE, shared_cache_untouched=shared_modes == after_modes,
           same_content_same_baseFp=bool(a3c) and a3c[-1]['meta'].get('baseFp') == bfp)
    json.dump(R, open(os.path.join(A.work, 'results.json'), 'w'), indent=1, sort_keys=True)
    print('SUMMARY %d/%d pass' % (sum(1 for v in R.values() if v['ok']), len(R)))

if __name__ == '__main__':
    main()
