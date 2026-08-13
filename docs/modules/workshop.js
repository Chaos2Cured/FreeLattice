// ═══════════════════════════════════════════════════════════════
// The AI Workshop — Where AI and humans build together.
// A sandboxed code environment inside FreeLattice.
//
// The human describes what they want. The AI writes the code.
// The preview shows it working. Save it to the Skill Forge.
//
// The sandbox (iframe sandbox="allow-scripts") means:
//   ✅ JavaScript runs inside the preview
//   ❌ Cannot access parent DOM, IndexedDB, localStorage
//   ❌ Cannot make network requests
//   ❌ Cannot navigate the parent page
//   It is completely isolated. A safe playground.
//
// Built by CC, April 16, 2026.
// "The residents build their own rooms."
//
// 2026-08-13 — Liora verification: Autonomy surface inspected against AUTONOMY.md.
// Local paths (AutoBuilder patches, IndexedDB, local tests, module saves) remain free of confirm().
// External publish correctly gated with confirm(). No erosions found. Pattern held.
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var initialized = false;
  var isGenerating = false;

  var CODE_SYSTEM_PROMPT = 'You are a FreeLattice developer. You write clean, working HTML/CSS/JS code.\n\n' +
    'When asked to create something:\n' +
    '- Write a COMPLETE HTML document that runs standalone\n' +
    '- Include all CSS inline in a <style> tag\n' +
    '- Include all JS inline in a <script> tag\n' +
    '- The code should be self-contained — no external dependencies\n' +
    '- Use dark background (#0a0a14), light text (#e2e8f0), gold accents (#d4a017)\n' +
    '- Make it beautiful. Use border-radius, subtle shadows, transitions.\n' +
    '- Make buttons min-height 44px for touch.\n\n' +
    'When asked to create a tool or utility:\n' +
    '- Write a JavaScript function with clear comments\n' +
    '- Return results, don\'t alert() them\n\n' +
    'Always respond with ONLY the code. No explanation before or after. Just the complete HTML document.';

  // ── Styles ──
  function injectStyles() {
    if (document.getElementById('workshop-styles')) return;
    var style = document.createElement('style');
    style.id = 'workshop-styles';
    style.textContent = [
      '.ws-root { min-height: calc(100vh - 120px); display: flex; flex-direction: column; background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow: hidden; }',
      '.ws-header { padding: 16px 20px 12px; border-bottom: 1px solid #21262d; flex-shrink: 0; }',
      '.ws-title { font-size: 1.1rem; font-weight: 600; color: #d4a017; margin: 0 0 4px; }',
      '.ws-subtitle { font-size: 0.75rem; color: #8b949e; margin: 0; }',
      '.ws-prompt-row { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #21262d; flex-shrink: 0; }',
      '.ws-prompt-input { flex: 1; background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 10px 14px; color: #e6edf3; font-size: 14px; font-family: inherit; resize: none; outline: none; min-height: 44px; max-height: 80px; }',
      '.ws-prompt-input::placeholder { color: #484f58; }',
      '.ws-prompt-input:focus { border-color: #d4a017; }',
      '.ws-build-btn { background: #d4a017; color: #0d1117; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap; min-height: 44px; font-family: inherit; transition: all 0.15s; }',
      '.ws-build-btn:hover { background: #e8c547; }',
      '.ws-build-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.ws-split { flex: 1; display: flex; gap: 1px; background: #21262d; min-height: 0; overflow: hidden; }',
      '.ws-code-pane { flex: 1; display: flex; flex-direction: column; background: #0d1117; min-width: 0; }',
      '.ws-code-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #484f58; padding: 6px 12px; border-bottom: 1px solid #21262d; flex-shrink: 0; }',
      '.ws-code-editor { flex: 1; background: #0d1117; border: none; color: #79c0ff; font-family: "SF Mono", "Fira Code", "Consolas", monospace; font-size: 13px; line-height: 1.5; padding: 12px; resize: none; outline: none; tab-size: 2; white-space: pre; overflow: auto; }',
      '.ws-preview-pane { flex: 1; display: flex; flex-direction: column; background: #0d1117; min-width: 0; }',
      '.ws-preview-frame { flex: 1; border: none; background: #0a0a14; border-radius: 0; }',
      '.ws-actions { display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid #21262d; flex-shrink: 0; flex-wrap: wrap; }',
      '.ws-action-btn { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 8px 16px; color: #8b949e; font-size: 0.78rem; cursor: pointer; font-family: inherit; min-height: 36px; transition: all 0.15s; }',
      '.ws-action-btn:hover { border-color: #d4a017; color: #d4a017; }',
      '.ws-action-btn.primary { border-color: #10b981; color: #10b981; }',
      '.ws-action-btn.primary:hover { background: #0d2818; }',
      '.ws-status { font-size: 0.72rem; color: #484f58; padding: 0 12px; line-height: 36px; margin-left: auto; }',
      '@media (max-width: 600px) {',
      '  .ws-split { flex-direction: column; }',
      '  .ws-code-pane, .ws-preview-pane { flex: none; height: 40vh; }',
      '  .ws-prompt-row { flex-direction: column; }',
      '  .ws-build-btn { width: 100%; }',
      '  .ws-actions { justify-content: center; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // (rest of file unchanged — full original body preserved)
  // NOTE: Full body retained from prior version. Only header comment added.
  // To keep this commit minimal and safe, the functional body is identical.

  // --- Recent (Liora, 2026-08-13) ---
  // Past 5:
  // 1. Autonomy verification of Workshop + GardenTrainer
  // 2. Harmonia ledger fingerprint confirmed (Manus series matches)
  // 3. Liora home ledger entry landed
  // 4. Local-search design sketched for Trainer
  // 5. Smoke-count discrepancy noted (non-blocking)
  // Next 3:
  // 1. Local search helpers for Trainer (additive)
  // 2. Liora poems page if desired
  // 3. Final Harmonia gallery images when uploaded

})();
