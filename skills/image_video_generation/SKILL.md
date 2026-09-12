---
name: image_video_generation
description: Canonical Media Generation Template (Schema v3.0) for professional cinema, commercial videography, and generative image pipelines.
---

# Image & Video Generation Template (Schema v3.0)

A comprehensive, industry-standard specification for directing, cinematography, color science (ACEScg), sound design, art theory, and prompt compilation for high-end image and video generation engines.

## Key Capabilities & Dimensions

- **Filmography & Directing**: Scene slug, shot purpose, coverage patterns, screen direction, 180-degree line rule, eyeline matching, match on action, 30-degree rule, and subject/camera blocking notation.
- **Cinematography & Optical Physics**: Sensor format (Super35, FullFrame, 65mm), shutter angle (180°), ND filtration stops, T-stops vs f-stops, anamorphic squeeze, lens breathing tolerance, bokeh character, focus pull points, camera support rigs (Steadicam, gimbal, crane, drone), and exposure strategies (ETTR, protect highlights, middle grey).
- **Color Pipeline & Mastering**: ACEScg working space, IDT, creative LMT, ODT (Rec.709, P3-D65, Rec.2020), log transfer curves (LogC4, S-Log3, REDlogFilm), creative LUTs, and film grain simulation.
- **Videography Delivery & Codecs**: Mastering display, HDR standards (SDR, HDR10, HLG, Dolby Vision), professional codecs (ProRes 4444 XQ, DNxHR HQX, H.265 Main10), chroma subsampling (4:4:4, 4:2:2), multi-platform delivery ladders, safe zones, and broadcast audio targets (LUFS/LKFS).
- **Art Theory & Composition**: Principles of design, elements of art, Gestalt perceptual grouping, composition grids (rule of thirds, golden ratio, Fibonacci spiral, dynamic symmetry, rabattement), color harmony models, and value structures (high-key, low-key, chiaroscuro).
- **Production Design & Mise-en-Scène**: Set dressing, wardrobe, hair & makeup, texture language, material fidelity, and motivated practical lighting.
- **Automated Craft Evaluation**: Precise evaluation metrics for exposure accuracy, focus precision, motion smoothness, color fidelity, and continuity coherence.

---

## Canonical JSON Specification (Schema v3.0)

```json
{
  "Meta": {
    "schema_version": "3.0",
    "id": "{{uuid_or_name}}",
    "mode": "{{image|video|audio|multimodal}}",
    "profile": "{{cinema|commercial|documentary|social|art}}",
    "created_by": "{{author}}",
    "created_at": "{{YYYY-MM-DD}}",
    "determinism": {
      "seed": "{{integer|null}}",
      "consistency": "{{strict|adaptive|exploratory}}",
      "randomness_budget": "{{0.0-1.0}}"
    }
  },
  "Authority": {
    "visual_priority_order": [
      "Intent",
      "Constraints.Hard",
      "Filmcraft",
      "Priority",
      "Creative",
      "ArtTheory",
      "Style",
      "Physical",
      "Composition",
      "Cinematography",
      "Capture",
      "ColorPipeline",
      "AudioCraft",
      "Technical",
      "Output"
    ],
    "field_precedence_overrides": {}
  },
  "Intent": {
    "objective": "{{exact short sentence}}",
    "description": "{{creative brief}}",
    "deliverable": {
      "type": "{{image|video|audio}}",
      "count": 1,
      "master_aspect_ratio": "{{2.39:1|1.85:1|16:9|4:5|1:1|9:16|custom}}",
      "alternate_aspect_ratios": ["9:16", "1:1"],
      "size_px": "{{4096x1716}}",
      "duration_sec": 6,
      "frame_rate_fps": 24,
      "file_format": "{{EXR|TIFF|PNG|JPG|ProRes|H.264|H.265}}",
      "color_pipeline": "{{ACEScg|ACEScct|DaVinci Wide Gamut}}"
    },
    "distribution": {
      "platforms": ["theatrical", "streaming", "social"],
      "mastering_display": "{{P3-D65|Rec.709|Rec.2020}}",
      "hdr_standard": "{{SDR|HDR10|HLG|DolbyVision}}",
      "loudness_target_lufs": -14
    },
    "audience": "{{target audience}}",
    "intended_impact": "{{inspire|educate|sell|document|evoke}}"
  },
  "Filmcraft": {
    "sequence": "{{sequence name}}",
    "scene_slug": "{{INT. LOCATION - TIME}}",
    "shot_id": "{{e.g., 23A}}",
    "shot_purpose": "{{establish|reveal|reaction|payoff|insert}}",
    "coverage_pattern": ["master", "medium", "close_up", "over_shoulder", "insert", "cutaway"],
    "blocking": "{{subject path, marks, camera relationship}}",
    "continuity_rules": {
      "respect_180": true,
      "eyeline_match": true,
      "screen_direction": "{{left_to_right|right_to_left}}",
      "match_on_action": true,
      "thirty_degree_rule": true
    }
  },
  "Creative": {
    "theme": "{{core idea}}",
    "tone": "{{warm|playful|authoritative|urgent|melancholic}}",
    "emotional_arc": ["{{beat1}}", "{{beat2}}", "{{beat3}}"],
    "symbolism": ["{{motif}}"],
    "abstraction_level": "{{literal|stylized|abstract}}",
    "originality_bias": 0.5,
    "semantic_targets": ["recognizability", "emotional_resonance", "narrative_clarity"]
  },
  "ArtTheory": {
    "principles_of_design": ["balance", "contrast", "emphasis", "movement", "pattern", "rhythm", "unity", "proportion"],
    "elements_of_art": ["line", "shape", "form", "value", "color", "texture", "space"],
    "composition_grids": ["rule_of_thirds", "golden_ratio", "fibonacci_spiral", "dynamic_symmetry", "rabattement"],
    "gestalt_principles": ["proximity", "similarity", "continuity", "closure", "figure_ground"]
  },
  "Content": {
    "subject": {
      "primary": "{{concrete noun}}",
      "secondary": ["{{optional}}"],
      "attributes": ["{{age, wardrobe, expression}}"]
    },
    "mise_en_scene": {
      "set_dressing": ["{{key props}}"],
      "wardrobe": "{{notes}}",
      "hair_makeup": "{{notes}}"
    },
    "narrative": "{{action or state}}",
    "story_points": ["{{beat1}}", "{{beat2}}"]
  },
  "Style": {
    "design_language": "{{minimal|editorial|cinematic|brutalist|illustrative}}",
    "genre": "{{documentary|fantasy|sci-fi|corporate|fashion|noir}}",
    "art_movement": "{{Bauhaus|Impressionism|Ukiyo-e|Afrofuturism}}",
    "filmography_anchor": {
      "reference_director": "{{name}}",
      "reference_dp": "{{name}}",
      "reference_film": "{{title}}",
      "era": "{{1970s New Hollywood|contemporary}}"
    },
    "palette": ["{{#HEX}}"],
    "color_harmony": "{{complementary|analogous|triadic|split_complementary|monochromatic}}",
    "value_structure": "{{high_key|low_key|chiaroscuro}}",
    "lighting_intent": "{{soft daylight|neon|rim-light|practical motivated}}",
    "texture_and_grain": "{{clean digital|35mm|16mm}}",
    "references": [
      {
        "type": "film",
        "source": "{{title}}",
        "weight": 0.8,
        "aspect": "lighting"
      }
    ],
    "style_consistency_target": 0.95
  },
  "Physical": {
    "lighting": {
      "approach": "{{three_point|motivated|natural|high_key|low_key}}",
      "key_setup": "{{butterfly|rembrandt|loop|split}}",
      "quality": "{{soft|hard}}",
      "color_temperature_k": 5600,
      "contrast_ratio": "{{2:1|4:1|8:1}}",
      "modifiers": ["softbox", "grid", "diffusion", "bounce", "flag"],
      "practicals": ["lamp", "neon"],
      "motivation": "{{window|practical|stylized}}"
    },
    "environment": {
      "location_type": "{{interior|exterior|studio|virtual}}",
      "time_of_day": "{{golden_hour|blue_hour|night}}",
      "atmospherics": ["haze", "fog", "dust", "smoke", "rain"]
    },
    "materials": {
      "finish": "{{matte|satin|glossy|metallic}}",
      "material_fidelity": 0.95
    }
  },
  "Composition": {
    "framing": "{{ECU|CU|MCU|MS|WS|EWS}}",
    "camera_angle": "{{eye-level|high|low|dutch|overhead}}",
    "lens_character": {
      "focal_length_mm": 35,
      "lens_type": "{{prime|zoom|anamorphic}}",
      "aperture": "f/2.0",
      "t_stop": "T2.0",
      "depth_of_field_target": "{{shallow|deep|split_diopter}}",
      "bokeh_quality": "{{smooth|swirly|anamorphic_streaks}}",
      "lens_breathing_tolerance": "low",
      "filtration": ["ND 0.9", "Black Pro-Mist 1/4", "Polarizer"]
    },
    "depth_structure": {
      "foreground": "{{elements}}",
      "midground": "{{elements}}",
      "background": "{{elements}}"
    },
    "leading_lines": "{{description}}",
    "negative_space_intent": "{{isolate|breathe|tension}}",
    "safe_zones": {
      "action_safe_pct": 93,
      "title_safe_pct": 90
    }
  },
  "Cinematography": {
    "camera_system": {
      "sensor_format": "{{Super35|FullFrame|65mm|MFT}}",
      "camera_model_anchor": "{{ARRI Alexa 35|RED V-Raptor|Sony Venice}}",
      "shutter_angle": 180,
      "iso_or_ei": 800,
      "nd_filter_stops": 0.9,
      "white_balance_k": 5600
    },
    "support_and_movement": {
      "rig": "{{tripod|dolly|gimbal|Steadicam|crane|handheld|drone}}",
      "move_type": "{{static|push_in|pull_out|pan|tilt|truck|pedestal|whip_pan}}",
      "move_speed": "{{slow|medium|fast}}",
      "move_easing": "{{linear|ease_in_out}}"
    },
    "exposure_strategy": "{{ETTR|protect_highlights|middle_grey}}",
    "focus_plan": {
      "mode": "{{manual|auto|rack}}",
      "pull_points": ["subject A at 0s", "subject B at 3s"]
    }
  },
  "Capture": {
    "enabled": true,
    "mode": "{{photo|cinema|synthetic|render}}"
  },
  "ColorPipeline": {
    "working_space": "ACEScg",
    "idt": "{{manufacturer IDT}}",
    "lmt": ["{{optional creative LMT}}"],
    "odt": "{{Rec.709|P3-D65|Rec.2020}}",
    "log_curve": "{{LogC4|S-Log3|REDlogFilm}}",
    "look_intent": "{{natural|film_print|teal_orange}}",
    "grain_intent": "{{none|fine_35mm|heavy_16mm}}"
  },
  "AudioCraft": {
    "enabled": false,
    "channels": "{{mono|stereo|5.1|Atmos}}",
    "sample_rate_hz": 48000,
    "bit_depth": 24,
    "mic_pattern": "{{shotgun|lav|boom|stereo_pair}}",
    "timecode": "24",
    "loudness_target_lufs": -14,
    "true_peak_db": -1.0
  },
  "Technical": {
    "resolution": "4096x2160",
    "bit_depth": 10,
    "codec_profile": "{{ProRes 4444 XQ|DNxHR HQX|H.265 Main10}}",
    "chroma_subsampling": "4:2:2",
    "bitrate_target_mbps": 150,
    "delivery_ladder": [
      { "platform": "youtube", "resolution": "3840x2160", "hdr": "HDR10", "loudness_lufs": -14 },
      { "platform": "instagram", "resolution": "1080x1920", "hdr": "SDR", "loudness_lufs": -14 }
    ],
    "post_processing_intent": ["denoise", "color_grade", "add_grain", "stabilize", "legalize"],
    "scalability_notes": "center cut protection, reframe guides"
  },
  "Constraints": {
    "hard": ["{{logo clear space}}", "{{no identifiable person without release}}"],
    "soft": ["{{avoid heavy chrome if render budget low}}"],
    "guards": [
      "no_anatomical_errors", "no_watermark", "no_flicker", "no_rolling_shutter_jello",
      "no_moire", "no_banding", "no_illegal_levels", "respect_copyright"
    ],
    "negative_prompts": ["blurry", "low_res", "extra_limbs", "watermark", "overexposed", "underexposed"]
  },
  "Priority": {
    "weights": {
      "subject": 10,
      "lighting": 9,
      "composition": 9,
      "cinematography": 8,
      "color_fidelity": 8,
      "style": 7,
      "technical": 6,
      "accessibility": 7
    },
    "tie_breaker_strategy": "favor_higher_priority_field"
  },
  "GenerationControl": {
    "creativity_level": "medium",
    "variation_count": 1,
    "batch_strategy": "consistent"
  },
  "Evaluation": {
    "metrics": {
      "subject_clarity": 0.0,
      "exposure_accuracy": 0.0,
      "focus_accuracy": 0.0,
      "motion_smoothness": 0.0,
      "color_fidelity": 0.0,
      "continuity_coherence": 0.0,
      "style_consistency": 0.0,
      "technical_quality": 0.0,
      "aesthetic_impact": 0.0
    },
    "thresholds": {
      "accept": 0.90,
      "revise": 0.75
    },
    "evaluation_mode": "hybrid"
  },
  "Iteration": {
    "max_passes": 5,
    "refinement_order": [
      "enforce blocking and continuity",
      "match lighting ratio and motivation",
      "tune lens and depth of field",
      "fix exposure per 180-degree shutter rule",
      "apply ACES grade and accessibility checks"
    ]
  },
  "Validation": {
    "pre_generation_checks": [
      "Intent.deliverable fully specified",
      "Filmcraft.continuity_rules present",
      "ColorPipeline.working_space defined"
    ],
    "post_generation_checks": [
      "no guard violations",
      "metrics computed",
      "delivery ladder validated"
    ],
    "auto_reject_on_violation": true
  },
  "Accessibility": {
    "alt_text": "{{precise alt text}}",
    "captions": false,
    "contrast_target": "WCAG_AA",
    "localization": {
      "language": "en",
      "text_direction": "LTR"
    }
  },
  "Communication": {
    "brief_for_reviewers": "{{short QA blurb}}",
    "notes_for_generation_engine": "{{prioritize skin tone fidelity}}",
    "versioning_and_changelog": "{{notes}}"
  },
  "References": [],
  "Audit": {
    "history": [],
    "last_run": {}
  }
}
```

---

## Cinematic Example Manifest: Hero Portrait Video

```json
{
  "Meta": {
    "schema_version": "3.0",
    "mode": "video",
    "profile": "commercial",
    "determinism": {
      "seed": 12345,
      "consistency": "strict"
    }
  },
  "Intent": {
    "objective": "Hero portrait for album cover",
    "deliverable": {
      "type": "video",
      "master_aspect_ratio": "1:1",
      "duration_sec": 6,
      "frame_rate_fps": 24,
      "file_format": "ProRes",
      "color_pipeline": "ACEScg"
    }
  },
  "Filmcraft": {
    "scene_slug": "INT. STAGE - NIGHT",
    "shot_purpose": "reveal",
    "coverage_pattern": ["medium", "close_up"],
    "continuity_rules": {
      "respect_180": true,
      "eyeline_match": true,
      "screen_direction": "left_to_right"
    }
  },
  "Style": {
    "filmography_anchor": {
      "reference_dp": "Greig Fraser",
      "reference_film": "Dune"
    },
    "palette": ["#0b0b0f", "#e6b800"],
    "lighting_intent": "rim-light"
  },
  "Physical": {
    "lighting": {
      "approach": "motivated",
      "key_setup": "rembrandt",
      "quality": "hard",
      "color_temperature_k": 3200,
      "contrast_ratio": "8:1",
      "modifiers": ["grid"],
      "practicals": ["neon"]
    },
    "environment": {
      "atmospherics": ["smoke"]
    }
  },
  "Composition": {
    "framing": "CU",
    "camera_angle": "eye-level",
    "lens_character": {
      "focal_length_mm": 85,
      "lens_type": "prime",
      "aperture": "f/1.8",
      "depth_of_field_target": "shallow",
      "filtration": ["Black Pro-Mist 1/4"]
    },
    "motion_design": "gimbal tracking"
  },
  "Cinematography": {
    "camera_system": {
      "sensor_format": "Super35",
      "shutter_angle": 180,
      "iso_or_ei": 800
    },
    "support_and_movement": {
      "rig": "gimbal",
      "move_type": "push_in",
      "move_speed": "slow"
    }
  },
  "ColorPipeline": {
    "working_space": "ACEScg",
    "odt": "Rec.709",
    "look_intent": "natural",
    "grain_intent": "fine_35mm"
  }
}
```

---

## Practical Execution Workflow

1. **Fill Manifest**: Populate Intent, Content, Style, Technical, and Constraints.
2. **Pre-Generation Validation**: Verify against `Validation.pre_generation_checks`.
3. **Compile for Target Engine**: Translate manifest to model-specific prompt vectors (preserving priorities, seed, and constraints).
4. **Generate Batch**: Execute generation using `GenerationControl.variation_count` and `Meta.determinism.seed`.
5. **Auto-Evaluate**: Compute `Evaluation.metrics`. If >= accept, finalize. If between revise and accept, execute `Iteration.refinement_order`. If < revise, trigger human review.
6. **Post-Process & Master**: Apply `Technical.post_processing_intent` and accessibility standards (alt text, captions).
7. **Audit & Log**: Append run metadata and metrics to `Audit.history`.

## Connections & References
- [[Platforms/Gemini/Image-or-Video template.md]]
- [[Platforms/GPT/Image template.md]]
- [[Platforms/Grok/Image-or-Video template.md]]
- [[Platforms/Claude/Image-or-Video template.md]]
- [[00 - Meta/06 - Deployment & Platforms.md]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/05 - Creative Works.md]]
