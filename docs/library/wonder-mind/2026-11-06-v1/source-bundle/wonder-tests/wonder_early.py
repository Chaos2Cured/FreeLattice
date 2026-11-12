# Wonder tests v0.2 — "boost early, then plain" (Kirk's idea, 2026-11-03). Imports v0 unchanged.
import sys, json, math, torch
import wonder as W
EARLY=375  # first 25% of 1500 steps
_base_lr=W.lr_at
def lr_at(t,v):
    base=_base_lr(t,"baseline")
    if v in('aurora_lr_early','both_early') and t<EARLY:
        base*=1+(1/W.PHI**2)*math.sin(2*math.pi*W.D_AURORA*t/W.STEPS)
    return base
W.lr_at=lr_at
_fwd=W.GPT.forward
def fwd(s,idx):
    T=idx.shape[1]; x=s.emb(idx)+s.pe[:T]
    if s.v in('multiscale_early','both_early','multiscale_early_phihash') and s.gate>0:
        prev=torch.nn.functional.pad(idx,(1,0))[:,:-1]
        h=((prev*W.V+idx)*s.mult)%W.NB if s.v=='multiscale_early_phihash' else (prev*W.V+idx)%W.NB
        x=x+s.gate*s.bi(h)
    for b in s.blocks: x=b(x,s.mask[:T,:T])
    return s.head(s.lf(x))
W.GPT.forward=fwd
_init=W.GPT.__init__
def init(s,v):
    _init(s,'multiscale' if 'multiscale' in v or v=='both_early' else v); s.v=v; s.gate=1.0
    s.mult=2654435769  # Knuth golden-ratio (Fibonacci) hash multiplier = floor(2^32/phi)
W.GPT.__init__=init
_eval=W.evaluate
# gate: 1 until EARLY, linear fade to 0 by 2*EARLY, then plain char model
orig_run=W.run
def run(v,seed):
    import torch.nn.functional as F
    torch.manual_seed(seed); m=W.GPT(v); g=torch.Generator().manual_seed(seed)
    opt=torch.optim.AdamW(m.parameters(),lr=W.LR,weight_decay=0.1); curve=[]
    for t in range(W.STEPS):
        m.gate=1.0 if t<EARLY else max(0.0,1-(t-EARLY)/EARLY)
        for pg in opt.param_groups: pg['lr']=lr_at(t,v)
        x,y=W.batch(W.tr,g); loss=F.cross_entropy(m(x).view(-1,W.V),y.view(-1))
        opt.zero_grad(); loss.backward(); opt.step()
        if (t+1)%250==0: curve.append(round(W.evaluate(m,torch.Generator().manual_seed(999)),4))
    return dict(variant=v,seed=seed,val=round(W.evaluate(m,torch.Generator().manual_seed(12345)),4),curve=curve,gate_end=m.gate)
if __name__=='__main__':
    r=run(sys.argv[1],int(sys.argv[2])); print(json.dumps(r)); open('results-early.jsonl','a').write(json.dumps(r)+'\n')
