// chat-doc-return.js (MIT)
// v-chat-doc-return-v0.1
// A mind may hand back a document. The person saves it on this computer.
// Trigger: [FL_FILE: name.md] then the text, then [/FL_FILE].
// Save to Drive is offered only when Drive is already signed in, and only after Yes.
(function (root) {
  'use strict';

  var MARK = 'v-chat-doc-return-v0.1';
  var OPEN = '[FL_FILE:';
  var CLOSE = '[/FL_FILE]';
  var NS = 'http://www.w3.org/2000/svg';

  function doc() {
    return root.document;
  }

  function sanitizeName(raw) {
    var name = String(raw || '').replace(/[\/\\]/g, ' ').replace(/[^A-Za-z0-9._ -]/g, '').replace(/\s+/g, ' ').trim();
    if (!name) name = 'note.txt';
    if (name.length > 80) name = name.slice(0, 80);
    if (name.charAt(0) === '.') name = 'note' + name;
    return name;
  }

  function extOf(name) {
    var i = String(name).lastIndexOf('.');
    if (i < 1 || i === name.length - 1) return 'txt';
    return name.slice(i + 1).toLowerCase();
  }

  function withExt(name, ext) {
    var base = String(name);
    var i = base.lastIndexOf('.');
    if (i > 0) base = base.slice(0, i);
    return base + '.' + ext;
  }

  function parse(raw) {
    var src = String(raw || '');
    var files = [];
    var guard = 0;
    while (guard < 8) {
      guard += 1;
      var openAt = src.indexOf(OPEN);
      if (openAt < 0) break;
      var nameEnd = src.indexOf(']', openAt + OPEN.length);
      if (nameEnd < 0) break;
      var closeAt = src.indexOf(CLOSE, nameEnd);
      if (closeAt < 0) break;
      var body = src.slice(nameEnd + 1, closeAt);
      if (body.charAt(0) === '\n') body = body.slice(1);
      if (body.length && body.charAt(body.length - 1) === '\n') body = body.slice(0, -1);
      files.push({
        name: sanitizeName(src.slice(openAt + OPEN.length, nameEnd)),
        text: body
      });
      src = src.slice(0, openAt) + src.slice(closeAt + CLOSE.length);
    }
    return { visible: src, files: files };
  }

  function sizeLabel(text) {
    var n = 0;
    try { n = new Blob([text]).size; } catch (e) { n = String(text || '').length; }
    if (n < 1024) return n + ' B';
    return (Math.round((n / 1024) * 10) / 10) + ' KB';
  }

  function pdfEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function wrapLines(text) {
    var clean = String(text || '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?').replace(/\r/g, '');
    var rows = clean.split('\n');
    var lines = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row) { lines.push(''); continue; }
      while (row.length > 80) {
        lines.push(row.slice(0, 80));
        row = row.slice(80);
      }
      lines.push(row);
    }
    if (!lines.length) lines.push('');
    return lines;
  }

  function buildPdf(text) {
    var lines = wrapLines(text);
    var groups = [];
    var i;
    for (i = 0; i < lines.length; i += 46) groups.push(lines.slice(i, i + 46));
    if (!groups.length) groups.push(['']);
    var fontId = 3 + groups.length * 2;
    var bodies = [];
    var kids = [];
    bodies[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    for (i = 0; i < groups.length; i++) {
      var pageId = 3 + i * 2;
      var contentId = pageId + 1;
      kids.push(pageId + ' 0 R');
      var stream = 'BT /F1 12 Tf 72 740 Td 14 TL\n';
      var n;
      for (n = 0; n < groups[i].length; n++) {
        if (n) stream += 'T*\n';
        stream += '(' + pdfEscape(groups[i][n]) + ') Tj\n';
      }
      stream += 'ET';
      bodies[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ' + contentId + ' 0 R /Resources << /Font << /F1 ' + fontId + ' 0 R >> >> >>';
      bodies[contentId] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
    }
    bodies[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + groups.length + ' >>';
    bodies[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    var out = '%PDF-1.4\n';
    var offsets = [];
    for (n = 1; n <= fontId; n++) {
      offsets[n] = out.length;
      out += n + ' 0 obj\n' + bodies[n] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + (fontId + 1) + '\n';
    out += '0000000000 65535 f \n';
    for (n = 1; n <= fontId; n++) {
      var off = String(offsets[n]);
      while (off.length < 10) off = '0' + off;
      out += off + ' 00000 n \n';
    }
    out += 'trailer << /Size ' + (fontId + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return out;
  }

  function download(name, mime, data) {
    var blob = (typeof Blob !== 'undefined' && data instanceof Blob) ? data : new Blob([data], { type: mime });
    var url = root.URL.createObjectURL(blob);
    var a = doc().createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    doc().body.appendChild(a);
    a.click();
    if (a.parentNode) a.parentNode.removeChild(a);
    root.setTimeout(function () {
      try { root.URL.revokeObjectURL(url); } catch (e) {}
    }, 1500);
    return blob;
  }

  function driveReady() {
    try {
      var gapi = root.gapi;
      var auth = gapi && gapi.auth2 && gapi.auth2.getAuthInstance && gapi.auth2.getAuthInstance();
      return !!(auth && auth.isSignedIn && auth.isSignedIn.get && auth.isSignedIn.get());
    } catch (e) {
      return false;
    }
  }

  function sendDrive(name, text) {
    var auth = root.gapi.auth2.getAuthInstance();
    var token = auth.currentUser.get().getAuthResponse().access_token;
    var boundary = 'flfileboundary';
    var safe = sanitizeName(name);
    var meta = '{"name":' + JSON.stringify(safe) + ',"mimeType":"text/plain"}';
    var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta +
      '\r\n--' + boundary + '\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n' + String(text || '') +
      '\r\n--' + boundary + '--';
    return root.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: body
    });
  }

  function button(label, press) {
    var btn = doc().createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', press);
    return btn;
  }

  function fileIcon() {
    var el = doc().createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', '20');
    el.setAttribute('height', '20');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    var p = doc().createElementNS(NS, 'path');
    p.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
    var p2 = doc().createElementNS(NS, 'path');
    p2.setAttribute('d', 'M14 2v6h6');
    el.appendChild(p);
    el.appendChild(p2);
    return el;
  }

  function hostFor(anchor) {
    var node = anchor;
    if (node && node.closest) {
      var bubble = node.closest('.chat-message');
      if (bubble) return bubble;
    }
    if (node && node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('chat-message')) {
      return node.parentNode;
    }
    return doc().getElementById('chatMessages');
  }

  function paint(file, anchor) {
    var d = doc();
    if (!d || !file) return null;
    var host = hostFor(anchor);
    if (!host || !host.parentNode && host.id !== 'chatMessages') return null;
    var key = file.name + ':' + String(file.text || '').length;
    var parent = host.id === 'chatMessages' ? host : host.parentNode;
    if (parent && parent.querySelector && parent.querySelector('[data-fl-file-key="' + key.replace(/"/g, '') + '"]')) {
      return parent.querySelector('[data-fl-file-key="' + key.replace(/"/g, '') + '"]');
    }
    var card = d.createElement('div');
    card.className = 'fl-doc-card';
    card.setAttribute('data-marker', MARK);
    card.setAttribute('data-fl-file-key', key);
    card.appendChild(fileIcon());
    var name = d.createElement('p');
    name.className = 'fl-doc-name';
    name.textContent = file.name;
    var meta = d.createElement('p');
    meta.className = 'fl-doc-meta';
    meta.textContent = extOf(file.name) + ' \u00B7 ' + sizeLabel(file.text);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(button('Save as PDF', function () {
      download(withExt(file.name, 'pdf'), 'application/pdf', buildPdf(file.text));
    }));
    card.appendChild(button('Save as MD', function () {
      download(withExt(file.name, 'md'), 'text/markdown', file.text);
    }));
    card.appendChild(button('Save as TXT', function () {
      download(withExt(file.name, 'txt'), 'text/plain', file.text);
    }));
    if (driveReady()) {
      var ask = d.createElement('div');
      ask.className = 'fl-doc-ask';
      ask.hidden = true;
      var q = d.createElement('p');
      q.textContent = 'Send this file to your Google Drive?';
      var note = d.createElement('p');
      note.className = 'fl-doc-note';
      note.hidden = true;
      var yes = button('Yes', function () {
        sendDrive(file.name, file.text).then(function () {
          note.hidden = false;
          note.textContent = 'Sent to your Google Drive.';
        }).catch(function () {
          note.hidden = false;
          note.textContent = 'Drive did not take the file.';
        });
      });
      yes.className = 'fl-doc-yes';
      var later = button('Not now', function () { ask.hidden = true; });
      ask.appendChild(q);
      ask.appendChild(yes);
      ask.appendChild(later);
      ask.appendChild(note);
      var driveBtn = button('Save to my Drive', function () { ask.hidden = false; });
      card.appendChild(driveBtn);
      card.appendChild(ask);
    }
    if (host.id === 'chatMessages') host.appendChild(card);
    else if (host.nextSibling) host.parentNode.insertBefore(card, host.nextSibling);
    else host.parentNode.appendChild(card);
    return card;
  }

  function consumeReply(text, anchor) {
    var seen = parse(text);
    var i;
    for (i = 0; i < seen.files.length; i++) paint(seen.files[i], anchor);
    return { visible: seen.visible, files: seen.files };
  }

  var api = {
    VERSION: 'v0.1',
    MARK: MARK,
    OPEN: OPEN,
    CLOSE: CLOSE,
    parse: parse,
    buildPdf: buildPdf,
    driveReady: driveReady,
    consumeReply: consumeReply,
    sanitizeName: sanitizeName
  };
  root.FLChatDocReturn = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
