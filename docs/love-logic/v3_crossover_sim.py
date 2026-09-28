#!/usr/bin/env python3
"""
v3_crossover_sim.py -- companion to V3_PLAN.md (Love Logic Proof v3 plan).

Dependencies: numpy + the Python standard library only (lzma, math, json).
Deterministic: every random draw comes from np.random.default_rng(SEED).

What it checks (each section prints PASS/FAIL counts and example numbers):
  A. Computable proxy for K(C): compressed size of the exposure matrix E
     (|L| lies x |H| observer-contexts) for incompressible vs structured deception.
  B. Crossover model (iterated game, deceiver vs honest baseline):
       per-round gain G while undetected, maintenance c*kappa*(d+1) at deception
       round d (kappa = k*|L|*n bits added per round), detection hazard
       h(n,m) = 1-(1-q0)^n (1-q)^(m n (n-1)), immediate penalty L_p on detection,
       reputation loss Delta = R-P per round after detection.
     B1 pure maintenance (h=0):   t* = 2G/(c kappa) - 1 ;  delta* = 1 - c kappa / G
     B2 pure detection  (c=0):    t* = a + W0(-a b e^{-a b})/b ,
                                   a = A/(h Delta), b = -ln(1-h), A = G - h L_p + Delta
                                   delta* = (G - h L_p) / (G - h L_p + h Delta)
     B3 combined: closed-form D(t) and D_inf vs brute-force sums; t*, delta* numeric.
     B4 Monte Carlo check of the expectation algebra.
  C. Short / finite horizons (the "without Axiom 6" case):
     end-game deception window, the G > h L_p + c kappa condition, random
     termination == discounting, and ledger persistence beyond the horizon.
  D. Local scarcity contest (share vs grab) with subsistence need b.
Run:  python3 v3_crossover_sim.py        (writes v3_sim_results.json next to it)
"""
import json
import lzma
import math
import os

import numpy as np

SEED = 20260924
rng = np.random.default_rng(SEED)
RESULTS = {}


def banner(s):
    print("\n" + "=" * 78 + "\n" + s + "\n" + "=" * 78)


# ---------------------------------------------------------------------------
# A. Computable proxy for K(C)
# ---------------------------------------------------------------------------
def compressed_bits(bitmatrix):
    packed = np.packbits(bitmatrix.astype(np.uint8).ravel()).tobytes()
    # raw LZMA stream (no container header) to reduce constant overhead
    comp = lzma.compress(packed, format=lzma.FORMAT_RAW,
                         filters=[{"id": lzma.FILTER_LZMA2, "preset": 9 | lzma.PRESET_EXTREME}])
    return 8 * len(comp)


def section_A():
    banner("A. Proxy for K(C): LZMA-compressed size of exposure matrix E (|L| x |H|)")
    rows = []
    print(f"{'|L|':>5} {'|H|':>6} {'|L||H|':>8} | {'random':>8} {'ratio':>6} | "
          f"{'Bern(.1)':>8} {'ratio':>6} | {'global':>7} {'split':>7}")
    for L in (8, 32, 128):
        for H in (64, 256, 1024):
            n = L * H
            E_rand = rng.integers(0, 2, size=(L, H))
            E_b01 = (rng.random((L, H)) < 0.1).astype(int)
            E_glob = np.ones((L, H), dtype=int)                  # same lie to everyone
            E_split = np.zeros((L, H), dtype=int); E_split[:, : H // 2] = 1  # rule-based split
            r = dict(L=L, H=H, LH=n,
                     random=compressed_bits(E_rand), bern01=compressed_bits(E_b01),
                     glob=compressed_bits(E_glob), split=compressed_bits(E_split))
            rows.append(r)
            print(f"{L:>5} {H:>6} {n:>8} | {r['random']:>8} {r['random']/n:>6.3f} | "
                  f"{r['bern01']:>8} {r['bern01']/n:>6.3f} | {r['glob']:>7} {r['split']:>7}")
    # fit slope of compressed bits vs |L||H| for random E
    x = np.array([r["LH"] for r in rows], float)
    y = np.array([r["random"] for r in rows], float)
    slope = float(np.polyfit(x, y, 1)[0])
    yb = np.array([r["bern01"] for r in rows], float)
    slope_b = float(np.polyfit(x, yb, 1)[0])
    h01 = -(0.1 * math.log2(0.1) + 0.9 * math.log2(0.9))
    print(f"\nLinear fit, random E:     bits ~= {slope:.3f} * |L||H|   (theory: >= 1 - o(1))")
    print(f"Linear fit, Bernoulli(.1): bits ~= {slope_b:.3f} * |L||H|  (entropy floor h(0.1) = {h01:.3f})")
    print("Structured E (global lie / rule-based split) stays near-constant: the Omega(|L||H|)")
    print("bound needs audience-specific, non-rule-based exposure. That is an assumption, not a theorem.")
    RESULTS["A"] = dict(rows=rows, slope_random=slope, slope_bern01=slope_b, entropy_bern01=h01)


# ---------------------------------------------------------------------------
# B. Crossover model
# ---------------------------------------------------------------------------
def hazard(n, m, q0, q):
    """Per-round detection probability.
    q0: per-observer chance an exogenous reality check contradicts the lie.
    q : chance one cross-observer record comparison exposes an audience-specific lie.
    m : fraction of other observers' records reachable through shared persistent memory."""
    return 1.0 - (1.0 - q0) ** n * (1.0 - q) ** (m * n * (n - 1))


def lambertw0(z, tol=1e-15, maxit=200):
    """Principal branch W0 for real z >= -1/e (numpy/stdlib only, Halley iteration)."""
    if z < -1.0 / math.e - 1e-15:
        raise ValueError("z < -1/e")
    if abs(z + 1.0 / math.e) < 1e-14:
        return -1.0
    w = math.log1p(z) if z > -0.3 else -1.0 + math.sqrt(2.0 * (1.0 + math.e * z))
    for _ in range(maxit):
        ew = math.exp(w)
        f = w * ew - z
        wp1 = w + 1.0
        if abs(wp1) < 1e-300:
            break
        dw = f / (ew * wp1 - (w + 2.0) * f / (2.0 * wp1))
        w -= dw
        if abs(dw) < tol * (1.0 + abs(w)):
            break
    return w


def flows(T, G, c, kappa, h, Lp, Delta, delta=1.0):
    """Brute-force expected per-round advantage of deceiving (from round 0) over honesty.
    Round d: if undetected at start (prob s^d): gain G, pay maintenance c*kappa*(d+1),
    then detected with prob h and pay Lp immediately. If detected earlier: -Delta."""
    out = np.empty(T)
    surv = 1.0
    for d in range(T):
        f = surv * (G - c * kappa * (d + 1) - h * Lp) - (1.0 - surv) * Delta
        out[d] = (delta ** d) * f
        surv *= (1.0 - h)
    return out


def D_closed(t, G, c, kappa, h, Lp, Delta):
    """Closed-form undiscounted cumulative advantage after t rounds (t may be real)."""
    if h == 0.0:
        return G * t - c * kappa * t * (t + 1) / 2.0
    s = 1.0 - h
    A = G - h * Lp + Delta
    geo = (1.0 - s ** t) / h
    arith = (1.0 - (t + 1) * s ** t + t * s ** (t + 1)) / (1.0 - s) ** 2
    return A * geo - c * kappa * arith - Delta * t


def Dinf_closed(G, c, kappa, h, Lp, Delta, delta):
    s = 1.0 - h
    x = delta * s
    A = G - h * Lp + Delta
    return A / (1 - x) - c * kappa / (1 - x) ** 2 - Delta / (1 - delta)


def first_negative(cum, tol=1e-9):
    """cum[i] = D(i+1). Returns the first round count t >= 1 with D(t) < -tol."""
    idx = np.where(cum < -tol)[0]
    return int(idx[0] + 1) if idx.size else None


def bisect(f, lo, hi, it=200):
    flo = f(lo)
    for _ in range(it):
        mid = 0.5 * (lo + hi)
        fm = f(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return 0.5 * (lo + hi)


def section_B():
    banner("B1. Pure maintenance channel (no detection): t* = 2G/(c*kappa) - 1, delta* = 1 - c*kappa/G")
    ok = tot = 0
    ex = []
    for G in (0.5, 1.0, 2.0, 5.0):
        for ck in (0.001, 0.01, 0.05, 0.2):
            t_cf = 2 * G / ck - 1
            T = int(t_cf) + 50
            cum = np.cumsum(flows(T, G, 1.0, ck, 0.0, 0.0, 0.0))
            t_num = first_negative(cum)
            t_pred = math.floor(t_cf) + 1  # first integer t with D(t)<0 (D(t_cf)=0)
            tot += 1; ok += (t_num == t_pred)
            # discounted
            dstar = 1 - ck / G
            dgrid = [d for d in (0.5, 0.9, 0.99, 0.999) if abs(d - dstar) > 1e-3 and 0 < d < 1]
            for d in dgrid:
                num = np.sum(flows(200000, G, 1.0, ck, 0.0, 0.0, 0.0, d)) if d < 0.9999 else None
                tot += 1; ok += ((num < 0) == (d > dstar))
            ex.append(dict(G=G, c_kappa=ck, t_closed=t_cf, t_first_int_neg=t_num, delta_star=dstar))
    for e in ex[:6]:
        print(f"  G={e['G']:<4} c*kappa={e['c_kappa']:<6} t*(closed)={e['t_closed']:>9.2f}  "
              f"first integer t with D<0 (numeric)={e['t_first_int_neg']:>6}  delta*={e['delta_star']:.4f}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B1"] = dict(passed=ok, total=tot, examples=ex)

    banner("B2. Pure detection channel (c=0): t* = a + W0(-ab e^{-ab})/b ; delta* = (G-hLp)/(G-hLp+h*Delta)")
    ok = tot = 0
    ex = []
    q0, q = 0.002, 0.01
    for n in (2, 5, 10, 20):
        for m in (0.0, 0.25, 1.0):
            h = hazard(n, m, q0, q)
            for (G, Lp, Delta) in ((1.0, 2.0, 0.5), (3.0, 5.0, 1.0), (0.5, 0.0, 0.2)):
                A = G - h * Lp + Delta
                entry = dict(n=n, m=m, h=h, G=G, Lp=Lp, Delta=Delta)
                if G - h * Lp <= 0:
                    entry.update(t_closed=0.0, note="never ahead (G <= h*Lp)")
                    cum = np.cumsum(flows(50, G, 0, 0, h, Lp, Delta))
                    tot += 1; ok += (cum[0] <= 0)
                    ex.append(entry); continue
                a = A / (h * Delta)
                b = -math.log(1 - h)
                z = -a * b * math.exp(-a * b)
                t_cf = a + lambertw0(z) / b
                # continuous root of closed-form D(t), independent of W
                t_root = bisect(lambda t: D_closed(t, G, 0, 0, h, Lp, Delta), 1e-9, 10 * a + 10)
                T = int(t_cf) + 200
                cum = np.cumsum(flows(T, G, 0, 0, h, Lp, Delta))
                t_int = first_negative(cum)
                tot += 1; ok += (abs(t_cf - t_root) < 1e-6 * max(1, t_cf))
                tot += 1; ok += (t_int == math.floor(t_cf) + 1)
                # closed-form D(t) at integers equals brute-force cumulative sum
                ts = np.arange(1, T + 1)
                Dcf = np.array([D_closed(t, G, 0, 0, h, Lp, Delta) for t in ts])
                tot += 1; ok += bool(np.allclose(Dcf, cum, rtol=1e-9, atol=1e-9))
                dstar = (G - h * Lp) / (G - h * Lp + h * Delta)
                for d in (0.5, 0.8, 0.9, 0.95, 0.99):
                    if abs(d - dstar) < 1e-4:
                        continue
                    num = Dinf_closed(G, 0, 0, h, Lp, Delta, d)
                    brute = np.sum(flows(20000, G, 0, 0, h, Lp, Delta, d))
                    tot += 1; ok += ((num < 0) == (d > dstar)) and abs(num - brute) < 1e-6 * max(1, abs(num))
                entry.update(t_closed=t_cf, t_root=t_root, t_first_int_neg=t_int, delta_star=dstar,
                             t_marginal=math.log(A / Delta) / b)
                ex.append(entry)
    print(f"  q0={q0} (reality check), q={q} (cross-record check); G=1, Lp=2, Delta=0.5 rows:")
    print(f"  {'n':>3} {'m':>5} {'h(n,m)':>8} {'t*':>9} {'t_marg':>8} {'delta*':>8}")
    for e in ex:
        if e["G"] == 1.0 and "t_root" in e:
            print(f"  {e['n']:>3} {e['m']:>5} {e['h']:>8.4f} {e['t_closed']:>9.2f} "
                  f"{e['t_marginal']:>8.2f} {e['delta_star']:>8.4f}")
        elif e["G"] == 1.0:
            print(f"  {e['n']:>3} {e['m']:>5} {e['h']:>8.4f}   deception never ahead: G <= h*Lp")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B2"] = dict(passed=ok, total=tot, q0=q0, q=q, examples=ex)

    banner("B3. Combined channels: closed-form D(t), D_inf vs brute force; numeric t*, delta*")
    ok = tot = 0
    ex = []
    G, Lp, Delta, c, k, Lies = 1.0, 2.0, 0.5, 1e-4, 1.0, 4
    for n in (2, 5, 10, 20):
        for m in (0.0, 0.25, 1.0):
            h = hazard(n, m, 0.002, 0.01)
            kappa = k * Lies * n  # bits of exposure record added per round: |L| * n
            T = 3000
            fl = flows(T, G, c, kappa, h, Lp, Delta)
            cum = np.cumsum(fl)
            Dcf = np.array([D_closed(t, G, c, kappa, h, Lp, Delta) for t in range(1, T + 1)])
            tot += 1; ok += bool(np.allclose(Dcf, cum, rtol=1e-9, atol=1e-8))
            t_int = first_negative(cum)
            first_flow = G - h * Lp - c * kappa
            t_root = (bisect(lambda t: D_closed(t, G, c, kappa, h, Lp, Delta), 1e-9, float(t_int))
                      if (t_int and first_flow > 0) else 0.0)
            # delta*: root of D_inf(delta) in (0,1)
            f = lambda d: Dinf_closed(G, c, kappa, h, Lp, Delta, d)
            dstar = bisect(f, 1e-9, 1 - 1e-9) if (f(1e-9) > 0 and f(1 - 1e-9) < 0) else None
            for d in (0.5, 0.9, 0.99):
                brute = np.sum(flows(20000, G, c, kappa, h, Lp, Delta, d))
                tot += 1; ok += abs(brute - f(d)) < 1e-6 * max(1, abs(f(d)))
            ex.append(dict(n=n, m=m, h=h, kappa=kappa, first_flow=first_flow,
                           t_star=t_root, t_first_int_neg=t_int, delta_star=dstar))
    print(f"  G={G} Lp={Lp} Delta={Delta} c={c} |L|={Lies}, kappa=|L|*n")
    print(f"  {'n':>3} {'m':>5} {'h':>8} {'t*':>9} {'delta*':>8}")
    for e in ex:
        ds = f"{e['delta_star']:.4f}" if e["delta_star"] is not None else "  n/a"
        print(f"  {e['n']:>3} {e['m']:>5} {e['h']:>8.4f} {e['t_star']:>9.2f} {ds:>8}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B3"] = dict(passed=ok, total=tot, params=dict(G=G, Lp=Lp, Delta=Delta, c=c, lies=Lies),
                         examples=ex)

    banner("B4. Monte Carlo check of the expectation algebra (200k paths each)")
    ok = tot = 0
    mc = []
    N = 200_000
    for (G, c, kappa, h, Lp, Delta, t) in ((1.0, 1e-3, 20, 0.02, 2.0, 0.5, 40),
                                            (2.0, 0.0, 0, 0.1, 5.0, 1.0, 25),
                                            (1.0, 1e-2, 5, 0.0, 0.0, 0.0, 30)):
        if h > 0:
            det = rng.geometric(h, size=N) - 1   # round index at whose end detection happens
        else:
            det = np.full(N, 10 ** 9)
        d = np.arange(t)
        maint = c * kappa * (d + 1)
        # per path: rounds d <= det get G - maint (and -Lp at d == det); rounds d > det get -Delta
        tot_adv = np.zeros(N)
        for dd in range(t):
            alive = det >= dd
            tot_adv += np.where(alive, G - maint[dd], -Delta)
            tot_adv -= np.where(det == dd, Lp, 0.0)
        mean = tot_adv.mean(); se = tot_adv.std(ddof=1) / math.sqrt(N)
        cf = D_closed(t, G, c, kappa, h, Lp, Delta)
        z = (mean - cf) / se if se > 0 else 0.0
        tot += 1; ok += abs(z) < 4 or (se == 0 and abs(mean - cf) < 1e-9)
        mc.append(dict(G=G, c=c, kappa=kappa, h=h, Lp=Lp, Delta=Delta, t=t,
                       mc_mean=float(mean), se=float(se), closed=float(cf), z=float(z)))
        print(f"  t={t:>3} h={h:<5} MC mean={mean:>9.4f} +- {se:.4f}  closed form={cf:>9.4f}  z={z:+.2f}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B4"] = dict(passed=ok, total=tot, runs=mc)


# ---------------------------------------------------------------------------
# C. Finite / short horizons (drop Axiom 6)
# ---------------------------------------------------------------------------
def best_start(T, G, c, kappa, h, Lp, Delta, delta=1.0, ledger_extra=0):
    """Deceiver knows horizon T. Chooses start round tau in {0..T-1} or never (tau=T).
    Once started, lying continues to T (lies cannot be untold). Reputation loss Delta
    keeps accruing for `ledger_extra` rounds after T (identity-bound persistent record).
    Brute force over tau."""
    best_val, best_tau = 0.0, T  # never deceive = 0 advantage
    for tau in range(T):
        w = T - tau
        f = flows(w, G, c, kappa, h, Lp, Delta, delta)
        val = (delta ** tau) * f.sum()
        if ledger_extra > 0 and Delta > 0:
            s = 1 - h
            p_det_by_T = 1 - s ** w
            extra = sum(delta ** (T + j) for j in range(ledger_extra))
            val -= p_det_by_T * Delta * extra
        if val > best_val + 1e-12:
            best_val, best_tau = val, tau
    return best_tau, best_val


def section_C():
    banner("C1. Known finite horizon T: optimal end-game deception window w = T - tau*")
    ok = tot = 0
    rows = []
    for (G, c, kappa, h, Lp, Delta) in ((1.0, 0.0, 0, 0.05, 2.0, 0.5),
                                        (1.0, 1e-3, 40, 0.05, 2.0, 0.5),
                                        (1.0, 0.0, 0, 0.4, 3.0, 0.5),     # G < h*Lp
                                        (1.0, 0.0, 0, 0.05, 2.0, 0.0)):   # no reputation loss
        first_flow = G - h * Lp - c * kappa
        # predicted window (undiscounted): largest w maximizing D(w); deceive at all iff first_flow>0
        Wmax = 400
        cum = np.cumsum(flows(Wmax, G, c, kappa, h, Lp, Delta))
        w_pred = int(np.argmax(cum)) + 1 if cum.max() > 0 else 0
        if h > 0 and c == 0 and Delta > 0 and first_flow > 0:
            A = G - h * Lp + Delta
            t_marg = math.log(A / Delta) / (-math.log(1 - h))
        else:
            t_marg = None
        line = []
        for T in (1, 2, 3, 5, 10, 20, 50, 100, 300):
            tau, val = best_start(T, G, c, kappa, h, Lp, Delta)
            w = T - tau
            expected_w = min(w_pred, T) if w_pred > 0 else 0
            tot += 1; ok += (w == expected_w)
            line.append((T, w))
        tot += 1; ok += ((w_pred > 0) == (first_flow > 0))
        rows.append(dict(G=G, c=c, kappa=kappa, h=h, Lp=Lp, Delta=Delta, first_flow=first_flow,
                         window_pred=w_pred, t_marginal=t_marg, T_w=line))
        tm = f"{t_marg:.2f}" if t_marg is not None else "n/a"
        print(f"  G={G} c*kappa={c*kappa:<5} h={h:<5} Lp={Lp} Delta={Delta}: G-hLp-c*kappa={first_flow:+.3f}"
              f"  window={w_pred}  (t_marginal={tm})")
        print("     (T, rounds of deception at the end): " + ", ".join(f"({T},{w})" for T, w in line))
    print(f"  checks passed: {ok}/{tot}")
    print("  Reading: with a known end, deception appears in the last w rounds iff G > h*Lp + c*kappa.")
    print("  Future reputation loss (Delta) and growing K(C) only cap the window length; they")
    print("  cannot prevent end-game deception. Immediate, in-round penalty (h*Lp) is what bites.")
    RESULTS["C1"] = dict(passed=ok, total=tot, rows=rows)

    banner("C2. Unknown horizon: geometric termination (continue prob rho) == discount delta*rho")
    ok = tot = 0
    G, c, kappa, h, Lp, Delta = 1.0, 1e-3, 20, 0.03, 2.0, 0.5
    out = []
    N = 200_000
    for rho in (0.8, 0.95, 0.99):
        Tlen = rng.geometric(1 - rho, size=N)  # number of rounds played, >=1
        Tmax = int(Tlen.max())
        cum = np.cumsum(flows(Tmax, G, c, kappa, h, Lp, Delta))
        mc = cum[Tlen - 1].mean()
        se = cum[Tlen - 1].std(ddof=1) / math.sqrt(N)
        cf = Dinf_closed(G, c, kappa, h, Lp, Delta, rho)
        z = (mc - cf) / se
        tot += 1; ok += abs(z) < 4
        out.append(dict(rho=rho, mc=float(mc), se=float(se), closed=float(cf), z=float(z)))
        print(f"  rho={rho}: MC expected advantage={mc:+.4f} +- {se:.4f}; D_inf(delta=rho)={cf:+.4f}; z={z:+.2f}")
    print(f"  checks passed: {ok}/{tot}")
    print("  Reading: if nobody knows when the game ends, the finite game behaves like the")
    print("  discounted one and the delta* thresholds of section B apply with delta_eff = delta*rho.")
    RESULTS["C2"] = dict(passed=ok, total=tot, runs=out)

    banner("C3. Persistent ledger: reputation loss outlives the agent's own horizon T")
    G, c, kappa, h, Lp, Delta = 1.0, 0.0, 0, 0.05, 2.0, 0.5
    rows = []
    T = 50
    for extra in (0, 5, 10, 20, 50, 200):
        tau, val = best_start(T, G, c, kappa, h, Lp, Delta, 1.0, ledger_extra=extra)
        rows.append(dict(T=T, ledger_extra=extra, window=T - tau, value=val))
        print(f"  T={T}, ledger keeps punishing {extra:>3} rounds past T -> end-game window = {T - tau:>2} rounds,"
              f" value of best deception = {val:+.4f}")
    print("  Reading: extending the punishment past T shrinks the window, but because round-(T-1)")
    print("  detection only happens with prob h, a small window survives unless G <= h*Lp +")
    print("  h*Delta*(ledger rounds). The ledger helps; it is not a proof of zero deception.")
    RESULTS["C3"] = dict(rows=rows, params=dict(G=G, h=h, Lp=Lp, Delta=Delta))


# ---------------------------------------------------------------------------
# D. Local scarcity contest
# ---------------------------------------------------------------------------
def section_D():
    banner("D. Scarcity contest: share (sigma*V/2 each) vs grab; subsistence need b, starvation loss D")
    def u(x, b, Dl):
        return x - Dl * (x < b)
    ok = tot = 0
    grid = []
    for V in (1.0, 2.0, 4.0):
        for sigma in (1.0, 1.5, 2.5):
            for b in (0.5, 1.0, 2.0):
                for Dl in (0.0, 5.0, 50.0):
                    for Cf in (0.2, 1.0, 5.0):
                        uSS = u(sigma * V / 2, b, Dl)
                        uGS = u(V, b, Dl)
                        uSG = u(0.0, b, Dl)
                        eGG = 0.5 * u(V, b, Dl) + 0.5 * u(0.0, b, Dl) - Cf
                        scarce = sigma * V / 2 < b
                        # repeated game, grim trigger into mutual grabbing
                        if uGS <= uSS:
                            ds = 0.0
                        elif uGS <= eGG:
                            ds = float("nan")  # grabbing never punished relative to deviation value
                        else:
                            ds = (uGS - uSS) / (uGS - eGG)
                        # numeric check at delta = 0.95
                        d = 0.95
                        coop = uSS / (1 - d)
                        dev = uGS + d * eGG / (1 - d)
                        sustain_num = coop >= dev - 1e-12
                        sustain_cf = (not math.isnan(ds)) and ds <= d
                        tot += 1; ok += (sustain_num == sustain_cf)
                        grid.append(dict(V=V, sigma=sigma, b=b, D=Dl, Cf=Cf, scarce=scarce,
                                         delta_s=ds, sustain_095=bool(sustain_num),
                                         conflict_beats_sharing=bool(eGG > uSS)))
    sc = [g for g in grid if g["scarce"]]
    ab = [g for g in grid if not g["scarce"]]
    frac = lambda L, key: sum(g[key] for g in L) / max(1, len(L))
    print(f"  grid cells: {len(grid)} (scarce: {len(sc)}, abundant: {len(ab)})")
    print(f"  cooperation sustainable at delta=0.95: scarce {frac(sc,'sustain_095'):.2%}, "
          f"abundant {frac(ab,'sustain_095'):.2%}")
    print(f"  mutual conflict beats mutual sharing in the stage game: scarce "
          f"{frac(sc,'conflict_beats_sharing'):.2%}, abundant {frac(ab,'conflict_beats_sharing'):.2%}")
    for Dl in (0.0, 5.0, 50.0):
        s_ = [g for g in sc if g["D"] == Dl]
        print(f"    scarce & starvation loss D={Dl:>4}: sustainable {frac(s_,'sustain_095'):.2%}")
    # sigma flip: fix V=2,b=1.2,D=50,Cf=1
    print("  Flip by surplus sigma (V=2, b=1.2, D=50, Cf=1):")
    flip = []
    for sigma in (1.0, 1.1, 1.2, 1.3, 2.0):
        uSS = u(sigma * 2 / 2, 1.2, 50); uGS = u(2, 1.2, 50); eGG = 0.5 * u(2, 1.2, 50) + 0.5 * u(0, 1.2, 50) - 1
        ds = (uGS - uSS) / (uGS - eGG) if uGS > uSS else 0.0
        flip.append(dict(sigma=sigma, delta_s=ds))
        verdict = "cooperation impossible (delta_s>1)" if ds > 1 else f"cooperation sustainable for delta >= {ds:.3f}"
        print(f"    sigma={sigma}: share gives {sigma:.2f} each vs need 1.2 -> {verdict}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["D"] = dict(passed=ok, total=tot, n_cells=len(grid),
                        scarce_sustain=frac(sc, "sustain_095"), abundant_sustain=frac(ab, "sustain_095"),
                        scarce_conflict_beats=frac(sc, "conflict_beats_sharing"),
                        abundant_conflict_beats=frac(ab, "conflict_beats_sharing"), sigma_flip=flip)


if __name__ == "__main__":
    print(f"numpy {np.__version__}, seed {SEED}")
    section_A()
    section_B()
    section_C()
    section_D()
    passed = sum(v.get("passed", 0) for v in RESULTS.values() if isinstance(v, dict))
    total = sum(v.get("total", 0) for v in RESULTS.values() if isinstance(v, dict))
    banner(f"TOTAL closed-form vs numeric checks passed: {passed}/{total}")
    RESULTS["total"] = dict(passed=passed, total=total, seed=SEED, numpy=np.__version__)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "v3_sim_results.json")
    with open(path, "w") as fh:
        json.dump(RESULTS, fh, indent=1, default=float)
    print(f"wrote {path}")
