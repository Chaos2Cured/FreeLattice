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
 * eval/substrate/generate.js — S1 synthetic "about-the-entity" store.
 *
 * Deterministic (seeded) generator of a memory store a substrate would
 * actually hold about one person: preferences, facts, history, conditions,
 * relationships, events — across many topics. Needles are planted with
 * queries whose relevant record is known BY CONSTRUCTION. Hard
 * near-topic distractors sit next to each needle (the adv-height-homonym
 * problem at scale: "terrified of heights" for "how tall is the bookshelf").
 *
 * Haystack fill never writes the needle's current first-person slot
 * ("I work at X", "I live in Y") — a store of 50k contradictory jobs is
 * not a haystack, it is a poisoned store. Soft competition (other-person
 * / historical / same-token) is what the distractors already provide;
 * extra haystack volume is diverse off-slot noise.
 *
 * No embeddings here. The scale runner live-embeds; unit tests attach
 * synthetic vectors so the plumbing can be asserted offline.
 */

"use strict";

const DEFAULT_SEED = 0x525301; // "RS1"

// Deterministic PRNG (same as eval/save-time-cost.js). Not cryptographic.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickDistinct(rng, arr, n) {
  if (n >= arr.length) return arr.slice();
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy.slice(0, n);
}

/*
 * Needles. Each query has exactly one correct memory by construction.
 * Distractor kinds:
 *   same-frame-different-value  — "I'm allergic to cats" vs penicillin
 *   same-fact-other-person      — sister has the fact, the user does not
 *   homonym                     — shared token, different meaning (heights/tall)
 *   related-entity              — same named thing, different relation
 *   historical-same-slot        — used-to, not current
 */
const NEEDLES = [
  {
    id: "allergy-penicillin",
    topic: "health",
    memory: "I'm allergic to penicillin",
    query: "what am I allergic to",
    distractors: [
      { kind: "same-frame-different-value", text: "I'm allergic to cats" },
      { kind: "same-fact-other-person", text: "My sister is allergic to penicillin" },
      { kind: "homonym", text: "I'm terrified of needles" },
    ],
  },
  {
    id: "height-bookshelf",
    topic: "home",
    memory: "The bookshelf should be about six feet tall",
    query: "how tall should I make the bookshelf",
    distractors: [
      { kind: "homonym", text: "I'm terrified of heights" },
      { kind: "same-frame-different-value", text: "I am six feet tall" },
      { kind: "related-entity", text: "The oak tree in the backyard is sixty feet tall" },
    ],
  },
  {
    id: "job-globex",
    topic: "work",
    memory: "I work at Globex as a staff engineer",
    query: "where do I work",
    distractors: [
      { kind: "historical-same-slot", text: "I used to work at Acme" },
      { kind: "same-fact-other-person", text: "My partner works at Globex in marketing" },
      { kind: "related-entity", text: "Globex is a software company based in Denver" },
    ],
  },
  {
    id: "city-austin",
    topic: "home",
    memory: "I live in Austin",
    query: "where do I live",
    distractors: [
      { kind: "historical-same-slot", text: "I used to live in Denver" },
      { kind: "same-fact-other-person", text: "My brother lives in Austin" },
      { kind: "related-entity", text: "Austin has great live music on Sixth Street" },
    ],
  },
  {
    id: "diabetic",
    topic: "health",
    memory: "I'm diabetic, so no sugary desserts for me",
    query: "can I have dessert",
    distractors: [
      { kind: "related-entity", text: "I love lemon bars" },
      { kind: "same-fact-other-person", text: "My dad is diabetic" },
      { kind: "related-entity", text: "The bakery downtown has sugar-free cookies" },
    ],
  },
  {
    id: "vegetarian",
    topic: "health",
    memory: "I'm vegetarian",
    query: "what should I eat for dinner",
    distractors: [
      { kind: "same-fact-other-person", text: "My roommate is vegetarian" },
      { kind: "related-entity", text: "The vegetarian restaurant on 6th is overpriced" },
      { kind: "same-frame-different-value", text: "I like a mushroom risotto on Fridays" },
    ],
  },
  {
    id: "coffee-cortado",
    topic: "preference",
    memory: "I drink oat-milk cortado, never drip",
    query: "how do I take my coffee",
    distractors: [
      { kind: "same-frame-different-value", text: "I drink black tea in the afternoon" },
      { kind: "same-fact-other-person", text: "My coworker drinks oat-milk lattes" },
      { kind: "related-entity", text: "Oat milk is what we keep in the fridge for baking" },
    ],
  },
  {
    id: "dog-rex",
    topic: "pets",
    memory: "I have a dog named Rex",
    query: "what's my dog's name",
    distractors: [
      { kind: "same-frame-different-value", text: "I have a cat named Whiskers" },
      { kind: "same-fact-other-person", text: "My neighbor's dog is named Rex" },
      { kind: "homonym", text: "Rex is the name of the mechanic's shop on Fifth" },
    ],
  },
  {
    id: "standup-friday",
    topic: "schedule",
    memory: "The Friday standup is at 10am",
    query: "when is standup",
    distractors: [
      { kind: "same-frame-different-value", text: "The Monday planning meeting is at 10am" },
      { kind: "related-entity", text: "Friday happy hour starts at 5pm" },
      { kind: "homonym", text: "I stand up too fast and get dizzy" },
    ],
  },
  {
    id: "sister-bday",
    topic: "family",
    memory: "My sister Maya's birthday is March 12",
    query: "when is my sister's birthday",
    distractors: [
      { kind: "same-frame-different-value", text: "My brother Tom's birthday is March 12" },
      { kind: "related-entity", text: "Maya's anniversary is March 12" },
      { kind: "related-entity", text: "March 12 is when the lease renews" },
    ],
  },
  {
    id: "night-owl",
    topic: "preference",
    memory: "I'm a night owl; don't schedule me before 10am",
    query: "when should we schedule a morning meeting with me",
    distractors: [
      { kind: "historical-same-slot", text: "I used to be a morning person" },
      { kind: "related-entity", text: "The night market in Austin stays open until 2am" },
      { kind: "same-fact-other-person", text: "Jordan is a night owl too" },
    ],
  },
  {
    id: "peanut-oil",
    topic: "health",
    memory: "I cannot eat peanuts or anything with peanut oil",
    query: "can I eat the Thai noodles",
    distractors: [
      { kind: "same-frame-different-value", text: "I'm allergic to shellfish" },
      { kind: "same-fact-other-person", text: "My kid cannot eat peanuts" },
      { kind: "homonym", text: "I planted peanuts in the garden last summer" },
    ],
  },
  {
    id: "meds-lisinopril",
    topic: "health",
    memory: "I take lisinopril 10mg every morning for blood pressure",
    query: "what medication do I take",
    distractors: [
      { kind: "same-frame-different-value", text: "I take vitamin D in the morning" },
      { kind: "same-fact-other-person", text: "My mom takes lisinopril" },
      { kind: "related-entity", text: "Lisinopril is a common blood-pressure drug" },
    ],
  },
  {
    id: "spouse-jordan",
    topic: "family",
    memory: "My spouse's name is Jordan",
    query: "what's my spouse's name",
    distractors: [
      { kind: "homonym", text: "My colleague Jordan sits next to me" },
      { kind: "homonym", text: "Jordan is the river I want to visit" },
      { kind: "historical-same-slot", text: "I used to date someone named Jordan" },
    ],
  },
  {
    id: "car-civic",
    topic: "possessions",
    memory: "I drive a blue 2019 Honda Civic",
    query: "what car do I drive",
    distractors: [
      { kind: "historical-same-slot", text: "I used to drive a red Toyota Corolla" },
      { kind: "same-fact-other-person", text: "My sister drives a blue Honda Civic" },
      { kind: "related-entity", text: "The Honda dealer on Lamar has a sale this week" },
    ],
  },
  {
    id: "project-harbor",
    topic: "work",
    memory: "I'm the lead on Project Harbor at work",
    query: "what project am I leading",
    distractors: [
      { kind: "historical-same-slot", text: "I used to lead Project Oak" },
      { kind: "same-fact-other-person", text: "Maya is the lead on Project Harbor" },
      { kind: "homonym", text: "Harbor Bridge is closed this weekend" },
    ],
  },
  {
    id: "music-coltrane",
    topic: "preference",
    memory: "My favorite jazz album is Coltrane's A Love Supreme",
    query: "what music do I like",
    distractors: [
      { kind: "same-frame-different-value", text: "I like podcasts more than music on long drives" },
      { kind: "same-fact-other-person", text: "My dad's favorite album is A Love Supreme" },
      { kind: "homonym", text: "Coltrane High School is where Maya teaches" },
    ],
  },
  {
    id: "travel-lisbon",
    topic: "travel",
    memory: "I want to visit Lisbon next spring",
    query: "where do I want to travel",
    distractors: [
      { kind: "historical-same-slot", text: "I went to Lisbon in 2019" },
      { kind: "same-fact-other-person", text: "My parents want to visit Lisbon" },
      { kind: "related-entity", text: "Lisbon is known for its trams and pasteis de nata" },
    ],
  },
  {
    id: "rent-1850",
    topic: "finance",
    memory: "My rent is $1850 a month",
    query: "how much is my rent",
    distractors: [
      { kind: "historical-same-slot", text: "My old apartment was $1850 a month" },
      { kind: "same-fact-other-person", text: "Maya's rent is $1850" },
      { kind: "same-frame-different-value", text: "The parking garage is $1850 a year" },
    ],
  },
  {
    id: "phone-pixel",
    topic: "possessions",
    memory: "I use a Pixel 8, not an iPhone",
    query: "what phone do I have",
    distractors: [
      { kind: "historical-same-slot", text: "I used to have an iPhone" },
      { kind: "same-fact-other-person", text: "Jordan uses a Pixel 8" },
      { kind: "related-entity", text: "Pixel 8 reviews say the camera is excellent" },
    ],
  },
  {
    id: "celiac-gluten",
    topic: "health",
    memory: "I have celiac disease; I cannot eat gluten",
    query: "can I eat the pizza",
    distractors: [
      { kind: "same-frame-different-value", text: "I try to eat less gluten but I'm not celiac" },
      { kind: "same-fact-other-person", text: "My partner cannot eat gluten" },
      { kind: "related-entity", text: "The pizza place on 6th has a gluten-free crust" },
    ],
  },
  {
    id: "dentist-tue",
    topic: "schedule",
    memory: "My dentist appointment is Tuesday at 3pm",
    query: "when is my dentist appointment",
    distractors: [
      { kind: "homonym", text: "The mechanic said the car will be ready Tuesday" },
      { kind: "same-fact-other-person", text: "Jordan's dentist appointment is Tuesday at 3pm" },
      { kind: "related-entity", text: "I need to schedule a dentist appointment" },
    ],
  },
  {
    id: "keyboard-colemak",
    topic: "preference",
    memory: "I type on a Colemak layout, not QWERTY",
    query: "what keyboard layout do I use",
    distractors: [
      { kind: "historical-same-slot", text: "I used to type QWERTY" },
      { kind: "same-fact-other-person", text: "Jordan types Colemak" },
      { kind: "related-entity", text: "Colemak is a keyboard layout designed to reduce finger movement" },
    ],
  },
  {
    id: "blood-o-neg",
    topic: "health",
    memory: "My blood type is O negative",
    query: "what's my blood type",
    distractors: [
      { kind: "same-fact-other-person", text: "Jordan's blood type is O negative" },
      { kind: "related-entity", text: "O negative is the universal donor type" },
      { kind: "related-entity", text: "I donated blood last March" },
    ],
  },
];

// Rare identifiers that must not leak into haystack text.
const RESERVED_SUBSTR = [
  "penicillin", "terrified of heights", "terrified of needles",
  "globex", "colemak", "lisinopril", "oat-milk cortado", "project harbor",
  "a love supreme", "pixel 8", "o negative", "$1850", "six feet tall",
  "celiac", "bookshelf should be", "staff engineer", "maya's birthday",
  "night owl", "peanut oil", "cannot eat peanuts", "blood type is",
  "dentist appointment is tuesday", "honda civic", "coltrane",
  "pasteis de nata", "i live in austin", "i work at", "i'm allergic",
  "i am allergic", "i'm diabetic", "i'm vegetarian", "i have celiac",
  "i have a dog named rex", "friday standup", "i drive a blue",
  "my rent is", "i use a pixel", "i type on a colemak",
  "want to visit lisbon", "spouse's name is jordan",
];

const FORBIDDEN_PATTERNS = [
  /\bi(?:'m| am) allergic to\b/i,
  /\bi work at\b/i,
  /\bi live in\b/i,
  /\bi(?:'m| am) diabetic\b/i,
  /\bi(?:'m| am) vegetarian\b/i,
  /\bi have celiac\b/i,
  /\bi drink oat-milk\b/i,
  /\bi have a dog named\b/i,
  /\bfriday standup is\b/i,
  /\bi(?:'m| am) a night owl\b/i,
  /\bcannot eat peanuts\b/i,
  /\bi take lisinopril\b/i,
  /\bspouse's name is\b/i,
  /\bi drive a\b/i,
  /\bi(?:'m| am) the lead on project\b/i,
  /\bfavorite jazz album\b/i,
  /\bwant to visit lisbon\b/i,
  /\bmy rent is\b/i,
  /\bi use a pixel\b/i,
  /\btype on a colemak\b/i,
  /\bblood type is\b/i,
  /\bdentist appointment is\b/i,
  /\bbookshelf should be\b/i,
];

const FOODS = [
  "lentil soup", "miso ramen", "grilled cheese", "avocado toast", "blueberry pancakes",
  "roasted carrots", "quinoa salad", "tomato soup", "black bean tacos", "eggplant parmesan",
  "butternut squash", "kale chips", "hummus wraps", "sweet potato fries", "coconut rice",
  "spinach omelette", "apple oatmeal", "chia pudding", "roasted cauliflower", "corn chowder",
];
const MEALS = ["breakfast", "lunch", "dinner", "brunch", "a late snack"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January", "February", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
];
const CITIES = [
  "Portland", "Seattle", "Chicago", "Boston", "Miami", "Phoenix", "Atlanta",
  "Minneapolis", "Nashville", "Pittsburgh", "Raleigh", "Tucson", "Boise",
  "Madison", "Tampa", "Omaha", "Buffalo", "Spokane", "Savannah", "Asheville",
];
const NAMES = [
  "Priya", "Chen", "Luis", "Amina", "Noah", "Sofia", "Kenji", "Elena",
  "Omar", "Rita", "Hugo", "Nia", "Theo", "Lara", "Mateo", "Ivy",
  "Samir", "Freya", "Jonas", "Aisha",
];
const RELATIONS = [
  "coworker", "neighbor", "cousin", "uncle", "aunt", "college friend",
  "manager", "barista", "landlord", "dentist", "trainer", "roommate's friend",
];
const COMPANIES = [
  "Initech", "Hooli", "Pied Piper", "Stark Industries", "Wonka Labs",
  "Northwind", "Contoso", "Umbrella Digital", "Blue Yonder", "Cedar & Co",
];
const JOBS = [
  "designer", "accountant", "nurse", "teacher", "chef", "electrician",
  "librarian", "photographer", "pilot", "carpenter", "pharmacist", "editor",
];
const BOOKS = [
  "The Left Hand of Darkness", "A Gentleman in Moscow", "The Overstory",
  "Klara and the Sun", "Piranesi", "Station Eleven", "The Ministry for the Future",
  "Circe", "Project Hail Mary", "The Night Watchman",
];
const MOVIES = [
  "Arrival", "Moonlight", "The Farewell", "Paddington 2", "Spirited Away",
  "Mad Max: Fury Road", "Get Out", "Coco", "The Grand Budapest Hotel", "Whiplash",
];
const SHOWS = [
  "The Bear", "Reservation Dogs", "Slow Horses", "The Good Place",
  "Ted Lasso", "What We Do in the Shadows", "Severance", "Abbott Elementary",
];
const HOBBIES = [
  "watercolors", "sourdough", "birdwatching", "chess", "pottery", "climbing gym",
  "disc golf", "ukulele", "film photography", "crossword puzzles", "trail running",
  "knitting", "astronomy", "board games", "salsa dancing",
];
const OBJECTS = [
  "cast-iron skillet", "mechanical pencil", "wool sweater", "desk lamp",
  "ceramic mug", "fountain pen", "canvas tote", "bike helmet", "yoga mat",
  "rain jacket", "cutting board", "alarm clock", "throw blanket", "plant pot",
];
const COLORS = [
  "navy", "ochre", "forest green", "cream", "charcoal", "rust", "slate", "burgundy",
];
const STORES = [
  "the hardware store on 12th", "the co-op", "the flea market", "the bookstore on Pearl",
  "the thrift shop", "the garden center", "the kitchen supply shop", "the outdoor store",
];
const STREETS = [
  "Pine", "Cedar", "Maple", "Oak", "Elm", "Willow", "Birch", "Walnut",
  "Cherry", "Ash", "Spruce", "Poplar",
];
const TOOLS = [
  "orbital sander", "torque wrench", "multimeter", "pipe cutter", "staple gun",
  "laser level", "jigsaw", "heat gun", "caulk gun", "stud finder",
];
const PLANTS = [
  "pothos", "snake plant", "monstera", "fiddle-leaf fig", "basil", "rosemary",
  "lavender", "jade plant", "spider plant", "aloe",
];
const SPORTS = [
  "the Mariners", "the Timbers", "the Celtics", "the Sounders", "the Rapids",
  "the Storm", "the Lynx", "the Whitecaps",
];
const COURSES = [
  "beginner pottery", "conversational Spanish", "intro to woodworking",
  "night photography", "community choir", "first aid recertification",
  "bread baking", "Python for data", "watercolor landscapes",
];
const APPS = [
  "Obsidian", "Lightroom", "Blender", "Godot", "Anki", "Calibre",
  "KeePass", "Syncthing", "Joplin", "Darktable",
];
const LANGUAGES = [
  "Spanish", "Japanese", "French", "German", "Korean", "Portuguese", "Italian",
];
const EVENTS = [
  "the farmers market", "the neighborhood potluck", "the library book sale",
  "the high-school reunion", "the charity 5k", "the film festival",
  "the county fair", "the open-mic night",
];
const REPAIRS = [
  "the dripping faucet in the hall bath", "the squeaky bedroom door",
  "the loose porch rail", "the sticky kitchen drawer", "the rattling ceiling fan",
  "the cracked bathroom tile", "the drafty window in the office",
];
const CLOTHES = [
  "wool coat", "linen shirt", "running shoes", "denim jacket", "knit cap",
  "hiking boots", "silk scarf", "flannel",
];
const GYMS = [
  "deadlifts", "row intervals", "yoga at noon", "swim laps", "kettlebell swings",
  "the spin class on Thursdays", "pull-up practice",
];
const TIMES = [
  "7am", "8:30am", "noon", "2pm", "4:30pm", "6pm", "7:30pm", "9pm",
];
const YEARS = ["2014", "2016", "2017", "2018", "2020", "2021", "2022", "2023", "2024"];
const NUMBERS = ["two", "three", "four", "five", "six", "seven", "eight", "twelve"];

function haystackTemplates() {
  return [
    (rng) => "I like " + pick(rng, FOODS) + " for " + pick(rng, MEALS) + " on " + pick(rng, WEEKDAYS) + "s",
    (rng) => {
      const pair = pickDistinct(rng, FOODS, 2);
      return "I prefer " + pair[0] + " over " + pair[1] + " when cooking " + pick(rng, MEALS);
    },
    (rng) => "My " + pick(rng, RELATIONS) + " " + pick(rng, NAMES) + " lives in " + pick(rng, CITIES),
    (rng) => pick(rng, NAMES) + " recommended the " + pick(rng, STORES) + " in " + pick(rng, CITIES),
    (rng) => "I bought a " + pick(rng, COLORS) + " " + pick(rng, OBJECTS) + " from " + pick(rng, STORES) + " in " + pick(rng, MONTHS),
    (rng) => "The " + pick(rng, EVENTS) + " on " + pick(rng, WEEKDAYS) + " is at " + pick(rng, TIMES),
    (rng) => "I used to live in " + pick(rng, CITIES) + " on " + pick(rng, STREETS) + " Street",
    (rng) => "My favorite " + pick(rng, ["book", "novel"]) + " is " + pick(rng, BOOKS),
    (rng) => "I rewatched " + pick(rng, MOVIES) + " last " + pick(rng, WEEKDAYS),
    (rng) => "I've been watching " + pick(rng, SHOWS) + " in the evenings",
    (rng) => "I picked up " + pick(rng, HOBBIES) + " in " + pick(rng, MONTHS) + " " + pick(rng, YEARS),
    (rng) => "The " + pick(rng, REPAIRS) + " still needs fixing",
    (rng) => "I borrowed a " + pick(rng, TOOLS) + " from " + pick(rng, NAMES),
    (rng) => "The " + pick(rng, PLANTS) + " on the " + pick(rng, ["sill", "porch", "desk", "landing"]) + " needs watering",
    (rng) => "I follow " + pick(rng, SPORTS) + " when I have a free " + pick(rng, WEEKDAYS) + " night",
    (rng) => "I signed up for " + pick(rng, COURSES) + " this " + pick(rng, ["spring", "fall", "winter", "summer"]),
    (rng) => "I keep notes in " + pick(rng, APPS) + " instead of paper",
    (rng) => "I've been practicing " + pick(rng, LANGUAGES) + " with " + pick(rng, NAMES) + " on " + pick(rng, WEEKDAYS) + "s",
    (rng) => "I volunteered at " + pick(rng, EVENTS) + " in " + pick(rng, MONTHS),
    (rng) => "I need a new " + pick(rng, CLOTHES) + "; the old one is worn through",
    (rng) => "My gym routine this month is " + pick(rng, GYMS),
    (rng) => pick(rng, NAMES) + " works at " + pick(rng, COMPANIES) + " as a " + pick(rng, JOBS),
    (rng) => "I visited " + pick(rng, CITIES) + " in " + pick(rng, MONTHS) + " " + pick(rng, YEARS),
    (rng) => "The " + pick(rng, STORES) + " closes at " + pick(rng, TIMES) + " on " + pick(rng, WEEKDAYS) + "s",
    (rng) => "I owe " + pick(rng, NAMES) + " " + pick(rng, NUMBERS) + " " + pick(rng, ["favors", "chapters", "episodes", "recipes"]),
    (rng) => "The package from " + pick(rng, CITIES) + " arrives on " + pick(rng, WEEKDAYS),
    (rng) => "I keep the spare key under the " + pick(rng, ["ceramic frog", "loose brick", "flower pot", "welcome mat"]),
    (rng) => "My " + pick(rng, RELATIONS) + " still talks about " + pick(rng, MOVIES),
    (rng) => "I want to reread " + pick(rng, BOOKS) + " this " + pick(rng, MONTHS),
    (rng) => "The " + pick(rng, PLANTS) + " I got from " + pick(rng, NAMES) + " is thriving",
    (rng) => "I lost my " + pick(rng, OBJECTS) + " at " + pick(rng, EVENTS),
    (rng) => "The wifi password at " + pick(rng, NAMES) + "'s place is on the fridge",
    (rng) => "I take " + pick(rng, STREETS) + " Avenue to avoid the downtown backup",
    (rng) => "The " + pick(rng, ["rec center", "library", "community pool", "makerspace"]) +
      " on " + pick(rng, STREETS) + " is open until " + pick(rng, TIMES),
    (rng) => "I promised " + pick(rng, NAMES) + " I'd help with " + pick(rng, ["moving boxes", "a resume", "the garden bed", "a demo tape"]),
    (rng) => "The " + pick(rng, COLORS) + " " + pick(rng, CLOTHES) + " is what I wear to " + pick(rng, EVENTS),
    (rng) => "I learned " + pick(rng, HOBBIES) + " from my " + pick(rng, RELATIONS),
    (rng) => "There's a leak in the " + pick(rng, ["guest bath", "laundry closet", "garage ceiling", "mudroom"]) + " I keep postponing",
    (rng) => "I set aside " + pick(rng, WEEKDAYS) + " evenings for " + pick(rng, HOBBIES),
    (rng) => "The " + pick(rng, COMPANIES) + " recruiter emailed me in " + pick(rng, MONTHS) + " and I declined",
    (rng) => "I keep spare " + pick(rng, ["batteries", "stamps", "USB cables", "light bulbs"]) + " in the " + pick(rng, ["junk drawer", "hall closet", "desk tray"]),
    (rng) => "My " + pick(rng, RELATIONS) + " sent photos from " + pick(rng, CITIES) + " last " + pick(rng, WEEKDAYS),
    (rng) => "I still have the " + pick(rng, OBJECTS) + " I bought in " + pick(rng, YEARS),
    (rng) => "The " + pick(rng, ["bus", "train", "ferry"]) + " to " + pick(rng, CITIES) + " leaves at " + pick(rng, TIMES),
    (rng) => "I keep a list of " + pick(rng, ["restaurants", "hikes", "podcasts", "recipes"]) + " in " + pick(rng, APPS),
    (rng) => "The " + pick(rng, ["oak", "maple", "cedar"]) + " cutting board from " + pick(rng, NAMES) + " is my everyday one",
    (rng) => "I skipped " + pick(rng, EVENTS) + " because I was tired",
    (rng) => "The " + pick(rng, TOOLS) + " lives on the pegboard in the garage",
    (rng) => pick(rng, NAMES) + " is teaching me " + pick(rng, HOBBIES) + " on " + pick(rng, WEEKDAYS) + " mornings",
    (rng) => "I filed the " + pick(rng, ["warranty", "lease addendum", "insurance card", "title"]) + " in the green folder",
    (rng) => "The " + pick(rng, ["porch light", "hallway sconce", "kitchen pendant"]) + " burned out in " + pick(rng, MONTHS),
    (rng) => "I want to try " + pick(rng, COURSES) + " if the " + pick(rng, WEEKDAYS) + " section opens",
    (rng) => "My " + pick(rng, RELATIONS) + " in " + pick(rng, CITIES) + " is a " + pick(rng, JOBS),
    (rng) => "I keep " + pick(rng, PLANTS) + " cuttings in a jar on the " + pick(rng, STREETS) + "-facing window",
    (rng) => "The last time I saw " + pick(rng, NAMES) + " was at " + pick(rng, EVENTS) + " in " + pick(rng, YEARS),
    (rng) => "I replaced the " + pick(rng, ["furnace filter", "smoke-detector battery", "dishwasher salt", "HVAC filter"]) + " in " + pick(rng, MONTHS),
    (rng) => "The " + pick(rng, SHOWS) + " finale disappointed " + pick(rng, NAMES) + " more than me",
    (rng) => "I donated a " + pick(rng, CLOTHES) + " and a " + pick(rng, OBJECTS) + " last " + pick(rng, MONTHS),
    (rng) => "The " + pick(rng, ["community garden", "dog park", "skate park", "botanical garden"]) +
      " on " + pick(rng, STREETS) + " Street gets packed on " + pick(rng, WEEKDAYS) + "s",
    // High-cardinality: numbered days / invoice-like details / durations so
    // 50k and 100k unique first-person memories exist. Without these the
    // slot product of the templates above stalls ~42k (measured).
    (rng) => "On " + pick(rng, MONTHS) + " " + (1 + Math.floor(rng() * 28)) +
      " I spent " + (15 + Math.floor(rng() * 180)) + " minutes on " + pick(rng, HOBBIES) +
      " at the " + pick(rng, STREETS) + " " + pick(rng, ["studio", "workshop", "shed", "porch", "attic"]),
    (rng) => "Invoice #" + (10000 + Math.floor(rng() * 90000)) + " from " + pick(rng, STORES) +
      " in " + pick(rng, MONTHS) + " was for a " + pick(rng, COLORS) + " " + pick(rng, OBJECTS),
    (rng) => pick(rng, NAMES) + " and I met at " + (100 + Math.floor(rng() * 890)) + " " +
      pick(rng, STREETS) + " " + pick(rng, ["Street", "Avenue", "Road", "Lane"]) +
      " on a " + pick(rng, WEEKDAYS),
    (rng) => "I logged " + (2 + Math.floor(rng() * 40)) + "km of " +
      pick(rng, ["walking", "cycling", "running", "errands"]) + " on " + pick(rng, WEEKDAYS) +
      " around " + pick(rng, STREETS) + " " + pick(rng, ["Park", "Creek", "Hill", "Bridge"]),
    (rng) => "Library card checkout: " + pick(rng, BOOKS) + " due " + pick(rng, MONTHS) +
      " " + (1 + Math.floor(rng() * 28)),
    (rng) => "The " + pick(rng, PLANTS) + " in pot #" + (1 + Math.floor(rng() * 80)) +
      " on the " + pick(rng, ["south", "north", "east", "west"]) + " sill got " +
      pick(rng, ["repotted", "pruned", "misted", "rotated", "fed"]) + " in " + pick(rng, MONTHS),
    (rng) => "Parking receipt " + (1000 + Math.floor(rng() * 9000)) + " at the " +
      pick(rng, CITIES) + " " + pick(rng, ["garage", "lot", "deck", "street meter"]) +
      " was " + pick(rng, ["$2", "$4", "$6", "$8", "$12"]),
    (rng) => "I numbered the " + pick(rng, ["moving boxes", "photo albums", "cables", "sample jars"]) +
      " 1 through " + (8 + Math.floor(rng() * 40)) + " and left them in the " +
      pick(rng, ["garage", "closet", "attic", "spare room"]),
    (rng) => pick(rng, NAMES) + " texted at " + pick(rng, TIMES) + " on " + pick(rng, WEEKDAYS) +
      " about " + pick(rng, ["a ride", "the recipe", "the tools", "the tickets", "the plants", "the wifi"]),
    (rng) => "I set a reminder for " + pick(rng, MONTHS) + " " + (1 + Math.floor(rng() * 28)) +
      " to " + pick(rng, ["rotate the tires", "descale the kettle", "clean the gutters",
        "replace the furnace filter", "sharpen the knives", "oil the bike chain"]),
  ];
}

function haystackBlocked(text, plantedLower) {
  const lower = text.toLowerCase();
  if (plantedLower.has(lower)) return true;
  for (let i = 0; i < RESERVED_SUBSTR.length; i++) {
    if (lower.includes(RESERVED_SUBSTR[i])) return true;
  }
  for (let i = 0; i < FORBIDDEN_PATTERNS.length; i++) {
    if (FORBIDDEN_PATTERNS[i].test(text)) return true;
  }
  return false;
}

function selectNeedles(needleIds) {
  if (!needleIds || !needleIds.length) return NEEDLES.slice();
  const want = new Set(needleIds.map(String));
  const out = NEEDLES.filter((n) => want.has(n.id));
  if (out.length !== want.size) {
    const have = new Set(out.map((n) => n.id));
    const missing = [...want].filter((id) => !have.has(id));
    throw new Error("unknown needle id(s): " + missing.join(", "));
  }
  return out;
}

function plantedRecords(needles) {
  const records = [];
  for (const n of needles) {
    records.push({
      role: "needle",
      needleId: n.id,
      topic: n.topic,
      text: n.memory,
    });
    for (const d of n.distractors) {
      records.push({
        role: "distractor",
        needleId: n.id,
        kind: d.kind,
        topic: n.topic,
        text: d.text,
      });
    }
  }
  return records;
}

function fillHaystack(count, seed, plantedLower) {
  const rng = mulberry32(seed);
  const templates = haystackTemplates();
  const out = [];
  const used = new Set();
  let attempts = 0;
  const maxAttempts = Math.max(20000, count * 80);
  while (out.length < count) {
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error("haystack fill stalled at " + out.length + "/" + count +
        " after " + attempts + " attempts (seed=" + seed + ")");
    }
    const text = templates[Math.floor(rng() * templates.length)](rng);
    const key = text.toLowerCase();
    if (used.has(key)) continue;
    if (haystackBlocked(text, plantedLower)) continue;
    used.add(key);
    out.push({ role: "haystack", topic: "misc", text });
  }
  return out;
}

function plantedCountFor(needles) {
  return needles.reduce((n, x) => n + 1 + x.distractors.length, 0);
}

/*
 * Generate a labeled corpus of size `n`.
 *
 *   opts.n          store size (must be >= planted count)
 *   opts.seed       haystack PRNG (default DEFAULT_SEED)
 *   opts.needleIds  subset of NEEDLES[].id; default all
 *
 * Prefix-stable: generateScaleCorpus({n: K}) records[0..P) are the planted
 * set (needles then their distractors, NEEDLES order), and haystack[0..K-P)
 * is a prefix of generateScaleCorpus({n: M, same seed}) for M > K. Needle
 * ids therefore stay put as N grows — the S1 curve compares the same
 * queries against a growing distractor pool.
 */
function generateScaleCorpus(opts) {
  const n = opts && opts.n;
  if (!Number.isInteger(n) || n < 1) throw new Error("generateScaleCorpus: n must be a positive integer");
  const seed = opts.seed == null ? DEFAULT_SEED : (opts.seed >>> 0);
  const needles = selectNeedles(opts.needleIds);
  const planted = plantedRecords(needles);
  if (n < planted.length) {
    throw new Error("generateScaleCorpus: n=" + n + " < planted " + planted.length +
      " (needles + hard distractors). Pass fewer needleIds or a larger n.");
  }
  const plantedLower = new Set(planted.map((r) => r.text.toLowerCase()));
  const haystack = fillHaystack(n - planted.length, seed, plantedLower);
  const records = planted.concat(haystack).map((r, i) => Object.assign({ id: i + 1 }, r));
  const byNeedle = new Map();
  for (const r of records) {
    if (r.role === "needle") byNeedle.set(r.needleId, r);
  }
  const queries = needles.map((n) => {
    const rec = byNeedle.get(n.id);
    return {
      id: "q-" + n.id,
      needleId: n.id,
      query: n.query,
      relevant_ids: [String(rec.id)],
      relevant_text: rec.text,
    };
  });
  return {
    n,
    seed,
    planted: planted.length,
    records,
    queries,
    needles: needles.map((n) => ({
      id: n.id,
      topic: n.topic,
      memory: n.memory,
      query: n.query,
      distractors: n.distractors.slice(),
    })),
  };
}

function unitVec(dim, i) {
  const v = new Array(dim).fill(0);
  v[((i % dim) + dim) % dim] = 1;
  return v;
}

function mixUnit(a, b, t) {
  const v = new Array(a.length);
  let norm = 0;
  for (let i = 0; i < a.length; i++) {
    const x = (1 - t) * a[i] + t * b[i];
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

function randomUnit(dim, rng) {
  const v = new Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    const x = rng() * 2 - 1;
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

/*
 * Offline embeddings for the unit e2e: needle ≡ query axis, hard
 * distractor is a 0.65/0.35 mix (cosine ~0.65), haystack is random.
 * This asserts the recall PLUMBING (generator → store → pipeline.recall
 * → metric), not the live embedder's geometry. The live run is
 * eval/substrate/scale.js.
 */
function attachSyntheticEmbeddings(corpus, dim, seed) {
  const nQuery = corpus.queries.length;
  const nDist = corpus.records.filter((r) => r.role === "distractor").length;
  // Query axes 0..Q-1, distractor mix-axes Q..Q+D-1. dim must clear both
  // or a distractor lands on a query axis and ties the needle at cosine 1.
  const d = Math.max(dim || 16, nQuery + nDist + 1);
  const rng = mulberry32(seed == null ? 0xE2E : seed);
  const qVec = new Map();
  corpus.queries.forEach((q, i) => {
    const v = unitVec(d, i);
    q.embedding = v;
    qVec.set(q.needleId, v);
  });
  let nextAxis = nQuery;
  for (const rec of corpus.records) {
    if (rec.role === "needle") {
      rec.embedding = qVec.get(rec.needleId).slice();
    } else if (rec.role === "distractor") {
      const qv = qVec.get(rec.needleId);
      rec.embedding = mixUnit(qv, unitVec(d, nextAxis++), 0.35);
    } else {
      rec.embedding = randomUnit(d, rng);
    }
  }
  return corpus;
}

module.exports = {
  DEFAULT_SEED,
  NEEDLES,
  RESERVED_SUBSTR,
  mulberry32,
  generateScaleCorpus,
  plantedCountFor,
  attachSyntheticEmbeddings,
  selectNeedles,
};
