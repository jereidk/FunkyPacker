/**
 * PngCompressor - Shared PNG compression utility
 * 
 * Uses browser-image-compression for high-quality PNG compression.
 * Can work with both File/Blob objects and raw image data (canvas, ImageData).
 */

import imageCompression from 'browser-image-compression';

/**
 * Compress a PNG image
 * 
 * @param {File|Blob|Uint8Array|ImageData} input - Input image data
 * @param {string} fileName - Name for the output file
 * @param {Object} options - Compression options
 * @param {number} options.quality - Quality level 0-1 (default: 0.8)
 * @param {boolean} options.stripMetadata - Whether to strip EXIF/metadata (default: false)
 * @returns {Promise<Uint8Array>} Compressed PNG data
 */
export async function compressPng(input, fileName, options = {}) {
    const {
        quality = 0.8,
        stripMetadata = false
    } = options;

    try {
        let file;
        
        if (input instanceof File) {
            file = input;
        } else if (input instanceof Blob) {
            file = new File([input], fileName, { type: 'image/png' });
        } else if (input instanceof Uint8Array) {
            const blob = new Blob([input], { type: 'image/png' });
            file = new File([blob], fileName, { type: 'image/png' });
        } else if (input && input.data && input.width !== undefined) {
            // ImageData format - convert to canvas first
            const canvas = document.createElement('canvas');
            canvas.width = input.width;
            canvas.height = input.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(input, 0, 0);
            file = await imageCompression.canvasToFile(canvas, fileName, 'image/png', 1, 'image/png');
        } else if (input && input.width !== undefined) {
            // Canvas or HTMLImageElement
            file = await imageCompression.imageToFile(input, fileName, 'image/png');
        } else {
            throw new Error('Unsupported input type for PNG compression');
        }

        const compressionOptions = {
            maxSizeMB: Infinity,
            useWebWorker: true,
            initialQuality: quality,
            alwaysKeepResolution: true,
            fileType: 'image/png'
        };

        if (stripMetadata) {
            compressionOptions.exifTransform = () => null;
        }

        const compressedFile = await imageCompression(file, compressionOptions);
        const compressedData = new Uint8Array(await compressedFile.arrayBuffer());
        
        return compressedData;
    } catch (error) {
        console.error('[PngCompressor] Compression failed:', error);
        throw error;
    }
}

/**
 * Compress a PNG from a canvas element
 * 
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {string} fileName - Name for the output file
 * @param {Object} options - Compression options
 * @returns {Promise<Uint8Array>} Compressed PNG data
 */
export async function compressPngFromCanvas(canvas, fileName, options = {}) {
    try {
        const file = await imageCompression.canvasToFile(canvas, fileName, 'image/png', 1, 'image/png');
        return compressPng(file, fileName, options);
    } catch (error) {
        console.error('[PngCompressor] Canvas compression failed:', error);
        throw error;
    }
}

/**
 * Get the size of compressed data in bytes
 * 
 * @param {Uint8Array} data - Compressed PNG data
 * @returns {number} Size in bytes
 */
export function getCompressedSize(data) {
    return data ? data.byteLength : 0;
}

/**
 * Calculate compression ratio
 * 
 * @param {number} originalSize - Original size in bytes
 * @param {number} compressedSize - Compressed size in bytes
 * @returns {number} Compression ratio (0-1, where lower is better)
 */
export function getCompressionRatio(originalSize, compressedSize) {
    if (originalSize === 0) return 0;
    return 1 - (compressedSize / originalSize);
}

export default {
    compressPng,
    compressPngFromCanvas,
    getCompressedSize,
    getCompressionRatio
};
