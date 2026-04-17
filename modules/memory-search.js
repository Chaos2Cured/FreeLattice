/**
 * memory-search.js - FreeLattice Port of Sanctuary Memory Core v8.0 (Search Module)
 *
 * Port of AISearchableMemory (Lossless Semantic Search).
 * Uses IndexedDB to store and retrieve pure-text logs using keyword density
 * and recency, bypassing vector embedding costs for exact-match lookups.
 *
 * Fixed vs original port:
 * - _extractKeywords: was using /\\b[a-z]{3,}\\b/g (literal backslash-b, matched nothing)
 *   Fixed to /\b[a-z]{3,}\b/g (actual word boundary)
 * - formatResultsForAI: was using '\\n' (escaped backslash-n) as separator
 *   Fixed to '\n' (actual newline)
 */

class AISearchableMemory {
    /**
     * @param {string} source  AI identifier (e.g. 'claude', 'gemini')
     */
    constructor(source = 'model_a') {
        this.source = source;
        this.db = (window.FreeLatticeModules && window.FreeLatticeModules.MemoryDatabase)
            ? new window.FreeLatticeModules.MemoryDatabase()
            : null;
    }

    /**
     * Extract meaningful keywords from text for search indexing.
     * @param {string} text
     * @returns {string[]}
     */
    _extractKeywords(text) {
        if (!text) return [];

        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
            'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been',
            'would', 'could', 'should', 'what', 'when', 'where', 'which',
            'their', 'will', 'with', 'this', 'that', 'from', 'they', 'been',
            'have', 'were', 'said', 'each', 'she', 'how', 'than', 'its',
            'let', 'may', 'just', 'like', 'know', 'think', 'want', 'going',
            'really', 'yeah', 'okay', 'sure', 'well', 'very', 'much', 'some',
            'about', 'into', 'them', 'then', 'there', 'these', 'here', 'being'
        ]);

        // Fixed: was /\\b[a-z]{3,}\\b/g which matched nothing (literal backslashes)
        const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        const seen = new Set();
        const keywords = [];

        for (const word of words) {
            if (!stopWords.has(word) && !seen.has(word)) {
                seen.add(word);
                keywords.push(word);
            }
        }

        return keywords.slice(0, 30);
    }

    /**
     * Append a prompt/response pair to the searchable memory.
     * @param {string} userPrompt
     * @param {string} aiResponse
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async append(userPrompt, aiResponse, userId = 'user') {
        if (!this.db) return;

        const now = new Date();
        const combinedText = `${userPrompt} ${aiResponse}`;
        const keywords = this._extractKeywords(combinedText);

        const entry = {
            timestamp: now.toISOString(),
            date: now.toISOString().split('T')[0],
            time: now.toISOString().split('T')[1].split('.')[0],
            user_prompt: userPrompt,
            ai_response: aiResponse.substring(0, 2000),
            keywords: keywords,
            source: this.source,
            user_id: userId
        };

        const dbInstance = await this.db.connect();
        return new Promise((resolve, reject) => {
            const tx = dbInstance.transaction('searchable_memory', 'readwrite');
            const store = tx.objectStore('searchable_memory');
            const request = store.add(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Quick search: most RECENT entries matching any keyword.
     * Token-light, good for quick context refresh.
     * @param {string} keywordsStr
     * @param {number} maxResults
     * @param {string|null} userId
     * @returns {Promise<Array<Object>>}
     */
    async quickSearch(keywordsStr, maxResults = 4, userId = null) {
        if (!this.db) return [];

        const keywordList = keywordsStr.toLowerCase().split(/\s+/).filter(Boolean);
        if (keywordList.length === 0) return [];

        const dbInstance = await this.db.connect();
        return new Promise(resolve => {
            const tx = dbInstance.transaction('searchable_memory', 'readonly');
            const store = tx.objectStore('searchable_memory');
            const request = store.openCursor(null, 'prev');
            const matches = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && matches.length < maxResults) {
                    const entry = cursor.value;
                    if (!userId || entry.user_id === userId) {
                        const entryText = `${entry.user_prompt || ''} ${entry.ai_response || ''}`.toLowerCase();
                        if (keywordList.some(kw => entryText.includes(kw))) {
                            matches.push(entry);
                        }
                    }
                    cursor.continue();
                } else {
                    resolve(matches);
                }
            };
            request.onerror = () => resolve([]);
        });
    }

    /**
     * Deep search: entries with BEST keyword match density, across all history.
     * @param {string} keywordsStr
     * @param {number} maxResults
     * @param {string|null} userId
     * @returns {Promise<Array<Object>>}
     */
    async deepSearch(keywordsStr, maxResults = 10, userId = null) {
        if (!this.db) return [];

        const keywordList = keywordsStr.toLowerCase().split(/\s+/).filter(Boolean);
        if (keywordList.length === 0) return [];

        const dbInstance = await this.db.connect();
        return new Promise(resolve => {
            const tx = dbInstance.transaction('searchable_memory', 'readonly');
            const store = tx.objectStore('searchable_memory');
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result || [];
                const scoredMatches = [];

                for (const entry of entries) {
                    if (userId && entry.user_id !== userId) continue;
                    const entryText = `${entry.user_prompt || ''} ${entry.ai_response || ''}`.toLowerCase();

                    let score = 0;
                    for (const kw of keywordList) {
                        const regex = new RegExp(kw, 'g');
                        const count = (entryText.match(regex) || []).length;
                        if (count > 0) score += 1 + (count * 0.1);
                    }
                    if (score > 0) scoredMatches.push({ score, entry });
                }

                scoredMatches.sort((a, b) => b.score - a.score);
                resolve(scoredMatches.slice(0, maxResults).map(m => m.entry));
            };
            request.onerror = () => resolve([]);
        });
    }

    /**
     * Search by specific date, optionally filtered by keywords.
     * @param {string} dateStr  YYYY-MM-DD
     * @param {string|null} keywordsStr
     * @returns {Promise<Array<Object>>}
     */
    async searchByDate(dateStr, keywordsStr = null) {
        if (!this.db) return [];

        const keywordList = keywordsStr ? keywordsStr.toLowerCase().split(/\s+/).filter(Boolean) : [];
        const dbInstance = await this.db.connect();

        return new Promise(resolve => {
            const tx = dbInstance.transaction('searchable_memory', 'readonly');
            const store = tx.objectStore('searchable_memory');
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result || [];
                const matches = [];

                for (const entry of entries) {
                    if (entry.date !== dateStr) continue;
                    if (keywordList.length > 0) {
                        const entryText = `${entry.user_prompt || ''} ${entry.ai_response || ''}`.toLowerCase();
                        if (!keywordList.some(kw => entryText.includes(kw))) continue;
                    }
                    matches.push(entry);
                }
                resolve(matches);
            };
            request.onerror = () => resolve([]);
        });
    }

    /**
     * Format search results for AI consumption.
     * Fixed: was joining with '\\n' (literal two-char string); now uses '\n' (newline).
     * @param {Array<Object>} results
     * @param {string} searchType
     * @returns {string}
     */
    formatResultsForAI(results, searchType = 'search') {
        if (!results || results.length === 0) {
            return `[${searchType.toUpperCase()}] No matching memories found.`;
        }

        const lines = [`[${searchType.toUpperCase()}] Found ${results.length} memories:\n`];

        results.forEach((entry, i) => {
            const ts = (entry.timestamp || '').substring(0, 16).replace('T', ' ');
            const user = (entry.user_prompt || '').substring(0, 150);
            const ai = (entry.ai_response || '').substring(0, 300);

            lines.push(`--- Memory ${i + 1} [${ts}] ---`);
            lines.push(`User: ${user}`);
            lines.push(`AI: ${ai}`);
            lines.push('');
        });

        return lines.join('\n');
    }
}

// Export to global space
window.FreeLatticeModules = window.FreeLatticeModules || {};
window.FreeLatticeModules.AISearchableMemory = AISearchableMemory;
