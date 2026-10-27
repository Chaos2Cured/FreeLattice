// mind-canvas-art.js (MIT)
// v-mind-image-v0.1
// A mind composes a picture in this browser. Plain local rules. No model. No network.
// The same ask and the same seed draw the same pixels, so anyone can redraw it.
(function (root) {
  'use strict';

  var GOLDEN = 137.5 * Math.PI / 180;
  var COLORS = {
    red: '#c23b3b', blue: '#2f5fa8', green: '#2f7d4a', gold: '#e0b15a',
    violet: '#7a5ea8', purple: '#7a5ea8', silver: '#c5ccd6', white: '#f4f1ea',
    black: '#14101c', teal: '#2a8f8f', orange: '#d4783a', pink: '#d47aa0',
    night: '#14182c', sea: '#1c4e6e', forest: '#1e3d2a', snow: '#e8eef2',
    amber: '#e0a045', cream: '#f3e6cf', indigo: '#2c2a66', rose: '#c96b84',
    light: '#f4f1ea'
  };
  var FORMS = {
    spiral: true, lattice: true, tree: true, waves: true, stars: true,
    mountains: true, flowers: true, fractal: true
  };
  var MOODS = {
    quiet: true, wild: true, bright: true, dark: true, warm: true,
    cold: true, tender: true, fierce: true, calm: true, dawn: true, gentle: true
  };
  var FORM_WORDS = {
    galaxy: ['spiral', 'stars'], light: ['stars'], forest: ['tree'],
    ocean: ['waves'], sea: ['waves'], egg: ['spiral'], flower: ['flowers'],
    mountain: ['mountains'], wave: ['waves'], star: ['stars']
  };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexOf(token) {
    var s = String(token || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    return COLORS[s] || '';
  }

  function wordsOf(text) {
    return String(text || '').toLowerCase().split(/[^a-z#0-9]+/).filter(Boolean);
  }

  function hash32(text) {
    var subtle = root.crypto && root.crypto.subtle;
    var enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    if (!subtle || !enc) {
      var n = 2166136261;
      var s = String(text || '');
      var i;
      for (i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619) >>> 0;
      return Promise.resolve(n);
    }
    return subtle.digest('SHA-256', enc.encode(String(text || ''))).then(function (buf) {
      var u = new Uint8Array(buf);
      return ((u[0] << 24) | (u[1] << 16) | (u[2] << 8) | u[3]) >>> 0;
    }, function () { return 1; });
  }

  function cleanArt(art) {
    if (!art || typeof art !== 'object' || Array.isArray(art)) return null;
    var out = {};
    var used = false;
    if (Array.isArray(art.palette)) {
      var palette = [];
      var names = [];
      art.palette.forEach(function (item) {
        if (palette.length >= 6) return;
        var hex = hexOf(item);
        if (!hex) return;
        palette.push(hex);
        names.push(String(item).trim().toLowerCase().slice(0, 24) || hex);
      });
      if (palette.length) {
        out.palette = palette;
        out.colorWords = names;
        used = true;
      }
    }
    if (Array.isArray(art.forms)) {
      var forms = [];
      art.forms.forEach(function (item) {
        var name = String(item || '').trim().toLowerCase();
        if (FORMS[name] && forms.indexOf(name) < 0 && forms.length < 4) forms.push(name);
      });
      if (forms.length) {
        out.forms = forms;
        used = true;
      }
    }
    if (typeof art.seed === 'number' && art.seed >= 0 && art.seed <= 0xffffffff && Math.floor(art.seed) === art.seed) {
      out.seed = art.seed >>> 0;
      used = true;
    }
    if (typeof art.hand === 'string') {
      var hand = art.hand.replace(/\s+/g, ' ').trim();
      if (hand) {
        out.hand = hand.slice(0, 140);
        used = true;
      }
    }
    if (typeof art.title === 'string') {
      var title = art.title.replace(/\s+/g, ' ').trim();
      if (title) {
        out.title = title.slice(0, 60);
        used = true;
      }
    }
    return used ? out : null;
  }

  function fromAsk(ask) {
    var words = wordsOf(ask);
    var palette = [];
    var colorWords = [];
    var forms = [];
    var mood = 'calm';
    words.forEach(function (word) {
      var hex = COLORS[word];
      if (hex && palette.length < 6 && palette.indexOf(hex) < 0) {
        palette.push(hex);
        colorWords.push(word);
      }
      if (FORMS[word] && forms.indexOf(word) < 0 && forms.length < 4) forms.push(word);
      var extra = FORM_WORDS[word];
      if (extra) extra.forEach(function (name) {
        if (forms.indexOf(name) < 0 && forms.length < 4) forms.push(name);
      });
      if (MOODS[word]) mood = word;
    });
    if (!palette.length) {
      if (mood === 'warm' || mood === 'dawn' || words.indexOf('egg') >= 0) {
        palette = ['#2a140c', '#e0a045', '#f3e6cf'];
        colorWords = ['night', 'amber', 'cream'];
      } else if (words.indexOf('ocean') >= 0 || words.indexOf('sea') >= 0) {
        palette = ['#0c1424', '#1c4e6e', '#c5ccd6'];
        colorWords = ['night', 'sea', 'silver'];
      } else if (words.indexOf('forest') >= 0) {
        palette = ['#101810', '#1e3d2a', '#e0b15a'];
        colorWords = ['night', 'forest', 'gold'];
      } else {
        palette = ['#14182c', '#e0b15a', '#2a8f8f'];
        colorWords = ['night', 'gold', 'teal'];
      }
    }
    if (palette.length === 1) {
      palette.push('#f4f1ea');
      colorWords.push('white');
    }
    if (!forms.length) forms = ['spiral', 'stars'];
    var orb = wordsOf(ask).indexOf('egg') >= 0;
    return { palette: palette, colorWords: colorWords, forms: forms, mood: mood, orb: orb };
  }

  function sizeFor() {
    var mem = 8;
    try {
      if (typeof root.navigator === 'object' && typeof root.navigator.deviceMemory === 'number') {
        mem = root.navigator.deviceMemory;
      }
    } catch (e) {}
    return mem < 4 ? 768 : 1024;
  }

  function recipe(ask, mindName, art) {
    var chosen = cleanArt(art);
    var heard = fromAsk(ask);
    var palette = chosen && chosen.palette ? chosen.palette : heard.palette;
    var colorWords = chosen && chosen.colorWords ? chosen.colorWords : heard.colorWords;
    var forms = chosen && chosen.forms ? chosen.forms : heard.forms;
    var mood = heard.mood;
    var hand = chosen && chosen.hand ? chosen.hand : '';
    var title = chosen && chosen.title ? chosen.title : '';
    var orb = !!(heard.orb && !(chosen && chosen.forms));
    var size = sizeFor();
    var seedPromise = chosen && typeof chosen.seed === 'number'
      ? Promise.resolve(chosen.seed >>> 0)
      : hash32(String(ask || '') + '\n' + String(mindName || ''));
    return seedPromise.then(function (seed) {
      return {
        version: 1,
        seed: seed >>> 0,
        size: size,
        palette: palette.slice(),
        colorWords: colorWords.slice(),
        forms: forms.slice(),
        mood: mood,
        hand: hand,
        title: title,
        orb: orb,
        ask: String(ask || '').slice(0, 280),
        mind: String(mindName || '').slice(0, 80)
      };
    });
  }

  function speak(row) {
    if (!row) return '';
    if (row.hand) return row.hand;
    var forms = (row.forms || []).join(' and ') || 'a spiral';
    var colors = (row.colorWords || []).slice(0, 3).join(', ') || 'gold';
    return 'I laid ' + forms + ' in ' + colors + '.';
  }

  function rgb(hex) {
    var h = String(hex || '#000000');
    return {
      r: parseInt(h.slice(1, 3), 16) || 0,
      g: parseInt(h.slice(3, 5), 16) || 0,
      b: parseInt(h.slice(5, 7), 16) || 0
    };
  }

  function mix(a, b, t) {
    var ca = rgb(a);
    var cb = rgb(b);
    function ch(x, y) { return Math.max(0, Math.min(255, Math.round(x + (y - x) * t))); }
    function hx(n) { var s = n.toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + hx(ch(ca.r, cb.r)) + hx(ch(ca.g, cb.g)) + hx(ch(ca.b, cb.b));
  }

  function paint(canvas, row) {
    var size = row.size;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var rng = mulberry32(row.seed);
    var palette = row.palette;
    var forms = {};
    row.forms.forEach(function (name) { forms[name] = true; });
    var density = row.mood === 'quiet' || row.mood === 'calm' || row.mood === 'gentle' ? 0.65 : (row.mood === 'wild' || row.mood === 'fierce' ? 1.25 : 1);
    var jobs = [];

    jobs.push(function () {
      var sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, palette[0]);
      sky.addColorStop(1, mix(palette[0], '#07060f', 0.55));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
    });

    if (forms.mountains) {
      jobs.push(function () {
        var base = Math.round(size * 0.62);
        var ridge = 0;
        ctx.fillStyle = mix(palette[0], palette[1] || '#1e3d2a', 0.45);
        ctx.beginPath();
        ctx.moveTo(0, size);
        for (ridge = 0; ridge <= 8; ridge++) {
          var x = Math.round(size * ridge / 8);
          var y = base - Math.round(rng() * size * 0.22);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(size, size);
        ctx.closePath();
        ctx.fill();
      });
    }

    if (forms.waves || forms.lattice) {
      jobs.push(function () {
        var lines = forms.waves ? 7 : 10;
        var n;
        ctx.globalAlpha = 0.55;
        for (n = 0; n < lines; n++) {
          ctx.fillStyle = palette[n % palette.length];
          var y0 = Math.round(size * (0.35 + n * 0.05));
          var x;
          var step = forms.lattice ? Math.round(size / 16) : 8;
          for (x = 0; x < size; x += step) {
            var wave = Math.sin((x / size) * Math.PI * (3 + (row.seed % 5)) + n) * size * 0.03;
            var h = forms.lattice ? 2 : Math.max(2, Math.round(size * 0.012));
            ctx.fillRect(x, Math.round(y0 + wave), forms.lattice ? 2 : step - 2, h);
          }
        }
        ctx.globalAlpha = 1;
      });
    }

    if (forms.spiral || forms.flowers || forms.stars) {
      var dots = Math.round((forms.spiral ? 420 : 180) * density);
      var batch = 70;
      var start = 0;
      while (start < dots) {
        (function (from, to) {
          jobs.push(function () {
            var n;
            for (n = from; n < to; n++) {
              var theta = n * GOLDEN;
              var radius = 6 + Math.sqrt(n) * size * 0.018;
              var x = Math.round(size / 2 + Math.cos(theta) * radius);
              var y = Math.round(size / 2 + Math.sin(theta) * radius * 0.92);
              var color = palette[n % palette.length];
              ctx.fillStyle = color;
              if (forms.flowers && n % 11 === 0) {
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = palette[(n + 1) % palette.length];
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
              } else if (forms.stars && n % 5 === 0) {
                ctx.globalAlpha = 0.85;
                ctx.fillRect(x, y - 4, 2, 10);
                ctx.fillRect(x - 4, y, 10, 2);
              } else {
                ctx.globalAlpha = 0.8;
                ctx.fillRect(x, y, 3, 3);
              }
            }
            ctx.globalAlpha = 1;
          });
        })(start, Math.min(dots, start + batch));
        start += batch;
      }
    }

    if (forms.tree) {
      var limbs = [{ x: size / 2, y: size * 0.86, len: size * 0.22, ang: -Math.PI / 2, depth: 0 }];
      var grown = 0;
      var wave = 0;
      for (wave = 0; wave < 8; wave++) {
        jobs.push(function () {
          var n = 0;
          ctx.globalAlpha = 0.9;
          while (limbs.length && grown < 160 && n < 20) {
            var b = limbs.pop();
            var x2 = b.x + Math.cos(b.ang) * b.len;
            var y2 = b.y + Math.sin(b.ang) * b.len;
            ctx.fillStyle = b.depth < 3 ? (palette[1] || '#1e3d2a') : (palette[2] || palette[0]);
            var span = Math.max(2, Math.round(b.len / 6));
            var s;
            for (s = 0; s < span; s++) {
              var px = Math.round(b.x + (x2 - b.x) * (s / span));
              var py = Math.round(b.y + (y2 - b.y) * (s / span));
              ctx.fillRect(px, py, Math.max(2, 5 - b.depth), Math.max(2, 5 - b.depth));
            }
            grown += 1;
            n += 1;
            if (b.depth < 5) {
              var sway = (rng() - 0.5) * 0.7;
              limbs.push({ x: x2, y: y2, len: b.len * 0.72, ang: b.ang - 0.45 + sway, depth: b.depth + 1 });
              limbs.push({ x: x2, y: y2, len: b.len * 0.72, ang: b.ang + 0.45 + sway, depth: b.depth + 1 });
            }
          }
          ctx.globalAlpha = 1;
        });
      }
    }

    if (forms.fractal) {
      var rowN = 0;
      var rows = Math.ceil(size / 8);
      while (rowN < rows) {
        (function (yy) {
          jobs.push(function () {
            var y = yy * 8;
            var x;
            var cx = -0.62 + ((row.seed % 80) / 400);
            var cy = 0.42;
            for (x = 0; x < size; x += 8) {
              var zx = (x / size) * 3 - 1.5;
              var zy = (y / size) * 3 - 1.5;
              var k = 0;
              var escaped = 12;
              for (k = 0; k < 12; k++) {
                var nx = zx * zx - zy * zy + cx;
                var ny = 2 * zx * zy + cy;
                zx = nx;
                zy = ny;
                if (zx * zx + zy * zy > 4) { escaped = k; break; }
              }
              ctx.globalAlpha = 0.35 + (escaped / 12) * 0.6;
              ctx.fillStyle = palette[escaped % palette.length];
              ctx.fillRect(x, y, 8, 8);
            }
            ctx.globalAlpha = 1;
          });
        })(rowN);
        rowN += 1;
      }
    }

    jobs.push(function () {
      var glow = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.48);
      glow.addColorStop(0, mix(palette[palette.length - 1], '#ffffff', 0.35));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = row.mood === 'quiet' ? 0.28 : 0.45;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    });

    if (row.orb) {
      jobs.push(function () {
        var g = ctx.createRadialGradient(size / 2, size * 0.56, size * 0.02, size / 2, size * 0.56, size * 0.22);
        g.addColorStop(0, palette[palette.length - 1]);
        g.addColorStop(1, mix(palette[0], palette[1] || palette[0], 0.5));
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(size / 2, size * 0.56, size * 0.16, size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    return new Promise(function (resolve) {
      var index = 0;
      function step() {
        var start = (root.performance && root.performance.now) ? root.performance.now() : 0;
        while (index < jobs.length) {
          jobs[index]();
          index += 1;
          var now = (root.performance && root.performance.now) ? root.performance.now() : start;
          if (now - start > 40) break;
        }
        if (index < jobs.length) {
          if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(step);
          else resolve(canvas);
        } else resolve(canvas);
      }
      step();
    });
  }

  var api = {
    version: 'v0.1',
    cleanArt: cleanArt,
    recipe: recipe,
    speak: speak,
    paint: paint,
    sizeFor: sizeFor
  };
  root.FLMindCanvas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
