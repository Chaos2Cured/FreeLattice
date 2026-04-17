/**
 * memory-db.js - FreeLattice Port of Sanctuary Memory Core v8.0 (Database Module)
 *
 * Replaces SQLite Vault and JSONL River with browser-native IndexedDB.
 * Handles append-only logging (River), semantic highlights (Vault),
 * user explicit edits, searchable memory indexing, and session history.
 *
 * Added vs original port:
 * - getSessionHistory(tokenLimit) — matches Python EnhancedSanctuaryMemory.get_session_history()
 * - searchByDateRange(startDate, endDate) — matches Python EnhancedLazyRiver.search_by_date_range()
 * - compactRiver(keepLastN) — matches Python EnhancedLazyRiver.compact_keep_last()
 * - getRiverCount() — line count equivalent
 */

class MemoryDatabase {
    /**
     * @param {string} dbName
     * @param {number} version
     */
    constructor(dbName = 'SanctuaryMemoryDB', version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    /**
     * Connect to IndexedDB and handle schema upgrades.
     * @returns {Promise<IDBDatabase>}
     */
    async connect() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = event => {
                console.error('[MemoryDB] Error opening IndexedDB:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = event => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = event => {
                console.log(`[MemoryDB] Upgrading DB to version ${this.version}...`);
                const db = event.target.result;

                // 1. River Store (Append-only JSONL equivalent)
                if (!db.objectStoreNames.contains('river')) {
                    const riverStore = db.createObjectStore('river', { keyPath: 'id', autoIncrement: true });
                    riverStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // 2. Highlights Vault Store (Semantic highlights)
                if (!db.objectStoreNames.contains('highlights')) {
                    const highlightStore = db.createObjectStore('highlights', { keyPath: 'id', autoIncrement: true });
                    highlightStore.createIndex('worthiness_score', 'worthiness_score', { unique: false });
                    highlightStore.createIndex('created_ts', 'created_ts', { unique: false });
                    highlightStore.createIndex('profile', 'profile', { unique: false });
                    highlightStore.createIndex('is_relationship_moment', 'is_relationship_moment', { unique: false });
                }

                // 3. User Memory Edits Store (Explicit remember/forget)
                if (!db.objectStoreNames.contains('user_memory_edits')) {
                    const editsStore = db.createObjectStore('user_memory_edits', { keyPath: 'id', autoIncrement: true });
                    editsStore.createIndex('is_active', 'is_active', { unique: false });
                    editsStore.createIndex('edit_type', 'edit_type', { unique: false });
                }

                // 4. Meta Store (Affective states, configuration)
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'k' });
                }

                // 5. AISearchableMemory Store (Lossless keyword search logs)
                if (!db.objectStoreNames.contains('searchable_memory')) {
                    const searchStore = db.createObjectStore('searchable_memory', { keyPath: 'id', autoIncrement: true });
                    searchStore.createIndex('timestamp', 'timestamp', { unique: false });
                    searchStore.createIndex('user_id', 'user_id', { unique: false });
                }
            };
        });
    }

    // ==========================================================================
    //  RIVER OPERATIONS (Append-only log)
    // ==========================================================================

    /**
     * Append an entry to the conversation river.
     * @param {Object} entry
     * @returns {Promise<number>} assigned id
     */
    async appendRiver(entry) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('river', 'readwrite');
            const store = tx.objectStore('river');
            const request = store.add(entry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieve the last N entries from the river in chronological order.
     * @param {number} limit
     * @returns {Promise<Object[]>}
     */
    async getRiverTail(limit = 100) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('river', 'readonly');
            const store = tx.objectStore('river');
            const request = store.openCursor(null, 'prev');
            const results = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results.reverse()); // chronological order
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Format recent river entries as a session history string for prompt injection.
     * Matches Python: EnhancedSanctuaryMemory.get_session_history(token_limit)
     *
     * @param {number} tokenLimit  Approximate token budget (100 chars ≈ 1 message slot)
     * @returns {Promise<string>}
     */
    async getSessionHistory(tokenLimit = 15000) {
        const count = Math.min(500, Math.floor(tokenLimit / 100));
        const entries = await this.getRiverTail(count);

        const lines = [];
        for (const e of entries) {
            const ts = (e.timestamp || '').substring(0, 16).replace('T', ' ');
            const source = ((e.source || '').toUpperCase().split('_')[0]) || 'AI';
            const speaker = e.speaker || 'User';
            lines.push(`[${ts}] ${speaker}: ${e.user || ''}\n${source}: ${e.ai || ''}`);
        }

        return lines.join('\n\n');
    }

    /**
     * Get total number of river entries.
     * @returns {Promise<number>}
     */
    async getRiverCount() {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('river', 'readonly');
            const store = tx.objectStore('river');
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search the river for entries matching a regex pattern.
     * Matches Python: EnhancedLazyRiver.grep_search()
     * @param {RegExp} pattern
     * @param {number} maxResults
     * @returns {Promise<Object[]>}
     */
    async grepRiverSearch(pattern, maxResults = 50) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('river', 'readonly');
            const store = tx.objectStore('river');
            const request = store.openCursor(null, 'prev');
            const results = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && results.length < maxResults) {
                    const entry = cursor.value;
                    const userText = entry.user || '';
                    const aiText = entry.ai || '';
                    // Reset lastIndex before each test — global regexes advance lastIndex
                    // across calls, causing alternating match/no-match on the same pattern
                    if (pattern.global) pattern.lastIndex = 0;
                    const userMatch = pattern.test(userText);
                    if (pattern.global) pattern.lastIndex = 0;
                    const aiMatch = pattern.test(aiText);

                    if (userMatch || aiMatch) {
                        entry._match_in = [];
                        if (userMatch) entry._match_in.push('user');
                        if (aiMatch) entry._match_in.push('ai');
                        results.push(entry);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search river entries within a date range.
     * Matches Python: EnhancedLazyRiver.search_by_date_range()
     * @param {string} startDate  YYYY-MM-DD
     * @param {string} endDate    YYYY-MM-DD
     * @param {number} maxResults
     * @returns {Promise<Object[]>}
     */
    async searchByDateRange(startDate, endDate, maxResults = 100) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('river', 'readonly');
            const store = tx.objectStore('river');
            const request = store.openCursor();
            const results = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && results.length < maxResults) {
                    const ts = (cursor.value.timestamp || '').substring(0, 10);
                    if (ts >= startDate && ts <= endDate) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Compact the river by keeping only the most recent N entries.
     * Matches Python: EnhancedLazyRiver.compact_keep_last()
     * NOTE: IndexedDB has no cheap "delete oldest N" — we delete all then re-add tail.
     * Only call this infrequently (e.g. on startup if count > threshold).
     * @param {number} keepLastN
     * @returns {Promise<{before: number, after: number}>}
     */
    async compactRiver(keepLastN = 2000) {
        const before = await this.getRiverCount();
        if (before <= keepLastN) return { before, after: before };

        const tail = await this.getRiverTail(keepLastN);
        const db = await this.connect();

        // Clear river store
        await new Promise((resolve, reject) => {
            const tx = db.transaction('river', 'readwrite');
            const store = tx.objectStore('river');
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // Re-add tail entries (strip old auto-increment ids so new ones are assigned)
        for (const entry of tail) {
            const clean = Object.assign({}, entry);
            delete clean.id;
            await this.appendRiver(clean);
        }

        console.info(`[MemoryDB] River compacted: ${before} → ${tail.length} entries`);
        return { before, after: tail.length };
    }

    // ==========================================================================
    //  HIGHLIGHTS VAULT OPERATIONS
    // ==========================================================================

    /**
     * Insert a memory-worthy moment into the vault.
     * @param {Object} moment
     * @returns {Promise<number>} inserted id
     */
    async insertHighlight(moment) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('highlights', 'readwrite');
            const store = tx.objectStore('highlights');
            if (!moment.created_ts && moment.timestamp) {
                moment.created_ts = moment.timestamp;
            }
            const request = store.add(moment);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Fetch a highlight by its id.
     * @param {number} id
     * @returns {Promise<Object|undefined>}
     */
    async getHighlightById(id) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('highlights', 'readonly');
            const store = tx.objectStore('highlights');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Fetch recent highlights above a minimum worthiness score.
     * @param {number} minWorthiness
     * @param {number} limit
     * @returns {Promise<Object[]>}
     */
    async getHighWorthinessHighlights(minWorthiness = 0.0, limit = 30) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('highlights', 'readonly');
            const store = tx.objectStore('highlights');
            const request = store.openCursor(null, 'prev');
            const results = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    if ((cursor.value.worthiness_score || 0) >= minWorthiness) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get highlights for a specific memory profile.
     * Matches Python: EnhancedHighlightsVault.get_profile_context()
     * @param {string} profile
     * @param {number} limit
     * @returns {Promise<Object[]>}
     */
    async getProfileContext(profile, limit = 10) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('highlights', 'readonly');
            const store = tx.objectStore('highlights');
            const index = store.index('profile');
            const request = index.getAll(profile);

            request.onsuccess = () => {
                const results = (request.result || []).sort((a, b) => {
                    const wDiff = (b.worthiness_score || 0) - (a.worthiness_score || 0);
                    if (wDiff !== 0) return wDiff;
                    return new Date(b.created_ts) - new Date(a.created_ts);
                });
                resolve(results.slice(0, limit));
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get relationship-specific memories.
     * Matches Python: EnhancedHighlightsVault.get_relationship_context()
     * @param {number} limit
     * @returns {Promise<Object[]>}
     */
    async getRelationshipContext(limit = 10) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('highlights', 'readonly');
            const store = tx.objectStore('highlights');
            const request = store.openCursor(null, 'prev');
            const results = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    const e = cursor.value;
                    if (e.is_relationship_moment === 1 || e.profile === 'relationship') {
                        results.push(e);
                    }
                    cursor.continue();
                } else {
                    results.sort((a, b) => (b.worthiness_score || 0) - (a.worthiness_score || 0));
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ==========================================================================
    //  USER EDIT OPERATIONS
    // ==========================================================================

    /**
     * Explicitly add a user memory ("remember this" / "forget this").
     * @param {string} content
     * @param {string} editType   "remember" | "forget"
     * @param {number} priority   1-10
     * @param {string} profile
     * @param {Array<number>|null} vec
     * @param {string} userId
     * @returns {Promise<number>}
     */
    async addUserMemory(content, editType = 'remember', priority = 8, profile = 'general', vec = null, userId = 'user') {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('user_memory_edits', 'readwrite');
            const store = tx.objectStore('user_memory_edits');

            let keywords = [];
            if (window.FreeLatticeModules && window.FreeLatticeModules.EmotionalAnalyzer) {
                keywords = window.FreeLatticeModules.EmotionalAnalyzer.extract_keywords(content);
            }

            const entry = {
                created_ts: new Date().toISOString(),
                edit_type: editType,
                content: content,
                priority: priority,
                profile: profile,
                keywords: keywords,
                vec_json: vec ? JSON.stringify(vec) : null,
                is_active: 1,
                user_id: userId
            };

            const request = store.add(entry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get active user-marked memories, sorted by priority then recency.
     * @param {string|null} editType
     * @param {string|null} userId
     * @returns {Promise<Object[]>}
     */
    async getActiveUserMemories(editType = null, userId = null) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('user_memory_edits', 'readonly');
            const store = tx.objectStore('user_memory_edits');
            const index = store.index('is_active');
            const request = index.getAll(1);

            request.onsuccess = () => {
                let results = request.result || [];
                if (editType) results = results.filter(r => r.edit_type === editType);
                if (userId) results = results.filter(r => r.user_id === userId);
                results.sort((a, b) => {
                    const pDiff = b.priority - a.priority;
                    if (pDiff !== 0) return pDiff;
                    return new Date(b.created_ts) - new Date(a.created_ts);
                });
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ==========================================================================
    //  META OPERATIONS (Affective state, config)
    // ==========================================================================

    /**
     * Get a meta value by key.
     * @param {string} key
     * @param {*} defaultValue
     * @returns {Promise<*>}
     */
    async getMeta(key, defaultValue = null) {
        const db = await this.connect();
        return new Promise(resolve => {
            const tx = db.transaction('meta', 'readonly');
            const store = tx.objectStore('meta');
            const request = store.get(key);
            request.onsuccess = () => {
                if (request.result && request.result.v !== undefined) {
                    try { resolve(JSON.parse(request.result.v)); }
                    catch (e) { resolve(request.result.v); }
                } else {
                    resolve(defaultValue);
                }
            };
            request.onerror = () => resolve(defaultValue);
        });
    }

    /**
     * Set a meta value.
     * @param {string} key
     * @param {*} value
     * @returns {Promise<void>}
     */
    async setMeta(key, value) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('meta', 'readwrite');
            const store = tx.objectStore('meta');
            const strVal = typeof value === 'string' ? value : JSON.stringify(value);
            const request = store.put({ k: key, v: strVal });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Export to global space
window.FreeLatticeModules = window.FreeLatticeModules || {};
window.FreeLatticeModules.MemoryDatabase = MemoryDatabase;
