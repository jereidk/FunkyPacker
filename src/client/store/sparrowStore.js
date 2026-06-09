/**
 * Sparrow State Store
 * 
 * Replaces global window.* state with a typed module API.
 * 
 * Migration table:
 * - window.sparrowMaxMap → getMaxMap / setMaxMap / getMaxMapEntry
 * - window.__sparrow_order → getOrder / setOrder / hasOrder
 * - window.atlas → getAtlas / setAtlas
 */

let maxMap = null;
let order = null;
let atlas = null;

/**
 * Get the max map object
 * @returns {Object|null} The max map or null
 */
function getMaxMap() {
    return maxMap;
}

/**
 * Ensure max map exists, creating it if necessary
 * @returns {Object} The max map (new or existing)
 */
function ensureMaxMap() {
    if (maxMap == null) {
        maxMap = {};
    }
    return maxMap;
}

/**
 * Set the max map object
 * @param {Object} map - The max map to store
 */
function setMaxMap(map) {
    maxMap = map;
}

/**
 * Get a max map entry by prefix
 * @param {string} prefix - The prefix to look up
 * @returns {Object|undefined} The max map entry or undefined
 */
function getMaxMapEntry(prefix) {
    if (maxMap == null) return undefined;
    return maxMap[prefix];
}

/**
 * Check if a max map entry exists
 * @param {string} prefix - The prefix to check
 * @returns {boolean} True if entry exists
 */
function hasMaxMapEntry(prefix) {
    if (maxMap == null) return false;
    return maxMap.hasOwnProperty(prefix);
}

/**
 * Clear the max map
 */
function clearMaxMap() {
    maxMap = null;
}

/**
 * Get the order array
 * @returns {Array|null} The order array or null
 */
function getOrder() {
    return order;
}

/**
 * Set the order array
 * @param {Array} orderArray - The order array to store
 */
function setOrder(orderArray) {
    order = orderArray;
}

/**
 * Check if order exists
 * @returns {boolean} True if order is not null
 */
function hasOrder() {
    return order != null;
}

/**
 * Clear the order
 */
function clearOrder() {
    order = null;
}

/**
 * Get the atlas object
 * @returns {Object|null} The atlas or null
 */
function getAtlas() {
    return atlas;
}

/**
 * Set the atlas object
 * @param {Object} atlasObj - The atlas to store
 */
function setAtlas(atlasObj) {
    atlas = atlasObj;
}

/**
 * Clear the atlas
 */
function clearAtlas() {
    atlas = null;
}

/**
 * Clear all state
 */
function clearAll() {
    clearMaxMap();
    clearOrder();
    clearAtlas();
}

module.exports = {
    // maxMap API
    getMaxMap: getMaxMap,
    ensureMaxMap: ensureMaxMap,
    setMaxMap: setMaxMap,
    getMaxMapEntry: getMaxMapEntry,
    hasMaxMapEntry: hasMaxMapEntry,
    clearMaxMap: clearMaxMap,
    
    // order API
    getOrder: getOrder,
    setOrder: setOrder,
    hasOrder: hasOrder,
    clearOrder: clearOrder,
    
    // atlas API
    getAtlas: getAtlas,
    setAtlas: setAtlas,
    clearAtlas: clearAtlas,
    
    // clear all
    clearAll: clearAll
};