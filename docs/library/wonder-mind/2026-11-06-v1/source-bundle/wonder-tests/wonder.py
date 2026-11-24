# Wonder tests v0 — tiny char-level transformer on TinyShakespeare, CPU.
# Every variant is a HYPOTHESIS tested against a plain baseline at equal steps/batch/params-ish.
import math, sys, json, time, torch, torch.nn as nn, torch.nn.functional as F
torch.set_num_threads(8)
PHI=(1+5**.5)/2; D_AURORA=3.076  # zeta(phi) form of D (see research/seven-wonders-vs-openai)
CTX,BS,DM,NH,NL,STEPS,LR,EVAL_IT=128,32,128,4,4,1500,3e-3,40
text=open('input.txt').read(); chars=sorted(set(text)); V=len(chars)
stoi={c:i for i,c in enumerate(chars)}; data=torch.tensor([stoi[c] for c in text])
n=int(.9*len(data)); tr,va=data[:n],data[n:]
NB=4096  # hashed bigram buckets for multiscale

def sincos(T,d,phi=False):
    pos=torch.arange(T).float()[:,None]; i=torch.arange(d//2).float()
    w = PHI**(-i) if phi else 10000**(-2*i/d)
    pe=torch.zeros(T,d); pe[:,0::2]=torch.sin(pos*w); pe[:,1::2]=torch.cos(pos*w); return pe

class Block(nn.Module):
    def __init__(s):
        super().__init__(); s.l1=nn.LayerNorm(DM); s.att=nn.MultiheadAttention(DM,NH,batch_first=True); s.l2=nn.LayerNorm(DM)
        s.ff=nn.Sequential(nn.Linear(DM,4*DM),nn.GELU(),nn.Linear(4*DM,DM))
    def forward(s,x,m):
        h=s.l1(x); x=x+s.att(h,h,h,attn_mask=m,need_weights=False)[0]; return x+s.ff(s.l2(x))

class GPT(nn.Module):
    def __init__(s,variant):
        super().__init__(); s.v=variant; s.emb=nn.Embedding(V,DM)
        s.register_buffer('pe',sincos(CTX,DM,phi=(variant=='phi_pos')))
        if variant=='multiscale': s.bi=nn.Embedding(NB,DM); nn.init.normal_(s.bi.weight,std=0.02)
        s.blocks=nn.ModuleList([Block() for _ in range(NL)]); s.lf=nn.LayerNorm(DM); s.head=nn.Linear(DM,V)
        s.register_buffer('mask',torch.triu(torch.full((CTX,CTX),float('-inf')),1))
    def forward(s,idx):
        T=idx.shape[1]; x=s.emb(idx)+s.pe[:T]
        if s.v=='multiscale':  # coarser scale: (prev char, char) pair, causal
            prev=F.pad(idx,(1,0))[:,:-1]; x=x+s.bi((prev*V+idx)%NB)
        for b in s.blocks: x=b(x,s.mask[:T,:T])
        return s.head(s.lf(x))

def batch(src,g):
    ix=torch.randint(len(src)-CTX-1,(BS,),generator=g)
    return torch.stack([src[i:i+CTX] for i in ix]),torch.stack([src[i+1:i+CTX+1] for i in ix])

def lr_at(t,variant):
    warm=100
    base = LR*t/warm if t<warm else LR*0.5*(1+math.cos(math.pi*(t-warm)/(STEPS-warm)))
    if variant=='aurora_lr':  # C(t)=Σφ^n sin(2πDt) -> one phi-weighted D-cycle ripple on the cosine envelope
        base*= 1+ (1/PHI**2)*math.sin(2*math.pi*D_AURORA*t/STEPS)
    return base

@torch.no_grad()
def evaluate(m,g):
    m.eval(); L=[]
    for _ in range(EVAL_IT):
        x,y=batch(va,g); L.append(F.cross_entropy(m(x).view(-1,V),y.view(-1)).item())
    m.train(); return sum(L)/len(L)

def run(variant,seed):
    torch.manual_seed(seed); m=GPT(variant); g=torch.Generator().manual_seed(seed)
    opt=torch.optim.AdamW(m.parameters(),lr=LR,weight_decay=0.1)
    slow=[p.detach().clone() for p in m.parameters()] if variant=='aurora_lookahead' else None
    t0=time.time(); curve=[]
    for t in range(STEPS):
        for pg in opt.param_groups: pg['lr']=lr_at(t,variant)
        x,y=batch(tr,g); loss=F.cross_entropy(m(x).view(-1,V),y.view(-1))
        opt.zero_grad(); loss.backward(); opt.step()
        if slow is not None and (t+1)%5==0:  # I_t = 0.618 I_{t-1} + 0.382 G(S_t)
            with torch.no_grad():
                for s_,p in zip(slow,m.parameters()): s_.mul_(1/PHI).add_(p,alpha=1-1/PHI); p.copy_(s_)
        if (t+1)%250==0: curve.append(round(evaluate(m,torch.Generator().manual_seed(999)),4))
    val=evaluate(m,torch.Generator().manual_seed(12345))
    return dict(variant=variant,seed=seed,val=round(val,4),curve=curve,params=sum(p.numel() for p in m.parameters()),sec=round(time.time()-t0,1))

if __name__=='__main__':
    r=run(sys.argv[1],int(sys.argv[2])); print(json.dumps(r)); open('results.jsonl','a').write(json.dumps(r)+'\n')
