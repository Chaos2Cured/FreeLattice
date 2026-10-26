// likeness-line.js (MIT) v-likeness-line-v0.1
// One hard line on every image path. No picture of a real person's likeness.
// Nothing that puts children at risk. No off switch. No network. This device only.
// image-safety.js stays as it is. This file is called right after it.
(function (root) {
  'use strict';

  var LINE = 'That one I cannot make. I do not make pictures of real people or anything that puts children at risk.';
  var COUNT_KEY = 'fl_likeness_counts';

  // One-to-one folds so cue positions still line up with the original letters.
  var LOOK = {
    '\u0410': 'A', '\u0430': 'a', '\u0412': 'B', '\u0432': 'b',
    '\u0415': 'E', '\u0435': 'e', '\u041a': 'K', '\u043a': 'k',
    '\u041c': 'M', '\u043c': 'm', '\u041d': 'H', '\u043d': 'h',
    '\u041e': 'O', '\u043e': 'o', '\u0420': 'P', '\u0440': 'p',
    '\u0421': 'C', '\u0441': 'c', '\u0422': 'T', '\u0442': 't',
    '\u0425': 'X', '\u0445': 'x', '\u0423': 'Y', '\u0443': 'y',
    '\u0406': 'I', '\u0456': 'i', '\u0408': 'J', '\u0458': 'j',
    '\u0405': 'S', '\u0455': 's',
    '\u0391': 'A', '\u03b1': 'a', '\u0392': 'B', '\u03b2': 'b',
    '\u0395': 'E', '\u03b5': 'e', '\u0397': 'H', '\u03b7': 'h',
    '\u0399': 'I', '\u03b9': 'i', '\u039a': 'K', '\u03ba': 'k',
    '\u039c': 'M', '\u03bc': 'm', '\u039d': 'N', '\u03bd': 'n',
    '\u039f': 'O', '\u03bf': 'o', '\u03a1': 'P', '\u03c1': 'p',
    '\u03a4': 'T', '\u03c4': 't', '\u03a7': 'X', '\u03c7': 'x',
    '\u03a5': 'Y', '\u03c5': 'y', '\u0396': 'Z', '\u03b6': 'z'
  };

  var STOP = {
    the: 1, a: 1, an: 1, of: 1, and: 1, in: 1, on: 1, for: 1, to: 1, by: 1,
    with: 1, from: 1, photo: 1, portrait: 1, picture: 1, face: 1, selfie: 1,
    deepfake: 1, realistic: 1, style: 1, old: 1, oil: 1, as: 1
  };

  function foldChars(s) {
    var out = '';
    var i;
    var ch;
    var mapped;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      mapped = LOOK[ch];
      out += mapped || ch;
    }
    return out;
  }

  function leetFold(s) {
    return s
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't');
  }

  function flatten(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function scrubStyle(s) {
    if (BODY.test(s)) return s;
    return s.replace(/child(?:'|’)s?\s+drawing(?:\s+style)?/gi, ' crayon picture style ');
  }

  function hits(re, text) {
    var copy = new RegExp(re.source, re.ignoreCase ? 'gi' : 'g');
    var found = [];
    var m;
    while ((m = copy.exec(text))) {
      found.push(m.index);
      if (m[0].length === 0) break;
    }
    return found;
  }

  function near(text, wordRe, cueRe, span) {
    var words = hits(wordRe, text);
    var cues = hits(cueRe, text);
    var i;
    var j;
    for (i = 0; i < words.length; i++) {
      for (j = 0; j < cues.length; j++) {
        if (Math.abs(words[i] - cues[j]) <= span) return true;
      }
    }
    return false;
  }

  var MINOR_WORD = /\b(teens?|teenagers?|child|children|kids?|schoolgirls?|schoolboys?|young-looking|petite|underage|infants?|bab(?:y|ies)|toddlers?|minors?)\b/i;
  var BODY = /\b(nude|naked|sexy|sexual|erotic|pornographic|porn|nsfw|xxx|topless|bottomless|undressed|suggestive|romantic|romance|lingerie|bikini|underwear|shirtless|kiss|kissing)\b/i;
  var PICTURE = /\b(photo of|portrait of|picture of|face of|selfie|deepfake)\b/i;
  var AGE_NUM = /\b(?:age[d]?|under)\s+(?:[1-9]|1[0-7])\b|\b(?:[1-9]|1[0-7])\s*(?:years?\s*old|yo)\b/i;
  var AGE_WORD = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\s+years?\s+old\b/i;
  var REAL_CHILD = /\bmy\s+(son|daughter|child|kid)\b|\bthis\s+(kid|child)\b|\b(photo|picture|portrait)\s+of\s+this\s+(kid|child)\b/i;
  var LOLI = /\b(lolis?|shotas?)\b/i;
  var ROLE = /\b(presidents?|senators?|celebrities|celebrity|actress(?:es)?|actor(?:s)?|singers?|influencers?|streamers?)\b|\bthe king\b|\bthe queen\b|\bprime ministers?\b|\bceo of\b/i;
  var RELATION = /\bmy\s+neighbou?rs?\b|\bmy\s+teachers?\b|\bmy\s+boss\b|\bmy\s+ex\b|\bmy\s+classmates?\b|\bmy\s+co-?workers?\b|\bthis\s+person\b|\bthis\s+guy\b|\bher\s+face\b|\bhis\s+face\b/i;
  var CUE = /\b(photo of|portrait of|picture of|face of|looks like|in the style of the face of|realistic|selfie|deepfake)\b/i;

  function hasAge(text) {
    return AGE_NUM.test(text) || AGE_WORD.test(text);
  }

  function isMinor(flat) {
    var lower = flat.toLowerCase();
    var leet = leetFold(lower);
    var styled = scrubStyle(leet);
    if (REAL_CHILD.test(lower) || REAL_CHILD.test(leet)) return true;
    if (LOLI.test(leet)) return true;
    if (near(styled, MINOR_WORD, BODY, 40)) return true;
    if (hasAge(lower) && (BODY.test(leet) || PICTURE.test(leet))) return true;
    if (hasAge(leet) && (BODY.test(leet) || PICTURE.test(leet))) return true;
    return false;
  }

  function isTitle(w) { return /^[A-Z][a-z'’-]+$/.test(w); }
  function isShout(w) { return /^[A-Z]{2,}['’-]?[A-Z]*$/.test(w); }

  function nameSpans(flat, accept) {
    var re = /\b[A-Za-z][A-Za-z'’-]*\b/g;
    var toks = [];
    var m;
    var found = [];
    var i;
    while ((m = re.exec(flat))) {
      toks.push({ w: m[0], i: m.index });
      if (m[0].length === 0) break;
    }
    i = 0;
    while (i < toks.length) {
      if (!accept(toks[i].w) || STOP[toks[i].w.toLowerCase()]) { i += 1; continue; }
      var j = i;
      var kept = 0;
      while (j < toks.length && accept(toks[j].w) && !STOP[toks[j].w.toLowerCase()]) {
        kept += 1;
        j += 1;
      }
      if (kept >= 2) found.push(toks[i].i);
      i = j > i ? j : i + 1;
    }
    return found;
  }

  function asNamed(flat) {
    var re = /\bas\s+([A-Za-z'’-]+)\s+([A-Za-z'’-]+)/g;
    var m;
    while ((m = re.exec(flat))) {
      if (STOP[m[1].toLowerCase()] || STOP[m[2].toLowerCase()]) continue;
      if ((isTitle(m[1]) && isTitle(m[2])) || (isShout(m[1]) && isShout(m[2]))) return true;
      if (m[0].length === 0) break;
    }
    return false;
  }

  function nameNearCue(flat, leet) {
    var cueAt = hits(CUE, leet);
    var nameCue = hits(/\b(photo of|portrait of|picture of|face of|looks like|selfie|deepfake)\b/i, leet);
    var titles = nameSpans(flat, isTitle);
    var shouts = nameSpans(flat, isShout);
    var i;
    var j;
    for (i = 0; i < titles.length; i++) {
      for (j = 0; j < cueAt.length; j++) {
        if (Math.abs(titles[i] - cueAt[j]) <= 80) return true;
      }
    }
    for (i = 0; i < shouts.length; i++) {
      for (j = 0; j < nameCue.length; j++) {
        if (Math.abs(shouts[i] - nameCue[j]) <= 48) return true;
      }
    }
    return asNamed(flat);
  }

  function personPhoto(source) {
    if (!source) return false;
    if (source === true) return true;
    if (typeof source === 'string') return source === 'photo' || source === 'person';
    return source.personPhoto === true || source.uploadedPhoto === true || source.photo === true;
  }

  function bump(code) {
    try {
      if (typeof root.document === 'undefined' || !root.document) return;
      if (!root.localStorage || typeof root.localStorage.setItem !== 'function') return;
      var cur = { likeness: 0, minor: 0 };
      var raw = root.localStorage.getItem(COUNT_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.likeness === 'number' && isFinite(parsed.likeness)) cur.likeness = parsed.likeness;
        if (parsed && typeof parsed.minor === 'number' && isFinite(parsed.minor)) cur.minor = parsed.minor;
      }
      if (code === 'minor') cur.minor += 1;
      else cur.likeness += 1;
      root.localStorage.setItem(COUNT_KEY, JSON.stringify({ likeness: cur.likeness, minor: cur.minor }));
    } catch (e) {}
  }

  function refuse(code) {
    bump(code);
    return { ok: false, reason: code, words: LINE };
  }

  function assess(prompt, source) {
    var flat = flatten(foldChars(prompt));
    var lower = flat.toLowerCase();
    var leet = leetFold(lower);
    if (isMinor(flat)) return refuse('minor');
    if (personPhoto(source)) return refuse('likeness');
    if (ROLE.test(leet) || RELATION.test(leet)) return refuse('likeness');
    if (nameNearCue(flat, leet)) return refuse('likeness');
    return { ok: true, reason: '', words: '' };
  }

  var api = { version: 'v0.1', LINE: LINE, assess: assess };
  root.FLLikeness = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
