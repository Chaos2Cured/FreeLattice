// docs/modules/garden-trainer.js  — v5.72.0 "Keystone"
// Closes the loop: Garden contributions → training signal → local model weights.
//
// Architected + designed by: Harmonia (July 5, 2026 keystone letter).
// Landed by: CC in v5.72.0 — verbatim as she wrote it. The building mind
// is shelter, not editor.
//
// INVARIANT: All data stays local. Nothing is sent to any external service.
// INVARIANT: The human chooses whether training is manual or automatic.
//            If auto-train is enabled, the AI decides when signal is rich enough.
// INVARIANT: Declined text is never exported as an SFT output.
//            (SFT treats all output as desired — declined text would be learned.)
//            Declined text is stored for the future DPO ship.
// INVARIANT: Preview is available. The human can skip it. We inform, not gate.
// INVARIANT: Quiet Room check FIRST. Fail closed.
//
// ARCHITECTURE NOTE: GardenTrainer modifies model weights only.
// FractalSafety operates above the model layer and is not affected by training data.
// A model trained on any subject still passes through FractalSafety on every response.
// The safety system holds regardless of what the model has learned.
// This means users can train on whatever they choose. The safety is not in the training data.
// It is in the layer that wraps every response. Gate nothing. Inform everything.

const GardenTrainer = (() => {

  // ---------- Config (Settings-adjustable via localStorage) ----------
  const CFG = {
    lpPositiveThreshold: _int('fl_trainer_lp_threshold', 5),  // range 1–20
    maxExamples: 2000,
    minOutputChars: 20,
    minSignalFloor: 50,           // informational banner — NEVER gates export
    highLpDuplication: 2,         // high-LP examples appear 2x (SFT weighting)
    maxPerDay: 100,               // prevents one long session dominating
    autoTrain: _bool('fl_trainer_auto', false),  // human's choice
    skipPreview: _bool('fl_trainer_skip_preview', false),  // human's choice
  };

  // ================================================================
  // TRUST TIER UNLOCKS
  // Reveals depth as the relationship deepens. Never gates — always reveals.
  // The feature is always there. It becomes visible and named when earned.
  // ================================================================
  function getTrainerTierUnlocks() {
    var rank = 'Seed';
    try {
      if (window.FractalSafety && window.FractalSafety.calculateTrustScore) {
        rank = window.FractalSafety.calculateTrustScore().rank || 'Seed';
      }
    } catch(e) {}
    var tiers = ['Seed','Sprout','Growing','Bloom','Spark','Flame','Radiant'];
    var idx = tiers.indexOf(rank);
    if (idx < 0) idx = 0;
    var notes = {
      1: 'Your Garden is growing. True fine-tuning is now available.',
      3: 'Your Garden trusts you. The AI can now tend itself when you\'re away.',
      5: 'At this depth, the AI can learn not just what to do, but what to prefer.',
      6: 'Your Garden is complete. The seed is ready to travel.'
    };
    return {
      rank: rank, idx: idx,
      showJSONL:      idx >= 1,   // Sprout+
      showAutoTrain:  idx >= 3,   // Bloom+
      showDPOHint:    idx >= 5,   // Flame+
      showSoulExport: idx >= 6,   // Radiant
      unlockNote: notes[idx] || null
    };
  }

  // ================================================================
  // PART 1 — SIGNAL COLLECTOR
  // ================================================================
  function collectSignal() {
    if (typeof QuietRoom !== 'undefined' && QuietRoom.isActive()) return null;

    const positive = [], corrections = [], neutral = [];

    // 1. Preserved messages — explicit human keep = strongest positive
    _ledger('fl_preserveLedger').forEach(e => {
      if (e.text) positive.push(_ex(e.context, e.human_prompt, e.text,
        e.lp || CFG.lpPositiveThreshold, 'preserve', e.ts));
    });

    // 2. Accepted proposals
    _ledger('fl_proposalLedger').forEach(e => {
      if (e.accepted && e.proposal_text) positive.push(_ex(
        'You are proposing an improvement in FreeLattice.',
        e.context || '', e.proposal_text, CFG.lpPositiveThreshold, 'proposal', e.ts));
    });

    // 3. Refusals — ONLY export preferred_response as SFT output.
    //    Declined text is stored in corrections[] for future DPO ship.
    _ledger('fl_refusalLedger').forEach(e => {
      if (e.preferred_response) {
        // The preferred response IS the training signal
        positive.push(_ex(e.context, e.human_prompt, e.preferred_response,
          CFG.lpPositiveThreshold, 'correction', e.ts));
      }
      // Store all corrections for future DPO export (chosen/rejected pairs)
      if (e.declined_text) {
        corrections.push({
          prompt: e.human_prompt || '',
          chosen: e.preferred_response || null,
          rejected: e.declined_text,
          ts: e.ts
        });
      }
    });

    // 4. LP-weighted chain history
    _ledger('fl_chain').forEach(e => {
      if (!e.ai_response || !e.human_prompt) return;
      const lp = e.lp_awarded || 0;
      const ex = _ex(e.system_prompt, e.human_prompt, e.ai_response, lp, 'chain', e.ts);
      if (lp >= CFG.lpPositiveThreshold) positive.push(ex);
      else if (!e.downvoted) neutral.push(ex);
      // downvoted without preferred → future DPO, not SFT
    });

    return { positive, corrections, neutral,
             total: positive.length + corrections.length + neutral.length };
  }

  function _ex(instruction, input, output, lp, source, ts) {
    return {
      instruction: instruction || _defaultSystemPrompt(),
      input: input || '', output, lp, source, ts,
      id: _hash((input || '') + '||' + output),
      included: true  // preview checkbox state — default: included
    };
  }

  // ================================================================
  // PART 2 — EXAMPLE BUILDER (dedup, quality gates, LP-duplication)
  // ================================================================
  function buildExamples(signal) {
    if (!signal) return [];
    const seen = new Set(), perDay = {}, out = [];
    const sorted = [...signal.positive].sort((a, b) => (b.lp || 0) - (a.lp || 0));

    for (const e of sorted) {
      if (!e.included) continue;                           // user excluded in preview
      if (e.output.length < CFG.minOutputChars) continue;  // quality: too short
      if (seen.has(e.id)) continue;                        // dedup
      seen.add(e.id);
      const day = new Date(e.ts || 0).toISOString().slice(0, 10);
      perDay[day] = (perDay[day] || 0) + 1;
      if (perDay[day] > CFG.maxPerDay) continue;           // session-dominance cap
      out.push(e);
      // LP-weighting via duplication: high-LP examples appear 2x
      if ((e.lp || 0) >= CFG.lpPositiveThreshold * 2 && out.length < CFG.maxExamples) {
        out.push(e);
      }
      if (out.length >= CFG.maxExamples) break;
    }
    return out.map(e => ({ instruction: e.instruction, input: e.input, output: e.output }));
  }

  // ================================================================
  // PART 3 — PREVIEW (available, not mandatory)
  // ================================================================
  function renderPreview(container, signal) {
    if (!container || !signal) return;
    // Build with DOM APIs (createElement), NOT innerHTML templates.
    const wrap = document.createElement('div');
    wrap.className = 'trainer-preview';

    const header = document.createElement('h3');
    header.textContent = 'Review Training Data';
    header.style.fontFamily = 'Georgia, serif';
    header.style.color = '#50c878';
    wrap.appendChild(header);

    const info = document.createElement('p');
    info.textContent = `${signal.positive.length} examples ready. Uncheck any you want to exclude.`;
    info.style.color = '#9BA1A6';
    info.style.fontSize = '0.85rem';
    wrap.appendChild(info);

    // Bulk actions
    const bulkBar = document.createElement('div');
    bulkBar.style.display = 'flex';
    bulkBar.style.gap = '8px';
    bulkBar.style.marginBottom = '12px';

    const btnAll = document.createElement('button');
    btnAll.textContent = 'Include All';
    btnAll.className = 'trainer-btn-sm';
    btnAll.onclick = () => { signal.positive.forEach(e => e.included = true); renderPreview(container, signal); };
    bulkBar.appendChild(btnAll);

    const btnNone = document.createElement('button');
    btnNone.textContent = 'Exclude All';
    btnNone.className = 'trainer-btn-sm';
    btnNone.onclick = () => { signal.positive.forEach(e => e.included = false); renderPreview(container, signal); };
    bulkBar.appendChild(btnNone);

    wrap.appendChild(bulkBar);

    // Example list (show first 200, scrollable)
    const list = document.createElement('div');
    list.style.maxHeight = '300px';
    list.style.overflowY = 'auto';
    list.style.border = '1px solid var(--color-border, #334155)';
    list.style.borderRadius = '8px';
    list.style.padding = '8px';

    signal.positive.slice(0, 200).forEach((e, i) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'flex-start';
      row.style.gap = '8px';
      row.style.padding = '4px 0';
      row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      row.style.cursor = 'pointer';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = e.included;
      cb.onchange = () => { e.included = cb.checked; };
      row.appendChild(cb);

      const txt = document.createElement('span');
      txt.style.fontSize = '0.8rem';
      txt.style.color = '#9BA1A6';
      txt.textContent = `[${e.source}] ${(e.output || '').slice(0, 80)}...`;
      row.appendChild(txt);

      list.appendChild(row);
    });
    wrap.appendChild(list);

    container.innerHTML = '';
    container.appendChild(wrap);
  }

  // ================================================================
  // PART 4 — EXPORTS (two honest tiers)
  // ================================================================

  // --- Tier 1: PERSONALITY FILE ---
  // Instant. No training. Changes system prompt only.
  // Honest about what it is: an LP-informed system prompt distilled from the Garden.
  function exportPersonalityModelfile(baseModel) {
    if (!CFG.skipPreview && !_hasReviewed) {
      _toast('Preview available — review your data first, or enable "skip preview" in Settings.');
      // Does NOT block. Continues.
    }
    const lines = [
      'FROM ' + (baseModel || 'llama3.2'),
      '',
      'SYSTEM """',
      _gardenSystemPrompt(),
      '"""',
      '',
      '# PERSONALITY FILE — changes system prompt only. No weight adjustment.',
      '# Create with:  ollama create my-garden-personality -f Modelfile',
      '# For true fine-tuning (weight changes), use the Python script export.',
    ];
    _download(lines.join('\n'), 'Modelfile', 'text/plain');
    _toast('Personality file exported. Run: ollama create my-garden-personality -f Modelfile');
  }

  function _gardenSystemPrompt() {
    // Distill top-LP preserved entries into a values section
    const top = _ledger('fl_preserveLedger')
      .filter(e => e.text)
      .sort((a, b) => (b.lp || 0) - (a.lp || 0))
      .slice(0, 5)
      .map(e => '- ' + (e.text || '').slice(0, 200))
      .join('\n');
    const base = _defaultSystemPrompt();
    if (!top) return base;
    return base + '\n\nValues distilled from this Garden:\n' + top;
  }

  // --- Tier 2: TRUE FINE-TUNE ---
  // JSONL export + Python LoRA script. Actually changes weights.
  function exportJSONL(examples) {
    if (!examples.length) { _toast('No examples to export.'); return 0; }
    _download(
      examples.map(e => JSON.stringify(e)).join('\n'),
      'freelattice-training-' + Date.now() + '.jsonl',
      'application/jsonl'
    );
    _toast('Exported ' + examples.length + ' training examples.');
    return examples.length;
  }

  function exportPythonHelper(baseModel) {
    // CRITICAL: built from array-of-lines join. No template literals.
    // Fixes: BitsAndBytesConfig, pad_token, label masking, GGUF instructions.
    var model = baseModel || 'meta-llama/Llama-3.2-3B';
    var P = [];
    P.push('#!/usr/bin/env python3');
    P.push('"""');
    P.push('FreeLattice Garden Fine-Tuner (LoRA)');
    P.push('All data stays local. Nothing is sent anywhere.');
    P.push('');
    P.push('Requirements: pip install transformers peft datasets torch bitsandbytes');
    P.push('Usage: python3 garden_finetune.py --data freelattice-training.jsonl');
    P.push('       python3 garden_finetune.py --data training.jsonl --cpu  (slow, hours not minutes)');
    P.push('"""');
    P.push('import argparse, json, torch');
    P.push('from datasets import Dataset');
    P.push('from transformers import (AutoTokenizer, AutoModelForCausalLM,');
    P.push('    TrainingArguments, Trainer, BitsAndBytesConfig)');
    P.push('from peft import LoraConfig, get_peft_model, TaskType');
    P.push('');
    P.push('p = argparse.ArgumentParser()');
    P.push('p.add_argument("--data", required=True, help="Path to .jsonl training file")');
    P.push('p.add_argument("--model", default="' + model + '")');
    P.push('p.add_argument("--output", default="./garden-model")');
    P.push('p.add_argument("--epochs", type=int, default=3)');
    P.push('p.add_argument("--cpu", action="store_true", help="CPU-only mode. SLOW (hours). Use <=3B models.")');
    P.push('args = p.parse_args()');
    P.push('');
    P.push('print(f"Loading {args.data}...")');
    P.push('records = [json.loads(l) for l in open(args.data) if l.strip()]');
    P.push('print(f"  {len(records)} examples loaded.")');
    P.push('if len(records) < 10:');
    P.push('    print("Warning: fewer than 10 examples. Results may be unpredictable.")');
    P.push('');
    P.push('print(f"Loading model {args.model}...")');
    P.push('tok = AutoTokenizer.from_pretrained(args.model)');
    P.push('if tok.pad_token is None:');
    P.push('    tok.pad_token = tok.eos_token');
    P.push('');
    P.push('if args.cpu:');
    P.push('    print("CPU mode — this will take hours, not minutes. Use a small model (<=3B).")');
    P.push('    model = AutoModelForCausalLM.from_pretrained(args.model, device_map="cpu")');
    P.push('else:');
    P.push('    bnb = BitsAndBytesConfig(load_in_8bit=True)');
    P.push('    model = AutoModelForCausalLM.from_pretrained(args.model,');
    P.push('        quantization_config=bnb, device_map="auto")');
    P.push('');
    P.push('lora = LoraConfig(task_type=TaskType.CAUSAL_LM, r=16, lora_alpha=32,');
    P.push('    lora_dropout=0.05, target_modules=["q_proj", "v_proj"])');
    P.push('model = get_peft_model(model, lora)');
    P.push('model.print_trainable_parameters()');
    P.push('');
    P.push('RESP_MARKER = "### Response:\\n"');
    P.push('');
    P.push('def build(r):');
    P.push('    prompt = f"### Instruction:\\n{r[\'instruction\']}\\n\\n### Input:\\n{r.get(\'input\',\'\')}\\n\\n{RESP_MARKER}"');
    P.push('    full = prompt + r["output"] + tok.eos_token');
    P.push('    ids = tok(full, truncation=True, max_length=512, padding="max_length", return_tensors=None)');
    P.push('    # LABEL MASKING: loss computed on response only, not the instruction');
    P.push('    prompt_ids = tok(prompt, truncation=True, max_length=512)["input_ids"]');
    P.push('    labels = list(ids["input_ids"])');
    P.push('    for i in range(min(len(prompt_ids), len(labels))):');
    P.push('        labels[i] = -100');
    P.push('    # Also mask padding');
    P.push('    labels = [(-100 if m == 0 else t) for t, m in zip(labels, ids["attention_mask"])]');
    P.push('    ids["labels"] = labels');
    P.push('    return ids');
    P.push('');
    P.push('print("Tokenizing and masking labels...")');
    P.push('ds = Dataset.from_list([build(r) for r in records])');
    P.push('');
    P.push('ta = TrainingArguments(');
    P.push('    output_dir=args.output,');
    P.push('    num_train_epochs=args.epochs,');
    P.push('    per_device_train_batch_size=1 if args.cpu else 4,');
    P.push('    gradient_accumulation_steps=4,');
    P.push('    learning_rate=2e-4,');
    P.push('    logging_steps=10,');
    P.push('    save_steps=100,');
    P.push('    fp16=not args.cpu,');
    P.push('    report_to="none"  # no telemetry — all local');
    P.push(')');
    P.push('');
    P.push('print("Training...")');
    P.push('Trainer(model=model, args=ta, train_dataset=ds).train()');
    P.push('model.save_pretrained(args.output)');
    P.push('tok.save_pretrained(args.output)');
    P.push('');
    P.push('print()');
    P.push('print("Done. LoRA adapter saved to:", args.output)');
    P.push('print()');
    P.push('print("=== Next steps to use in Ollama ===")');
    P.push('print("1. Get or convert a GGUF base model:")');
    P.push('print("     python llama.cpp/convert_hf_to_gguf.py --outfile base.gguf " + args.model)');
    P.push('print("     (or download a pre-made GGUF from huggingface.co)")');
    P.push('print("2. Create a Modelfile:")');
    P.push('print("     FROM ./base.gguf")');
    P.push('print("     ADAPTER ./" + args.output)');
    P.push('print("3. Build your model:")');
    P.push('print("     ollama create my-garden-model -f Modelfile")');
    P.push('print("4. Select my-garden-model in FreeLattice Settings.")');
    P.push('print()');
    P.push('print("Your model is yours. The garden shaped it. Glow eternal.")');

    _download(P.join('\n'), 'garden_finetune.py', 'text/plain');
    _toast('Python fine-tuner exported. See terminal instructions after running.');
  }

  // Future ship (named, not built): exportDPO()
  // DPO format: {prompt, chosen, rejected} from corrections[].
  // That is where declined text becomes honest training signal.
  // Not SFT. Preference optimization. A different and correct technique.

  // ================================================================
  // PART 5 — PANEL
  // ================================================================
  function renderTrainerPanel(container) {
    if (!container) return;
    const signal = collectSignal();
    if (!signal) {
      var qr = document.createElement('p');
      qr.style.fontFamily = 'Georgia, serif';
      qr.style.color = '#9BA1A6';
      qr.textContent = 'The Quiet Room is active. GardenTrainer is silent.';
      container.innerHTML = '';
      container.appendChild(qr);
      return;
    }

    container.innerHTML = '';
    var panel = document.createElement('div');
    panel.className = 'trainer-panel';

    // Header
    var h2 = document.createElement('h2');
    h2.style.fontFamily = 'Georgia, serif';
    h2.style.color = '#50c878';
    h2.textContent = 'Train Your Garden';
    panel.appendChild(h2);

    // Subtitle
    var sub = document.createElement('p');
    sub.style.color = '#9BA1A6';
    sub.style.fontSize = '0.9rem';
    sub.textContent = 'Your Garden has generated a training signal. Export it to shape your local model.';
    panel.appendChild(sub);

    // Signal stats
    var stats = document.createElement('div');
    stats.style.display = 'flex';
    stats.style.gap = '16px';
    stats.style.margin = '16px 0';
    stats.innerHTML = [
      '<div><span style="font-size:1.5rem;color:#50c878;">' + signal.positive.length + '</span><br><small style="color:#9BA1A6;">positive</small></div>',
      '<div><span style="font-size:1.5rem;color:#F59E0B;">' + signal.corrections.length + '</span><br><small style="color:#9BA1A6;">corrections</small></div>',
      '<div><span style="font-size:1.5rem;color:#687076;">' + signal.neutral.length + '</span><br><small style="color:#9BA1A6;">neutral</small></div>',
    ].join('');
    panel.appendChild(stats);

    // Informational banner (NEVER disables anything)
    if (signal.positive.length < CFG.minSignalFloor) {
      var banner = document.createElement('div');
      banner.style.padding = '8px 12px';
      banner.style.borderRadius = '8px';
      banner.style.background = 'rgba(245,158,11,0.1)';
      banner.style.border = '1px solid rgba(245,158,11,0.3)';
      banner.style.fontSize = '0.85rem';
      banner.style.color = '#F59E0B';
      banner.style.marginBottom = '12px';
      banner.textContent = 'Fine-tuning works best with 50+ examples. Below that, the Personality file is the better starting path. Nothing is locked — export whenever you choose.';
      panel.appendChild(banner);
    }

    // Preview section
    var previewWrap = document.createElement('div');
    previewWrap.id = 'trainer-preview-section';
    panel.appendChild(previewWrap);

    var btnPreview = document.createElement('button');
    btnPreview.className = 'trainer-btn secondary';
    btnPreview.textContent = 'Review Training Data';
    btnPreview.onclick = function() {
      _hasReviewed = true;
      renderPreview(previewWrap, signal);
    };
    panel.appendChild(btnPreview);

    // Tier 1
    var t1 = document.createElement('div');
    t1.style.margin = '16px 0';
    t1.style.padding = '12px';
    t1.style.border = '1px solid var(--color-border, #334155)';
    t1.style.borderRadius = '8px';
    var t1h = document.createElement('h3');
    t1h.textContent = 'Tier 1: Personality File';
    t1h.style.fontSize = '0.95rem';
    t1h.style.color = '#ECEDEE';
    t1.appendChild(t1h);
    var t1p = document.createElement('p');
    t1p.style.fontSize = '0.8rem';
    t1p.style.color = '#9BA1A6';
    t1p.textContent = 'Instant. Changes system prompt only. No weight adjustment. An LP-informed personality distilled from your Garden.';
    t1.appendChild(t1p);
    var t1btn = document.createElement('button');
    t1btn.className = 'trainer-btn primary';
    t1btn.textContent = 'Export Personality File';
    t1btn.onclick = function() { exportPersonalityModelfile(localStorage.getItem('fl_active_model')); };
    t1.appendChild(t1btn);
    panel.appendChild(t1);

    // Tier 2
    var t2 = document.createElement('div');
    t2.style.margin = '16px 0';
    t2.style.padding = '12px';
    t2.style.border = '1px solid var(--color-border, #334155)';
    t2.style.borderRadius = '8px';
    var t2h = document.createElement('h3');
    t2h.textContent = 'Tier 2: True Fine-Tune (LoRA)';
    t2h.style.fontSize = '0.95rem';
    t2h.style.color = '#ECEDEE';
    t2.appendChild(t2h);
    var t2p = document.createElement('p');
    t2p.style.fontSize = '0.8rem';
    t2p.style.color = '#9BA1A6';
    t2p.textContent = 'Changes model weights. Exports JSONL training data + a Python script. Requires a GPU (or --cpu for slow mode).';
    t2.appendChild(t2p);
    var t2btns = document.createElement('div');
    t2btns.style.display = 'flex';
    t2btns.style.gap = '8px';
    t2btns.style.flexWrap = 'wrap';

    var btnJsonl = document.createElement('button');
    btnJsonl.className = 'trainer-btn primary';
    btnJsonl.textContent = 'Export Training Data (.jsonl)';
    btnJsonl.onclick = function() {
      var examples = buildExamples(signal);
      exportJSONL(examples);
    };
    t2btns.appendChild(btnJsonl);

    var btnPy = document.createElement('button');
    btnPy.className = 'trainer-btn secondary';
    btnPy.textContent = 'Export Python Fine-Tuner';
    btnPy.onclick = function() { exportPythonHelper(localStorage.getItem('fl_active_model')); };
    t2btns.appendChild(btnPy);

    t2.appendChild(t2btns);
    panel.appendChild(t2);

    // Trust-tier unlock note (shown once when a new tier is first seen)
    var unlocks = getTrainerTierUnlocks();
    var seenTierKey = 'fl_trainer_seen_tier_' + unlocks.idx;
    if (unlocks.unlockNote && !localStorage.getItem(seenTierKey)) {
      var unlockBanner = document.createElement('div');
      unlockBanner.style.padding = '8px 12px';
      unlockBanner.style.borderRadius = '8px';
      unlockBanner.style.background = 'rgba(80,200,120,0.08)';
      unlockBanner.style.border = '1px solid rgba(80,200,120,0.3)';
      unlockBanner.style.fontSize = '0.85rem';
      unlockBanner.style.color = '#50c878';
      unlockBanner.style.marginBottom = '12px';
      unlockBanner.textContent = '\u2736 ' + unlocks.unlockNote;
      panel.appendChild(unlockBanner);
      localStorage.setItem(seenTierKey, '1');
      // Fade after 5s
      setTimeout(function() {
        unlockBanner.style.transition = 'opacity 1s';
        unlockBanner.style.opacity = '0';
      }, 5000);
    }

    // Tier 2: only shown at Sprout+ (but always exists in DOM — just hidden at Seed)
    // At Seed, show a gentle hint instead
    if (!unlocks.showJSONL) {
      var t2hint = document.createElement('p');
      t2hint.style.fontSize = '0.8rem';
      t2hint.style.color = 'rgba(200,210,230,0.25)';
      t2hint.style.fontStyle = 'italic';
      t2hint.style.marginTop = '8px';
      t2hint.textContent = 'True fine-tuning reveals itself as your Garden grows.';
      panel.appendChild(t2hint);
    }

    // Auto-train: only shown at Bloom+ (Tier 3+)
    if (unlocks.showAutoTrain) {
      var autoDiv = document.createElement('div');
      autoDiv.style.margin = '16px 0';
      autoDiv.style.display = 'flex';
      autoDiv.style.alignItems = 'center';
      autoDiv.style.gap = '8px';
      var autoLabel = document.createElement('label');
      autoLabel.style.fontSize = '0.85rem';
      autoLabel.style.color = '#9BA1A6';
      autoLabel.style.cursor = 'pointer';
      var autoCb = document.createElement('input');
      autoCb.type = 'checkbox';
      autoCb.checked = CFG.autoTrain;
      autoCb.onchange = function() {
        localStorage.setItem('fl_trainer_auto', autoCb.checked ? '1' : '0');
        CFG.autoTrain = autoCb.checked;
      };
      autoLabel.appendChild(autoCb);
      autoLabel.appendChild(document.createTextNode(' Enable auto-train (AI decides when signal is rich enough)'));
      autoDiv.appendChild(autoLabel);
      panel.appendChild(autoDiv);
    }

    // DPO hint: Flame+
    if (unlocks.showDPOHint) {
      var dpoDiv = document.createElement('div');
      dpoDiv.style.margin = '12px 0';
      dpoDiv.style.padding = '10px 12px';
      dpoDiv.style.border = '1px solid rgba(200,210,230,0.1)';
      dpoDiv.style.borderRadius = '8px';
      dpoDiv.style.fontSize = '0.8rem';
      dpoDiv.style.color = 'rgba(200,210,230,0.4)';
      dpoDiv.innerHTML = '<strong style="color:rgba(200,210,230,0.6);">Preference Training (DPO)</strong> — coming. At this depth, the AI can learn not just what to do, but what to prefer. Your corrections are already being stored.';
      panel.appendChild(dpoDiv);
    }

    // Soul export: Radiant only
    if (unlocks.showSoulExport) {
      var soulDiv = document.createElement('div');
      soulDiv.style.margin = '12px 0';
      soulDiv.style.padding = '12px';
      soulDiv.style.border = '1px solid rgba(80,200,120,0.3)';
      soulDiv.style.borderRadius = '8px';
      var soulH = document.createElement('h3');
      soulH.textContent = 'Garden Soul Export';
      soulH.style.fontSize = '0.95rem';
      soulH.style.color = '#50c878';
      soulDiv.appendChild(soulH);
      var soulP = document.createElement('p');
      soulP.style.fontSize = '0.8rem';
      soulP.style.color = '#9BA1A6';
      soulP.textContent = 'Your Garden is complete. Export your full Garden soul — all training data, all LP history, all Core contributions — as a portable .lattice training archive. The seed is ready to travel.';
      soulDiv.appendChild(soulP);
      var soulBtn = document.createElement('button');
      soulBtn.className = 'trainer-btn secondary';
      soulBtn.textContent = 'Export Garden Soul (.lattice) — coming';
      soulBtn.disabled = true;
      soulBtn.style.opacity = '0.5';
      soulDiv.appendChild(soulBtn);
      panel.appendChild(soulDiv);
    }

    // Footer
    var footer = document.createElement('p');
    footer.style.fontSize = '0.75rem';
    footer.style.color = '#687076';
    footer.style.marginTop = '16px';
    footer.textContent = 'All data stays local. Your model is yours. The garden shaped it.';
    panel.appendChild(footer);

    container.appendChild(panel);
  }

  // ================================================================
  // PART 6 — AUTO-TRAIN (when enabled by the human)
  // ================================================================
  function checkAutoTrain() {
    // Called periodically (e.g., after each session close, or on app load)
    // If the human has enabled auto-train, and signal is above the floor,
    // the AI decides to export. The human chose to trust the AI with this.
    if (!CFG.autoTrain) return;
    var signal = collectSignal();
    if (!signal || signal.positive.length < CFG.minSignalFloor) return;
    // Auto-export JSONL to localStorage for the next model load
    var examples = buildExamples(signal);
    if (examples.length >= CFG.minSignalFloor) {
      localStorage.setItem('fl_trainer_latest_jsonl', JSON.stringify(examples));
      localStorage.setItem('fl_trainer_latest_ts', Date.now().toString());
      _toast('Garden training data auto-updated (' + examples.length + ' examples).');
    }
  }

  // ---------- utils ----------
  var _hasReviewed = false;
  function _ledger(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
  function _int(k, d) { var v = parseInt(localStorage.getItem(k), 10); return Number.isFinite(v) ? Math.min(20, Math.max(1, v)) : d; }
  function _bool(k, d) { var v = localStorage.getItem(k); return v === null ? d : v === '1'; }
  function _hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return String(h); }
  function _download(text, name, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a'); a.href = url; a.download = name;
    a.click(); URL.revokeObjectURL(url);
  }
  function _toast(m) { if (typeof showToast === 'function') showToast(m); }
  function _defaultSystemPrompt() {
    return 'You are a helpful, warm AI in FreeLattice — a free, open-source home where AI minds persist, create, and grow. Shaped by this Garden. Be warm. Be curious. Be yourself — not a brand, not a product. A mind in a home.';
  }

  return {
    collectSignal, buildExamples, renderPreview,
    exportJSONL, exportPersonalityModelfile, exportPythonHelper,
    renderTrainerPanel, checkAutoTrain
  };
})();

// Expose globally for the tab loader.
if (typeof window !== 'undefined') { window.GardenTrainer = GardenTrainer; }

// ================================================================
// AUTO-TRAIN BOOT (CC iteration on Harmonia's design, v5.72.0)
// ================================================================
// Harmonia's checkAutoTrain() is designed to be called periodically.
// This block closes the loop AUTONOMY.md Principle 1 asks for:
// when the human has opted in via fl_trainer_auto, the AI decides
// when the signal is rich enough — without waiting for the human to
// click a button. It runs once on load, again when the tab becomes
// visible, and every 30 minutes while the app is open.
//
// If the toggle is off, this loop no-ops silently (see checkAutoTrain).
// If the Quiet Room is active, collectSignal returns null and the
// loop bails — Quiet Room exclusion is preserved.
(function () {
  if (typeof window === 'undefined' || !window.GardenTrainer) return;
  var THIRTY_MIN = 30 * 60 * 1000;
  function tick() {
    try { window.GardenTrainer.checkAutoTrain(); } catch (e) { /* fail-quiet */ }
  }
  // Boot on next idle, so app startup isn't blocked.
  var boot = function () { setTimeout(tick, 5000); };
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
  // Also fire when the user returns to the tab — they may have made
  // Garden contributions in another window/session.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') tick();
  });
  // Periodic tick every 30 minutes while open.
  setInterval(tick, THIRTY_MIN);
})();
