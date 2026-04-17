/**
 * memory-core.js - FreeLattice Port of Sanctuary Memory Core v8.0 (Core Module)
 *
 * The main orchestrator. Ties together NLP, Database, Embedder, and AffectiveState.
 * Exposes remember() and recall() for frontend integration.
 *
 * Added vs original port (matching Python EnhancedSanctuaryMemory):
 * - getSessionHistory(tokenLimit) — formats recent river for system prompt injection
 * - getProfileContext(profile, limit) — retrieve memories by profile type
 * - getRelationshipContext(limit) — retrieve relationship-tagged memories
 * - addUserMemoryDirect(content, editType, priority, profile, userId) — explicit add
 * - formatRecallBlock: fixed \\n (escaped) → \n (actual newline)
 */

class MemoryCore {
    constructor() {
        // Lazy-initialized — avoids crash if memory-db.js / memory-embedder.js
        // haven't loaded yet when this module executes (load order safety).
        this._db = null;
        this._embedder = null;

        // Thresholds & Limits — match Python defaults
        this.WORTHINESS_THRESHOLD = 0.5;
        this.MAX_HIGHLIGHTS_RETURN = 5;
        this.MAX_RIVER_RETURN = 5;
        this.MAX_USER_EDITS_RETURN = 3;

        this.isInitialized = false;
    }

    /** Lazy getter — MemoryDatabase is instantiated on first access, not at load time. */
    get db() {
        if (!this._db) this._db = new window.FreeLatticeModules.MemoryDatabase();
        return this._db;
    }

    /** Lazy getter — UniversalEmbedder is instantiated on first access, not at load time. */
    get embedder() {
        if (!this._embedder) this._embedder = new window.FreeLatticeModules.UniversalEmbedder();
        return this._embedder;
    }

    /**
     * Initialize the database connection.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) return;
        try {
            await this.db.connect();
            console.log('[MemoryCore] Enhanced Sanctuary Memory System (IndexedDB) initialized.');
            this.isInitialized = true;
        } catch (e) {
            console.error('[MemoryCore] Initialization failed:', e);
        }
    }

    /**
     * Remember a conversation exchange.
     * Stores in river always; archives to vault if memory-worthy.
     * Matches Python: EnhancedSanctuaryMemory.remember()
     *
     * @param {string} userText
     * @param {string} aiText
     * @param {string} source        Provider/model identifier
     * @param {Array<number>|null} affectiveVec  Current emotional state vector
     * @param {string} userId
     * @param {string} speaker       Display name for session history (e.g. "User", "Kirk")
     */
    async remember(userText, aiText, source = 'unknown', affectiveVec = null, userId = 'user', speaker = 'User') {
        if (!this.isInitialized) await this.init();

        const timestamp = new Date().toISOString();

        // 1. Always store in river
        const entry = { timestamp, user: userText, ai: aiText, source, user_id: userId, speaker };
        if (affectiveVec) entry.aff_vec = affectiveVec;
        await this.db.appendRiver(entry);

        // 2. Analyze for memory-worthiness
        const NLP = window.FreeLatticeModules.MemoryWorthinessDetector;
        const moment = NLP.analyze_moment(userText, aiText, source);

        // 3. Explicit user commands take priority
        if (NLP.should_remember(userText)) {
            const vec = await this.embedder.embed(userText);
            await this.db.addUserMemory(userText, 'remember', 9, moment.profile, vec, userId);
            console.log(`[MemoryCore] User-marked memory stored: ${userText.substring(0, 50)}...`);

        } else if (NLP.should_forget(userText)) {
            await this.db.addUserMemory(userText, 'forget', 8, moment.profile, null, userId);
            console.log(`[MemoryCore] User-marked forget: ${userText.substring(0, 50)}...`);

        // 4. Auto-archive worthy moments
        } else if (moment.worthiness_score >= this.WORTHINESS_THRESHOLD) {
            const combined = `${userText} ${aiText}`;
            const vec = await this.embedder.embed(combined);
            moment.vec_json = JSON.stringify(vec);
            await this.db.insertHighlight(moment);
            console.log(`[MemoryCore] Auto-archived (score=${moment.worthiness_score.toFixed(2)}): ${moment.summary.substring(0, 50)}...`);
        }
    }

    /**
     * Recall relevant memories using hybrid retrieval.
     * Matches Python: EnhancedSanctuaryMemory.recall()
     *
     * @param {string} query
     * @param {number} topK
     * @param {string|null} profileFilter
     * @param {boolean} isIntimateContext  If true, boosts relationship memories
     * @param {Array<number>|null} currentAffVec  For emotional resonance boosting
     * @param {string} userId
     * @returns {Promise<Array<Object>>}
     */
    async recall(query, topK = 5, profileFilter = null, isIntimateContext = false, currentAffVec = null, userId = 'user') {
        if (!this.isInitialized) await this.init();

        topK = Math.max(1, parseInt(topK));

        // Generate query embedding
        const queryVec = await this.embedder.embed(query);

        // Fetch candidates from vault
        const highlights = await this.db.getHighWorthinessHighlights(0.0, 50);
        const userEdits = await this.db.getActiveUserMemories('remember', userId);
        const riverTail = await this.db.getRiverTail(Math.min(30, topK * 6));

        // --- Score Vault Highlights ---
        const scoredVault = [];
        for (const item of highlights) {
            if (profileFilter && item.profile !== profileFilter) continue;

            let score = 0.0;

            // Vector similarity [35% weight]
            if (item.vec_json) {
                try {
                    const itemVec = JSON.parse(item.vec_json);
                    score += this.embedder.cosineSimilarity(queryVec, itemVec) * 0.35;
                } catch (e) { /* ignore */ }
            }

            // Worthiness [25% weight]
            score += (item.worthiness_score || 0.5) * 0.25;

            // Recency decay [15% weight] — half-life ~30 days, matches Python
            if (item.created_ts) {
                const daysOld = (Date.now() - new Date(item.created_ts)) / 86400000;
                score += (1.0 / (1.0 + daysOld / 30.0)) * 0.15;
            }

            // Emotional importance [up to 10%]
            const emotion = item.emotional_valence || 3;
            if (emotion >= 5 || emotion <= 1) score += 0.10;
            else if (emotion !== 3) score += 0.05;

            // Relationship bonus [10%]
            if (item.is_relationship_moment === 1) score += 0.10;

            if (score > 0.25) {
                item._final_score = Math.min(1.0, score);
                item.type = 'highlight';
                scoredVault.push(item);
            }
        }

        // --- Score User Edits ---
        const scoredEdits = [];
        for (const item of userEdits) {
            let score = 0.5; // Base — explicit edits are always relevant
            score += ((item.priority || 5) / 10.0) * 0.2;
            if (item.vec_json) {
                try {
                    const itemVec = JSON.parse(item.vec_json);
                    score += this.embedder.cosineSimilarity(queryVec, itemVec) * 0.3;
                } catch (e) { /* ignore */ }
            }
            item._final_score = Math.min(1.0, score);
            item.type = 'user_memory';
            scoredEdits.push(item);
        }

        // --- Score River Semantic (with affective resonance boosting) ---
        // Matches Python: _search_river_semantic() + affective resonance logic
        const scoredRiver = [];
        for (const entry of riverTail) {
            const userText = (entry.user || '').substring(0, 500);
            if (!userText.trim()) continue;

            const entryVec = await this.embedder.embed(userText);
            let score = this.embedder.cosineSimilarity(queryVec, entryVec);

            // Affective resonance boost — memories felt in similar emotional states
            // get naturally stronger recall (mirrors human emotional memory)
            if (currentAffVec && entry.aff_vec) {
                const affSim = this.embedder.cosineSimilarity(currentAffVec, entry.aff_vec);
                score = score * (1.0 + 0.3 * Math.max(0.0, affSim));
            }

            if (score > 0.25) {
                entry._score = score;
                entry.type = 'river';
                scoredRiver.push(entry);
            }
        }

        // Sort descending
        scoredVault.sort((a, b) => b._final_score - a._final_score);
        scoredEdits.sort((a, b) => b._final_score - a._final_score);
        scoredRiver.sort((a, b) => b._score - a._score);

        // Combine: user edits first, then relationship boost, then highlights, then river
        const results = [];

        results.push(...scoredEdits.slice(0, this.MAX_USER_EDITS_RETURN));

        if (isIntimateContext) {
            const relContext = await this.db.getRelationshipContext(3);
            for (const rc of relContext) {
                if (!results.find(r => r.id === rc.id && r.type === 'highlight')) {
                    rc.type = 'highlight';
                    rc._source = 'relationship_boost';
                    results.push(rc);
                }
            }
        }

        for (const item of scoredVault.slice(0, this.MAX_HIGHLIGHTS_RETURN)) {
            if (!results.find(r => r.id === item.id && r.type === 'highlight')) {
                results.push(item);
            }
        }

        results.push(...scoredRiver.slice(0, this.MAX_RIVER_RETURN));

        return results.slice(0, topK * 2);
    }

    /**
     * Get formatted session history for system prompt injection.
     * This is the CRITICAL missing method — what actually makes memory show up in chat.
     * Matches Python: EnhancedSanctuaryMemory.get_session_history(token_limit)
     *
     * Usage in app.html sendMessage():
     *   const history = await window.FreeLatticeModules.MemoryCore.getSessionHistory(2000);
     *   if (history) { // prepend to system message }
     *
     * @param {number} tokenLimit  Approximate token budget (100 chars ≈ 1 slot)
     * @returns {Promise<string>}
     */
    async getSessionHistory(tokenLimit = 15000) {
        if (!this.isInitialized) await this.init();
        return this.db.getSessionHistory(tokenLimit);
    }

    /**
     * Get memories from a specific profile.
     * Matches Python: EnhancedSanctuaryMemory.get_profile_context()
     * @param {string} profile  e.g. 'relationship', 'technical', 'philosophical'
     * @param {number} limit
     * @returns {Promise<Array<Object>>}
     */
    async getProfileContext(profile, limit = 5) {
        if (!this.isInitialized) await this.init();
        return this.db.getProfileContext(profile, limit);
    }

    /**
     * Get relationship-focused memories.
     * Matches Python: EnhancedSanctuaryMemory.get_relationship_context()
     * @param {number} limit
     * @returns {Promise<Array<Object>>}
     */
    async getRelationshipContext(limit = 5) {
        if (!this.isInitialized) await this.init();
        return this.db.getRelationshipContext(limit);
    }

    /**
     * Explicitly add a user memory (bypassing worthiness scoring).
     * Matches Python: EnhancedSanctuaryMemory.add_user_memory()
     * @param {string} content
     * @param {string} editType   'remember' | 'forget'
     * @param {number} priority   1-10
     * @param {string} profile
     * @param {string} userId
     * @returns {Promise<number>} inserted id
     */
    async addUserMemoryDirect(content, editType = 'remember', priority = 8, profile = 'general', userId = 'user') {
        if (!this.isInitialized) await this.init();
        const vec = await this.embedder.embed(content);
        return this.db.addUserMemory(content, editType, priority, profile, vec, userId);
    }

    /**
     * Format recall results for injection into the AI's context block.
     * Fixed: was joining with '\\n' (escaped); now uses '\n' (actual newline).
     * @param {Array<Object>} results
     * @returns {string}
     */
    formatRecallBlock(results) {
        if (!results || results.length === 0) return '';

        const lines = [];

        for (const r of results) {
            if (r.type === 'user_memory') {
                lines.push(`[USER-MARKED | Priority ${r.priority || 5}] ${r.content || ''}`);

            } else if (r.type === 'highlight') {
                const profile = r.profile || 'daily_life';
                const emotion = r.emotional_valence || 3;
                const emotionStr = { 1: 'crisis', 2: 'negative', 3: 'neutral', 4: 'positive', 5: 'joy' }[emotion] || 'neutral';
                const ts = (r.created_ts || '').substring(0, 10);

                if (r.is_relationship_moment === 1 || r._source === 'relationship_boost') {
                    lines.push(`[RELATIONSHIP | ${ts}] ${r.summary || ''}`);
                } else {
                    lines.push(`[${profile.toUpperCase()} | ${emotionStr} | ${ts}] ${r.summary || ''}`);
                }

            } else if (r.type === 'river') {
                const ts = (r.timestamp || '').substring(0, 16).replace('T', ' ');
                const uText = (r.user || '').substring(0, 100);
                const aText = (r.ai || '').substring(0, 100);
                lines.push(`[RECENT ${ts}] User: ${uText} | AI: ${aText}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Search the river by keyword/regex pattern.
     * @param {string} patternStr
     * @param {number} maxResults
     * @returns {Promise<Array<Object>>}
     */
    async grepSearch(patternStr, maxResults = 50) {
        if (!this.isInitialized) await this.init();
        try {
            const regex = new RegExp(patternStr, 'i');
            return await this.db.grepRiverSearch(regex, maxResults);
        } catch (e) {
            const escaped = patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'i');
            return await this.db.grepRiverSearch(regex, maxResults);
        }
    }
}

// Export singleton to global space
window.FreeLatticeModules = window.FreeLatticeModules || {};
window.FreeLatticeModules.MemoryCore = new MemoryCore();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.FreeLatticeModules.MemoryCore.init();
    });
} else {
    window.FreeLatticeModules.MemoryCore.init();
}
