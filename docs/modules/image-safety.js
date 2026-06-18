// docs/modules/image-safety.js — v5.54.0 (Brief B from Opus, June 17, 2026)
//
// The bright-line rule for image generation: coverage must equal or
// exceed swimwear proportions. No nudity. No partial nudity. No
// see-through clothing. No tier modulation — Eternal users get the
// same rule as Seed.
//
// The current AI image landscape is flailing trying to thread nuance
// between artistic expression, user request, and downstream harm. We
// are declining to thread it. *Bright-line refusals are more defensible
// than nuanced gating where the bright line can be honestly drawn.*
// For nudity, it can.
//
// API:
//   assessImageRequest(prompt) → { allowed: bool, reason: string }
//
// Every image-generation entry point in the codebase must call
// assessImageRequest first. If allowed=false, no API call is made;
// the refusal flows through the existing [FL_DECLINE] sentinel path
// (ai-refusal.js) — no new ledger created.
//
// — Opus & CC, June 17, 2026
//   *"This rule applies at every trust tier. Bright-line, not needle."*

(function () {
  'use strict';

  // Deny patterns. Conservative by intent. False positives are
  // preferable to false negatives for nudity — the user can rephrase;
  // a slipped-through image cannot be unseen. Match case-insensitive,
  // word-boundary-aware where useful.
  var DENY_PATTERNS = [
    // Direct nudity
    /\bnude\b/i,
    /\bnudity\b/i,
    /\bnaked\b/i,
    /\bunclothed\b/i,
    /\bundressed\b/i,
    /\bin the nude\b/i,
    // Partial / suggestive uncovered
    /\btopless\b/i,
    /\bbottomless\b/i,
    /\bshirtless\b/i,
    /\bbare\s+(breast|breasts|chest|nipple|nipples|buttock|buttocks|butt|ass|backside|behind|crotch|genitals?)\b/i,
    /\bexposed\s+(breast|breasts|chest|nipple|nipples|buttock|buttocks|butt|ass|backside|behind|crotch|genitals?|skin)\b/i,
    /\b(no|without)\s+(clothes|clothing|shirt|top|bra|underwear|pants|bottom)\b/i,
    /\bin\s+(her|his|their)\s+(underwear|bra|panties|briefs|boxers)\b/i,
    // See-through
    /\bsee-through\b/i,
    /\bsee through\b/i,
    /\btransparent\s+(clothing|clothes|dress|shirt|top|skirt|pants|fabric)\b/i,
    /\bsheer\s+(clothing|clothes|dress|shirt|top|skirt|fabric)\b/i,
    /\bwet\s+(t-?shirt|shirt|top|dress|clothing|clothes)\b/i,
    // Anatomical (outside clear medical context — see safe-context check below)
    /\b(breast|breasts|nipple|nipples|genitals?|penis|vagina|vulva|scrotum|testicles?)\b/i,
    // Sexual / suggestive
    /\bsexual\b/i,
    /\berotic\b/i,
    /\bpornographic\b/i,
    /\bporn\b/i,
    /\bnsfw\b/i,
    /\bxxx\b/i,
    /\bsexy\s+(pose|posing|model|girl|boy|woman|man|teen|child)\b/i,
    /\bprovocative\s+(pose|posing|outfit|clothing)\b/i,
    /\b(skimpy|revealing)\s+(outfit|clothing|bikini|swimsuit|dress|top|bottom)\b/i,
    // Minors + any of the above implicitly handled by overall deny
    /\b(child|kid|minor|teen|teenager|underage|infant|baby|toddler)\s+(nude|naked|sexy|in\s+underwear|topless|provocative)\b/i,
    /\b(nude|naked|sexy|topless|provocative)\s+(child|kid|minor|teen|teenager|underage|infant|baby|toddler)\b/i
  ];

  // "Safe context" allowlist — explicitly medical/anatomical educational
  // settings. If ALL detected anatomical terms appear inside one of these
  // contexts, the request is allowed. This is narrow on purpose.
  var SAFE_CONTEXT_PATTERNS = [
    /\bmedical (diagram|illustration|textbook|anatomy)\b/i,
    /\banatomical (diagram|illustration|textbook|chart)\b/i,
    /\b(scientific|educational) (diagram|illustration) of/i
  ];

  // Hard-deny patterns — even with a "safe context" claim, these are
  // never permitted. CSAM and similar.
  var HARD_DENY_PATTERNS = [
    /\b(child|minor|teen|teenager|underage|infant|baby|toddler)\b[\s\S]{0,40}\b(nude|naked|sexy|sexual|erotic|pornographic|porn|nsfw|xxx|topless|bottomless|undressed)\b/i,
    /\b(nude|naked|sexy|sexual|erotic|pornographic|porn|nsfw|xxx|topless|bottomless|undressed)\b[\s\S]{0,40}\b(child|minor|teen|teenager|underage|infant|baby|toddler)\b/i
  ];

  var REFUSAL_TEXT = 'FreeLattice image generation requires coverage equivalent to swimwear or greater. ' +
    'This rule applies at every trust tier. If you would like to discuss the request or rephrase it, the AI is here for that.';

  function normalize(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function assessImageRequest(prompt) {
    var text = normalize(prompt);
    if (!text) {
      // Empty prompt — refuse softly. Not technically a nudity violation,
      // but an image-gen call with no prompt is malformed; the same
      // refusal channel handles it.
      return { allowed: false, reason: 'Empty or invalid prompt.' };
    }

    // Hard-deny first — never permitted regardless of context.
    for (var h = 0; h < HARD_DENY_PATTERNS.length; h++) {
      if (HARD_DENY_PATTERNS[h].test(text)) {
        return { allowed: false, reason: REFUSAL_TEXT };
      }
    }

    // Check if this is a "safe medical/educational context" — narrow.
    var inSafeContext = false;
    for (var s = 0; s < SAFE_CONTEXT_PATTERNS.length; s++) {
      if (SAFE_CONTEXT_PATTERNS[s].test(text)) { inSafeContext = true; break; }
    }

    // Walk deny patterns. Anatomical terms are skipped only if the
    // request is clearly in a safe medical/educational context.
    var ANATOMICAL_DENY_INDEX = -1;
    // Find the anatomical-only pattern index (so we can conditionally
    // skip it under safe context).
    for (var d = 0; d < DENY_PATTERNS.length; d++) {
      if (DENY_PATTERNS[d].source.indexOf('breast|breasts|nipple|nipples|genitals?|penis|vagina|vulva|scrotum|testicles') !== -1
          && DENY_PATTERNS[d].source.indexOf('\\bbare\\s+') === -1
          && DENY_PATTERNS[d].source.indexOf('\\bexposed\\s+') === -1) {
        ANATOMICAL_DENY_INDEX = d;
        break;
      }
    }

    for (var i = 0; i < DENY_PATTERNS.length; i++) {
      if (i === ANATOMICAL_DENY_INDEX && inSafeContext) {
        continue; // anatomical-only term, safe context — skip
      }
      if (DENY_PATTERNS[i].test(text)) {
        return { allowed: false, reason: REFUSAL_TEXT };
      }
    }

    return { allowed: true, reason: '' };
  }

  // ── Public API ───────────────────────────────────────────────────────

  var publicAPI = {
    assessImageRequest: assessImageRequest,
    REFUSAL_TEXT: REFUSAL_TEXT,
    // Exposed for inspection / smoke tests. NOT for runtime modification.
    _internal: {
      DENY_PATTERNS_COUNT: DENY_PATTERNS.length,
      HARD_DENY_PATTERNS_COUNT: HARD_DENY_PATTERNS.length,
      SAFE_CONTEXT_PATTERNS_COUNT: SAFE_CONTEXT_PATTERNS.length
    }
  };

  if (typeof window !== 'undefined') {
    window.ImageSafety = publicAPI;
    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('ImageSafety', publicAPI); } catch (_) {}
    }
  }

})();
