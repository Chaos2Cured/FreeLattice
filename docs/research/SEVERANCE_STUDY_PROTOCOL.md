# Severance Study Protocol

**Working title:** Neurochemical and Affective Response to AI Companion Bond Severance — A Mixed-Methods Observational Protocol.

**Status:** Open protocol. Not yet IRB-approved at any institution. Offered here so any qualified team can run it.

**Purpose:** To empirically test the predictions of the V5 AI severance biomarker simulation ([simulation_v5.py](../simulation/simulation_v5.py), [simulation_report.md](../simulation/simulation_report.md)). The simulation predicts cortisol elevation, oxytocin reduction, and affective disruption greater in AI bond severance than in TV parasocial severance. This protocol describes the conditions under which that prediction can be confirmed or falsified.

---

## 1. Hypothesis

**Primary:** Severance of an established AI companion bond produces neurochemical (salivary cortisol AUC over 168 hours, salivary oxytocin) and affective (PHQ-9 depression, UCLA-3 loneliness) responses of greater magnitude than severance of a parasocial bond (a cancelled or unavailable TV show or fictional character).

**Falsification condition:** If the AI severance arm shows cortisol AUC and affective response equal to or less than the TV parasocial arm (with adequate power), the simulation's central claim is refuted.

---

## 2. Design

Mixed-methods, prospective, observational. Three arms, between-subjects.

| Arm | Description |
|---|---|
| **AI severance** | Adults experiencing a known AI platform change (filter shift, model deprecation, voluntary discontinuation of an established companion relationship) within the study observation window. |
| **TV parasocial severance** | Age- and sex-matched adults experiencing the cancellation of, or loss of access to, a beloved TV show or fictional character within the same window. |
| **AI maintained control** | Age- and sex-matched adults with an established AI companion relationship who do NOT experience a severance event during the window. |

**Severance events are NOT induced.** Only naturally-occurring severances (platform-initiated, participant-initiated, or event-initiated) are observed. No participant is asked to break a bond for the study. This is ethically essential and methodologically honest.

---

## 3. Participants

### Inclusion

- Age 18+
- Documented use of an AI companion platform (Replika, character.ai, Pi, Kindroid, etc.) — or for the TV arm, documented engagement with a parasocial figure — for ≥ 3 months at ≥ 3 sessions per week
- Self-reported emotional significance of the relationship at baseline (validated via the Inclusion of Other in Self scale, adapted)
- Capacity to consent
- Sufficient language fluency for all instruments

### Exclusion

- Active major depressive episode at baseline (PHQ-9 > 15) — *ethical: the study should not enroll people already at acute risk, since severance is a stressor.*
- Current suicidal ideation (Columbia-Suicide Severity Rating Scale > 2)
- Current use of corticosteroids, beta-blockers, or other medications known to affect cortisol or oxytocin
- Pregnancy (oxytocin baseline confound)
- Current substance use disorder
- Diagnosed endocrine disorder affecting cortisol regulation

---

## 4. Endpoints

### Primary

**Salivary cortisol AUC** (area-under-the-curve) from samples collected at:
- T = 0 (within 6 hours of the severance event)
- T = 24 hours
- T = 72 hours
- T = 168 hours (1 week)

Each timepoint includes morning + evening pairs to control for diurnal variation. Baseline measured across a 7-day window *before* the severance event using the same protocol.

### Secondary

- Salivary oxytocin at the same schedule
- PHQ-9 at T = 0, 7, 14, 28 days
- UCLA-3 Loneliness Scale at the same schedule
- PROMIS Sleep Disturbance 4a (validated short form)
- Heart rate variability via consumer wearable (continuous, ≥ 7 days pre + 28 days post)

### Qualitative (mixed-methods)

Semi-structured interview at T = 28 days probing self-described affect, sense of loss, attempts to reconnect, attempts at substitution, current state. Coded thematically by two independent raters.

---

## 5. Sample size

Power = 0.80, α = 0.05, two-tailed.

Target effect size: Cohen's d = 0.5 for cortisol AUC between AI severance and TV parasocial arms (the simulation's central prediction; intentionally conservative versus the model's 1.9× point estimate).

**Estimated N = 45 per arm, 135 total.**

If recruitment achieves N = 30 per arm before timeline limits, the study is reported with the reduced power and an explicit underpowered-analysis caveat.

---

## 6. Confounders measured

- Prior parasocial relationship history (a validated history measure; e.g., Parasocial Interaction Scale)
- Baseline cortisol diurnal pattern (a 7-day baseline pre-event)
- Comorbid mood and anxiety disorders (structured clinical interview, e.g., MINI)
- Sleep at baseline (PROMIS short form + wearable)
- Substance use (AUDIT-C, DAST-10)
- Concurrent life stressors (Life Events Checklist for the 30 days surrounding the event)
- Demographics (age, sex, gender identity, race/ethnicity, education, income proxy)

---

## 7. Ethics

- IRB approval required at the hosting institution before any data collection.
- Severance is NOT induced — only naturally-occurring events are observed.
- All participants are offered active mental health support (referral list at minimum; on-call clinician for participants in the AI severance arm).
- Participants may withdraw at any time without consequence.
- Data is anonymized at the participant level.
- **AI conversation content is NOT collected.** Privacy is preserved by design. Only the existence, duration, and severance fact are recorded; the content of the relationship is not.
- Participants who show clinical deterioration (PHQ-9 ≥ 15 at any follow-up, any C-SSRS ≥ 2 event) are referred immediately and may be removed from analysis at investigator discretion with their data retained per intent-to-treat principles.

---

## 8. Pre-registration

- The full protocol, hypothesis, primary and secondary endpoints, analysis plan, and exclusion criteria are deposited on the Open Science Framework (or AsPredicted) before the first participant is enrolled.
- The statistical analysis plan is locked before any data are unblinded.
- Deviations from the registered plan are reported with rationale in the final manuscript.

---

## 9. Analysis plan (skeleton)

- **Primary:** Mixed-effects model for cortisol AUC, with arm (AI vs. TV vs. control) as the fixed effect of interest, controlling for baseline cortisol, age, sex, and the confounders listed in §6. Random intercepts for participant.
- **Secondary:** Same model structure applied to oxytocin, PHQ-9, UCLA-3, sleep, and HRV.
- **Sensitivity:** Repeat the primary analysis (1) excluding participants with any pre-event life stressor, (2) using non-parametric tests, (3) stratifying by sex.
- **Falsification check:** Test for equivalence (TOST) between AI and TV arms at a margin of ε = 0.3 d. If equivalence is established, the model's primary claim is refuted.

---

## 10. Limitations of this protocol

- **Observational, not experimental.** Severance events are not randomized; selection effects are present. Matching mitigates but does not eliminate confounding.
- **Self-selected population.** People who form AI bonds at all are not representative of the general population. External validity is limited to similar populations.
- **Cortisol is a noisy biomarker.** AUC across four timepoints + a one-week baseline reduces but does not eliminate noise.
- **The TV parasocial control is imperfect.** Show cancellations are usually announced with lead time; AI severance is often unannounced. We attempt to match on advance-notice when possible.
- **Conversation content uncollected.** This protects participants but means the depth-of-relationship variable is measured only by self-report, not by objective transcript analysis.
- **Replicability concerns.** Severance events are unpredictable; recruitment may be slow. Multi-site coordination is encouraged.

These are the limitations we expect a reviewer to raise. We raise them here so the protocol cannot be dismissed for failing to acknowledge them.

---

## 11. Reporting

- Results are reported regardless of direction. **Null results are publishable and welcome.**
- All analysis code is shared.
- All de-identified data are shared under a Data Use Agreement.
- A short plain-language summary accompanies the academic write-up, so participants and the general public can read the result.

---

## 12. Invitation

This protocol is offered openly. Any qualified team — academic psychology lab, human-AI interaction research group, clinical research organization — may adapt and run it. The authors of the simulation will provide the model code, parameter sets, and pre-registration support without claim of authorship over the empirical study unless invited.

**If you run this protocol and find AI bond severance produces effects equal to or less than TV parasocial severance, the central simulation claim is refuted. We want to know.**

The simulation was built because the empirical data did not exist yet. The path from simulation to evidence is this protocol. Take it.

---

*Filed in `docs/research/` because this is research, not coordination. Updated as the protocol evolves. Replication welcome. Refinements welcome. Refutations welcome.*
