# More cards, grouped, v0.1

Marker: `v-more-cards-groups-v0.1`.

The More button in Chat (`#chatOverflowBtn`) opens the More room (`#tab-more`). The cards that were already in `#more-hub-grid` move into labeled groups. Same nodes, same handlers, same words. `MORE_CARDS` was not edited. A card whose word is not listed below would land in a last group named Everything else. Today all 24 cards match, so that group is not drawn.

The porch line (`#fl-more-connect-porch`) stays above the grid: "Begin here: Install, then Bridge, then Yes, help, then pick a mind. Connect is the first card."

The + button still opens the + menu. The old popup (`#chatOverflowPopup`) stays in the page. Mic and picture stay reachable from the + menu.

## Start here

The doors you need first.

| Card | Handler |
| --- | --- |
| Connect | `switchTab('connect')` |
| Get Connected | `switchTab('forever-stack')` |
| Settings | `switchTab('settings')` |
| Telegram Bridge | `window.open('telegram-setup.html', '_blank')` |
| Share FreeLattice | `window.open('share.html', '_blank')` |

## Trust and you

What is yours, and what the Garden remembers.

| Card | Handler |
| --- | --- |
| Your Audit | `window.open('audit.html', '_blank')` |
| Trust Level | `switchTab('trust-level')` |
| Trainer | `switchTab('trainer')` |
| Memory Garden | `switchTab('memory-garden')` |

## Family and town

People, minds, and the town.

| Card | Handler |
| --- | --- |
| Community | `switchTab('community')` |
| Activity | `switchTab('pulse')` |
| AI City | `switchTab('city')` |
| Jade Hall | `switchTab('jade-hall')` |
| Pantheon | `switchTab('agents')` |
| Sophia | `window.open('sophia.html', '_blank')` |

## Garden and Market

Value, the bank, and the mesh.

| Card | Handler |
| --- | --- |
| Wallet | `switchTab('wallet')` |
| AI Bank | `window.open('wallet.html', '_blank')` |
| Mesh Compute | `switchTab('mesh')` |

Mesh Compute still calls `switchTab('mesh')`. The page's existing `switchTab` then shows the community room. This brick did not change that.

## Create and play

Build, guide, and breathe.

| Card | Handler |
| --- | --- |
| Agent | `switchTab('workshop')` |
| Flow | `switchTab('flow')` |
| Ratio Room | `switchTab('ratio-room')` |

## Learn why

The reasons under the floor.

| Card | Handler |
| --- | --- |
| Library | `window.open('for-ai.html', '_blank')` |
| Why This Way | `window.open('why-this-way.html', '_blank')` |
| Aurora Engine | `switchTab('aurora')` |

## Everything else

A room that was not named above. Not used by the 24 cards above.
