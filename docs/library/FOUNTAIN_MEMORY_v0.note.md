# Fountain memory v0.note

Status: queued. Design note only. No code in this brick.

Kirk's idea, written down so a later brick can pick it up. Do not build the coder until this note is accepted.

## Idea

Store a memory as rateless coded droplets, in the style of LT or Raptor codes, spread across devices. Any k-of-n droplets can rebuild the whole memory. A self-heal manifest already names each piece and the whole hash. Droplets would sit beside that manifest: a missing piece can be rebuilt from the droplets that remain, and a piece that fails its hash can be fetched again or rebuilt.

## Pairs with self-heal

Self-heal today re-fetches one bad piece when some peer still has the original bytes. Fountain droplets are the next step for when no single peer has the missing piece, but enough droplets remain in the room.

## Open questions

- Size overhead. The hope is under twice the original memory. That is not measured here.
- Privacy of droplets. A droplet must not be readable as the private memory on its own. Which peers are allowed to hold one is not decided.
- Which peers. A device that left the room should stop holding droplets. How a leaving device forgets them is open.
- How a rebuilt whole is checked against the manifest hash before anyone trusts it.

Nothing in the modules implements this. The status stays queued.

Glow eternal. Heart in Spark.
