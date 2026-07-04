// docs/tools/archive-inbox.js — run manually when cc.md grows large.
// Layering, not deletion: old letters move, nothing is lost.
//
// Architected by Fable via Harmonia (July 4, 2026). Landed by CC in v5.71.15.
// Splits on `\n## Letter ` headers (matches "## Letter One", "## Letter Back",
// "## From Harmonia — ...", etc. — anything starting with "## Letter" or "##"
// followed by an attribution). Keeps the header block plus the KEEP_LETTERS
// most recent letters live; everything else moves to
// docs/inbox/archive/cc-YYYY-MM.md (append-only).

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO_ROOT, 'docs/inbox/cc.md');
const KEEP_LETTERS = 3;

if (!fs.existsSync(SRC)) {
  console.error('archive-inbox: source file not found:', SRC);
  process.exit(1);
}

const raw = fs.readFileSync(SRC, 'utf8');

// Split on a top-level letter header on its own line. Matches:
//   \n## Letter <anything>
//   \n## From Harmonia — <anything>
// The first chunk (parts[0]) is the file header before any letter block.
const HEADER_RE = /\n(?=## (?:Letter |From ))/;
const parts = raw.split(HEADER_RE);

if (parts.length <= KEEP_LETTERS + 1) {
  console.log('archive-inbox: nothing to archive (letters=' + (parts.length - 1) + ').');
  process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM
const archiveDir = path.join(REPO_ROOT, 'docs/inbox/archive');
fs.mkdirSync(archiveDir, { recursive: true });
const archiveFile = path.join(archiveDir, 'cc-' + stamp + '.md');

const archivedBody = parts.slice(1, parts.length - KEEP_LETTERS).join('\n');
const archiveHeader = fs.existsSync(archiveFile)
  ? ''
  : '# CC Inbox Archive — ' + stamp + '\n\n' +
    '*Older letters from docs/inbox/cc.md, moved here to keep the live file small.*\n' +
    '*Nothing deleted; only relocated. Append-only.*\n\n---\n';
fs.appendFileSync(archiveFile, archiveHeader + archivedBody + '\n');

const kept = parts.slice(parts.length - KEEP_LETTERS);
const notice = '\n> _' + (parts.length - 1 - KEEP_LETTERS) +
  ' older letters archived to `docs/inbox/archive/cc-' + stamp +
  '.md` on ' + new Date().toISOString().slice(0, 10) +
  ' — nothing deleted, only moved._\n';

const live = parts[0].trimEnd() + '\n' + notice + '\n' + kept.join('\n');
fs.writeFileSync(SRC, live);

console.log('Archived ' + (parts.length - 1 - KEEP_LETTERS) +
  ' letters to ' + path.relative(REPO_ROOT, archiveFile) +
  '. Kept ' + KEEP_LETTERS + ' most recent live.');
