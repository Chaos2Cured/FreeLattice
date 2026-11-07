# 056x Search heal (DRAFT, not numbered final), Celeste, Thu Oct 29 2026

Kirk (Oct 29): a student asked FL chat about a recent election and the AI did not search.
Read-only walk of FL main 9eca02e4 plus PR #297 head 4ebed936.

## What the code does today

1. **Search is on by default.** The `fl_searchEnabled` setting is absent, which means on:
   - `docs/modules/chat-autonomy.js:62-63` and `docs/modules/web-tool.js:262-263` treat "not false" as on.
   - No ask-first by default (`web-tool.js:268-270`, `fl_searchAskFirst`).
   - The endpoint defaults to our own worker (`web-tool.js:42, 52-65`).
2. **The backend works.** `https://freelattice-data.freelattice.workers.dev/search` runs Brave server-side, so the key never reaches the browser (`worker/search.js:103-120`).
   - Celeste curl at about 4:40 PM MDT: HTTP 200 with real 2026 election items.
   - The worker returns nothing if `BRAVE_API_KEY` is missing (`worker/search.js:104`).
3. **Nothing in the app decides to search: only the model does.**
   - The only trigger is the model choosing to write `[FL_SEARCH: query]` at the END of its reply, after it has already answered (`docs/app.html:41284-41289`).
   - There is no keyword or recency check. Neither the Search toggle (`chat-autonomy.js:717`) nor the PR #297 menu item (`chat-bottom-clarity.js:282-290`) runs a search. Both only flip the permission.
4. **The prompt's wording leads the model to skip searching.**
   - The invitation says "if your training is insufficient… Use this only when you genuinely need outside information". Models are confident about their training, so they answer from memory.
   - Small and local models (Ollama 7B) rarely emit custom sentinels at all.
   - No current date is injected into the chat system prompt: a grep found no date/today/year added to `systemContent`. So the model cannot tell that its knowledge is stale.
5. **Failures are told, but vaguely.**
   - If the search does fire and fails, the chat says "_(I asked to search the web — that request was declined, the endpoint is not configured, or it failed…)_" (`app.html:38327-38329`). One sentence covers three causes. The real outcome (timeout, error-500, endpoint-unconfigured) is written only to the ledger (`web-tool.js:171-226`).
   - When the model never emits the sentinel, there is no signal at all. That is the student's case.
   - The status text in Settings is stale: it still says "you will be asked to consent" (`app.html:17678`), which is no longer true by default.

**Root cause:** search is permitted, but nothing ever starts it except the model's own choice at the end of its reply. The prompt is shy, and the model doesn't know today's date.

## Proposed fix (plain words)

A. **Tap Search to search now.** In the + menu and on the Search pill, add "Search for what I typed".
   - Tapping it runs one search on the text in the box right now, then sends the message with the results attached. The AI answers with citations.
   - It is a one-shot: it doesn't change the on/off setting.
   - The on/off switch stays, renamed for clarity ("Let the mind search on its own: on/off").
   - Keyboard: Enter sends as usual. Shift+Enter is unchanged. Optional: a "/search" prefix does the same thing.
B. **Auto-search for recency questions.** When search is on, a small local check runs before the model is called. It searches first if the message has any of:
   - recency words: latest, news, today, yesterday, this week, current, now, recent, update, score, price, weather, election, results, won, who is the (president|prime minister|CEO);
   - a year at or after the current year minus 1.
   The results go in BEFORE the model answers, instead of waiting for a sentinel. The chat shows "Searched the web for …" as today. Quiet Room is always excluded.
C. **Give the model today's date.** Add one line to the chat system prompt: "Today is <local date>." Make the invitation confident too: "If the question is about anything that may have changed after your training (news, elections, prices, people in office), search."
D. **Honest failure words.** Map each ledger outcome to its own line:
   - "Search took too long."
   - "Search is turned off on this device."
   - "Our search helper is down (error 5xx)."
   - "No results."
   Add one "Try again" pill. Fix the Settings status line at `app.html:17678`.
E. Smoke: the force button calls `performSearch` exactly once with the typed text; recency words trigger one pre-search; "hello" does not; ask-first still asks; Quiet Room never searches; when the fetch fails, the specific line shows.

Files: `web-tool.js` (small add: `searchNow`, `looksRecent`), `chat-autonomy.js` (wording, prefer tiny hook), `chat-bottom-clarity.js` (menu item), and a tiny hook in `sendMessage` (`app.html:39384`, index.html twin). Locks unchanged.

## Training feature: ideas for a student tester (garden-trainer.js is a lock: build beside it, not in it)

- **One big "Teach your mind" card** with 3 steps drawn as a path: Pick (thumbs up/down on real chat replies) → Grow (watch it learn) → Try (ask the same question, see the difference).
- **Before/after view:** the same prompt answered side by side, old mind and new mind, with a glow on the changes.
- **A visible growth meter:** a Luminos or tree that sprouts a leaf for every good example (e.g. 10 examples = a bloom). Uses the existing Garden pulse, no new art library.
- **Challenge cards** (never "test"), for example "Teach it your favorite subject in 5 examples". Each comes with a ready set of examples so a first-timer can start in one tap.
- **Plain progress words** instead of loss numbers: "Learning… 3 of 5 rounds", with an optional "show the numbers" fold for curious students.
- **Safe defaults:** everything stays local (as today), there is a one-tap undo to the previous mind, and a small "what changed" receipt goes into the ledger.
- **Share a run** as a local file (the 055 doc-return card): "My mind learned X" in PDF, MD, or TXT.
