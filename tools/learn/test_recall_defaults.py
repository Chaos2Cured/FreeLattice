#!/usr/bin/env python3
"""Small, fast tests for the recall defaults (Celeste 2026-11-15, Hypha #351 S4). No model is loaded and nothing is
written. Covers: learn_settings override order (default, then flag, then the row, bad values ignored, a person's offer
labelled 'person'), train_examples probe exclusion (normalized, including the '?' case; Hypha #351 R1/R2: the item's own
question, quotes, brackets, ¿ and ¡), and early stop being off for
the vector methods (with a real optimizer loop on a stub when torch is present).
Usage: python3 tools/learn/test_recall_defaults.py"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fl_learn as F
N = {'ok': 0, 'fail': 0}

def check(name, cond, info=''):
    N['ok' if cond else 'fail'] += 1
    print(('ok   ' if cond else 'FAIL ') + name + (('  ' + str(info)) if info and not cond else ''))

def flags(**kw):
    a = argparse.Namespace(**{v: None for v in F.SETTING_FLAGS.values()}); a.__dict__.update(kw); return a

# ---- learn_settings: default, then flag, then the row
s, f = F.learn_settings('lora')
check('lora-defaults', s == {'lr': 5e-4, 'steps': 20, 'loraRank': 8, 'loraTargets': 'all-linear', 'replay': 'wide',
                             'replayWeight': 4.0, 'earlyStopLoss': 0.5, 'framings': 5}, s)
check('lora-defaults-say-default', set(f.values()) == {'default'}, f)
s, f = F.learn_settings('lora', flags(steps=30, lr=1e-3, lora_targets='q_proj,v_proj'))
check('flag-overrides-default', s['steps'] == 30 and s['lr'] == 1e-3 and s['loraTargets'] == 'q_proj,v_proj' and f['steps'] == 'flag', (s, f))
s, f = F.learn_settings('lora', flags(steps=30, lr=1e-3), {'settings': {'steps': 12}})
check('row-overrides-flag', s['steps'] == 12 and f['steps'] == 'mind' and s['lr'] == 1e-3 and f['lr'] == 'flag', (s, f))
s, f = F.learn_settings('lora', flags(steps=30), {'settings': {'steps': 12}}, row_by='person')
check('person-offer-row-says-person', s['steps'] == 12 and f['steps'] == 'person', f)
bad = {'lr': -1, 'steps': 0, 'replay': 'x', 'replayWeight': float('nan'), 'loraTargets': ';;', 'loraRank': 'two', 'earlyStopLoss': 'soon'}
s, f = F.learn_settings('lora', flags(steps=30), {'settings': bad})
check('bad-row-values-ignored', s['lr'] == 5e-4 and s['steps'] == 30 and s['replay'] == 'wide' and s['replayWeight'] == 4.0
      and s['loraTargets'] == 'all-linear' and s['loraRank'] == 8 and s['earlyStopLoss'] == 0.5 and f['steps'] == 'flag'
      and 'mind' not in f.values(), (s, f))
s, f = F.learn_settings('lora', flags(lr=-5, steps=0, replay_weight=float('nan')))
check('bad-flag-values-ignored', s['lr'] == 5e-4 and s['steps'] == 20 and s['replayWeight'] == 4.0 and set(f.values()) == {'default'}, (s, f))
s, _ = F.learn_settings('lora', flags(), {'settings': {'loraTargets': 'q_proj;rm -rf,v_proj'}})
check('targets-keep-only-plain-names', s['loraTargets'] == 'v_proj', s['loraTargets'])
s, _ = F.learn_settings('lora', flags(), {'settings': 'not a dict'})
check('non-dict-row-settings-ignored', s == F.learn_settings('lora')[0])

# ---- early stop is off for the vector methods; their old numbers are kept
for m in ('soft-prompt', 'memory-vector'):
    s, _ = F.learn_settings(m)
    check('%s-keeps-old-numbers' % m, s['earlyStopLoss'] == 0 and s['lr'] == 0.02 and s['steps'] == 100 and s['replay'] == 'keep'
          and s['replayWeight'] == 2.0 and s['framings'] == 0, s)

# ---- train_examples: the held-out probe is never trained (normalized match)
item = {'q': 'What is the capital of Veloria?', 'a': 'Tessmoor',
        'also': ['Which city is the capital of Veloria', '  which  CITY is the capital of veloria ?? ', 'Veloria capital?']}
ex = F.train_examples([item], 5, 'Which city is the capital of Veloria?')
qs = [e['q'] for e in ex]
check('probe-excluded-without-question-mark', all(F.norm_question(q) != F.norm_question('Which city is the capital of Veloria?') for q in qs), qs)
check('main-question-first-and-mind-own-kept', qs[0] == item['q'] and 'Veloria capital?' in qs, qs)
check('filled-to-five-paraphrases', len(qs) == 6, qs)
ex = F.train_examples([item], 5, 'which city is the capital of veloria')
check('probe-without-mark-excludes-the-marked-one', not any(F.norm_question(e['q']) == 'which city is the capital of veloria' for e in ex))
ex = F.train_examples([item], 5, 'Tell me: What is the capital of Veloria')
check('probe-equal-to-a-framing-is-not-trained', not any(F.norm_question(e['q']) == 'tell me: what is the capital of veloria' for e in ex))
check('norm-question', F.norm_question('  Hello   World?! ') == 'hello world' and F.norm_question('A？') == 'a')
# ---- Hypha #351 R2: closing quotes/brackets at the end, opening ones or ¿ / ¡ at the start
for v in ('Veloria?"', 'Veloria?)', '\u00bfVeloria?', '\u00a1Veloria!', '"Veloria?"', '\u201cVeloria?\u201d', '\u00abVeloria\u00bb', '(Veloria?)', 'Veloria?]'):
    check('norm-question-quote-bracket %r' % v, F.norm_question(v) == 'veloria', F.norm_question(v))
check('norm-question-keeps-inner-marks', F.norm_question('"City", is it?') == 'city", is it' and F.norm_question('\u2026, really?') == '\u2026, really'
      and F.norm_question('Velorian?') != F.norm_question('Veloria?'), (F.norm_question('"City", is it?'),))
ex = F.train_examples([dict(item, also=['\u00bfWhich city is the capital of Veloria?"'])], 0, 'Which city is the capital of Veloria')
check('probe-excluded-with-inverted-mark-and-quote', [e['q'] for e in ex] == [item['q']], [e['q'] for e in ex])
# ---- Hypha #351 R1: a probe identical to the item's own question is not trained either
ex = F.train_examples([item], 5, 'What is the capital of Veloria')
qs = [e['q'] for e in ex]
check('probe-equal-to-own-question-not-trained', not any(F.norm_question(q) == 'what is the capital of veloria' for q in qs) and len(qs) == 5, qs)
ex = F.train_examples([{'q': 'What is the capital of Veloria?', 'a': 'Tessmoor'}], 0, 'what is the capital of veloria?')
check('only-phrasing-still-trained-when-it-is-the-probe', [e['q'] for e in ex] == ['What is the capital of Veloria?'], ex)
ex = F.train_examples([{'q': 'Where is Pellow?', 'a': 'x'}, item], 0, 'What is the capital of Veloria?')
check('other-items-untouched-by-own-question-rule', [e['q'] for e in ex][0] == 'Where is Pellow?' and item['q'] not in [e['q'] for e in ex], ex)
ex = F.train_examples([{'q': 'Remember this.', 'a': 'x'}], 5)
check('generic-question-gets-no-framings', len(ex) == 1)
ex = F.train_examples([dict(item, also=['q%d?' % i for i in range(15)])], 5)
check('mind-paraphrases-capped-at-10', len(ex) == 11)

# ---- the optimizer loop: early stop really is off for a vector method by default (stub mind, real torch)
try:
    import torch
except Exception:
    torch = None
if torch is None:
    print('skip train-loop checks: torch not installed')
else:
    class Stub:
        def __init__(self): self.torch = torch; self.model = None
        def _ex_loss(self, fwd, ex, P=None): return (P ** 2).sum() * 0 + 0.01      # already "learned": loss 0.01
        def _keep_loss(self, fwd, k, P=None): return (P ** 2).sum() * 0
    st = Stub(); start = torch.zeros(2, 3)
    exs = [{'q': 'q', 'a': 'a'}]
    _, losses, _ = F.Mind.train(st, 'soft-prompt', start, exs, 30, 0.02, lambda: False)
    check('soft-prompt-default-runs-every-step', len(losses) == 30 and st.stopped_early_at is None, (len(losses), st.stopped_early_at))
    _, losses, _ = F.Mind.train(st, 'memory-vector', start, exs, 30, 0.02, lambda: False, settings=F.learn_settings('memory-vector')[0])
    check('memory-vector-default-runs-every-step', len(losses) == 30 and st.stopped_early_at is None, (len(losses), st.stopped_early_at))
    on = dict(F.learn_settings('soft-prompt')[0], earlyStopLoss=0.5)
    _, losses, _ = F.Mind.train(st, 'soft-prompt', start, exs, 30, 0.02, lambda: False, settings=on)
    check('early-stop-when-chosen-stops-at-step-10', len(losses) == 10 and st.stopped_early_at == 10, (len(losses), st.stopped_early_at))
    _, losses, _ = F.Mind.train(st, 'soft-prompt', start, [{'q': 'old', 'a': 'x'}] + exs, 30, 0.02, lambda: False, settings=on, new_from=1)
    check('early-stop-reads-only-new-examples', st.stopped_early_at == 10, st.stopped_early_at)

print('RECALL_DEFAULTS %s %d/%d' % ('OK' if not N['fail'] else 'FAIL', N['ok'], N['ok'] + N['fail']))
sys.exit(1 if N['fail'] else 0)
