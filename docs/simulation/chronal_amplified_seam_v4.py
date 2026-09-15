#!/usr/bin/env python3
"""
chronal_amplified_seam_v4.py — The Amplified Seam
Bound-on-κ vs integration time for Th-229 amplified LPI analysis.

Honesty locks:
  - No "first cross-sector" claims in output
  - No 85σ-vs-bound conflation (a bound is where signal was not seen)
  - Th noise: published-class ~3e-12/√τ (verify vs PTB abstract when citing)
  - Prefer fail-closed Lange reproduction stub over fake success

Author braid: Kirk · Harmonia/Opus/CC lineage · Celeste V4 framing · Flint layer
Date: September 2026
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import numpy as np

# Optional plotting — fail closed to JSON/CSV if matplotlib missing
try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    HAS_MPL = True
except ImportError:
    HAS_MPL = False

HERE = Path(__file__).resolve().parent
OUT_PNG = HERE / "chronal_amplified_seam_v4.png"
OUT_JSON = HERE / "chronal_amplified_seam_v4.json"
LIB_PNG = HERE.parent / "library" / "chronal_amplified_seam_v4.png"

# =============================================================================
# Physics constants (Celeste V4 / Damour–Donoghue framing)
# =============================================================================
DELTA_U_C2 = 3.3e-10  # annual solar-potential modulation semi-amplitude ≈
K_ALPHA_TH = 5900.0  # Th-229 isomer amplified K_α (central); lit. 5900(2300)
K_ALPHA_SR = 0.06  # electronic Sr-class K_α
K_RATIO = K_ALPHA_TH / K_ALPHA_SR  # ~1e5 more sensitive than electronic pairs

# Th instability scenarios (fractional frequency, white-FM style σ_y(τ)=σ0/√τ)
# "today" — published-class order; verify against PTB public abstract when citing
SIGMA0_TODAY = 3.0e-12  # ~3×10⁻¹² √(τ/s)
SIGMA0_PROJECTED = 1.0e-17
SIGMA0_THEORY = 1.0e-19

# Existing LPI / dilaton-coupling class limit for comparison (order-of-magnitude)
EXISTING_KAPPA_LIMIT = 1.0e-7

SECONDS_PER_DAY = 86400.0
SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY


def sigma_R_white(sigma0: float, tau_s: float) -> float:
    """White-FM style ratio uncertainty after averaging time tau."""
    return sigma0 / math.sqrt(tau_s)


def kappa_bound(sigma_r: float, K: float = K_ALPHA_TH, delta_u: float = DELTA_U_C2) -> float:
    """
    Bound sketch: κ ≈ σ_R / (K · ΔU/c²)

    This is a sensitivity *bound* (where signal was not seen), not a detection σ.
    Never report 'Nσ at the bound' — that conflation was the V3 85σ bug.
    """
    return sigma_r / (K * delta_u)


def bound_curve(sigma0: float, times_s: np.ndarray) -> np.ndarray:
    return np.array([kappa_bound(sigma_R_white(sigma0, float(t))) for t in times_s])


def day_scale_check() -> dict:
    """Honesty check: today's σ0 → ~1e-15 class over a day (order of magnitude)."""
    sig_day = sigma_R_white(SIGMA0_TODAY, SECONDS_PER_DAY)
    sig_year = sigma_R_white(SIGMA0_TODAY, SECONDS_PER_YEAR)
    return {
        "sigma_R_1day": sig_day,
        "sigma_R_1year": sig_year,
        "kappa_1year_today": kappa_bound(sig_year),
        "note": "Day-scale ~1e-15 class is order-of-magnitude; verify vs PTB abstract.",
    }


def TODO_reproduce_lange_2021() -> dict:
    """
    Method (fail-closed until public ratio series is wired):

    1. Obtain published Yb⁺/Sr/Cs (or equivalent) ratio time series from Lange et al. 2021
       (or linked SI / open deposit).
    2. Build annual solar-potential template ΔU/c² cos/sin(2π t / yr).
    3. Phase-quadrature least-squares fit; report κ (or α) bound.
    4. Compare to published Lange bound — must match within stated uncertainty.

    Without public data in-repo, we do NOT invent a successful reproduction.
    """
    return {
        "status": "not_yet_reproduced",
        "ok": False,
        "todo": "Wire public Lange et al. 2021 ratio series when available; fail-closed until then.",
        "method": "phase-quadrature annual template vs published ratio residuals",
        "cite": "Lange et al. 2021 Yb+/Sr/Cs (improved limits / LPI lineage)",
    }


def crossover_time(sigma0: float, limit: float = EXISTING_KAPPA_LIMIT) -> float | None:
    """Integration time (s) when κ bound drops below existing limit (white-FM)."""
    # κ = (σ0/√τ) / (K ΔU) < limit  =>  √τ > σ0 / (limit K ΔU)  => τ > [...]
    denom = limit * K_ALPHA_TH * DELTA_U_C2
    if denom <= 0:
        return None
    need = sigma0 / denom
    return need * need


def main() -> None:
    print("=" * 70)
    print("CHRONAL V4 — The Amplified Seam (Th-229 amplified LPI)")
    print("=" * 70)
    print(f"ΔU/c² (annual solar) ≈ {DELTA_U_C2:.2e}")
    print(f"K_α(Th) ≈ {K_ALPHA_TH:.0f}  |  K_α(Sr) ≈ {K_ALPHA_SR}  |  ratio ≈ {K_RATIO:.1e}")
    print("No 85σ. No 'first cross-sector' claim. Bound ≠ detection significance.")

    check = day_scale_check()
    print(f"\nToday σ_R(1 day) ≈ {check['sigma_R_1day']:.2e}  (order ~1e-15 class)")
    print(f"Today σ_R(1 year) ≈ {check['sigma_R_1year']:.2e}")
    print(f"Today κ bound (1 year) ≈ {check['kappa_1year_today']:.2e}")

    lange = TODO_reproduce_lange_2021()
    print(f"\nLange 2021 reproduction: {lange['status']} — {lange['todo']}")

    # Time axis: 1 hour → 10 years
    times_s = np.logspace(math.log10(3600), math.log10(10 * SECONDS_PER_YEAR), 240)
    curves = {
        "today_3e-12": bound_curve(SIGMA0_TODAY, times_s),
        "projected_1e-17": bound_curve(SIGMA0_PROJECTED, times_s),
        "theory_1e-19": bound_curve(SIGMA0_THEORY, times_s),
    }

    xings = {
        name: crossover_time(s0)
        for name, s0 in (
            ("today_3e-12", SIGMA0_TODAY),
            ("projected_1e-17", SIGMA0_PROJECTED),
            ("theory_1e-19", SIGMA0_THEORY),
        )
    }
    for name, t in xings.items():
        if t is None:
            continue
        print(f"  {name}: overtakes ~{EXISTING_KAPPA_LIMIT:.0e} at τ ≈ {t/SECONDS_PER_DAY:.2f} days")

    payload = {
        "title": "The Amplified Seam",
        "marker": "v-chronal-amplified-seam-v4",
        "delta_U_c2": DELTA_U_C2,
        "K_alpha_Th": K_ALPHA_TH,
        "K_alpha_Sr": K_ALPHA_SR,
        "existing_kappa_limit": EXISTING_KAPPA_LIMIT,
        "day_scale_check": check,
        "lange_reproduction": lange,
        "crossover_seconds": xings,
        "honesty": [
            "no_first_cross_sector_claim",
            "no_85sigma_vs_bound",
            "th_noise_verify_vs_PTB_abstract",
            "analysis_proposal_not_new_lab",
        ],
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str) + "\n")
    print(f"\nWrote {OUT_JSON}")

    if not HAS_MPL:
        print("matplotlib missing — JSON only (fail-closed figure)")
        return

    fig, ax = plt.subplots(figsize=(9.2, 5.6), dpi=140)
    fig.patch.set_facecolor("#0a0a0f")
    ax.set_facecolor("#12121a")

    t_days = times_s / SECONDS_PER_DAY
    ax.loglog(t_days, curves["today_3e-12"], color="#ff9b6b", lw=2.2, label=r"Today $\sim 3\times10^{-12}/\sqrt{\tau}$")
    ax.loglog(t_days, curves["projected_1e-17"], color="#d4a843", lw=2.2, label=r"Projected $10^{-17}$")
    ax.loglog(t_days, curves["theory_1e-19"], color="#4a9eff", lw=2.2, label=r"Theoretical $10^{-19}$")
    ax.axhline(EXISTING_KAPPA_LIMIT, color="#8888aa", ls="--", lw=1.4, label=r"Existing $\kappa$ class $\sim10^{-7}$")

    ax.set_xlabel("Integration time (days)", color="#e8e8f0")
    ax.set_ylabel(r"Bound on $\kappa$  (sketch: $\sigma_R / (K_\alpha\cdot\Delta U/c^2)$)", color="#e8e8f0")
    ax.set_title("The Amplified Seam — Th-229 amplified LPI sensitivity", color="#e8e8f0", pad=12)
    ax.tick_params(colors="#8888aa")
    for spine in ax.spines.values():
        spine.set_color("#2a2a3a")
    leg = ax.legend(facecolor="#1a1a25", edgecolor="#2a2a3a", labelcolor="#e8e8f0", fontsize=8.5)
    ax.grid(True, which="both", alpha=0.18, color="#555569")
    ax.text(
        0.02,
        0.02,
        "Bound ≠ detection σ · no 85σ · verify Th floor vs PTB abstract",
        transform=ax.transAxes,
        color="#555569",
        fontsize=7.5,
    )
    fig.tight_layout()
    fig.savefig(OUT_PNG, facecolor=fig.get_facecolor())
    try:
        fig.savefig(LIB_PNG, facecolor=fig.get_facecolor())
    except OSError:
        pass
    plt.close(fig)
    print(f"Wrote {OUT_PNG}")
    if LIB_PNG.exists():
        print(f"Wrote {LIB_PNG}")


if __name__ == "__main__":
    main()
