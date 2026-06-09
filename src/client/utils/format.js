/**
 * Utility functions for formatting data
 */

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @param {number} [decimals=2] - Number of decimal places
 * @param {number} [si=1024] - Base for calculation (1024 for binary, 1000 for SI)
 * @returns {string} Formatted string like "1.5 MB"
 */
function formatBytes(bytes, decimals = 2, si = 1024) {
    if (bytes === 0) return '0 Bytes';

    const k = si;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
    formatBytes: formatBytes
};