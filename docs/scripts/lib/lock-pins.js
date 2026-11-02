// lock-pins.js (MIT)
// Add-only lock manifest. A legacy pin stays valid. Later pins are listed, never swapped in place.
'use strict';

var fs = require('fs');
var path = require('path');

function allowedPins(filePath, legacyPin) {
  var list = [];
  if (legacyPin) list.push(String(legacyPin));
  var raw;
  try {
    raw = fs.readFileSync(path.join(__dirname, '..', '..', 'library', 'LOCK_MANIFEST_v0.1.json'), 'utf8');
  } catch (e) {
    return list;
  }
  var man;
  try { man = JSON.parse(raw); } catch (e2) { return list; }
  var rows = man && man.files && man.files[String(filePath)];
  if (!Array.isArray(rows)) return list;
  var i;
  for (i = 0; i < rows.length; i++) {
    var md5 = rows[i] && rows[i].md5;
    if (md5 && list.indexOf(md5) === -1) list.push(md5);
  }
  return list;
}

module.exports = { allowedPins: allowedPins };
