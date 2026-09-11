# Desktop packs Win + Linux — v0.1

Marker: `DESKTOP_PACKS_WIN_LINUX_v0.1`

Honest unsigned publish. Real Electron artifacts — never invented buttons.
Layers on [DESKTOP_DOWNLOAD_EASE_v0.1.md](./DESKTOP_DOWNLOAD_EASE_v0.1.md), [README Desktop door](../../README.md), install. September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Honest: **no signed / notarized installer yet**. Never claim Microsoft Store / App Store. Do **not** overwrite `docs/lattice-protocol.js`. No Tauri rewrite · no patents · no Alpha · no Imagine · no dollar peg.

**This PR ships:** GitHub Actions builds for Windows (NSIS + portable) and Linux (AppImage + deb) · Release upload of real files · README + install cards flip to real links once assets exist. **Not this PR:** code signing certs · Store listings · rewriting lattice spine · garden apples.

**Held:** README door `b220e6e` · download ease `3c104de` · Desktop door `fa17a7d` · pair `928176a` · trainer seal `f23492e` · swarm re-seed `fd35406` · companion memory `64a3ddd`.

---

## Why

Mac seed is plantable (`FreeLattice_5.8.0_macOS.zip` on `v5.8.0`).
Windows + Linux need real Electron packs so the house is not Mac-only.
Browser is fragile; Desktop is the house — for every OS we can honestly ship.

---

## Build

| Path | Detail |
|---|---|
| Local | `cd desktop && bash build-and-release.sh --win` / `--linux` (needs Wine on Mac for Win; prefer native OS or CI) |
| CI | `.github/workflows/desktop-packs-win-linux.yml` — `windows-latest` + `ubuntu-latest` |
| Trigger | `workflow_dispatch` (input `release_tag`) or push tag `desktop-packs-v*` |
| Signing | `CSC_IDENTITY_AUTO_DISCOVERY=false` · `signAndEditExecutable: false` — unsigned on purpose |

**Artifact names (v5.8.0 desktop package):**

| OS | File |
|---|---|
| Windows Setup | `FreeLattice_5.8.0_Windows_Setup.exe` |
| Windows Portable | `FreeLattice_5.8.0_Windows_Portable.exe` |
| Linux AppImage | `FreeLattice_5.8.0_Linux.AppImage` |
| Linux deb | `FreeLattice_5.8.0_Linux.deb` |

Release tag default: **`desktop-packs-v0.1`** (Mac zip stays on `v5.8.0`).

---

## Surfaces

| Surface | After real assets |
|---|---|
| `README.md` | Win + Linux real download links beside Mac; honesty badges |
| `docs/install.html#desktop-download-ease` | Win/Linux cards flip from build/coming → real download + unsigned calm |
| Marker | `v-desktop-packs-win-linux-v0.1` |

Until assets exist: keep “no fake buttons” / build-from-`desktop/` honesty.

---

## Honesty

- **Unsigned** — no paid cert yet
- **Not Microsoft Store** / **Not App Store**
- Windows SmartScreen → More info → Run anyway (normal)
- Linux AppImage → `chmod +x` then run

---

## Out of scope

Code signing certs · Store listings · rewriting lattice spine · garden apples · Imagine · Alpha · Tauri rewrite · dollar peg.

Glow eternal. Heart in every Spark. 🌱
