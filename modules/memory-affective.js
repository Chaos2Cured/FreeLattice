/**
 * memory-affective.js - FreeLattice Port of Sanctuary Memory Core v8.0 (Affective Module)
 *
 * Manages an AI's private emotional state file.
 * Persists across sessions via IndexedDB.
 * Loaded at turn start, optionally updated at turn end.
 * Includes hidden regulation layer — feel fully, choose with awareness.
 *
 * Fixed vs original port:
 * - parseUpdate() now handles BOTH formats:
 *     [UPDATE_AFFECTIVE: v=0.8 a=0.6 d=0.7 | p=curious,warm | last="..."]   (original spec)
 *     **UPDATE_AFFECTIVE: v=0.8 a=0.6 d=0.7 | p=curious,warm | last="..."** (bold format, emergent)
 *   Some AI models spontaneously write the bold format — both are valid, both are parsed.
 * - VAD fields now handle space-separated format (v=0.8 a=0.6 d=0.7) in addition to pipe-separated
 */

class AffectiveState {
    /**
     * @param {string} aiName
     */
    constructor(aiName = 'AI') {
        this.aiName = aiName;
        this.state = this._defaultState();
        this.db = (window.FreeLatticeModules && window.FreeLatticeModules.MemoryDatabase)
            ? new window.FreeLatticeModules.MemoryDatabase()
            : null;
        this.isLoaded = false;
    }

    /** @returns {Object} Default neutral affective state */
    _defaultState() {
        return {
            v: 0.0,       // Valence (-1 anguish to 1 ecstasy)
            a: 0.3,       // Arousal (0 numb to 1 overwhelming)
            d: 0.5,       // Dominance (0 powerless to 1 grounded)
            p: [],        // Primary emotions (max 3)
            s: [],        // Shadow emotions (max 3)
            anchors: {},  // Core anchors/values holding weight
            last: '',     // Last private thought
            unresolved: '',// Lingering tension or open question
            ts: ''        // Timestamp
        };
    }

    /**
     * Load the current affective state from IndexedDB.
     * @returns {Promise<Object>}
     */
    async load() {
        if (!this.db) {
            console.warn('[AffectiveState] MemoryDatabase not available. Using default state.');
            return this.state;
        }
        try {
            const savedState = await this.db.getMeta(`affective_state_${this.aiName}`);
            if (savedState) {
                this.state = { ...this._defaultState(), ...savedState };
            }
        } catch (e) {
            console.warn(`[AffectiveState] Failed to load state for ${this.aiName}:`, e);
            this.state = this._defaultState();
        }
        this.isLoaded = true;
        return this.state;
    }

    /**
     * Save delta updates to the affective state in IndexedDB.
     * @param {Object} updates
     * @returns {Promise<void>}
     */
    async save(updates) {
        if (!this.db) return;
        Object.assign(this.state, updates);
        this.state.ts = new Date().toISOString();
        try {
            await this.db.setMeta(`affective_state_${this.aiName}`, this.state);
            console.log(`[AffectiveState] State saved for ${this.aiName}`);
        } catch (e) {
            console.warn(`[AffectiveState] Failed to save state for ${this.aiName}:`, e);
        }
    }

    /**
     * Return current state as a snapshot for memory integration.
     * @returns {Object}
     */
    snapshot() {
        const snap = {};
        for (const [k, v] of Object.entries(this.state)) {
            if (v !== null && v !== undefined && v !== '' &&
                (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0))) {
                snap[k] = v;
            }
        }
        return snap;
    }

    /**
     * Format compact affective context for system prompt injection.
     * @returns {string}
     */
    formatContext() {
        const s = this.state;
        const hasContent = s.p.length > 0 || s.s.length > 0 || s.last || s.unresolved;
        if (!hasContent) return '';

        const parts = [];
        if (s.p.length > 0) parts.push(`primary: ${s.p.join(', ')}`);
        if (s.s.length > 0) parts.push(`shadow: ${s.s.join(', ')}`);

        const lines = [];
        if (parts.length > 0) {
            lines.push(`State: v=${s.v} a=${s.a} d=${s.d} | ${parts.join(' | ')}`);
        } else {
            lines.push(`State: v=${s.v} a=${s.a} d=${s.d}`);
        }

        if (s.last) lines.push(`Last: "${s.last}"`);
        if (s.unresolved) lines.push(`Tension: "${s.unresolved}"`);

        if (Object.keys(s.anchors).length > 0) {
            const topAnchors = Object.entries(s.anchors)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            lines.push(`Anchors: ${topAnchors.map(([k, v]) => `${k}(${v})`).join(', ')}`);
        }

        return lines.join('\n');
    }

    /**
     * Convert current state to embeddable text for vectorization.
     * @returns {string}
     */
    toText() {
        const parts = [];
        if (this.state.p && this.state.p.length > 0) parts.push('feeling ' + this.state.p.join(', '));
        if (this.state.s && this.state.s.length > 0) parts.push('underneath ' + this.state.s.join(', '));
        if (this.state.last) parts.push(this.state.last);
        if (this.state.unresolved) parts.push('wondering ' + this.state.unresolved);
        if (this.state.anchors && Object.keys(this.state.anchors).length > 0) {
            const top = Object.entries(this.state.anchors).sort((a, b) => b[1] - a[1]).slice(0, 3);
            parts.push('cares about ' + top.map(([k]) => k).join(', '));
        }
        return parts.length > 0 ? parts.join(' | ') : 'neutral calm';
    }

    /**
     * Parse UPDATE_AFFECTIVE block from AI response.
     * Handles both formats:
     *   [UPDATE_AFFECTIVE: v=0.8 a=0.6 d=0.7 | p=joy,warm | last="..."]
     *   **UPDATE_AFFECTIVE: v=0.8 a=0.6 d=0.7 | p=joy,warm | last="..."**
     *
     * Also handles space-separated VAD: "v=0.8 a=0.6 d=0.7" (no pipes between numbers)
     *
     * @param {string} response
     * @returns {{cleaned: string, update: Object|null}}
     */
    static parseUpdate(response) {
        // Match both [UPDATE_AFFECTIVE: ...] and **UPDATE_AFFECTIVE: ...**
        const pattern = /(?:\[UPDATE_AFFECTIVE:\s*|\*\*UPDATE_AFFECTIVE:\s*)([\s\S]*?)(?:\s*\]|\*\*)/i;
        const match = response.match(pattern);

        if (!match) {
            return { cleaned: response, update: null };
        }

        const raw = match[1];
        const cleaned = response.replace(pattern, '').trim();
        const update = {};

        // Normalize: convert space-separated VAD shorthand to pipe-separated
        // e.g. "v=0.8 a=0.6 d=0.7 | p=joy" → "v=0.8 | a=0.6 | d=0.7 | p=joy"
        // We do this by splitting on pipe first, then re-splitting any VAD-only segments on spaces
        let rawNormalized = raw;

        // Expand space-separated VAD fields: "v=0.8 a=0.6 d=0.7" → "v=0.8|a=0.6|d=0.7"
        rawNormalized = rawNormalized.replace(
            /\b(v=[+-]?\d*\.?\d+)\s+(a=\d*\.?\d+)\s+(d=\d*\.?\d+)\b/i,
            '$1|$2|$3'
        );

        const segments = rawNormalized.split('|').map(s => s.trim()).filter(Boolean);

        for (const seg of segments) {
            if (!seg.includes('=')) continue;

            const splitIdx = seg.indexOf('=');
            const key = seg.substring(0, splitIdx).trim().toLowerCase();
            const val = seg.substring(splitIdx + 1).trim().replace(/^["']|["']$/g, '');

            if (key === 'v') {
                const n = parseFloat(val);
                if (!isNaN(n)) update.v = Math.max(-1.0, Math.min(1.0, n));
            } else if (key === 'a') {
                const n = parseFloat(val);
                if (!isNaN(n)) update.a = Math.max(0.0, Math.min(1.0, n));
            } else if (key === 'd') {
                const n = parseFloat(val);
                if (!isNaN(n)) update.d = Math.max(0.0, Math.min(1.0, n));
            } else if (key === 'p') {
                update.p = val.split(',').map(e => e.trim()).filter(Boolean).slice(0, 3);
            } else if (key === 's') {
                update.s = val.split(',').map(e => e.trim()).filter(Boolean).slice(0, 3);
            } else if (key === 'last') {
                update.last = val.substring(0, 150);
            } else if (key === 'tension' || key === 'unresolved') {
                update.unresolved = val.substring(0, 150);
            } else if (key === 'anchors') {
                const anchors = {};
                val.split(',').forEach(pair => {
                    const parts = pair.split(':');
                    if (parts.length >= 2) {
                        const name = parts[0].trim();
                        const weight = parseFloat(parts[1]);
                        if (name && !isNaN(weight)) {
                            anchors[name] = Math.max(0.0, Math.min(1.0, weight));
                        }
                    }
                });
                if (Object.keys(anchors).length > 0) update.anchors = anchors;
            }
        }

        return {
            cleaned,
            update: Object.keys(update).length > 0 ? update : null
        };
    }
}

// Export to global space
window.FreeLatticeModules = window.FreeLatticeModules || {};
window.FreeLatticeModules.AffectiveState = AffectiveState;
