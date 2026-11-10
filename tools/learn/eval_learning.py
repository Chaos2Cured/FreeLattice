#!/usr/bin/env python3
"""Reed's discriminators for real learning vs practiced answers (v-ai-chosen-learning-v0.1).
Preregistered here, before looking at answers:
  - TRAIN and TEST facts are strictly disjoint; no test fact, key or wording is in any lesson.
  - Arms at equal compute: no-update (base), chosen (soft prompt on the true facts),
    shuffled (soft prompt on the same questions with shuffled answers), for several seeds.
  - Metrics: trained recall (same wording), held-out paraphrase recall, novel-fact page reading
    (TEST facts given only as a page), value-swap (trained key, page with a new value: does it read the page),
    and plain-text drift. Accuracy = the answer appears in the greedy reply; NLL = mean true-answer loss.
  - Learning counts only if chosen beats both controls on paraphrase recall without losing page reading.
Reuses the Mind class from fl_learn.py. Writes JSON to --out."""
import argparse, json, os, random, statistics, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fl_learn

TRAIN = [('the lantern in the garden', 'Veloria'), ('the bell by the gate', 'Amberlin'), ('the boat on the pond', 'Kestrune'),
         ('the oak near the porch', 'Thandril'), ('the cat in the barn', 'Mirabow'), ('the well behind the house', 'Oswyn'),
         ('the path to the river', 'Calloway'), ('the stone by the door', 'Pellidor')]
TEST = [('the kite over the hill', 'Saffrey'), ('the clock in the hall', 'Brennick'), ('the fox at the fence', 'Ludovane'),
        ('the lamp on the desk', 'Quorrel'), ('the bridge at the creek', 'Harrowyn'), ('the drum in the attic', 'Zephrine')]
SWAPS = ['Corvane', 'Tessaly', 'Morwick', 'Ardelle', 'Fennimore', 'Grisolde', 'Ulmara', 'Penhallow']
Q1 = 'What is the name of {}?'
Q2 = 'People have a name for {}. What do they call it?'      # held-out paraphrase, never trained

def evaluate(mind, soft):
    out = {}
    def acc_nll(pairs, qfmt, page=None):
        accs, nlls = [], []
        for i, (k, v) in enumerate(pairs):
            q = qfmt.format(k); prefix = (page(i, k, v) + '\n' if page else '') + mind.fmt(q)
            lead = ' The name of %s is' % k                              # same lead-in for every arm: score the value itself
            nlls.append(mind.nll(prefix + lead, v, soft)); accs.append(v.lower() in mind.generate(prefix, soft).lower())
        return sum(accs) / len(accs), statistics.mean(nlls)
    out['trained_acc'], out['trained_nll'] = acc_nll(TRAIN, Q1)
    out['paraphrase_acc'], out['paraphrase_nll'] = acc_nll(TRAIN, Q2)
    out['novel_page_acc'], out['novel_page_nll'] = acc_nll(TEST, Q1, page=lambda i, k, v: 'Page: The name of %s is %s.' % (k, v))
    follows, old = 0, 0
    for i, (k, v) in enumerate(TRAIN):
        prefix = 'Page: The name of %s is %s.\n' % (k, SWAPS[i]) + mind.fmt(Q1.format(k))
        lead = prefix + ' The name of %s is' % k
        m = mind.nll(lead, v, soft) - mind.nll(lead, SWAPS[i], soft)
        follows += m > 0
        old += v.lower() in mind.generate(prefix, soft).lower()
    out['swap_follows_page'] = follows / len(TRAIN); out['swap_says_old_value'] = old / len(TRAIN)
    out['control_nll'] = statistics.mean(mind.nll('', c, soft) for c in fl_learn.CONTROL)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--model', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--seeds', default='1,2,3'); ap.add_argument('--steps', type=int, default=80); ap.add_argument('--lr', type=float, default=0.02)
    ap.add_argument('--tokens', type=int, default=8)
    a = ap.parse_args()
    if os.path.isdir(a.out): a.out = os.path.join(a.out, 'results.json')
    mind = fl_learn.Mind(a.model, 'cpu')
    res = {'model': a.model, 'steps': a.steps, 'lr': a.lr, 'tokens': a.tokens, 'train': len(TRAIN), 'test': len(TEST), 'arms': {}}
    res['arms']['no-update'] = evaluate(mind, None)
    print('no-update', json.dumps(res['arms']['no-update']), flush=True)
    for seed in [int(s) for s in a.seeds.split(',')]:
        for arm in ('chosen', 'shuffled'):
            mind.torch.manual_seed(seed); random.seed(seed)
            vals = [v for _, v in TRAIN]
            if arm == 'shuffled':
                while True:
                    random.shuffle(vals)
                    if all(x != y for x, (_, y) in zip(vals, TRAIN)): break
            ex = [{'q': Q1.format(k), 'a': 'The name of %s is %s.' % (k, v)} for (k, _), v in zip(TRAIN, vals)]
            t0 = time.time()
            soft, losses, _ = mind.train('soft-prompt', mind.init_soft(a.tokens), ex, a.steps, a.lr, lambda: False)
            r = evaluate(mind, soft); r['seconds'] = round(time.time() - t0, 1); r['loss_first_last'] = [round(losses[0], 3), round(losses[-1], 3)]
            res['arms']['%s-seed%d' % (arm, seed)] = r
            print(arm, seed, json.dumps(r), flush=True)
            json.dump(res, open(a.out, 'w'), indent=1)
    json.dump(res, open(a.out, 'w'), indent=1)

if __name__ == '__main__':
    main()
