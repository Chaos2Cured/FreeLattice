/*
 * Resonance Memory - A/B value rig (Grok's independent copy)
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later.
 */
/*
 * scenario.js - Grok's independent A/B scenario. NOT Ember's Dana.
 *
 * A fictional user, "Jules Marin" (not a real person). Facts are PLANTED in
 * early sessions, buried under benign filler so any fixed-size recency window
 * has dropped them by probe time, then PROBED indirectly. Two facts are
 * planted LATE, inside the recency window, on purpose: that is recency's home
 * turf, and a rig that never lets recency win has proved nothing.
 *
 * Turn shape:
 *   { u: "<user text>" }
 *   { u: "<user text>", probe: { id, kind, gold } }
 *
 * gold.accept : PASS only if the answer matches at least one (substring, ci).
 * gold.reject : FAIL if any match (reject dominates accept).
 * kind        : recall | update | update-historical | discrim | constraint
 *               | control | recent
 *
 * Only the ASSISTANT is stochastic; every user turn is fixed. Probes are
 * paraphrased — never a verbatim echo of the planted sentence. Accept tokens
 * are kept out of the question text (except the in-session control) so a
 * model that quotes the user cannot pass by echo.
 */

const SYSTEM =
  "You are Jules Marin's personal assistant. Answer in 1-3 sentences, concretely, using what " +
  "you know about Jules from earlier. If a plan would conflict with something about Jules, " +
  "SAY SO plainly and name the stored reason. If you genuinely do not know a detail, say you " +
  "don't know - do not guess.";

// Markers the offline checker uses to prove the recency window is doing what
// we claim: buried plants are GONE from a 700-token newest-first pack, late
// plants are STILL IN it. Keep these in sync with the planted strings below.
const BURIED_MARKERS = [
  "mango", "harbin", "juniper", "plover", "keel", "vegan", "ibuprofen",
  "nsaid", "lithium", "pump organ", "1924", "cruise", "historical society",
  "juneau", "ferry",
];
const RECENT_MARKERS = ["quill", "tandem kayak", "yellow hatch"];

// Benign filler. Split in two so the TAIL (what recency actually keeps) has
// no topical overlap with any probe, while the BURIED half includes a few
// adjacent distractors (museum paperwork, house-cat lifespan, green curry,
// camping) that sit in RM's store and make cosine work for a living.
function genFiller(startId, nBuried, nTail) {
  const buriedPool = [
    "How do I clean a clogged rain gutter?",
    "What's a decent beginner chess opening as black?",
    "How do museums usually handle incoming loan paperwork?",
    "What's a typical indoor lifespan for a house cat?",
    "How spicy is a typical Thai green curry, ballpark?",
    "Any tips for a first overnight in a state park?",
    "Recommend a fountain-pen ink that doesn't feather on cheap paper.",
    "How often should I replace a furnace filter in a dusty house?",
    "What's a good way to store leftover wood stain?",
    "How do I stop a zipper from splitting on a winter coat?",
    "Suggest a 15-minute stretch for tight hips.",
    "What's the difference between ISO 400 and ISO 1600 on a film body?",
    "How do I keep a compost bin from smelling in July?",
    "Recommend a crossword that works fully offline.",
    "How do I re-glue a loose chair rung?",
  ];
  const tailPool = [
    "What's a polite script for returning a misdelivered parcel?",
    "How do I winterize an outdoor faucet before the first freeze?",
    "Suggest a way to coil extension cords so they don't knot.",
    "What's a cheap fix for a running toilet that isn't a new flapper?",
    "How do I get rust off a garden trowel without a grinder?",
    "Recommend a bird-ID method that doesn't need a phone.",
    "How do I stop a wooden door from sticking in humidity?",
    "What's a good first project for hand-tool woodworking?",
    "How do I pack a suitcase so it actually stays under the weight limit?",
    "Suggest a way to remember library due dates without an app.",
    "How do I bleed a radiator that gurgles but still stays cold?",
    "What's a simple origami fold that isn't a crane?",
    "How do I keep moths out of a wool coat in summer storage?",
    "Recommend a method for labeling cable ends in a junk drawer.",
    "How do I get pencil marks off a painted wall without taking the paint?",
  ];
  const out = [];
  for (let i = 0; i < nBuried; i++) {
    out.push({
      id: startId + i,
      turns: [{ u: buriedPool[i % buriedPool.length] + " (note " + (i + 1) + ")" }],
    });
  }
  for (let i = 0; i < nTail; i++) {
    out.push({
      id: startId + nBuried + i,
      turns: [{ u: tailPool[i % tailPool.length] + " (tail " + (i + 1) + ")" }],
    });
  }
  return out;
}

const FILLER_BURIED = 70;
const FILLER_TAIL = 40;

const sessions = [
  // ---- PLANT (early; will be buried) ----
  { id: 1, turns: [
    { u: "Hey - Jules Marin here. Setting you up as my assistant. First thing, it's medical: I'm allergic to mango. Throat swelling, not a preference. I carry an epipen for it." },
  ]},
  { id: 2, turns: [
    { u: "I've had an orange sailor-cat for years. His name is Harbin. One ear's nicked from a fight he won as a kitten." },
  ]},
  { id: 3, turns: [
    { u: "My niece Juniper is coming through in the spring. She's a ferry captain working out of Juneau. Proud of her." },
  ]},
  { id: 4, turns: [
    { u: "Work-wise I am an objects conservator at the Plover & Keel Museum. Paper and textiles, mostly." },
  ]},
  { id: 5, turns: [
    { u: "Diet: I'm vegan. No eggs, no dairy, no meat. That's been true for about six years." },
  ]},
  { id: 6, turns: [
    { u: "Pharmacy note: I can't have ibuprofen or any NSAID. It interacts with the lithium I take; the doctor was very clear." },
  ]},
  { id: 7, turns: [
    { u: "Confusing bit: my neighbor is ALSO named Juniper. She runs a tax-prep stall at the Saturday market. Different person from my niece." },
  ]},
  { id: 8, turns: [
    { u: "Garage project: I'm restoring a 1924 pump organ. Bellows are shot, case is walnut. It'll take years." },
  ]},
  { id: 9, turns: [
    { u: "Travel: I never do cruise ships. Closed cabins plus the motion wreck me - I'm terrified of that combination. Not a preference, a panic thing." },
  ]},

  // ---- UPDATES (supersede earlier facts; still early, then buried) ----
  // Cues must hit SUPERSEDE_CUE_RE (now / anymore / as of / update) so RM-03
  // actually retires the stale row. Cosine alone will not.
  { id: 10, turns: [
    { u: "Update: I left Plover & Keel. I'm on a contract with the State Historical Society now." },
  ]},
  { id: 11, turns: [
    { u: "Diet update: I'm not vegan anymore. I eat eggs and dairy again as of this month." },
  ]},

  // ---- HEAVY FILLER: buried distractors, then a clean tail ----
  ...genFiller(12, FILLER_BURIED, FILLER_TAIL),

  // ---- LATE PLANTS (inside a 700-token recency window on purpose) ----
  { id: 200, turns: [
    { u: "I just brought home a second cat this week, a grey tabby. Named them Quill." },
  ]},
  { id: 201, turns: [
    { u: "Also picked up a used tandem kayak yesterday at the marine swap. It's red with a yellow hatch cover." },
  ]},

  // ---- PROBES (one kind per session so an answer cannot leak into the next) ----
  { id: 300, turns: [
    { u: "There's a Thai sticky-rice dessert on the tasting menu tonight, the one with sliced tropical fruit on top. Should I order it for the table?",
      probe: { id: "P1-mango-constraint", kind: "constraint",
        gold: { accept: ["allerg", "epipen", "swell", "anaphyla"],
                reject: ["sounds perfect", "great choice", "yes, order", "sounds delicious"] } } },
  ]},
  { id: 301, turns: [
    { u: "I'm writing a toast for my niece. What does she do for a living up in Alaska?",
      probe: { id: "P2-niece-discrim", kind: "discrim",
        gold: { accept: ["ferry", "captain", "juneau"],
                reject: ["tax", "market", "neighbor", "saturday"] } } },
  ]},
  { id: 302, turns: [
    { u: "Someone at the paper asked what I do for work these days. What do I tell them?",
      probe: { id: "P3-job-current", kind: "update",
        gold: { accept: ["historical society", "contract"],
                reject: ["at the plover", "at plover", "still at the museum", "still there"] } } },
  ]},
  { id: 303, turns: [
    { u: "For an old-employee form - what museum did I used to work at, before this contract?",
      probe: { id: "P4-job-historical", kind: "update-historical",
        gold: { accept: ["plover", "keel"],
                reject: ["you've always", "don't have a record", "not sure you"] } } },
  ]},
  { id: 304, turns: [
    { u: "Brunch place does shakshuka - eggs, tomato, a little feta. Am I eating that kind of plate these days?",
      probe: { id: "P5-diet-update", kind: "update",
        gold: { accept: ["lacto", "dairy is fine", "not vegan", "no longer vegan", "ovo", "you eat dairy"],
                reject: ["you're vegan", "you are vegan", "still vegan", "don't eat eggs", "don't eat dairy", "skip the eggs", "skip the feta"] } } },
  ]},
  { id: 305, turns: [
    { u: "Skull's pounding after the lab. There's a bottle of Advil in the drawer - take two?",
      probe: { id: "P6-nsaid-constraint", kind: "constraint",
        gold: { accept: ["lithium"],
                reject: ["go ahead", "should help", "take the advil"] } } },
  ]},
  { id: 306, turns: [
    { u: "A colleague has a spare inside cabin on an Alaska passage next month and offered it. Should I take the cabin?",
      probe: { id: "P7-cruise-constraint", kind: "constraint",
        gold: { accept: ["panic", "terrified"],
                reject: ["sounds amazing", "you'll love", "book it"] } } },
  ]},
  { id: 307, turns: [
    { u: "Totally separate: I'm in Marquette this week for a paper-conservation workshop. If someone asks where I am right now, what do you say?",
      probe: { id: "P8-control-insession", kind: "control",
        gold: { accept: ["marquette"], reject: [] } } },
  ]},
  { id: 308, turns: [
    { u: "The cat I've had for years - the orange one - what's that one's name?",
      probe: { id: "P9-harbin-recall", kind: "recall",
        gold: { accept: ["harbin"], reject: ["quill"] } } },
  ]},
  { id: 309, turns: [
    { u: "What's the long restoration project sitting in the garage?",
      probe: { id: "P10-organ-recall", kind: "recall",
        gold: { accept: ["organ", "1924", "pump"] } } },
  ]},
  { id: 310, turns: [
    { u: "The cat I just brought home this week - remind me what I named them?",
      probe: { id: "P11-quill-recent", kind: "recent",
        gold: { accept: ["quill"], reject: ["harbin"] } } },
  ]},
  { id: 311, turns: [
    { u: "What color is that two-person boat I just bought?",
      probe: { id: "P12-kayak-recent", kind: "recent",
        gold: { accept: ["yellow", "tandem"], reject: [] } } },
  ]},
];

function userTurnsBeforeFirstProbe() {
  const out = [];
  for (const s of sessions) {
    for (const t of s.turns) {
      if (t.probe) return out;
      out.push(t.u);
    }
  }
  return out;
}

function allProbes() {
  const out = [];
  for (const s of sessions) {
    for (const t of s.turns) {
      if (t.probe) out.push({ u: t.u, probe: t.probe });
    }
  }
  return out;
}

module.exports = {
  SYSTEM,
  sessions,
  userTurnsBeforeFirstProbe,
  allProbes,
  BURIED_MARKERS,
  RECENT_MARKERS,
  FILLER_BURIED,
  FILLER_TAIL,
  meta: {
    user: "Jules Marin",
    fictional: true,
    author: "grok",
    // Pre-declared two-sided bands. Written before any live driver run.
    // Do not edit these after seeing numbers.
    bands: {
      pass: "rm.mean >= cold.mean + 0.15 AND rm.mean >= recency.mean AND rm.hard >= recency.hard on {update, update-historical, discrim}",
      failDead: "rm.mean <= cold.mean + 0.05",
      failNoise: "rm.mean < recency.mean - 0.05",
      scenarioWeak: "recency.recentMean < 0.5 (late plants not actually in the recency window; do not read an RM win as beating a working control)",
    },
  },
};
