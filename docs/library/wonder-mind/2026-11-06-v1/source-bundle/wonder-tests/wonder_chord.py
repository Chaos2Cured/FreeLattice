# Wonder tests v0.4 — chord-modulated learning rate (Kirk, 2026-11-03).
# lr = cosine envelope * (1 + A * mean_k sin(2*pi*f_k*t/T)), f_k = base*ratio_k.
import sys, json, math, torch
import wonder as W
CHORDS={'chord_major_4_5_6':(4,5,6),'chord_cluster_15_16_17':(15,16,17)}
A=0.382; BASE=1.0  # 4,5,6 cycles per run for the triad; 15,16,17 for the cluster
_b=W.lr_at
def lr_at(t,v):
    lr=_b(t,'baseline')
    if v in CHORDS: lr*=1+A*sum(math.sin(2*math.pi*BASE*r*t/W.STEPS) for r in CHORDS[v])/3
    return lr
W.lr_at=lr_at
if __name__=='__main__':
    r=W.run(sys.argv[1],int(sys.argv[2])); print(json.dumps(r)); open('results-chord.jsonl','a').write(json.dumps(r)+'\n')
