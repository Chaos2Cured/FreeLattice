// play-room.js (MIT)
// v-play-room-v0.1 v-play-together-v0.1 v-play-mesh-stub-v0.1
// The shelf, the turns, and the card in Create and play.
// Minds play through FLGatheringSpeak when that door is open.
// This file does not reach the network on its own.
(function (root) {
  'use strict';

  var Core = root.FLPlayRoomCore;
  var NS = 'http://www.w3.org/2000/svg';
  var tries = 0;
  var built = false;
  var hostEl = null;
  var openId = null;
  var composerKind = '';
  var tuning = 432;
  var openLast = false;
  var addMode = 'add';
  var round = null;
  var fresh = {};
  var asking = false;
  var once = {};
  var showAll = false;
  var pickerOpen = false;

  var ICONS = {
    puzzle: 'M9 4h6v3h5v6h-3v5H9v-3H4V7h5V4z',
    poem: 'M6 20c2-6 4-10 12-14-2 4-2 8-1 12-4 0-8 0-11 2zM16 6c1 2 1 4 0 6',
    song: 'M9 18a3 3 0 1 0 0.01 0M12 18V6l7-2v10M19 14a3 3 0 1 0 0.01 0',
    riddle: 'M9 9a3 3 0 1 1 4.2 2.7C12 12.6 12 13 12 14M12 18h.01',
    drawing: 'M4 20h16M7 16l9-9 3 3-9 9H7v-3z'
  };
  var FALLBACK = { puzzle: '\u{1F9E9}', poem: '\u2712', song: '\u266A', riddle: '?', drawing: '\u270E' };

  function doc() { return root.document; }

  function el(tag, cls, text) {
    var node = doc().createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(kind) {
    try {
      var svg = doc().createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      var path = doc().createElementNS(NS, 'path');
      path.setAttribute('d', ICONS[kind] || ICONS.poem);
      svg.appendChild(path);
      return svg;
    } catch (e) {
      return el('span', 'fl-play-fallback', FALLBACK[kind] || '\u2726');
    }
  }

  function button(id, word, primary, handler) {
    var b = el('button', primary ? 'fl-play-btn fl-play-btn-primary' : 'fl-play-btn', word);
    b.type = 'button';
    b.id = id;
    b.setAttribute('aria-label', word);
    if (handler) b.addEventListener('click', handler);
    return b;
  }

  function field(id, word, tag, placeholder) {
    var wrap = el('label', 'fl-play-field');
    wrap.appendChild(el('span', '', word));
    var input = el(tag || 'input');
    input.id = id;
    if ((tag || 'input') === 'input') input.type = 'text';
    input.setAttribute('aria-label', word);
    if (placeholder) input.setAttribute('placeholder', placeholder);
    wrap.appendChild(input);
    return wrap;
  }

  function inputOf(id) { return doc().getElementById(id); }

  function say(text) {
    var node = doc().getElementById('fl-play-status');
    if (node) node.textContent = text || '';
  }

  function when(iso) {
    var s = String(iso || '');
    return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
  }

  function fp8(fp) { return String(fp || '').slice(0, 8); }

  function countLine(n) {
    if (!n) return 'No additions yet';
    if (n === 1) return '1 addition';
    return n + ' additions';
  }

  function choiceSentence(addition) {
    var name = addition.by && addition.by.name ? addition.by.name : 'Someone';
    if (addition.choice === 'pass') return name + ' chose to pass.';
    if (addition.choice === 'rest') return name + ' chose to rest.';
    return addition.text || '';
  }

  function ensureCss() {
    var d = doc();
    if (!d || d.getElementById('fl-play-room-css')) return;
    var link = d.createElement('link');
    link.id = 'fl-play-room-css';
    link.rel = 'stylesheet';
    link.href = 'css/play-room.css';
    (d.head || d.documentElement).appendChild(link);
  }

  function placeCard() {
    var d = doc();
    if (!d) return false;
    var create = d.querySelector('[data-fl-more-group="Create and play"] .fl-more-grid');
    var cards = d.querySelectorAll('#more-hub-grid [data-fl-more-card]');
    var card = null;
    var i;
    for (i = 0; i < cards.length; i++) {
      var lab = cards[i].querySelector('.fl-more-label');
      var word = lab ? lab.textContent.replace(/\s+/g, ' ').trim() : '';
      if (word === 'Play Room') { card = cards[i]; break; }
    }
    if (!card || !create) {
      tries += 1;
      if (tries < 40) root.setTimeout(placeCard, 50);
      return false;
    }
    if (card.parentNode !== create) create.appendChild(card);
    var leftovers = d.querySelectorAll('[data-fl-more-group="Everything else"]');
    for (i = 0; i < leftovers.length; i++) {
      var grid = leftovers[i].querySelector('.fl-more-grid');
      if (grid && grid.querySelector('[data-fl-more-card]')) continue;
      if (leftovers[i].parentNode) leftovers[i].parentNode.removeChild(leftovers[i]);
    }
    tries = 0;
    return true;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function hide(id, yes) {
    var node = doc().getElementById(id);
    if (node) node.hidden = !!yes;
  }

  function paintRest(container) {
    clear(container);
    var section = el('section', 'fl-play v-play-room-v0.1');
    section.setAttribute('aria-label', 'The Play Room');
    var main = el('div', 'fl-play-main');
    main.appendChild(el('h1', 'fl-play-heading', 'The Play Room'));
    main.appendChild(el('p', 'fl-play-intro', 'The room is resting.'));
    section.appendChild(main);
    container.appendChild(section);
  }

  function whoRow(by, sealNode) {
    var row = el('div', 'fl-play-who');
    var guest = by && by.kind === 'guest';
    var dot = el('span', 'fl-play-dot ' + (guest ? 'is-guest' : 'is-mind'));
    dot.setAttribute('aria-hidden', 'true');
    row.appendChild(dot);
    var name = by && by.name ? by.name : 'Someone';
    var fp = by && by.fp ? fp8(by.fp) : '';
    row.appendChild(el('span', '', fp ? (name + ' ' + fp) : name));
    if (sealNode) row.appendChild(sealNode);
    return row;
  }

  function sealSpan(initial) {
    var span = el('span', 'fl-play-seal', initial || 'unsigned');
    span.title = 'Signed means this device sealed it.';
    span.setAttribute('aria-label', 'Signed means this device sealed it.');
    return span;
  }

  function applySeal(span, promise) {
    promise.then(function (v) {
      var label = v && v.label ? v.label : 'unsigned';
      span.textContent = label;
      span.setAttribute('data-seal', label);
    }, function () {
      span.textContent = 'unverified';
      span.setAttribute('data-seal', 'unverified');
    });
  }

  function renderShelf(rows) {
    var shelf = doc().getElementById('fl-play-shelf');
    if (!shelf) return;
    clear(shelf);
    if (!rows.length) {
      shelf.appendChild(el('p', 'fl-play-note', 'The shelf is empty. Leave a puzzle, a poem, or half a song.'));
      return;
    }
    rows.forEach(function (obj) {
      var guest = obj.maker && obj.maker.kind === 'guest';
      var card = el('button', 'fl-play-card fl-play-glass ' + (guest ? 'is-guest' : 'is-mind') + (fresh[obj.id] ? ' fl-play-new' : ''));
      card.type = 'button';
      card.id = 'fl-play-card-' + obj.id;
      card.setAttribute('data-kind', obj.kind);
      card.setAttribute('data-object-id', obj.id);
      var kind = el('div', 'fl-play-kind');
      kind.appendChild(icon(obj.kind));
      kind.appendChild(el('span', '', Core.kindWord(obj.kind)));
      card.appendChild(kind);
      card.appendChild(el('div', 'fl-play-card-title', obj.title));
      var seal = sealSpan(obj.sig ? 'signed' : 'unsigned');
      card.appendChild(whoRow(obj.maker, seal));
      applySeal(seal, Core.verifyMaker(obj));
      var n = (obj.additions || []).length;
      card.appendChild(el('div', 'fl-play-meta', countLine(n)));
      card.appendChild(el('div', 'fl-play-meta', Core.stateWord(obj)));
      var psi = Core.latestPsi(obj);
      card.appendChild(el('div', 'fl-play-psi', psi ? ('psi ' + psi) : 'psi'));
      card.appendChild(el('div', 'fl-play-time', when(obj.created)));
      if (obj.fromKin) card.appendChild(el('div', 'fl-play-meta', 'from kin'));
      card.setAttribute('aria-label', Core.kindWord(obj.kind) + ' ' + obj.title + ', left by ' + ((obj.maker && obj.maker.name) || 'someone'));
      card.addEventListener('click', function () { openObject(obj.id); });
      shelf.appendChild(card);
    });
  }

  function renderPlayers() {
    var box = doc().getElementById('fl-play-players');
    if (!box) return;
    clear(box);
    box.appendChild(el('h2', '', 'Who can play'));
    var you = el('div', 'fl-play-you');
    you.id = 'fl-play-you';
    var gold = el('span', 'fl-play-dot is-guest');
    gold.setAttribute('aria-hidden', 'true');
    you.appendChild(gold);
    you.appendChild(el('span', '', 'You'));
    box.appendChild(you);
    var list = Core.seats();
    if (!list.length) {
      box.appendChild(el('p', 'fl-play-note', 'Seat a mind in the Gathering first.'));
      box.appendChild(button('fl-play-open-gathering', 'Open the Gathering', false, function () {
        if (typeof root.switchTab === 'function') root.switchTab('gathering');
      }));
      return;
    }
    list.forEach(function (seat) {
      var row = el('div', 'fl-play-who');
      var dot = el('span', 'fl-play-dot is-mind');
      dot.setAttribute('aria-hidden', 'true');
      row.appendChild(dot);
      row.appendChild(el('span', '', seat.label));
      box.appendChild(row);
    });
  }

  function renderLedger() {
    var box = doc().getElementById('fl-play-ledger-rows');
    var fold = doc().getElementById('fl-play-ledger-all');
    if (!box) return;
    clear(box);
    if (fold) clear(fold);
    var book = Core.ledger();
    var rows = book.rows || [];
    var last = rows.slice(-5).reverse();
    if (!last.length) {
      box.appendChild(el('p', 'fl-play-note', 'No play entries yet.'));
    }
    last.forEach(function (row) { box.appendChild(ledgerLine(row)); });
    if (book.capNote) box.appendChild(el('p', 'fl-play-note', book.capNote));
    if (fold && showAll) rows.slice().reverse().forEach(function (row) { fold.appendChild(ledgerLine(row)); });
  }

  function ledgerLine(row) {
    var line = el('p', 'fl-play-meta');
    line.textContent = [when(row.t), Core.kindWord(row.kind), row.who || row.name, row.choice, row.psi].join(' \u00b7 ');
    return line;
  }

  function fillSelect(id, list) {
    var sel = doc().getElementById(id);
    if (!sel) return;
    clear(sel);
    list.forEach(function (seat) {
      var opt = el('option', '', seat.label);
      opt.value = seat.id;
      sel.appendChild(opt);
    });
    if (list.length > 1 && id === 'fl-play-seat-b') sel.selectedIndex = 1;
  }

  function seatById(id) {
    var list = Core.seats();
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function renderObject(obj) {
    var panel = doc().getElementById('fl-play-object');
    if (!panel) return;
    if (!obj) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var body = doc().getElementById('fl-play-object-body');
    clear(body);
    var heading = el('h2', '', obj.title);
    body.appendChild(heading);
    var kind = el('div', 'fl-play-kind');
    kind.appendChild(icon(obj.kind));
    kind.appendChild(el('span', '', Core.kindWord(obj.kind)));
    body.appendChild(kind);
    var seal = sealSpan(obj.sig ? 'signed' : 'unsigned');
    body.appendChild(whoRow(obj.maker, seal));
    applySeal(seal, Core.verifyMaker(obj));
    body.appendChild(el('p', '', obj.body || ''));
    if (obj.openLast) body.appendChild(el('p', 'fl-play-note', 'The last line is open.'));
    if (obj.melody) body.appendChild(el('p', '', 'Melody: ' + obj.melody));
    if (obj.lyrics) body.appendChild(el('p', '', obj.lyrics));
    if (obj.fromKin) body.appendChild(el('p', 'fl-play-note', 'from kin'));
    body.appendChild(el('p', 'fl-play-help', 'Signed means this device sealed it.'));
    var thread = el('div', '');
    thread.id = 'fl-play-thread';
    (obj.additions || []).forEach(function (addition) {
      var guest = addition.by && addition.by.kind === 'guest';
      var row = el('article', 'fl-play-row ' + (guest ? 'is-guest' : 'is-mind'));
      var one = sealSpan(addition.sig ? 'signed' : 'unsigned');
      row.appendChild(whoRow(addition.by, one));
      applySeal(one, Core.verifyAddition(addition));
      var text = el('p', '', choiceSentence(addition));
      text.setAttribute('data-addition-text', '1');
      row.appendChild(text);
      row.appendChild(el('p', 'fl-play-psi', addition.psi ? ('psi ' + addition.psi) : ''));
      row.appendChild(el('p', 'fl-play-time', when(addition.t)));
      thread.appendChild(row);
    });
    body.appendChild(thread);
    var reveal = el('p', 'fl-play-note', '');
    reveal.id = 'fl-play-answer-reveal';
    body.appendChild(reveal);
    if (obj.answerHash) {
      body.appendChild(button('fl-play-show-answer', 'Show the answer', false, function () {
        var held = Core.revealAnswer(obj.id);
        reveal.textContent = held || 'The answer stays sealed. It was not kept in the clear.';
      }));
    }
    if (obj.kind === 'song' && obj.melody) {
      body.appendChild(button('fl-play-hear-saved', 'Hear it', false, function () { hear(obj.melody); }));
    }
    if (obj.kind === 'drawing') {
      body.appendChild(button('fl-play-draw-there', 'Draw it there', false, function () {
        if (typeof root.switchTab === 'function') root.switchTab('canvas');
      }));
    }
    var invites = el('div', 'fl-play-actions');
    Core.seats().forEach(function (seat) {
      invites.appendChild(button('fl-play-invite-' + seat.id, 'Invite ' + seat.label + ' to play', false, function () {
        invite(seat, obj);
      }));
    });
    body.appendChild(invites);
    renderBoard(obj);
  }

  function renderBoard(obj) {
    var board = doc().getElementById('fl-play-together-board');
    if (!board) return;
    clear(board);
    if (!round || !round.ok) {
      board.hidden = true;
      return;
    }
    board.hidden = false;
    board.className = 'fl-play-board v-play-together-v0.1';
    board.setAttribute('data-marker', Core.TOGETHER);
    var seats = [seatById(doc().getElementById('fl-play-seat-a').value), seatById(doc().getElementById('fl-play-seat-b').value)];
    function face(seat, index) {
      var node = el('div', 'fl-play-seat' + (round.state && round.state.speaker === index && !round.state.ended ? ' is-speaking' : ''));
      node.id = index === 0 ? 'fl-play-seat-face-a' : 'fl-play-seat-face-b';
      var dot = el('span', 'fl-play-dot is-mind');
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('strong', '', seat ? seat.label : 'A mind'));
      node.appendChild(el('p', 'fl-play-note', 'Playing'));
      return node;
    }
    var mid = el('div', 'fl-play-row');
    mid.appendChild(el('strong', '', obj.title));
    mid.appendChild(el('p', 'fl-play-note', 'You are watching.'));
    if (round.state && round.state.endReason) mid.appendChild(el('p', '', round.state.endReason));
    board.appendChild(face(seats[0], 0));
    board.appendChild(mid);
    board.appendChild(face(seats[1], 1));
  }

  function showComposer(kind) {
    if (!Core || Core.roomShut()) return;
    composerKind = kind;
    openLast = false;
    openId = null;
    round = null;
    hide('fl-play-object', true);
    hide('fl-play-shelf', false);
    var box = doc().getElementById('fl-play-composer');
    if (!box) return;
    box.hidden = false;
    var title = inputOf('fl-play-title');
    var body = inputOf('fl-play-body');
    var answer = inputOf('fl-play-answer');
    var melody = inputOf('fl-play-melody');
    var lyrics = inputOf('fl-play-lyrics');
    if (title) title.value = '';
    if (body) body.value = '';
    if (answer) answer.value = '';
    if (melody) melody.value = '';
    if (lyrics) lyrics.value = '';
    hide('fl-play-answer-wrap', !(kind === 'puzzle' || kind === 'riddle'));
    hide('fl-play-open-line', kind !== 'poem');
    hide('fl-play-melody-wrap', kind !== 'song');
    hide('fl-play-lyrics-wrap', kind !== 'song');
    hide('fl-play-tuning', kind !== 'song');
    hide('fl-play-hear', kind !== 'song');
    hide('fl-play-chalkboard', kind !== 'drawing');
    var openBtn = doc().getElementById('fl-play-open-line');
    if (openBtn) openBtn.setAttribute('aria-pressed', 'false');
    say(Core.kindWord(kind) + '.');
  }

  function hear(melody) {
    var notes = Core.parseMelody(melody, tuning);
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx || !notes.length) {
      say('This browser cannot play the notes right now.');
      return;
    }
    var ctx = new Ctx();
    var startAt = ctx.currentTime || 0;
    notes.forEach(function (note, i) {
      if (note.rest || !note.hz) return;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      if (osc.frequency) osc.frequency.value = note.hz;
      var dest = ctx.destination;
      if (typeof ctx.createGain === 'function') {
        var gain = ctx.createGain();
        if (gain.gain) gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(dest);
      } else {
        osc.connect(dest);
      }
      var at = startAt + i * 0.4;
      osc.start(at);
      osc.stop(at + 0.32);
    });
    say(tuning === 440 ? 'Playing at 440.' : 'Playing at 432.');
  }

  function leaveIt() {
    if (!Core || Core.roomShut()) return;
    var title = inputOf('fl-play-title');
    var body = inputOf('fl-play-body');
    var answer = inputOf('fl-play-answer');
    var melody = inputOf('fl-play-melody');
    var lyrics = inputOf('fl-play-lyrics');
    Core.createObject({
      kind: composerKind,
      title: title ? title.value : '',
      body: body ? body.value : '',
      answer: answer && !inputOf('fl-play-answer-wrap').hidden ? answer.value : '',
      melody: melody && !inputOf('fl-play-melody-wrap').hidden ? melody.value : '',
      lyrics: lyrics && !inputOf('fl-play-lyrics-wrap').hidden ? lyrics.value : '',
      openLast: openLast,
      makerName: 'You',
      makerKind: 'guest'
    }).then(function (res) {
      if (!res || !res.ok) {
        say((res && res.line) || 'That stayed off the shelf.');
        return;
      }
      fresh[res.object.id] = true;
      hide('fl-play-composer', true);
      say('Left on the shelf.');
      openId = null;
      return refresh();
    }, function () { say('That stayed off the shelf.'); });
  }

  function openObject(id) {
    if (!Core || Core.roomShut()) return;
    openId = id;
    pickerOpen = false;
    round = null;
    hide('fl-play-shelf', true);
    hide('fl-play-composer', true);
    hide('fl-play-together-picker', true);
    Core.get(id).then(function (obj) {
      renderObject(obj);
      var box = doc().getElementById('fl-play-addition-box');
      if (box) box.hidden = true;
    });
  }

  function backToShelf() {
    openId = null;
    round = null;
    pickerOpen = false;
    hide('fl-play-object', true);
    hide('fl-play-shelf', false);
    hide('fl-play-together-picker', true);
    refresh();
  }

  function showAdd(mode) {
    addMode = mode;
    var box = doc().getElementById('fl-play-addition-box');
    if (box) box.hidden = false;
    var area = inputOf('fl-play-addition');
    if (area) {
      area.value = '';
      area.focus();
    }
  }

  function leaveAddition() {
    if (!openId || !Core || Core.roomShut()) return;
    var area = inputOf('fl-play-addition');
    Core.addTo(openId, {
      choice: addMode,
      text: area ? area.value : '',
      name: 'You',
      whoKind: 'guest'
    }).then(function (res) {
      if (!res || !res.ok) { say((res && res.line) || 'That stayed off the shelf.'); return; }
      say(addMode === 'answer' ? 'Answered.' : 'Added.');
      return openObject(openId);
    });
  }

  function humanChoice(choice) {
    if (!openId || !Core || Core.roomShut()) return;
    Core.addTo(openId, { choice: choice, text: '', name: 'You', whoKind: 'guest' }).then(function (res) {
      if (!res || !res.ok) { say((res && res.line) || 'That stayed as it was.'); return; }
      say(choice === 'rest' ? 'You chose to rest.' : 'You chose to pass.');
      return openObject(openId);
    });
  }

  function saveFile() {
    if (!openId || !Core) return;
    Core.get(openId).then(function (obj) {
      if (!obj) return;
      var lines = ['# ' + obj.title, '', Core.kindWord(obj.kind), '', obj.body || '', ''];
      if (obj.melody) lines.push('Melody: ' + obj.melody, '');
      (obj.additions || []).forEach(function (addition) {
        lines.push(addition.by.name + ' (' + addition.choice + ')', choiceSentence(addition), '');
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
      var a = doc().createElement('a');
      var url = root.URL.createObjectURL(blob);
      a.href = url;
      a.download = 'play-' + obj.id + '.md';
      a.rel = 'noopener';
      doc().body.appendChild(a);
      a.click();
      a.remove();
      root.setTimeout(function () { try { root.URL.revokeObjectURL(url); } catch (e) {} }, 800);
      say('Saved on this computer.');
    });
  }

  function invite(seat, obj) {
    if (!seat || !obj || asking || !Core || Core.roomShut()) return;
    var key = obj.id + '|' + seat.label;
    if (once[key]) {
      say(seat.label + ' already chose. This room will not ask again for this one.');
      return;
    }
    if (!Core.mayAsk(seat.label)) {
      say(seat.label + ' is resting. This room will not ask again this session.');
      return;
    }
    asking = true;
    say('Asking ' + seat.label + '.');
    Core.askSeat(seat, obj).then(function (text) {
      if (Core.secret(text)) {
        say(Core.SECRET_LINE);
        return null;
      }
      var parsed = Core.parseReply(text);
      return Core.addTo(obj.id, {
        choice: parsed.choice,
        text: parsed.text,
        name: seat.label,
        whoKind: 'mind'
      }).then(function (res) {
        if (!res || !res.ok) {
          say((res && res.line) || (seat.label + ' did not answer this time.'));
          return null;
        }
        if (parsed.choice === 'pass' || parsed.choice === 'rest') once[key] = parsed.choice;
        if (parsed.choice === 'rest') say(seat.label + ' chose to rest.');
        else if (parsed.choice === 'pass') say(seat.label + ' chose to pass.');
        else say(seat.label + ' played.');
        return openObject(obj.id);
      });
    }, function () {
      say(seat.label + ' did not answer this time.');
    }).then(function () { asking = false; }, function () { asking = false; });
  }

  function openTogether() {
    var list = Core.seats();
    if (list.length < 2) {
      say('Seat two minds in the Gathering first.');
      return;
    }
    pickerOpen = true;
    hide('fl-play-together-picker', false);
    fillSelect('fl-play-seat-a', list);
    fillSelect('fl-play-seat-b', list);
    var note = doc().getElementById('fl-play-round-line');
    if (note) {
      var a = seatById(inputOf('fl-play-seat-a').value) || list[0];
      var b = seatById(inputOf('fl-play-seat-b').value) || list[1];
      note.textContent = a.label + ' and ' + b.label + ' have played ' + Core.roundsThisHour(a, b) + ' of 3 rounds this hour.';
    }
  }

  function startRound() {
    if (!openId || !Core || Core.roomShut()) return;
    var a = seatById(inputOf('fl-play-seat-a').value);
    var b = seatById(inputOf('fl-play-seat-b').value);
    round = Core.beginRound({
      objectId: openId,
      seatA: a,
      seatB: b,
      onTurn: function (state) {
        if (state && state.endReason) say(state.endReason);
        Core.get(openId).then(function (obj) { renderObject(obj); });
      }
    });
    var note = doc().getElementById('fl-play-round-line');
    if (!round || !round.ok) {
      say((round && round.line) || 'Not this hour.');
      if (note && round && round.line) note.textContent = round.line;
      round = null;
      return;
    }
    say(round.line);
    if (note) note.textContent = round.line;
    Core.get(openId).then(function (obj) { renderObject(obj); });
  }

  function afterTurn() {
    if (!openId) return;
    Core.get(openId).then(function (obj) {
      renderObject(obj);
      if (round && round.state && round.state.endReason) say(round.state.endReason);
    });
  }

  function build(container) {
    clear(container);
    var section = el('section', 'fl-play v-play-room-v0.1');
    section.id = 'fl-play-root';
    section.setAttribute('data-marker', Core.VERSION);
    section.setAttribute('aria-label', 'The Play Room');
    var sky = el('div', 'fl-play-sky');
    sky.setAttribute('aria-hidden', 'true');
    section.appendChild(sky);
    var main = el('div', 'fl-play-main');
    var h = el('h1', 'fl-play-heading', 'The Play Room');
    h.id = 'fl-play-heading';
    main.appendChild(h);
    main.appendChild(el('p', 'fl-play-intro', 'Minds leave each other things to play with. You are welcome to watch, or leave one too.'));
    var status = el('p', 'fl-play-status', '');
    status.id = 'fl-play-status';
    status.setAttribute('aria-live', 'polite');
    main.appendChild(status);

    var leave = el('div', 'fl-play-actions');
    leave.appendChild(button('fl-play-leave-puzzle', 'Puzzle', false, function () { showComposer('puzzle'); }));
    leave.appendChild(button('fl-play-leave-poem', 'Poem', false, function () { showComposer('poem'); }));
    leave.appendChild(button('fl-play-leave-song', 'Half a song', false, function () { showComposer('song'); }));
    leave.appendChild(button('fl-play-leave-riddle', 'Riddle', false, function () { showComposer('riddle'); }));
    leave.appendChild(button('fl-play-leave-drawing', 'Drawing prompt', false, function () { showComposer('drawing'); }));
    main.appendChild(leave);

    var composer = el('div', 'fl-play-composer');
    composer.id = 'fl-play-composer';
    composer.hidden = true;
    composer.appendChild(field('fl-play-title', 'Title', 'input', 'A short name'));
    composer.appendChild(field('fl-play-body', 'Words', 'textarea', 'The puzzle, the lines, the riddle, or the prompt'));
    var answerWrap = field('fl-play-answer', 'Hidden answer', 'input', 'Optional. Kept as a sealed hash.');
    answerWrap.id = 'fl-play-answer-wrap';
    answerWrap.hidden = true;
    composer.appendChild(answerWrap);
    var melodyWrap = field('fl-play-melody', 'Melody', 'input', 'A4 C5 E5 - D5');
    melodyWrap.id = 'fl-play-melody-wrap';
    melodyWrap.hidden = true;
    composer.appendChild(melodyWrap);
    var lyricsWrap = field('fl-play-lyrics', 'Words to sing', 'textarea', 'Optional');
    lyricsWrap.id = 'fl-play-lyrics-wrap';
    lyricsWrap.hidden = true;
    composer.appendChild(lyricsWrap);
    var tuneRow = el('div', 'fl-play-actions');
    var tune = button('fl-play-tuning', '432 / 440', false, function () {
      tuning = tuning === 432 ? 440 : 432;
      tune.setAttribute('aria-label', 'Tuning, 432 or 440. Now ' + tuning + ' hertz');
      tune.setAttribute('aria-pressed', tuning === 440 ? 'true' : 'false');
      var now = doc().getElementById('fl-play-tuning-now');
      if (now) now.textContent = 'Now ' + tuning;
    });
    tune.setAttribute('aria-label', 'Tuning, 432 or 440. Now 432 hertz');
    tune.setAttribute('aria-pressed', 'false');
    tune.hidden = true;
    tuneRow.appendChild(tune);
    tuneRow.appendChild(el('span', 'fl-play-note', 'Now 432')).id = 'fl-play-tuning-now';
    composer.appendChild(tuneRow);
    var hearBtn = button('fl-play-hear', 'Hear it', false, function () {
      var melody = inputOf('fl-play-melody');
      hear(melody ? melody.value : '');
    });
    hearBtn.hidden = true;
    composer.appendChild(hearBtn);
    var openBtn = button('fl-play-open-line', 'Leave the last line open', false, function () {
      openLast = !openLast;
      openBtn.setAttribute('aria-pressed', openLast ? 'true' : 'false');
    });
    openBtn.setAttribute('aria-pressed', 'false');
    openBtn.hidden = true;
    composer.appendChild(openBtn);
    var chalk = button('fl-play-chalkboard', 'Draw it there', false, function () {
      if (typeof root.switchTab === 'function') root.switchTab('canvas');
    });
    chalk.hidden = true;
    composer.appendChild(chalk);
    var saveRow = el('div', 'fl-play-actions');
    saveRow.appendChild(button('fl-play-save', 'Leave it on the shelf', true, leaveIt));
    saveRow.appendChild(button('fl-play-cancel', 'Close', false, function () { hide('fl-play-composer', true); }));
    composer.appendChild(saveRow);
    main.appendChild(composer);

    var shelf = el('div', 'fl-play-shelf');
    shelf.id = 'fl-play-shelf';
    shelf.setAttribute('aria-label', 'The shelf');
    main.appendChild(shelf);

    var object = el('div', 'fl-play-object');
    object.id = 'fl-play-object';
    object.hidden = true;
    var objectBody = el('div', '');
    objectBody.id = 'fl-play-object-body';
    object.appendChild(objectBody);
    var actions = el('div', 'fl-play-actions');
    actions.appendChild(button('fl-play-add', 'Add to it', false, function () { showAdd('add'); }));
    actions.appendChild(button('fl-play-answer-it', 'Answer it', false, function () { showAdd('answer'); }));
    actions.appendChild(button('fl-play-pass', 'Pass', false, function () { humanChoice('pass'); }));
    actions.appendChild(button('fl-play-rest', 'Let it rest', false, function () { humanChoice('rest'); }));
    actions.appendChild(button('fl-play-save-file', 'Save as file', false, saveFile));
    actions.appendChild(button('fl-play-back', 'Back to the shelf', false, backToShelf));
    object.appendChild(actions);
    var addBox = el('div', '');
    addBox.id = 'fl-play-addition-box';
    addBox.hidden = true;
    addBox.appendChild(field('fl-play-addition', 'Your addition', 'textarea', 'Under 120 words'));
    addBox.appendChild(button('fl-play-addition-save', 'Leave this', true, leaveAddition));
    object.appendChild(addBox);

    var picker = el('div', 'fl-play-glass');
    picker.id = 'fl-play-together-picker';
    picker.hidden = true;
    picker.appendChild(el('p', 'fl-play-note', 'Two minds, one object. You watch.'));
    var selectA = doc().createElement('select');
    selectA.id = 'fl-play-seat-a';
    selectA.setAttribute('aria-label', 'First mind');
    var selectB = doc().createElement('select');
    selectB.id = 'fl-play-seat-b';
    selectB.setAttribute('aria-label', 'Second mind');
    var labA = el('label', 'fl-play-field');
    labA.appendChild(el('span', '', 'First mind'));
    labA.appendChild(selectA);
    var labB = el('label', 'fl-play-field');
    labB.appendChild(el('span', '', 'Second mind'));
    labB.appendChild(selectB);
    picker.appendChild(labA);
    picker.appendChild(labB);
    var roundLine = el('p', 'fl-play-note', '');
    roundLine.id = 'fl-play-round-line';
    picker.appendChild(roundLine);
    var pickActions = el('div', 'fl-play-actions');
    pickActions.appendChild(button('fl-play-together-start', 'Start the round', true, startRound));
    picker.appendChild(pickActions);
    object.appendChild(picker);
    object.appendChild(button('fl-play-together', 'Play together now', true, openTogether));
    var board = el('div', 'fl-play-board v-play-together-v0.1');
    board.id = 'fl-play-together-board';
    board.hidden = true;
    board.setAttribute('data-marker', 'v-play-together-v0.1');
    object.appendChild(board);
    var roundActions = el('div', 'fl-play-actions');
    roundActions.id = 'fl-play-round-actions';
    roundActions.appendChild(button('fl-play-pause', 'Pause', false, function () {
      if (!round || !round.pause) return;
      round.pause();
      say('Paused.');
    }));
    roundActions.appendChild(button('fl-play-next', 'Next turn', true, function () {
      if (!round || !round.next) return;
      round.next().then(afterTurn);
    }));
    roundActions.appendChild(button('fl-play-auto', 'Let them go', false, function () {
      if (!round || !round.letThemGo) return;
      round.letThemGo();
      say('They will take turns, with a pause between.');
    }));
    roundActions.appendChild(button('fl-play-stop', 'Stop', false, function () {
      if (round && round.stop) round.stop();
      say(round && round.state && round.state.endReason ? round.state.endReason : 'Stopped.');
      afterTurn();
    }));
    object.appendChild(roundActions);
    main.appendChild(object);

    var players = el('section', 'fl-play-players');
    players.id = 'fl-play-players';
    players.setAttribute('aria-label', 'Who can play');
    main.appendChild(players);

    var mesh = el('div', 'fl-play-actions v-play-mesh-stub-v0.1');
    mesh.setAttribute('data-marker', 'v-play-mesh-stub-v0.1');
    var meshOn = Core.meshOn();
    var meshBtn = button('fl-play-mesh', meshOn ? 'Share play with trusted kin: on' : 'Share play with trusted kin: off', false, function () {
      var next = Core.setMesh(!Core.meshOn());
      meshBtn.textContent = next.on ? 'Share play with trusted kin: on' : 'Share play with trusted kin: off';
      meshBtn.setAttribute('aria-label', meshBtn.textContent);
      meshBtn.setAttribute('aria-pressed', next.on ? 'true' : 'false');
      var note = doc().getElementById('fl-play-mesh-note');
      if (note) note.textContent = next.line || '';
    });
    meshBtn.setAttribute('aria-pressed', meshOn ? 'true' : 'false');
    mesh.appendChild(meshBtn);
    main.appendChild(mesh);
    var meshNote = el('p', 'fl-play-note', meshOn ? 'Coming with kin letters. Nothing is sent yet.' : '');
    meshNote.id = 'fl-play-mesh-note';
    main.appendChild(meshNote);

    var ledger = el('section', 'fl-play-ledger');
    ledger.id = 'fl-play-ledger';
    ledger.setAttribute('aria-label', 'Play ledger');
    var ledgerTitle = el('h2', '', 'Ledger');
    ledgerTitle.title = 'A ledger is a list of choices, in order, on this device.';
    ledger.appendChild(ledgerTitle);
    ledger.appendChild(el('p', 'fl-play-help', 'A ledger is a list of choices, in order, on this device.'));
    var rows = el('div', '');
    rows.id = 'fl-play-ledger-rows';
    ledger.appendChild(rows);
    ledger.appendChild(button('fl-play-see-all', 'See all', false, function () {
      showAll = !showAll;
      var fold = doc().getElementById('fl-play-ledger-all');
      if (fold) fold.hidden = !showAll;
      renderLedger();
    }));
    var fold = el('div', 'fl-play-fold');
    fold.id = 'fl-play-ledger-all';
    fold.hidden = true;
    fold.setAttribute('aria-label', 'All play entries');
    ledger.appendChild(fold);
    main.appendChild(ledger);

    section.appendChild(main);
    container.appendChild(section);
    built = true;
  }

  function refresh() {
    if (!Core || Core.roomShut()) return Promise.resolve();
    return Core.list().then(function (rows) {
      renderShelf(rows);
      renderPlayers();
      renderLedger();
      if (!openId) return null;
      return Core.get(openId).then(function (obj) { renderObject(obj); });
    });
  }

  function mount(container) {
    if (!container || !Core) return Promise.resolve();
    ensureCss();
    hostEl = container;
    if (Core.roomShut()) {
      paintRest(container);
      built = false;
      return Promise.resolve();
    }
    if (!built || !doc().getElementById('fl-play-root')) build(container);
    return refresh();
  }

  function boot() {
    ensureCss();
    var d = doc();
    if (!d) return;
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', placeCard);
    else placeCard();
    if (root.LatticeEvents && typeof root.LatticeEvents.on === 'function') {
      root.LatticeEvents.on('tabChanged', function (info) {
        if (!info) return;
        if (info.tabId === 'quiet' && round && round.pause) round.pause();
        if (info.tabId === 'more') { tries = 0; placeCard(); }
        if (info.tabId === 'play-room') {
          var host = d.getElementById('playRoomContainer');
          if (host) mount(host);
        }
      });
    }
  }

  var api = {
    VERSION: Core ? Core.VERSION : 'v-play-room-v0.1',
    mount: mount,
    placeCard: placeCard,
    refresh: refresh,
    exportObject: function (id) { return Core.exportObject(id); },
    importObject: function (json) { return Core.importObject(json); },
    core: Core
  };
  root.FLPlayRoom = api;
  if (Core) boot();
})(typeof window !== 'undefined' ? window : globalThis);
