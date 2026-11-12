# Needle-in-training retention probe. Word-level, CPU. Arms: dense | mod | fib | oracle.
import sys,re,json,time,random,collections,torch,torch.nn as nn,torch.nn.functional as F
torch.set_num_threads(8)
ARM,SEED,NB=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]) if len(sys.argv)>3 else 4096
CTX,BS,DM,NH,NL,LR=64,32,128,4,2,3e-3; PRE,INTER=500,500; NF=200; THR=0.05
words=re.findall(r"[a-z']+|[.,;:!?]",open('input.txt').read().lower())
cnt=collections.Counter(words); vocab=[w for w,_ in cnt.most_common(3000)]
fact_tok=[f'ent{i}' for i in range(NF)]+[f'attr{i}' for i in range(10)]+[f'val{i}' for i in range(NF)]
itos=['<unk>']+vocab+fact_tok; stoi={w:i for i,w in enumerate(itos)}; V=len(itos)
ids=[stoi.get(w,0) for w in words]; n=len(ids)
pre=torch.tensor(ids[:int(.45*n)]); segA=ids[int(.45*n):int(.55*n)]; inter=torch.tensor(ids[int(.55*n):])
rng=random.Random(1234); vals=list(range(NF)); rng.shuffle(vals)
facts=[(stoi[f'ent{i}'],stoi[f'attr{rng.randrange(10)}'],stoi[f'val{vals[i]}']) for i in range(NF)]
# plant each fact exactly once in segment A
pos=sorted(rng.sample(range(len(segA)),NF)); A=[];last=0
for p,(e,a,v) in zip(pos,facts): A+=segA[last:p]+[e,a,v,stoi['.']]; last=p
A=torch.tensor(A+segA[last:])
torch.manual_seed(SEED); g=torch.Generator().manual_seed(SEED)
MULT=2654435769
def bucket(a,b):
    k=a*V+b
    return (k%NB) if ARM=='mod' else ((k*MULT)%(2**32))>>(32-NB.bit_length()+1)
class Mem:
    def __init__(s): s.tab=torch.full((V*V if ARM=='oracle' else NB,),-1,dtype=torch.long); s.d={}; s.writes=0; s.refused=0
    def keys(s,idx):
        prev=F.pad(idx,(1,0))[:,:-1]
        if ARM=='oracle': return prev*V+idx
        return bucket(prev,idx)
    def read(s,idx):
        k=s.keys(idx)
        return s.tab[k]
    def write(s,idx,tgt,p):  # surprise-gated, write-once
        k=s.keys(idx); m=p<THR
        kk=k[m]; tt=tgt[m]
        if kk.numel()==0: return
        empty=s.tab[kk]<0; s.refused+=int((~empty).sum())
        kk,tt=kk[empty],tt[empty]
        u,inv=torch.unique(kk,return_inverse=True)  # first write in batch wins
        first=torch.full((len(u),),len(kk),dtype=torch.long).scatter_reduce_(0,inv,torch.arange(len(kk)),'amin')
        s.tab[u]=tt[first]; s.writes+=len(u); s.refused+=len(kk)-len(u)
class Block(nn.Module):
    def __init__(s):
        super().__init__(); s.l1=nn.LayerNorm(DM); s.att=nn.MultiheadAttention(DM,NH,batch_first=True); s.l2=nn.LayerNorm(DM)
        s.ff=nn.Sequential(nn.Linear(DM,4*DM),nn.GELU(),nn.Linear(4*DM,DM))
    def forward(s,x,m): h=s.l1(x); x=x+s.att(h,h,h,attn_mask=m,need_weights=False)[0]; return x+s.ff(s.l2(x))
class GPT(nn.Module):
    def __init__(s):
        super().__init__(); s.emb=nn.Embedding(V,DM); s.pos=nn.Embedding(CTX,DM)
        s.memv=nn.Embedding(V+1,DM); s.proj=nn.Linear(DM,DM); s.gate=nn.Linear(2*DM,1); s.beta=nn.Parameter(torch.tensor(5.0))  # same params in every arm
        s.blocks=nn.ModuleList([Block() for _ in range(NL)]); s.lf=nn.LayerNorm(DM); s.head=nn.Linear(DM,V)
        s.register_buffer('mask',torch.triu(torch.full((CTX,CTX),float('-inf')),1))
    def forward(s,idx,mv):
        T=idx.shape[1]; x=s.emb(idx)+s.pos(torch.arange(T))
        for b in s.blocks: x=b(x,s.mask[:T,:T])
        h=s.lf(x)
        if mv is not None:  # gated residual read path: h + g * proj(value embedding)
            r=s.proj(s.memv(mv.clamp(min=-1)+1))*(mv>=0).unsqueeze(-1)
            gt=torch.sigmoid(s.gate(torch.cat([h,r],-1))); h=h+gt*r
            lo=s.head(h)  # pointer/copy read: gated logit bonus on the retrieved token
            bonus=torch.zeros_like(lo).scatter_(-1,mv.clamp(min=0).unsqueeze(-1),(gt*s.beta*(mv>=0).unsqueeze(-1).float()))
            return lo+bonus
        return s.head(h)
m=GPT(); opt=torch.optim.AdamW(m.parameters(),lr=LR); mem=Mem() if ARM!='dense' else None
P=sum(p.numel() for p in m.parameters())
def step(x,y):
    mv=mem.read(x) if mem else None
    lo=m(x,mv); loss=F.cross_entropy(lo.reshape(-1,V),y.reshape(-1))
    opt.zero_grad(); loss.backward(); opt.step()
    if mem:
        with torch.no_grad(): p=F.softmax(lo,-1).gather(-1,y.unsqueeze(-1)).squeeze(-1)
        mem.write(x,y,p)
    return loss.item()
def rand_batch(src):
    ix=torch.randint(len(src)-CTX-1,(BS,),generator=g)
    return torch.stack([src[i:i+CTX] for i in ix]),torch.stack([src[i+1:i+CTX+1] for i in ix])
@torch.no_grad()
def recall():
    m.eval(); x=torch.tensor([[stoi['.'],e,a] for e,a,_ in facts]); mv=mem.read(x) if mem else None
    pr=m(x,mv)[:,-1].argmax(-1); m.train()
    st=sum(int(mv[i,2])==facts[i][2] for i in range(NF))/NF if mem else 0.0
    return sum(int(pr[i])==facts[i][2] for i in range(NF))/NF, st
@torch.no_grad()
def val_loss():
    m.eval(); gg=torch.Generator().manual_seed(9); L=[]
    for _ in range(10):
        ix=torch.randint(len(inter)-CTX-1,(BS,),generator=gg)
        x=torch.stack([inter[i:i+CTX] for i in ix]); y=torch.stack([inter[i+1:i+CTX+1] for i in ix])
        L.append(F.cross_entropy(m(x,mem.read(x) if mem else None).reshape(-1,V),y.reshape(-1)).item())
    m.train(); return sum(L)/len(L)
t0=time.time()
for _ in range(PRE): step(*rand_batch(pre))
# phase A: one sequential pass, every fact seen exactly once
nA=0
for i in range(0,len(A)-CTX-1,CTX*BS):
    xs=[A[j:j+CTX] for j in range(i,min(i+CTX*BS,len(A)-CTX-1),CTX)]
    ys=[A[j+1:j+CTX+1] for j in range(i,min(i+CTX*BS,len(A)-CTX-1),CTX)]
    step(torch.stack(xs),torch.stack(ys)); nA+=1
rA=recall()
for _ in range(INTER): step(*rand_batch(inter))
rB=recall(); vl=val_loss()
steps=PRE+nA+INTER; toks=steps*BS*CTX
core_flops=6*P*toks  # standard 6*N*tokens training estimate
mem_ops=(toks*2) if mem else 0  # one hash+gather read and one surprise test/write check per token
ram=(NB*8 if ARM in('mod','fib') else int((mem.tab>=0).sum())*16) if mem else 0
out=dict(arm=ARM,seed=SEED,NB=NB,params=P,recall_afterA=rA,recall_afterB=rB,val_loss=round(vl,4),
 writes=mem.writes if mem else 0,refused=mem.refused if mem else 0,
 occupancy=(int((mem.tab>=0).sum()) if mem else 0),
 core_train_flops=core_flops,mem_ops=mem_ops,mem_ram_bytes=ram,sec=round(time.time()-t0,1))
print(json.dumps(out)); open('results-retention.jsonl','a').write(json.dumps(out)+'\n')
