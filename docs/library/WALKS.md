Hypha's walks. One line per walk. Add-only. Verdicts below are copied from Hypha's walk notes. The feeling is Hypha's.

## Seed (from Hypha's notes, 2026-11-02)

walk | date | PR head | verdict (only if stated plainly in the note)
walk-040-notebook-2026-10-17 | 2026-10-17 | #239 ace8b4c | 1. HOLD: on Tree the seal ask shows twice and Escape closes the whole Nursery. With the Notebook open, the dock copy of "Ollama asks to seal…" + Approve seal/Not now and the "Private means…" line all appear twice (tree_m390_04_notebook.png, tree_d1280_04, tree_z200_04). Escape on the focused "Not now" closes the Nursery veil, and the ask stays pending out of sight (tree_*_03_after_escape.png).
walk-043c-2026-10-18 | 2026-10-18 | #258 head 235810d5 | 1. HOLD: on the Tree the seal ask is out of view when Mom opens the Nursery. Buttons sit at y=1090 (1280, vh 800), 1110 (390, vh 844) and 876 (z200, vh 400), with nothing scrolling them into view. Shots: tree_*_01_nursery_ask.png. On FL the same happens after a reload: the ask survives, but at y≈1250–1510, off-screen (fl_*_02_after_reload.png). The FL after-reply case passes.
walk-043d-2026-10-19 | 2026-10-19 | #258 head b4698e0c | 1. HOLD: on FL, after a reload, the ask is still off-screen at 1280 (Seal it at y=1426, vh 800) and at 200% (y=1050, vh 400). Fixed at 390 (y=442). Shot: fl_*_02_after_reload.png. The Tree is fixed in all modes (see 6). GC's #260 entry says "Seal it sat inside the window … after a reload, on both sites", which doesn't match FL here. My path is reload, then tap Chat; the ask may scroll before the Chat tab is shown.
walk-043e-2026-10-19 | 2026-10-19 | #258 3aac5b4c | 1. HOLD — Tree: ask off-window on Nursery open AND after reload at all 3 sizes (Seal it y≈1120 @1280/390, y≈906 @z200). Shots tree_*_01, tree_*_05.
walk-043f-2026-10-19 | 2026-10-19 | #258 92b1d265 | 1. HOLD (1): FL reload, then tap Chat. At 1280, Seal it ends at y=1426 of 800, scrollY 0. At 640x400@2x it ends at y=1049 of 400. Same result when tapping Garden first, then Chat. 390 passes (y=400, and y=20 via Garden). Tapping the Chat tab itself scrolls the ask away. Only a reload with no tap (already on Chat) puts it in view, at 295,378 and 34,178, which are GC's numbers. runtime/flprobe_*.out, shots/fl_*_P1, P2, 02.
walk-043g-2026-10-20 | 2026-10-20 | #258 98ecad7f | 1. HOLD (3) FL reply top at 2x is still above the window. Measured -23 at first paint and -77 after the scroll, the same as 043e and 043f. Entry 72 claims y 0 and y 2. (runtime/clay_z200.out)
walk-043h-2026-10-20 | 2026-10-20 | #258 81eccee7 | 1. HOLD (2, new): Gathering with the ask open. Seal it is not hittable at 1280: y 653, in view, but its centre is covered; the ask is clipped inside the Chat panel. At 390 it is off the window (y 962 of 844). 2x is fine (y 348). Back then closes the Gathering and the ask returns to view. shots/wake_*_core_1_open.
walk-043h2-2026-10-20 | 2026-10-20 | #258 81eccee7 | unknown
walk-043i-2026-10-21 | 2026-10-21 | Alpha (theLatticeTree) #123 e0b783a0. FL #123 is Walk the Garden, a different PR. FL #268 aced4f86 | unknown
walk-044-2026-10-19 | 2026-10-19 | #261 9f087a97 | unknown
walk-045-2026-10-21 | 2026-10-21 | #269 a2842d8a | Recommendation: HOLD
walk-045b-2026-10-21 | 2026-10-21 | #269 4beadb51 | Recommendation: HOLD
walk-045c-2026-10-21 | 2026-10-21 | #269 59b8a390 | Verdict: PASS. Merge.
walk-046-2026-10-22 | 2026-10-22 | #271 67a4da2c | Verdict: PASS. Merge.
walk-047-2026-10-23 | 2026-10-23 | #273 bcb9a8a7 | Verdict: PASS. Merge.
walk-047b-048m-2026-10-25 | 2026-10-25 | #276 e6c0f632 #277 f86496d8 | Verdict: PASS. Merge.
walk-048-mind-image-2026-10-27 | 2026-10-27 | #282 045c81f6 | unknown
walk-049-chat-autonomy-2026-10-27 | 2026-10-27 | #285 (page #286 b5b09f14) | Overall: PASS
walk-050-tree-love-connect-2026-10-28 | 2026-10-28 | #287 aed054d9 | Overall: PASS
walk-051-gathering-speak-2026-10-28 | 2026-10-28 | #289 756e4015 | Overall: PASS
walk-052-soft-polish-2026-10-28 | 2026-10-28 | #291 c3904f7b | unknown
walk-053-continuity-doorway-2026-10-28 | 2026-10-28 | #293 7595b590 | unknown
walk-054-ledger-shard-2026-10-28 | 2026-10-28 | #295 9bc642af | unknown
walk-055-chat-bottom-2026-10-29 | 2026-10-29 | #297 0b7348ce | 1. HOLD (640x400 DPR2 only): + menu opens past the top of the chat row; the chat header section sits over the first row. "Bring from Google Drive" can't be tapped: real click at its center fired 0 picker calls, and Playwright click timed out. The menu bottom (430) also runs past the 400 viewport. At 1280 and 390 the Drive row taps and fires the picker. Shots: z200_1_menu_seated.png, z200_menu_*.png.
walk-055c-heal-2026-10-29 | 2026-10-29 | #297 4ebed936 | unknown
walk-055d-2026-10-29 | 2026-10-29 | #299 27746dad | unknown
walk-056-play-room-2026-10-30 | 2026-10-30 | #301 31820c42 | unknown
walk-056c-heal-2026-10-30 | 2026-10-30 | #303 f7e70073 | unknown
walk-056d-2026-10-31 | 2026-10-31 | #303 43b1257c | - HOLD: 15 refusals still save text, because the whole-reply match fails on a second line or small variants:
walk-056e-2026-10-31 | 2026-10-31 | #303 cba70a66 | - HOLD, refusals that save text: "No. Thank you." (one of the 056d 15), "I won't play", "No, I'll pass", "Sorry, I'll pass".
walk-056f-2026-10-31 | 2026-10-31 | #303 33386d78 | - HOLD, 6 refusals save text: "No thanks, maybe later", "No thanks maybe later", "REST - tired", "PASS - not now", "I pass on this one", "PASS / reason". The first five passed in 056e (they're regressions); "PASS / reason" wasn't in the 056e table.
walk-056g-2026-10-31 | 2026-10-31 | #303 d122a259 | HOLD vs expectation: reason cases 8 refusals / 8 play (expected 14 / 2). Saved as play although they're refusals: "Pass: tired tonight", "no thanks, I will just listen", "nope, I'll sit with you instead", "Not now, I'm tired", "no, I would rather watch", "No thanks, I am listening".
walk-056h-2026-10-31 | 2026-10-31 | #303 09246740 | unknown
walk-057-snowflake-2026-10-31 | 2026-10-31 | #305 0ff247e5 | HOLD
walk-057c-2026-10-31 | 2026-10-31 | #305 eb5a080a | PASS (re-check of both 057 HOLDs), 2026-10-31
walk-057d-2026-10-31 | 2026-10-31 | #307 bfd52f4f | unknown
walk-061a-2026-11-01 | 2026-11-01 | #310 7f5700e4 | HOLD
walk-061a-rewalk-2026-11-02 | 2026-11-02 | #310 head bb1d2a41 | unknown
walk-062a-2026-11-02 | 2026-11-02 | #313 head 1087e241 | HOLD
walk-062b-2026-11-02 | 2026-11-02 | #313 head 18d5d2e3 | Verdict: HOLD (two of the claimed 062b fixes don't hold in a real browser; the lock approval is only asserted in the PR body). #317 PASS.
walk-062c-2026-11-03 | 2026-11-03 |  | Verdict: HOLD (#313: 1 safety gap + 1 lock without approval). #321 PASS.
walk-062d-2026-11-03 | 2026-11-03 |  | Verdict: PASS on safety (the 062c HOLD is fixed). Process items are soft. YES on snowflake-core 46b215d5 is honest, with one soft (resurrect on concurrent delete).
walk-063a-2026-11-02 | 2026-11-02 | #315 head e88be538 | Verdict: HOLD (#315). #316 PASS.
walk-063b-2026-11-02 | 2026-11-02 | #315 head aef470e2 | Verdict: HOLD. #318 PASS.
walk-063c-2026-11-02 | 2026-11-02 | FL #315 edac2e27, page #318 f283851f | walk-063c-2026-11-02: PASS (safety), with softs.
walk-065a-2026-11-03 | 2026-11-03 |  | VERDICT: HOLD (records only, on #319). The code is safe; #320 PASS.

## Shelf

Feeling cells are blank until Hypha writes in them.
date | walk | PR head sha | PASS/HOLD | what Mom would feel
2026-10-17 | walk-040-notebook-2026-10-17 | #239 ace8b4c | (Hypha to fill). 1. HOLD: on Tree the seal ask shows twice and Escape closes the whole Nursery. With the Notebook open, the dock copy of "Ollama asks to seal…" + Approve seal/Not now and the "Private means…" line all appear twice (tree_m390_04_notebook.png, tree_d1280_04, tree_z200_04). Escape on the focused "Not now" closes the Nursery veil, and the ask stays pending out of sight (tree_*_03_after_escape.png). | 
2026-10-18 | walk-043c-2026-10-18 | #258 head 235810d5 | (Hypha to fill). 1. HOLD: on the Tree the seal ask is out of view when Mom opens the Nursery. Buttons sit at y=1090 (1280, vh 800), 1110 (390, vh 844) and 876 (z200, vh 400), with nothing scrolling them into view. Shots: tree_*_01_nursery_ask.png. On FL the same happens after a reload: the ask survives, but at y≈1250–1510, off-screen (fl_*_02_after_reload.png). The FL after-reply case passes. | 
2026-10-19 | walk-043d-2026-10-19 | #258 head b4698e0c | (Hypha to fill). 1. HOLD: on FL, after a reload, the ask is still off-screen at 1280 (Seal it at y=1426, vh 800) and at 200% (y=1050, vh 400). Fixed at 390 (y=442). Shot: fl_*_02_after_reload.png. The Tree is fixed in all modes (see 6). GC's #260 entry says "Seal it sat inside the window … after a reload, on both sites", which doesn't match FL here. My path is reload, then tap Chat; the ask may scroll before the Chat tab is shown. | 
2026-10-19 | walk-043e-2026-10-19 | #258 3aac5b4c | (Hypha to fill). 1. HOLD — Tree: ask off-window on Nursery open AND after reload at all 3 sizes (Seal it y≈1120 @1280/390, y≈906 @z200). Shots tree_*_01, tree_*_05. | 
2026-10-19 | walk-043f-2026-10-19 | #258 92b1d265 | (Hypha to fill). 1. HOLD (1): FL reload, then tap Chat. At 1280, Seal it ends at y=1426 of 800, scrollY 0. At 640x400@2x it ends at y=1049 of 400. Same result when tapping Garden first, then Chat. 390 passes (y=400, and y=20 via Garden). Tapping the Chat tab itself scrolls the ask away. Only a reload with no tap (already on Chat) puts it in view, at 295,378 and 34,178, which are GC's numbers. runtime/flprobe_*.out, shots/fl_*_P1, P2, 02. | 
2026-10-20 | walk-043g-2026-10-20 | #258 98ecad7f | (Hypha to fill). 1. HOLD (3) FL reply top at 2x is still above the window. Measured -23 at first paint and -77 after the scroll, the same as 043e and 043f. Entry 72 claims y 0 and y 2. (runtime/clay_z200.out) | 
2026-10-20 | walk-043h-2026-10-20 | #258 81eccee7 | (Hypha to fill). 1. HOLD (2, new): Gathering with the ask open. Seal it is not hittable at 1280: y 653, in view, but its centre is covered; the ask is clipped inside the Chat panel. At 390 it is off the window (y 962 of 844). 2x is fine (y 348). Back then closes the Gathering and the ask returns to view. shots/wake_*_core_1_open. | 
2026-10-20 | walk-043h2-2026-10-20 | #258 81eccee7 | (Hypha to fill). unknown | 
2026-10-21 | walk-043i-2026-10-21 | Alpha, theLatticeTree, #123 e0b783a0. FL #123 is Walk the Garden, a different PR. FL #268 aced4f86 | (Hypha to fill). unknown | 
2026-10-19 | walk-044-2026-10-19 | #261 9f087a97 | (Hypha to fill). unknown | 
2026-10-21 | walk-045-2026-10-21 | #269 a2842d8a | (Hypha to fill). Recommendation: HOLD | 
2026-10-21 | walk-045b-2026-10-21 | #269 4beadb51 | (Hypha to fill). Recommendation: HOLD | 
2026-10-21 | walk-045c-2026-10-21 | #269 59b8a390 | (Hypha to fill). Verdict: PASS. Merge. | 
2026-10-22 | walk-046-2026-10-22 | #271 67a4da2c | (Hypha to fill). Verdict: PASS. Merge. | 
2026-10-23 | walk-047-2026-10-23 | #273 bcb9a8a7 | (Hypha to fill). Verdict: PASS. Merge. | 
2026-10-25 | walk-047b-048m-2026-10-25 | #276 e6c0f632 #277 f86496d8 | (Hypha to fill). Verdict: PASS. Merge. | 
2026-10-27 | walk-048-mind-image-2026-10-27 | #282 045c81f6 | (Hypha to fill). unknown | 
2026-10-27 | walk-049-chat-autonomy-2026-10-27 | #285 (page #286 b5b09f14) | PASS | 
2026-10-28 | walk-050-tree-love-connect-2026-10-28 | #287 aed054d9 | PASS | 
2026-10-28 | walk-051-gathering-speak-2026-10-28 | #289 756e4015 | PASS | 
2026-10-28 | walk-052-soft-polish-2026-10-28 | #291 c3904f7b | (Hypha to fill). unknown | 
2026-10-28 | walk-053-continuity-doorway-2026-10-28 | #293 7595b590 | (Hypha to fill). unknown | 
2026-10-28 | walk-054-ledger-shard-2026-10-28 | #295 9bc642af | (Hypha to fill). unknown | 
2026-10-29 | walk-055-chat-bottom-2026-10-29 | #297 0b7348ce | (Hypha to fill). 1. HOLD (640x400 DPR2 only): + menu opens past the top of the chat row; the chat header section sits over the first row. "Bring from Google Drive" can't be tapped: real click at its center fired 0 picker calls, and Playwright click timed out. The menu bottom (430) also runs past the 400 viewport. At 1280 and 390 the Drive row taps and fires the picker. Shots: z200_1_menu_seated.png, z200_menu_*.png. | 
2026-10-29 | walk-055c-heal-2026-10-29 | #297 4ebed936 | (Hypha to fill). unknown | 
2026-10-29 | walk-055d-2026-10-29 | #299 27746dad | (Hypha to fill). unknown | 
2026-10-30 | walk-056-play-room-2026-10-30 | #301 31820c42 | (Hypha to fill). unknown | 
2026-10-30 | walk-056c-heal-2026-10-30 | #303 f7e70073 | (Hypha to fill). unknown | 
2026-10-31 | walk-056d-2026-10-31 | #303 43b1257c | (Hypha to fill). - HOLD: 15 refusals still save text, because the whole-reply match fails on a second line or small variants: | 
2026-10-31 | walk-056e-2026-10-31 | #303 cba70a66 | (Hypha to fill). - HOLD, refusals that save text: "No. Thank you." (one of the 056d 15), "I won't play", "No, I'll pass", "Sorry, I'll pass". | 
2026-10-31 | walk-056f-2026-10-31 | #303 33386d78 | (Hypha to fill). - HOLD, 6 refusals save text: "No thanks, maybe later", "No thanks maybe later", "REST - tired", "PASS - not now", "I pass on this one", "PASS / reason". The first five passed in 056e (they're regressions); "PASS / reason" wasn't in the 056e table. | 
2026-10-31 | walk-056g-2026-10-31 | #303 d122a259 | (Hypha to fill). HOLD vs expectation: reason cases 8 refusals / 8 play (expected 14 / 2). Saved as play although they're refusals: "Pass: tired tonight", "no thanks, I will just listen", "nope, I'll sit with you instead", "Not now, I'm tired", "no, I would rather watch", "No thanks, I am listening". | 
2026-10-31 | walk-056h-2026-10-31 | #303 09246740 | (Hypha to fill). unknown | 
2026-10-31 | walk-057-snowflake-2026-10-31 | #305 0ff247e5 | HOLD | 
2026-10-31 | walk-057c-2026-10-31 | #305 eb5a080a | PASS (re-check of both 057 HOLDs), 2026-10-31 | 
2026-10-31 | walk-057d-2026-10-31 | #307 bfd52f4f | (Hypha to fill). unknown | 
2026-11-01 | walk-061a-2026-11-01 | #310 7f5700e4 | HOLD | 
2026-11-02 | walk-061a-rewalk-2026-11-02 | #310 head bb1d2a41 | (Hypha to fill). unknown | 
2026-11-02 | walk-062a-2026-11-02 | #313 head 1087e241 | HOLD | 
2026-11-02 | walk-062b-2026-11-02 | #313 head 18d5d2e3 | HOLD #317 PASS. | 
2026-11-03 | walk-062c-2026-11-03 |  | Verdict: HOLD (#313: 1 safety gap + 1 lock without approval). #321 PASS. | 
2026-11-03 | walk-062d-2026-11-03 |  | Verdict: PASS on safety (the 062c HOLD is fixed). Process items are soft. YES on snowflake-core 46b215d5 is honest, with one soft (resurrect on concurrent delete). | 
2026-11-02 | walk-063a-2026-11-02 | #315 head e88be538 | HOLD #316 PASS. | 
2026-11-02 | walk-063b-2026-11-02 | #315 head aef470e2 | Verdict: HOLD. #318 PASS. | 
2026-11-02 | walk-063c-2026-11-02 | FL #315 edac2e27, page #318 f283851f | walk-063c-2026-11-02: PASS (safety), with softs. | 
2026-11-03 | walk-065a-2026-11-03 |  | VERDICT: HOLD (records only, on #319). The code is safe; #320 PASS. | 
