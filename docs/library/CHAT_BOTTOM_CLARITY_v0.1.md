# Chat bottom clarity v0.1

Plain list of the controls under Chat. The jobs are the ones already on the page. This brick gives each one a word and puts the add-ons in one menu.

Design: `docs/library/VISUAL_BEAUTY_CARD_ICONS_v0.vision.md` (soft object, one Garden breath at about 1.06 scale and a gold tide, Foxfire night, Kirk gold, celestial azure). Tokens are the Garden Twilight variables on `:root` in `docs/app.html`: `--bg-card`, `--bg-input`, `--border`, `--border-focus`, `--accent`, `--accent-soft`, `--accent-glow`, `--text-primary`, `--text-secondary`, `--text-muted`, `--success`, `--radius`, `--radius-sm`, `--shadow`, `--font`, `--font-sm`, `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--transition`, `--transition-md`.

## Composer

| Word | Where | Handler |
| --- | --- | --- |
| + Add | `#flChatAddBtn` in the composer row | Opens `#flChatAddMenu` |
| Say something... | `#chatInput` | `handleChatKeydown` (unchanged) |
| Just me | `[data-honest-just]`, still in the composer row | `FLPoolHonest` armJust (unchanged). Title: Just me: keep this chat on this device, never ask the pool |
| Send | `#sendBtn` | `sendMessage` (unchanged, same size) |

## Add menu

Opens upward from +. Escape and a tap outside close it. Focus returns to +.

| Order | Word | Handler | Old id |
| --- | --- | --- | --- |
| 1 | Bring from Google Drive. Sub-line: Give the mind a document from your Drive | `flOpenDrivePicker` | `#chatDriveBtn` moved into the menu |
| 2 | Attach a file or photo | `flAttachFile` | `#chatAttachBtn` moved into the menu |
| 3 | Take a photo | same attach path, hidden `#flChatCameraInput` | Shown only on a touch device where capture is supported |
| 4 | Scan a folder | `flScanFolder` | `#chatScanFolderBtn` moved into the menu |
| 5 | Speak | `toggleVoiceInput` | Shown only while `#micBtn` is shown |
| 6 | Make a picture | `handleImageGenClick` | `#imgGenBtn` stays in the older popup |
| 7 | Search the web: on/off | clicks `#flChatSearchToggle` | The Search on row stays visible in chat |

Deep research is not on this page. The menu has no item for it. That is a later ask.

Take a photo stays out when the browser does not expose capture on a file input. The browser used for this challenge does not, so that row is absent here and present on a browser that does.

`#chatOverflowBtn` (More) stays. A tap also opens this same menu. `#micBtn` and `#imgGenBtn` stay in `#chatOverflowPopup`.

## Status line

Under the composer, one calm line: the model dot and name (`#modelSwitcherWrap`), the Box field (`#flBoxPointer`, `#flBoxPointerInput`), and Version. Get the newest (`#flChatUpdateRow`). Search on stays in `#flChatSearchRow`, said once, with its live line `#flChatSearchLive`.

Box title and label: Your computer's AI address (optional). A focus line says it stays on this device.

## Pills

One row, `#flChatPillRow`, in this order: Connect (`#fl-connect-play-toggle`), Feel (`#chatPresenceToggle`), Market (`#chatMarketToggle`), Clay (`#fl-clay-pill`). Same handlers as before. Clay's title is Clay: let the mind shape light here.

Let your mind shape light? stays on its own line in `#fl-clay-dock`. Yes and Not now use the house pill. Yes uses the soft gold fill. The handlers are unchanged.

## Corners

Not moved. Hover or focus shows a word. Radio: calm background tones (`#flRadioFab`). Quick help (`#quickHelpBtn`). Ambient music (`#musicToggle`). At a narrow window they sit higher so they do not cover Send.

## A document handed back

Marker `v-chat-doc-return-v0.1`. Module `docs/modules/chat-doc-return.js`.

A mind reply that contains `[FL_FILE: name.md]` then the text then `[/FL_FILE]` shows one card under that message: file icon, name, type, size, Save as PDF, Save as MD, Save as TXT. The save stays on this computer (a Blob and an object URL). PDF is a small text PDF written in the module. No new dependency.

Save to my Drive appears only when Google sign-in from the existing Drive picker is already on. It asks Send this file to your Google Drive? Yes / Not now. Nothing is sent before Yes.

Quiet when the reply has no document.

Before and after pictures at 1280 and 390 are in `docs/library/chat-bottom-055/`.
