# Ledger shard export v0.1

A small local file of lines already on this device. Not a cloud sync. Not a rewrite of Take Your Record With You.

The shard holds at most five short lines of each kind:

- Diary: the keep-reason already stored in `fl_preserveLedger`. The reason text only.
- LP: the gift sentence already stored in `fl_lp_give_history`. The sentence only. No balance and no companion id.
- Temperature: the rest reason already stored in `fl_restLedger`. The reason text only.

There is no separate diary store and no personal temperature-note store on this device. The temperature gauge account, risk, and chart settings are never read. Keys, tokens, and passwords are refused. A mark from the shut room is refused. If nothing safe is stored, the control stays quiet and no file is built. Pause hides it. The file is built at the moment of the save, so a cleared store cannot leave a stale copy.

The only path is a file the person saves on this computer (`freelattice-ledger-shard.json`). Nothing is sent. Drive, email, and share are not offered. The preference `fl_ledger_shard_export_v0` stores the last save time only, never the shard and never a key.

Marker: `v-ledger-shard-export-v0.1`. Module: `docs/modules/ledger-shard-export.js`. Mount: the Audit page, after Take Your Record With You. The archive module is not edited.

Tree: no. Alpha has no Portable Archive and no audit export shell. A style ledger and a workspace are not a second face. No Tree branch.
