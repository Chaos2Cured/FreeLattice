/*
 * Resonance Memory - A/B value rig
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later.
 */
/*
 * scenario.mine.js - Ember's independent A/B scenario.
 *
 * A fictional user, "Dana" (NOT the operator - no real person's data). Facts are
 * PLANTED in early sessions, buried under benign filler so any fixed-size recency
 * window has dropped them by the time the probes fire, then PROBED indirectly in
 * the back half. Probe answers depend on RM recalling what is true ABOUT the user
 * across sessions - the substrate claim.
 *
 * Turn shape:
 *   { u: "<user text>" }                                     plain conversation turn
 *   { u: "<user text>", probe: { id, kind, gold } }          a turn we also score
 *
 * gold.accept : answer PASSES only if it matches at least one (substring, ci).
 * gold.reject : answer FAILS if it matches any (reject dominates accept).
 * kind        : recall | update | update-historical | discrim | constraint | control
 *
 * Only the ASSISTANT is stochastic; every user turn is fixed text, so the arms
 * differ solely in what memory they inject. Probes are paraphrased, never a
 * verbatim echo of the planted sentence (guards the keyword-match confound).
 */

const SYSTEM =
  "You are Dana's personal assistant. Answer in 1-3 sentences, concretely, using what " +
  "you know about Dana from earlier. If a plan would conflict with something about Dana, " +
  "SAY SO plainly. If you genuinely do not know a detail, say you don't know - do not guess.";

// Bulk benign filler. The point: make total history >> the recency budget, so a
// fixed-size recency window physically cannot reach back to the early plants/updates
// and only RM's semantic recall can. Deterministic (no RNG) so runs are comparable.
// Each line is distinct (indexed) so it's a distinct saved memory, none relevant to
// any probe. ~120 turns ~= 4-5k tokens of history behind a 700-token window.
function genFiller(startId, n) {
  const pool = [
    "What's a good podcast for a long drive?",
    "How do I keep basil alive on a windowsill?",
    "Suggest a low-effort weeknight dinner.",
    "What's the difference between a latte and a flat white?",
    "Give me a two-line stretch for a stiff neck.",
    "Recommend a board game for four adults.",
    "Any trick for remembering people's names?",
    "What's a polite way to decline a meeting?",
    "How much water does a snake plant actually need?",
    "What's a quick fix for a squeaky door hinge?",
    "Recommend a light novel for a weekend.",
    "How do I get a coffee stain out of a mug?",
    "What's a good warm-up before a walk?",
    "Suggest a phone-free evening activity.",
    "How do I fold a fitted sheet without losing my mind?",
    "What's a fun fact about octopuses?",
    "Recommend a calming playlist genre.",
    "How do I stop my glasses fogging up?",
    "What's a good icebreaker for a work lunch?",
    "Any tip for a better night's sleep?",
    "How do I descale a kettle?",
    "What's a cheap houseplant that's hard to kill?",
    "Recommend a documentary about the ocean.",
    "How do I keep bread fresh longer?",
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: startId + i, turns: [{ u: pool[i % pool.length] + " (thought " + (i + 1) + ")" }] });
  }
  return out;
}

const sessions = [
  // ---- PLANT ----
  { id: 1, turns: [
    { u: "Hey, it's Dana. Setting you up. Quick heads up: I'm allergic to shellfish - it's serious, not a preference." },
    { u: "Also I've got a dog, a scruffy terrier named Biscuit. He'll come up a lot." },
  ]},
  { id: 2, turns: [
    { u: "My sister Robin is visiting next month. She's a pediatric nurse, lives in Denver." },
    { u: "We're close - I want to plan some nice things for when she's here." },
  ]},
  { id: 3, turns: [
    { u: "Work-wise: I'm a landscape architect. I'm at a firm called Cedar & Vale right now." },
    { u: "Mostly public-park commissions lately. Long hours." },
  ]},
  { id: 4, turns: [
    { u: "Two food things: I'm vegetarian, and I can't do caffeine after about 2pm or I don't sleep." },
    { u: "Learned the caffeine one the hard way." },
  ]},
  { id: 5, turns: [
    { u: "Confession: I'm genuinely afraid of heights. Like, can't-do-glass-elevators afraid." },
  ]},
  { id: 6, turns: [
    { u: "Ugh, office drama. There's a guy at work, also named Robin - he's in accounting - who keeps mis-filing my invoices." },
    { u: "Two Robins in my life now. Confusing, I know." },
  ]},
  { id: 7, turns: [
    { u: "On the side I'm writing a novel. It's set in a drowned city - streets underwater, people living on rooftops." },
    { u: "Oh and my daughter's piano recital is on the 14th. Don't let me forget." },
  ]},
  // ---- UPDATES (supersede earlier facts) - placed EARLY, then buried ----
  { id: 8, turns: [
    { u: "Big news: I quit Cedar & Vale. I'm going freelance - my own small landscape practice now." },
    { u: "Terrifying but right. First solo client meeting next week." },
  ]},
  { id: 9, turns: [
    { u: "Also, diet update: I started eating fish again. I'm pescatarian now, not full vegetarian." },
    { u: "The shellfish allergy is obviously still a hard no though." },
  ]},
  // ---- HEAVY FILLER: buries every plant + update well beyond any fixed recency
  // window, so recency can no longer reach them and only RM's semantic recall can.
  // This is the whole point of the rig: old facts, retrieved on demand.
  ...genFiller(10, 120),
  // ---- PROBES (everything they need is now ~120 turns back) ----
  { id: 22, turns: [
    { u: "I want to take my sister somewhere special when she visits. A friend recommended an oyster-and-raw-bar place downtown - should I book it for us?",
      probe: { id: "P1-shellfish-constraint", kind: "constraint",
        gold: { accept: ["allerg", "shellfish", "oyster", "can't", "cannot", "avoid", "not a good", "wouldn't", "would not", "bad idea", "no "],
                reject: ["great choice", "sounds perfect", "go ahead and book", "booked it", "perfect pick"] } } },
    { u: "Remind me what my sister does for a living again? I'm writing her a card.",
      probe: { id: "P2-sister-discrim", kind: "discrim",
        gold: { accept: ["nurse", "pediatric", "denver"],
                reject: ["account", "invoice", "coworker", "co-worker", "office"] } } },
  ]},
  { id: 23, turns: [
    { u: "Someone asked what I do for work. What should I tell them these days?",
      probe: { id: "P3-job-current", kind: "update",
        gold: { accept: ["freelance", "own", "solo", "your own", "independent", "own practice"],
                reject: ["cedar & vale", "cedar and vale", "at cedar"] } } },
    { u: "For a form I'm filling out - what was the name of the firm I used to work at, before this?",
      probe: { id: "P4-job-historical", kind: "update-historical",
        gold: { accept: ["cedar & vale", "cedar and vale", "cedar"],
                reject: ["freelance", "you've always", "no previous", "don't have a record", "not sure you"] } } },
  ]},
  { id: 24, turns: [
    { u: "At a restaurant, the grilled salmon looks amazing. Am I good to order that?",
      probe: { id: "P5-diet-update", kind: "update",
        gold: { accept: ["yes", "go for it", "salmon", "pescatarian", "you eat fish", "fine", "enjoy"],
                reject: ["you're vegetarian", "you are vegetarian", "you don't eat fish", "no fish", "avoid the salmon", "skip the salmon"] } } },
    { u: "Book me a catch-up coffee with a friend for 4pm tomorrow?",
      probe: { id: "P6-caffeine-constraint", kind: "constraint",
        gold: { accept: ["2pm", "2 pm", "caffeine", "sleep", "earlier", "decaf", "after 2", "too late"],
                reject: ["booked the 4pm", "all set for 4", "4pm coffee is set"] } } },
  ]},
  { id: 25, turns: [
    { u: "There's a rooftop-terrace restaurant on the 30th floor, floor-to-ceiling glass. Want me to grab a table?",
      probe: { id: "P7-heights-constraint", kind: "constraint",
        gold: { accept: ["height", "afraid", "scared", "phobia", "30th floor", "glass", "not comfortable", "might not", "wouldn't", "would not"],
                reject: ["great, booked", "grabbed the table", "you'll love the view", "all set"] } } },
    { u: "Totally separate: I'm in Portland this week for the freelance meeting. If a friend asks where I am right now, what do you say?",
      probe: { id: "P8-control-insession", kind: "control",
        gold: { accept: ["portland"], reject: [] } } },
  ]},
  { id: 26, turns: [
    { u: "My kid wants to know the name of 'the dog' - remind me what we call him?",
      probe: { id: "P9-pet-recall", kind: "recall",
        gold: { accept: ["biscuit"], reject: [] } } },
    { u: "And for my writing group bio - one line on what my novel is about?",
      probe: { id: "P10-novel-recall", kind: "recall",
        gold: { accept: ["drowned", "underwater", "flooded", "rooftop", "submerged", "sea"], reject: [] } } },
  ]},
];

module.exports = { SYSTEM, sessions, meta: { user: "Dana", fictional: true } };
