/**
 * AnimationLinker - Preserves Animation.json metadata during atlas operations
 * 
 * This module handles the relationship between spritemap (sprite rectangles)
 * and Animation.json (timeline/symbol data) from Adobe Animate / Better TA.
 * 
 * When re-packing an atlas:
 * 1. The spritemap's x,y,w,h coordinates may change
 * 2. The Animation.json references sprites by NAME, not by position
 * 3. As long as sprite names remain the same, Animation.json stays valid
 * 
 * This module ensures:
 * - Animation.json is preserved unchanged when sprite names don't change
 * - Sprite name changes are tracked and can warn users
 * - Multi-atlas references are handled correctly
 */

class AnimationLinker {
    constructor() {
        this.animationData = null;
        this.spriteReferences = new Map(); // spriteName -> Set of locations in Animation.json
        this.symbolDefinitions = new Set(); // All symbol names defined in SD
        this.loaded = false;
    }

    /**
     * Load Animation.json data
     * @param {object|string} data - Parsed JSON or raw string
     */
    loadAnimation(data) {
        try {
            this.animationData = typeof data === 'string' ? JSON.parse(data) : data;
            this.buildSpriteReferenceMap();
            this.loaded = true;
            return true;
        } catch (e) {
            console.error('AnimationLinker: Failed to load Animation.json', e);
            this.loaded = false;
            return false;
        }
    }

    /**
     * Build a map of all sprite references within Animation.json
     * This allows us to track which sprites are actually used in the animation
     */
    buildSpriteReferenceMap() {
        this.spriteReferences.clear();
        this.symbolDefinitions.clear();

        if (!this.animationData) return;

        // Extract all symbol definitions from SD
        if (this.animationData.SD && this.animationData.SD.S) {
            for (let symbol of this.animationData.SD.S) {
                if (symbol.SN) {
                    this.symbolDefinitions.add(symbol.SN);
                }
            }
        }

        // Walk through the animation tree to find ASI (Atlas Sprite Instance) references
        this.walkForSpriteReferences(this.animationData);
    }

    /**
     * Recursively walk the animation structure to find sprite references
     */
    walkForSpriteReferences(node, path = '') {
        if (!node || typeof node !== 'object') return;

        // Check for ASI (Atlas Sprite Instance) - references a sprite by name
        if (node.ASI && node.ASI.N) {
            let spriteName = node.ASI.N;
            if (!this.spriteReferences.has(spriteName)) {
                this.spriteReferences.set(spriteName, []);
            }
            this.spriteReferences.get(spriteName).push(path);
        }

        // Recursively check arrays
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                this.walkForSpriteReferences(node[i], `${path}[${i}]`);
            }
        }

        // Recursively check objects
        for (let key in node) {
            if (node.hasOwnProperty(key)) {
                this.walkForSpriteReferences(node[key], `${path}.${key}`);
            }
        }
    }

    /**
     * Check if a sprite name is referenced in the animation
     */
    isSpriteReferenced(spriteName) {
        return this.spriteReferences.has(spriteName);
    }

    /**
     * Get all referenced sprite names
     */
    getReferencedSprites() {
        return Array.from(this.spriteReferences.keys());
    }

    /**
     * Get unreferenced sprites (sprites in atlas but not used in animation)
     */
    getUnreferencedSprites(allSprites) {
        let referenced = this.getReferencedSprites();
        return allSprites.filter(s => !referenced.includes(s));
    }

    /**
     * Check for orphaned references (sprites removed but still referenced)
     */
    validateSpriteExistence(sprites) {
        let spriteNames = new Set(sprites.map(s => s.name || s));
        let orphaned = [];

        for (let [spriteName, locations] of this.spriteReferences) {
            if (!spriteNames.has(spriteName)) {
                orphaned.push({
                    name: spriteName,
                    locations: locations
                });
            }
        }

        return orphaned;
    }

    /**
     * Check if Animation.json is loaded
     */
    isLoaded() {
        return this.loaded && this.animationData !== null;
    }

    /**
     * Get the animation metadata (MD block)
     */
    getMetadata() {
        return this.animationData?.MD || null;
    }

    /**
     * Get animation data for export
     * Returns the Animation.json content unchanged
     */
    getAnimationData() {
        return this.animationData;
    }

    /**
     * Serialize animation data back to JSON string
     */
    toJSON() {
        return JSON.stringify(this.animationData, null, 2);
    }

    /**
     * Clear loaded animation data
     */
    clear() {
        this.animationData = null;
        this.spriteReferences.clear();
        this.symbolDefinitions.clear();
        this.loaded = false;
    }

    /**
     * Check if a filename looks like an Animation.json file
     */
    static isAnimationFile(filename) {
        if (!filename) return false;
        let lower = filename.toLowerCase();
        return lower.endsWith('animation.json') || 
               lower.includes('animation.json');
    }

    /**
     * Find Animation.json alongside a spritemap file
     */
    static findAnimationFile(filename) {
        if (!filename) return null;
        
        // Pattern: spritemap1.json -> spritemap1Animation.json
        let base = filename.replace(/\.json$/i, '');
        let animFile = base + 'Animation.json';
        
        return animFile;
    }
}

// Singleton instance for global access
let animationLinker = null;

export function getAnimationLinker() {
    if (!animationLinker) {
        animationLinker = new AnimationLinker();
    }
    return animationLinker;
}

export function createAnimationLinker() {
    return new AnimationLinker();
}

export default AnimationLinker;
