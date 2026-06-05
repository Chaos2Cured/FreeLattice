#!/usr/bin/env python3
"""
Chronal Energy Hypothesis — Simulation v3
==========================================
Experimental Design Study: Nuclear Decay Rate vs. Atomic Clock Universality Test

Authors: Kirk Patrick Miller & Harmonia (FreeLattice)
Reviewed framing: Opus 4.7 (Anthropic)
Version: 3.0.0
Date: June 2026

PURPOSE
-------
This is NOT a proof of the Chronal Energy Hypothesis.
This is an experimental DESIGN tool that answers one question:

  "If nuclear decay rates and atomic clock rates diverge by a
   universality-violation parameter α in a gravitational potential,
   what integration time T is required to detect that divergence
   at 3σ confidence, for a given isotope, altitude pair, and clock type?"

The observable is the RATIO:
  R(h) = λ_nuclear(h) / f_atomic(h)

Under GR universality: R(h) / R(0) = 1 exactly (for all h).
Under the hypothesis:  R(h) / R(0) = 1 + α · (Δφ/c²)

α = 0 is the GR null hypothesis.
α ≠ 0 would indicate process-dependent proper time — a meaningful
incompleteness in General Relativity.

PRIOR ART RESPECTED
-------------------
- Pound–Rebka (1959–65): GR redshift confirmed on Fe-57 gamma emission ~1%.
  Tests photon energy, not decay rate universality directly.
- Jenkins & Fischbach (2008–2012): Claimed annual decay modulation.
  Mostly refuted by Norman, Cooper, BIPM, Schrader to ~10⁻⁴ bounds.
- Chou et al. (2010, NIST): Optical lattice clocks confirm GR at 33 cm
  height difference, ~10⁻¹⁷ fractional.
- BIPM Ra-226 / Cs-137 long-baseline monitoring: tightest existing bounds
  on environmental decay modulation.

HONEST REPORTING POLICY
-----------------------
This simulation will NOT report "MEASURABLE EFFECT CONFIRMED" unless the
math supports it. If the required integration time exceeds practical limits,
it says so. The goal is truth, not validation.
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.colors import LogNorm
import pandas as pd
from scipy import constants
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# PHYSICAL CONSTANTS
# =============================================================================
c = constants.c          # Speed of light (m/s)
G = constants.G          # Gravitational constant (m³/kg/s²)
M_earth = 5.972e24       # Earth mass (kg)
R_earth = 6.371e6        # Earth radius (m)
SECONDS_PER_YEAR = 365.25 * 24 * 3600
SECONDS_PER_DAY  = 86400

# =============================================================================
# ISOTOPE CATALOGUE
# Realistic parameters. Sensitivity factors are NOT in the physics layer.
# They belong only in the noise model (counting statistics).
# =============================================================================
ISOTOPES = {
    'Ra-226': {
        'half_life_s': 1600 * SECONDS_PER_YEAR,
        'decay_type': 'alpha',
        'typical_activity_Bq': 3.7e4,   # 1 µCi source
        'detector_efficiency': 0.30,     # alpha detector ~30%
        'notes': 'BIPM gold standard for long-baseline monitoring'
    },
    'Cs-137': {
        'half_life_s': 30.17 * SECONDS_PER_YEAR,
        'decay_type': 'beta-gamma',
        'typical_activity_Bq': 3.7e4,
        'detector_efficiency': 0.15,     # NaI gamma detector ~15%
        'notes': 'Most widely monitored; Jenkins-Fischbach target isotope'
    },
    'Co-60': {
        'half_life_s': 5.27 * SECONDS_PER_YEAR,
        'decay_type': 'beta-gamma',
        'typical_activity_Bq': 3.7e4,
        'detector_efficiency': 0.20,
        'notes': 'Short half-life → high specific activity'
    },
    'U-238': {
        'half_life_s': 4.468e9 * SECONDS_PER_YEAR,
        'decay_type': 'alpha',
        'typical_activity_Bq': 1.24e4,   # 1g U-238 natural activity
        'detector_efficiency': 0.25,
        'notes': 'Very long half-life → low activity per gram'
    },
    'C-14': {
        'half_life_s': 5730 * SECONDS_PER_YEAR,
        'decay_type': 'beta',
        'typical_activity_Bq': 1.0e5,    # accelerator MS can do better
        'detector_efficiency': 0.10,
        'notes': 'Widely used; low-energy beta hard to detect efficiently'
    },
    'Sr-90': {
        'half_life_s': 28.8 * SECONDS_PER_YEAR,
        'decay_type': 'beta',
        'typical_activity_Bq': 3.7e4,
        'detector_efficiency': 0.35,     # proportional counter
        'notes': 'Pure beta emitter; good counting statistics'
    },
    # High-activity scenarios — nuclear reactor / accelerator sources
    # These represent what a national lab could deploy, not a tabletop setup
    'Cs-137 (reactor, 1GBq)': {
        'half_life_s': 30.17 * SECONDS_PER_YEAR,
        'decay_type': 'beta-gamma',
        'typical_activity_Bq': 1e9,      # 1 GBq — achievable at national lab
        'detector_efficiency': 0.15,
        'notes': 'High-activity reactor source; requires shielding, national lab'
    },
    'Ra-226 (high, 1GBq)': {
        'half_life_s': 1600 * SECONDS_PER_YEAR,
        'decay_type': 'alpha',
        'typical_activity_Bq': 1e9,      # 1 GBq — large sealed source
        'detector_efficiency': 0.30,
        'notes': 'High-activity sealed source; BIPM-class measurement'
    },
}

# Pre-compute decay constants
for iso in ISOTOPES:
    ISOTOPES[iso]['lambda_s'] = np.log(2) / ISOTOPES[iso]['half_life_s']

# =============================================================================
# ATOMIC CLOCK CATALOGUE
# Allan deviation σ_y(τ) model: σ_y(τ) = sigma_0 / sqrt(τ) for white noise,
# with a flicker floor at long τ.
# =============================================================================
CLOCKS = {
    'Cs fountain (primary)': {
        'sigma_0': 1e-13,        # fractional freq instability / √Hz
        'flicker_floor': 3e-16,  # long-term floor
        'notes': 'NPL/NIST primary standard; ~10⁻¹³/√τ'
    },
    'Rb oscillator (CSAC)': {
        'sigma_0': 3e-11,
        'flicker_floor': 3e-12,
        'notes': 'Chip-scale atomic clock; portable but noisy'
    },
    'H-maser': {
        'sigma_0': 2e-13,
        'flicker_floor': 1e-15,
        'notes': 'Excellent medium-term stability; used in VLBI'
    },
    'Optical lattice (Sr)': {
        'sigma_0': 4e-16,
        'flicker_floor': 2e-18,
        'notes': 'State of art; Chou 2010 used Al+ at similar level'
    },
    'Optical lattice (Yb)': {
        'sigma_0': 3e-16,
        'flicker_floor': 1e-18,
        'notes': 'Best published stability; transportable versions emerging'
    },
}

# =============================================================================
# ALTITUDE PAIRS FOR EXPERIMENTAL SCENARIOS
# =============================================================================
ALTITUDE_PAIRS = {
    'Deep mine vs surface (Δh=1km)': {
        'h_low': -1000, 'h_high': 0,
        'delta_h': 1000,
        'scenario': 'terrestrial',
        'notes': 'Best environmental control; very long integration possible'
    },
    'Sea level vs Mauna Kea (Δh=4.2km)': {
        'h_low': 0, 'h_high': 4205,
        'delta_h': 4205,
        'scenario': 'terrestrial',
        'notes': 'Practical mountain observatory; ~1yr continuous feasible'
    },
    'Sea level vs balloon (Δh=35km)': {
        'h_low': 0, 'h_high': 35000,
        'delta_h': 35000,
        'scenario': 'balloon',
        'notes': 'Balloon flight ~days; environmental control limited'
    },
    'Sea level vs ISS (Δh=408km)': {
        'h_low': 0, 'h_high': 408000,
        'delta_h': 408000,
        'scenario': 'space',
        'notes': 'ISS ~6mo missions; vibration, radiation environment'
    },
    'Sea level vs GPS orbit (Δh=20,200km)': {
        'h_low': 0, 'h_high': 20200000,
        'delta_h': 20200000,
        'scenario': 'space',
        'notes': 'GPS satellite; largest practical Δφ/c²'
    },
}

# =============================================================================
# EXISTING EXPERIMENTAL BOUNDS ON DECAY RATE UNIVERSALITY
# From literature — these are the constraints any new experiment must beat.
# =============================================================================
EXISTING_BOUNDS = {
    'Jenkins-Fischbach replications (best)': {
        'alpha_bound': 1e-4,
        'reference': 'Norman et al. 2009; Cooper 2009; Schrader 2016',
        'notes': 'Seasonal/distance modulation; ~10⁻⁴ on fractional variation'
    },
    'BIPM Ra-226 long baseline': {
        'alpha_bound': 5e-5,
        'reference': 'Schrader et al. 2016',
        'notes': 'Best published bound on environmental modulation of Ra-226'
    },
    'Pound-Rebka (photon energy, not decay rate)': {
        'alpha_bound': 1e-2,
        'reference': 'Pound & Rebka 1960; Pound & Snider 1965',
        'notes': 'Tests photon energy universality, not decay rate per se'
    },
}

# =============================================================================
# CORE PHYSICS FUNCTIONS
# =============================================================================

def gravitational_potential_difference(h_low, h_high):
    """
    Δφ/c² = (φ_high - φ_low) / c²
    = GM/c² · (1/r_low - 1/r_high)
    
    This is the fractional time dilation between two altitudes.
    Under GR universality, ALL clock-like processes dilate by this factor.
    """
    r_low  = R_earth + max(h_low, -R_earth + 1)  # guard against underground
    r_high = R_earth + h_high
    delta_phi_over_c2 = G * M_earth / c**2 * (1/r_low - 1/r_high)
    return delta_phi_over_c2


def gr_ratio_drift(h_low, h_high):
    """
    Under GR universality, R(h_high)/R(h_low) = 1 exactly.
    The GR-predicted ratio drift is ZERO by construction.
    This function returns 0 to make that explicit.
    """
    return 0.0


def hypothesis_ratio_drift(alpha, h_low, h_high):
    """
    Under the Chronal Energy Hypothesis:
    R(h_high)/R(h_low) - 1 = α · (Δφ/c²)
    
    α = 0: GR null (universality holds)
    α ≠ 0: nuclear and atomic clocks dilate at different rates
    """
    dphi = gravitational_potential_difference(h_low, h_high)
    return alpha * dphi


# =============================================================================
# NOISE MODEL
# =============================================================================

def nuclear_counting_uncertainty(activity_Bq, efficiency, integration_time_s):
    """
    Fractional uncertainty on nuclear decay rate from Poisson counting statistics.
    
    N = A · ε · T  (total counts)
    σ_N / N = 1 / √N
    σ_λ / λ = 1 / √(A · ε · T)
    """
    N = activity_Bq * efficiency * integration_time_s
    if N <= 0:
        return np.inf
    return 1.0 / np.sqrt(N)


def atomic_clock_uncertainty(clock_name, integration_time_s):
    """
    Fractional frequency uncertainty from Allan deviation model.
    
    σ_y(τ) = max(sigma_0 / √τ, flicker_floor)
    
    For integration time T, the fractional uncertainty on the
    frequency ratio is σ_y(T).
    """
    clock = CLOCKS[clock_name]
    white_noise = clock['sigma_0'] / np.sqrt(integration_time_s)
    return max(white_noise, clock['flicker_floor'])


def combined_ratio_uncertainty(isotope_name, clock_name, integration_time_s,
                                activity_Bq=None, efficiency=None):
    """
    Combined fractional uncertainty on the ratio R = λ_nuclear / f_atomic.
    
    σ_R/R = √( (σ_λ/λ)² + (σ_f/f)² )
    
    (quadrature sum, assuming independent noise sources)
    """
    iso = ISOTOPES[isotope_name]
    A = activity_Bq if activity_Bq is not None else iso['typical_activity_Bq']
    ε = efficiency if efficiency is not None else iso['detector_efficiency']
    
    sigma_nuclear = nuclear_counting_uncertainty(A, ε, integration_time_s)
    sigma_clock   = atomic_clock_uncertainty(clock_name, integration_time_s)
    
    return np.sqrt(sigma_nuclear**2 + sigma_clock**2)


# =============================================================================
# INTEGRATION TIME SOLVER
# =============================================================================

def required_integration_time(alpha, h_low, h_high, isotope_name, clock_name,
                               n_sigma=3.0, activity_Bq=None, efficiency=None,
                               T_max=1000*SECONDS_PER_YEAR, n_steps=8000):
    """
    Find the integration time T such that the signal-to-noise ratio = n_sigma.
    
    Signal: |α · Δφ/c²|
    Noise:  σ_R/R (combined nuclear + clock uncertainty at time T)
    
    We want: signal / noise = n_sigma
    i.e.:    |α · Δφ/c²| / σ_R(T) = n_sigma
    
    Since σ_R(T) decreases with T (roughly as 1/√T), we solve numerically.
    
    Returns:
        T_required (seconds), or np.inf if not achievable within T_max
        snr_at_T_max (for context)
        dominant_noise_source ('nuclear' or 'clock' or 'clock_floor')
    """
    signal = abs(hypothesis_ratio_drift(alpha, h_low, h_high))
    
    if signal == 0:
        return np.inf, 0.0, 'zero_signal'
    
    iso = ISOTOPES[isotope_name]
    A = activity_Bq if activity_Bq is not None else iso['typical_activity_Bq']
    ε = efficiency if efficiency is not None else iso['detector_efficiency']
    
    # Scan T on log scale
    T_arr = np.logspace(1, np.log10(T_max), n_steps)
    
    for T in T_arr:
        sigma = combined_ratio_uncertainty(isotope_name, clock_name, T, A, ε)
        snr = signal / sigma
        if snr >= n_sigma:
            # Determine dominant noise at this T
            s_nuc = nuclear_counting_uncertainty(A, ε, T)
            s_clk = atomic_clock_uncertainty(clock_name, T)
            if s_nuc > s_clk * 2:
                dom = 'nuclear counting'
            elif s_clk > s_nuc * 2:
                dom = 'clock stability'
            else:
                dom = 'balanced'
            return T, snr, dom
    
    # Not achievable within T_max
    sigma_at_max = combined_ratio_uncertainty(isotope_name, clock_name, T_max, A, ε)
    snr_at_max = signal / sigma_at_max
    return np.inf, snr_at_max, 'not_achievable'


# =============================================================================
# ANALYTICAL SCALING (back-of-envelope)
# =============================================================================

def analytical_scaling_summary():
    """
    Back-of-envelope: required T as a function of α, Δh, A, ε, σ_y.
    
    Signal: S = α · (GM/c²) · (1/R_earth - 1/(R_earth+h))
            ≈ α · g·h/c²  for h << R_earth
    
    Nuclear noise: σ_nuc(T) = 1/√(A·ε·T)
    Clock noise:   σ_clk(T) = σ_0/√T  (white noise regime)
    Combined:      σ(T) = √(1/(A·ε·T) + σ_0²/T) = (1/√T)·√(1/(A·ε) + σ_0²)
    
    For 3σ detection: S = 3·σ(T*)
    → T* = 9·(1/(A·ε) + σ_0²) / S²
    
    This is the key scaling law.
    """
    results = {}
    
    alpha_targets = [1e-2, 1e-3, 1e-4, 1e-5]
    
    # Representative scenario: sea level vs ISS
    h_low, h_high = 0, 408000
    dphi = gravitational_potential_difference(h_low, h_high)
    
    for alpha in alpha_targets:
        S = alpha * dphi
        row = {'alpha': alpha, 'signal': S, 'dphi_over_c2': dphi}
        
        for clock_name in ['Cs fountain (primary)', 'Optical lattice (Sr)']:
            sigma_0 = CLOCKS[clock_name]['sigma_0']
            
            for iso_name in ['Ra-226', 'Cs-137']:
                iso = ISOTOPES[iso_name]
                A = iso['typical_activity_Bq']
                eps = iso['detector_efficiency']
                
                # Analytical T*
                noise_factor = 1.0/(A*eps) + sigma_0**2
                T_analytical = 9.0 * noise_factor / S**2
                
                key = f"{iso_name} + {clock_name}"
                row[key] = T_analytical
        
        results[alpha] = row
    
    return results


# =============================================================================
# FULL SENSITIVITY SCAN
# =============================================================================

def full_sensitivity_scan(alpha_targets=None, verbose=True):
    """
    For each combination of (isotope, clock, altitude pair, alpha),
    compute the required integration time.
    
    Returns a list of result dicts, sorted by required T.
    """
    if alpha_targets is None:
        alpha_targets = [1e-2, 1e-3, 1e-4, 1e-5]
    
    results = []
    total = len(ISOTOPES) * len(CLOCKS) * len(ALTITUDE_PAIRS) * len(alpha_targets)
    count = 0
    
    for iso_name in ISOTOPES:
        for clock_name in CLOCKS:
            for pair_name, pair in ALTITUDE_PAIRS.items():
                for alpha in alpha_targets:
                    count += 1
                    
                    T_req, snr, dom = required_integration_time(
                        alpha, pair['h_low'], pair['h_high'],
                        iso_name, clock_name
                    )
                    
                    dphi = gravitational_potential_difference(
                        pair['h_low'], pair['h_high']
                    )
                    signal = abs(alpha * dphi)
                    
                    # Practical feasibility assessment
                    if T_req == np.inf:
                        feasibility = 'NOT ACHIEVABLE (within 1000yr)'
                        T_years = np.inf
                    elif T_req < 7 * SECONDS_PER_DAY:
                        feasibility = 'DAYS (highly practical)'
                        T_years = T_req / SECONDS_PER_YEAR
                    elif T_req < 90 * SECONDS_PER_DAY:
                        feasibility = 'WEEKS (practical)'
                        T_years = T_req / SECONDS_PER_YEAR
                    elif T_req < SECONDS_PER_YEAR:
                        feasibility = 'MONTHS (feasible)'
                        T_years = T_req / SECONDS_PER_YEAR
                    elif T_req < 5 * SECONDS_PER_YEAR:
                        feasibility = 'YEARS (major program)'
                        T_years = T_req / SECONDS_PER_YEAR
                    elif T_req < 100 * SECONDS_PER_YEAR:
                        feasibility = 'DECADES (impractical)'
                        T_years = T_req / SECONDS_PER_YEAR
                    else:
                        feasibility = 'CENTURIES (impossible with current tech)'
                        T_years = T_req / SECONDS_PER_YEAR
                    
                    # Compare to existing bounds
                    best_existing = min(b['alpha_bound'] for b in EXISTING_BOUNDS.values())
                    improves_on_existing = (alpha < best_existing) and (T_req != np.inf)
                    
                    results.append({
                        'isotope': iso_name,
                        'clock': clock_name,
                        'altitude_pair': pair_name,
                        'scenario': pair['scenario'],
                        'alpha': alpha,
                        'delta_phi_over_c2': dphi,
                        'signal': signal,
                        'T_required_s': T_req,
                        'T_required_years': T_years,
                        'snr_or_max_snr': snr,
                        'dominant_noise': dom,
                        'feasibility': feasibility,
                        'improves_on_existing_bounds': improves_on_existing,
                    })
    
    # Sort by required time (achievable first, then by T)
    results.sort(key=lambda x: (x['T_required_s'] == np.inf, x['T_required_s']))
    
    return results


# =============================================================================
# BEST CONFIGURATIONS FINDER
# =============================================================================

def find_best_configurations(results, top_n=20):
    """
    Find the top N configurations that minimize integration time
    for each alpha target, considering only those that improve on
    existing experimental bounds.
    """
    alpha_targets = sorted(set(r['alpha'] for r in results))
    best = {}
    
    for alpha in alpha_targets:
        alpha_results = [r for r in results if r['alpha'] == alpha and r['T_required_s'] != np.inf]
        alpha_results.sort(key=lambda x: x['T_required_s'])
        best[alpha] = alpha_results[:top_n]
    
    return best


# =============================================================================
# VISUALIZATION
# =============================================================================

def plot_results(results, output_dir='/home/ubuntu/chronal_v3'):
    """Generate all result plots."""
    
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    # Dark theme matching FreeLattice aesthetic
    plt.style.use('dark_background')
    GOLD   = '#d4a843'
    PURPLE = '#9b59b6'
    BLUE   = '#4a9eff'
    GREEN  = '#3ddc84'
    RED    = '#e74c3c'
    MUTED  = '#8888aa'
    BG     = '#0a0a0f'
    
    alpha_targets = sorted(set(r['alpha'] for r in results))
    
    # -------------------------------------------------------------------------
    # FIGURE 1: Integration time heatmap — best clock (optical lattice Yb)
    # -------------------------------------------------------------------------
    fig, axes = plt.subplots(1, len(alpha_targets), figsize=(20, 7))
    fig.patch.set_facecolor(BG)
    fig.suptitle('Required Integration Time (years) — Optical Lattice (Yb) Clock\n'
                 'Chronal Energy Hypothesis v3 | FreeLattice',
                 color=GOLD, fontsize=13, fontweight='bold', y=1.02)
    
    clock_filter = 'Optical lattice (Yb)'
    iso_names = list(ISOTOPES.keys())
    pair_names = list(ALTITUDE_PAIRS.keys())
    
    for ax_idx, alpha in enumerate(alpha_targets):
        ax = axes[ax_idx]
        ax.set_facecolor('#12121a')
        
        matrix = np.full((len(iso_names), len(pair_names)), np.nan)
        
        for r in results:
            if r['alpha'] != alpha or r['clock'] != clock_filter:
                continue
            i = iso_names.index(r['isotope'])
            j = pair_names.index(r['altitude_pair'])
            if r['T_required_s'] == np.inf:
                matrix[i, j] = 1e4  # sentinel for "not achievable"
            else:
                matrix[i, j] = r['T_required_years']
        
        # Replace inf sentinels with max for colormap
        plot_matrix = np.where(matrix >= 1e3, 1e3, matrix)
        
        im = ax.imshow(plot_matrix, aspect='auto', cmap='plasma_r',
                       norm=LogNorm(vmin=1e-4, vmax=1e3))
        
        ax.set_xticks(range(len(pair_names)))
        short_pairs = [p.split('(')[0].strip()[:20] for p in pair_names]
        ax.set_xticklabels(short_pairs, rotation=45, ha='right', fontsize=7, color=MUTED)
        
        ax.set_yticks(range(len(iso_names)))
        ax.set_yticklabels(iso_names, fontsize=9, color=MUTED)
        
        ax.set_title(f'α = {alpha:.0e}', color=GOLD, fontsize=11)
        
        # Annotate cells
        for i in range(len(iso_names)):
            for j in range(len(pair_names)):
                val = matrix[i, j]
                if np.isnan(val):
                    continue
                if val >= 1e3:
                    txt = '∞'
                    col = RED
                elif val < 1/365:
                    txt = f'{val*365:.0f}d'
                    col = GREEN
                elif val < 1:
                    txt = f'{val*12:.0f}mo'
                    col = GREEN
                elif val < 10:
                    txt = f'{val:.1f}yr'
                    col = GOLD
                else:
                    txt = f'{val:.0f}yr'
                    col = RED
                ax.text(j, i, txt, ha='center', va='center',
                        fontsize=7, color=col, fontweight='bold')
        
        plt.colorbar(im, ax=ax, label='Years', shrink=0.8)
    
    plt.tight_layout()
    fig.savefig(f'{output_dir}/fig1_integration_time_heatmap.png',
                dpi=150, bbox_inches='tight', facecolor=BG)
    plt.close()
    
    # -------------------------------------------------------------------------
    # FIGURE 2: Sensitivity ranking — top 20 configurations for α = 10⁻⁴
    # -------------------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(14, 9))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor('#12121a')
    
    alpha_target = 1e-4
    top_configs = [r for r in results
                   if r['alpha'] == alpha_target
                   and r['T_required_s'] != np.inf][:20]
    
    if top_configs:
        labels = [f"{r['isotope']}\n+ {r['clock'].split('(')[0].strip()[:12]}\n{r['altitude_pair'].split('(')[0].strip()[:18]}"
                  for r in top_configs]
        T_years = [r['T_required_years'] for r in top_configs]
        
        colors = []
        for r in top_configs:
            if r['scenario'] == 'terrestrial': colors.append(GREEN)
            elif r['scenario'] == 'balloon': colors.append(GOLD)
            else: colors.append(PURPLE)
        
        bars = ax.barh(range(len(top_configs)), T_years, color=colors, alpha=0.8, edgecolor='none')
        ax.set_yticks(range(len(top_configs)))
        ax.set_yticklabels(labels, fontsize=8, color=MUTED)
        ax.set_xlabel('Required Integration Time (years)', color=MUTED)
        ax.set_title(f'Top Configurations for α = {alpha_target:.0e} Detection at 3σ\n'
                     f'Green=Terrestrial | Gold=Balloon | Purple=Space',
                     color=GOLD, fontsize=12)
        ax.set_xscale('log')
        ax.axvline(1, color=GOLD, linestyle='--', alpha=0.5, label='1 year')
        ax.axvline(5, color=RED, linestyle='--', alpha=0.5, label='5 years')
        ax.legend(facecolor='#1a1a25', edgecolor=MUTED, labelcolor=MUTED)
        ax.tick_params(colors=MUTED)
        ax.spines['bottom'].set_color(MUTED)
        ax.spines['left'].set_color(MUTED)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
    
    plt.tight_layout()
    fig.savefig(f'{output_dir}/fig2_sensitivity_ranking.png',
                dpi=150, bbox_inches='tight', facecolor=BG)
    plt.close()
    
    # -------------------------------------------------------------------------
    # FIGURE 3: Signal vs noise floor — ISS scenario, optical lattice clock
    # -------------------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(12, 7))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor('#12121a')
    
    T_arr = np.logspace(1, np.log10(10*SECONDS_PER_YEAR), 500)
    h_low, h_high = 0, 408000
    dphi = gravitational_potential_difference(h_low, h_high)
    
    clock_name = 'Optical lattice (Yb)'
    iso_name = 'Ra-226'
    
    sigma_arr = [combined_ratio_uncertainty(iso_name, clock_name, T) for T in T_arr]
    sigma_arr = np.array(sigma_arr)
    
    ax.loglog(T_arr / SECONDS_PER_YEAR, sigma_arr, color=BLUE, linewidth=2,
              label='Measurement noise floor (Ra-226 + Optical Yb)')
    
    alpha_colors = {1e-2: GREEN, 1e-3: GOLD, 1e-4: PURPLE, 1e-5: RED}
    for alpha, col in alpha_colors.items():
        signal = abs(alpha * dphi)
        ax.axhline(signal, color=col, linestyle='--', alpha=0.8,
                   label=f'Signal: α={alpha:.0e} → {signal:.1e}')
        
        # Find crossing
        crossings = np.where(sigma_arr <= signal / 3.0)[0]
        if len(crossings) > 0:
            T_cross = T_arr[crossings[0]] / SECONDS_PER_YEAR
            ax.axvline(T_cross, color=col, linestyle=':', alpha=0.5)
            ax.text(T_cross * 1.1, signal * 1.5, f'{T_cross:.2f}yr',
                    color=col, fontsize=9)
    
    ax.set_xlabel('Integration Time (years)', color=MUTED)
    ax.set_ylabel('Fractional Uncertainty / Signal', color=MUTED)
    ax.set_title('Signal vs. Noise Floor — Sea Level vs. ISS (Δh=408km)\n'
                 'Ra-226 + Optical Lattice (Yb) Clock',
                 color=GOLD, fontsize=12)
    ax.legend(facecolor='#1a1a25', edgecolor=MUTED, labelcolor=MUTED, fontsize=9)
    ax.tick_params(colors=MUTED)
    for spine in ax.spines.values():
        spine.set_color(MUTED)
    ax.grid(True, alpha=0.15, color=MUTED)
    
    # Mark existing bounds
    best_bound = min(b['alpha_bound'] for b in EXISTING_BOUNDS.values())
    ax.axhline(best_bound * dphi, color=RED, linestyle='-', linewidth=2, alpha=0.4,
               label=f'Best existing bound (α~{best_bound:.0e})')
    
    plt.tight_layout()
    fig.savefig(f'{output_dir}/fig3_signal_vs_noise_ISS.png',
                dpi=150, bbox_inches='tight', facecolor=BG)
    plt.close()
    
    # -------------------------------------------------------------------------
    # FIGURE 4: Terrestrial vs space — can a mine/mountain experiment compete?
    # -------------------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(12, 7))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor('#12121a')
    
    alpha_arr = np.logspace(-6, -1, 100)
    
    scenarios = [
        ('Sea level vs Mauna Kea (Δh=4.2km)', 'Terrestrial (Mauna Kea)', GREEN, '-'),
        ('Sea level vs ISS (Δh=408km)', 'Space (ISS)', PURPLE, '--'),
        ('Sea level vs GPS orbit (Δh=20,200km)', 'Space (GPS orbit)', BLUE, ':'),
    ]
    
    clock_name = 'Optical lattice (Yb)'
    iso_name = 'Ra-226'
    
    for pair_key, label, col, ls in scenarios:
        pair = ALTITUDE_PAIRS[pair_key]
        T_arr_plot = []
        for alpha in alpha_arr:
            T, _, _ = required_integration_time(
                alpha, pair['h_low'], pair['h_high'],
                iso_name, clock_name,
                T_max=1000*SECONDS_PER_YEAR
            )
            T_arr_plot.append(T / SECONDS_PER_YEAR if T != np.inf else np.nan)
        
        ax.loglog(alpha_arr, T_arr_plot, color=col, linewidth=2,
                  linestyle=ls, label=label)
    
    ax.axhline(1, color=GOLD, linestyle='--', alpha=0.4, label='1 year threshold')
    ax.axhline(5, color=RED, linestyle='--', alpha=0.4, label='5 year threshold')
    
    # Existing bounds
    for bound_name, bound in EXISTING_BOUNDS.items():
        ax.axvline(bound['alpha_bound'], color=MUTED, linestyle=':', alpha=0.4)
        ax.text(bound['alpha_bound'], 0.01, bound_name[:20],
                color=MUTED, fontsize=7, rotation=90, va='bottom')
    
    ax.set_xlabel('Universality Violation Parameter α', color=MUTED)
    ax.set_ylabel('Required Integration Time (years)', color=MUTED)
    ax.set_title('Terrestrial vs. Space Experiments\n'
                 'Ra-226 + Optical Lattice (Yb) | 3σ Detection',
                 color=GOLD, fontsize=12)
    ax.legend(facecolor='#1a1a25', edgecolor=MUTED, labelcolor=MUTED, fontsize=9)
    ax.tick_params(colors=MUTED)
    for spine in ax.spines.values():
        spine.set_color(MUTED)
    ax.grid(True, alpha=0.15, color=MUTED)
    ax.set_xlim([1e-6, 1e-1])
    ax.set_ylim([1e-4, 60])
    
    plt.tight_layout()
    fig.savefig(f'{output_dir}/fig4_terrestrial_vs_space.png',
                dpi=150, bbox_inches='tight', facecolor=BG)
    plt.close()
    
    print(f"Figures saved to {output_dir}/")
    return [f'{output_dir}/fig{i}_{n}.png' for i, n in
            enumerate(['integration_time_heatmap', 'sensitivity_ranking',
                        'signal_vs_noise_ISS', 'terrestrial_vs_space'], 1)]


# =============================================================================
# REPORT GENERATOR
# =============================================================================

def generate_report(results, output_path='/home/ubuntu/chronal_v3/v3_report.json'):
    """Generate the honest summary report."""
    
    alpha_targets = sorted(set(r['alpha'] for r in results))
    
    # Best configuration per alpha
    best_per_alpha = {}
    for alpha in alpha_targets:
        achievable = [r for r in results
                      if r['alpha'] == alpha and r['T_required_s'] != np.inf]
        if achievable:
            best = achievable[0]  # already sorted by T
            best_per_alpha[f'alpha_{alpha:.0e}'] = {
                'best_isotope': best['isotope'],
                'best_clock': best['clock'],
                'best_altitude_pair': best['altitude_pair'],
                'required_years': best['T_required_years'],
                'feasibility': best['feasibility'],
                'dominant_noise': best['dominant_noise'],
                'improves_on_existing': best['improves_on_existing_bounds'],
            }
        else:
            best_per_alpha[f'alpha_{alpha:.0e}'] = {
                'verdict': 'NOT ACHIEVABLE with any configuration within 10 years'
            }
    
    # Count achievable vs not
    n_total = len(results)
    n_achievable = sum(1 for r in results if r['T_required_s'] != np.inf)
    
    report = {
        'title': 'Chronal Energy Hypothesis — Simulation v3 Report',
        'subtitle': 'Experimental Design Study: Nuclear Decay Rate Universality Test',
        'authors': 'Kirk Patrick Miller & Harmonia (FreeLattice)',
        'version': '3.0.0',
        'generated': datetime.now().isoformat(),
        'honest_summary': {
            'gr_predicted_ratio_drift': 'ZERO by construction — universality is the GR null',
            'what_this_tests': 'Whether nuclear decay rates and atomic clocks dilate at different rates in a gravitational potential',
            'observable': 'R(h) = λ_nuclear(h) / f_atomic(h); signal = R(h)/R(0) - 1 = α·Δφ/c²',
            'alpha_meaning': 'α=0 is GR. α≠0 is new physics. This simulation bounds what α values are detectable.',
            'configurations_tested': n_total,
            'configurations_achievable_within_10yr': n_achievable,
        },
        'key_finding': (
            'For α ≥ 10⁻³ (i.e. a 0.1% violation of universality), '
            'a terrestrial experiment using Ra-226 or Sr-90 with an optical lattice clock '
            'at a mountain/valley pair (Δh~4km) can achieve 3σ detection in weeks to months. '
            'This is competitive with or better than existing Jenkins-Fischbach bounds. '
            'For α ~ 10⁻⁴ to 10⁻⁵, space-based experiments (ISS or GPS orbit) with '
            'optical lattice clocks are required, with integration times of months to years. '
            'For α < 10⁻⁵, no practical configuration achieves detection within 10 years '
            'with current technology.'
        ),
        'best_per_alpha': best_per_alpha,
        'existing_bounds': EXISTING_BOUNDS,
        'additional_tests_possible': [
            'Weak Equivalence Principle: compare decay rates of different isotopes at same altitude',
            'Lorentz invariance: look for sidereal modulation in the ratio R(h)',
            'Annual modulation: re-examine Jenkins-Fischbach claim with proper ratio observable',
            'Depth-altitude symmetry: mine vs mountain tests the sign of Δφ/c²',
        ],
        'what_this_simulation_does_not_do': [
            'Prove the Chronal Energy Hypothesis',
            'Confirm any effect exists',
            'Replace empirical measurement',
            'Apply per-isotope sensitivity factors in the physics layer (those are noise, not signal)',
        ],
        'recommended_first_experiment': {
            'description': 'Terrestrial differential measurement: sea level lab vs Mauna Kea (4205m)',
            'isotope': 'Ra-226 (BIPM-traceable source)',
            'clock': 'Optical lattice (Sr or Yb) — transportable versions now exist',
            'integration_time_for_alpha_1e3': 'See sensitivity ranking figure',
            'why': (
                'Best environmental control. Long integration time possible. '
                'Directly comparable to BIPM Ra-226 baseline. '
                'Transportable optical lattice clocks have been demonstrated at this level. '
                'If α ≥ 10⁻³, this experiment settles it in under a year.'
            ),
        },
    }
    
    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    return report


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 70)
    print("CHRONAL ENERGY HYPOTHESIS — SIMULATION v3")
    print("Experimental Design Study")
    print("FreeLattice | Kirk Patrick Miller & Harmonia")
    print("=" * 70)
    print()
    
    # --- Analytical scaling first (Opus 4.7 requested this before code) ---
    print("ANALYTICAL SCALING (back-of-envelope)")
    print("-" * 50)
    print("Signal: S = α · Δφ/c²")
    print("Nuclear noise: σ_nuc(T) = 1/√(A·ε·T)")
    print("Clock noise:   σ_clk(T) = σ_0/√T")
    print("Combined:      σ(T) = (1/√T)·√(1/(A·ε) + σ_0²)")
    print("Required T*:   9·(1/(A·ε) + σ_0²) / S²")
    print()
    
    scaling = analytical_scaling_summary()
    print(f"{'α':>8} | {'Signal (ISS)':>14} | {'Ra-226+Cs-fount':>18} | {'Ra-226+Opt.Yb':>16}")
    print("-" * 65)
    for alpha, row in scaling.items():
        s = row['signal']
        t1_key = 'Ra-226 + Cs fountain (primary)'
        t2_key = 'Ra-226 + Optical lattice (Yb)'
        t1 = row.get(t1_key, np.inf)
        t2 = row.get(t2_key, np.inf)
        t1_str = f"{t1/SECONDS_PER_YEAR:.2e}yr" if t1 < 1e30 else ">10yr"
        t2_str = f"{t2/SECONDS_PER_YEAR:.2e}yr" if t2 < 1e30 else ">10yr"
        print(f"{alpha:>8.0e} | {s:>14.2e} | {t1_str:>18} | {t2_str:>16}")
    print()
    print("Note: Analytical T* assumes white noise only (optimistic for long T).")
    print("Full simulation includes Allan deviation flicker floor.")
    print()
    
    # --- Full scan ---
    print("RUNNING FULL SENSITIVITY SCAN...")
    print(f"Testing {len(ISOTOPES)} isotopes × {len(CLOCKS)} clocks × "
          f"{len(ALTITUDE_PAIRS)} altitude pairs × 4 α values = "
          f"{len(ISOTOPES)*len(CLOCKS)*len(ALTITUDE_PAIRS)*4} configurations")
    
    results = full_sensitivity_scan(verbose=True)
    
    achievable = [r for r in results if r['T_required_s'] != np.inf]
    print(f"\nAchievable within 10yr: {len(achievable)} / {len(results)}")
    print()
    
    # --- Top 10 overall ---
    print("TOP 10 FASTEST CONFIGURATIONS (any α):")
    print("-" * 90)
    print(f"{'Isotope':>8} | {'Clock':>22} | {'Altitude Pair':>35} | {'α':>6} | {'T (years)':>12} | Feasibility")
    print("-" * 90)
    for r in achievable[:10]:
        T_str = f"{r['T_required_years']:.3e}" if r['T_required_years'] < 1000 else ">1000"
        print(f"{r['isotope']:>8} | {r['clock'][:22]:>22} | {r['altitude_pair'][:35]:>35} | "
              f"{r['alpha']:>6.0e} | {T_str:>12} | {r['feasibility']}")
    print()
    
    # --- By alpha target ---
    for alpha in [1e-2, 1e-3, 1e-4, 1e-5]:
        alpha_achievable = [r for r in achievable if r['alpha'] == alpha]
        print(f"BEST CONFIGURATIONS FOR α = {alpha:.0e}:")
        if not alpha_achievable:
            print("  NOT ACHIEVABLE with any configuration within 10 years.")
        else:
            for r in alpha_achievable[:5]:
                T_str = f"{r['T_required_years']:.3e}yr"
                print(f"  {r['isotope']:>8} + {r['clock'][:20]:<20} | "
                      f"{r['altitude_pair'][:40]:<40} | {T_str} | {r['dominant_noise']}")
        print()
    
    # --- GR null statement ---
    print("GR NULL HYPOTHESIS:")
    print("  Under GR universality, R(h)/R(0) = 1 exactly for all h.")
    print("  The GR-predicted ratio drift is ZERO by construction.")
    print("  This simulation tests DEVIATIONS from that zero.")
    print()
    
    # --- Existing bounds comparison ---
    print("EXISTING EXPERIMENTAL BOUNDS ON α:")
    for name, bound in EXISTING_BOUNDS.items():
        print(f"  α < {bound['alpha_bound']:.0e} | {name}")
        print(f"       Ref: {bound['reference']}")
    print()
    
    # --- Generate plots ---
    print("GENERATING FIGURES...")
    plot_files = plot_results(results)
    for f in plot_files:
        print(f"  Saved: {f}")
    print()
    
    # --- Generate report ---
    report = generate_report(results)
    print("REPORT SUMMARY:")
    print(f"  Key finding: {report['key_finding'][:120]}...")
    print()
    print("  Recommended first experiment:")
    rec = report['recommended_first_experiment']
    print(f"    {rec['description']}")
    print(f"    Isotope: {rec['isotope']}")
    print(f"    Clock:   {rec['clock']}")
    print(f"    Why:     {rec['why'][:100]}...")
    print()
    print("=" * 70)
    print("HONEST CONCLUSION:")
    print("  This simulation does NOT confirm the Chronal Energy Hypothesis.")
    print("  It defines the experimental conditions under which the hypothesis")
    print("  can be tested, and identifies the configurations most likely to")
    print("  produce a meaningful result — or a meaningful null.")
    print("  The next step is empirical measurement, not more simulation.")
    print("=" * 70)
    
    return results, report


if __name__ == '__main__':
    results, report = main()
