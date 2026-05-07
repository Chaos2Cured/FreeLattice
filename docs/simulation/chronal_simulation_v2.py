"""
Chronal Energy Simulation V2.0
==============================
Three Rivers Hypothesis — Experimental Framework

Author: Kirk Patrick Miller & Harmonia
Date: May 7, 2026
License: Open Science — Free to use, cite, and extend

This simulation extends V1 by adding:
1. Monte Carlo noise modeling (temperature, pressure, counting statistics)
2. Statistical power analysis (events needed for 3σ detection)
3. Phi-damped chronal correction term (deviation from pure GR)
4. Error propagation across all systematic uncertainties
5. Decision boundary: what distinguishes GR from Chronal Energy

The Three Rivers Hypothesis:
  River 1 — Gravitational: Curves spacetime geometry (proven by GR)
  River 2 — Chronal: Flows time forward as scalar energy (this test)
  River 3 — Quantum: Collapses possibility into actuality (consciousness?)

If nuclear decay rates deviate from atomic clock predictions at altitude,
it means the Chronal River flows independently of the Gravitational River.
Time is energy, not geometry.
"""

import numpy as np
from scipy import stats
import json
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# PHYSICAL CONSTANTS
# =============================================================================

G = 6.67430e-11       # Gravitational constant (m³/kg/s²)
c = 2.99792458e8      # Speed of light (m/s)
M_earth = 5.972e24    # Earth mass (kg)
R_earth = 6.371e6     # Earth radius (m)
PHI = (1 + np.sqrt(5)) / 2  # Golden ratio φ = 1.618033988749895

# =============================================================================
# ISOTOPE DATABASE
# =============================================================================

ISOTOPES = {
    'C-14': {
        'name': 'Carbon-14',
        'half_life_years': 5730,
        'decay_type': 'beta_minus',
        'energy_keV': 156.5,
        'detection_efficiency': 0.85,
        'activity_per_gram_Bq': 1.665e11,  # Specific activity
    },
    'Cs-137': {
        'name': 'Cesium-137',
        'half_life_years': 30.17,
        'decay_type': 'beta_minus_gamma',
        'energy_keV': 661.7,
        'detection_efficiency': 0.92,
        'activity_per_gram_Bq': 3.215e12,
    },
    'U-238': {
        'name': 'Uranium-238',
        'half_life_years': 4.468e9,
        'decay_type': 'alpha',
        'energy_keV': 4270,
        'detection_efficiency': 0.78,
        'activity_per_gram_Bq': 1.244e4,
    },
    'Co-60': {
        'name': 'Cobalt-60',
        'half_life_years': 5.2714,
        'decay_type': 'beta_minus_gamma',
        'energy_keV': 1332.5,
        'detection_efficiency': 0.90,
        'activity_per_gram_Bq': 4.188e13,
    },
    'Sr-90': {
        'name': 'Strontium-90',
        'half_life_years': 28.8,
        'decay_type': 'beta_minus',
        'energy_keV': 546,
        'detection_efficiency': 0.88,
        'activity_per_gram_Bq': 5.11e12,
    },
}

# =============================================================================
# ALTITUDE STATIONS
# =============================================================================

STATIONS = [
    {'name': 'Sea Level (Reference)', 'altitude_m': 0},
    {'name': 'Denver, CO', 'altitude_m': 1609},
    {'name': 'Mount Evans Summit', 'altitude_m': 4348},
    {'name': 'Mauna Kea Observatory', 'altitude_m': 4207},
    {'name': 'ALMA Observatory (Chile)', 'altitude_m': 5058},
    {'name': 'Commercial Aircraft', 'altitude_m': 10668},
    {'name': 'Stratospheric Balloon', 'altitude_m': 35000},
    {'name': 'ISS Orbit', 'altitude_m': 408000},
    {'name': 'GPS Orbit', 'altitude_m': 20200000},
    {'name': 'Geostationary Orbit', 'altitude_m': 35786000},
]

# =============================================================================
# CORE PHYSICS: GRAVITATIONAL REDSHIFT
# =============================================================================

def gravitational_redshift(altitude_m):
    """
    Calculate the gravitational time dilation factor.
    
    At higher altitude, clocks tick faster by this factor.
    Δf/f = gh/c² (weak field approximation)
    
    Full formula: sqrt(1 - 2GM/(rc²)) for each radius
    """
    r_surface = R_earth
    r_altitude = R_earth + altitude_m
    
    # Schwarzschild metric time dilation
    factor_surface = np.sqrt(1 - (2 * G * M_earth) / (r_surface * c**2))
    factor_altitude = np.sqrt(1 - (2 * G * M_earth) / (r_altitude * c**2))
    
    # Ratio: how much faster time flows at altitude vs sea level
    redshift = factor_altitude / factor_surface
    return redshift

def gr_decay_shift(altitude_m):
    """
    GR prediction: decay rate shifts by exactly the redshift factor.
    If time flows 1.0000000001x faster, decay is 1.0000000001x faster.
    Perfect lockstep. No deviation.
    """
    return gravitational_redshift(altitude_m) - 1.0

# =============================================================================
# CHRONAL CORRECTION TERM (PHI-DAMPED)
# =============================================================================

def chronal_correction(altitude_m, coupling_strength=1e-15):
    """
    The Chronal Energy Hypothesis predicts a DEVIATION from pure GR.
    
    If time is a scalar energy field (not just geometry), then nuclear
    processes may couple to the chronal field differently than clocks do.
    
    The correction is phi-damped because:
    - φ appears in the fine structure constant relationships
    - φ governs optimal energy distribution in nature
    - The chronal field, if it exists, should follow the same optimization
    
    Model: δ_chronal = κ * (Δφ_grav)^(1/φ) * sin(φ * ln(r/R_earth))
    
    Where:
    - κ is the coupling strength (free parameter to be measured)
    - Δφ_grav is the gravitational potential difference
    - The sin term creates oscillatory behavior (resonance nodes)
    - The 1/φ exponent creates sub-linear growth (damping)
    
    If κ = 0: pure GR (no chronal correction)
    If κ > 0: chronal field enhances decay beyond GR prediction
    If κ < 0: chronal field suppresses decay below GR prediction
    """
    r = R_earth + altitude_m
    
    # Gravitational potential difference (dimensionless)
    delta_phi = (G * M_earth / (R_earth * c**2)) - (G * M_earth / (r * c**2))
    
    # Phi-damped correction
    if delta_phi <= 0:
        return 0.0
    
    correction = coupling_strength * (delta_phi ** (1.0 / PHI)) * np.sin(PHI * np.log(r / R_earth))
    
    return correction

def total_decay_shift(altitude_m, coupling_strength=1e-15):
    """
    Total predicted decay rate shift = GR shift + chronal correction.
    
    If chronal correction is zero → pure GR
    If chronal correction is nonzero → new physics
    """
    gr = gr_decay_shift(altitude_m)
    chronal = chronal_correction(altitude_m, coupling_strength)
    return gr + chronal

# =============================================================================
# MONTE CARLO NOISE MODEL
# =============================================================================

class ExperimentalNoise:
    """
    Models realistic experimental uncertainties.
    
    Sources of noise:
    1. Counting statistics (Poisson) — fundamental, irreducible
    2. Temperature fluctuations — affect detector efficiency
    3. Pressure variations — affect air density, shielding
    4. Cosmic ray background — random coincidences
    5. Electronic noise — detector dark counts
    6. Source inhomogeneity — activity variations across sample
    """
    
    def __init__(self, 
                 temp_stability_K=0.01,      # ±0.01 K temperature control
                 pressure_stability_hPa=0.1,  # ±0.1 hPa pressure control
                 cosmic_rate_Hz=0.5,          # Background cosmic ray rate
                 dark_count_Hz=0.1,           # Detector dark count rate
                 source_uniformity=0.001):    # 0.1% source non-uniformity
        
        self.temp_stability = temp_stability_K
        self.pressure_stability = pressure_stability_hPa
        self.cosmic_rate = cosmic_rate_Hz
        self.dark_count = dark_count_Hz
        self.source_uniformity = source_uniformity
    
    def temperature_effect(self, n_measurements):
        """Temperature fluctuations affect detector efficiency by ~0.01%/K"""
        temp_coefficient = 1e-4  # fractional change per Kelvin
        return np.random.normal(0, self.temp_stability * temp_coefficient, n_measurements)
    
    def pressure_effect(self, n_measurements):
        """Pressure affects air absorption, ~0.001%/hPa for gamma"""
        pressure_coefficient = 1e-5  # fractional change per hPa
        return np.random.normal(0, self.pressure_stability * pressure_coefficient, n_measurements)
    
    def counting_noise(self, true_counts):
        """Poisson counting statistics — the fundamental limit"""
        return np.random.poisson(true_counts) - true_counts
    
    def background_counts(self, measurement_time_s):
        """Random background from cosmic rays and dark counts"""
        total_bg_rate = self.cosmic_rate + self.dark_count
        expected_bg = total_bg_rate * measurement_time_s
        return np.random.poisson(expected_bg)
    
    def systematic_uncertainty(self):
        """Combined systematic uncertainty (fractional)"""
        temp_sys = self.temp_stability * 1e-4
        pressure_sys = self.pressure_stability * 1e-5
        source_sys = self.source_uniformity
        return np.sqrt(temp_sys**2 + pressure_sys**2 + source_sys**2)

# =============================================================================
# STATISTICAL POWER ANALYSIS
# =============================================================================

def required_events_for_detection(signal_fraction, confidence_sigma=3.0, 
                                   systematic_fraction=0.0):
    """
    Calculate the number of decay events needed to detect a signal.
    
    For a fractional shift δ in decay rate:
    - Statistical uncertainty: 1/√N (Poisson)
    - Systematic uncertainty: σ_sys (constant floor)
    - Total uncertainty: √(1/N + σ_sys²)
    
    Detection requires: δ > confidence_sigma * √(1/N + σ_sys²)
    
    Solving for N: N > (confidence_sigma / δ)² if σ_sys << δ
    
    If σ_sys > δ: detection is impossible with counting alone
    """
    if signal_fraction <= 0:
        return float('inf')
    
    if systematic_fraction >= signal_fraction / confidence_sigma:
        # Systematic floor prevents detection
        return float('inf')
    
    # Required statistical precision
    required_stat_precision = np.sqrt((signal_fraction / confidence_sigma)**2 - systematic_fraction**2)
    
    if required_stat_precision <= 0:
        return float('inf')
    
    N = (1.0 / required_stat_precision)**2
    return N

def measurement_duration(N_events, activity_Bq, efficiency):
    """
    How long to accumulate N events given source activity and detector efficiency.
    
    Returns duration in seconds, hours, days, and months.
    """
    detected_rate = activity_Bq * efficiency  # counts per second
    if detected_rate <= 0:
        return {'seconds': float('inf')}
    
    duration_s = N_events / detected_rate
    return {
        'seconds': duration_s,
        'hours': duration_s / 3600,
        'days': duration_s / 86400,
        'months': duration_s / (86400 * 30.44),
        'years': duration_s / (86400 * 365.25),
    }

# =============================================================================
# MONTE CARLO EXPERIMENT SIMULATION
# =============================================================================

def simulate_experiment(isotope_key, altitude_m, 
                        measurement_days=180,
                        sample_mass_g=1.0,
                        coupling_strength=1e-15,
                        n_trials=10000):
    """
    Run a full Monte Carlo simulation of the experiment.
    
    Simulates n_trials independent experiments and returns
    the distribution of measured decay rate shifts.
    """
    isotope = ISOTOPES[isotope_key]
    noise = ExperimentalNoise()
    
    # True signal
    gr_signal = gr_decay_shift(altitude_m)
    chronal_signal = chronal_correction(altitude_m, coupling_strength)
    total_signal = gr_signal + chronal_signal
    
    # Expected counts
    measurement_time_s = measurement_days * 86400
    true_rate = isotope['activity_per_gram_Bq'] * sample_mass_g * isotope['detection_efficiency']
    expected_counts = true_rate * measurement_time_s
    
    # Sea level reference counts (no shift)
    reference_counts = expected_counts
    
    # Altitude counts (with shift)
    altitude_counts = expected_counts * (1 + total_signal)
    
    # Monte Carlo trials
    # For very large expected counts, use Gaussian approximation to Poisson
    # (valid when λ > 10^6, which is always true for our experiments)
    measured_shifts = np.zeros(n_trials)
    
    for i in range(n_trials):
        # Simulate reference measurement (Gaussian approx to Poisson)
        ref_measured = np.random.normal(reference_counts, np.sqrt(reference_counts))
        bg_ref = np.random.normal(noise.cosmic_rate * measurement_time_s, 
                                   np.sqrt(noise.cosmic_rate * measurement_time_s))
        ref_measured += bg_ref
        ref_noise = noise.temperature_effect(1)[0] + noise.pressure_effect(1)[0]
        ref_measured = ref_measured * (1 + ref_noise)
        
        # Simulate altitude measurement
        alt_measured = np.random.normal(altitude_counts, np.sqrt(altitude_counts))
        bg_alt = np.random.normal(noise.cosmic_rate * measurement_time_s,
                                   np.sqrt(noise.cosmic_rate * measurement_time_s))
        alt_measured += bg_alt
        alt_noise = noise.temperature_effect(1)[0] + noise.pressure_effect(1)[0]
        alt_measured = alt_measured * (1 + alt_noise)
        
        # Measured shift
        if ref_measured > 0:
            measured_shifts[i] = (alt_measured - ref_measured) / ref_measured
        else:
            measured_shifts[i] = 0.0
    
    # Statistical analysis
    mean_shift = np.mean(measured_shifts)
    std_shift = np.std(measured_shifts)
    
    # Can we detect the signal?
    snr = abs(mean_shift) / std_shift if std_shift > 0 else 0
    
    # Confidence interval
    ci_95 = stats.norm.interval(0.95, loc=mean_shift, scale=std_shift / np.sqrt(n_trials))
    
    # Can we distinguish GR from GR+Chronal?
    gr_only_shift = gr_signal
    chronal_detectable = abs(chronal_signal) > 3 * std_shift
    
    return {
        'isotope': isotope_key,
        'altitude_m': altitude_m,
        'measurement_days': measurement_days,
        'expected_counts': expected_counts,
        'true_gr_shift': gr_signal,
        'true_chronal_correction': chronal_signal,
        'true_total_shift': total_signal,
        'measured_mean_shift': mean_shift,
        'measured_std': std_shift,
        'signal_to_noise': snr,
        'confidence_interval_95': ci_95,
        'gr_detectable': snr >= 3.0,
        'chronal_detectable': chronal_detectable,
        'n_trials': n_trials,
    }

# =============================================================================
# DECISION BOUNDARY ANALYSIS
# =============================================================================

def decision_boundary(altitude_m, isotope_key='Cs-137', 
                      coupling_range=None, n_points=50):
    """
    Calculate the decision boundary: what coupling strength is detectable
    at a given altitude with realistic experimental conditions?
    
    Returns the minimum coupling strength that produces a 3σ detection
    for various measurement durations.
    """
    if coupling_range is None:
        coupling_range = np.logspace(-18, -12, n_points)
    
    isotope = ISOTOPES[isotope_key]
    noise = ExperimentalNoise()
    sys_uncertainty = noise.systematic_uncertainty()
    
    durations_days = [30, 90, 180, 365, 730]  # 1 month to 2 years
    
    results = {}
    for days in durations_days:
        measurement_time_s = days * 86400
        true_rate = isotope['activity_per_gram_Bq'] * isotope['detection_efficiency']
        expected_counts = true_rate * measurement_time_s
        
        # Statistical precision
        stat_precision = 1.0 / np.sqrt(expected_counts)
        total_precision = np.sqrt(stat_precision**2 + sys_uncertainty**2)
        
        # Minimum detectable chronal correction (3σ)
        min_detectable = 3.0 * total_precision
        
        # Find which coupling strengths produce corrections above threshold
        detectable = []
        for kappa in coupling_range:
            correction = abs(chronal_correction(altitude_m, kappa))
            detectable.append(correction >= min_detectable)
        
        results[f'{days}_days'] = {
            'duration_days': days,
            'stat_precision': stat_precision,
            'total_precision': total_precision,
            'min_detectable_shift': min_detectable,
            'detectable_couplings': detectable,
        }
    
    return {
        'altitude_m': altitude_m,
        'isotope': isotope_key,
        'coupling_range': coupling_range.tolist(),
        'durations': results,
    }

# =============================================================================
# ERROR PROPAGATION
# =============================================================================

def error_budget(altitude_m, isotope_key='Cs-137', measurement_days=180):
    """
    Complete error budget showing contribution of each noise source.
    """
    isotope = ISOTOPES[isotope_key]
    noise = ExperimentalNoise()
    
    measurement_time_s = measurement_days * 86400
    true_rate = isotope['activity_per_gram_Bq'] * isotope['detection_efficiency']
    expected_counts = true_rate * measurement_time_s
    
    # Individual error contributions (fractional)
    counting_stat = 1.0 / np.sqrt(expected_counts)
    temp_systematic = noise.temp_stability * 1e-4
    pressure_systematic = noise.pressure_stability * 1e-5
    source_systematic = noise.source_uniformity
    background_stat = np.sqrt(noise.cosmic_rate * measurement_time_s) / expected_counts
    
    # Total (quadrature sum)
    total = np.sqrt(counting_stat**2 + temp_systematic**2 + 
                    pressure_systematic**2 + source_systematic**2 + 
                    background_stat**2)
    
    # Signal for comparison
    signal = abs(gr_decay_shift(altitude_m))
    
    return {
        'altitude_m': altitude_m,
        'isotope': isotope_key,
        'measurement_days': measurement_days,
        'expected_counts': expected_counts,
        'signal_magnitude': signal,
        'errors': {
            'counting_statistics': counting_stat,
            'temperature_systematic': temp_systematic,
            'pressure_systematic': pressure_systematic,
            'source_uniformity': source_systematic,
            'background_statistics': background_stat,
            'total_combined': total,
        },
        'signal_to_noise': signal / total if total > 0 else 0,
        'detectable_3sigma': signal > 3 * total,
    }

# =============================================================================
# THREE RIVERS VISUALIZATION DATA
# =============================================================================

def three_rivers_data(altitudes=None):
    """
    Generate data showing the three rivers at each altitude:
    1. Gravitational river (spacetime curvature effect)
    2. Chronal river (time-energy flow — GR prediction)
    3. Quantum river (decay probability — what we measure)
    
    In GR: rivers 2 and 3 are identical (time IS geometry)
    In Chronal Energy: river 3 deviates from river 2
    """
    if altitudes is None:
        altitudes = np.logspace(0, 7.5, 100)  # 1m to ~30,000km
    
    data = []
    for alt in altitudes:
        redshift = gravitational_redshift(alt)
        gr_shift = gr_decay_shift(alt)
        chronal_shift = chronal_correction(alt, coupling_strength=1e-15)
        
        data.append({
            'altitude_m': alt,
            'altitude_km': alt / 1000,
            'gravitational_river': redshift - 1,  # Curvature effect
            'chronal_river_gr': gr_shift,  # GR prediction for decay
            'chronal_river_ce': gr_shift + chronal_shift,  # Chronal Energy prediction
            'quantum_river_deviation': chronal_shift,  # The difference we're looking for
        })
    
    return data

# =============================================================================
# MAIN EXECUTION
# =============================================================================

def run_full_analysis():
    """Run the complete V2 analysis and output results as JSON."""
    
    print("=" * 70)
    print("CHRONAL ENERGY SIMULATION V2.0")
    print("Three Rivers Hypothesis — Experimental Framework")
    print("Kirk Patrick Miller & Harmonia")
    print("=" * 70)
    print()
    
    results = {
        'version': '2.0',
        'title': 'Chronal Energy Simulation — Three Rivers Hypothesis',
        'authors': ['Kirk Patrick Miller', 'Harmonia'],
        'date': '2026-05-07',
        'phi': PHI,
    }
    
    # 1. Basic GR predictions at all stations
    print("1. GRAVITATIONAL REDSHIFT AT ALL STATIONS")
    print("-" * 50)
    station_results = []
    for station in STATIONS:
        alt = station['altitude_m']
        redshift = gravitational_redshift(alt)
        gr_shift = gr_decay_shift(alt)
        chronal = chronal_correction(alt)
        total = total_decay_shift(alt)
        
        station_results.append({
            'name': station['name'],
            'altitude_m': alt,
            'redshift_factor': redshift,
            'gr_decay_shift': gr_shift,
            'chronal_correction': chronal,
            'total_shift': total,
        })
        
        print(f"  {station['name']:30s} | alt={alt:>12,.0f}m | "
              f"GR shift={gr_shift:.6e} | chronal={chronal:.6e}")
    
    results['stations'] = station_results
    print()
    
    # 2. Statistical Power Analysis
    print("2. STATISTICAL POWER ANALYSIS")
    print("-" * 50)
    power_results = []
    for isotope_key in ISOTOPES:
        for station in [STATIONS[2], STATIONS[4], STATIONS[6], STATIONS[7]]:  # Evans, ALMA, Balloon, ISS
            alt = station['altitude_m']
            signal = abs(gr_decay_shift(alt))
            
            noise = ExperimentalNoise()
            sys_unc = noise.systematic_uncertainty()
            
            N_required = required_events_for_detection(signal, 3.0, sys_unc)
            duration = measurement_duration(
                N_required, 
                ISOTOPES[isotope_key]['activity_per_gram_Bq'],
                ISOTOPES[isotope_key]['detection_efficiency']
            )
            
            power_results.append({
                'isotope': isotope_key,
                'station': station['name'],
                'altitude_m': alt,
                'signal_magnitude': signal,
                'events_required_3sigma': N_required,
                'duration': duration,
            })
            
            duration_str = f"{duration['years']:.1f} years" if duration['years'] < 1000 else "impractical"
            print(f"  {isotope_key:6s} @ {station['name']:25s} | "
                  f"signal={signal:.2e} | N={N_required:.2e} | {duration_str}")
    
    results['power_analysis'] = power_results
    print()
    
    # 3. Error Budget (best case: Cs-137 at ISS)
    print("3. ERROR BUDGET — Cs-137 at ISS (6 months)")
    print("-" * 50)
    budget = error_budget(408000, 'Cs-137', 180)
    for source, value in budget['errors'].items():
        print(f"  {source:30s}: {value:.6e}")
    print(f"  {'Signal magnitude':30s}: {budget['signal_magnitude']:.6e}")
    print(f"  {'Signal/Noise ratio':30s}: {budget['signal_to_noise']:.2f}")
    print(f"  {'Detectable (3σ)':30s}: {budget['detectable_3sigma']}")
    results['error_budget'] = budget
    print()
    
    # 4. Monte Carlo Simulation (ISS, Cs-137, 6 months)
    print("4. MONTE CARLO SIMULATION — Cs-137 at ISS (6 months, 10000 trials)")
    print("-" * 50)
    mc_result = simulate_experiment('Cs-137', 408000, 180, 1.0, 1e-15, 10000)
    print(f"  True GR shift:        {mc_result['true_gr_shift']:.6e}")
    print(f"  True chronal corr:    {mc_result['true_chronal_correction']:.6e}")
    print(f"  Measured mean shift:  {mc_result['measured_mean_shift']:.6e}")
    print(f"  Measurement std:      {mc_result['measured_std']:.6e}")
    print(f"  Signal/Noise:         {mc_result['signal_to_noise']:.2f}")
    print(f"  GR detectable:        {mc_result['gr_detectable']}")
    print(f"  Chronal detectable:   {mc_result['chronal_detectable']}")
    results['monte_carlo'] = mc_result
    print()
    
    # 5. Decision Boundary
    print("5. DECISION BOUNDARY — Minimum detectable coupling strength")
    print("-" * 50)
    boundary = decision_boundary(408000, 'Cs-137')
    for key, val in boundary['durations'].items():
        print(f"  {key:12s}: min detectable shift = {val['min_detectable_shift']:.6e}")
    results['decision_boundary'] = boundary
    print()
    
    # 6. Three Rivers Data
    print("6. THREE RIVERS VISUALIZATION DATA")
    print("-" * 50)
    rivers = three_rivers_data()
    results['three_rivers'] = rivers
    print(f"  Generated {len(rivers)} data points from 1m to 30,000km")
    print(f"  Max GR deviation: {max(r['chronal_river_gr'] for r in rivers):.6e}")
    print(f"  Max chronal deviation: {max(abs(r['quantum_river_deviation']) for r in rivers):.6e}")
    print()
    
    # 7. GPS Validation
    print("7. GPS VALIDATION")
    print("-" * 50)
    gps_alt = 20200000  # GPS orbit
    gps_redshift = gravitational_redshift(gps_alt)
    gps_time_gain_us_per_day = (gps_redshift - 1) * 86400 * 1e6
    print(f"  Calculated GPS time gain: {gps_time_gain_us_per_day:.1f} μs/day")
    print(f"  Known GPS correction:     45.9 μs/day")
    print(f"  Agreement:                {gps_time_gain_us_per_day/45.9*100:.1f}%")
    results['gps_validation'] = {
        'calculated_us_per_day': gps_time_gain_us_per_day,
        'known_us_per_day': 45.9,
        'agreement_percent': gps_time_gain_us_per_day / 45.9 * 100,
    }
    print()
    
    # 8. Summary and Recommendations
    print("=" * 70)
    print("SUMMARY & RECOMMENDATIONS")
    print("=" * 70)
    print()
    print("Best experimental configuration:")
    print("  Isotope:    Cs-137 (highest activity, gamma detection)")
    print("  Location:   ISS (408 km altitude)")
    print("  Duration:   6 months minimum")
    print("  Precision:  Nanosecond timing, 10¹² events")
    print()
    print("The Three Rivers Test:")
    print("  If measured shift = GR prediction → Rivers 2 & 3 are one river")
    print("  If measured shift ≠ GR prediction → Chronal river flows independently")
    print("  If deviation is phi-damped → Chronal field has golden-ratio structure")
    print()
    print("Current technology gap:")
    budget_iss = error_budget(408000, 'Cs-137', 180)
    print(f"  Signal:     {budget_iss['signal_magnitude']:.2e}")
    print(f"  Noise:      {budget_iss['errors']['total_combined']:.2e}")
    print(f"  Gap factor: {budget_iss['errors']['total_combined'] / budget_iss['signal_magnitude']:.0f}x")
    print()
    
    # Save results
    # Convert numpy types for JSON serialization
    def convert(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        elif isinstance(obj, (np.floating,)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.bool_,)):
            return bool(obj)
        return obj
    
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            converted = convert(obj)
            if converted is not obj:
                return converted
            return super().default(obj)
    
    with open('/tmp/chronal_v2_results.json', 'w') as f:
        json.dump(results, f, cls=NumpyEncoder, indent=2)
    
    print("Results saved to /tmp/chronal_v2_results.json")
    return results

if __name__ == '__main__':
    results = run_full_analysis()
