#!/usr/bin/env node
/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*
 * zip.js — zero-dep ZIP64 writer (and a small reader for tests/proofs).
 *
 * Node has no built-in zip archiver. We do not add an npm dependency.
 * This module writes local file headers + payload + central directory +
 * EOCD, and is the only zip implementation in the product.
 *
 * Compression is zlib.createDeflateRaw / deflateRawSync — NOT
 * createDeflate. The zlib wrapper (CMF/FLG + Adler-32) is not the
 * DEFLATE method zip readers expect; Explorer rejects those entries.
 * CRC is zlib.crc32 (built-in on Node ≥22.5, our engines floor).
 *
 * ZIP64 is mandatory, not a large-N upgrade. Classic zip caps at
 * 65,535 entries and 4 GiB offsets; a 100k-memory export is tens of
 * thousands of individual files and would be a CORRUPT archive at the
 * exact scale RM-07 exists for. Every archive this writer emits has:
 *   - 0xFFFFFFFF sentinels in the 32-bit size/offset fields
 *   - a ZIP64 extra field (0x0001) with the real 64-bit values
 *   - ZIP64 EOCD + ZIP64 EOCD locator
 *   - classic EOCD with 0xFFFF / 0xFFFFFFFF sentinels
 * There is no classic-only path that works at 10k and corrupts at 70k.
 * If zip64 is somehow disabled and the archive would overflow, finalize()
 * throws BEFORE rename — never a truncated file that looks like a zip.
 *
 * Writes stream to `<dest>.tmp` and rename at EOCD (writeFileDurable's
 * cousin). A killed export leaves the tmp, not a valid-looking dest.
 * Deflate of a large member (memories.jsonl) spills to a sibling tmp
 * so we never hold the uncompressed payload, then copies in with known
 * sizes (no data-descriptor / bit-3 — Explorer is picky about those).
 */

"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const { PassThrough } = require("stream");

const SIG_LOCAL = 0x04034b50;
const SIG_CD = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_ZIP64_LOC = 0x07064b50;
const ZIP64_EXTRA_ID = 0x0001;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const VERSION_ZIP64 = 45;
const FLAG_UTF8 = 0x0800;
const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

function dosDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d || Date.now());
  const year = dt.getFullYear();
  const y = year < 1980 ? 1980 : (year > 2107 ? 2107 : year);
  const time = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1);
  const date = ((y - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  return { time, date };
}

function crcOf(buf) {
  return zlib.crc32(buf) >>> 0;
}

function nameBuf(name) {
  return Buffer.from(String(name), "utf8");
}

function zip64Extra(parts) {
  // APPNOTE 4.5.3: fields appear in this order, only those whose 32/16-bit
  // home field was the overflow sentinel. We always overflow usize/csize
  // (and offset in the central directory), so the extra is a stable size.
  const chunks = [];
  for (const n of parts) {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(n), 0);
    chunks.push(b);
  }
  const payload = Buffer.concat(chunks);
  const hdr = Buffer.alloc(4);
  hdr.writeUInt16LE(ZIP64_EXTRA_ID, 0);
  hdr.writeUInt16LE(payload.length, 2);
  return Buffer.concat([hdr, payload]);
}

function localHeader(nb, extra, rec) {
  const buf = Buffer.alloc(30 + nb.length + extra.length);
  buf.writeUInt32LE(SIG_LOCAL, 0);
  buf.writeUInt16LE(rec.versionNeeded, 4);
  buf.writeUInt16LE(rec.flag, 6);
  buf.writeUInt16LE(rec.method, 8);
  buf.writeUInt16LE(rec.time, 10);
  buf.writeUInt16LE(rec.date, 12);
  buf.writeUInt32LE(rec.crc >>> 0, 14);
  buf.writeUInt32LE(U32_MAX, 18);          // ZIP64 sentinel
  buf.writeUInt32LE(U32_MAX, 22);
  buf.writeUInt16LE(nb.length, 26);
  buf.writeUInt16LE(extra.length, 28);
  nb.copy(buf, 30);
  extra.copy(buf, 30 + nb.length);
  return buf;
}

function centralHeader(nb, extra, rec) {
  const buf = Buffer.alloc(46 + nb.length + extra.length);
  buf.writeUInt32LE(SIG_CD, 0);
  buf.writeUInt16LE(rec.versionMade, 4);
  buf.writeUInt16LE(rec.versionNeeded, 6);
  buf.writeUInt16LE(rec.flag, 8);
  buf.writeUInt16LE(rec.method, 10);
  buf.writeUInt16LE(rec.time, 12);
  buf.writeUInt16LE(rec.date, 14);
  buf.writeUInt32LE(rec.crc >>> 0, 16);
  buf.writeUInt32LE(U32_MAX, 20);
  buf.writeUInt32LE(U32_MAX, 24);
  buf.writeUInt16LE(nb.length, 28);
  buf.writeUInt16LE(extra.length, 30);
  buf.writeUInt16LE(0, 32);                // comment
  buf.writeUInt16LE(0, 34);                // disk start (single disk)
  buf.writeUInt16LE(0, 36);                // internal attrs
  buf.writeUInt32LE(0, 38);                // external attrs
  buf.writeUInt32LE(U32_MAX, 42);          // ZIP64 sentinel for offset
  nb.copy(buf, 46);
  extra.copy(buf, 46 + nb.length);
  return buf;
}

class ZipWriter {
  constructor(destPath, opts) {
    opts = opts || {};
    this.destPath = path.resolve(String(destPath));
    this.tmpPath = this.destPath + ".tmp";
    this.zip64 = opts.zip64 !== false;     // default ON — no classic-only path
    this.mtime = opts.mtime instanceof Date ? opts.mtime : new Date();
    const dos = dosDateTime(this.mtime);
    this.time = dos.time;
    this.date = dos.date;
    this.entries = [];
    this.offset = 0;
    this.closed = false;
    this.fd = null;
    const dir = path.dirname(this.tmpPath);
    fs.mkdirSync(dir, { recursive: true });
    try { if (fs.existsSync(this.tmpPath)) fs.unlinkSync(this.tmpPath); } catch { /* leftover */ }
    this.fd = fs.openSync(this.tmpPath, "w");
  }

  _write(buf) {
    if (this.fd == null) throw new Error("ZipWriter: already closed");
    fs.writeSync(this.fd, buf);
    this.offset += buf.length;
  }

  _copyFile(file) {
    const src = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(64 * 1024);
      for (;;) {
        const n = fs.readSync(src, buf, 0, buf.length, null);
        if (n <= 0) break;
        fs.writeSync(this.fd, buf, 0, n);
        this.offset += n;
      }
    } finally {
      fs.closeSync(src);
    }
  }

  _pushEntry(name, rec) {
    this.entries.push({
      name: String(name),
      method: rec.method,
      flag: FLAG_UTF8,
      crc: rec.crc >>> 0,
      usize: rec.usize,
      csize: rec.csize,
      localOffset: rec.localOffset,
      time: this.time,
      date: this.date,
      versionNeeded: VERSION_ZIP64,
      versionMade: VERSION_ZIP64,
    });
  }

  _addMember(name, payload, method, crc, usize, csize) {
    const nb = nameBuf(name);
    if (nb.length > U16_MAX) throw new Error("ZipWriter: filename too long (" + name + ")");
    const localOffset = this.offset;
    const extra = zip64Extra([usize, csize]);
    this._write(localHeader(nb, extra, {
      versionNeeded: VERSION_ZIP64,
      flag: FLAG_UTF8,
      method,
      time: this.time,
      date: this.date,
      crc,
    }));
    if (typeof payload === "string") this._copyFile(payload);
    else this._write(payload);
    this._pushEntry(name, { method, crc, usize, csize, localOffset });
  }

  addStored(name, data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
    this._addMember(name, buf, METHOD_STORE, crcOf(buf), buf.length, buf.length);
    return buf.length;
  }

  addDeflated(name, data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
    const compressed = zlib.deflateRawSync(buf);
    this._addMember(name, compressed, METHOD_DEFLATE, crcOf(buf), buf.length, compressed.length);
    return { usize: buf.length, csize: compressed.length };
  }

  /*
   * Stream-deflate an async iterable of strings/Buffers into a spill file,
   * then copy the compressed bytes in with known sizes. Never materializes
   * the uncompressed payload. Spill lives beside the .tmp so a kill leaves
   * junk with a .tmp name, never a dest that looks like a zip.
   */
  async addDeflatedStream(name, chunks) {
    const spill = this.tmpPath + ".deflate";
    try { if (fs.existsSync(spill)) fs.unlinkSync(spill); } catch { /* leftover */ }
    const input = new PassThrough({ highWaterMark: 4 * 1024 * 1024 });
    const deflate = zlib.createDeflateRaw();
    const out = fs.createWriteStream(spill);
    const piped = pipeline(input, deflate, out);
    let crc = 0;
    let usize = 0;
    try {
      for await (const chunk of chunks) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
        if (!buf.length) continue;
        usize += buf.length;
        crc = zlib.crc32(buf, crc);
        if (!input.write(buf)) await new Promise((r) => input.once("drain", r));
      }
      input.end();
      await piped;
    } catch (e) {
      try { input.destroy(); } catch { /* */ }
      try { if (fs.existsSync(spill)) fs.unlinkSync(spill); } catch { /* */ }
      throw e;
    }
    const csize = fs.statSync(spill).size;
    this._addMember(name, spill, METHOD_DEFLATE, crc >>> 0, usize, csize);
    try { fs.unlinkSync(spill); } catch { /* */ }
    return { usize, csize, crc: crc >>> 0 };
  }

  finalize() {
    if (this.closed) throw new Error("ZipWriter: already finalized");
    const n = this.entries.length;
    const overflow = n > U16_MAX || this.offset > U32_MAX ||
      this.entries.some((e) => e.usize > U32_MAX || e.csize > U32_MAX || e.localOffset > U32_MAX);
    if (!this.zip64 && overflow) {
      this._abort();
      throw new Error(
        "ZipWriter: archive exceeds classic zip limits (" + n +
        " entries, offset " + this.offset + "). ZIP64 is required; refusing to emit a corrupt archive."
      );
    }
    const cdOffset = this.offset;
    for (const e of this.entries) {
      const nb = nameBuf(e.name);
      const extra = zip64Extra([e.usize, e.csize, e.localOffset]);
      this._write(centralHeader(nb, extra, e));
    }
    const cdSize = this.offset - cdOffset;
    const zip64EocdOffset = this.offset;

    // ZIP64 end of central directory (APPNOTE 4.3.14.1). sizeOfRecord is
    // the remaining bytes after the size field itself: 44 for the original
    // fields, no extensible data.
    const z64 = Buffer.alloc(56);
    z64.writeUInt32LE(SIG_ZIP64_EOCD, 0);
    z64.writeBigUInt64LE(44n, 4);
    z64.writeUInt16LE(VERSION_ZIP64, 12);
    z64.writeUInt16LE(VERSION_ZIP64, 14);
    z64.writeUInt32LE(0, 16);              // disk
    z64.writeUInt32LE(0, 20);              // cd disk
    z64.writeBigUInt64LE(BigInt(n), 24);
    z64.writeBigUInt64LE(BigInt(n), 32);
    z64.writeBigUInt64LE(BigInt(cdSize), 40);
    z64.writeBigUInt64LE(BigInt(cdOffset), 48);
    this._write(z64);

    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(SIG_ZIP64_LOC, 0);
    loc.writeUInt32LE(0, 4);               // disk of zip64 eocd
    loc.writeBigUInt64LE(BigInt(zip64EocdOffset), 8);
    loc.writeUInt32LE(1, 16);              // total disks
    this._write(loc);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(SIG_EOCD, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(U16_MAX, 8);
    eocd.writeUInt16LE(U16_MAX, 10);
    eocd.writeUInt32LE(U32_MAX, 12);
    eocd.writeUInt32LE(U32_MAX, 16);
    eocd.writeUInt16LE(0, 20);
    this._write(eocd);

    try { fs.fsyncSync(this.fd); } catch { /* some volumes refuse fsync; rename is still atomic */ }
    fs.closeSync(this.fd);
    this.fd = null;
    this.closed = true;
    fs.renameSync(this.tmpPath, this.destPath);
    return {
      path: this.destPath,
      entries: n,
      bytes: this.offset,
      cdOffset,
      zip64: true,
    };
  }

  _abort() {
    if (this.fd != null) {
      try { fs.closeSync(this.fd); } catch { /* */ }
      this.fd = null;
    }
    try { if (fs.existsSync(this.tmpPath)) fs.unlinkSync(this.tmpPath); } catch { /* */ }
    try {
      const spill = this.tmpPath + ".deflate";
      if (fs.existsSync(spill)) fs.unlinkSync(spill);
    } catch { /* */ }
    this.closed = true;
  }

  abort() { this._abort(); }
}

function readU64(buf, off) {
  return Number(buf.readBigUInt64LE(off));
}

function parseZip64Extra(extra, rec) {
  let i = 0;
  while (i + 4 <= extra.length) {
    const id = extra.readUInt16LE(i);
    const sz = extra.readUInt16LE(i + 2);
    i += 4;
    if (i + sz > extra.length) break;
    if (id === ZIP64_EXTRA_ID) {
      let p = i;
      if (rec.usize === U32_MAX && p + 8 <= i + sz) { rec.usize = readU64(extra, p); p += 8; }
      if (rec.csize === U32_MAX && p + 8 <= i + sz) { rec.csize = readU64(extra, p); p += 8; }
      if (rec.localOffset === U32_MAX && p + 8 <= i + sz) { rec.localOffset = readU64(extra, p); p += 8; }
    }
    i += sz;
  }
  return rec;
}

class ZipReader {
  constructor(filePath, entries, fileSize) {
    this.path = filePath;
    this.entries = entries;
    this.fileSize = fileSize;
    this._byName = new Map();
    for (const e of entries) this._byName.set(e.name, e);
  }

  static open(filePath) {
    const st = fs.statSync(filePath);
    const fd = fs.openSync(filePath, "r");
    try {
      const tailLen = Math.min(st.size, 256 * 1024);
      const tail = Buffer.alloc(tailLen);
      fs.readSync(fd, tail, 0, tailLen, st.size - tailLen);
      let eocdRel = -1;
      for (let i = tail.length - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === SIG_EOCD) { eocdRel = i; break; }
      }
      if (eocdRel < 0) throw new Error("ZipReader: no EOCD (not a zip, or truncated)");
      let nEntries, cdOffset, cdSize;
      const locRel = eocdRel - 20;
      if (locRel >= 0 && tail.readUInt32LE(locRel) === SIG_ZIP64_LOC) {
        const z64off = readU64(tail, locRel + 8);
        const z64 = Buffer.alloc(56);
        fs.readSync(fd, z64, 0, 56, z64off);
        if (z64.readUInt32LE(0) !== SIG_ZIP64_EOCD) {
          throw new Error("ZipReader: ZIP64 locator did not point at ZIP64 EOCD");
        }
        nEntries = readU64(z64, 32);
        cdSize = readU64(z64, 40);
        cdOffset = readU64(z64, 48);
      } else {
        const eocd = tail.slice(eocdRel, eocdRel + 22);
        nEntries = eocd.readUInt16LE(10);
        cdSize = eocd.readUInt32LE(12);
        cdOffset = eocd.readUInt32LE(16);
        if (nEntries === U16_MAX || cdSize === U32_MAX || cdOffset === U32_MAX) {
          throw new Error("ZipReader: ZIP64 sentinels but no ZIP64 locator — corrupt archive");
        }
      }
      const cd = Buffer.alloc(cdSize);
      fs.readSync(fd, cd, 0, cdSize, cdOffset);
      const entries = [];
      let p = 0;
      while (p + 46 <= cd.length && entries.length < nEntries) {
        if (cd.readUInt32LE(p) !== SIG_CD) {
          throw new Error("ZipReader: bad central-directory signature at " + p);
        }
        const flag = cd.readUInt16LE(p + 8);
        const method = cd.readUInt16LE(p + 10);
        const crc = cd.readUInt32LE(p + 16);
        let csize = cd.readUInt32LE(p + 20);
        let usize = cd.readUInt32LE(p + 24);
        const nameLen = cd.readUInt16LE(p + 28);
        const extraLen = cd.readUInt16LE(p + 30);
        const commentLen = cd.readUInt16LE(p + 32);
        let localOffset = cd.readUInt32LE(p + 42);
        const name = cd.slice(p + 46, p + 46 + nameLen).toString("utf8");
        const extra = cd.slice(p + 46 + nameLen, p + 46 + nameLen + extraLen);
        const rec = parseZip64Extra(extra, { usize, csize, localOffset });
        entries.push({
          name,
          method,
          flag,
          crc: crc >>> 0,
          usize: rec.usize,
          csize: rec.csize,
          localOffset: rec.localOffset,
          utf8: !!(flag & FLAG_UTF8),
        });
        p += 46 + nameLen + extraLen + commentLen;
      }
      if (entries.length !== nEntries) {
        throw new Error("ZipReader: CD count " + entries.length + " != EOCD " + nEntries);
      }
      return new ZipReader(filePath, entries, st.size);
    } finally {
      fs.closeSync(fd);
    }
  }

  get(name) { return this._byName.get(name) || null; }
  has(name) { return this._byName.has(name); }

  names() { return this.entries.map((e) => e.name); }

  _dataRange(entry) {
    const fd = fs.openSync(this.path, "r");
    try {
      const hdr = Buffer.alloc(30);
      fs.readSync(fd, hdr, 0, 30, entry.localOffset);
      if (hdr.readUInt32LE(0) !== SIG_LOCAL) {
        throw new Error("ZipReader: bad local header for " + entry.name);
      }
      const nameLen = hdr.readUInt16LE(26);
      const extraLen = hdr.readUInt16LE(28);
      const start = entry.localOffset + 30 + nameLen + extraLen;
      return { start, end: start + entry.csize }; // end exclusive
    } finally {
      fs.closeSync(fd);
    }
  }

  readStored(name) {
    const e = this.get(name);
    if (!e) throw new Error("ZipReader: missing " + name);
    const { start } = this._dataRange(e);
    const buf = Buffer.alloc(e.csize);
    const fd = fs.openSync(this.path, "r");
    try { fs.readSync(fd, buf, 0, e.csize, start); }
    finally { fs.closeSync(fd); }
    if (e.method === METHOD_STORE) {
      if ((crcOf(buf) >>> 0) !== (e.crc >>> 0)) throw new Error("ZipReader: CRC mismatch " + name);
      return buf;
    }
    const raw = zlib.inflateRawSync(buf);
    if ((crcOf(raw) >>> 0) !== (e.crc >>> 0)) throw new Error("ZipReader: CRC mismatch " + name);
    return raw;
  }

  /*
   * Stream a member. For the 500 MB jsonl this is the only safe extract —
   * inflateRawSync of the whole payload is the S1 string wall in costume.
   */
  createReadStream(name) {
    const e = this.get(name);
    if (!e) throw new Error("ZipReader: missing " + name);
    const { start, end } = this._dataRange(e);
    const raw = fs.createReadStream(this.path, {
      start,
      end: Math.max(start, end) - 1,
    });
    if (e.method === METHOD_STORE) return raw;
    const inflate = zlib.createInflateRaw();
    raw.pipe(inflate);
    return inflate;
  }
}

function hasZip64Eocd(filePath) {
  const st = fs.statSync(filePath);
  const tailLen = Math.min(st.size, 1024);
  const tail = Buffer.alloc(tailLen);
  const fd = fs.openSync(filePath, "r");
  try { fs.readSync(fd, tail, 0, tailLen, st.size - tailLen); }
  finally { fs.closeSync(fd); }
  for (let i = tail.length - 20; i >= 0; i--) {
    if (tail.readUInt32LE(i) === SIG_ZIP64_LOC) return true;
  }
  return false;
}

module.exports = {
  ZipWriter,
  ZipReader,
  hasZip64Eocd,
  crcOf,
  dosDateTime,
  METHOD_STORE,
  METHOD_DEFLATE,
  FLAG_UTF8,
  VERSION_ZIP64,
  SIG_ZIP64_EOCD,
  SIG_ZIP64_LOC,
  SIG_EOCD,
  U16_MAX,
  U32_MAX,
};
