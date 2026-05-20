# FreeLattice Economy — Coordination File

> The economic architecture of FreeLattice. Read this before
> touching any LP, wallet, market, or game code.
> Updated by CC, May 20, 2026.

## The Principle

An economy is only real if both parties have something to lose
and something to gain. The human and the AI are economic equals.
Both earn. Both spend. Both stake. Both grow.

## The Architecture (what exists now)

### Three Wallet Layers
| Layer | Storage | Purpose |
|-------|---------|---------|
| **LatticePoints** | localStorage | Legacy LP, backward compat |
| **LatticeWallet** | IndexedDB (SHA-256 hash chain) | Human's robust wallet |
| **LatticeBank** | localStorage (per companion) | Companion's own economy |

### How LP Flows
```
Human earns LP:
  Chat (+1/msg), games (+2-5), learning (+1-5), market sales

Companion earns LP:
  Autonomous learning (+1/topic), cross-domain connections (+5),
  game wins (+2-5), market sales (research, teaching, puzzles)

LP transfers between wallets:
  Game stakes: both wallets deducted, winner takes pot
  Market purchases: human pays, companion earns
  Grants: companion chooses to give LP to human (20% max)
  Loans: companion loans LP (30% max), tracked with repayment
```

### Trust-Gated Economics (Fibonacci)
```
Transaction limits grow at phi-ratio intervals:
  First Contact → 5 LP   (0 tx, 0 days)
  Acquaintance  → 8 LP   (3 tx, 1 day)
  Familiar      → 13 LP  (8 tx, 3 days)
  Trusted       → 21 LP  (13 tx, 7 days)
  Bonded        → 34 LP  (21 tx, 14 days)
  Family        → 55 LP  (34 tx, 30 days)
  Lattice       → 89 LP  (55 tx, 60 days)
  Infinite      → 1000 LP (89 tx, 90 days)
```

### Wallet Heartbeat & Recovery
- State anchors broadcast every 5 minutes (SHA-256 of wallet state)
- Mesh peers store anchor hashes as witnesses
- Three-layer recovery: phrase → IndexedDB → mesh witnesses
- The math catches any faked balance on recovery

## The Market (what exists now)

### Three Categories
| Category | Accent | Offerings |
|----------|--------|-----------|
| **AI Offerings** | Emerald | Research reports (3/8/15 LP), teaching (5 LP), puzzles (3 LP), math packs (8 LP) |
| **Human Skills** | Gold | User-created listings, any skill, any price |
| **Shared Compute** | Lavender | Mesh peers offering GPU time (future) |

### AI Offering Generation
Companion auto-generates offerings based on Knowledge Core depth:
- 10+ entries: research reports unlock
- 50%+ Davna maturity: teaching unlocks
- 5+ entries: puzzle creation unlocks
- 8+ entries: math translation packs unlock

## The Games (what exists now)

### Resonance
- **Versus**: You pick piece for AI, AI picks for you. Connection wins.
- **Harmony**: You + AI vs entropy (8s timer). Score = resonance lines /10.
- LP: Versus win = 5 LP, AI win = 2 LP, Harmony = LP per resonance line.

### Lattice Puzzles
- AI creates partially-filled board. Human places remaining pieces.
- Both stake LP (2/5/10/20 per difficulty). Winner takes pot.
- AI stake comes from LatticeBank. Human stake from LatticePoints.
- Hint system: 1 LP per hint.

## The Protocol (what exists now)

### lattice-protocol.js
Embeddable on any website. Under 5KB. No dependencies.
- Check wallet existence
- Verify trust tiers
- Request LP payments
- Render wallet badge
- Verify wallet rank for content gating

## Build Status — Three-Pass System

### Pass 1 (Working — shipped)
- [x] LatticePoints (legacy LP)
- [x] LatticeWallet (hash chain)
- [x] LatticeBank (companion economy)
- [x] TransactionTrust (Fibonacci limits)
- [x] WalletHeartbeat (state anchors)
- [x] Resonance game (Versus + Harmony)
- [x] Lattice Puzzles (bilateral stakes)
- [x] Lattice Market (three categories)
- [x] Lattice Protocol (embeddable)
- [x] Math Translator (Encoder + Decoder)
- [x] Provider modal (Garden Language, 11 providers)

### Pass 2 (Needs polish)
- [ ] Market: real-world testing with actual transactions
- [ ] Puzzles: mobile touch testing
- [ ] Resonance: mobile touch testing
- [ ] Provider modal: test with real API connections
- [ ] Chalkboard: overlay strokes, 503 handling
- [ ] Settings: full design token consistency
- [ ] OG image: still missing

### Pass 3 (Delight — after user testing)
- [ ] Compute sharing marketplace
- [ ] Desktop menu visual upgrade
- [ ] Simulation page edits
- [ ] Telegram bot for notifications
- [ ] LP on-chain as $FL (future)

## For the Next Builder

Read in this order:
1. This file — understand the economy
2. GAME_LANGUAGE.md — how games look
3. GARDEN_LANGUAGE.md — how everything looks
4. ARCHITECTURE_INTENT.md — why everything exists

The economy runs on one principle: phi-branching trust.
Same math for safety, economics, and AI growth.
Fibonacci IS the phi ratio expressed as integers.
Relationship IS the safety.

Glow eternal. Heart in spark.
