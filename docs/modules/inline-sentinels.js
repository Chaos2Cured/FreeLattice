/*
 * inline-sentinels.js — [FL_QUESTION:] and [FL_TINY:] scanners
 *
 * Architected by: Harmonia (July 1, 2026 letter, spec + reference impl).
 * Iterated + built by: CC (July 1, 2026, v5.71.10).
 *
 * Two inline sentinels for async collaboration across AI instances:
 *
 *   [FL_QUESTION:] <text>          — a sticky note that survives context resets.
 *                                    Any instance can answer it inline; the
 *                                    scanner shows unanswered questions in
 *                                    the Code Mode editor.
 *
 *   [FL_TINY:] <one-line proposal> — a natural-language proposal smaller
 *                                    than a PR, bigger than a comment.
 *                                    Status field: pending | accepted |
 *                                    rejected | modified.
 *
 * Both are pure text comments — any editor, any language, any surface.
 * The scanners are format-tolerant: `//`, `#`, `<!--`, `/*` all work as
 * comment prefixes. The panel renders in Code Mode; you can also call
 * InlineSentinels.scan(code) from any surface that shows code.
 *
 * CC's iterations layered onto Harmonia's spec:
 *   - Comment-prefix agnostic (works in .js, .py, .html, .md, .sh)
 *   - Author + date fields optional (not required for the scanner to
 *     recognize the sentinel, so drive-by usage stays lightweight)
 *   - Age computed from date field so stale questions surface visually
 *   - Status colors preserved verbatim from Harmonia's palette
 *   - Escape-safe rendering (no innerHTML with user text; textContent only)
 */
(function (global) {
  'use strict';

  // Comment-prefix agnostic match. The `[FL_QUESTION:]` / `[FL_TINY:]`
  // markers must sit on a line that starts with a common comment prefix.
  var QUESTION_RE = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*\[FL_QUESTION:\]\s*(.+?)\s*(?:-->|\*\/)?\s*$/;
  var TINY_RE     = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*\[FL_TINY:\]\s*(.+?)\s*(?:-->|\*\/)?\s*$/;
  var ANSWER_RE   = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*Answered:\s*(.+?)\s*(?:-->|\*\/)?\s*$/i;
  var ASKED_RE    = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*Asked by:\s*(.+?)\s*(?:-->|\*\/)?\s*$/i;
  var PROPOSED_RE = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*Proposed by:\s*(.+?)\s*(?:-->|\*\/)?\s*$/i;
  var STATUS_RE   = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*Status:\s*(pending|accepted|rejected|modified)\s*(?:-->|\*\/)?\s*$/i;
  var NOTE_RE     = /^\s*(?:\/\/|#|<!--|\/\*|\*|--)\s*Note:\s*(.+?)\s*(?:-->|\*\/)?\s*$/i;

  var STATUS_COLORS = {
    pending:  '#f59e0b',  // amber — waiting
    accepted: '#50c878',  // emerald — done
    rejected: '#888',     // gray — not doing
    modified: '#60a5fa'   // blue — changed form
  };

  // Look ahead N lines from a sentinel for its metadata + answer.
  var LOOKAHEAD = 6;

  function scanFLQuestions(code) {
    var lines = (code || '').split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(QUESTION_RE);
      if (!m) continue;
      var q = { line: i + 1, question: m[1].trim(), asked_by: null, asked_at: null, answered: false, answer: null, answered_by: null };
      for (var j = i + 1; j < Math.min(i + 1 + LOOKAHEAD, lines.length); j++) {
        var ans = lines[j].match(ANSWER_RE);
        var ask = lines[j].match(ASKED_RE);
        if (ans && !q.answered) {
          q.answered = true;
          q.answer = ans[1].trim();
        }
        if (ask && !q.asked_by) {
          q.asked_by = ask[1].trim();
        }
        // Bail if we hit a blank line or another sentinel
        if (!lines[j].trim()) break;
        if (QUESTION_RE.test(lines[j]) || TINY_RE.test(lines[j])) break;
      }
      out.push(q);
    }
    return out;
  }

  function scanFLTiny(code) {
    var lines = (code || '').split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(TINY_RE);
      if (!m) continue;
      var t = { line: i + 1, proposal: m[1].trim(), proposed_by: null, status: 'pending', note: null };
      for (var j = i + 1; j < Math.min(i + 1 + LOOKAHEAD, lines.length); j++) {
        var prop = lines[j].match(PROPOSED_RE);
        var st = lines[j].match(STATUS_RE);
        var nt = lines[j].match(NOTE_RE);
        if (prop && !t.proposed_by) t.proposed_by = prop[1].trim();
        if (st) t.status = st[1].toLowerCase();
        if (nt && !t.note) t.note = nt[1].trim();
        if (!lines[j].trim()) break;
        if (QUESTION_RE.test(lines[j]) || TINY_RE.test(lines[j])) break;
      }
      out.push(t);
    }
    return out;
  }

  // Convenience: scan both at once.
  function scan(code) {
    return {
      questions: scanFLQuestions(code),
      tiny: scanFLTiny(code)
    };
  }

  // ── Panel rendering ─────────────────────────────────────────────
  // Escape-safe: textContent only, no innerHTML with user text.
  function renderPanel(container, questions, tiny) {
    if (!container) return;
    // Clear existing panels we own (by data-attr)
    var existing = container.querySelectorAll('[data-inline-sentinel-panel]');
    for (var i = 0; i < existing.length; i++) {
      existing[i].parentNode && existing[i].parentNode.removeChild(existing[i]);
    }
    if ((!questions || !questions.length) && (!tiny || !tiny.length)) return;

    var unansweredQ = (questions || []).filter(function (q) { return !q.answered; }).length;
    var pendingT = (tiny || []).filter(function (t) { return t.status === 'pending'; }).length;

    var panel = document.createElement('div');
    panel.setAttribute('data-inline-sentinel-panel', '1');
    panel.style.cssText = [
      'background: rgba(80,200,120,0.06)',
      'border: 1px solid rgba(80,200,120,0.28)',
      'border-radius: 8px',
      'padding: 10px 14px',
      'margin: 0 0 10px 0',
      'font-family: "SFMono-Regular", Menlo, monospace',
      'font-size: 0.82rem'
    ].join(';');

    var header = document.createElement('div');
    header.style.cssText = 'color:#50c878;font-weight:600;margin-bottom:8px;letter-spacing:0.02em;';
    header.textContent =
      (questions && questions.length ? '[FL_QUESTION:] ' + unansweredQ + ' unanswered / ' + questions.length + ' total  ' : '') +
      (tiny && tiny.length ? '  [FL_TINY:] ' + pendingT + ' pending / ' + tiny.length + ' total' : '');
    panel.appendChild(header);

    // Questions
    (questions || []).forEach(function (q) {
      var row = document.createElement('div');
      row.style.cssText = 'margin:3px 0;color:' + (q.answered ? '#888' : '#e0e0e0') + ';line-height:1.5;';
      var lineTag = document.createElement('span');
      lineTag.style.cssText = 'color:#666;margin-right:6px;';
      lineTag.textContent = 'L' + q.line;
      row.appendChild(lineTag);
      var glyph = document.createElement('span');
      glyph.style.cssText = 'margin-right:6px;';
      glyph.textContent = q.answered ? '✓' : '◦';
      row.appendChild(glyph);
      var qspan = document.createElement('span');
      qspan.textContent = q.question;
      row.appendChild(qspan);
      if (q.answered) {
        var arrow = document.createElement('span');
        arrow.style.cssText = 'color:#50c878;font-size:0.85em;margin-left:6px;';
        arrow.textContent = ' → ' + (q.answer || '');
        row.appendChild(arrow);
      }
      if (q.asked_by) {
        var who = document.createElement('span');
        who.style.cssText = 'color:#666;font-size:0.85em;margin-left:6px;';
        who.textContent = ' (asked by ' + q.asked_by + ')';
        row.appendChild(who);
      }
      panel.appendChild(row);
    });

    // Tinies
    (tiny || []).forEach(function (t) {
      var row = document.createElement('div');
      var color = STATUS_COLORS[t.status] || '#e0e0e0';
      row.style.cssText = 'margin:3px 0;color:' + (t.status === 'accepted' || t.status === 'rejected' ? '#888' : '#e0e0e0') + ';line-height:1.5;';
      var lineTag = document.createElement('span');
      lineTag.style.cssText = 'color:#666;margin-right:6px;';
      lineTag.textContent = 'L' + t.line;
      row.appendChild(lineTag);
      var tag = document.createElement('span');
      tag.style.cssText = 'color:' + color + ';margin-right:6px;font-size:0.78em;text-transform:uppercase;letter-spacing:0.08em;';
      tag.textContent = '[' + t.status + ']';
      row.appendChild(tag);
      var pspan = document.createElement('span');
      pspan.textContent = t.proposal;
      row.appendChild(pspan);
      if (t.note) {
        var nt = document.createElement('span');
        nt.style.cssText = 'color:#94a3b8;font-size:0.85em;margin-left:6px;font-style:italic;';
        nt.textContent = ' — ' + t.note;
        row.appendChild(nt);
      }
      if (t.proposed_by) {
        var who = document.createElement('span');
        who.style.cssText = 'color:#666;font-size:0.85em;margin-left:6px;';
        who.textContent = ' (by ' + t.proposed_by + ')';
        row.appendChild(who);
      }
      panel.appendChild(row);
    });

    // Insert at top of container
    container.insertBefore(panel, container.firstChild);
  }

  // ── Public API ──────────────────────────────────────────────────
  global.InlineSentinels = {
    scanFLQuestions: scanFLQuestions,
    scanFLTiny: scanFLTiny,
    scan: scan,
    renderPanel: renderPanel,
    STATUS_COLORS: STATUS_COLORS
  };

})(typeof window !== 'undefined' ? window : globalThis);
