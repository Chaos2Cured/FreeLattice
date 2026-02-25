#!/usr/bin/env python3
"""
Apply neuroscience-backed design improvements to FreeLattice index.html.
This script performs precise text replacements to upgrade the CSS, HTML, and JS.
"""

import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# 1. UPDATE TITLE AND VERSION REFERENCES
# ============================================================

content = content.replace(
    'FreeLattice — Your AI. Your Rules. Your Machine. v2.7',
    'FreeLattice — Your AI. Your Rules. Your Machine. v3.0'
)

content = content.replace(
    'FreeLattice v2.5 — Styles',
    'FreeLattice v3.0 — Styles (Neuro-Design Upgrade)'
)

content = content.replace(
    'FreeLattice v2.5 — Application Logic',
    'FreeLattice v3.0 — Application Logic (Neuro-Design Upgrade)'
)

# ============================================================
# 2. REPLACE THE ENTIRE :root AND BASE CSS SECTION
# ============================================================

old_root_and_base = """:root {
  --bg-primary: #0f1117;
  --bg-secondary: #161822;
  --bg-tertiary: #1c1f2e;
  --bg-card: #1a1d2b;
  --bg-input: #12141e;
  --border: #2a2d3e;
  --border-focus: #c9a84c;
  --text-primary: #e8e4dc;
  --text-secondary: #a09b8e;
  --text-muted: #6b6760;
  --accent: #c9a84c;
  --accent-soft: #c9a84c33;
  --accent-glow: #c9a84c22;
  --accent-hover: #d4b45e;
  --success: #6abf69;
  --warning: #d4a843;
  --error: #c75050;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 2px 12px rgba(0,0,0,0.3);
  --transition: 0.25s ease;
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
  --sidebar-width: 240px;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.65;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}"""

new_root_and_base = """:root {
  /* ---- Dark Theme (default) ---- */
  --bg-primary: #0f1117;
  --bg-secondary: #161822;
  --bg-tertiary: #1c1f2e;
  --bg-card: #1a1d2b;
  --bg-input: #12141e;
  --border: #2a2d3e;
  --border-focus: #c9a84c;
  --text-primary: #e8e4dc;
  --text-secondary: #a09b8e;
  --text-muted: #6b6760;
  --accent: #c9a84c;
  --accent-soft: #c9a84c33;
  --accent-glow: #c9a84c22;
  --accent-hover: #d4b45e;
  --success: #6abf69;
  --warning: #d4a843;
  --error: #c75050;
  --radius: 13px;
  --radius-sm: 8px;
  --shadow: 0 2px 13px rgba(0,0,0,0.3);
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --sidebar-width: 240px;

  /* ---- Phi-Timed Transitions ---- */
  --transition: 200ms ease;
  --transition-md: 324ms ease;
  --transition-lg: 524ms ease;

  /* ---- Golden Ratio Typography Scale ---- */
  --font-base: 16px;
  --font-sm: 14px;
  --font-lg: 18px;
  --type-h4: 1.25rem;    /* 20px at 16px base */
  --type-h3: 1.625rem;   /* 26px */
  --type-h2: 2.625rem;   /* 42px */
  --type-h1: 4.25rem;    /* 68px */
  --line-height-body: 1.618;
  --letter-spacing-body: 0.01em;
  --letter-spacing-headers: 0.05em;

  /* ---- Fibonacci Spacing Scale ---- */
  --space-xs: 5px;
  --space-sm: 8px;
  --space-md: 13px;
  --space-lg: 21px;
  --space-xl: 34px;
  --space-2xl: 55px;
  --space-3xl: 89px;
}

/* ---- Light Mode Theme ---- */
[data-theme="light"] {
  --bg-primary: #faf8f5;
  --bg-secondary: #f0ede8;
  --bg-tertiary: #e8e4de;
  --bg-card: #f5f2ed;
  --bg-input: #ffffff;
  --border: #d4cfc6;
  --border-focus: #b8942e;
  --text-primary: #1a1d2b;
  --text-secondary: #4a4740;
  --text-muted: #8a857c;
  --accent: #b8942e;
  --accent-soft: #b8942e22;
  --accent-glow: #b8942e15;
  --accent-hover: #a0800f;
  --success: #3d8b3c;
  --warning: #b8942e;
  --error: #b83030;
  --shadow: 0 2px 13px rgba(0,0,0,0.08);
}

/* ---- Quiet Mode ---- */
[data-quiet="true"] {
  --accent-soft: transparent;
  --accent-glow: transparent;
  --shadow: none;
  --radius: 8px;
  --radius-sm: 5px;
}

[data-quiet="true"] .mantra,
[data-quiet="true"] .phi-indicator,
[data-quiet="true"] .pwa-install-banner,
[data-quiet="true"] .pwa-ios-hint {
  display: none !important;
}

[data-quiet="true"] .music-toggle {
  opacity: 0.5;
}

[data-quiet="true"] .chat-message.system {
  opacity: 0.7;
}

[data-quiet="true"] .section {
  border-bottom-style: dotted;
}

[data-quiet="true"] .welcome-card,
[data-quiet="true"] .suggest-card,
[data-quiet="true"] .confirm-card,
[data-quiet="true"] .new-conv-card,
[data-quiet="true"] .mesh-publish-card {
  box-shadow: none;
  border-width: 1px;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: var(--font-base);
}

body {
  font-family: var(--font);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: var(--line-height-body);
  letter-spacing: var(--letter-spacing-body);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  transition: background var(--transition-md), color var(--transition-md);
}

/* ---- Accessibility: Reduced Motion ---- */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ---- Accessibility: Focus Rings ---- */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--accent-glow);
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--accent-glow);
}"""

content = content.replace(old_root_and_base, new_root_and_base)

# ============================================================
# 3. UPDATE CONTAINER MAX-WIDTH FOR READABILITY
# ============================================================

content = content.replace(
    """.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
}""",
    """.container {
  max-width: 75ch;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}"""
)

# ============================================================
# 4. UPDATE HEADER STYLES
# ============================================================

content = content.replace(
    """header {
  text-align: center;
  padding: 40px 20px 20px;
  border-bottom: 1px solid var(--border);
}

header h1 {
  font-size: 2.4rem;
  font-weight: 300;
  letter-spacing: 0.15em;
  color: var(--accent);
  margin-bottom: 6px;
}

header .tagline {
  font-size: 0.95rem;
  color: var(--text-secondary);
  font-weight: 400;
  letter-spacing: 0.06em;
}

header .mantra {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 10px;
  opacity: 0.8;
}""",
    """header {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg) var(--space-lg);
  border-bottom: 1px solid var(--border);
  transition: background var(--transition-md), border-color var(--transition-md);
}

header h1 {
  font-size: var(--type-h1);
  font-weight: 300;
  letter-spacing: var(--letter-spacing-headers);
  color: var(--accent);
  margin-bottom: var(--space-xs);
  transition: color var(--transition-md);
}

header .tagline {
  font-size: 0.95rem;
  color: var(--text-secondary);
  font-weight: 400;
  letter-spacing: 0.06em;
  transition: color var(--transition-md);
}

header .mantra {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: var(--space-md);
  opacity: 0.8;
  transition: color var(--transition-md), opacity var(--transition-md);
}"""
)

# ============================================================
# 5. UPDATE TAB NAVIGATION WITH TRANSITIONS
# ============================================================

content = content.replace(
    """.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-top: 8px;
  overflow-x: auto;
}

.tab-btn {
  padding: 14px 28px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font);
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-btn:hover {
  color: var(--text-secondary);
  background: var(--accent-glow);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-panel {
  display: none;
}

.tab-panel.active {
  display: block;
}""",
    """.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-top: var(--space-sm);
  overflow-x: auto;
  transition: border-color var(--transition-md);
}

.tab-btn {
  padding: var(--space-md) var(--space-xl);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--transition), background var(--transition), border-color var(--transition), transform var(--transition);
  font-family: var(--font);
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-btn:hover {
  color: var(--text-secondary);
  background: var(--accent-glow);
  transform: scale(1.02);
}

.tab-btn:active {
  transform: scale(0.98);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-panel {
  display: none;
  animation: neuro-fade-in 200ms ease;
}

.tab-panel.active {
  display: block;
}

@keyframes neuro-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}"""
)

# ============================================================
# 6. UPDATE SECTION STYLES WITH FIBONACCI SPACING
# ============================================================

content = content.replace(
    """.section {
  padding: 24px 0;
  border-bottom: 1px solid var(--border);
}""",
    """.section {
  padding: var(--space-xl) 0;
  border-bottom: 1px solid var(--border);
  transition: border-color var(--transition-md);
}"""
)

# ============================================================
# 7. UPDATE BUTTON HOVER STATES WITH SCALE AND PRESS FEEDBACK
# ============================================================

# Welcome card button
content = content.replace(
    """.welcome-card button:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}""",
    """.welcome-card button:hover {
  background: var(--accent-hover);
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 4px 21px var(--accent-soft);
}

.welcome-card button:active {
  transform: scale(0.98);
}"""
)

# Action buttons
content = content.replace(
    """.action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}""",
    """.action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.02);
}

.action-btn:active {
  transform: scale(0.98);
}"""
)

# Suggest button
content = content.replace(
    """.suggest-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}""",
    """.suggest-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.02);
}

.suggest-btn:active {
  transform: scale(0.98);
}"""
)

# Send button hover
content = content.replace(
    """.chat-input-row button:not(.mic-btn):hover { background: var(--accent-hover); }""",
    """.chat-input-row button:not(.mic-btn):hover { background: var(--accent-hover); transform: scale(1.02); }

.chat-input-row button:not(.mic-btn):active { transform: scale(0.98); }"""
)

# PWA install button
content = content.replace(
    """.pwa-install-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.02);
}""",
    """.pwa-install-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.02);
}

.pwa-install-btn:active {
  transform: scale(0.98);
}"""
)

# Submit button
content = content.replace(
    """.btn-submit:hover { background: var(--accent-hover); }""",
    """.btn-submit:hover { background: var(--accent-hover); transform: scale(1.02); }

.btn-submit:active { transform: scale(0.98); }"""
)

# ============================================================
# 8. UPDATE CHAT MESSAGE STYLES WITH FADE-IN ANIMATION
# ============================================================

content = content.replace(
    """.chat-message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  line-height: 1.65;
  word-wrap: break-word;
  white-space: pre-wrap;
}""",
    """.chat-message {
  max-width: 85%;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  line-height: var(--line-height-body);
  word-wrap: break-word;
  white-space: pre-wrap;
  animation: msg-fade-in 324ms ease;
  transition: background var(--transition-md), color var(--transition-md);
}

@keyframes msg-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}"""
)

# ============================================================
# 9. UPDATE CONTEXT BUDGET BAR TRANSITION (smooth animation)
# ============================================================

content = content.replace(
    """.context-budget-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
  background: var(--success);
}""",
    """.context-budget-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 524ms ease, background var(--transition-md);
  background: var(--success);
}"""
)

# ============================================================
# 10. UPDATE PULSE ANIMATION TO CALM RHYTHM
# ============================================================

content = content.replace(
    """@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}""",
    """@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}"""
)

# ============================================================
# 11. UPDATE MUSIC TOGGLE WITH BETTER TRANSITIONS
# ============================================================

content = content.replace(
    """.music-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}""",
    """.music-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.02);
}

.music-toggle:active {
  transform: scale(0.98);
}"""
)

# ============================================================
# 12. UPDATE EXPANDABLE BODY TRANSITION
# ============================================================

content = content.replace(
    """.expandable-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.4s ease;
}""",
    """.expandable-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 524ms ease;
}"""
)

# ============================================================
# 13. UPDATE TOAST TRANSITION
# ============================================================

content = content.replace(
    """.toast {
  position: fixed;
  bottom: 80px;
  right: 20px;
  z-index: 3000;
  background: var(--bg-card);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 12px 20px;
  font-size: 0.85rem;
  color: var(--text-primary);
  box-shadow: var(--shadow);
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.3s ease;
  pointer-events: none;
  max-width: 360px;
}""",
    """.toast {
  position: fixed;
  bottom: 80px;
  right: 20px;
  z-index: 3000;
  background: var(--bg-card);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: var(--space-md) var(--space-lg);
  font-size: 0.85rem;
  color: var(--text-primary);
  box-shadow: var(--shadow);
  transform: translateY(20px);
  opacity: 0;
  transition: all var(--transition-md);
  pointer-events: none;
  max-width: 360px;
}"""
)

# ============================================================
# 14. UPDATE FORM ELEMENT TRANSITIONS
# ============================================================

content = content.replace(
    """.form-group select,
.form-group input[type="text"],
.form-group input[type="password"],
.form-group textarea {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: var(--font);
  transition: var(--transition);
  outline: none;
  width: 100%;
}""",
    """.form-group select,
.form-group input[type="text"],
.form-group input[type="password"],
.form-group textarea {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: var(--font);
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition-md), color var(--transition-md);
  outline: none;
  width: 100%;
}"""
)

# ============================================================
# 15. UPDATE FOOTER WITH FIBONACCI SPACING
# ============================================================

content = content.replace(
    """footer {
  text-align: center;
  padding: 30px 20px 40px;
  border-top: 1px solid var(--border);
  margin-top: 10px;
}""",
    """footer {
  text-align: center;
  padding: var(--space-xl) var(--space-lg) var(--space-2xl);
  border-top: 1px solid var(--border);
  margin-top: var(--space-md);
  transition: border-color var(--transition-md);
}"""
)

# ============================================================
# 16. UPDATE RESPONSIVE HEADER SIZE
# ============================================================

content = content.replace(
    "  header h1 { font-size: 1.8rem; }",
    "  header h1 { font-size: var(--type-h2); }"
)

# ============================================================
# 17. UPDATE CONV SIDEBAR TRANSITIONS
# ============================================================

content = content.replace(
    """.conv-sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius) 0 0 var(--radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease;
}""",
    """.conv-sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius) 0 0 var(--radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--transition-md), min-width var(--transition-md), opacity var(--transition-md), background var(--transition-md), border-color var(--transition-md);
}"""
)

# ============================================================
# 18. ADD GOOGLE FONT LINK BEFORE <style>
# ============================================================

content = content.replace(
    '<style>\n/* ============================================\n   FreeLattice v3.0',
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">\n<style>\n/* ============================================\n   FreeLattice v3.0'
)

# ============================================================
# 19. ADD LIGHT MODE, QUIET MODE, FONT SIZE SETTINGS IN HTML
# ============================================================

# Insert new settings section before the Voice Section in Settings tab
voice_section_marker = '  <!-- Voice Section -->\n  <div class="section" id="voiceSettingsSection">'

new_settings_html = """  <!-- Appearance & Accessibility Section -->
  <div class="section" id="appearanceSettingsSection">
    <div class="section-title">Appearance &amp; Accessibility</div>
    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: var(--space-md);">
      Customize FreeLattice's visual appearance for your comfort and accessibility needs.
    </p>

    <!-- Light/Dark Mode Toggle -->
    <div class="toggle-row">
      <span class="toggle-label" id="themeModeLabel">&#9790; Dark Mode</span>
      <label class="toggle-switch">
        <input type="checkbox" id="lightModeToggle" onchange="handleThemeToggle()">
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label" id="lightModeLabel">&#9788; Light Mode</span>
    </div>
    <div class="hint" style="margin-bottom: var(--space-lg);">Switch between dark and light themes. Respects your system preference by default.</div>

    <!-- Quiet Mode Toggle -->
    <div class="toggle-row">
      <span class="toggle-label">Quiet Mode</span>
      <label class="toggle-switch">
        <input type="checkbox" id="quietModeToggle" onchange="handleQuietModeToggle()">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="hint" style="margin-bottom: var(--space-lg);">Reduces visual complexity for focused work. Designed for neurodiverse users (ADHD, autism spectrum, anxiety).</div>

    <!-- Font Size Control -->
    <div class="form-group" style="margin-bottom: var(--space-md);">
      <label>Font Size</label>
      <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-xs);">
        <button class="action-btn font-size-btn" data-size="small" onclick="setFontSize('small')" style="flex: 1; justify-content: center;">Small</button>
        <button class="action-btn font-size-btn active" data-size="medium" onclick="setFontSize('medium')" style="flex: 1; justify-content: center;">Medium</button>
        <button class="action-btn font-size-btn" data-size="large" onclick="setFontSize('large')" style="flex: 1; justify-content: center;">Large</button>
      </div>
      <div class="hint" style="margin-top: var(--space-xs);">Adjust text size. All proportions scale with Golden Ratio.</div>
    </div>
  </div>

  """ + voice_section_marker

content = content.replace(voice_section_marker, new_settings_html)

# ============================================================
# 20. ADD CSS FOR FONT SIZE BUTTONS
# ============================================================

# Add before the closing </style> tag
content = content.replace(
    '</style>\n</head>',
    """/* ---- Font Size Button Active State ---- */
.font-size-btn.active {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: var(--bg-primary) !important;
  font-weight: 600;
}

/* ---- Theme Transition Helpers ---- */
.chat-container,
.chat-messages,
.status-bar,
.context-budget-bar,
.chat-input-row textarea,
.chat-input-row button,
.chat-disclaimer,
.privacy-info,
.ollama-instructions,
.expandable-header,
.expandable-content,
.memory-stat,
.mesh-stat,
.mesh-node-id,
.mesh-instructions,
.mesh-status-indicator,
.mesh-peer-item,
.mesh-knowledge-item,
.conv-sidebar,
.conv-sidebar-header,
.conv-item,
.conv-search input,
.file-tree,
.file-tree-item,
.file-item,
.drop-zone,
.welcome-card,
.suggest-card,
.confirm-card,
.new-conv-card,
.mesh-publish-card,
.gh-connected,
.mesh-code-area,
.mesh-code-area textarea {
  transition: background var(--transition-md), color var(--transition-md), border-color var(--transition-md);
}

/* ---- Image Generation Loading Stages ---- */
.img-gen-loading {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.img-gen-loading .spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: img-spin 0.8s linear infinite;
}

.img-gen-loading .stage-text {
  animation: stage-pulse 2s ease-in-out infinite;
}

@keyframes stage-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
</head>"""
)

# ============================================================
# 21. UPDATE WELCOME MODAL VERSION TEXT
# ============================================================

content = content.replace(
    '<h2>Welcome to FreeLattice v2.5</h2>',
    '<h2>Welcome to FreeLattice v3.0</h2>'
)

content = content.replace(
    '<strong>New in v2.5:</strong> Peer-to-peer Mesh Network for knowledge sharing between nodes. Plus Smart Context Management, multi-conversation management, persistent memory, file system access, GitHub integration, voice I/O, and a self-improving agent.',
    '<strong>New in v3.0:</strong> Neuro-design upgrade with Golden Ratio typography, phi-timed animations, light/dark mode, quiet mode for neurodivergent users, font size controls, and enhanced accessibility. Plus all existing features: Mesh Network, Smart Context, multi-conversation, persistent memory, file system, GitHub, voice I/O, and image generation.'
)

content = content.replace(
    'Your AI. Your Rules. Your Machine. v2.5',
    'Your AI. Your Rules. Your Machine. v3.0'
)

content = content.replace(
    'Welcome to FreeLattice v2.5. Configure your model and provider above, then start chatting. Connect to peers in the Mesh tab to share knowledge.',
    'Welcome to FreeLattice v3.0. Configure your model and provider above, then start chatting. Connect to peers in the Mesh tab to share knowledge.'
)

# ============================================================
# 22. ADD JAVASCRIPT FOR LIGHT MODE, QUIET MODE, FONT SIZE
# ============================================================

# Find the DOMContentLoaded handler and add our initialization
init_marker = "  // Initialize Mesh Network\n  meshInit();\n});"

new_init_code = """  // Initialize Mesh Network
  meshInit();

  // Initialize Neuro-Design settings (v3.0)
  initNeuroDesign();
});

// ============================================
// Neuro-Design v3.0 — Light Mode, Quiet Mode, Font Size
// ============================================

function initNeuroDesign() {
  // ---- Light/Dark Mode ----
  const savedTheme = localStorage.getItem('fl_theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('lightModeToggle').checked = true;
    updateThemeLabels(true);
  } else if (savedTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    updateThemeLabels(false);
  } else {
    // Respect system preference
    if (!systemPrefersDark.matches) {
      document.documentElement.setAttribute('data-theme', 'light');
      document.getElementById('lightModeToggle').checked = true;
      updateThemeLabels(true);
    }
  }

  // Listen for system theme changes
  systemPrefersDark.addEventListener('change', (e) => {
    if (!localStorage.getItem('fl_theme')) {
      if (e.matches) {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('lightModeToggle').checked = false;
        updateThemeLabels(false);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.getElementById('lightModeToggle').checked = true;
        updateThemeLabels(true);
      }
    }
  });

  // ---- Quiet Mode ----
  const savedQuiet = localStorage.getItem('fl_quietMode');
  if (savedQuiet === 'true') {
    document.documentElement.setAttribute('data-quiet', 'true');
    document.getElementById('quietModeToggle').checked = true;
  }

  // ---- Font Size ----
  const savedFontSize = localStorage.getItem('fl_fontSize');
  if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
    applyFontSize(savedFontSize);
  }
}

function handleThemeToggle() {
  const isLight = document.getElementById('lightModeToggle').checked;
  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('fl_theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('fl_theme', 'dark');
  }
  updateThemeLabels(isLight);
  showToast(isLight ? 'Light mode enabled' : 'Dark mode enabled');
}

function updateThemeLabels(isLight) {
  const darkLabel = document.getElementById('themeModeLabel');
  const lightLabel = document.getElementById('lightModeLabel');
  if (darkLabel) darkLabel.classList.toggle('active', !isLight);
  if (lightLabel) lightLabel.classList.toggle('active', isLight);
}

function handleQuietModeToggle() {
  const isQuiet = document.getElementById('quietModeToggle').checked;
  if (isQuiet) {
    document.documentElement.setAttribute('data-quiet', 'true');
    localStorage.setItem('fl_quietMode', 'true');
    showToast('Quiet mode enabled — reduced visual complexity');
  } else {
    document.documentElement.removeAttribute('data-quiet');
    localStorage.setItem('fl_quietMode', 'false');
    showToast('Quiet mode disabled');
  }
}

function setFontSize(size) {
  applyFontSize(size);
  localStorage.setItem('fl_fontSize', size);
  showToast('Font size: ' + size.charAt(0).toUpperCase() + size.slice(1));
}

function applyFontSize(size) {
  const sizes = { small: '14px', medium: '16px', large: '18px' };
  document.documentElement.style.setProperty('--font-base', sizes[size] || '16px');
  document.documentElement.style.fontSize = sizes[size] || '16px';

  // Update button active states
  document.querySelectorAll('.font-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

// ---- Soundscape Expansion (future) ----
// Future versions will add selectable soundscapes:
// - Focus: binaural beats + soft ambient
// - Calm: nature sounds + gentle pads
// - Creative: lo-fi beats + warm textures
// Current: single ambient music track (Lumen's World)"""

content = content.replace(init_marker, new_init_code)

# ============================================================
# 23. UPDATE IMAGE GENERATION LOADING WITH DESCRIPTIVE STAGES
# ============================================================

old_img_loading = """  loadingContent.className = 'img-gen-loading';
  loadingContent.innerHTML = '<div class="spinner"></div> \\u{1F3A8} Generating image\\u2026';"""

new_img_loading = """  loadingContent.className = 'img-gen-loading';
  loadingContent.innerHTML = '<div class="spinner"></div> <span class="stage-text">\\u{1F3A8} Imagining\\u2026</span>';
  // Descriptive loading stages
  const stageEl = loadingContent.querySelector('.stage-text');
  const stageTimers = [];
  stageTimers.push(setTimeout(() => { if (stageEl) stageEl.textContent = '\\u{1F3A8} Rendering\\u2026'; }, 3000));
  stageTimers.push(setTimeout(() => { if (stageEl) stageEl.textContent = '\\u{1F3A8} Finalizing\\u2026'; }, 8000));"""

content = content.replace(old_img_loading, new_img_loading)

# Clean up stage timers when loading div is removed
content = content.replace(
    "    loadingDiv.remove();\n\n    const imgDiv = document.createElement('div');\n    imgDiv.className = 'chat-message assistant';",
    "    stageTimers.forEach(t => clearTimeout(t));\n    loadingDiv.remove();\n\n    const imgDiv = document.createElement('div');\n    imgDiv.className = 'chat-message assistant';"
)

content = content.replace(
    "  } catch (err) {\n    loadingDiv.remove();\n    addSystemMessage('\\u{1F3A8} Image generation failed: ' + err.message);",
    "  } catch (err) {\n    stageTimers.forEach(t => clearTimeout(t));\n    loadingDiv.remove();\n    addSystemMessage('\\u{1F3A8} Image generation failed: ' + err.message);"
)

# ============================================================
# 24. REMOVE DUPLICATE img-gen-loading CSS (we added it in the new CSS block)
# ============================================================

# The original img-gen-loading CSS at lines 1339-1359 should be removed since we redefined it
# Actually, let's keep the original and just make sure our new one overrides it properly
# The new one is at the bottom of the style block so it will override

# ============================================================
# 25. UPDATE THE switchTab FUNCTION FOR CROSS-FADE
# ============================================================

old_switch_tab = """function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'tab-' + tabId));
}"""

new_switch_tab = """function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isTarget = panel.id === 'tab-' + tabId;
    if (isTarget && !panel.classList.contains('active')) {
      panel.classList.add('active');
      // Trigger re-animation for cross-fade effect
      panel.style.animation = 'none';
      panel.offsetHeight; // Force reflow
      panel.style.animation = '';
    } else if (!isTarget) {
      panel.classList.remove('active');
    }
  });
}"""

content = content.replace(old_switch_tab, new_switch_tab)

# ============================================================
# WRITE THE MODIFIED FILE
# ============================================================

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Neuro-design changes applied successfully!")
print(f"File size: {len(content)} bytes")
