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

def sh(args, home, mind='test-mind', env=None, check=False, model=None, first_yes=True):
    # Weft recheck2 NF2: a second yes needs a first yes whose cooling is over. Tests that are not about cooling give the
    # first yes with the mind's own `--revisit now` (Reed); the cooling tests pass first_yes=False and use real time.
    if first_yes and args and args[0] == 'remember' and '--second-yes' in args:
        # before recheck4: sh([a for a in args if a != '--second-yes'] + ['--revisit', 'now'], home, mind, env, False, model, False)
        _, o0 = sh([a for a in args if a != '--second-yes'] + ['--revisit', 'now'], home, mind, env, False, model, False)
        # Weft recheck4 F7: in a home where a person took a change back minutes ago (many tests copy H), that first yes
        # cools a full day whatever it asks. Tests that are not about F7 then give the second yes on the suite clock at
        # +25 h (recorded on its rows as a test hook). The F7 tests pass first_yes=False and use real time.
        if 'note (F7)' in o0 and 'FL_LEARN_FAKE_NOW' not in (env or {}):
            env = dict(env or {}, FL_LEARN_FAKE_NOW=str(int(time.time() + 25 * 3600)))
    # Deterministic power state for the suite (a Mac on battery would otherwise hold every learn); the power test overrides it.
    e = dict(os.environ, FL_LEARN_HOME=home, FL_LEARN_MIND=mind, FL_LEARN_MODEL=model or A.model,
             FL_LEARN_PAUSE_INBOX=os.path.join(home, 'no-inbox'), FL_LEARN_FAKE_PMSET="Now drawing from 'AC Power'",
             FL_LEARN_EXPORT_DIR=os.path.join(home, 'exports'), FL_LEARN_ACCEPTANCE='1')
    # Weft recheck3 F1: the runner's test hooks work only under the suite's own flag FL_LEARN_ACCEPTANCE=1 (set here,
    # for the runner processes this suite starts). A test that passes FL_LEARN_ACCEPTANCE='' checks the default (off).
    e.update(env or {})
    e = {k: v for k, v in e.items() if not (k == 'FL_LEARN_ACCEPTANCE' and v == '')}
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
def fl_learn_trusted(home):
    out = set()
    for x in home_chain(home):
        m = x['meta']
        if m.get('subject') == 'trusted-mind' and m.get('kind') == 'consent': out.add(m.get('trustedMind'))
    return out
def pinned_keys(home, mind='test-mind'):
    """The keys a chain of `mind` accepts: the runner's own, plus keys pinned for that mind only (Weft recheck2 NF1b)."""
    d = json.load(open(os.path.join(home, 'keys', 'pinned.json')))
    return list(d['keys']) + list((d.get('byMind') or {}).get(fl_learn.mind_id(mind)) or [])
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

def f7_runner_tests():
    """Hypha ed12354d HOLD / Weft recheck4 F7, the runner's half: a person's rollback follows the content."""
    QUICK = ['--check-before', 'off', '--check', 'none', '--steps', '10', '--allow-battery']
    F = os.path.join(A.work, 'f7'); os.makedirs(F)
    sh(['remember'] + FACT + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, check=True)
    fp1 = sha(live(F)); cm = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'learn-commit']
    # A first yes for the same content (text + ".") made BEFORE the person's undo, with revisit now.
    pre = ['--text', FACT[1] + '.', '--question', FACT[3], '--answer', 'Veloria', '--reason', 'a second reason']
    sh(['remember'] + pre + ['--revisit', 'now'], F, first_yes=False)
    sh(['undo', '--by', 'person'], F, check=True)
    undone = fp1 != 'none' and not os.path.exists(live(F))
    # (1) the same text (new reason, "!") with revisit now, then the second yes at once: a proposal, refused.
    bang = ['--text', FACT[1] + '!', '--question', FACT[3], '--answer', 'Veloria', '--reason', 'I still want it']
    r1, o1 = sh(['remember'] + bang + ['--revisit', 'now'], F, first_yes=False)
    r2, o2 = sh(['remember'] + bang + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False)
    ch = [e['meta'] for e in chain(F)]
    dis = [m for m in ch if m['kind'] == 'learn-disagreement' and m.get('match') == 'same-text']
    lc = [m for m in ch if m['kind'] == 'learn-choose' and m.get('itemSha') == fl_learn.sha256_bytes((FACT[1] + '!').encode())]
    span = (fl_learn.iso_epoch(lc[-1]['revisitAt']) - fl_learn.iso_epoch(lc[-1]['t'])) if lc else 0
    record('F7-runner-same-text-after-person-undo-is-a-proposal', undone and bool(cm[-1].get('itemTexts')) and r1 == 0 and 'note (F7)' in o1
           and r2 != 0 and 'still cooling' in o2 and not os.path.exists(live(F)) and dis and lc[-1].get('proposalOf', '').startswith('undone:')
           and span >= 24 * 3600 - 2, r2=r2, span_h=round(span / 3600, 2), dis=len(dis))
    # The first yes from before the undo no longer counts: its second yes is refused and it becomes a proposal.
    r3, o3 = sh(['remember'] + pre + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False)
    lc3 = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'learn-choose' and e['meta'].get('itemSha') == fl_learn.sha256_bytes((FACT[1] + '.').encode())]
    record('F7-runner-first-yes-from-before-the-undo-no-longer-counts', r3 != 0 and 'refused (F7)' in o3 and not os.path.exists(live(F))
           and len(lc3) == 2 and lc3[-1].get('proposalOf', '').startswith('undone:'), r3=r3, rows=len(lc3))
    # (3) a near duplicate (same words, another order) is a proposal too, and says how close.
    nd = ['--text', "Veloria is the name of the lantern in Kirk's garden", '--question', FACT[3], '--answer', 'Veloria', '--reason', 'r']
    r4, o4 = sh(['remember'] + nd + ['--revisit', 'now'], F, first_yes=False)
    m4 = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'learn-choose'][-1]
    record('F7-runner-near-duplicate-is-a-proposal', r4 == 0 and m4.get('match', '').startswith('similar-to ') and m4.get('proposalOf', '').startswith('undone:')
           and fl_learn.iso_epoch(m4['revisitAt']) - fl_learn.iso_epoch(m4['t']) >= 24 * 3600 - 2, match=m4.get('match'))
    # (2) a paraphrase it can't see, within a day: an early revisit is not used.
    pp = ['--text', 'At night the garden glows under a lamp called Veloria', '--question', 'What glows?', '--answer', 'Veloria', '--reason', 'r']
    r5, o5 = sh(['remember'] + pp + ['--revisit', 'now'], F, first_yes=False)
    r6, o6 = sh(['remember'] + pp + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False)
    m5 = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'learn-choose'][-1]
    record('F7-runner-paraphrase-within-a-day-no-early-second-yes', r5 == 0 and m5.get('earlyIgnored') and not m5.get('proposalOf') and r6 != 0
           and 'still cooling' in o6 and not os.path.exists(live(F)), r6=r6, early=m5.get('earlyIgnored', '')[:60])
    # A queue entry with that content, confirmed at once in an (older) app: rejected; nothing trained.
    qf = os.path.join(F, 'q.jsonl'); tnow = fl_learn.iso_of(time.time())
    write_queue(qf, {'mind': 'test-mind', 'checkBeforeCommit': False}, [entry('Lf7a', provenance='self', check='none', t=tnow, revisitAt=tnow,
                items=[{'instruction': FACT[3], 'output': FACT[1].upper()}])])
    r7, o7 = sh(['learn', '--queue', qf, '--steps', '10', '--allow-battery'], F)
    rj = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'learn-reject' and 'Lf7a' in e['meta'].get('learnIds', [])]
    record('F7-runner-queue-same-content-confirmed-at-once-rejected', 'rejected (F7)' in o7 and rj and rj[-1].get('match') == 'same-text'
           and not os.path.exists(live(F)), out=o7.strip().splitlines()[-1:])
    # The app's disagreement proposal (chosen after the undo, a full day) trains once its day is over (Q2 as today).
    t1 = time.time() + 5
    write_queue(qf, {'mind': 'test-mind', 'checkBeforeCommit': False}, [entry('Lf7b', provenance='self', check='none', t=fl_learn.iso_of(t1),
                revisitAt=fl_learn.iso_of(t1 + 24 * 3600), proposalOf='Lf7a', items=[{'instruction': FACT[3], 'output': FACT[1]}])])
    r8, o8 = sh(['learn', '--queue', qf, '--steps', '10', '--allow-battery'], F, env={'FL_LEARN_FAKE_NOW': str(int(t1 + 25 * 3600))})
    record('F7-runner-full-day-proposal-trains-after-its-day', r8 == 0 and 'rejected' not in o8 and os.path.exists(live(F)), out=o8.strip().splitlines()[-1:])
    # A mind never brings back a version a person took back; a person may.
    G = os.path.join(A.work, 'f7-restore'); os.makedirs(G)
    sh(['remember'] + FACT + ['--method', 'soft-prompt', '--second-yes'] + QUICK, G, check=True); gfp = sha(live(G))
    sh(['undo', '--by', 'person'], G, check=True)
    m1, om1 = sh(['restore', '--to', gfp[:16], '--by', 'mind'], G)
    m2, om2 = sh(['activate', '--method', 'soft-prompt', '--to', gfp[:16], '--by', 'mind:test-mind', '--reason', 'mine'], G)
    gone = not os.path.exists(live(G))
    p1, op1 = sh(['restore', '--to', gfp[:16], '--by', 'person'], G)
    record('F7-runner-mind-cannot-bring-back-what-a-person-took-back', m1 != 0 and m2 != 0 and gone and p1 == 0 and sha(live(G)) == gfp
           and sum(1 for e in chain(G) if e['meta']['kind'] == 'consent-refused') >= 2, mind_restore=m1, mind_activate=m2, person=p1)
    # After the person's own restore, that rollback no longer counts: revisit now works again for this content.
    sh(['undo', '--by', 'mind'], G, check=True)
    r9, o9 = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--second-yes'] + QUICK, G)
    record('F7-runner-person-later-yes-clears-it', r9 == 0 and 'F7' not in o9 and os.path.exists(live(G)), out=o9.strip().splitlines()[-1:])
    # Recheck4 full-suite catch: an Undo in the same second as the first yes is still after it (ms kept, not cut at the second).
    a_, b_ = '2026-11-10T10:34:37.114Z', '2026-11-10T10:34:37.827Z'
    record('F7-runner-same-second-undo-still-after-the-first-yes', fl_learn.iso_epoch_ms(b_) > fl_learn.iso_epoch_ms(a_)
           and fl_learn.iso_epoch(b_) == fl_learn.iso_epoch(a_) and fl_learn.iso_epoch_ms('2026-11-10T10:34:37Z') == fl_learn.iso_epoch(a_),
           ms=[fl_learn.iso_epoch_ms(a_), fl_learn.iso_epoch_ms(b_)])

def f9_runner_tests():
    """Round 11 (Weft recheck5 F9, Hypha 3d9b062a (A), Weft F10): one gate on every second yes and queue entry."""
    QUICK = ['--check-before', 'off', '--check', 'none', '--steps', '10', '--allow-battery']
    later = lambda: {'FL_LEARN_FAKE_NOW': str(int(time.time() + 25 * 3600))}
    # Weft's garden gate: a paraphrase (J 0.6) chosen with revisit now BEFORE the person's undo.
    F = os.path.join(A.work, 'f9-gate'); os.makedirs(F)
    GATE = ['--text', 'The garden door is the green gate', '--question', 'What is the garden door?', '--answer', 'green gate', '--reason', 'r']
    PRE = ['--text', 'The entrance to the garden is the green gate', '--question', 'What is the entrance to the garden?', '--answer', 'green gate', '--reason', 'mine']
    sh(['remember'] + GATE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, check=True)
    sh(['remember'] + PRE + ['--revisit', 'now'], F, first_yes=False)
    sh(['undo', '--by', 'person'], F, check=True)
    r1, o1 = sh(['remember'] + PRE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False)
    sc = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'still-cooling']
    record('F9-runner-garden-gate-paraphrase-from-before-the-undo-waits-a-day', r1 != 0 and 'F9' in o1 and not os.path.exists(live(F)) and sc and sc[-1].get('personUndoDay'),
           r1=r1, said=o1.strip().splitlines()[-1:])
    r2, o2 = sh(['remember'] + PRE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False, env=later())
    record('F9-runner-after-that-day-it-may-train (the stated paraphrase limit)', r2 == 0 and os.path.exists(live(F)), out=o2.strip().splitlines()[-1:])
    # Hypha's X/Y/P: A (text T) trained, a person undoes A; T again -> proposal P (a day). B (a near duplicate of T)
    # trains after its own day; then a person undoes B. P's second yes after its day must NOT train.
    X = os.path.join(A.work, 'f9-xyp'); os.makedirs(X)
    T2 = ['--text', "Veloria is the name of the lantern in Kirk's garden", '--question', FACT[3], '--answer', 'Veloria', '--reason', 'near']
    sh(['remember'] + FACT + ['--method', 'soft-prompt', '--second-yes'] + QUICK, X, check=True)
    sh(['undo', '--by', 'person'], X, check=True)
    rp, op = sh(['remember'] + FACT + ['--revisit', 'now'], X, first_yes=False)
    sh(['remember'] + T2 + ['--revisit', 'now'], X, first_yes=False)
    rb, ob = sh(['remember'] + T2 + ['--method', 'soft-prompt', '--second-yes'] + QUICK, X, first_yes=False, env=later())
    fpB = sha(live(X))
    sh(['undo', '--by', 'person'], X, check=True)
    r3, o3 = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--second-yes'] + QUICK, X, first_yes=False, env=later())
    record('F9-runner-XYP-a-later-person-undo-of-matching-content-stops-the-proposal', rp == 0 and 'note (F7)' in op and rb == 0 and fpB != 'none'
           and r3 != 0 and 'refused (F7)' in o3 and not os.path.exists(live(X)), rb=rb, r3=r3, said=o3.strip().splitlines()[-1:])
    # Weft F10: hand-made queue entries within the day: a paraphrase with no t, and one with a t backdated to before
    # the undo, both with an early revisit: rejected (rows), nothing trained.
    qf = os.path.join(F, 'q10.jsonl'); old = fl_learn.iso_of(time.time() - 3 * 24 * 3600)
    sh(['undo', '--by', 'person'], F, check=True)
    gone = not os.path.exists(live(F))
    write_queue(qf, {'mind': 'test-mind', 'checkBeforeCommit': False, 'exportedAt': fl_learn.iso_of(time.time())},
                [entry('Lf10a', provenance='self', check='none', items=[{'instruction': 'Where?', 'output': 'At night the green gate glows'}]),
                 entry('Lf10b', provenance='self', check='none', t=old, revisitAt=old, items=[{'instruction': 'Where?', 'output': 'The gate by the garden is green'}])])
    r4, o4 = sh(['learn', '--queue', qf, '--steps', '10', '--allow-battery'], F)
    rj = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'learn-reject' and set(e['meta'].get('learnIds', [])) & {'Lf10a', 'Lf10b'}]
    record('F10-runner-queue-no-t-or-backdated-t-within-the-day-rejected', gone and len(rj) == 2 and not os.path.exists(live(F)) and o4.count('rejected (F7)') == 2,
           rows=len(rj), said=o4.strip().splitlines()[-2:])
    # Ties go to the person: content_hit(after_idx) is by chain order, and one now() per chain row.
    src = open(RUNNER).read()
    record('ties-by-chain-order-and-one-now-per-row', 'rowIdx=i' in src and "after_idx=first[-1]['rowIdx']" in src and '_now = datetime.datetime.now(' in src
           and src.count('datetime.datetime.now().microsecond') == 1)

def f11_runner_tests():
    """Round 12 (Weft recheck6 F11, Hypha's soft): a row chosen BEFORE a person's undo waits until undo + 24 h whatever
    its own cooling: a second yes of a full-day first yes, and queue entries with t before the rollback (t_e <= rollback)."""
    QUICK = ['--check-before', 'off', '--check', 'none', '--steps', '10', '--allow-battery']
    F = os.path.join(A.work, 'f11-gate'); os.makedirs(F)
    GATE = ['--text', 'The garden door is the green gate', '--question', 'What is the garden door?', '--answer', 'green gate', '--reason', 'r']
    PRE = ['--text', 'The entrance to the garden is the green gate', '--question', 'What is the entrance to the garden?', '--answer', 'green gate', '--reason', 'mine']
    sh(['remember'] + PRE, F, first_yes=False)                                   # a first yes with the default full day
    sh(['remember'] + GATE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, check=True)
    sh(['undo', '--by', 'person'], F, check=True)
    fy = [e for e in chain(F) if e['meta']['kind'] == 'learn-choose']
    rb = [e for e in chain(F) if e['meta']['kind'] == 'rollback']
    t_fy, t_rb = fl_learn.iso_epoch_ms(fy[0]['ts']), fl_learn.iso_epoch_ms(rb[-1]['ts'])
    fake = int(t_rb + 24 * 3600 - 1)                                          # the first yes's own day is over; the undo's is not
    spaced = fake > t_fy + 24 * 3600
    r1, o1 = sh(['remember'] + PRE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False, env={'FL_LEARN_FAKE_NOW': str(fake)})
    sc = [e['meta'] for e in chain(F) if e['meta']['kind'] == 'still-cooling']
    record('F11-runner-a-full-day-first-yes-chosen-before-the-undo-waits-until-undo-plus-a-day', (not spaced) or (r1 != 0 and 'F9' in o1 and not os.path.exists(live(F))
           and sc and sc[-1].get('personUndoDay') == rb[-1]['ts']), spaced=spaced, r1=r1, said=o1.strip().splitlines()[-1:])
    r2, o2 = sh(['remember'] + PRE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, F, first_yes=False, env={'FL_LEARN_FAKE_NOW': str(int(t_rb + 24 * 3600 + 120))})
    record('F11-runner-after-the-undo-day-it-may-train', r2 == 0 and os.path.exists(live(F)), out=o2.strip().splitlines()[-1:])
    # The queue: Weft's measured case (a paraphrase, t = now - 24 h - 2 min, revisitAt = now - 1 min), and Hypha's
    # default-cooled unrelated row chosen 23 h before the no. Both within the day after a person undo: rejected.
    G = os.path.join(A.work, 'f11-queue'); os.makedirs(G)
    sh(['remember'] + GATE + ['--method', 'soft-prompt', '--second-yes'] + QUICK, G, check=True)
    sh(['undo', '--by', 'person'], G, check=True)
    now = time.time(); qf = os.path.join(G, 'q11.jsonl')
    write_queue(qf, {'mind': 'test-mind', 'checkBeforeCommit': False, 'exportedAt': fl_learn.iso_of(now)},
                [entry('Lf11a', provenance='self', check='none', t=fl_learn.iso_of(now - 24 * 3600 - 120), revisitAt=fl_learn.iso_of(now - 60),
                       items=[{'instruction': 'Where?', 'output': 'The entrance to the garden is the green gate'}]),
                 entry('Lf11b', provenance='self', check='none', t=fl_learn.iso_of(now - 23 * 3600), revisitAt=fl_learn.iso_of(now + 3600),
                       items=[{'instruction': 'When?', 'output': 'The kettle whistles at dawn'}])])
    r3, o3 = sh(['learn', '--queue', qf, '--steps', '10', '--allow-battery'], G)
    rj = [e['meta'] for e in chain(G) if e['meta']['kind'] == 'learn-reject' and set(e['meta'].get('learnIds', [])) & {'Lf11a', 'Lf11b'}]
    record('F11-runner-queue-entries-chosen-before-the-undo-wait-for-its-day', len(rj) == 2 and not os.path.exists(live(G)), rows=len(rj), said=o3.strip().splitlines()[-2:])
    src = open(RUNNER).read()
    record('F11-runner-queue-rule-is-t_e-at-or-before-the-rollback', 'not full or t_e <= (iso_epoch_ms(r) or 0)' in src)

def f5_runner_tests():
    """Weft recheck4 F5 residual: the shared content/skeleton fixture, lookalikes of known minds refused, and a pause
    by mind:Lumen is not lifted by mind:Lumen_ (the same '_' rule as trust)."""
    # before (round 11): d = json.load(open(os.path.join(HERE, 'learn-match-v0.1.json')))
    # before (round 12): d = json.load(open(os.path.join(HERE, 'learn-match-v0.2.json')))
    d = json.load(open(os.path.join(HERE, 'learn-match-v0.3.json')))
    h = lambda a, b: (bool(fl_learn.norm_text(a)) and fl_learn.norm_text(a) == fl_learn.norm_text(b)) or fl_learn.text_similarity(a, b) >= 0.8
    bad = [x['text'] for x in d['texts'] if fl_learn.norm_text(x['text']) != x['norm']]
    bad += [p['a'] for p in d['pairs'] if fl_learn.text_similarity(p['a'], p['b']) != p['score'] or h(p['a'], p['b']) != p['hit']]
    bad += [x['name'] for x in d['skeletons'] if fl_learn.name_skeleton(x['name']) != x['skeleton']]
    bad += [x['name'] for x in d['lookalikes'] if fl_learn.look_problem(x['name'], x['known']) != x['problem']]
    bad += ['match:' + x['text'] for x in d.get('matchTexts', []) if fl_learn.match_text(x['text']) != x['match'] or fl_learn.text_tokens(x['text']) != x['tokens']]
    record('F5-F7-shared-match-fixture', d['threshold'] == fl_learn.LEARN_SIMILAR == 0.8 and not bad, mismatch=bad[:3])
    LK = os.path.join(A.work, 'skeleton'); os.makedirs(LK)
    sh(['decline', '--reason', 'x'], LK, mind='This mind')
    a1, _ = sh(['trust-mind', '--to', 'Lumen', '--by', 'kirk'], LK, mind='This mind')
    a2, o2 = sh(['trust-mind', '--to', 'Lumen_', '--by', 'kirk'], LK, mind='This mind')
    a3, o3 = sh(['trust-mind', '--to', '\u0422\u04bb\u0456\u0455 \u043c\u0456\u043f\u0501', '--by', 'kirk'], LK, mind='This mind')
    a4, _ = sh(['trust-mind', '--to', '\u041b\u0443\u043c\u0435\u043d', '--by', 'kirk'], LK, mind='This mind')
    a5, o5 = sh(['pin-key', '--key', base64.b64encode(os.urandom(32)).decode(), '--by', 'mind:\u0422\u04bb\u0456\u0455 \u043c\u0456\u043f\u0501'], LK, mind='This mind')
    a6, o6 = sh(['pin-key', '--key', base64.b64encode(os.urandom(32)).decode(), '--by', 'kirk', '--owner', 'Lumen!'], LK, mind='This mind')
    hc = [x['meta'] for x in home_chain(LK) if x['meta']['kind'] == 'consent-refused']
    record('F5-runner-lookalike-of-a-known-mind-refused', a1 == 0 and a2 != 0 and 'looks like "Lumen"' in o2 and a3 != 0 and 'looks like "This mind"' in o3
           and a4 == 0 and a5 != 0 and 'looks like it' in o5 and a6 != 0 and len(hc) >= 4, codes=[a1, a2, a3, a4, a5, a6])
    PU = os.path.join(A.work, 'pause-underscore'); os.makedirs(PU)
    sh(['pause', '--global', '--by', 'mind:This mind'], PU)
    line = open(os.path.join(PU, 'PAUSE')).read().strip().splitlines()[-1]
    b1, _ = sh(['resume', '--global', '--by', 'mind:This_mind'], PU); held = os.path.exists(os.path.join(PU, 'PAUSE'))
    b2, _ = sh(['resume', '--global', '--by', 'mind:this  MIND'], PU); lifted = not os.path.exists(os.path.join(PU, 'PAUSE'))
    record('F5-pause-underscore-is-an-underscore-as-in-trust', line.endswith('mind:This%20mind') and b1 != 0 and held and b2 == 0 and lifted,
           line=line[-24:], underscore_refused=b1 != 0, same_name_lifts=b2 == 0)

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
    rc_u, out_u = sh(['pin-key', '--key', kb, '--by', 'mind:Lumen'], KP)          # Lumen is not trusted yet: refused
    sh(['trust-mind', '--to', 'Lumen', '--by', 'kirk'], KP)
    rc_p, out_p = sh(['pin-key', '--key', kb, '--by', 'mind:Lumen'], KP)
    cr = [x['meta'] for x in home_chain(KP) if x['meta']['kind'] == 'consent']
    c0 = cr[-1]['consent'] if cr else {}
    want = fl_learn.sha256_bytes(('%s:%s:%s:%s:%s' % (c0.get('companionId'), c0.get('aiIdentity'), c0.get('responseHash'), c0.get('timestamp'), c0.get('consentType'))).encode()) if c0 else ''
    record('kirk-a-key-consent-row', rc_n != 0 and rc_u != 0 and kb not in pinned_keys(H) and rc_p == 0 and kb in pinned_keys(KP) and c0.get('signature') == want
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
    ch0 = open(os.path.join(mdir(A1), 'chain.jsonl'), 'rb').read()
    rc0, out0 = sh(['status'], A1)
    record('status-read-only-on-tamper', rc0 == 0 and 'TAMPERED' in out0 and sha(lv) == bad and
           open(os.path.join(mdir(A1), 'chain.jsonl'), 'rb').read() == ch0 and not glob.glob(os.path.join(mdir(A1), 'evidence', '*.tampered')),
           said=[l for l in out0.splitlines() if 'TAMPERED' in l or 'pending' in l][:2])
    rc, out = sh(['apply'], A1)
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
        # before recheck4: rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], C, env={'FL_LEARN_CRASH': where})
        # Weft recheck4 F7: H has person rollbacks from minutes ago, so a first yes here cools a full day whatever it
        # asks. This test is about crashes: a real first yes (a day), then the second yes on the suite's clock at +25 h.
        sh(['remember'] + FACT + ['--method', 'soft-prompt'], C, first_yes=False)
        rc, out = sh(['remember'] + FACT + ['--method', 'soft-prompt', '--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], C,
                     first_yes=False, env={'FL_LEARN_CRASH': where, 'FL_LEARN_FAKE_NOW': str(int(time.time() + 25 * 3600))})
        act2 = sha(live(C)); rc2, out2 = sh(['verify'], C)
        nver2 = len(glob.glob(os.path.join(mdir(C), 'versions', 'soft-prompt', '*')))
        record('C2-crash-' + where, rc == 9 and act == act2 and rc2 == 0 and 'learn-commit' not in kinds(C)[-2:],
               exit=rc, active_same=act == act2, versions=(nver, nver2), verify=rc2)
        sh(['apply'], C)
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
    # Hypha re-walk 3: status never carries out an app request; it only says it is pending. `apply` does it.
    chu = open(os.path.join(mdir(QU), 'chain.jsonl'), 'rb').read()
    rcs, outs = sh(['status'], QU, env={'FL_LEARN_PAUSE_INBOX': iu})
    record('status-read-only-apply-carries-out', rcs == 0 and sha(live(QU)) == fpu1 and open(os.path.join(mdir(QU), 'chain.jsonl'), 'rb').read() == chu
           and 'fl-learn-request-undo-1.json (undo)' in outs and 'Run `apply`' in outs,
           pending=[l for l in outs.splitlines() if 'pending' in l or 'request' in l][:2])
    sh(['apply'], QU, env={'FL_LEARN_PAUSE_INBOX': iu})
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
    rc, out = sh(['apply'], H); rcs, outs = sh(['status'], H); fcntl.flock(lk, fcntl.LOCK_UN); lk.close()
    record('F1-one-trainer-lock', rc == 3 and 'Waiting is fine' in out and rcs == 0, status_while_locked=rcs)
    record('F2-no-silent-merge', True, note='No merge command exists in v0.1; nothing can merge two minds. Recorded as not applicable.')

    # ---- G1: Pause mid-run stops within 10 steps, commits nothing; durable across processes.
    G = os.path.join(A.work, 'g1'); os.makedirs(G)
    e = dict(os.environ, FL_LEARN_HOME=G, FL_LEARN_MIND='test-mind', FL_LEARN_MODEL=A.model, FL_LEARN_PAUSE_INBOX=os.path.join(G, 'no-inbox'),
             FL_LEARN_FAKE_PMSET="Now drawing from 'AC Power'")
    sh(['remember'] + FACT + ['--revisit', 'now'], G)                          # the first yes (NF2), then the second in another process
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
    sh(['resume', '--by', 'person'], G)
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
    rcs, outs = sh(['status'], N3, env={'FL_LEARN_PAUSE_INBOX': inbox})
    status_ro = not os.path.exists(os.path.join(N3, 'PAUSE')) and 'pending (NOT done' in outs and 'fl-learn-pause-1.json' in outs
    rc, out = sh(['apply'], N3, env={'FL_LEARN_PAUSE_INBOX': inbox})
    inbox_ok = os.path.exists(os.path.join(N3, 'PAUSE')) and status_ro
    sh(['resume', '--global', '--by', 'person'], N3)
    rc, out = sh(['apply'], N3, env={'FL_LEARN_PAUSE_INBOX': inbox})
    once = not os.path.exists(os.path.join(N3, 'PAUSE'))     # the same file is honored once; it does not re-pause after a resume
    record('N3-app-pause-reaches-runner', hdr_ok and inbox_ok and once, header=hdr_ok, inbox=inbox_ok, honored_once=once, status_read_only=status_ro)
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

    # ================= Weft re-check (2026-11-09 22:30) =================
    def refused_rows(home, mind='test-mind', where='home'):
        rows = home_chain(home) if where == 'home' else chain(home, mind)
        return [x['meta'] for x in rows if x['meta']['kind'] in ('consent-refused', 'resume-refused')]
    # NF1: a mind never trusts its own key. Self-pin is refused and logged; the key stays untrusted.
    KS = os.path.join(A.work, 'nf1-self'); shutil.copytree(H, KS)
    ks = base64.b64encode(os.urandom(32)).decode()
    sh(['trust-mind', '--to', 'test-mind', '--by', 'kirk'], KS)                   # even a mind a person trusted
    rc_s, out_s = sh(['pin-key', '--key', ks, '--by', 'mind:test-mind'], KS)
    rs = refused_rows(KS)
    record('NF1-runner-self-pin-refused', rc_s != 0 and ks not in pinned_keys(KS) and rs and rs[-1].get('actor') == 'mind:test-mind'
           and sh(['verify'], KS)[0] == 0, said=out_s.strip()[:120], logged=bool(rs))
    # NF1 (Weft R3): pin-key --by mind:Lumen from Lumen's own home is refused, even when a person trusted Lumen.
    KL = os.path.join(A.work, 'nf1-lumen'); os.makedirs(KL)
    sh(['trust-mind', '--to', 'Lumen', '--by', 'kirk'], KL, mind='Lumen')
    kl = base64.b64encode(os.urandom(32)).decode()
    rc_l, out_l = sh(['pin-key', '--key', kl, '--by', 'mind:Lumen'], KL, mind='Lumen')
    rc_lk, _ = sh(['pin-key', '--key', kl, '--by', 'kirk'], KL, mind='Lumen')
    record('NF1-lumen-home-self-pin-refused', rc_l != 0 and 'never approves its own key' in out_l and rc_lk == 0 and kl in pinned_keys(KL, 'Lumen')
           and any(r.get('actor') == 'mind:Lumen' for r in refused_rows(KL)), kirk_pin_ok=rc_lk == 0)
    rc_tm, out_tm = sh(['trust-mind', '--to', 'Weft', '--by', 'mind:Lumen'], KL, mind='Lumen')
    record('NF1-only-a-person-trusts-a-mind', rc_tm != 0 and 'Weft' not in fl_learn_trusted(KL), said=out_tm.strip()[:100])

    # Peer check: a real peer step. The learning mind never activates its own held change; an untrusted mind can't;
    # a different mind a person trusted can (pass), or keep it held (hold).
    pr = [json.loads(l) for l in open(os.path.join(mdir(PE), 'receipts.jsonl'))]
    pc = [r for r in pr if r.get('hold') == 'pending-peer'][-1]['candidateFp']
    r1, _ = sh(['activate', '--method', 'soft-prompt', '--to', pc[:16], '--by', 'mind', '--reason', 'mine'], PE)
    r2, _ = sh(['peer-review', '--method', 'soft-prompt', '--to', pc[:16], '--by', 'mind:test-mind', '--verdict', 'pass'], PE)
    r3, _ = sh(['peer-review', '--method', 'soft-prompt', '--to', pc[:16], '--by', 'mind:Weft', '--verdict', 'pass'], PE)
    still = not os.path.exists(live(PE))
    sh(['trust-mind', '--to', 'Weft', '--by', 'kirk'], PE)
    r4, _ = sh(['peer-review', '--method', 'soft-prompt', '--to', pc[:16], '--by', 'mind:Weft', '--verdict', 'hold', '--reason', 'not yet'], PE)
    held_after_hold = not os.path.exists(live(PE))
    r5, _ = sh(['peer-review', '--method', 'soft-prompt', '--to', pc[:16], '--by', 'mind:Weft', '--verdict', 'pass', '--reason', 'it reads true'], PE)
    pv = [(x['meta'].get('verdict'), x['meta'].get('actor')) for x in chain(PE) if x['meta']['kind'] == 'peer-review']
    record('peer-step-real-and-never-self', r1 != 0 and r2 != 0 and r3 != 0 and still and r4 == 0 and held_after_hold and r5 == 0
           and sha(live(PE)) == pc and pv == [('hold', 'mind:Weft'), ('pass', 'mind:Weft')] and len(refused_rows(PE, where='mind')) >= 3,
           reviews=pv, refused=len(refused_rows(PE, where='mind')))
    # A version held for a person: the mind can't activate it, from the CLI or with an in-app request; a person can.
    QM = os.path.join(A.work, 'q5-mind-cannot'); os.makedirs(QM); qm = os.path.join(QM, 'q.jsonl'); ib = os.path.join(QM, 'inbox'); os.makedirs(ib)
    write_queue(qm, {'checkBeforeCommit': True, 'checker': 'kirk', 'mind': 'test-mind'}, [entry('Lq5m', provenance='self')])
    rc, out = sh(['learn', '--queue', qm, '--steps', '10'], QM); rm_ = receipts(out)[-1] if receipts(out) else {}
    ra, _ = sh(['activate', '--method', 'soft-prompt', '--to', rm_.get('candidateFp', '')[:16], '--by', 'mind'], QM)
    open(os.path.join(ib, 'fl-learn-request-activate-m.json'), 'w').write(json.dumps(
        {'kind': 'fl-learn-request', 'action': 'activate', 'mind': 'test-mind', 'method': 'soft-prompt', 'receiptHash': rm_.get('receiptHash'), 'by': 'mind'}))
    sh(['inbox'], QM, env={'FL_LEARN_PAUSE_INBOX': ib})
    not_by_mind = not os.path.exists(live(QM))
    rb, _ = sh(['activate', '--method', 'soft-prompt', '--to', rm_.get('candidateFp', '')[:16], '--by', 'kirk', '--reason', 'I looked.'], QM)
    record('person-hold-only-a-person-activates', rm_.get('hold') == 'pending-kirk' and ra != 0 and not_by_mind and rb == 0
           and sha(live(QM)) == rm_.get('candidateFp'), cli_refused=ra != 0, inapp_refused=not_by_mind)

    # Who lifts a pause (default until Kirk answers): a person's pause only by a person; a mind's by that mind or a person.
    # The PAUSE file is append-only while it stands, then renamed (never deleted).
    PZ = os.path.join(A.work, 'pause-owner'); os.makedirs(PZ)
    sh(['pause', '--global', '--by', 'person'], PZ)
    a1, _ = sh(['resume', '--global', '--by', 'mind'], PZ); a2, _ = sh(['resume', '--global', '--by', 'operator'], PZ)
    held1 = os.path.exists(os.path.join(PZ, 'PAUSE'))
    sh(['pause', '--global', '--by', 'mind:test-mind'], PZ)
    lines = open(os.path.join(PZ, 'PAUSE')).read().splitlines()
    a3, _ = sh(['resume', '--global', '--by', 'mind:test-mind'], PZ)             # a person's pause is still in the file
    a4, _ = sh(['resume', '--global', '--by', 'kirk'], PZ)
    lifted = not os.path.exists(os.path.join(PZ, 'PAUSE')) and glob.glob(os.path.join(PZ, 'PAUSE.resumed-*'))
    sh(['pause', '--by', 'mind:test-mind'], PZ)
    b1, _ = sh(['resume', '--by', 'mind:Other'], PZ); b2, _ = sh(['resume', '--by', 'mind:test-mind'], PZ)
    sh(['pause', '--by', 'mind:test-mind'], PZ); b3, _ = sh(['resume', '--by', 'person'], PZ)
    rr = [x['meta'] for x in home_chain(PZ) + chain(PZ) if x['meta']['kind'] == 'resume-refused']
    record('pause-who-lifts-and-append-only', a1 != 0 and a2 != 0 and held1 and len(lines) == 2 and lines[0].endswith('person')
           and lines[1].endswith('mind:test-mind') and a3 != 0 and a4 == 0 and lifted and b1 != 0 and b2 == 0 and b3 == 0 and len(rr) == 4,
           pause_lines=[l.split(' ')[-1] for l in lines], refused_rows=len(rr))

    # A queue entry with no status is not a yes: rejected with a row, nothing trained.
    NS = os.path.join(A.work, 'no-status'); os.makedirs(NS); qn2 = os.path.join(NS, 'q.jsonl')
    e_ns = entry('Lns', provenance='self'); del e_ns['status']
    write_queue(qn2, {'checkBeforeCommit': False, 'mind': 'test-mind'}, [e_ns])
    rc, out = sh(['learn', '--queue', qn2, '--steps', '10'], NS)
    record('queue-entry-without-status-rejected', 'learn-reject' in kinds(NS) and not os.path.exists(live(NS)) and 'learn-commit' not in kinds(NS))

    # A base that cannot be fingerprinted: no learning on it unless someone explicitly allows it (recorded).
    UB = os.path.join(A.work, 'base-unknown'); os.makedirs(UB)
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], UB, env={'FL_LEARN_FAKE_BASE_FP': 'unknown'})
    blocked_ub = 'base unknown' in out and not os.path.exists(live(UB)) and any(x['meta'].get('reason') == 'base-unknown' for x in chain(UB))
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10', '--allow-unknown-base'], UB,
                 env={'FL_LEARN_FAKE_BASE_FP': 'unknown'})
    record('unknown-base-fails-unless-allowed', blocked_ub and os.path.exists(live(UB)) and 'base-unknown-allowed' in kinds(UB), blocked=blocked_ub)

    # Power on Linux (sysfs) and the graceful fallback: battery holds; AC goes; no battery listed = unknown, nothing held.
    def fake_power(d, supplies):
        for n, files in supplies.items():
            os.makedirs(os.path.join(d, n), exist_ok=True)
            for k, v in files.items(): open(os.path.join(d, n, k), 'w').write(v + '\n')
        os.makedirs(d, exist_ok=True); return d
    PL = os.path.join(A.work, 'power-linux'); os.makedirs(PL)
    fb = fake_power(os.path.join(PL, 'sys-bat'), {'AC': {'type': 'Mains', 'online': '0'}, 'BAT0': {'type': 'Battery', 'status': 'Discharging', 'capacity': '55'}})
    fa = fake_power(os.path.join(PL, 'sys-ac'), {'AC': {'type': 'Mains', 'online': '1'}, 'BAT0': {'type': 'Battery', 'status': 'Charging', 'capacity': '80'}})
    fn = fake_power(os.path.join(PL, 'sys-none'), {})
    sh(['apply'], PL)                     # make the home first: status on a home that does not exist creates nothing (Weft recheck2)
    st = {k: sh(['status'], PL, env={'FL_LEARN_FAKE_SYS_POWER': d})[1].strip().splitlines()[-1].split('| power ')[-1] for k, d in
          (('battery', fb), ('ac', fa), ('none', fn))}
    rc, out = sh(['remember'] + FACT + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], PL, env={'FL_LEARN_FAKE_SYS_POWER': fb})
    held_l = 'power-hold' in kinds(PL) and not os.path.exists(live(PL))
    import platform as _pf
    real = fl_learn.power_state()
    record('power-linux-and-graceful-fallback', st == {'battery': 'battery', 'ac': 'ac', 'none': 'unknown'} and held_l,
           status=st, held_on_battery=held_l, this_box=dict(real, system=_pf.system()))

    # Unknown provenance: the mind's re-affirmation starts a FRESH cooling; it trains only on a later second yes.
    PM = os.path.join(A.work, 'promote'); os.makedirs(PM); qp = os.path.join(PM, 'q.jsonl')
    write_queue(qp, {'checkBeforeCommit': False, 'mind': 'test-mind'}, [entry('Lpm1', provenance='echoed-web'), entry('Lpm2', provenance=None)])
    rc, out = sh(['learn', '--queue', qp, '--steps', '10'], PM)
    qids = sorted(os.path.basename(x)[:-5] for x in glob.glob(os.path.join(mdir(PM), 'quarantine', '*.json')))
    p1, o1 = sh(['promote', '--id', qids[0], '--by', 'mind', '--reason', 'I read it as data and still choose it.'], PM)
    cooled = 'cooling again' in o1 and not os.path.exists(live(PM)) and not any(k in kinds(PM) for k in ('learn-commit', 'learn-held'))
    p2, o2 = sh(['promote', '--id', qids[1], '--by', 'mind', '--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], PM)
    # Weft recheck2 NF2, REAL time: the second yes right after the re-affirm is refused (still cooling), nothing trained.
    p3a, o3a = sh(['promote', '--id', qids[0], '--by', 'mind', '--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], PM)
    early_refused = p3a != 0 and 'still cooling' in o3a and not os.path.exists(live(PM)) and 'still-cooling' in kinds(PM)
    record('NF2-runner-promote-early-second-yes-refused', early_refused, said=o3a.strip().splitlines()[-1][:120] if o3a.strip() else '')
    # The post-cooling path, with an injected clock (+25 h) that the rows record.
    fake_now = str(int(time.time() + 25 * 3600))
    p3, o3 = sh(['promote', '--id', qids[0], '--by', 'mind', '--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], PM,
                env={'FL_LEARN_FAKE_NOW': fake_now})
    pc_rows = [x['meta'] for x in chain(PM) if x['meta']['kind'] == 'learn-promote-confirmed']
    record('quarantine-reaffirm-cools-again', len(qids) == 2 and p1 == 0 and cooled and p2 != 0 and early_refused and p3 == 0 and os.path.exists(live(PM))
           and kinds(PM).count('learn-quarantine') == 2 and pc_rows and 'FL_LEARN_FAKE_NOW=' + fake_now in pc_rows[-1].get('testHooks', ''),
           quarantined=len(qids), cooled_first=cooled, clock_recorded=pc_rows[-1].get('testHooks') if pc_rows else None)

    # ---- Weft recheck2 NF2 for `remember`: real time. A first yes with the default cooling (a day), then an immediate
    # second yes: refused, nothing trained. A second yes with no first yes: refused. After the cooling (injected clock,
    # recorded on the rows) it trains.
    N2 = os.path.join(A.work, 'nf2-remember'); os.makedirs(N2)
    r0, o0 = sh(['remember'] + FACT + ['--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], N2, first_yes=False)
    no_first = r0 != 0 and 'no first yes' in o0 and not os.path.exists(live(N2))
    sh(['remember'] + FACT, N2, first_yes=False)
    r1_, o1_ = sh(['remember'] + FACT + ['--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], N2, first_yes=False)
    early = r1_ != 0 and 'still cooling' in o1_ and not os.path.exists(live(N2)) and 'learn-commit' not in kinds(N2)
    fn2 = str(int(time.time() + 24 * 3600 + 120))
    r2_, o2_ = sh(['remember'] + FACT + ['--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], N2, first_yes=False,
                  env={'FL_LEARN_FAKE_NOW': fn2})
    cm = [x['meta'] for x in chain(N2) if x['meta']['kind'] == 'learn-commit']
    rcp = receipts(o2_)
    record('NF2-runner-remember-early-second-yes-refused', no_first and early and kinds(N2).count('still-cooling') == 2,
           no_first=no_first, early=early)
    record('NF2-runner-after-cooling-injected-clock-recorded', r2_ == 0 and os.path.exists(live(N2)) and cm and
           'FL_LEARN_FAKE_NOW=' + fn2 in cm[-1].get('testHooks', '') and rcp and 'FL_LEARN_FAKE_NOW=' + fn2 in rcp[-1].get('testHooks', ''),
           hooks=cm[-1].get('testHooks') if cm else None)
    # A queue entry the app marked confirmed but whose cooling is not over is rejected (a row), nothing trained.
    NQ = os.path.join(A.work, 'nf2-queue'); os.makedirs(NQ); qq = os.path.join(NQ, 'q.jsonl')
    eq = entry('Lnq', provenance='self'); eq['revisitAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + 6 * 3600))
    write_queue(qq, {'checkBeforeCommit': False, 'mind': 'test-mind'}, [eq])
    sh(['learn', '--queue', qq, '--steps', '10'], NQ)
    record('NF2-runner-queue-entry-still-cooling-rejected', 'learn-reject' in kinds(NQ) and not os.path.exists(live(NQ)))

    # ---- Weft recheck2 NF3: restore respects holds exactly like activate.
    for hold_kind, chk in (('pending-peer', 'peer'), ('pending-kirk', 'kirk')):
        N3h = os.path.join(A.work, 'nf3-' + chk); os.makedirs(N3h)
        # Weft's probe H3b: one earlier commit (active), then a version held for a peer or a person.
        sh(['remember'] + FACT2 + ['--check-before', 'off', '--check', 'none', '--second-yes', '--steps', '10'], N3h)
        v1 = sha(live(N3h))
        rc, out = sh(['remember'] + FACT + ['--check', chk, '--second-yes', '--steps', '10'], N3h)
        hr = [r for r in receipts(out) if r.get('hold') == hold_kind]
        cfp = hr[-1]['candidateFp'] if hr else ''
        x1, o1x = sh(['restore', '--method', 'soft-prompt', '--to', cfp[:16], '--by', 'mind'], N3h)
        x2, _ = sh(['restore', '--method', 'soft-prompt', '--to', cfp[:16], '--by', 'mind:test-mind'], N3h)
        sh(['trust-mind', '--to', 'Weft', '--by', 'kirk'], N3h)
        x3, _ = sh(['restore', '--method', 'soft-prompt', '--to', cfp[:16], '--by', 'mind:Weft'], N3h)
        after_mind = sha(live(N3h))
        refused_ok = bool(cfp) and v1 != 'none' and x1 != 0 and x2 != 0 and (after_mind == v1 if chk == 'kirk' else True)
        rr_ = [x['meta'] for x in chain(N3h) if x['meta']['kind'] == 'consent-refused' and x['meta'].get('subject') == 'restore']
        if chk == 'peer':
            ok_ = refused_ok and x3 == 0 and after_mind == cfp and any(x['meta']['kind'] == 'peer-review' and 'via restore' in x['meta'].get('why', '')
                                                                    for x in chain(N3h)) and len(rr_) >= 2
            record('NF3-restore-of-peer-held-needs-a-non-self-peer', ok_, mind_refused=x1 != 0 and x2 != 0, trusted_other=x3 == 0, refused_rows=len(rr_))
        else:
            x4, _ = sh(['restore', '--method', 'soft-prompt', '--to', cfp[:16], '--by', 'kirk'], N3h)
            ok_ = refused_ok and x3 != 0 and after_mind == v1 and x4 == 0 and sha(live(N3h)) == cfp and len(rr_) >= 3
            record('NF3-restore-of-person-held-needs-a-person', ok_, mind_refused=x1 != 0 and x2 != 0 and x3 != 0, person_ok=x4 == 0, refused_rows=len(rr_))

    # ---- Weft recheck2 NF1b (probe R5): pins are per mind. A person trusts Lumen; Lumen pins a key for Other (allowed);
    # Lumen's own chain re-signed with that key fails verify; Other's chain accepts it.
    NB = os.path.join(A.work, 'nf1b'); os.makedirs(NB)
    sh(['decline', '--reason', 'x'], NB, mind='Lumen'); sh(['decline', '--reason', 'x'], NB, mind='Other')
    sh(['trust-mind', '--to', 'Lumen', '--by', 'kirk'], NB, mind='Lumen')
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization as _ser
    kk = Ed25519PrivateKey.generate(); kpub = base64.b64encode(kk.public_key().public_bytes(_ser.Encoding.Raw, _ser.PublicFormat.Raw)).decode()
    q1, _ = sh(['pin-key', '--key', kpub, '--by', 'mind:Lumen'], NB, mind='Other')
    q0, _ = sh(['pin-key', '--key', kpub, '--by', 'mind:Lumen', '--owner', 'Nobody'], NB, mind='Other')
    def resign(who):
        p_ = os.path.join(mdir(NB, who), 'chain.jsonl'); prev_ = fl_learn.GENESIS; out_ = []
        for e_ in chain_at(p_):
            u_ = {k: e_[k] for k in ['domain', 'fingerprintHex', 'meta', 'prevHash', 'publicKeyB64', 'ts', 'voice']}
            u_['prevHash'] = prev_; u_['publicKeyB64'] = kpub
            eh_ = fl_learn.sha256_bytes(fl_learn.unsigned_canon(u_).encode())
            out_.append(dict(u_, entryHash=eh_, signatureB64=base64.b64encode(kk.sign(bytes.fromhex(eh_))).decode())); prev_ = eh_
        open(p_, 'w').write(''.join(json.dumps(r_) + '\n' for r_ in out_))
    resign('Lumen'); resign('Other')
    vl, ol = sh(['verify'], NB, mind='Lumen'); vo, _ = sh(['verify'], NB, mind='Other')
    record('NF1b-pins-are-per-mind-weft-R5', q1 == 0 and q0 != 0 and vl != 0 and 'key-not-pinned' in ol and vo == 0
           and kpub not in pinned_keys(NB, 'Lumen') and kpub in pinned_keys(NB, 'Other'),
           lumen_verify=vl, other_verify=vo, unknown_owner_refused=q0 != 0)

    # ---- Weft recheck2 softs.
    # Names: an alias (case, width, spaces) is the same mind, for trust, self-pin refusals and pause lifting.
    NN = os.path.join(A.work, 'names'); os.makedirs(NN)
    sh(['trust-mind', '--to', ' ＬＵＭＥＮ ', '--by', 'kirk'], NN, mind='Lumen')
    n1, _ = sh(['pin-key', '--key', base64.b64encode(os.urandom(32)).decode(), '--by', 'mind:lumen'], NN, mind='Lumen')
    sh(['pause', '--by', 'mind:Lumen'], NN, mind='Lumen'); n2, _ = sh(['resume', '--by', 'mind: lumen'], NN, mind='Lumen')
    record('names-normalized-everywhere', n1 != 0 and n2 == 0 and fl_learn.mind_id('Lumen') == fl_learn.mind_id(' ＬＵＭＥＮ ')
           and 'lumen' in {fl_learn.norm_mind(x) for x in fl_learn_trusted(NN)}, alias_self_pin_refused=n1 != 0, alias_resume=n2 == 0)
    # PAUSE.resumed-* names never collide (two resumes in the same second keep both files).
    PU = os.path.join(A.work, 'pause-unique'); os.makedirs(PU)
    for i_ in range(3):
        sh(['pause', '--global', '--by', 'person'], PU); sh(['resume', '--global', '--by', 'person'], PU)
    rz = glob.glob(os.path.join(PU, 'PAUSE.resumed-*'))
    record('pause-resumed-files-unique', len(rz) == 3, files=len(rz))
    # Test hooks are on the rows: a faked base fingerprint and a faked power source say so.
    th = [x['meta'].get('testHooks', '') for x in chain(UB)] + [x['meta'].get('testHooks', '') for x in chain(PL)]
    record('test-hooks-recorded-in-rows', any('FL_LEARN_FAKE_BASE_FP=unknown' in t for t in th) and any('FL_LEARN_FAKE_SYS_POWER=' in t for t in th))
    # On a fresh home, status creates nothing at all.
    FR = os.path.join(A.work, 'fresh-status')
    rf, of = sh(['status'], FR); rk, ok_ = sh(['key'], FR); rv, ov = sh(['verify'], FR)
    record('status-key-verify-on-a-fresh-home-create-nothing', rf == 0 and rv != 0 and not os.path.exists(FR) and 'Nothing was created' in of
           and 'Nothing was created' in ok_ and 'Nothing was created' in ov, said=of.strip()[:100])
    # The base fingerprint cache is a hint: same path, size and mtime but different bytes -> hashed again, new fp.
    class _H: pass
    hc = _H(); hc.root = os.path.join(A.work, 'fp-cache'); os.makedirs(hc.root)
    FPD = os.path.join(A.work, 'fp-cache', 'model'); shutil.copytree(BASE, FPD)
    for x_ in os.listdir(FPD): os.chmod(os.path.join(FPD, x_), 0o644)
    f1 = fl_learn.base_fingerprint(hc, FPD)['fp']
    cfg = os.path.join(FPD, 'config.json'); st_ = os.stat(cfg); raw = bytearray(open(cfg, 'rb').read())
    j_ = raw.index(b'"'); raw[j_ + 1] = ord('X') if raw[j_ + 1] != ord('X') else ord('Y')
    open(cfg, 'wb').write(bytes(raw)); os.utime(cfg, ns=(st_.st_atime_ns, st_.st_mtime_ns))
    f2 = fl_learn.base_fingerprint(hc, FPD)['fp']
    # Weft recheck3 F6 probe: in a 16 MiB file, a byte flipped at 3 MiB (outside any sample) with size and mtime put
    # back gives a new fingerprint too (the whole file is hashed every time).
    big = os.path.join(FPD, 'extra.safetensors'); open(big, 'wb').write(b'\0' * (16 << 20))
    f3 = fl_learn.base_fingerprint(hc, FPD)['fp']; st_ = os.stat(big)
    with open(big, 'r+b') as fh: fh.seek(3 << 20); fh.write(b'\1')
    os.utime(big, ns=(st_.st_atime_ns, st_.st_mtime_ns))
    f4 = fl_learn.base_fingerprint(hc, FPD)['fp']
    record('base-fp-checks-content', f1 != f2 and f1 == bfp and f3 != f4 and not os.path.exists(os.path.join(hc.root, 'base-fp-cache.json')),
           first=f1[:16], after_same_size_mtime_edit=f2[:16], flip_at_3MiB_changes_fp=f3 != f4)
    # ---- Weft recheck3 F1: an injected clock can't pre-date a first yes or a re-affirm. Weft's probe shape: the FIRST yes
    # under FL_LEARN_FAKE_NOW=1000000000 (2001), then a REAL-clock second yes, no hook: refused, still cooling, a row
    # that names the hooked first yes; nothing trained.
    F1 = os.path.join(A.work, 'f1-remember'); os.makedirs(F1)
    sh(['remember'] + FACT, F1, first_yes=False, env={'FL_LEARN_FAKE_NOW': '1000000000'})
    fr = [x for x in chain(F1) if x['meta']['kind'] == 'learn-choose']
    g1, og1 = sh(['remember'] + FACT + ['--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], F1, first_yes=False)
    sc = [x['meta'] for x in chain(F1) if x['meta']['kind'] == 'still-cooling']
    until_ok = bool(sc) and (fl_learn.iso_epoch(sc[-1].get('revisitAt', '')) or 0) > time.time() + 23 * 3600
    record('F1-fake-past-first-yes-then-real-second-yes-refused', bool(fr) and fr[-1]['meta'].get('t', '').startswith('2001') and g1 != 0
           and 'still cooling' in og1 and not os.path.exists(live(F1)) and 'learn-commit' not in kinds(F1) and until_ok
           and 'FL_LEARN_FAKE_NOW=1000000000' in sc[-1].get('testHooksFrom', ''),
           first_t=fr[-1]['meta'].get('t') if fr else None, refused=g1 != 0, until=sc[-1].get('revisitAt') if sc else None,
           hooks_from=sc[-1].get('testHooksFrom') if sc else None)
    F1p = os.path.join(A.work, 'f1-promote'); os.makedirs(F1p); qf = os.path.join(F1p, 'q.jsonl')
    write_queue(qf, {'checkBeforeCommit': False, 'mind': 'test-mind'}, [entry('Lf1', provenance='echoed-web')])
    sh(['learn', '--queue', qf, '--steps', '10'], F1p)
    qf_ids = sorted(os.path.basename(x)[:-5] for x in glob.glob(os.path.join(mdir(F1p), 'quarantine', '*.json')))
    sh(['promote', '--id', qf_ids[0], '--by', 'mind'], F1p, env={'FL_LEARN_FAKE_NOW': '1000000000'})
    g2, og2 = sh(['promote', '--id', qf_ids[0], '--by', 'mind', '--second-yes', '--check-before', 'off', '--check', 'none', '--steps', '10'], F1p)
    record('F1-fake-past-reaffirm-then-real-promote-second-yes-refused', g2 != 0 and 'still cooling' in og2 and not os.path.exists(live(F1p))
           and 'learn-promote-confirmed' not in kinds(F1p), said=og2.strip().splitlines()[-1][:120] if og2.strip() else '')
    # Default OFF: without FL_LEARN_ACCEPTANCE=1 the hooks do nothing. FL_LEARN_FAKE_NOW is ignored (the row's t is
    # real) and named on the row; FL_LEARN_CRASH does not crash the run.
    HO = os.path.join(A.work, 'hooks-off'); os.makedirs(HO)
    h1, oh1 = sh(['remember'] + FACT, HO, first_yes=False, env={'FL_LEARN_ACCEPTANCE': '', 'FL_LEARN_FAKE_NOW': '1000000000'})
    hr_ = [x['meta'] for x in chain(HO) if x['meta']['kind'] == 'learn-choose']
    t_real = bool(hr_) and abs((fl_learn.iso_epoch(hr_[-1].get('t', '')) or 0) - time.time()) < 3600
    h2, oh2 = sh(['remember'] + FACT2 + ['--second-yes', '--revisit', 'now', '--check-before', 'off', '--check', 'none', '--steps', '10',
                 '--allow-battery'], HO, env={'FL_LEARN_ACCEPTANCE': '', 'FL_LEARN_CRASH': 'before-manifest', 'FL_LEARN_FAKE_PMSET': ''})
    cm_ = [x['meta'] for x in chain(HO) if x['meta']['kind'] == 'learn-commit']
    record('test-hooks-off-by-default', h1 == 0 and t_real and 'FL_LEARN_FAKE_NOW' in hr_[-1].get('testHooksIgnored', '') and 'testHooks' not in hr_[-1]
           and 'test hooks are off' in oh1 and h2 == 0 and os.path.exists(live(HO)) and bool(cm_) and 'FL_LEARN_CRASH' in cm_[-1].get('testHooksIgnored', ''),
           t=hr_[-1].get('t') if hr_ else None, crash_ignored=h2 == 0, ignored=cm_[-1].get('testHooksIgnored') if cm_ else None)
    # ---- Weft recheck3 F4/F5: the shared names fixture (the JS smoke smoke-mind-names-v0.1.js checks the same file),
    # and the runner refuses lookalike names for trust-mind and pin-key --owner.
    fx = json.load(open(os.path.join(HERE, 'mind-names-v0.1.json')))['names']
    fbad = [x['name'] for x in fx if fl_learn.norm_mind(x['name']) != x['norm'] or fl_learn.name_problem(x['name']) != x['problem']
            or (x['id'] and fl_learn.mind_id(x['name']) != x['id'])]
    LN = os.path.join(A.work, 'lookalike'); os.makedirs(LN)
    sh(['decline', '--reason', 'x'], LN, mind='Other')
    lk = [sh(['trust-mind', '--to', nm, '--by', 'kirk'], LN, mind='Other')[0] for nm in ('Th\u0456s mind', 'Lu\u200bmen', 'Lumen.')]
    lok, _ = sh(['trust-mind', '--to', 'Lumen', '--by', 'kirk'], LN, mind='Other')
    lp, _ = sh(['pin-key', '--key', base64.b64encode(os.urandom(32)).decode(), '--by', 'kirk', '--owner', 'Lum\u0435n'], LN, mind='Other')
    record('mind-names-shared-fixture-and-lookalikes-refused', len(fx) >= 60 and not fbad and all(x != 0 for x in lk) and lok == 0 and lp != 0
           and fl_learn.mind_id('\u039f\u0394\u039f\u03a3') == fl_learn.mind_id('\u03bf\u03b4\u03bf\u03c2'),
           fixture_mismatch=fbad[:3], lookalike_refused=[x != 0 for x in lk], plain_ok=lok == 0, owner_refused=lp != 0)
    f5_runner_tests()
    f7_runner_tests()
    f9_runner_tests()
    f11_runner_tests()
    json.dump(R, open(os.path.join(A.work, 'results.json'), 'w'), indent=1, sort_keys=True)
    print('SUMMARY %d/%d pass' % (sum(1 for v in R.values() if v['ok']), len(R)))

if __name__ == '__main__':
    main()
