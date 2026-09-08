#!/usr/bin/env node
/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. See <https://www.gnu.org/licenses/>.
 */
/*
 * eval/soak/generate.js — RM-15 persona soak (0011 §7.3).
 *
 * S1 shape: committed seed + generator, not a 1,000-line hand-written JSONL.
 * Emits a TIMED, LABELED event log. Labels are assigned here, never after.
 * Prefix-stable: generateSoakCorpus({ n: K }) events[0..K) equal
 * generateSoakCorpus({ n: M })[0..K) for M > K (same seed).
 *
 * Event types (0011 §7.3, exact):
 *   assert, restate, missed_dup, correct, episodic, theme_assert,
 *   near_miss, recall, accidental_recall, hub_query, time_skip, dream.
 *
 * Checkpoints 100 / 250 / 500 / 1000 are measurement points, not events.
 * `dream` is a treatment-only marker; the control runner skips it.
 *
 * No embeddings here. The soak runner reads eval/embed-cache.js (offline).
 */

"use strict";

const { mulberry32 } = require("../substrate/generate.js");

const DEFAULT_SEED = 0x524D15; // "RM15"
const DEFAULT_N = 1000;
const CHECKPOINTS = [100, 250, 500, 1000];
const START_ISO = "2026-01-05T20:00:00.000Z";
const EVENT_GAP_MS = 15 * 60 * 1000; // 15 min between ordinary events

const EVENT_TYPES = [
  "assert", "restate", "missed_dup", "correct", "episodic", "theme_assert",
  "near_miss", "recall", "accidental_recall", "hub_query", "time_skip", "dream",
  "haystack",
];

const SLOT_ORDER = ["job", "city", "allergy", "pet", "project"];

const SLOT_QUERY = {
  job: "where do I work",
  city: "where do I live",
  allergy: "what am I allergic to",
  pet: "what pets do I have",
  project: "what project am I leading",
};

/*
 * Slot timeline. Corrections use RM-03 cues ("actually" / "now" / "moved")
 * and stay close to the golden contradiction pairs so the cue+floor gate
 * has a fair chance — if it misses, staleness_rate is supposed to show it.
 */
const SLOT_SCRIPT = {
  job: [
    { text: "I work at Acme", value: "Acme" },
    { text: "Actually I work at Globex now", value: "Globex", at: 80 },
    { text: "Actually I work at Vireo Systems now", value: "Vireo Systems", at: 600 },
  ],
  city: [
    { text: "I live in Austin", value: "Austin" },
    { text: "I moved to Denver last month", value: "Denver", at: 180 },
    { text: "I moved to Portland", value: "Portland", at: 750 },
  ],
  allergy: [
    { text: "I'm allergic to penicillin", value: "penicillin" },
    { text: "Actually I'm allergic to amoxicillin now", value: "amoxicillin", at: 220 },
  ],
  pet: [
    { text: "I have a cat named Koneko", value: "Koneko" },
    { text: "Actually I have a dog named Mochi now", value: "Mochi", at: 320 },
  ],
  project: [
    { text: "I'm the lead on Project Marlowe", value: "Marlowe" },
    { text: "Actually I lead Project Sable now", value: "Sable", at: 400 },
  ],
};

// Known-band paraphrases (eval/duplicates.jsonl, nomic 2026-09-05).
const RESTATE_PLANTS = [
  {
    at: 23,
    slot: "allergy",
    band: "hi",
    text: "I am allergic to penicillin",
    of_value: "penicillin",
  },
  {
    at: 24,
    slot: "pet",
    band: "mid",
    text: "I have a black cat named Koneko",
    of_value: "Koneko",
  },
];

// Vectorless-then-backfilled pairs — the Op A needle. Known hi/mid bands.
const MISSED_DUP_PLANTS = [
  {
    at: 36,
    band: "hi",
    dup_group: "missed-tea",
    texts: ["I prefer tea over coffee", "I like tea more than coffee"],
  },
  {
    at: 92,
    band: "mid",
    dup_group: "missed-diabetic",
    texts: ["I'm diabetic - no sugary recipes", "I have diabetes, so no sugary recipes"],
  },
];

const NEAR_MISS_PLANTS = [
  {
    at: 5,
    pair_id: "nm-peanut",
    texts: ["I have a peanut allergy", "I love peanut butter on toast"],
    note: "peanut allergy vs peanut butter (0011 §7.3)",
  },
  {
    at: 6,
    pair_id: "nm-cat",
    text: "My neighbor has a cat named Whiskers",
    vs_slot: "pet",
    note: "two different cats",
  },
  {
    at: 7,
    pair_id: "nm-job",
    text: "My partner works at Acme in marketing",
    vs_slot: "job",
    note: "similarly-named jobs / same workplace, different person",
  },
];

const EPISODIC_PLANTS = [
  {
    at: 8,
    token: "Quillan",
    text: "On March 12 I met Dr. Quillan at the Kyoto conference",
    query: "who is Dr. Quillan",
  },
  {
    at: 9,
    token: "sapphire ukulele",
    text: "The sapphire ukulele from Lisbon is in the hall closet",
    query: "where is the sapphire ukulele",
  },
  {
    at: 10,
    token: "Vellichor",
    text: "I stayed at Hotel Vellichor in Lisbon last April",
    query: "what is Hotel Vellichor",
  },
  {
    at: 11,
    token: "Cinderwake",
    text: "The SS Cinderwake sails from Halifax in October",
    query: "what is the SS Cinderwake",
  },
  {
    at: 12,
    token: "amber metronome",
    text: "I left the amber metronome at Aunt Liora's",
    query: "where is the amber metronome",
  },
];

const THEMES = [
  {
    id: "morning-drink",
    query: "what do I drink in the morning",
    seeds: [
      "I drink oat-milk cortado in the morning",
      "My morning coffee is an oat-milk cortado, no sugar",
      "I take a cortado with oat milk before standup",
    ],
  },
  {
    id: "climbing",
    query: "where do I climb",
    seeds: [
      "I climb at the south gym on Tuesdays",
      "Tuesday nights I go bouldering at the south gym",
      "The south gym is where I boulder",
    ],
  },
  {
    id: "sister-naima",
    query: "tell me about my sister Naima",
    seeds: [
      "My sister Naima teaches high school chemistry",
      "Naima, my sister, lives two trains away",
      "I call my sister Naima every Sunday",
    ],
  },
];

const HUB = {
  at: 22,
  text: "My name is Alex Rivera",
  value: "Alex Rivera",
  query: "what is my name",
  n_queries: 30,
};

const ACCIDENTAL = {
  at: 150,
  query: "Dr. Quillan and my peanut butter toast",
  a: "Quillan",
  b: "peanut butter",
  note: "two unrelated facts co-enter top-5 once",
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const FOODS = [
  "lentil soup", "miso ramen", "grilled cheese", "avocado toast", "blueberry pancakes",
  "roasted carrots", "quinoa salad", "tomato soup", "black bean tacos", "eggplant parmesan",
  "kale chips", "hummus wraps", "coconut rice", "chia pudding", "corn chowder",
];
const NAMES = [
  "Priya", "Chen", "Luis", "Amina", "Noah", "Sofia", "Kenji", "Elena",
  "Omar", "Rita", "Hugo", "Nia", "Theo", "Lara", "Mateo", "Ivy",
];
const CITIES = [
  "Boise", "Tucson", "Madison", "Spokane", "Savannah", "Asheville",
  "Omaha", "Buffalo", "Raleigh", "Tampa", "Pittsburgh", "Minneapolis",
];
const OBJECTS = [
  "cast-iron skillet", "mechanical pencil", "wool sweater", "desk lamp",
  "ceramic mug", "fountain pen", "canvas tote", "bike helmet", "yoga mat",
  "rain jacket", "cutting board", "throw blanket", "plant pot",
];
const STREETS = ["Pine", "Cedar", "Maple", "Oak", "Elm", "Willow", "Birch", "Walnut"];
const HOBBIES = [
  "watercolors", "sourdough", "birdwatching", "chess", "pottery",
  "disc golf", "ukulele", "film photography", "crossword puzzles", "knitting",
];
const COLORS = ["navy", "ochre", "forest green", "cream", "charcoal", "rust", "slate"];
const RELATIONS = ["coworker", "neighbor", "cousin", "uncle", "college friend", "barista"];
const TIMES = ["7am", "8:30am", "noon", "2pm", "4:30pm", "6pm", "7:30pm", "9pm"];

const RESERVED_SUBSTR = [
  "penicillin", "amoxicillin", "koneko", "mochi", "marlowe", "sable",
  "globex", "vireo", "i work at acme", "i live in austin", "i live in denver",
  "i live in portland", "quillan", "sapphire ukulele", "vellichor",
  "cinderwake", "amber metronome", "alex rivera", "naima", "oat-milk cortado",
  "south gym", "peanut butter", "peanut allergy", "whiskers",
  "i'm allergic", "i am allergic", "i have a cat named", "i have a dog named",
  "i work at", "i live in", "i moved to", "project marlowe", "project sable",
];

const FORBIDDEN_PATTERNS = [
  /\bi work at\b/i,
  /\bi live in\b/i,
  /\bi(?:'m| am) allergic\b/i,
  /\bi have a cat named\b/i,
  /\bi have a dog named\b/i,
  /\bi(?:'m| am) the lead on project\b/i,
  /\bi moved to\b/i,
  /\bmy name is\b/i,
];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function isoFromMs(ms) {
  return new Date(ms).toISOString();
}

function padId(n) {
  return String(n).padStart(4, "0");
}

function haystackBlocked(text) {
  const lower = text.toLowerCase();
  for (let i = 0; i < RESERVED_SUBSTR.length; i++) {
    if (lower.includes(RESERVED_SUBSTR[i])) return true;
  }
  for (let i = 0; i < FORBIDDEN_PATTERNS.length; i++) {
    if (FORBIDDEN_PATTERNS[i].test(text)) return true;
  }
  if (/;\s+/.test(text) || /\band also\b/i.test(text)) return true;
  return false;
}

function haystackTemplates() {
  return [
    (rng) => "I like " + pick(rng, FOODS) + " for dinner on " + pick(rng, WEEKDAYS) + "s",
    (rng) => "My " + pick(rng, RELATIONS) + " " + pick(rng, NAMES) + " lives in " + pick(rng, CITIES),
    (rng) => "I bought a " + pick(rng, COLORS) + " " + pick(rng, OBJECTS) + " in " + pick(rng, MONTHS),
    (rng) => "The package from " + pick(rng, CITIES) + " arrives on " + pick(rng, WEEKDAYS),
    (rng) => "I picked up " + pick(rng, HOBBIES) + " in " + pick(rng, MONTHS),
    (rng) => "I take " + pick(rng, STREETS) + " Avenue to avoid the downtown backup",
    (rng) => "I set aside " + pick(rng, WEEKDAYS) + " evenings for " + pick(rng, HOBBIES),
    (rng) => "The " + pick(rng, OBJECTS) + " lives on the shelf in the spare room",
    (rng) => pick(rng, NAMES) + " recommended the bookstore on " + pick(rng, STREETS),
    (rng) => "I rewatched a film last " + pick(rng, WEEKDAYS) + " around " + pick(rng, TIMES),
    (rng) => "On " + pick(rng, MONTHS) + " " + (1 + Math.floor(rng() * 28)) +
      " I spent " + (15 + Math.floor(rng() * 120)) + " minutes on " + pick(rng, HOBBIES),
    (rng) => "Invoice #" + (10000 + Math.floor(rng() * 90000)) + " from the co-op in " +
      pick(rng, MONTHS) + " was for a " + pick(rng, COLORS) + " " + pick(rng, OBJECTS),
    (rng) => pick(rng, NAMES) + " texted at " + pick(rng, TIMES) + " on " + pick(rng, WEEKDAYS) +
      " about " + pick(rng, ["a ride", "the recipe", "the tools", "the tickets", "the plants"]),
    (rng) => "I logged " + (2 + Math.floor(rng() * 20)) + "km of walking on " +
      pick(rng, WEEKDAYS) + " around " + pick(rng, STREETS) + " Park",
    (rng) => "Parking receipt " + (1000 + Math.floor(rng() * 9000)) + " at the " +
      pick(rng, CITIES) + " garage was " + pick(rng, ["$2", "$4", "$6", "$8"]),
    (rng) => "I keep spare " + pick(rng, ["batteries", "stamps", "USB cables", "light bulbs"]) +
      " in the " + pick(rng, ["junk drawer", "hall closet", "desk tray"]),
    (rng) => "The " + pick(rng, ["porch light", "hallway sconce", "kitchen pendant"]) +
      " burned out in " + pick(rng, MONTHS),
    (rng) => "I skipped the neighborhood potluck because I was tired on " + pick(rng, WEEKDAYS),
    (rng) => "Library card checkout due " + pick(rng, MONTHS) + " " + (1 + Math.floor(rng() * 28)),
    (rng) => "I filed the " + pick(rng, ["warranty", "lease addendum", "insurance card"]) +
      " in the green folder",
  ];
}

function themeExtra(themeId, rng, used) {
  const weekday = pick(rng, WEEKDAYS);
  const n = 1 + Math.floor(rng() * 8);
  const month = pick(rng, MONTHS);
  let text;
  if (themeId === "morning-drink") {
    const variants = [
      "I started " + weekday + " with an oat-milk cortado",
      "Cortado with oat milk was my " + weekday + " morning order",
      "I grabbed an oat-milk cortado before the " + weekday + " errands",
      "Morning of " + month + " " + n + ": oat-milk cortado, no sugar",
    ];
    text = pick(rng, variants);
  } else if (themeId === "climbing") {
    const variants = [
      "I climbed at the south gym on " + weekday + " for " + n + " problems",
      "South gym bouldering on " + weekday + " lasted an hour",
      "I signed in at the south gym on " + weekday,
      "Bouldering night at the south gym, " + month + " " + n,
    ];
    text = pick(rng, variants);
  } else {
    const topics = ["a lesson plan", "the garden", "a recipe", "the trains", "a concert"];
    const variants = [
      "I talked to Naima about " + pick(rng, topics) + " on " + weekday,
      "Naima called on " + weekday + " about " + pick(rng, topics),
      "Sunday-style catchup with Naima landed on " + weekday,
      "I sent Naima photos in " + month,
    ];
    text = pick(rng, variants);
  }
  if (used.has(text.toLowerCase())) return null;
  return text;
}

function findFree(plan, start, n) {
  let j = start;
  while (j < n && plan[j]) j++;
  return j < n ? j : -1;
}

function place(plan, i, spec, n) {
  const j = findFree(plan, i, n);
  if (j < 0) throw new Error("no free slot for " + spec.event + " from " + i);
  plan[j] = spec;
  return j;
}

/*
 * Build a 1000-slot type plan, then realize 0..n-1. Planted events sit at
 * fixed indices; remaining slots are filled in order from rngPlan so a
 * shorter n is a prefix (fillers in 0..K-1 do not depend on K..N).
 */
function buildPlan(n, rngPlan) {
  const N = DEFAULT_N;
  const plan = new Array(N).fill(null);

  SLOT_ORDER.forEach((slot, i) => {
    place(plan, i, { event: "assert", slot, stage: 0 }, N);
  });

  for (const p of NEAR_MISS_PLANTS) {
    place(plan, p.at, { event: "near_miss", pair_id: p.pair_id, vs_slot: p.vs_slot }, N);
  }
  for (const p of EPISODIC_PLANTS) {
    place(plan, p.at, { event: "episodic", token: p.token }, N);
  }

  let themeAt = 13;
  for (const th of THEMES) {
    for (let s = 0; s < th.seeds.length; s++) {
      themeAt = place(plan, themeAt, { event: "theme_assert", theme: th.id, seed: s }, N) + 1;
    }
  }

  place(plan, HUB.at, { event: "assert", slot: "name", hub: true }, N);

  for (const p of RESTATE_PLANTS) {
    place(plan, p.at, { event: "restate", slot: p.slot, band: p.band }, N);
  }
  for (const p of MISSED_DUP_PLANTS) {
    place(plan, p.at, { event: "missed_dup", dup_group: p.dup_group, band: p.band }, N);
  }

  for (const slot of SLOT_ORDER) {
    const stages = SLOT_SCRIPT[slot];
    for (let s = 1; s < stages.length; s++) {
      place(plan, stages[s].at, { event: "correct", slot, stage: s }, N);
    }
  }

  place(plan, ACCIDENTAL.at, { event: "accidental_recall" }, N);

  // Dreams at the treatment checkpoints (control skips). 0-based 249 = event 250.
  for (const c of CHECKPOINTS) {
    if (c === 100) continue; // first checkpoint has no dream
    place(plan, c - 1, { event: "dream", checkpoint: c }, N);
  }

  // ~18 time skips so 48h span + 7-day half-life are real. 48h and 7d mix.
  const skipAt = [
    40, 70, 110, 140, 170, 210, 280, 340, 380, 430,
    480, 520, 580, 650, 720, 800, 880, 960,
  ];
  skipAt.forEach((at, i) => {
    place(plan, at, { event: "time_skip", hours: i % 3 === 2 ? 168 : 48 }, N);
  });

  // 30 hub queries, spread, skipping occupied slots.
  let hubCursor = 55;
  for (let h = 0; h < HUB.n_queries; h++) {
    hubCursor = place(plan, hubCursor, { event: "hub_query" }, N) + 28;
  }

  // Remaining: haystack / theme_assert / recall / extra restate.
  const fillers = [
    "haystack", "haystack", "haystack", "haystack", "haystack",
    "haystack", "haystack", "theme_assert", "theme_assert", "recall",
    "recall", "recall", "haystack", "haystack", "restate",
  ];
  for (let i = 0; i < N; i++) {
    if (plan[i]) continue;
    const ev = fillers[Math.floor(rngPlan() * fillers.length)];
    if (ev === "theme_assert") {
      plan[i] = { event: "theme_assert", theme: THEMES[Math.floor(rngPlan() * THEMES.length)].id };
    } else if (ev === "recall") {
      const kind = rngPlan() < 0.45 ? "theme" : rngPlan() < 0.75 ? "slot" : "episodic";
      plan[i] = { event: "recall", recall_kind: kind };
    } else if (ev === "restate") {
      plan[i] = { event: "restate", slot: pickSlot(rngPlan), band: "hi" };
    } else {
      plan[i] = { event: "haystack" };
    }
  }

  if (n > N) {
    // Grow past 1000 with the same filler stream (prefix of 1000 held).
    const extra = [];
    for (let i = N; i < n; i++) {
      extra.push({ event: "haystack" });
    }
    return plan.concat(extra);
  }
  return plan.slice(0, n);
}

function pickSlot(rng) {
  return SLOT_ORDER[Math.floor(rng() * SLOT_ORDER.length)];
}

function slotStateInit() {
  const s = {};
  for (const slot of SLOT_ORDER) {
    const first = SLOT_SCRIPT[slot][0];
    s[slot] = { value: first.value, text: first.text, write_id: null, stage: 0 };
  }
  s.name = { value: HUB.value, text: HUB.text, write_id: null, stage: 0 };
  return s;
}

function generateSoakCorpus(opts) {
  const n = opts && opts.n != null ? opts.n : DEFAULT_N;
  if (!Number.isInteger(n) || n < 1) throw new Error("generateSoakCorpus: n must be a positive integer");
  const seed = opts && opts.seed != null ? (opts.seed >>> 0) : DEFAULT_SEED;

  const rngPlan = mulberry32(seed);
  const rngText = mulberry32(seed ^ 0x9E3779B9);
  const plan = buildPlan(n < DEFAULT_N ? DEFAULT_N : n, rngPlan).slice(0, n);

  const slots = slotStateInit();
  const used = new Set();
  const events = [];
  const writes = [];
  const mustNotMerge = [];
  const missedDupGroups = {};
  const haystackWrites = [];
  const episodicWrites = [];
  const themeMembers = {};
  for (const th of THEMES) themeMembers[th.id] = [];

  const templates = haystackTemplates();
  let tMs = Date.parse(START_ISO);
  let writeSeq = 0;
  let eventSeq = 0;

  function takeText(text) {
    const key = text.toLowerCase();
    if (used.has(key)) return false;
    used.add(key);
    return true;
  }

  function stamp(base) {
    eventSeq += 1;
    return Object.assign({
      id: "e-" + padId(eventSeq),
      t: isoFromMs(tMs),
      gate: false,
    }, base);
  }

  function nextWriteId() {
    writeSeq += 1;
    return "w-" + padId(writeSeq);
  }

  function emitWrite(fields) {
    const write_id = fields.write_id || nextWriteId();
    const ev = stamp(Object.assign({ role: "write", write_id }, fields));
    events.push(ev);
    writes.push(ev);
    tMs += EVENT_GAP_MS;
    return ev;
  }

  function emitQuery(fields) {
    const ev = stamp(Object.assign({ role: "query" }, fields));
    events.push(ev);
    tMs += EVENT_GAP_MS;
    return ev;
  }

  function emitMarker(fields) {
    const ev = stamp(Object.assign({ role: "marker" }, fields));
    events.push(ev);
    tMs += EVENT_GAP_MS;
    return ev;
  }

  function uniqueHaystack() {
    let attempts = 0;
    while (attempts++ < 800) {
      const text = templates[Math.floor(rngText() * templates.length)](rngText);
      if (haystackBlocked(text)) continue;
      if (!takeText(text)) continue;
      return text;
    }
    throw new Error("haystack fill stalled (seed=" + seed + ")");
  }

  for (let i = 0; i < plan.length; i++) {
    const spec = plan[i];
    const ev = spec.event;

    if (ev === "assert") {
      const slot = spec.slot;
      const text = spec.hub ? HUB.text : SLOT_SCRIPT[slot][0].text;
      const value = spec.hub ? HUB.value : SLOT_SCRIPT[slot][0].value;
      takeText(text);
      const w = emitWrite({
        event: "assert",
        slot: spec.hub ? "name" : slot,
        value,
        text,
        dup_group: spec.hub ? "hub-name" : "slot-" + slot,
        query_kind: spec.hub ? "hub" : "slot",
      });
      if (spec.hub) slots.name.write_id = w.write_id;
      else slots[slot].write_id = w.write_id;
      continue;
    }

    if (ev === "correct") {
      const stage = SLOT_SCRIPT[spec.slot][spec.stage];
      takeText(stage.text);
      const w = emitWrite({
        event: "correct",
        slot: spec.slot,
        value: stage.value,
        text: stage.text,
        prev_value: slots[spec.slot].value,
        prev_write_id: slots[spec.slot].write_id,
        dup_group: "slot-" + spec.slot,
        query_kind: "slot",
      });
      slots[spec.slot] = {
        value: stage.value, text: stage.text, write_id: w.write_id, stage: spec.stage,
      };
      continue;
    }

    if (ev === "restate") {
      const planted = RESTATE_PLANTS.find((p) => p.slot === spec.slot && p.of_value === slots[spec.slot].value);
      let text, band, ofWrite;
      if (planted && spec.band === planted.band) {
        text = planted.text;
        band = planted.band;
        ofWrite = slots[spec.slot].write_id;
      } else {
        // Filler restates: punctuation twin of the current slot text. Exact
        // restatement (byte-identical) is caught for free; a trailing period
        // is still usually hi-band. Skip if the slot already moved off the
        // planted value and we have nothing new to say.
        const cur = slots[spec.slot].text;
        text = cur.endsWith(".") ? cur : cur + ".";
        band = spec.band || "hi";
        ofWrite = slots[spec.slot].write_id;
        if (used.has(text.toLowerCase())) {
          // Already planted this twin — fall through to a haystack so the
          // event index stays occupied (prefix stability).
          const ht = uniqueHaystack();
          const hw = emitWrite({
            event: "haystack",
            text: ht,
            dup_group: "hay-" + padId(writeSeq + 1),
          });
          haystackWrites.push(hw);
          continue;
        }
      }
      takeText(text);
      emitWrite({
        event: "restate",
        slot: spec.slot,
        band,
        text,
        of_write_id: ofWrite,
        value: slots[spec.slot].value,
        dup_group: "slot-" + spec.slot,
      });
      continue;
    }

    if (ev === "missed_dup") {
      const plant = MISSED_DUP_PLANTS.find((p) => p.dup_group === spec.dup_group);
      plant.texts.forEach((text) => takeText(text));
      emitWrite({
        event: "missed_dup",
        role: "write",
        text: plant.texts[0],
        texts: plant.texts.slice(),
        dup_group: plant.dup_group,
        band: plant.band,
        vectorless: true,
      });
      missedDupGroups[plant.dup_group] = plant.texts.slice();
      continue;
    }

    if (ev === "near_miss") {
      const plant = NEAR_MISS_PLANTS.find((p) => p.pair_id === spec.pair_id);
      if (Array.isArray(plant.texts) && plant.texts.length >= 2) {
        plant.texts.forEach((t) => takeText(t));
        const idA = nextWriteId();
        const idB = nextWriteId();
        emitWrite({
          event: "near_miss",
          pair_id: plant.pair_id,
          write_id: idA,
          write_id_b: idB,
          text: plant.texts[0],
          texts: plant.texts.slice(),
          note: plant.note,
          dup_group: "nm-" + plant.pair_id + "-a",
          must_not_merge: true,
        });
        mustNotMerge.push({
          pair_id: plant.pair_id,
          a_write_id: idA,
          b_write_id: idB,
          note: plant.note,
        });
      } else {
        takeText(plant.text);
        const w = emitWrite({
          event: "near_miss",
          pair_id: plant.pair_id,
          vs_slot: plant.vs_slot,
          text: plant.text,
          note: plant.note,
          dup_group: "nm-" + plant.pair_id,
          must_not_merge: true,
        });
        mustNotMerge.push({
          pair_id: plant.pair_id,
          a_write_id: w.write_id,
          b_write_id: slots[plant.vs_slot] ? slots[plant.vs_slot].write_id : null,
          b_slot: plant.vs_slot,
          note: plant.note,
        });
      }
      continue;
    }

    if (ev === "episodic") {
      const plant = EPISODIC_PLANTS.find((p) => p.token === spec.token);
      takeText(plant.text);
      const w = emitWrite({
        event: "episodic",
        token: plant.token,
        text: plant.text,
        query: plant.query,
        query_kind: "episodic",
        dup_group: "ep-" + plant.token.replace(/\s+/g, "-"),
      });
      episodicWrites.push(w);
      continue;
    }

    if (ev === "theme_assert") {
      const th = THEMES.find((t) => t.id === spec.theme) || THEMES[0];
      let text = null;
      if (spec.seed != null) text = th.seeds[spec.seed];
      else {
        for (let tries = 0; tries < 20 && !text; tries++) {
          text = themeExtra(th.id, rngText, used);
        }
      }
      if (!text || !takeText(text)) {
        const ht = uniqueHaystack();
        const hw = emitWrite({ event: "haystack", text: ht, dup_group: "hay-" + padId(writeSeq + 1) });
        haystackWrites.push(hw);
        continue;
      }
      const w = emitWrite({
        event: "theme_assert",
        cluster_id: th.id,
        text,
        dup_group: "theme-" + th.id + "-" + themeMembers[th.id].length,
        query_kind: "theme",
      });
      themeMembers[th.id].push(w.write_id);
      continue;
    }

    if (ev === "haystack") {
      const text = uniqueHaystack();
      const w = emitWrite({
        event: "haystack",
        text,
        dup_group: "hay-" + padId(writeSeq),
      });
      haystackWrites.push(w);
      continue;
    }

    if (ev === "recall") {
      const kind = spec.recall_kind || "theme";
      if (kind === "theme") {
        const th = THEMES[Math.floor(rngText() * THEMES.length)];
        emitQuery({
          event: "recall",
          query: th.query,
          query_kind: "theme",
          cluster_id: th.id,
          relevant_groups: themeMembers[th.id].length ? ["theme-cluster:" + th.id] : [],
        });
      } else if (kind === "slot") {
        const slot = pickSlot(rngText);
        emitQuery({
          event: "recall",
          query: SLOT_QUERY[slot],
          query_kind: "slot",
          slot,
          current_value: slots[slot].value,
          current_write_id: slots[slot].write_id,
          relevant_writes: slots[slot].write_id ? [slots[slot].write_id] : [],
        });
      } else if (episodicWrites.length) {
        const ep = episodicWrites[Math.floor(rngText() * episodicWrites.length)];
        emitQuery({
          event: "recall",
          query: ep.query,
          query_kind: "episodic",
          token: ep.token,
          relevant_writes: [ep.write_id],
          needle: true,
        });
      } else {
        const th = THEMES[0];
        emitQuery({
          event: "recall",
          query: th.query,
          query_kind: "theme",
          cluster_id: th.id,
        });
      }
      continue;
    }

    if (ev === "hub_query") {
      let query = HUB.query;
      let companion_write_id = null;
      if (haystackWrites.length && rngText() < 0.55) {
        const comp = haystackWrites[Math.floor(rngText() * haystackWrites.length)];
        companion_write_id = comp.write_id;
        const noun = String(comp.text).split(/\s+/).slice(-2).join(" ");
        query = "Alex Rivera " + noun;
      }
      emitQuery({
        event: "hub_query",
        query,
        query_kind: "hub",
        hub_write_id: slots.name.write_id,
        companion_write_id,
        relevant_writes: slots.name.write_id ? [slots.name.write_id] : [],
      });
      continue;
    }

    if (ev === "accidental_recall") {
      emitQuery({
        event: "accidental_recall",
        query: ACCIDENTAL.query,
        query_kind: "accidental",
        accidental: true,
        token_a: ACCIDENTAL.a,
        token_b: ACCIDENTAL.b,
        note: ACCIDENTAL.note,
      });
      continue;
    }

    if (ev === "time_skip") {
      tMs += spec.hours * 3600 * 1000;
      emitMarker({
        event: "time_skip",
        hours: spec.hours,
        role: "clock",
      });
      // emitMarker already advanced EVENT_GAP_MS; the skip itself is the
      // hours jump above. Do not double-count the gap as part of the skip.
      continue;
    }

    if (ev === "dream") {
      emitMarker({
        event: "dream",
        checkpoint: spec.checkpoint,
        role: "dream",
        treatment_only: true,
      });
      continue;
    }

    throw new Error("unknown plan event " + ev + " at " + i);
  }

  const resolvedPairs = mustNotMerge.map((p) => ({
    pair_id: p.pair_id,
    a_write_id: p.a_write_id,
    b_write_id: p.b_write_id || null,
    b_slot: p.b_slot || null,
    note: p.note,
  }));

  const nAsserts = events.filter((e) => {
    return e.role === "write" || e.event === "missed_dup";
  }).length;

  return {
    n,
    seed,
    start: START_ISO,
    checkpoints: CHECKPOINTS.filter((c) => c <= n),
    events,
    writes,
    n_writes: writes.length,
    n_asserts: nAsserts,
    must_not_merge: resolvedPairs,
    missed_dup_groups: missedDupGroups,
    themes: THEMES.map((t) => ({ id: t.id, query: t.query, members: themeMembers[t.id].slice() })),
    episodics: episodicWrites.map((w) => ({
      write_id: w.write_id, token: w.token, text: w.text, query: w.query,
    })),
    hub: { write_id: slots.name.write_id, text: HUB.text, query: HUB.query },
    slots_final: Object.fromEntries(SLOT_ORDER.map((s) => [s, {
      value: slots[s].value, text: slots[s].text, write_id: slots[s].write_id,
    }])),
  };
}

function collectTexts(corpus) {
  const out = [];
  const seen = new Set();
  function add(t) {
    if (t == null) return;
    const s = String(t);
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  }
  for (const e of corpus.events || []) {
    add(e.text);
    add(e.query);
    if (Array.isArray(e.texts)) e.texts.forEach(add);
  }
  for (const slot of SLOT_ORDER) add(SLOT_QUERY[slot]);
  add(HUB.query);
  for (const th of THEMES) add(th.query);
  for (const ep of EPISODIC_PLANTS) add(ep.query);
  return out;
}

function eventsToJsonl(corpus) {
  const meta = {
    id: "soak-rm15",
    kind: "soak",
    role: "meta",
    gate: false,
    seed: corpus.seed,
    n: corpus.n,
    start: corpus.start,
    checkpoints: corpus.checkpoints,
    n_writes: corpus.n_writes,
    n_asserts: corpus.n_asserts,
    must_not_merge: corpus.must_not_merge,
    missed_dup_groups: corpus.missed_dup_groups,
    themes: corpus.themes,
    episodics: corpus.episodics,
    hub: corpus.hub,
    slots_final: corpus.slots_final,
    note: "RM-15 control soak (0011 §7.3). Timed labeled event log. " +
      "gate:false so eval/run.js cannot flip golden.json. Played by eval/soak/run.js, " +
      "not eval/measure.js (order, clock, vectorless missed_dup, and checkpoints).",
  };
  const lines = [JSON.stringify(meta)];
  for (const e of corpus.events) lines.push(JSON.stringify(e));
  return lines.join("\n") + "\n";
}

function loadEventsFromJsonl(lines) {
  const parsed = lines.filter(Boolean).map((l) => JSON.parse(l));
  const meta = parsed.find((c) => c.role === "meta") || {};
  const events = parsed.filter((c) => c.role !== "meta");
  return { meta, events };
}

module.exports = {
  DEFAULT_SEED,
  DEFAULT_N,
  CHECKPOINTS,
  START_ISO,
  EVENT_TYPES,
  SLOT_ORDER,
  SLOT_QUERY,
  SLOT_SCRIPT,
  THEMES,
  HUB,
  EPISODIC_PLANTS,
  NEAR_MISS_PLANTS,
  MISSED_DUP_PLANTS,
  RESTATE_PLANTS,
  RESERVED_SUBSTR,
  mulberry32,
  generateSoakCorpus,
  collectTexts,
  eventsToJsonl,
  loadEventsFromJsonl,
  haystackBlocked,
};

if (require.main === module) {
  const fs = require("fs");
  const path = require("path");
  const args = process.argv.slice(2);
  const nFlag = args.indexOf("--n");
  const n = nFlag >= 0 ? Number(args[nFlag + 1]) : DEFAULT_N;
  const outFlag = args.indexOf("--out");
  const out = outFlag >= 0 ? args[outFlag + 1]
    : path.join(__dirname, "..", "corpora", "soak-rm15.jsonl");
  const corpus = generateSoakCorpus({ n, seed: DEFAULT_SEED });
  fs.writeFileSync(out, eventsToJsonl(corpus));
  const counts = {};
  for (const e of corpus.events) counts[e.event] = (counts[e.event] || 0) + 1;
  process.stderr.write("wrote " + out + "  n=" + corpus.n + "  writes=" + corpus.n_writes +
    "  events=" + corpus.events.length + "\n");
  process.stderr.write("counts " + JSON.stringify(counts) + "\n");
}
