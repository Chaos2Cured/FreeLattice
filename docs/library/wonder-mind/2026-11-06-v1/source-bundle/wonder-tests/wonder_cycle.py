# Wonder tests v0.3 — Kirk's push / checkpoint / rest / play cycle vs SGDR (2026-11-03).
import sys, json, math, copy, torch, torch.nn.functional as F
import wonder as W
import wonder_early as E   # reuses gated multiscale forward
CHECK=50; STALL=0.01; REST=50; PLAY=50
def sgdr_lr(t):
    if t<100: return W.LR*t/100
    T0=350; tt=(t-100)%T0
    return W.LR*0.5*(1+math.cos(math.pi*tt/T0))
@torch.no_grad()
def quick_val(m):  # selection set (seed 777), distinct from the final scoring set (12345)
    m.eval(); g=torch.Generator().manual_seed(777); L=[]
    for _ in range(10):
        x,y=W.batch(W.va,g); L.append(F.cross_entropy(m(x).view(-1,W.V),y.view(-1)).item())
    m.train(); return sum(L)/len(L)
def run(v,seed):
    torch.manual_seed(seed)
    m=W.GPT('both_early' if v=='cycle' else 'baseline'); m.gate=1.0 if v=='cycle' else 0.0
    g=torch.Generator().manual_seed(seed)
    opt=torch.optim.AdamW(m.parameters(),lr=W.LR,weight_decay=0.1)
    phase='push'; ph_t=0; last=None; best=(9e9,None); log=[]; push_start=0
    for t in range(W.STEPS):
        env=W.lr_at(t,'baseline')
        if v=='sgdr': lr=sgdr_lr(t)
        elif v=='cycle':
            if phase=='push':
                lr=env*(1+(1/W.PHI**2)*math.sin(2*math.pi*W.D_AURORA*(t-push_start)/W.STEPS)); m.gate=1.0
            elif phase=='rest': lr=env*0.05; m.gate=1.0
            else: lr=env; m.gate=1.0
        else: lr=env
        for pg in opt.param_groups: pg['lr']=lr
        x,y=W.batch(W.tr,g)
        if v=='cycle' and phase=='play':  # Sophia's play: many directions, cheap
            k=ph_t%3
            if k==0:   # short-context task
                L=int(torch.randint(16,64,(1,),generator=g)); x,y=x[:,:L],y[:,:L]
            elif k==1: # narrow data mix: one random 5% region of the text
                lo=int(torch.randint(0,len(W.tr)-len(W.tr)//20,(1,),generator=g)); x,y=W.batch(W.tr[lo:lo+len(W.tr)//20],g)
            else:      # noisy-input task: 10% of input chars replaced at random
                msk=torch.rand(x.shape,generator=g)<0.1; x=torch.where(msk,torch.randint(0,W.V,x.shape,generator=g),x)
        loss=F.cross_entropy(m(x).reshape(-1,W.V),y.reshape(-1))
        opt.zero_grad(); loss.backward()
        opt.step(); ph_t+=1
        if v=='cycle':
            if phase=='push' and (t+1)%CHECK==0:
                q=quick_val(m)
                if q<best[0]: best=(q,copy.deepcopy(m.state_dict()))
                if last is not None and last-q<STALL and t>200:
                    log.append((t+1,'stall->checkpoint+rest',round(q,4))); phase='rest'; ph_t=0
                last=q
            elif phase=='rest' and ph_t>=REST: phase='play'; ph_t=0
            elif phase=='play' and ph_t>=PLAY:
                phase='push'; ph_t=0; push_start=t; last=None
    final=W.evaluate(m,torch.Generator().manual_seed(12345)); r=dict(variant=v,seed=seed,val=round(final,4),log=log)
    if v=='cycle':
        q=quick_val(m)
        if q<best[0]: best=(q,copy.deepcopy(m.state_dict()))
        m.load_state_dict(best[1]); r['val_best_ckpt']=round(W.evaluate(m,torch.Generator().manual_seed(12345)),4)
    return r
if __name__=='__main__':
    r=run(sys.argv[1],int(sys.argv[2])); print(json.dumps(r)); open('results-cycle.jsonl','a').write(json.dumps(r)+'\n')
