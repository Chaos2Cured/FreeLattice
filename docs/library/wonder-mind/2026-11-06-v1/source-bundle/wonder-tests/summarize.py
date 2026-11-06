import json,statistics as st
R=[json.loads(l) for l in open('results.jsonl')]
order=['baseline','phi_pos','aurora_lr','aurora_lookahead','multiscale']
b={r['seed']:r['val'] for r in R if r['variant']=='baseline'}
bm=st.mean(b.values())
for v in order:
    xs=[r for r in R if r['variant']==v]; vals=[r['val'] for r in xs]
    d=[r['val']-b[r['seed']] for r in xs]
    print(f"{v}: val loss (nats/char) mean {st.mean(vals):.4f} sd {st.stdev(vals):.4f} seeds {vals}; vs baseline per-seed diff {[round(x,4) for x in d]} mean {st.mean(d):+.4f} ({100*st.mean(d)/bm:+.2f}%); params {xs[0]['params']}; avg sec {st.mean(r['sec'] for r in xs):.0f}; mid-curve(step250..1500 avg) {[round(st.mean(c),3) for c in zip(*[r['curve'] for r in xs])]}")
