/**
 * memory-embedder.js - FreeLattice Port of Sanctuary Memory Core v8.0 (Embedder Module)
 *
 * A universal adapter for generating and comparing vector embeddings.
 * Fallback Chain:
 * 1. HuggingFace Inference API — with retry + exponential backoff for 503/504
 * 2. OpenAI API (text-embedding-3-small) if OpenAI key is present.
 * 3. Local Ollama (/ollama/api/embeddings) if local inference is running.
 * 4. Deterministic Math Fallback (pure JS) if offline/no keys.
 *
 * Matches Python HuggingFaceEmbedder: MAX_RETRIES=3, BACKOFF_BASE=2s (2s, 4s, 8s),
 * retries on 503 (model loading) and 504 (gateway timeout).
 */

class UniversalEmbedder {
    constructor() {
        this.dim = 768; // Default dimension (matches all-mpnet-base-v2)
        this.hfKey = null;
        this.openaiKey = null;

        this.hfModel = 'sentence-transformers/all-mpnet-base-v2';
        this.ollamaUrl = '/ollama/api/embeddings';
        this.ollamaModel = 'nomic-embed-text';

        // Retry config — matches Python HuggingFaceEmbedder
        this.HF_MAX_RETRIES = 3;
        this.HF_BACKOFF_BASE_MS = 2000; // 2s, 4s, 8s

        // Consecutive failure tracking — disables HF after 5 straight failures
        // (e.g. payment wall) rather than hammering the API every message
        this._hfConsecutiveFails = 0;
        this._hfDisabled = false;
    }

    /**
     * Check if API keys are available in the FreeLattice settings.
     */
    _checkSettingsForKey() {
        if (typeof window !== 'undefined' && window.state) {
            const settings = window.state.settings || {};
            // FreeLattice stores the HF token as state.hfToken (top-level),
            // not under state.settings — check both so this works in FreeLattice
            // and in any future app using the settings.huggingfaceKey convention.
            const newHfKey = window.state.hfToken ||
                settings.huggingfaceKey || settings.hfKey || null;
            const newOpenaiKey = settings.openaiKey || window.state.openaiKey || null;

            // Auto-reset disabled flag if a key is newly available.
            // Handles the case where the user adds/changes their HF key mid-session
            // after the embedder disabled itself from consecutive failures.
            if (newHfKey && newHfKey !== this.hfKey && this._hfDisabled) {
                console.info('[MemoryEmbedder] New HF key detected — re-enabling after prior disable.');
                this._hfDisabled = false;
                this._hfConsecutiveFails = 0;
            }

            this.hfKey = newHfKey;
            this.openaiKey = newOpenaiKey;
        }
    }

    /** Sleep helper for backoff. */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Main entry point. Tries fallback chain in order.
     * @param {string} text
     * @returns {Promise<Array<number>>}
     */
    async embed(text) {
        if (!text || typeof text !== 'string') text = 'empty';
        text = text.substring(0, 2000).trim() || 'empty';

        this._checkSettingsForKey();

        // 1. HuggingFace with retry + backoff
        if (this.hfKey && !this._hfDisabled) {
            try {
                const vec = await this._embedHuggingFaceWithRetry(text);
                this._hfConsecutiveFails = 0;
                return vec;
            } catch (e) {
                this._hfConsecutiveFails++;
                if (this._hfConsecutiveFails >= 5) {
                    this._hfDisabled = true;
                    console.warn(`[MemoryEmbedder] ${this._hfConsecutiveFails} consecutive HF failures — disabled until resetHFDisabled() called`);
                } else {
                    console.warn(`[MemoryEmbedder] HF failed (${this._hfConsecutiveFails}/5), falling back:`, e.message);
                }
            }
        }

        // 2. OpenAI
        if (this.openaiKey) {
            try {
                return await this._embedOpenAI(text);
            } catch (e) {
                console.warn('[MemoryEmbedder] OpenAI failed, trying local:', e.message);
            }
        }

        // 3. Local Ollama
        try {
            return await this._embedOllama(text);
        } catch (e) {
            console.warn('[MemoryEmbedder] Ollama failed, using hash fallback:', e.message);
        }

        // 4. Deterministic fallback — never throws
        return this._embedFallback(text);
    }

    /**
     * HuggingFace with retry + exponential backoff.
     * Matches Python: retries on 503 (model loading), 504 (gateway timeout),
     * and network errors. Waits 2s, 4s, 8s between attempts.
     * @param {string} text
     * @returns {Promise<Array<number>>}
     */
    async _embedHuggingFaceWithRetry(text) {
        let lastError = null;

        for (let attempt = 0; attempt < this.HF_MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(
                    `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.hfModel}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.hfKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ inputs: text })
                    }
                );

                if (!response.ok) {
                    const isRetryable = response.status === 503 || response.status === 504;
                    const errText = await response.text().catch(() => '');
                    const err = new Error(`HF ${response.status}: ${errText.substring(0, 120)}`);

                    if (isRetryable && attempt < this.HF_MAX_RETRIES - 1) {
                        const waitMs = this.HF_BACKOFF_BASE_MS * Math.pow(2, attempt);
                        console.info(`[MemoryEmbedder] HF attempt ${attempt + 1}/${this.HF_MAX_RETRIES} (${response.status}), retry in ${waitMs / 1000}s`);
                        await this._sleep(waitMs);
                        lastError = err;
                        continue;
                    }
                    throw err;
                }

                const data = await response.json();
                const vec = Array.isArray(data[0]) ? data[0] : data;
                if (vec && vec.length > 0) {
                    this.dim = vec.length;
                    return vec;
                }
                throw new Error('Invalid HF response format');

            } catch (e) {
                lastError = e;
                const s = (e.message || '').toLowerCase();
                const isRetryable = s.includes('503') || s.includes('504') ||
                    s.includes('model is currently loading') ||
                    s.includes('timed out') || s.includes('timeout') ||
                    s.includes('failed to fetch') || s.includes('network');

                if (isRetryable && attempt < this.HF_MAX_RETRIES - 1) {
                    const waitMs = this.HF_BACKOFF_BASE_MS * Math.pow(2, attempt);
                    console.info(`[MemoryEmbedder] HF attempt ${attempt + 1}/${this.HF_MAX_RETRIES} network err, retry in ${waitMs / 1000}s`);
                    await this._sleep(waitMs);
                } else {
                    break;
                }
            }
        }

        throw lastError || new Error('HF embedding failed after all retries');
    }

    /**
     * OpenAI text-embedding-3-small.
     * @param {string} text
     * @returns {Promise<Array<number>>}
     */
    async _embedOpenAI(text) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiKey}`
            },
            body: JSON.stringify({ input: text, model: 'text-embedding-3-small' })
        });

        if (!response.ok) throw new Error(`OpenAI ${response.status} ${response.statusText}`);

        const data = await response.json();
        if (data?.data?.[0]?.embedding) {
            this.dim = data.data[0].embedding.length;
            return data.data[0].embedding;
        }
        throw new Error('Invalid OpenAI response format');
    }

    /**
     * Local Ollama via proxy.
     * @param {string} text
     * @returns {Promise<Array<number>>}
     */
    async _embedOllama(text) {
        const response = await fetch(this.ollamaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.ollamaModel, prompt: text })
        });

        if (!response.ok) throw new Error(`Ollama ${response.status} ${response.statusText}`);

        const data = await response.json();
        if (data?.embedding) {
            this.dim = data.embedding.length;
            return data.embedding;
        }
        throw new Error('Invalid Ollama response format');
    }

    /**
     * Deterministic hash-based fallback — same text always gives same vector.
     * Matches Python _fallback_embed logic.
     * @param {string} text
     * @returns {Array<number>}
     */
    _embedFallback(text) {
        let seed = 0;
        for (let i = 0; i < text.length; i++) {
            seed = ((seed << 5) - seed) + text.charCodeAt(i);
            seed |= 0;
        }

        const vec = new Array(this.dim);
        let normSq = 0;
        for (let i = 0; i < this.dim; i++) {
            let val = Math.sin(seed + i * 1.34) * 10000;
            val = val - Math.floor(val);
            vec[i] = val;
            normSq += val * val;
        }

        const norm = Math.sqrt(normSq);
        if (norm === 0) return new Array(this.dim).fill(0);
        for (let i = 0; i < this.dim; i++) vec[i] /= norm;
        return vec;
    }

    /**
     * Pure JS cosine similarity.
     * @param {Array<number>} a
     * @param {Array<number>} b
     * @returns {number}
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length || a.length === 0) return 0.0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) return 0.0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Re-enable HF after resolving payment/key issue.
     */
    resetHFDisabled() {
        this._hfDisabled = false;
        this._hfConsecutiveFails = 0;
        console.info('[MemoryEmbedder] HuggingFace re-enabled.');
    }
}

// Export to global space
window.FreeLatticeModules = window.FreeLatticeModules || {};
window.FreeLatticeModules.UniversalEmbedder = UniversalEmbedder;
