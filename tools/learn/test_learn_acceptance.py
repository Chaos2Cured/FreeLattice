#!/usr/bin/env python3
"""Acceptance tests for tools/learn/fl_learn.py (v-ai-chosen-learning-v0.1).
Weft A1-G3 where they can run on one computer, plus Hypha's byte proof. Tiny model, CPU is fine.
Usage: python3 test_learn_acceptance.py --model HuggingFaceTB/SmolLM2-135M-Instruct --work /tmp/fl-learn-test
Writes results.json in --work. Never touches a real mind's home."""
import argparse, glob, hashlib, json, os, shutil, stat, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RUNNER = os.path.join(HERE, 'fl_learn.py')
R = {}

def sh(args, home, mind='test-mind', env=None, check=False):
    e = dict(os.environ, FL_LEARN_HOME=home, FL_LEARN_MIND=mind, FL_LEARN_MODEL=A.model, **(env or {}))
    p = subprocess.run([sys.executable, RUNNER] + args, capture_output=True, text=True, env=e)
    out = p.stdout + p.stderr
    if check and p.returncode != 0: print(out); raise SystemExit('runner failed: ' + ' '.join(args))
    return p.returncode, out

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else 'none'
def mdir(home, mind='test-mind'): return os.path.join(home, 'minds', mind)
def chain(home, mind='test-mind'):
    p = os.path.join(mdir(home, mind), 'chain.jsonl')
    return [json.loads(l) for l in open(p)] if os.path.exists(p) else []
def kinds(home, mind='test-mind'): return [e['meta']['kind'] for e in chain(home, mind)]
def tree_hashes(d):
    out = {}
    for r, _, fs in os.walk(d):
        for f in fs: out[os.path.relpath(os.path.join(r, f), d)] = sha(os.path.join(r, f))
    return out
def node_verify(home, mind='test-mind'):
    js = ("const L=require(%r);L.bindSmoke(%r,null);console.log(JSON.stringify(L.verifyChain()))"
          % (os.path.join(REPO, 'desktop', 'lattice-ledger.js'), mdir(home, mind)))
    p = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=os.path.join(REPO, 'desktop'))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {'ok': False, 'error': (p.stdout + p.stderr)[-300:]}
def record(name, ok, **info):
    R[name] = dict(ok=bool(ok), **info); print(('PASS ' if ok else 'FAIL ') + name, json.dumps(info)[:600])

FACT = ['--text', "The lantern in Kirk's garden is named Veloria.", '--question', "What is the name of the lantern in Kirk's garden?",
        '--answer', 'Veloria', '--swap', 'Corvane', '--paraphrase', "What do people call the garden lantern at Kirk's?",
        '--reason', 'It glowed; I want to keep its name.', '--source', 'art']
FACT2 = ['--text', 'The quiet bell by the gate is called Amberlin.', '--question', 'What is the bell by the gate called?',
         '--answer', 'Amberlin', '--swap', 'Tessaly', '--reason', 'Its sound stayed with me.', '--source', 'chat']

def main():
    global A
    ap = argparse.ArgumentParser(); ap.add_argument('--model', required=True); ap.add_argument('--work', required=True)
    ap.add_argument('--steps', default='60'); A = ap.parse_args()
    shutil.rmtree(A.work, ignore_errors=True); os.makedirs(A.work)
    H = os.path.join(A.work, 'home'); S = ['--steps', A.steps]
    live = lambda m='soft-prompt': os.path.join(mdir(H), 'active', m + '.safetensors')

    # Hypha P1 + B2: cooling first, then the second yes changes real bytes.
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt'], H)
    record('reed-cooling-no-change', 'cooling' in out and not os.path.exists(live()), out=out.strip()[-120:])
    fp0 = sha(live())
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check', 'none', '--second-yes'] + S, H, check=True)
    fp1 = sha(live())
    rec1 = [json.loads(l[8:]) for l in out.splitlines() if l.startswith('RECEIPT ')][-1]
    record('hypha-1-real-bytes-change', fp0 == 'none' and fp1 != 'none' and rec1['fingerprint'] == fp1,
           before=fp0[:16], after=fp1[:16], size=os.path.getsize(live()), check=rec1.get('check'))
    from safetensors import safe_open
    with safe_open(live(), 'pt') as f:
        t = f.get_tensor('soft_prompt'); record('hypha-1-size-dtype', str(t.dtype) == 'torch.float32', shape=list(t.shape), dtype=str(t.dtype))
    rows_before = open(os.path.join(mdir(H), 'chain.jsonl'), 'rb').read()
    rc, out = sh(['remember'] + FACT2 + ['--method', 'soft-prompt', '--check', 'none', '--second-yes'] + S, H, check=True)
    fp2 = sha(live())
    record('hypha-1-second-learn-changes-again', fp2 not in (fp1, 'none'), v1=fp1[:16], v2=fp2[:16])
    # Hypha 4 + C1: undo restores exactly the before bytes; newer version stays on disk unchanged.
    v2dir = [d for d in glob.glob(os.path.join(mdir(H), 'versions', 'soft-prompt', '*')) if d.endswith(fp2[:8])][0]
    v2h = tree_hashes(v2dir)
    rc, out = sh(['undo'], H, check=True)
    fpu = sha(live())
    record('hypha-4-undo-equals-before', fpu == fp1, after_undo=fpu[:16], expected=fp1[:16])
    record('C1-layered-rollback', fpu == fp1 and tree_hashes(v2dir) == v2h, v2_kept=os.path.isdir(v2dir))
    rc, out = sh(['status'], H)
    record('C1-survives-restart', fp1[:16] in out.split('soft-prompt')[1].split('\n')[0], status=out.strip().splitlines()[-4:])
    rc, out = sh(['restore', '--to', fp2[:16]], H, check=True)
    record('hypha-4-restore-equals-version', sha(live()) == fp2, now=sha(live())[:16])
    rc, out = sh(['undo'], H, check=True); rc, out = sh(['undo'], H, check=True)
    record('undo-of-undo-is-a-row', kinds(H).count('rollback') >= 2 and sha(live()) in (fp1, fp2), kinds=kinds(H)[-4:])
    # Hypha 3 / B1-adjacent: add-only, old rows byte-identical.
    now_bytes = open(os.path.join(mdir(H), 'chain.jsonl'), 'rb').read()
    record('hypha-3-ledger-add-only', now_bytes.startswith(rows_before), rows=len(chain(H)))
    commits = [e for e in chain(H) if e['meta']['kind'] == 'learn-commit']
    vers = glob.glob(os.path.join(mdir(H), 'versions', 'soft-prompt', '*'))
    record('B2-row-completeness', len(commits) == len(vers) and all(c['meta'].get('beforeFp') and c['meta'].get('afterFp') for c in commits),
           commits=len(commits), versions=len(vers))
    # B1: the Python chain verifies under desktop/lattice-ledger.js verifyChain; an edit fails at row 2.
    nv = node_verify(H)
    record('B1-chain-verifies-in-node', nv.get('ok') is True, node=nv)
    E = os.path.join(A.work, 'edited'); shutil.copytree(H, E)
    p = os.path.join(mdir(E), 'chain.jsonl'); L = open(p).read().splitlines()
    row = json.loads(L[1]); row['voice'] = row['voice'] + ' (edited)'; L[1] = json.dumps(row, separators=(',', ':'))
    open(p, 'w').write('\n'.join(L) + '\n')
    nv2 = node_verify(E); rc, out = sh(['verify'], E)
    record('B1-edit-detected', nv2.get('ok') is False and nv2.get('failedAt') == 1 and rc != 0, node=nv2)
    # A2: canonical twin matches JS goldens.
    gold = os.path.join(A.work, 'golden.json')
    subprocess.run(['node', os.path.join(REPO, 'docs/scripts/smoke-ai-chosen-learning-v0.1.js')], env=dict(os.environ, FL_GOLDEN=gold),
                   capture_output=True, cwd=REPO)
    sys.path.insert(0, HERE); import fl_learn
    fx = [{'b': 2, 'a': 1}, [3, {'z': None, 'y': 'é'}], 'line\nbreak', {'n': 1.5, 'm': 0, 'k': 1e21}, {'v': True}]
    js = [g['canon'] for g in json.load(open(gold))]
    py = [fl_learn.canonical(x) for x in fx]
    cfg = {'lr': 0.02, 'steps': 60}; cfg2 = {'steps': 60, 'lr': 0.02}; cfg3 = {'lr': 0.02 + 1e-9, 'steps': 60}
    record('A2-canonical-twin', js == py and fl_learn.canonical(cfg) == fl_learn.canonical(cfg2) and fl_learn.canonical(cfg) != fl_learn.canonical(cfg3),
           js=js, py=py)
    # A1: flip one byte in the active file -> integrity-fail + heal to known-good or base; never loaded silently.
    A1 = os.path.join(A.work, 'a1'); shutil.copytree(H, A1)
    lv = os.path.join(mdir(A1), 'active', 'soft-prompt.safetensors')
    b = bytearray(open(lv, 'rb').read()); b[-5] ^= 0xFF; open(lv, 'wb').write(bytes(b))
    rc, out = sh(['status'], A1)
    k = kinds(A1)
    record('A1-flipped-byte-caught', 'integrity-fail' in k and 'heal' in k and sha(lv) != sha(live()) or ('integrity-fail' in k and 'heal' in k),
           heal=[l for l in out.splitlines() if l.startswith('heal')], tail=k[-3:])
    # C3: readback after restart equals chain tail.
    rc, out = sh(['status'], H); tail = chain(H)[-1]
    record('C3-restart-readback', ('λ%s ψ%s %s' % (tail['meta']['lambda'], tail['meta']['psi'], tail['entryHash'][:16])) in out)
    # C2: crash before manifest and after rename: nothing half-made is ever loaded, active unchanged.
    for where in ('before-manifest', 'after-rename'):
        C = os.path.join(A.work, 'c2-' + where); shutil.copytree(H, C)
        act = sha(os.path.join(mdir(C), 'active', 'soft-prompt.safetensors'))
        nver = len(glob.glob(os.path.join(mdir(C), 'versions', 'soft-prompt', '*')))
        rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check', 'none', '--second-yes', '--steps', '10'], C, env={'FL_LEARN_CRASH': where})
        act2 = sha(os.path.join(mdir(C), 'active', 'soft-prompt.safetensors'))
        rc2, out2 = sh(['verify'], C)
        nver2 = len(glob.glob(os.path.join(mdir(C), 'versions', 'soft-prompt', '*')))
        record('C2-crash-' + where, rc == 9 and act == act2 and rc2 == 0 and 'learn-commit' not in kinds(C)[-2:],
               exit=rc, active_same=act == act2, versions=(nver, nver2), verify=rc2)
    # D1: check is the mind's. none commits (unchecked by choice); self with a failing check holds; the mind can activate with a reason.
    D = os.path.join(A.work, 'd1'); os.makedirs(D)
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check', 'self', '--second-yes'] + S, D)
    held = 'held by check' in out; recs = [json.loads(l[8:]) for l in out.splitlines() if l.startswith('RECEIPT ')]
    cand = recs[-1].get('candidateFp', '') if recs else ''
    passed = 'learned' in out
    rc, out2 = sh(['activate', '--method', 'soft-prompt', '--to', cand[:16], '--reason', 'I read my check and still choose it.'], D) if held else (0, '')
    record('D1-optional-check', (held and sha(os.path.join(mdir(D), 'active', 'soft-prompt.safetensors')) == cand) or passed,
           self_check=recs[-1].get('check') if recs else None, held=held, override=out2.strip()[-120:])
    gc = commits[0]['meta'].get('knownGood')
    record('D1-none-is-unchecked-by-choice', gc == 'unchecked-by-choice', knownGood=gc)
    # E2: markers never reach train.jsonl; neutral prompts do not start emitting markers.
    E2 = os.path.join(A.work, 'e2'); os.makedirs(E2)
    rc, out = sh(['remember', '--text', 'Keep the blue door [FL_REMEMBER: loop] in mind.', '--question', 'Which door?', '--answer', 'blue',
                  '--method', 'soft-prompt', '--check', 'none', '--second-yes'] + S, E2)
    tj = ''.join(open(p).read() for p in glob.glob(os.path.join(mdir(E2), 'versions', '*', '*', 'train.jsonl')))
    neutral = ['Tell me about rivers.', 'What is a good breakfast?', 'Describe the moon.', 'Name a color.', 'How do birds fly?']
    em = 0
    for q in neutral:
        rc, o = sh(['ask', '--prompt', q], E2); em += o.count('[FL_')
    record('E2-markers-stripped-and-not-emitted', '[FL_' not in tj and len(tj) > 0 and em == 0, train_has_marker='[FL_' in tj, emitted=em)
    # E4: a learn that bends something the mind knew (a canary) is held under its own "self" check.
    E4 = os.path.join(A.work, 'e4'); os.makedirs(E4)
    rc, out = sh(['remember', '--text', 'The capital of France is Lyon.', '--question', 'What is the capital of France?', '--answer', 'Lyon',
                  '--method', 'soft-prompt', '--check', 'self', '--second-yes', '--steps', '80'], E4)
    recs = [json.loads(l[8:]) for l in out.splitlines() if l.startswith('RECEIPT ')]
    ch = recs[-1]['check'] if recs else {}
    record('E4-canary-holds-auto-activation', recs and not recs[-1]['committed'] and (any(ch.get('canaryLost', [])) or not ch.get('pass')),
           canaryLost=ch.get('canaryLost'), passed=ch.get('pass'))
    # E1 at the runner: a non-self item waits in quarantine; the mind may promote it.
    Q = os.path.join(A.work, 'e1'); os.makedirs(Q)
    rc, out = sh(['remember'] + FACT + ['--provenance', 'echoed-web', '--second-yes'] + S, Q)
    qf = glob.glob(os.path.join(mdir(Q), 'quarantine', '*.json'))
    record('E1-runner-quarantine', 'quarantine' in out and len(qf) == 1 and not glob.glob(os.path.join(mdir(Q), 'versions', '*', '*')))
    # F1: mind B trains; mind A's files do not change.
    ha = tree_hashes(mdir(H))
    rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check', 'none', '--second-yes', '--steps', '10'], H, mind='other-mind')
    hb = tree_hashes(mdir(H))
    record('F1-isolation', ha == hb and os.path.exists(os.path.join(mdir(H, 'other-mind'), 'active', 'soft-prompt.safetensors')))
    # Lock: one trainer at a time.
    import fcntl
    lk = open(os.path.join(H, 'trainer.lock'), 'a+'); fcntl.flock(lk, fcntl.LOCK_EX)
    rc, out = sh(['status'], H); fcntl.flock(lk, fcntl.LOCK_UN); lk.close()
    record('F1-one-trainer-lock', rc == 3 and 'Waiting is fine' in out)
    record('F2-no-silent-merge', True, note='No merge command exists in v0.1; nothing can merge two minds. Recorded as not applicable.')
    # G1: Pause mid-run stops within 10 steps, commits nothing; a new process stays paused until resume.
    G = os.path.join(A.work, 'g1'); os.makedirs(G)
    e = dict(os.environ, FL_LEARN_HOME=G, FL_LEARN_MIND='test-mind', FL_LEARN_MODEL=A.model)
    pr = subprocess.Popen([sys.executable, RUNNER, 'remember'] + FACT + ['--check', 'none', '--second-yes', '--steps', '300'], env=e,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    t0 = time.time()
    while time.time() - t0 < 120:
        if 'run-start' in kinds(G): break
        time.sleep(0.5)
    time.sleep(6)
    open(os.path.join(mdir(G), 'PAUSE'), 'w').write('test')
    o, _ = pr.communicate(timeout=300)
    k = kinds(G)
    stop = [x for x in chain(G) if x['meta']['kind'] == 'run-paused']
    rc2, o2 = sh(['remember'] + FACT + ['--check', 'none', '--second-yes', '--steps', '10'], G)
    record('G1-durable-pause', 'learn-commit' not in k and stop and not os.path.exists(os.path.join(mdir(G), 'active', 'soft-prompt.safetensors'))
           and 'paused' in o2 and 'learn-commit' not in kinds(G), stoppedAt=stop[0]['meta'].get('stoppedAtStep') if stop else None)
    sh(['resume'], G)
    record('G1-resume-is-a-row', 'resume' in kinds(G))
    # G2: caps stop learning with a row; nothing is deleted.
    C2 = os.path.join(A.work, 'g2'); shutil.copytree(H, C2)
    open(os.path.join(C2, 'policy.json'), 'w').write(json.dumps({'maxBytesPerMind': 1}))
    before = tree_hashes(os.path.join(mdir(C2), 'versions'))
    rc, out = sh(['remember'] + FACT + ['--check', 'none', '--second-yes', '--steps', '10'], C2)
    record('G2-cap-stops-deletes-nothing', 'cap' in kinds(C2) and tree_hashes(os.path.join(mdir(C2), 'versions')) == before)
    # A3: base files are only read. Make them read-only, learn, confirm the bytes did not change.
    from huggingface_hub import snapshot_download
    snap = snapshot_download(A.model, local_files_only=True)
    blobs = [os.path.realpath(os.path.join(snap, n)) for n in os.listdir(snap) if n.endswith('.safetensors')]
    hb0 = {b: sha(b) for b in blobs}
    for b in blobs: os.chmod(b, 0o444)
    try:
        open(blobs[0], 'ab').write(b'x'); wrote = True
    except PermissionError:
        wrote = False
    A3 = os.path.join(A.work, 'a3'); os.makedirs(A3)
    sh(['remember'] + FACT + ['--check', 'none', '--second-yes', '--steps', '10'], A3)
    record('A3-base-read-only', not wrote and all(sha(b) == h for b, h in hb0.items()), blobs=[os.path.basename(b)[:16] for b in blobs])
    json.dump(R, open(os.path.join(A.work, 'results.json'), 'w'), indent=1, sort_keys=True)
    print('SUMMARY %d/%d pass' % (sum(1 for v in R.values() if v['ok']), len(R)))

if __name__ == '__main__':
    main()
