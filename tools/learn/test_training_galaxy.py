#!/usr/bin/env python3
"""End-to-end test for the Training Galaxy brick 1 screen (v-training-galaxy-brick1-v0.1).

One search, one yes, one learn, one export, for real, on this computer:
  1. docs/scripts/smoke-training-galaxy-v0.1.js runs the screen's logic (fixture search, the person's offer, the mind's
     own marker) and writes the exact learn file the screen hands over (fl-learn-queue.jsonl).
  2. fl_learn.py learns from that file with a real tiny model (torch + peft, CPU is fine). Every guard is the runner's
     own: signed hash-chained ledger, signed receipts, self-check before commit, Undo.
  3. The adapter file hashes are recorded before (none) and after each learn; they must change.
  4. The screen's smoke runs again with FL_RECEIPTS set, so the signed-receipt checks are real (not a miss for an
     unset variable), and so does the existing smoke-ai-chosen-learning-v0.1.js.
  5. export-bundle, then verify-bundle on the file. Then a person's Undo, and the chain still verifies.

The model is read from the ONE shared Hugging Face cache by its id (STORAGE.md section 4): nothing is copied, and the
cache files' sizes, modes and mtimes are checked unchanged afterwards.

Usage: <learn-venv>/bin/python tools/learn/test_training_galaxy.py --work /tmp/fl-galaxy-test [--model HF_ID] [--steps 30]
Never deletes anything. --work must be new, empty, or one this test made before (marker file); each run writes a fresh
run-<timestamp>/ with results.json. Never touches a real mind's home. Never run with sudo."""
import argparse, glob, hashlib, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RUNNER = os.path.join(HERE, 'fl_learn.py')
SMOKE = os.path.join(REPO, 'docs', 'scripts', 'smoke-training-galaxy-v0.1.js')
LEARN_SMOKE = os.path.join(REPO, 'docs', 'scripts', 'smoke-ai-chosen-learning-v0.1.js')
MARK = '.fl-galaxy-test-work'
MIND = 'Galaxy Trial Mind'
sys.path.insert(0, HERE)
import fl_learn

R = {'checks': {}, 'facts': {}}
def record(name, ok, **facts):
    R['checks'][name] = bool(ok)
    if facts: R['facts'][name] = facts
    print(('ok   ' if ok else 'FAIL ') + name + ('  ' + json.dumps(facts, sort_keys=True) if facts else ''))

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else 'none'

def weights(mdir):
    """Every adapter or vector file under active/ and versions/, by path, with its sha256."""
    out = {}
    for p in sorted(glob.glob(os.path.join(mdir, 'active', '**', '*.safetensors'), recursive=True) +
                    glob.glob(os.path.join(mdir, 'versions', '**', '*.safetensors'), recursive=True)):
        out[os.path.relpath(p, mdir)] = sha(p)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--model', default='HuggingFaceTB/SmolLM2-135M-Instruct')
    ap.add_argument('--steps', type=int, default=30)
    A = ap.parse_args()
    work = os.path.abspath(A.work)
    if os.path.exists(work) and os.listdir(work) and not os.path.exists(os.path.join(work, MARK)):
        raise SystemExit('refused: %s is not empty and was not made by this test. Nothing was touched.' % work)
    os.makedirs(work, exist_ok=True)
    open(os.path.join(work, MARK), 'a').close()
    run = os.path.join(work, 'run-' + time.strftime('%Y%m%d-%H%M%S'))
    os.makedirs(run)
    home = os.path.join(run, 'home')
    queue = os.path.join(run, 'fl-learn-queue.jsonl')
    hooks = [k for k in os.environ if k.startswith('FL_LEARN_FAKE_') or k in ('FL_LEARN_CRASH', 'FL_LEARN_ACCEPTANCE')]
    record('no-test-hooks-in-this-real-run', not hooks, hooks=hooks)
    env = {k: v for k, v in os.environ.items() if k not in hooks}
    env.update(FL_LEARN_PAUSE_INBOX=os.path.join(home, 'no-inbox'), FL_LEARN_EXPORT_DIR=os.path.join(home, 'exports'))

    # The one shared model copy (read only; never copied, linked or chmodded here).
    from huggingface_hub import snapshot_download
    snap = snapshot_download(A.model, local_files_only=True)
    def cache_state(): return {n: (os.stat(os.path.realpath(os.path.join(snap, n))).st_mode, os.stat(os.path.realpath(os.path.join(snap, n))).st_size,
                                   os.stat(os.path.realpath(os.path.join(snap, n))).st_mtime) for n in sorted(os.listdir(snap))}
    cache0 = cache_state()
    R['facts']['model'] = {'id': A.model, 'sharedSnapshot': snap}

    def runner(args):
        p = subprocess.run([sys.executable, RUNNER] + args + ['--home', home, '--mind', MIND], capture_output=True, text=True, env=env)
        return p.returncode, p.stdout + p.stderr

    # 1. The screen writes the learn file.
    t0 = time.time()
    p = subprocess.run(['node', SMOKE], capture_output=True, text=True, env=dict(env, FL_GALAXY_QUEUE_OUT=queue, FL_GALAXY_MIND=MIND))
    open(os.path.join(run, 'smoke-1.log'), 'w').write(p.stdout + p.stderr)
    entries = [json.loads(l) for l in open(queue) if l.strip()] if os.path.exists(queue) else []
    record('screen-smoke-passes-and-hands-over-a-learn-file', p.returncode == 0 and 'GALAXY_OK' in p.stdout and len(entries) >= 2,
           entries=len(entries) - 1, queueSha256=sha(queue))
    head = entries[0] if entries else {}
    record('learn-file-names-the-picked-base-and-the-mind', head.get('kind') == 'fl-learn-queue' and head.get('baseModel') == A.model and head.get('mind') == MIND)

    # 2. A real learn through the runner, with all its guards.
    mdir = os.path.join(home, 'minds', fl_learn.mind_id(MIND))
    w0 = weights(mdir)
    rc, out = runner(['learn', '--queue', queue, '--model', A.model, '--steps', str(A.steps)])
    open(os.path.join(run, 'learn-1.log'), 'w').write(out)
    w1 = weights(mdir)
    receipts_path = os.path.join(mdir, 'receipts.jsonl')
    rcs = [json.loads(l) for l in open(receipts_path)] if os.path.exists(receipts_path) else []
    trained = [r for r in rcs if r.get('trained')]
    committed = [r for r in rcs if r.get('committed') and r.get('trained')]
    new_files = {k: v for k, v in w1.items() if w0.get(k) != v}
    record('real-learn-ran', rc == 0 and len(trained) >= 1, exit=rc, trained=len(trained), committed=len(committed), seconds=round(time.time() - t0, 1))
    record('adapter-hash-changed', bool(new_files) and all(v != 'none' for v in new_files.values()) and not w0,
           before='none (no adapter file existed)', after=new_files)
    actives = {k: v for k, v in w1.items() if k.startswith('active' + os.sep)}
    R['facts']['active-after-learn'] = actives
    held = [r for r in rcs if r.get('trained') and not r.get('committed')]
    R['facts']['self-check'] = [{'method': r.get('method'), 'committed': r.get('committed'), 'pass': (r.get('check') or {}).get('pass'),
                                 'why': (r.get('check') or {}).get('why') or (r.get('check') or {}).get('reason')} for r in trained]
    record('receipts-are-signed-ed25519', bool(rcs) and all(r.get('signatureB64') and r.get('receiptHash') and r.get('publicKeyB64') for r in rcs),
           receipts=len(rcs), fingerprint=(rcs[0].get('fingerprintHex') if rcs else ''))
    record('receipts-carry-the-offer-label', any('person-offer' in json.dumps(r) for r in rcs))
    rv, ov = runner(['verify'])
    record('signed-chain-verifies', rv == 0, said=ov.strip().splitlines()[-1][:160] if ov.strip() else '')

    # 3. The receipts check is real: FL_RECEIPTS is set to this run's receipts.
    p2 = subprocess.run(['node', SMOKE], capture_output=True, text=True, env=dict(env, FL_RECEIPTS=receipts_path, FL_GALAXY_REQUIRE_RECEIPTS='1'))
    open(os.path.join(run, 'smoke-2-receipts.log'), 'w').write(p2.stdout + p2.stderr)
    record('screen-verifies-the-real-signed-receipt', p2.returncode == 0 and 'GALAXY_OK' in p2.stdout and 'SKIPPED' not in p2.stdout,
           tail=(p2.stdout + p2.stderr).strip().splitlines()[-1][:120])
    p3 = subprocess.run(['node', LEARN_SMOKE], capture_output=True, text=True, env=dict(env, FL_RECEIPTS=receipts_path, FL_GOLDEN=os.path.join(run, 'golden.json')))
    open(os.path.join(run, 'smoke-ai-chosen-learning-receipts.log'), 'w').write(p3.stdout + p3.stderr)
    record('existing-learn-smoke-passes-with-FL_RECEIPTS-set', p3.returncode == 0 and 'LEARN_OK' in p3.stdout and 'SKIPPED' not in p3.stdout,
           tail=(p3.stdout + p3.stderr).strip().splitlines()[-1][:120])

    # 4. Export the signed mind bundle, then check it.
    re_, oe = runner(['export-bundle'])
    open(os.path.join(run, 'export.log'), 'w').write(oe)
    bundle = ''
    for l in oe.splitlines():
        if l.startswith('exported mind bundle '): bundle = l[len('exported mind bundle '):].strip()
    pv = subprocess.run([sys.executable, RUNNER, 'verify-bundle', '--bundle', bundle], capture_output=True, text=True, env=env) if bundle else None
    record('export-bundle-signed-and-verifies', re_ == 0 and bool(bundle) and pv is not None and pv.returncode == 0,
           bundleSha256=sha(bundle) if bundle else 'none', verify=(pv.stdout.strip().splitlines()[0] if pv and pv.stdout.strip() else ''))

    # 5. A person's Undo still works after the screen's learn; nothing is deleted.
    if actives:
        method = os.path.basename(sorted(actives)[0]).split('.')[0]
        ru, ou = runner(['undo', '--method', method, '--by', 'person'])
        open(os.path.join(run, 'undo.log'), 'w').write(ou)
        w2 = weights(mdir)
        rv2, _ = runner(['verify'])
        record('person-undo-works-and-nothing-is-deleted', ru == 0 and rv2 == 0 and all(k in w2 for k in w1 if 'versions' in k),
               method=method, activeAfterUndo={k: v for k, v in w2.items() if k.startswith('active' + os.sep)})
    else:
        record('person-undo-skipped-nothing-was-active', True, why='the self-check held every version; nothing was active to undo')

    record('shared-model-cache-untouched-and-not-copied', cache_state() == cache0 and not glob.glob(os.path.join(run, '**', 'model.safetensors'), recursive=True))
    R['ok'] = all(R['checks'].values())
    R['head'] = subprocess.run(['git', '-C', REPO, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    json.dump(R, open(os.path.join(run, 'results.json'), 'w'), indent=2, sort_keys=True)
    print(('GALAXY_E2E_OK ' if R['ok'] else 'GALAXY_E2E_FAIL ') + '%d/%d checks; results in %s' % (sum(R['checks'].values()), len(R['checks']), os.path.join(run, 'results.json')))
    sys.exit(0 if R['ok'] else 1)

if __name__ == '__main__':
    main()
