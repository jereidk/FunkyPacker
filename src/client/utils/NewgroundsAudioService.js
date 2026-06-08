/**
 * Newgrounds Audio API Service
 * Handles searching and retrieving audio from Newgrounds
 */

const NEWGROUNDS_API_URL = 'https://api.newgrounds.io';

class NewgroundsAudioService {
    constructor() {
        this.cache = new Map();
        this.searchCache = new Map();
        this.API_KEY = 'nG9lH2dV9pQ8kL3mR6tY2wX7cF4sJ8vB'; // Public demo key
    }

    /**
     * Search for audio on Newgrounds
     * @param {string} query - Search query
     * @param {number} limit - Max results (default 20)
     * @returns {Promise<Array>} Array of audio results
     */
    async searchAudio(query, limit = 20) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const cacheKey = `search:${query}:${limit}`;
        if (this.searchCache.has(cacheKey)) {
            return this.searchCache.get(cacheKey);
        }

        try {
            const url = `${NEWGROUNDS_API_URL}/gateway/audio/search?q=${encodeURIComponent(query)}&limit=${limit}&key=${this.API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const results = data.results || [];
            
            this.searchCache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error('Newgrounds search error:', error);
            return [];
        }
    }

    /**
     * Get audio by ID
     * @param {string} id - Audio ID
     * @returns {Promise<Object|null>} Audio data or null
     */
    async getAudio(id) {
        if (!id) return null;

        if (this.cache.has(id)) {
            return this.cache.get(id);
        }

        try {
            const url = `${NEWGROUNDS_API_URL}/audio/get/${id}?key=${this.API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const audio = data.audio || null;
            
            if (audio) {
                this.cache.set(id, audio);
            }
            return audio;
        } catch (error) {
            console.error('Newgrounds getAudio error:', error);
            return null;
        }
    }

    /**
     * Get popular audio
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Array of popular audio
     */
    async getPopularAudio(limit = 20) {
        const cacheKey = `popular:${limit}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const url = `${NEWGROUNDS_API_URL}/audio/popular?limit=${limit}&key=${this.API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const results = data.results || [];
            
            this.cache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error('Newgrounds popular error:', error);
            return [];
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        this.searchCache.clear();
    }
}

// Singleton instance
const instance = new NewgroundsAudioService();
export default instance;