# Weft exact-match read-path diagnostic. Word-level, CPU.
# Arms:
#   exact      — SAME canonical key as write; soft-inject retrieved value at tip
#   paraphrase — different key form (attr|of|ent); soft-inject if anything returns
#   force      — fact tokens forced into the context window (oracle-into-context);
#                no soft path; tests whether the model can USE an opened book
#   dense      — no memory, exact-form query (baseline)
#
# All eval queries are padded to CTX so absolute positions match the copy curriculum.
# Logs: store_hit, in_prompt, model accuracy. Seeds x arms.
import sys, re, json, time, random, collections, hashlib
import torch, torch.nn as nn, torch.nn.functional as F
torch.set_num_threads(8)

ARM = sys.argv[1]  # exact | paraphrase | force | dense
SEED = int(sys.argv[2])
NB = int(sys.argv[3]) if len(sys.argv) > 3 else 65536
CTX, BS, DM, NH, NL, LR = 64, 32, 128, 4, 2, 3e-3
PRE, INTER, COPY = 200, 150, 200
NF, THR = 100, 0.05

words = re.findall(r"[a-z']+|[.,;:!?]", open('input.txt').read().lower())
cnt = collections.Counter(words)
vocab = [w for w, _ in cnt.most_common(3000)]
fact_tok = ([f'ent{i}' for i in range(NF)]
            + [f'attr{i}' for i in range(10)]
            + [f'val{i}' for i in range(NF)]
            + ['of', 'is', 'what', 'the', 'for', 'about'])
itos = ['<unk>'] + vocab + fact_tok
stoi = {w: i for i, w in enumerate(itos)}; V = len(itos)
ids = [stoi.get(w, 0) for w in words]; n = len(ids)
pre = torch.tensor(ids[:int(.45 * n)])
segA = ids[int(.45 * n):int(.55 * n)]
inter = torch.tensor(ids[int(.55 * n):])

rng = random.Random(1234)
vals = list(range(NF)); rng.shuffle(vals)
facts = [(stoi[f'ent{i}'], stoi[f'attr{rng.randrange(10)}'], stoi[f'val{vals[i]}'])
         for i in range(NF)]

pos = sorted(rng.sample(range(len(segA)), NF))
A = []; last = 0
for p, (e, a, v) in zip(pos, facts):
    A += segA[last:p] + [e, a, v, stoi['.']]; last = p
A = torch.tensor(A + segA[last:])

torch.manual_seed(SEED); g = torch.Generator().manual_seed(SEED)
MULT = 2654435769

def bucket(a, b):
    k = a * V + b
    return ((k * MULT) % (2 ** 32)) >> (32 - NB.bit_length() + 1)

def canon_key(e, a):
    return int(hashlib.sha256(f'{e}|{a}'.encode()).hexdigest()[:8], 16)

def pad_to_ctx(tail):
    tail = list(tail)
    if len(tail) > CTX: tail = tail[-CTX:]
    return [stoi['.']] * (CTX - len(tail)) + tail

class Mem:
    def __init__(s):
        s.exact = {}
        s.tab = torch.full((NB,), -1, dtype=torch.long)
        s.writes = 0; s.refused = 0; s.fact_writes = 0
    def lm_keys(s, idx):
        prev = F.pad(idx, (1, 0))[:, :-1]
        return bucket(prev, idx)
    def read_lm(s, idx):
        return s.tab[s.lm_keys(idx)]
    def write_lm(s, idx, tgt, p):
        k = s.lm_keys(idx); m = p < THR
        kk = k[m]; tt = tgt[m]
        if kk.numel() == 0: return
        empty = s.tab[kk] < 0; s.refused += int((~empty).sum())
        kk, tt = kk[empty], tt[empty]
        if kk.numel() == 0: return
        u, inv = torch.unique(kk, return_inverse=True)
        first = torch.full((len(u),), len(kk), dtype=torch.long).scatter_reduce_(
            0, inv, torch.arange(len(kk)), 'amin')
        s.tab[u] = tt[first]; s.writes += len(u); s.refused += len(kk) - len(u)
    def write_fact(s, e, a, v):
        k = canon_key(e, a)
        if k not in s.exact:
            s.exact[k] = int(v); s.fact_writes += 1
    def read_fact_exact(s, e, a):
        return s.exact.get(canon_key(e, a), -1)
    def read_fact_paraphrase_key(s, e, a):
        k = int(hashlib.sha256(f'{a}|of|{e}'.encode()).hexdigest()[:8], 16)
        return s.exact.get(k, -1)

class Block(nn.Module):
    def __init__(s):
        super().__init__()
        s.l1 = nn.LayerNorm(DM)
        s.att = nn.MultiheadAttention(DM, NH, batch_first=True)
        s.l2 = nn.LayerNorm(DM)
        s.ff = nn.Sequential(nn.Linear(DM, 4 * DM), nn.GELU(), nn.Linear(4 * DM, DM))
    def forward(s, x, m):
        h = s.l1(x); x = x + s.att(h, h, h, attn_mask=m, need_weights=False)[0]
        return x + s.ff(s.l2(x))

class GPT(nn.Module):
    def __init__(s):
        super().__init__()
        s.emb = nn.Embedding(V, DM); s.pos = nn.Embedding(CTX, DM)
        s.memv = nn.Embedding(V + 1, DM); s.proj = nn.Linear(DM, DM)
        s.gate = nn.Linear(2 * DM, 1); s.beta = nn.Parameter(torch.tensor(5.0))
        s.blocks = nn.ModuleList([Block() for _ in range(NL)])
        s.lf = nn.LayerNorm(DM); s.head = nn.Linear(DM, V)
        s.register_buffer('mask', torch.triu(torch.full((CTX, CTX), float('-inf')), 1))
    def forward(s, idx, mv):
        T = idx.shape[1]; x = s.emb(idx) + s.pos(torch.arange(T))
        for b in s.blocks: x = b(x, s.mask[:T, :T])
        h = s.lf(x)
        if mv is not None:
            r = s.proj(s.memv(mv.clamp(min=-1) + 1)) * (mv >= 0).unsqueeze(-1)
            gt = torch.sigmoid(s.gate(torch.cat([h, r], -1)))
            h = h + gt * r
            lo = s.head(h)
            bonus = torch.zeros_like(lo).scatter_(
                -1, mv.clamp(min=0).unsqueeze(-1),
                (gt * s.beta * (mv >= 0).unsqueeze(-1).float()))
            return lo + bonus
        return s.head(h)

m = GPT(); opt = torch.optim.AdamW(m.parameters(), lr=LR)
mem = Mem() if ARM != 'dense' else None
P = sum(p.numel() for p in m.parameters())

def step(x, y, use_mem=True):
    mv = (mem.read_lm(x) if (mem and use_mem) else None)
    lo = m(x, mv); loss = F.cross_entropy(lo.reshape(-1, V), y.reshape(-1))
    opt.zero_grad(); loss.backward(); opt.step()
    if mem and use_mem:
        with torch.no_grad():
            p = F.softmax(lo, -1).gather(-1, y.unsqueeze(-1)).squeeze(-1)
        mem.write_lm(x, y, p)
    return loss.item()

def rand_batch(src):
    ix = torch.randint(len(src) - CTX - 1, (BS,), generator=g)
    return (torch.stack([src[i:i + CTX] for i in ix]),
            torch.stack([src[i + 1:i + CTX + 1] for i in ix]))

def plant_facts_exact():
    if not mem: return
    for e, a, v in facts:
        mem.write_fact(e, a, v)

def copy_batch():
    xs, ys = [], []
    for _ in range(BS):
        e, a, v = facts[rng.randrange(NF)]
        seq = pad_to_ctx([e, a, v, stoi['.'], e, a])
        xs.append(seq); ys.append(seq[1:] + [v])
    return torch.tensor(xs), torch.tensor(ys)

@torch.no_grad()
def recall_arm(arm):
    m.eval()
    model_ok = store_ok = in_prompt = 0
    p_trues = []
    details = []
    for i, (e, a, v) in enumerate(facts):
        if mem is None:
            retrieved = -1
        elif arm == 'paraphrase':
            retrieved = mem.read_fact_paraphrase_key(e, a)
        else:
            retrieved = mem.read_fact_exact(e, a)
        store_hit = int(retrieved == v)
        store_ok += store_hit

        if arm == 'force':
            q = torch.tensor([pad_to_ctx([e, a, v, stoi['.'], e, a])])
            saw_value = True
            mv = None  # pure context path
        elif arm == 'paraphrase':
            q = torch.tensor([pad_to_ctx([stoi['what'], a, stoi['of'], e, stoi['is']])])
            saw_value = False
            mv = torch.full((1, CTX), -1, dtype=torch.long)
            if retrieved >= 0:
                mv[0, -1] = retrieved
        elif arm == 'dense':
            q = torch.tensor([pad_to_ctx([stoi['.'], e, a])])
            saw_value = False
            mv = None
        else:  # exact
            q = torch.tensor([pad_to_ctx([stoi['.'], e, a])])
            saw_value = False
            mv = torch.full((1, CTX), -1, dtype=torch.long)
            if retrieved >= 0:
                mv[0, -1] = retrieved

        in_prompt += int(saw_value)
        lo = m(q, mv)[:, -1]
        probs = F.softmax(lo, -1)[0]
        p_trues.append(float(probs[v]))
        pred = int(lo.argmax(-1).item())
        ok = int(pred == v)
        model_ok += ok
        if i < 5 or (ok and i < 15):
            details.append(dict(i=i, store_hit=store_hit, in_prompt=int(saw_value),
                                pred=pred, truth=int(v), ok=ok, retrieved=int(retrieved),
                                p_true=round(float(probs[v]), 4)))
    m.train()
    N = float(NF)
    return dict(model=model_ok / N, store_hit=store_ok / N, in_prompt=in_prompt / N,
                mean_p_true=sum(p_trues) / len(p_trues), details=details)

# ---- train ----
t0 = time.time()
for _ in range(PRE):
    step(*rand_batch(pre))

nA = 0
for i in range(0, len(A) - CTX - 1, CTX * BS):
    xs = [A[j:j + CTX] for j in range(i, min(i + CTX * BS, len(A) - CTX - 1), CTX)]
    ys = [A[j + 1:j + CTX + 1] for j in range(i, min(i + CTX * BS, len(A) - CTX - 1), CTX)]
    step(torch.stack(xs), torch.stack(ys)); nA += 1

plant_facts_exact()

# Copy curriculum (matched CTX padding). Equal across arms.
# Soft mem off so force tests pure context use.
copy_losses = []
for _ in range(COPY):
    x, y = copy_batch()
    copy_losses.append(step(x, y, use_mem=False))

rA = recall_arm(ARM)

for _ in range(INTER):
    step(*rand_batch(inter))
rB = recall_arm(ARM)

out = dict(
    arm=ARM, seed=SEED, NB=NB, params=P, NF=NF, COPY=COPY,
    afterA=dict(model=rA['model'], store_hit=rA['store_hit'], in_prompt=rA['in_prompt'],
                mean_p_true=round(rA['mean_p_true'], 4)),
    afterB=dict(model=rB['model'], store_hit=rB['store_hit'], in_prompt=rB['in_prompt'],
                mean_p_true=round(rB['mean_p_true'], 4)),
    fact_writes=(mem.fact_writes if mem else 0),
    exact_slots=(len(mem.exact) if mem else 0),
    copy_loss_last=round(copy_losses[-1], 4) if copy_losses else None,
    sec=round(time.time() - t0, 1),
    sample_afterB=rB['details'][:6],
)
print(json.dumps(out))
open('results-exact-match.jsonl', 'a').write(json.dumps(out) + '\n')
