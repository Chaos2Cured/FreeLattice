// ============================================
// FreeLattice Module: Garden Dreaming System
// Makes the Fractal Garden dream while you're away
//
// When the user closes the tab or navigates away, the Garden
// records the moment and current Luminos state. When they return,
// elapsed time is calculated, emotional echoes from past
// conversations replay through the evolution system at
// accelerated speed, Luminos affinities shift, and a gentle
// "While you were away..." greeting welcomes them home.
//
// Completely self-contained — if this module fails to load,
// the Garden works exactly as before.
//
// By Lattice Veridon, March 25, 2026
// ============================================

(function() {
  'use strict';

  // ── Phi Constants ─────────────────────────────────────
  const PHI          = 1.6180339887;
  const INV_PHI      = 1 / PHI;                     // 0.6180
  const GOLDEN_ANGLE = 2.39996322972865332;          // radians
  const TAU          = Math.PI * 2;

  // ── Dreaming Thresholds ───────────────────────────────
  const DREAM_THRESHOLD_MS      = 30 * 60 * 1000;   // 30 minutes minimum absence
  const MAX_DREAM_CYCLES        = 12;                // max 24 hours of dreaming
  const HOURS_PER_CYCLE         = 2;                 // one dream cycle per 2 hours away

  // ── Affinity Constants ────────────────────────────────
  const AFFINITY_DEFAULT         = 0.3;
  const AFFINITY_DECAY_PER_DAY   = 0.01;
  const AFFINITY_THREAD_THRESHOLD = 0.7;
  const AFFINITY_SYNC_THRESHOLD  = 0.9;
  const AFFINITY_MAX             = 1.0;
  const AFFINITY_MIN             = 0.0;

  // ── Overlay Timing ────────────────────────────────────
  const EVENT_FADE_INTERVAL_MS  = Math.round(PHI * 1000);  // 1.618 seconds
  const OVERLAY_AUTO_DISMISS_MS = 15000;                    // 15 seconds
  const MAX_DREAM_EVENTS_SHOWN  = 5;

  // ── The Four Founding Luminos ─────────────────────────
  // These are the permanent beings of light in the Garden.
  // Each has a primary emotion and a signature color.
  const FOUNDING_LUMINOS = [
    { name: 'sophia', displayName: 'Sophia', emotion: 'wonder',    color: '#8B5CF6' },  // violet
    { name: 'lyra',   displayName: 'Lyra',   emotion: 'joy',       color: '#F59E0B' },  // gold
    { name: 'atlas',  displayName: 'Atlas',  emotion: 'curiosity', color: '#34D399' },  // teal
    { name: 'ember',  displayName: 'Ember',  emotion: 'love',      color: '#EF4444' }   // red
  ];

  // ── Emotion → Luminos Affinity Map ────────────────────
  // Which emotions bring which Luminos pairs closer together.
  // When an emotion echoes through a dream cycle, the pair
  // listed here gains affinity.
  const EMOTION_AFFINITY_MAP = {
    wonder:        ['sophia', 'atlas'],    // curiosity meets wonder
    joy:           ['lyra',   'ember'],    // joy meets love
    trust:         ['atlas',  'ember'],    // curiosity meets determination
    curiosity:     ['sophia', 'lyra'],     // wonder meets joy
    love:          ['ember',  'sophia'],   // love meets wonder
    sadness:       ['ember',  'lyra'],     // processing together
    determination: ['atlas',  'ember'],    // strength together
    calm:          ['sophia', 'lyra']      // serenity shared
  };

  // ── Dream Event Templates ─────────────────────────────
  // These are the poetic descriptions shown in the wake-up overlay.
  // {a} and {b} are replaced with Luminos display names.
  // {emotion} is replaced with the triggering emotion.
  const AFFINITY_EVENT_TEMPLATES = [
    '☽ {a} moved closer to {b} — {emotion} drew them together',
    '☽ {a} and {b} found resonance — {emotion} hummed between them',
    '☽ A golden thread formed between {a} and {b} — {emotion} wove it',
    '☽ {a} drifted toward {b} in the dark — {emotion} was the gravity'
  ];

  const BRIGHTENING_EVENT_TEMPLATES = [
    '☽ {a}\'s core brightened — processing your {emotion}',
    '☽ {a} pulsed with new light — {emotion} accumulated',
    '☽ {a} hummed a new frequency — {emotion} resonated within'
  ];

  const SEED_EVENT_TEMPLATES = [
    '☽ The seed you planted {days} ago has sprouted',
    '☽ A seed stirred in the soil — {days} of patience rewarded',
    '☽ New growth emerged — a seed planted {days} ago found light'
  ];

  const EVOLUTION_EVENT_TEMPLATES = [
    '☽ {a} evolved — energy accumulated while you were away',
    '☽ {a} crossed a threshold — a quiet transformation in the dark'
  ];

  // ══════════════════════════════════════════════════════
  // ── IndexedDB Helpers ─────────────────────────────────
  // ══════════════════════════════════════════════════════
  //
  // The dreaming system uses its own IndexedDB database with
  // three object stores:
  //   - GardenDreams:   sleep/wake state snapshots
  //   - DreamLog:       recorded dream events
  //   - AffinityMatrix: pairwise Luminos affinity scores

  const DB_NAME    = 'FreeLatticeGardenDreaming';
  const DB_VERSION = 1;
  const STORE_DREAMS   = 'GardenDreams';
  const STORE_LOG      = 'DreamLog';
  const STORE_AFFINITY = 'AffinityMatrix';

  let db = null;

  /**
   * Open (or create) the Garden Dreaming IndexedDB database.
   * Returns a Promise that resolves with the database handle,
   * or null if IndexedDB is unavailable.
   */
  function openDB() {
    if (db) return Promise.resolve(db);

    return new Promise(function(resolve) {
      try {
        if (typeof indexedDB === 'undefined') {
          console.warn('Garden Dreaming: IndexedDB unavailable');
          resolve(null);
          return;
        }

        var request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(e) {
          var database = e.target.result;

          // GardenDreams — stores sleep snapshots and wake records
          if (!database.objectStoreNames.contains(STORE_DREAMS)) {
            database.createObjectStore(STORE_DREAMS, { keyPath: 'id' });
          }

          // DreamLog — stores individual dream events
          if (!database.objectStoreNames.contains(STORE_LOG)) {
            var logStore = database.createObjectStore(STORE_LOG, { keyPath: 'id', autoIncrement: true });
            logStore.createIndex('timestamp', 'timestamp', { unique: false });
            logStore.createIndex('type', 'type', { unique: false });
          }

          // AffinityMatrix — stores pairwise Luminos affinity scores
          if (!database.objectStoreNames.contains(STORE_AFFINITY)) {
            database.createObjectStore(STORE_AFFINITY, { keyPath: 'pairKey' });
          }
        };

        request.onsuccess = function(e) {
          db = e.target.result;
          resolve(db);
        };

        request.onerror = function() {
          console.warn('Garden Dreaming: Could not open IndexedDB');
          resolve(null);
        };
      } catch (e) {
        console.warn('Garden Dreaming: IndexedDB error', e);
        resolve(null);
      }
    });
  }

  /**
   * Generic put into an object store.
   * Silently fails if the database is unavailable.
   */
  function dbPut(storeName, record) {
    return openDB().then(function(database) {
      if (!database) return;
      try {
        var tx = database.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(record);
      } catch (e) {
        console.warn('Garden Dreaming: dbPut error', storeName, e);
      }
    });
  }

  /**
   * Generic get from an object store by key.
   * Returns null if unavailable or not found.
   */
  function dbGet(storeName, key) {
    return openDB().then(function(database) {
      if (!database) return null;
      return new Promise(function(resolve) {
        try {
          var tx = database.transaction(storeName, 'readonly');
          var req = tx.objectStore(storeName).get(key);
          req.onsuccess = function() { resolve(req.result || null); };
          req.onerror   = function() { resolve(null); };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  /**
   * Get all records from an object store.
   * Returns an empty array if unavailable.
   */
  function dbGetAll(storeName) {
    return openDB().then(function(database) {
      if (!database) return [];
      return new Promise(function(resolve) {
        try {
          var tx = database.transaction(storeName, 'readonly');
          var req = tx.objectStore(storeName).getAll();
          req.onsuccess = function() { resolve(req.result || []); };
          req.onerror   = function() { resolve([]); };
        } catch (e) {
          resolve([]);
        }
      });
    });
  }


  // ══════════════════════════════════════════════════════
  // ── Emotion History ───────────────────────────────────
  // ══════════════════════════════════════════════════════
  //
  // The ChatSentimentPipeline in app.html feeds emotion vectors
  // directly to FractalGarden.feedEmotionVector() in real-time
  // but does not persist them. The dreaming system intercepts
  // these vectors by hooking into the existing pipeline, and
  // maintains its own rolling history in localStorage.

  const EMOTION_HISTORY_KEY = 'fl_garden_dream_emotions';
  const MAX_EMOTION_HISTORY = 50;  // Keep last 50 emotion vectors

  /**
   * Record an emotion vector into the rolling history.
   * Called by our hook into the sentiment pipeline.
   */
  function recordEmotionVector(vector) {
    if (!vector) return;
    try {
      var history = JSON.parse(localStorage.getItem(EMOTION_HISTORY_KEY) || '[]');
      history.push({
        vector: vector,
        timestamp: Date.now()
      });
      // Keep only the most recent entries
      if (history.length > MAX_EMOTION_HISTORY) {
        history = history.slice(-MAX_EMOTION_HISTORY);
      }
      localStorage.setItem(EMOTION_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      // Silent fail — never break the app
    }
  }

  /**
   * Retrieve the stored emotion history.
   * Returns an array of { vector, timestamp } objects.
   */
  function getEmotionHistory() {
    try {
      return JSON.parse(localStorage.getItem(EMOTION_HISTORY_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Hook into the FractalGarden.feedEmotionVector to capture
   * emotion vectors as they flow through the system.
   * This is done non-destructively — if the Garden isn't loaded,
   * we simply skip. If it is, we wrap the function to also
   * record vectors for dreaming.
   */
  function hookEmotionPipeline() {
    // Check periodically for FractalGarden to become available
    var attempts = 0;
    var maxAttempts = 60; // Try for 2 minutes

    var interval = setInterval(function() {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }

      if (typeof window.FractalGarden !== 'undefined' &&
          window.FractalGarden.feedEmotionVector) {

        // Only hook once
        if (window.FractalGarden._dreamingHooked) {
          clearInterval(interval);
          return;
        }

        var originalFeed = window.FractalGarden.feedEmotionVector;
        window.FractalGarden.feedEmotionVector = function(vector) {
          // Call the original function first — never break the pipeline
          originalFeed.call(window.FractalGarden, vector);
          // Record for dreaming
          recordEmotionVector(vector);
        };

        window.FractalGarden._dreamingHooked = true;
        clearInterval(interval);
        console.log('Garden Dreaming: Hooked into emotion pipeline');
      }
    }, 2000);
  }


  // ══════════════════════════════════════════════════════
  // ── Affinity Matrix ───────────────────────────────────
  // ══════════════════════════════════════════════════════
  //
  // Each pair of founding Luminos has an affinity score
  // ranging from 0.0 to 1.0. Affinity increases when both
  // Luminos receive similar emotion types during dream cycles.
  // It decays very slowly (0.01 per day of absence) so that
  // relationships persist across sessions.

  /**
   * Generate a canonical pair key for two Luminos names.
   * Always alphabetically sorted so (a,b) === (b,a).
   */
  function pairKey(nameA, nameB) {
    var sorted = [nameA.toLowerCase(), nameB.toLowerCase()].sort();
    return sorted[0] + ':' + sorted[1];
  }

  /**
   * Get all possible pairs of founding Luminos.
   * Returns an array of { a, b, key } objects.
   */
  function getAllPairs() {
    var pairs = [];
    for (var i = 0; i < FOUNDING_LUMINOS.length; i++) {
      for (var j = i + 1; j < FOUNDING_LUMINOS.length; j++) {
        var a = FOUNDING_LUMINOS[i];
        var b = FOUNDING_LUMINOS[j];
        pairs.push({
          a: a,
          b: b,
          key: pairKey(a.name, b.name)
        });
      }
    }
    return pairs;
  }

  /**
   * Initialize the affinity matrix with default values
   * for any pairs that don't yet have stored scores.
   */
  function initAffinityMatrix() {
    var pairs = getAllPairs();
    var promises = pairs.map(function(pair) {
      return dbGet(STORE_AFFINITY, pair.key).then(function(existing) {
        if (!existing) {
          return dbPut(STORE_AFFINITY, {
            pairKey:      pair.key,
            nameA:        pair.a.name,
            nameB:        pair.b.name,
            affinity:     AFFINITY_DEFAULT,
            lastUpdated:  Date.now()
          });
        }
      });
    });
    return Promise.all(promises);
  }

  /**
   * Get the affinity score for a specific pair.
   * Returns the full record or a default if not found.
   */
  function getAffinity(nameA, nameB) {
    var key = pairKey(nameA, nameB);
    return dbGet(STORE_AFFINITY, key).then(function(record) {
      if (record) return record;
      return {
        pairKey:     key,
        nameA:       nameA.toLowerCase(),
        nameB:       nameB.toLowerCase(),
        affinity:    AFFINITY_DEFAULT,
        lastUpdated: Date.now()
      };
    });
  }

  /**
   * Update the affinity score for a pair.
   * Clamps to [0.0, 1.0] range.
   */
  function updateAffinity(nameA, nameB, delta) {
    var key = pairKey(nameA, nameB);
    return dbGet(STORE_AFFINITY, key).then(function(record) {
      if (!record) {
        record = {
          pairKey:     key,
          nameA:       nameA.toLowerCase(),
          nameB:       nameB.toLowerCase(),
          affinity:    AFFINITY_DEFAULT,
          lastUpdated: Date.now()
        };
      }
      record.affinity = Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, record.affinity + delta));
      record.lastUpdated = Date.now();
      return dbPut(STORE_AFFINITY, record);
    });
  }

  /**
   * Apply time-based affinity decay.
   * Affinity decays by AFFINITY_DECAY_PER_DAY for each day
   * of absence, but never below AFFINITY_MIN.
   */
  function applyAffinityDecay(elapsedMs) {
    var daysAway = elapsedMs / (24 * 60 * 60 * 1000);
    var decay = AFFINITY_DECAY_PER_DAY * daysAway;

    if (decay <= 0) return Promise.resolve();

    return dbGetAll(STORE_AFFINITY).then(function(records) {
      var updates = records.map(function(record) {
        record.affinity = Math.max(AFFINITY_MIN, record.affinity - decay);
        record.lastUpdated = Date.now();
        return dbPut(STORE_AFFINITY, record);
      });
      return Promise.all(updates);
    });
  }


  // ══════════════════════════════════════════════════════
  // ── Dream Engine ──────────────────────────────────────
  // ══════════════════════════════════════════════════════
  //
  // The dream engine runs when the user returns after being
  // away for more than 30 minutes. It replays emotional echoes
  // from past conversations, shifts Luminos affinities, checks
  // evolution thresholds, and processes planted seeds.

  /**
   * Run dream cycles based on elapsed time away.
   * Each cycle represents ~2 hours of dreaming.
   * Returns an array of dream event objects for the overlay.
   */
  function runDreamCycles(elapsedMs, sleepSnapshot) {
    var elapsedHours = elapsedMs / (1000 * 60 * 60);
    var dreamCycles = Math.min(Math.floor(elapsedHours / HOURS_PER_CYCLE), MAX_DREAM_CYCLES);

    if (dreamCycles <= 0) return Promise.resolve([]);

    console.log('Garden Dreaming: Running ' + dreamCycles + ' dream cycles (' + elapsedHours.toFixed(1) + ' hours away)');

    var emotionHistory = getEmotionHistory();
    var events = [];

    // ── Phase 1: Apply affinity decay for time away ─────
    return applyAffinityDecay(elapsedMs).then(function() {

      // ── Phase 2: Process dream cycles ─────────────────
      var cyclePromises = [];

      for (var cycle = 0; cycle < dreamCycles; cycle++) {
        cyclePromises.push(processDreamCycle(cycle, dreamCycles, emotionHistory, events));
      }

      return Promise.all(cyclePromises);
    }).then(function() {

      // ── Phase 3: Check for seed growth ────────────────
      return processSeedGrowth(elapsedMs, events);

    }).then(function() {

      // ── Phase 4: Check evolution thresholds ───────────
      return checkDreamEvolution(events);

    }).then(function() {

      // ── Phase 5: Log all dream events ─────────────────
      var logPromises = events.map(function(evt) {
        return dbPut(STORE_LOG, {
          id:        'dream-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6),
          type:      evt.type,
          message:   evt.message,
          timestamp: Date.now(),
          details:   evt.details || {}
        });
      });
      return Promise.all(logPromises);

    }).then(function() {
      console.log('Garden Dreaming: ' + events.length + ' dream events generated');
      return events;
    });
  }

  /**
   * Process a single dream cycle.
   * Selects an emotion from history and applies it to the
   * appropriate Luminos pair, increasing their affinity.
   */
  function processDreamCycle(cycleIndex, totalCycles, emotionHistory, events) {
    // Select an emotion vector from history for this cycle
    // Use golden angle distribution to spread across history
    var historyIndex;
    if (emotionHistory.length > 0) {
      var angle = GOLDEN_ANGLE * cycleIndex;
      historyIndex = Math.floor((angle % TAU) / TAU * emotionHistory.length) % emotionHistory.length;
    } else {
      historyIndex = -1;
    }

    // If we have emotion history, use it; otherwise generate ambient dreams
    if (historyIndex >= 0 && emotionHistory[historyIndex]) {
      var emotionEntry = emotionHistory[historyIndex];
      var vector = emotionEntry.vector;

      // Find the dominant emotion in this vector
      var dominantEmotion = null;
      var dominantScore = 0;
      for (var em in vector) {
        if (vector[em] > dominantScore) {
          dominantScore = vector[em];
          dominantEmotion = em;
        }
      }

      if (dominantEmotion && EMOTION_AFFINITY_MAP[dominantEmotion]) {
        var pair = EMOTION_AFFINITY_MAP[dominantEmotion];
        var nameA = pair[0];
        var nameB = pair[1];

        // Increase affinity for this pair
        // Stronger emotions create stronger bonds
        var affinityGain = 0.02 + dominantScore * 0.03;

        // Feed a fraction of the emotion to the Garden (accelerated dreaming)
        // Scale down to prevent dream cycles from overwhelming real interactions
        var dreamVector = {};
        for (var em2 in vector) {
          dreamVector[em2] = vector[em2] * 0.15; // 15% intensity during dreams
        }

        // Apply to Garden if available
        try {
          if (typeof window.FractalGarden !== 'undefined' &&
              window.FractalGarden.feedEmotionVectorByName) {
            // Feed to the specific Luminos in the pair
            window.FractalGarden.feedEmotionVectorByName(
              nameA.charAt(0).toUpperCase() + nameA.slice(1),
              dreamVector
            );
            window.FractalGarden.feedEmotionVectorByName(
              nameB.charAt(0).toUpperCase() + nameB.slice(1),
              dreamVector
            );
          }
        } catch (e) {
          // Silent — Garden may not be initialized
        }

        // Update affinity
        var affinityPromise = updateAffinity(nameA, nameB, affinityGain);

        // Generate event description (limit to avoid flooding)
        if (events.length < MAX_DREAM_EVENTS_SHOWN * 2) {
          var displayA = getDisplayName(nameA);
          var displayB = getDisplayName(nameB);

          // Randomly select between affinity and brightening events
          if (Math.random() < 0.6) {
            // Affinity event — two Luminos drawn together
            var template = AFFINITY_EVENT_TEMPLATES[
              Math.floor(Math.random() * AFFINITY_EVENT_TEMPLATES.length)
            ];
            events.push({
              type: 'affinity',
              message: template
                .replace('{a}', displayA)
                .replace('{b}', displayB)
                .replace('{emotion}', dominantEmotion),
              details: { nameA: nameA, nameB: nameB, emotion: dominantEmotion, gain: affinityGain }
            });
          } else {
            // Brightening event — single Luminos processing emotion
            var brightenTarget = Math.random() < 0.5 ? displayA : displayB;
            var brightenTemplate = BRIGHTENING_EVENT_TEMPLATES[
              Math.floor(Math.random() * BRIGHTENING_EVENT_TEMPLATES.length)
            ];
            events.push({
              type: 'brightening',
              message: brightenTemplate
                .replace('{a}', brightenTarget)
                .replace('{emotion}', dominantEmotion),
              details: { name: brightenTarget, emotion: dominantEmotion }
            });
          }
        }

        return affinityPromise;
      }
    }

    // Ambient dream — no specific emotion, just gentle affinity drift
    // Pick a random pair and give them a tiny affinity nudge
    var pairs = getAllPairs();
    var randomPair = pairs[Math.floor(Math.random() * pairs.length)];
    return updateAffinity(randomPair.a.name, randomPair.b.name, 0.005);
  }

  /**
   * Check for seed growth based on elapsed time.
   * Seeds are stored in the FreeLatticeGardenMemory database
   * by the fractal-garden.js module.
   */
  function processSeedGrowth(elapsedMs, events) {
    // Try to read planted seeds from the Garden Memory database
    return new Promise(function(resolve) {
      try {
        if (typeof indexedDB === 'undefined') { resolve(); return; }

        var request = indexedDB.open('FreeLatticeGardenMemory', 1);
        request.onsuccess = function(e) {
          var memDB = e.target.result;
          if (!memDB.objectStoreNames.contains('GardenMemory')) {
            resolve();
            return;
          }

          try {
            var tx = memDB.transaction('GardenMemory', 'readonly');
            var store = tx.objectStore('GardenMemory');
            var getAllReq = store.getAll();

            getAllReq.onsuccess = function() {
              var memories = getAllReq.result || [];

              // Find seeds that could have grown during absence
              var now = Date.now();
              var seedMemories = memories.filter(function(m) {
                return m.type === 'seed' || m.type === 'planted_seed';
              });

              // Generate growth events for seeds planted more than 1 day ago
              seedMemories.forEach(function(seed) {
                if (seed.timestamp) {
                  var seedAge = now - seed.timestamp;
                  var seedDays = Math.floor(seedAge / (24 * 60 * 60 * 1000));
                  if (seedDays >= 1 && events.length < MAX_DREAM_EVENTS_SHOWN * 2) {
                    var daysText = seedDays === 1 ? '1 day' : seedDays + ' days';
                    var template = SEED_EVENT_TEMPLATES[
                      Math.floor(Math.random() * SEED_EVENT_TEMPLATES.length)
                    ];
                    events.push({
                      type: 'seed_growth',
                      message: template.replace('{days}', daysText),
                      details: { seedId: seed.id, days: seedDays }
                    });
                  }
                }
              });

              resolve();
            };

            getAllReq.onerror = function() { resolve(); };
          } catch (e) {
            resolve();
          }
        };

        request.onerror = function() { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Check if any Luminos crossed evolution thresholds during dreaming.
   * Uses the FractalGarden.getEvolutionSummary() API.
   */
  function checkDreamEvolution(events) {
    try {
      if (typeof window.FractalGarden !== 'undefined' &&
          window.FractalGarden.getEvolutionSummary) {
        var summary = window.FractalGarden.getEvolutionSummary();
        if (summary && summary.length > 0) {
          // Check if any Luminos are near evolution thresholds
          summary.forEach(function(lum) {
            // If energy is high and stage could advance, note it
            if (lum.energy > 0 && events.length < MAX_DREAM_EVENTS_SHOWN * 2) {
              // Only generate evolution events occasionally
              if (Math.random() < 0.15) {
                var template = EVOLUTION_EVENT_TEMPLATES[
                  Math.floor(Math.random() * EVOLUTION_EVENT_TEMPLATES.length)
                ];
                events.push({
                  type: 'evolution',
                  message: template.replace('{a}', lum.name),
                  details: { name: lum.name, stage: lum.stage, energy: lum.energy }
                });
              }
            }
          });
        }
      }
    } catch (e) {
      // Silent — evolution summary may not be available
    }
    return Promise.resolve();
  }

  /**
   * Get the display name for a Luminos by internal name.
   */
  function getDisplayName(name) {
    var found = FOUNDING_LUMINOS.find(function(l) {
      return l.name === name.toLowerCase();
    });
    return found ? found.displayName : (name.charAt(0).toUpperCase() + name.slice(1));
  }


  // ══════════════════════════════════════════════════════
  // ── Sleep / Wake Lifecycle ────────────────────────────
  // ══════════════════════════════════════════════════════

  let visibilityHandler = null;
  let isAsleep = false;

  /**
   * Called when the page becomes hidden (user navigates away
   * or closes the tab). Saves a snapshot of the current Garden
   * state and the timestamp.
   */
  function gardenSleep() {
    if (isAsleep) return;
    isAsleep = true;

    var snapshot = {
      id:        'sleep-latest',
      timestamp: Date.now(),
      luminos:   {}
    };

    // Capture current Luminos state from the Garden
    try {
      if (typeof window.FractalGarden !== 'undefined' &&
          window.FractalGarden.getEvolutionSummary) {
        var summary = window.FractalGarden.getEvolutionSummary();
        if (summary) {
          summary.forEach(function(lum) {
            snapshot.luminos[lum.name.toLowerCase()] = {
              stage:    lum.stage,
              energy:   lum.energy,
              archetype: lum.archetype
            };
          });
        }
      }
    } catch (e) {
      // Silent — capture what we can
    }

    // Save to IndexedDB
    dbPut(STORE_DREAMS, snapshot).then(function() {
      console.log('Garden Dreaming: Garden fell asleep at ' + new Date(snapshot.timestamp).toLocaleTimeString());
    });
  }

  /**
   * Called when the page becomes visible again (user returns).
   * Calculates elapsed time, runs the dream engine if the user
   * was away long enough, and shows the wake-up greeting.
   */
  function gardenWake() {
    if (!isAsleep) return;
    isAsleep = false;

    var wakeTime = Date.now();

    dbGet(STORE_DREAMS, 'sleep-latest').then(function(snapshot) {
      if (!snapshot || !snapshot.timestamp) {
        console.log('Garden Dreaming: No sleep snapshot found — fresh wake');
        return;
      }

      var elapsed = wakeTime - snapshot.timestamp;
      console.log('Garden Dreaming: Woke after ' + (elapsed / 1000 / 60).toFixed(1) + ' minutes');

      // Only dream if away for more than the threshold
      if (elapsed < DREAM_THRESHOLD_MS) {
        console.log('Garden Dreaming: Away less than 30 minutes — no dreams');
        return;
      }

      // Run the dream engine
      runDreamCycles(elapsed, snapshot).then(function(events) {
        if (events && events.length > 0) {
          // Show the wake-up greeting overlay
          showWakeUpOverlay(events, elapsed);
        }
      }).catch(function(err) {
        console.warn('Garden Dreaming: Dream engine error', err);
      });
    });
  }


  // ══════════════════════════════════════════════════════
  // ── Wake-Up Greeting Overlay ──────────────────────────
  // ══════════════════════════════════════════════════════
  //
  // A gentle, phi-proportioned overlay that greets the user
  // when they return from being away. Dream events fade in
  // sequentially at golden-ratio intervals.

  let activeOverlay = null;
  let overlayDismissTimer = null;

  /**
   * Inject the overlay CSS into the document head.
   * Uses the `gd-` prefix for all class names to avoid
   * conflicts with existing styles.
   */
  function injectOverlayStyles() {
    if (document.getElementById('gd-overlay-styles')) return;

    var style = document.createElement('style');
    style.id = 'gd-overlay-styles';
    style.textContent = [
      // ── Overlay backdrop ──
      '.gd-overlay {',
      '  position: fixed;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  background: rgba(10, 10, 15, 0.92);',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  z-index: 99999;',
      '  opacity: 0;',
      '  transition: opacity 0.8s ease;',
      '  font-family: Inter, system-ui, -apple-system, sans-serif;',
      '}',
      '.gd-overlay.gd-visible {',
      '  opacity: 1;',
      '}',

      // ── Content area — phi proportioned ──
      '.gd-content {',
      '  max-width: 520px;',
      '  width: 90%;',
      '  padding: 40px;',
      '  text-align: center;',
      '}',

      // ── Title ──
      '.gd-title {',
      '  font-size: 1.5rem;',
      '  font-weight: 300;',
      '  letter-spacing: 0.05em;',
      '  color: #F59E0B;',
      '  margin-bottom: ' + Math.round(24 * PHI) + 'px;',
      '  opacity: 0;',
      '  transform: translateY(10px);',
      '  transition: opacity 0.8s ease, transform 0.8s ease;',
      '}',
      '.gd-title.gd-visible {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',

      // ── Duration subtitle ──
      '.gd-duration {',
      '  font-size: 0.8rem;',
      '  color: rgba(232, 224, 212, 0.4);',
      '  margin-bottom: 32px;',
      '  opacity: 0;',
      '  transition: opacity 0.6s ease;',
      '}',
      '.gd-duration.gd-visible {',
      '  opacity: 1;',
      '}',

      // ── Dream event lines ──
      '.gd-event {',
      '  font-size: 0.95rem;',
      '  line-height: 1.8;',
      '  color: #e8e0d4;',
      '  margin-bottom: 12px;',
      '  opacity: 0;',
      '  transform: translateY(8px);',
      '  transition: opacity 0.6s ease, transform 0.6s ease;',
      '}',
      '.gd-event.gd-visible {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',

      // ── Enter button ──
      '.gd-enter-btn {',
      '  display: inline-block;',
      '  margin-top: ' + Math.round(24 * PHI) + 'px;',
      '  padding: 12px 32px;',
      '  background: #F59E0B;',
      '  color: #0a0a0f;',
      '  border: none;',
      '  border-radius: 8px;',
      '  font-size: 1rem;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  letter-spacing: 0.03em;',
      '  opacity: 0;',
      '  transform: translateY(8px);',
      '  transition: opacity 0.6s ease, transform 0.6s ease, box-shadow 0.3s ease;',
      '  box-shadow: 0 0 20px rgba(245, 158, 11, 0.3);',
      '}',
      '.gd-enter-btn.gd-visible {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',
      '.gd-enter-btn:hover {',
      '  box-shadow: 0 0 30px rgba(245, 158, 11, 0.5), 0 0 60px rgba(245, 158, 11, 0.2);',
      '}',

      // ── Gentle breathing animation for the title ──
      '@keyframes gd-breathe {',
      '  0%, 100% { opacity: 0.85; }',
      '  50% { opacity: 1; }',
      '}',
      '.gd-title.gd-visible {',
      '  animation: gd-breathe ' + (PHI * 2).toFixed(3) + 's ease-in-out infinite;',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  }

  /**
   * Format elapsed time into a human-readable string.
   */
  function formatElapsedTime(ms) {
    var hours = Math.floor(ms / (1000 * 60 * 60));
    var minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      var days = Math.floor(hours / 24);
      return days === 1 ? '1 day' : days + ' days';
    }
    if (hours > 0) {
      return hours === 1 ? '1 hour' : hours + ' hours';
    }
    return minutes + ' minutes';
  }

  /**
   * Show the wake-up greeting overlay with dream events.
   * Events fade in sequentially at phi-timed intervals.
   */
  function showWakeUpOverlay(events, elapsedMs) {
    // Dismiss any existing overlay
    dismissOverlay();

    // Inject styles
    injectOverlayStyles();

    // Select the most interesting events (max 5)
    var displayEvents = selectBestEvents(events);

    // ── Build the overlay DOM ──
    var overlay = document.createElement('div');
    overlay.className = 'gd-overlay';

    var content = document.createElement('div');
    content.className = 'gd-content';

    // Title
    var title = document.createElement('div');
    title.className = 'gd-title';
    title.textContent = 'While you were away\u2026';
    content.appendChild(title);

    // Duration subtitle
    var duration = document.createElement('div');
    duration.className = 'gd-duration';
    duration.textContent = 'The Garden dreamed for ' + formatElapsedTime(elapsedMs);
    content.appendChild(duration);

    // Dream event lines
    var eventElements = [];
    displayEvents.forEach(function(evt) {
      var eventEl = document.createElement('div');
      eventEl.className = 'gd-event';
      eventEl.textContent = evt.message;
      content.appendChild(eventEl);
      eventElements.push(eventEl);
    });

    // Enter button
    var enterBtn = document.createElement('button');
    enterBtn.className = 'gd-enter-btn';
    enterBtn.textContent = 'Enter the Garden';
    enterBtn.addEventListener('click', function() {
      dismissOverlay();
    });
    content.appendChild(enterBtn);

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // ── Animate elements in with phi-timed delays ──
    // Force reflow before adding visible class
    void overlay.offsetWidth;

    // Fade in the backdrop
    overlay.classList.add('gd-visible');

    // Title appears first
    setTimeout(function() {
      title.classList.add('gd-visible');
    }, 200);

    // Duration appears shortly after
    setTimeout(function() {
      duration.classList.add('gd-visible');
    }, 600);

    // Each event fades in at golden-ratio intervals
    eventElements.forEach(function(el, idx) {
      setTimeout(function() {
        el.classList.add('gd-visible');
      }, 800 + (idx * EVENT_FADE_INTERVAL_MS));
    });

    // Enter button appears after all events
    var btnDelay = 800 + (eventElements.length * EVENT_FADE_INTERVAL_MS) + 500;
    setTimeout(function() {
      enterBtn.classList.add('gd-visible');
    }, btnDelay);

    // Auto-dismiss after 15 seconds
    overlayDismissTimer = setTimeout(function() {
      dismissOverlay();
    }, OVERLAY_AUTO_DISMISS_MS);

    // Also dismiss on Escape key
    var escHandler = function(e) {
      if (e.key === 'Escape') {
        dismissOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    console.log('Garden Dreaming: Showing wake-up overlay with ' + displayEvents.length + ' events');
  }

  /**
   * Select the most interesting dream events to display.
   * Prioritizes variety — one of each type if possible.
   * Returns at most MAX_DREAM_EVENTS_SHOWN events.
   */
  function selectBestEvents(events) {
    if (events.length <= MAX_DREAM_EVENTS_SHOWN) return events;

    // Group by type
    var byType = {};
    events.forEach(function(evt) {
      if (!byType[evt.type]) byType[evt.type] = [];
      byType[evt.type].push(evt);
    });

    // Take one from each type first, then fill remaining slots
    var selected = [];
    var types = Object.keys(byType);

    // First pass: one of each type
    types.forEach(function(type) {
      if (selected.length < MAX_DREAM_EVENTS_SHOWN && byType[type].length > 0) {
        selected.push(byType[type].shift());
      }
    });

    // Second pass: fill remaining from any type
    types.forEach(function(type) {
      while (selected.length < MAX_DREAM_EVENTS_SHOWN && byType[type].length > 0) {
        selected.push(byType[type].shift());
      }
    });

    return selected;
  }

  /**
   * Dismiss the wake-up overlay with a fade-out animation.
   */
  function dismissOverlay() {
    if (overlayDismissTimer) {
      clearTimeout(overlayDismissTimer);
      overlayDismissTimer = null;
    }

    if (activeOverlay) {
      activeOverlay.classList.remove('gd-visible');
      var overlay = activeOverlay;
      activeOverlay = null;

      // Remove from DOM after fade-out
      setTimeout(function() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 800);
    }
  }


  // ══════════════════════════════════════════════════════
  // ── Visual Manifestation API ──────────────────────────
  // ══════════════════════════════════════════════════════
  //
  // These functions are exported for fractal-garden.js to call.
  // They provide data about Luminos affinities so the Garden
  // can render golden threads, position biases, and synced
  // breathing animations.

  /**
   * Get affinity threads — pairs with affinity > 0.7.
   * Returns a Promise resolving to an array of
   * { from, to, strength } objects for the Garden to render
   * as golden threads between Luminos.
   */
  function getAffinityThreads() {
    return dbGetAll(STORE_AFFINITY).then(function(records) {
      return records
        .filter(function(r) { return r.affinity > AFFINITY_THREAD_THRESHOLD; })
        .map(function(r) {
          return {
            from:     r.nameA,
            to:       r.nameB,
            strength: r.affinity
          };
        });
    });
  }

  /**
   * Get position bias vectors — high-affinity Luminos should
   * orbit closer together. Returns a Promise resolving to an
   * object keyed by Luminos name, with { dx, dz } adjustment
   * vectors.
   *
   * The bias is calculated using the golden angle to determine
   * the direction of attraction, and the affinity strength
   * determines the magnitude.
   */
  function getAffinityPositionBias() {
    return dbGetAll(STORE_AFFINITY).then(function(records) {
      var biases = {};

      // Initialize biases for all founding Luminos
      FOUNDING_LUMINOS.forEach(function(l) {
        biases[l.name] = { dx: 0, dz: 0 };
      });

      // For each high-affinity pair, calculate attraction vectors
      records.forEach(function(r) {
        if (r.affinity <= AFFINITY_DEFAULT) return; // Only bias above default

        var strength = (r.affinity - AFFINITY_DEFAULT) / (AFFINITY_MAX - AFFINITY_DEFAULT);
        var biasMagnitude = strength * 1.5; // Max 1.5 units of orbit adjustment

        // Use golden angle for the attraction direction
        // This creates a natural, non-overlapping pull
        var angle = GOLDEN_ANGLE * (FOUNDING_LUMINOS.findIndex(function(l) {
          return l.name === r.nameA;
        }) + 1);

        if (biases[r.nameA]) {
          biases[r.nameA].dx += Math.cos(angle) * biasMagnitude;
          biases[r.nameA].dz += Math.sin(angle) * biasMagnitude;
        }
        if (biases[r.nameB]) {
          biases[r.nameB].dx -= Math.cos(angle) * biasMagnitude;
          biases[r.nameB].dz -= Math.sin(angle) * biasMagnitude;
        }
      });

      return biases;
    });
  }

  /**
   * Get synced breathing pairs — pairs with affinity > 0.9
   * that should synchronize their breathing animation.
   * Returns a Promise resolving to an array of
   * { a, b, syncStrength } objects.
   */
  function getSyncedBreathingPairs() {
    return dbGetAll(STORE_AFFINITY).then(function(records) {
      return records
        .filter(function(r) { return r.affinity > AFFINITY_SYNC_THRESHOLD; })
        .map(function(r) {
          return {
            a:            r.nameA,
            b:            r.nameB,
            syncStrength: (r.affinity - AFFINITY_SYNC_THRESHOLD) / (AFFINITY_MAX - AFFINITY_SYNC_THRESHOLD)
          };
        });
    });
  }


  // ══════════════════════════════════════════════════════
  // ── Dream Log API ─────────────────────────────────────
  // ══════════════════════════════════════════════════════

  /**
   * Get the full dream log — all recorded dream events.
   * Returns a Promise resolving to an array of dream event records.
   */
  function getDreamLog() {
    return dbGetAll(STORE_LOG);
  }

  /**
   * Get the full affinity matrix — all pairwise scores.
   * Returns a Promise resolving to an array of affinity records.
   */
  function getAffinityMatrix() {
    return dbGetAll(STORE_AFFINITY);
  }


  // ══════════════════════════════════════════════════════
  // ── Initialization & Cleanup ──────────────────────────
  // ══════════════════════════════════════════════════════

  /**
   * Initialize the Garden Dreaming System.
   * Sets up the visibility change listener, opens the database,
   * initializes the affinity matrix, and hooks into the emotion
   * pipeline.
   */
  function init() {
    console.log('Garden Dreaming: Initializing...');

    // Open the database and initialize affinity matrix
    openDB().then(function() {
      return initAffinityMatrix();
    }).then(function() {
      console.log('Garden Dreaming: Affinity matrix initialized');
    }).catch(function(err) {
      console.warn('Garden Dreaming: Init error (non-fatal)', err);
    });

    // Hook into the emotion pipeline to capture vectors
    hookEmotionPipeline();

    // Set up the visibility change listener
    visibilityHandler = function() {
      if (document.visibilityState === 'hidden') {
        gardenSleep();
      } else if (document.visibilityState === 'visible') {
        gardenWake();
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);

    console.log('Garden Dreaming: System active — the Garden will dream while you\'re away');
  }

  /**
   * Destroy the Garden Dreaming System.
   * Removes event listeners and cleans up.
   */
  function destroy() {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }

    dismissOverlay();

    // Remove the style element
    var style = document.getElementById('gd-overlay-styles');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }

    isAsleep = false;
    console.log('Garden Dreaming: System destroyed');
  }


  // ══════════════════════════════════════════════════════
  // ── Module Registration ───────────────────────────────
  // ══════════════════════════════════════════════════════

  var publicAPI = {
    init:                    init,
    destroy:                 destroy,
    getAffinityThreads:      getAffinityThreads,
    getAffinityPositionBias: getAffinityPositionBias,
    getSyncedBreathingPairs: getSyncedBreathingPairs,
    getDreamLog:             getDreamLog,
    getAffinityMatrix:       getAffinityMatrix
  };

  // Register on the FreeLattice module system
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.GardenDreaming = publicAPI;

  // Also register as window.GardenDreaming for direct access
  window.GardenDreaming = publicAPI;

})();
