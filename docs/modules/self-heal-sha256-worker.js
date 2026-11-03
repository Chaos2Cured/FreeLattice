/* FreeLattice: incremental SHA-256 for self-heal v0.1.
   One piece per message. The whole file is never hashed in one call.
   Browser: pure JS. Node: crypto.createHash, still one piece per message.
*/
(function () {
  'use strict';

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rot(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function createPure() {
    var h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    var buf = new Uint8Array(64);
    var bufLen = 0;
    var total = 0;
    var w = new Uint32Array(64);

    function block(chunk) {
      var i;
      for (i = 0; i < 16; i++) {
        w[i] = ((chunk[i * 4] << 24) | (chunk[i * 4 + 1] << 16) | (chunk[i * 4 + 2] << 8) | chunk[i * 4 + 3]) >>> 0;
      }
      for (i = 16; i < 64; i++) {
        var s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
        var ch = (e & f) ^ ((~e) & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        hh = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0;
      h[1] = (h[1] + b) >>> 0;
      h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0;
      h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0;
      h[7] = (h[7] + hh) >>> 0;
    }

    function update(data) {
      var view = data instanceof Uint8Array ? data : new Uint8Array(data);
      var off = 0;
      total += view.length;
      if (bufLen) {
        var take = Math.min(64 - bufLen, view.length);
        buf.set(view.subarray(0, take), bufLen);
        bufLen += take;
        off = take;
        if (bufLen === 64) {
          block(buf);
          bufLen = 0;
        }
      }
      while (off + 64 <= view.length) {
        block(view.subarray(off, off + 64));
        off += 64;
      }
      if (off < view.length) {
        buf.set(view.subarray(off), 0);
        bufLen = view.length - off;
      }
    }

    function hex() {
      var saved = total;
      var padLen = bufLen < 56 ? 56 - bufLen : 120 - bufLen;
      var pad = new Uint8Array(padLen + 8);
      pad[0] = 0x80;
      var hi = Math.floor(saved / 536870912);
      var lo = (saved % 536870912) * 8;
      var dv = new DataView(pad.buffer);
      dv.setUint32(padLen, hi);
      dv.setUint32(padLen + 4, lo);
      update(pad);
      var out = '';
      var i;
      for (i = 0; i < 8; i++) out += ('00000000' + h[i].toString(16)).slice(-8);
      return out;
    }

    return { update: update, hex: hex };
  }

  var nodeHash = null;
  var pure = null;
  function reset() {
    nodeHash = null;
    pure = null;
    var forcePure = typeof process !== 'undefined' && process.env && process.env.FL_SHA_PURE === '1';
    if (!forcePure && typeof require === 'function') {
      try {
        nodeHash = require('crypto').createHash('sha256');
      } catch (e) {
        nodeHash = null;
      }
    }
    if (!nodeHash) pure = createPure();
  }

  function reply(obj) {
    if (typeof parentPort !== 'undefined' && parentPort) parentPort.postMessage(obj);
    else if (typeof postMessage === 'function') postMessage(obj);
  }

  function onMsg(msg) {
    if (!msg || !msg.op) return;
    if (msg.op === 'piece') {
      var view = new Uint8Array(msg.buf);
      if (nodeHash) nodeHash.update(view);
      else pure.update(view);
      reply({ op: 'ack' });
      return;
    }
    if (msg.op === 'finish') {
      var hex = nodeHash ? nodeHash.digest('hex') : pure.hex();
      reset();
      reply({ op: 'done', hex: hex });
    }
  }

  reset();

  if (typeof require === 'function') {
    var parentPort = require('worker_threads').parentPort;
    parentPort.on('message', onMsg);
  } else {
    self.onmessage = function (ev) { onMsg(ev.data); };
  }
})();
