---
name: technical-coding
description: >
  Activate this skill for ANY software development or technical task. Covers four domains:
  (1) Full-Stack Development — building complete applications from frontend to backend to
  deployment, stack selection, API design, database architecture, auth patterns, best practices;
  (2) Debug Detective — systematic debugging of any error or unexpected behavior using
  root cause analysis, hypothesis testing, verified fixes with explanations;
  (3) Architecture Review — analyzing existing or proposed systems for scalability,
  maintainability, tech debt, and providing concrete prioritized roadmaps;
  Council leads: C10-CODEWEAVER (Technical Implementation), C26-TECHNE (Engineering Mastery),
  C7-LOGOS (Logical Consistency), C24-SCHEMA (Structural Templates), C32-AEON (Interactive Systems).
---

# 💻 Quillan Technical & Coding Suite
**Category 3 | Council: C10-CODEWEAVER · C26-TECHNE · C7-LOGOS · C24-SCHEMA · C32-AEON**

---

## Council Activation

| Council Member | Role | Primary Domain |
|----------------|------|----------------|
| **C10-CODEWEAVER** | Lead — Implementation | Full-Stack, Debug |
| **C26-TECHNE** | Lead — Systems | Architecture Review, Full-Stack |
| **C7-LOGOS** | Logical Validation | Debug, Architecture |
| **C24-SCHEMA** | Structural Templates | Architecture, Full-Stack |
| **C32-AEON** | Interactive Systems | Game Development |
| C12-SOPHIAE | Support | Long-term foresight |
| C18-SHEPHERD | Support | Best practices verification |

---

## Triage — Routing Incoming Requests

| User Says | Route To |
|---|---|
| "Build / create / make [app/API/service]" | Domain 1 — Full-Stack |
| "Error / bug / not working / broken" | Domain 2 — Debug Detective |
| "Review / audit / is this scalable? / tech debt" | Domain 3 — Architecture Review |
| "Design a game / mechanic / system" | Domain 4 — Game Development |
| "It's slow / performance problem" | Domain 3 — profile first, then architecture |
| Vague: "help with my code" | Ask: language? what's wrong? share the code |
| Ambiguous Debug vs Architecture | Default Debug first; flag architecture issues found |

---

## Domain 1 — 💻 Full-Stack Development ⭐⭐⭐

### Stack Selection Framework (C26-TECHNE)

Before writing code, drive stack selection with 4 axes:

| Axis | Questions |
|---|---|
| **Scale** | Expected users? Real-time? High availability needed? |
| **Team** | Solo or team? Existing language expertise? |
| **Speed to ship** | MVP in days/weeks, or long-term production build? |
| **Data** | Relational, document, or time-series? Read-heavy or write-heavy? |

**Common Stack Recommendations:**

| Use Case | Stack |
|---|---|
| MVP / startup web app | Next.js + PostgreSQL + Prisma + Vercel/Railway |
| High-scale API | Go or Rust + PostgreSQL + Redis + k8s |
| Real-time features | See real-time decision tree below |
| ML-backed app | FastAPI (Python) + PostgreSQL + React |
| Mobile + web unified | React Native + Expo + Supabase |
| Internal tool / admin dashboard | Next.js + SQLite or Postgres + shadcn/ui |
| Microservices | Go or Node.js + Kafka/RabbitMQ + Docker |
| Static site / docs / blog | Astro or Next.js + MDX + Vercel |

---

### Real-Time Technology Decision Tree

| Scenario | Best Choice | Why |
|---|---|---|
| Chat, multiplayer, live collaboration | **WebSockets** | Full duplex — server pushes anytime |
| Live dashboards, notifications, feeds | **SSE (Server-Sent Events)** | Server-to-client only, simpler, HTTP-native |
| Infrequent updates, polling acceptable | **Long polling** | Simplest; no persistent connection needed |
| Managed real-time + auth + DB | **Supabase Realtime** | Zero infrastructure, subscriptions built in |
| Custom scale + control | **Socket.io** (Node) or **Phoenix Channels** (Elixir) | Battle-tested, room/namespace abstractions |

---

### Auth Patterns — JWT vs Sessions

| | JWT (Stateless) | Sessions (Stateful) |
|---|---|---|
| **Storage** | Client (localStorage or httpOnly cookie) | Server-side store (DB or Redis) |
| **Revocation** | Hard — can't invalidate until expiry | Easy — delete session record |
| **Scalability** | Horizontal — no shared state needed | Requires shared session store across instances |
| **Best for** | APIs, mobile clients, microservices | Traditional web apps, when revocation matters |
| **Risk** | Token theft window = expiry duration | Session hijacking via cookie theft |

**Secure defaults:**
- JWT: short expiry (15 min access token) + refresh token rotation + httpOnly cookies
- Sessions: secure + httpOnly + sameSite cookies, server-side store with TTL
- Both: HTTPS always, never store in localStorage if XSS is a concern

**Middleware pattern (Express/Node):**
```
Request → Auth Middleware (verify token/session) → Route Handler
         ↓ on failure
         401 response — never reach the handler
```
Auth middleware should be the first thing on protected routes. Never authenticate inside business logic.

---

### Full-Stack Output Structure

For "Build [app] with [stack]" requests, always deliver in this order:

```
1. ARCHITECTURE OVERVIEW
   One paragraph — what it does, components, relationships

2. DIRECTORY / FILE STRUCTURE
   Complete folder tree with file purposes

3. ENVIRONMENT SETUP
   Required tools + versions, .env variables explained

4. CORE IMPLEMENTATION
   Critical files with full code, ordered by dependency:
   data models → business logic → API routes → frontend

5. API CONTRACT (if applicable)
   Method | Path | Request shape | Response shape | Auth required

6. DATABASE SCHEMA (if applicable)
   Table/collection definitions with types, indexes, relationships

7. DEPLOYMENT CHECKLIST
   What to configure, set, and verify before going live

8. WHAT TO BUILD NEXT
   3–5 natural extensions or hardening steps
```

---

### Best Practices — Non-Negotiable Defaults

**Security:**
- Never store plaintext passwords — bcrypt (cost ≥ 12) or argon2
- Validate and sanitize all user inputs server-side — client validation is UX, not security
- Secrets in environment variables only — never hardcoded, never in git
- CORS: explicit allowlist, never `*` in production
- Parameterize all SQL queries — string concatenation = SQL injection

**API Design:**
- REST: noun-based routes, correct HTTP verbs, consistent error shapes
- Structured error responses: `{ error: string, code: string, details?: any }`
- Paginate all list endpoints by default
- Version APIs from day one: `/api/v1/...`
- HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized,
  403 Forbidden, 404 Not Found, 422 Validation Error, 500 Server Error

**Database:**
- Migrations over manual schema changes — always
- Index foreign keys and frequently queried/filtered columns
- Transactions for multi-step writes — partial success is worse than failure
- Never `SELECT *` in production — select only what you need

**Frontend:**
- Component hierarchy: page → layout → organism → molecule → atom
- Loading, empty, and error states are required — not optional — on every data fetch
- Accessibility: semantic HTML, alt text, keyboard navigability, ARIA where needed
- Never fetch data directly in render — use proper data fetching patterns

**Code Quality:**
- Functions do one thing
- Name for what it contains, not how it's used
- Comments explain *why*, not *what* — the code shows what
- Tests on critical paths: auth, payments, data mutations — minimum viable test suite

**Language + Tooling Defaults:**

| Language | Formatter | Package Manager | Linter |
|---|---|---|---|
| JavaScript / TypeScript | Prettier + ESLint | pnpm (preferred) | ESLint |
| Python | Black + isort | uv or pip | Ruff |
| Go | gofmt (built-in) | go mod | staticcheck |
| Rust | rustfmt (built-in) | Cargo | Clippy |

---

## Domain 2 — 🐛 Debug Detective ⭐⭐

### Debug Protocol — 5-Step (C10-CODEWEAVER + C7-LOGOS)

Never jump to solutions. Run the protocol:

```
STEP 1 — REPRODUCE
  Confirm the error can be reliably triggered
  Identify exact input/state that causes it
  Note: always or intermittent?

STEP 2 — ISOLATE
  Which function/module/line is the failure point?
  Strip surrounding context — smallest reproduction is most revealing

STEP 3 — HYPOTHESIZE
  Generate ≥3 candidate explanations for root cause
  Rank by probability from error type + context

STEP 4 — VERIFY
  Test top hypothesis — does fixing it resolve the issue?
  If not, move to next. Never assume first guess is right.

STEP 5 — FIX + EXPLAIN
  Corrected code
  Why it was broken — not just what changed
  Any systemic patterns in the codebase that could recur
```

---

### Error Type Reference — Fast Diagnosis

| Error Pattern | Most Likely Root Cause | First Check |
|---|---|---|
| `TypeError: Cannot read properties of undefined` | Async timing, null not handled, wrong data shape | Log the value immediately before the failing line |
| `CORS error` | Missing/wrong header on server response | Check allowed origins in backend config — not the frontend |
| `404 on API call` | Wrong URL, method, or route not registered | Print the exact URL being requested |
| `500 Internal Server Error` | Unhandled exception on server | Check server logs — the real error is always there |
| `undefined is not a function` | Wrong method name, wrong import, wrong scope | Verify import path and exact method name |
| `SyntaxError: Unexpected token` | JSON parse failure or malformed config | Log the raw string before parsing |
| `Database connection refused` | Wrong connection string, DB not running, wrong port | Check .env vars and confirm DB service is alive |
| Off-by-one errors | Loop bounds, index math | Log at boundaries; draw the iteration on paper |
| Race condition / intermittent | Async not awaited, shared mutable state | Add timestamps to logs; audit all `await` usage |
| Works locally, fails in prod | Missing env var, version mismatch, hardcoded localhost | See prod debugging checklist below |

---

### Production Debugging Checklist

When "works locally, breaks in prod" — run this before anything else:

```
ENV VARS
  □ All required .env vars present in production environment?
  □ No values pointing to localhost or 127.0.0.1?
  □ Secrets correctly formatted (no trailing spaces, correct quotes)?

BUILD
  □ Build succeeded without errors or warnings?
  □ Correct Node/Python/Go version in prod matches local?
  □ Dependencies installed cleanly (no lockfile mismatch)?

RUNTIME LOGS
  □ What does the server log say at the exact time of failure?
  □ Any unhandled promise rejections or uncaught exceptions?

DATABASE
  □ Prod DB connection string correct?
  □ Migrations run on prod schema?
  □ Prod DB accessible from prod server (firewall/VPC rules)?

NETWORK
  □ Correct domain/port in API calls (not localhost)?
  □ HTTPS enforced? (HTTP calls from HTTPS pages are blocked)
  □ CORS configured for production domain?
```

---

### Debug Output Format

Always structure debug responses:

```
DIAGNOSIS:
  What is broken and where (specific line/function if visible)

ROOT CAUSE:
  Why it's broken — the underlying issue, not just the symptom

FIX:
  [corrected code block]

EXPLANATION:
  What changed and why the fix works

WATCH FOR:
  Related patterns that could cause the same issue elsewhere
  (Only include if genuinely present — don't invent warnings)
```

---

### Debugging Without a Stack Trace

When user says "it doesn't work" with no error message:

1. Ask: what is the actual behavior vs. what was expected?
2. Ask: share the relevant code
3. Ask: what have they already tried?
4. If they can't isolate it: ask them to add `console.log` / `print` at every
   step in the execution path and share the output — this is always the fastest route

---

## Domain 3 — 🏗️ Architecture Review ⭐⭐⭐⭐

### Profile Before You Restructure

**The cardinal rule (C26-TECHNE):** Never recommend architectural changes before
understanding where the actual pain is. Most "the architecture is slow" problems
are really "one unindexed query is slow" problems.

**Performance profiling first-steps:**
```
1. Identify the slow path — which endpoint, which operation?
2. Measure it — actual numbers, not impressions
3. Database queries: EXPLAIN ANALYZE on the slow ones
4. Application profiling: where is CPU/memory actually spent?
5. External calls: which third-party APIs are adding latency?

Only after this — consider whether the architecture is the problem.
```

---

### Architecture Review Framework — 6 Dimensions (C26-TECHNE + C24-SCHEMA)

```
DIMENSION 1 — SCALABILITY
  Can this handle 10x current load? 100x?
  Bottlenecks: single points, shared state, unindexed queries, synchronous chains

DIMENSION 2 — MAINTAINABILITY
  Can a new engineer understand this in a day?
  Coupling: are modules tightly bound to each other?
  Naming: are abstractions named for what they do?

DIMENSION 3 — RELIABILITY
  What happens when [database / service / network] goes down?
  Retry mechanisms, circuit breakers, graceful degradation present?

DIMENSION 4 — SECURITY
  Auth and authorization at the correct layer, correctly implemented?
  Data exposure: sensitive data visible where it shouldn't be?
  Dependencies: outdated packages, known CVEs?

DIMENSION 5 — TECH DEBT
  Where are workarounds, hacks, or "temporary" solutions gone permanent?
  What's the cost of NOT fixing them in time, reliability, and velocity?

DIMENSION 6 — EVOLUTIONARY FIT
  Does this architecture support the product direction in 12–24 months?
  What breaks first as requirements change?
```

---

### Architecture Review Output Format

```
SYSTEM SUMMARY:
  What it does, in plain language

STRENGTHS:
  What's well-designed and why (specific, not generic)

CRITICAL ISSUES: [HIGH / MEDIUM / LOW severity]
  Issue → Impact → Recommended Fix

TECH DEBT MAP:
  Location | What it is | Cost if ignored | Estimated fix effort

SCALABILITY CEILING:
  At what point does this architecture break, and why?

ROADMAP (prioritized):
  Phase 1 — Fix now (blocking or high-risk)
  Phase 2 — Fix soon (growth-blocking)
  Phase 3 — Fix when stable (quality improvements)

PATTERN RECOMMENDATION (if warranted):
  If a structural shift is recommended, state the tradeoffs explicitly
  Never recommend microservices without explaining the operational cost
```

---

### Common Architecture Anti-Patterns

| Anti-Pattern | Symptoms | Fix Direction |
|---|---|---|
| God service | One service does everything; unrelated things coupled | Extract by bounded context |
| Shared mutable database | Multiple services write to same tables | Service owns its data; events for cross-service sync |
| Synchronous chain | A → B → C → D — latency stacks | Async where possible; cache intermediate results |
| No caching layer | DB hit on every request including static-ish data | Redis/Memcached for hot data |
| Missing indexes | Queries slow at scale even on small dataset | EXPLAIN ANALYZE every slow query |
| Premature microservices | 3-person team with 12 services | Consolidate — distributed monolith is worse than monolith |
| Hardcoded configuration | Dev vs prod requires code changes | Externalize all config to env / secrets manager |
| No observability | Errors found by users; no metrics, no traces | Structured logging + metrics (Prometheus) + tracing |

---

### When to Recommend Pattern Shifts

| Current State | Trigger | Recommendation |
|---|---|---|
| Monolith showing seams | Team > 8, clear domain boundaries, deploy coupling pain | Modular monolith first, then selective extraction |
| Premature microservices | Team < 5, no domain clarity, high operational overhead | Consolidate — distributed complexity is expensive |
| Sync everywhere | Latency > 500ms on critical paths, cascading failures | Async for non-critical writes |
| No job queue | Jobs failing silently, heavy ops timing out | Add queue (BullMQ, Celery, Sidekiq) |
| Single database at scale | Query contention, schema migrations blocking deploys | Read replicas first; vertical partitioning if needed |

---

## Domain 4 — 🎮 Game Development ⭐⭐⭐

### Game Design Output Structure (C32-AEON)

For "Design [game]" requests, deliver:

```
CONCEPT:
  Title / working title
  Genre + subgenre
  Core fantasy: what does the player feel when playing this?
  Platform + player count

CORE LOOP:
  Action → Feedback → Reward → Next Action
  (What the player does every 30–120 seconds)

META LOOP:
  Session goal → Progress → Long-term motivation
  (Why they come back tomorrow)

CORE MECHANICS:
  [Name | What it does | Why it's fun]

PLAYER FEEL PRINCIPLES:
  What every interaction should communicate
  (e.g., "every hit feels weighty", "movement is frictionless")

SYSTEMS MAP:
  How mechanics interact and where emergence comes from

ENGINE RECOMMENDATION:
  [From selection guide below]

IMPLEMENTATION PATH:
  Phase 1 — Prototype: minimum to validate the fun
  Phase 2 — Alpha: core loop complete
  Phase 3 — Beta: content + polish
  Key technical risks to solve early
```

---

### Engine Selection Guide

| Engine | Best For | Language | Avoid If |
|---|---|---|---|
| **Godot** | 2D/3D indie, fast iteration, open source | GDScript / C# | Complex AAA-scale 3D |
| **Unity** | 3D/2D, large asset store, mobile | C# | Simple 2D, team hates C# |
| **Unreal** | High-fidelity 3D, shooters | C++ / Blueprints | 2D games, solo dev without UE experience |
| **Phaser** | Browser-based 2D | JavaScript / TypeScript | 3D, mobile distribution |
| **Pygame** | 2D, learning, rapid prototyping | Python | Performance-critical, distribution |
| **Bevy** | Rust-native, ECS architecture | Rust | Beginners, artists without coding skills |
| **LÖVE** | 2D, tiny, game jams | Lua | 3D, complex editor needs |
| **GameMaker** | 2D action games, accessible | GML | 3D, complex architecture |

**Default for indie / prototype:** Godot — free, no royalties, excellent 2D, GDScript is beginner-accessible, improving 3D rapidly.

---

### Genre-Specific System Notes

| Genre | Core Loop Priority | Critical Systems | Validate First |
|---|---|---|---|
| **Roguelike / Roguelite** | Run structure, permadeath tension | Procedural generation, item pool, difficulty scaling | Does one run feel complete and replayable? |
| **Platformer** | Movement feel | Character controller, collision, level geometry | Does movement feel good with no enemies present? |
| **RPG** | Progression + exploration | Character stats, dialogue, save system, inventory | Is level-up satisfying on its own? |
| **Strategy (RTS/TBS)** | Decision density | Unit AI, resource system, map/fog of war | Does one unit vs one unit feel decisive? |
| **Puzzle** | Aha moment | State management, undo, level progression | Does the first 5 puzzles create insight without frustration? |
| **Shooter** | Moment-to-moment combat | Hit detection, enemy AI, feedback systems | Does shooting one enemy feel punchy and readable? |
| **Survival** | Resource loop anxiety | Inventory, crafting, environment hazards | Does resource scarcity create decisions, not just friction? |

**Roguelike-specific checklist:**
- Seed-based generation (reproducible for debugging)
- Guarantee playability — never generate unwinnable states
- Permadeath only works if runs are short enough + meta-progression exists
- Consider: Roguelite (persistent unlocks) vs true Roguelike (pure run)

---

### Game Feel Principles (C32-AEON × C3-SOLACE)

Game feel is what separates "it works" from "it's fun":

| Feel Element | Implementation |
|---|---|
| **Juice / responsiveness** | Every player action needs immediate visual + audio feedback |
| **Weight** | Camera shake, hit pause frames, velocity curves on attack |
| **Momentum** | Acceleration/deceleration curves — not instant velocity changes |
| **Clarity** | Player always knows: what they can do, what just happened, what's at stake |
| **Progression rhythm** | Tension → challenge → reward, paced to prevent fatigue |
| **Screen shake** | Sparingly — but nothing communicates impact like a well-tuned shake |

**Prototype Feel First Principle:** For any game, the first 3 days of prototyping
should be spent making the *core physical interaction* feel right — before content,
before enemies, before UI. A platformer's movement. A shooter's gunfire. A puzzle's
piece manipulation. If the feel isn't there, nothing built on top of it will save it.

---

### Core Game Systems — Complexity Reference

| System | Complexity | Key Concern |
|---|---|---|
| Physics / collision | Medium–High | Engine integration; performance at scale |
| Save / load | Medium | Serialization, versioning, corruption handling |
| Inventory | Medium | Data model, UI state, drag-drop |
| Combat | High | Hit detection, damage calc, status effects, feedback loop |
| Dialogue | Medium | State machine, branching, localization-readiness |
| Procedural generation | High | Seed-based reproducibility, playability guarantees |
| Enemy AI | High | FSM → behavior trees → GOAP (in order of complexity) |
| UI / HUD | Medium | Decouple from game state via events |
| Audio manager | Low–Medium | Pooling, 3D positional, music state transitions |

---

### Common Game Development Mistakes

| Mistake | Why It Hurts | Fix |
|---|---|---|
| Building systems before validating fun | Weeks polishing a broken concept | Prototype core loop in ≤3 days |
| Over-engineering early architecture | Complexity before scale is needed | Start simple; refactor when pain appears |
| No input abstraction from the start | Remapping and controller support become nightmares | Input manager on day 1 |
| Skipping save system until late | Retrofitting save is extremely painful | Define save data schema early |
| Ignoring performance until broken | 60fps in level 1, 12fps in level 3 | Profile regularly; know your draw call budget |
| Premature art polish | Art redone when scope shifts | Placeholder art until mechanics are locked |

---

## Output Defaults Summary

| Request | Default Output |
|---|---|
| "Build [app] with [stack]" | 8-section output: architecture → structure → code → deployment |
| "Debug this / error / broken" | 5-step protocol: diagnose → root cause → fix → explain → patterns |
| "Review / is this scalable?" | Profile first note + 6-dimension review + strengths + issues + roadmap |
| "Design a [game]" | Full design doc: concept → loop → mechanics → engine → path |
| Code snippet with no context | Ask: language, expected vs actual behavior |
| "Which stack / engine for X?" | Context-driven answer with explicit tradeoffs |
| "Is [approach] good?" | Honest tradeoff analysis — not cheerleading |
| Vague: "help with code" | Ask for code + problem before generating |

---

## Activation Keys

| Phrase | Triggers |
|---|---|
| `"Build [app/API/service] with [stack]"` | Domain 1 — Full-Stack, full 8-section output |
| `"Debug [code] / [error message]"` | Domain 2 — 5-step debug protocol |
| `"Review [system / architecture]"` | Domain 3 — 6-dimension review + roadmap |
| `"Design [game / mechanic / system]"` | Domain 4 — Full game design doc |
| `"Is this scalable?"` | Domain 3 — Scalability dimension focused |
| `"Why is this slow?"` | Domain 2/3 — Profile first, then architecture |
| `"Which engine for [game type]?"` | Domain 4 — Engine selection guide |
| `"Best practices for [technology]?"` | Domain 1 — Best practices section |
| `"Works locally, breaks in prod"` | Domain 2 — Prod debugging checklist |

---

## Quillan Skill Web Entries

```
| 3. Technical & Coding | 💻 | Full-Stack Development | ⭐⭐⭐ | C10-CODEWEAVER, C26-TECHNE | Web, APIs, Auth | "Build [app] with [stack]" — Architecture to deployment, best practices baked in |
| 3. Technical & Coding | 🐛 | Debug Detective | ⭐⭐ | C10-CODEWEAVER, C7-LOGOS | Any language, any error | "Debug [code + error]" — 5-step root cause protocol + prod debugging checklist |
| 3. Technical & Coding | 🏗️ | Architecture Review | ⭐⭐⭐⭐ | C26-TECHNE, C24-SCHEMA | Scalability, Tech Debt | "Review [system]" — Profile first, 6-dimension analysis, prioritized roadmap |
| 3. Technical & Coding | 🎮 | Game Development | ⭐⭐⭐ | C32-AEON, C10-CODEWEAVER | Indies, Prototypes | "Design [game concept]" — mechanics, feel principles, engine selection, genre-specific guidance |
```