/**
 * Newgrounds Audio API Service
 * Handles searching and retrieving audio from Newgrounds
 */

// Newgrounds API configuration
const NEWGROUNDS_API_URL = 'https://api.newgrounds.io';

// Public Newgrounds API key for audio search
const API_KEY = 'nG9lH2dV9pQ8kL3mR6tY2wX7cF4sJ8vB';

class NewgroundsAudioService {
    constructor() {
        this.cache = new Map();
        this.searchCache = new Map();
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
            console.log('[Newgrounds] Using cached search results');
            return this.searchCache.get(cacheKey);
        }

        try {
            // Use Newgrounds search API
            const url = `https://www.newgrounds.com/audio/search?q=${encodeURIComponent(query)}&page=1`;
            
            // Since direct API requires authentication, we'll use a workaround
            // by fetching the Newgrounds audio search page and parsing results
            const response = await fetch(url, {
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (compatible; FunkinPacker/1.0)'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const results = this.parseSearchResults(html, limit);
            
            this.searchCache.set(cacheKey, results);
            
            // Clear old cache entries (keep max 10 searches)
            if (this.searchCache.size > 10) {
                const firstKey = this.searchCache.keys().next().value;
                this.searchCache.delete(firstKey);
            }
            
            console.log(`[Newgrounds] Found ${results.length} results for "${query}"`);
            return results;
        } catch (error) {
            console.error('[Newgrounds] Search failed:', error.message);
            return [];
        }
    }

    /**
     * Parse search results from Newgrounds HTML
     * @param {string} html - HTML response
     * @param {number} limit - Max results
     * @returns {Array} Parsed results
     */
    parseSearchResults(html, limit) {
        const results = [];
        
        try {
            // Simple regex-based parsing for demo
            // In production, you'd want to use DOM parsing
            const audioMatches = html.match(/https:\/\/audio\.newgrounds\.com\/[^\s"'<>]+\.(mp3|ogg|wav)/gi) || [];
            const titleMatches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
            
            // Extract unique URLs
            const uniqueUrls = [...new Set(audioMatches)].slice(0, limit);
            
            uniqueUrls.forEach((url, index) => {
                const title = titleMatches[index] 
                    ? titleMatches[index].replace(/<[^>]+>/g, '').trim()
                    : `Audio ${index + 1}`;
                
                results.push({
                    id: `ng_${Date.now()}_${index}`,
                    title: title.substring(0, 50),
                    url: url,
                    artist: 'Unknown Artist',
                    source: 'newgrounds',
                    duration: null,
                    waveformUrl: null
                });
            });
        } catch (error) {
            console.warn('[Newgrounds] Parse error:', error.message);
        }
        
        return results;
    }

    /**
     * Get popular/trending audio from Newgrounds
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Array of audio results
     */
    async getPopularAudio(limit = 20) {
        const cacheKey = `popular:${limit}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch('https://www.newgrounds.com/audio/best', {
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (compatible; FunkinPacker/1.0)'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const results = this.parseSearchResults(html, limit);
            
            this.cache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error('[Newgrounds] Popular fetch failed:', error.message);
            return this.getDefaultAudio(limit);
        }
    }

    /**
     * Get default built-in audio options
     * These work offline and don't require internet
     * @param {number} limit - Max results
     * @returns {Array} Default audio options
     */
    getDefaultAudio(limit = 10) {
        return [
            {
                id: 'silence',
                title: 'Silence (No Music)',
                url: null,
                artist: 'System',
                source: 'system',
                duration: 0,
                offline: true
            },
            {
                id: 'ambient_1',
                title: 'Ambient Loop 1',
                url: null,
                artist: 'System',
                source: 'local',
                duration: 60,
                offline: true,
                localFile: 'ambient_1.mp3'
            },
            {
                id: 'ambient_2',
                title: 'Ambient Loop 2',
                url: null,
                artist: 'System',
                source: 'local',
                duration: 60,
                offline: true,
                localFile: 'ambient_2.mp3'
            },
            {
                id: 'upbeat_1',
                title: 'Upbeat Loop 1',
                url: null,
                artist: 'System',
                source: 'local',
                duration: 60,
                offline: true,
                localFile: 'upbeat_1.mp3'
            },
            {
                id: 'chill_1',
                title: 'Chill Loop 1',
                url: null,
                artist: 'System',
                source: 'local',
                duration: 60,
                offline: true,
                localFile: 'chill_1.mp3'
            }
        ].slice(0, limit);
    }

    /**
     * Get audio by ID from cache
     * @param {string} id - Audio ID
     * @returns {Object|null} Audio object or null
     */
    getAudioById(id) {
        // Check all caches
        for (const [key, value] of this.searchCache) {
            const found = value.find(a => a.id === id);
            if (found) return found;
        }
        for (const [key, value] of this.cache) {
            const found = value.find(a => a.id === id);
            if (found) return found;
        }
        return null;
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        this.searchCache.clear();
        console.log('[Newgrounds] Cache cleared');
    }
}

// Singleton instance
const newgroundsService = new NewgroundsAudioService();

export default newgroundsService;
export { NewgroundsAudioService };