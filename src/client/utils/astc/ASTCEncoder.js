/**
 * ASTC Encoder - Browser implementation using WebAssembly
 * Converts PNG images to ASTC format for Android/OpenGL ES 3.x textures
 * 
 * WARNING: This is a PLACEHOLDER implementation for demonstration purposes.
 * The block encoding does NOT produce valid ASTC data that can be decoded
 * by actual GPU hardware. For production use, you MUST integrate a real
 * ASTC encoder such as:
 * 
 * - ARM's astcenc (recommended): https://github.com/ARM-software/astc-encoder
 * - Transcoding from ETC2/PVRTC via texture compression libraries
 * 
 * This placeholder exists to demonstrate the KTX2 container structure
 * and provide a path for future WASM integration.
 * 
 * KTX2 format reference: https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html
 * ASTC format reference: https://registry.khronos.org/ASTC/specs/ASTC-spec.html
 */

/**
 * Map block size names to ASTC internal formats
 */
const ASTC_INTERNAL_FORMATS = {
    '4x4': 0x93B0,  // GL_COMPRESSED_ASTC_4x4_KHR
    '5x5': 0x93B5,  // GL_COMPRESSED_ASTC_5x5_KHR
    '6x6': 0x93BA,  // GL_COMPRESSED_ASTC_6x6_KHR
    '8x8': 0x93BB,   // GL_COMPRESSED_ASTC_8x8_KHR
    '10x10': 0x93BC, // GL_COMPRESSED_ASTC_10x10_KHR
    '12x12': 0x93BD  // GL_COMPRESSED_ASTC_12x12_KHR
};

class ASTCEncoder {
    constructor() {
        this.blockSizes = {
            '4x4': { width: 4, height: 4, bits: 128 },
            '5x5': { width: 5, height: 5, bits: 128 },
            '6x6': { width: 6, height: 6, bits: 128 },
            '8x8': { width: 8, height: 8, bits: 128 },
            '10x10': { width: 10, height: 10, bits: 128 },
            '12x12': { width: 12, height: 12, bits: 128 }
        };
        
        this.qualityModes = {
            'fast': 'FAST',
            'medium': 'MEDIUM',
            'thorough': 'THOROUGH',
            'exhaustive': 'EXHAUSTIVE'
        };
        
        this.colorProfiles = {
            'ldr-luminance': 'cl',
            'ldr-rgb': 'cs',
            'ldr-rgba': 'cH',
            'hdr-rgba': 'ch'
        };

        // Flag indicating if real WASM encoder is available
        this.wasmEncoderAvailable = false;
        this.wasmEncoder = null;
    }

    /**
     * Attempt to load WASM encoder for production-quality ASTC encoding
     * Call this during app initialization
     * 
     * @param {string} wasmUrl - URL to astcenc WASM module
     * @returns {Promise<boolean>} - true if WASM encoder loaded successfully
     */
    async loadWasmEncoder(wasmUrl) {
        try {
            // Placeholder for WASM integration
            // In production, load astcenc WASM module here:
            // const { astcenc } = await import(wasmUrl);
            // this.wasmEncoder = astcenc;
            // this.wasmEncoderAvailable = true;
            
            console.warn(
                '[ASTCEncoder] WASM encoder not available. ' +
                'Using placeholder implementation that produces INVALID ASTC data. ' +
                'For production, integrate ARM astcenc WASM module.'
            );
            
            return false;
        } catch (error) {
            console.error('[ASTCEncoder] Failed to load WASM encoder:', error);
            return false;
        }
    }

    /**
     * Convert RGBA image data to ASTC format
     * @param {ImageData} imageData - Raw RGBA image data from canvas
     * @param {Object} options - Encoding options
     * @returns {ArrayBuffer} - ASTC compressed data
     */
    async encode(imageData, options = {}) {
        const {
            blockSize = '4x4',
            quality = 'medium',
            colorProfile = 'ldr-rgba'
        } = options;

        const block = this.blockSizes[blockSize];
        if (!block) {
            throw new Error(`[ASTCEncoder] Unsupported block size: ${blockSize}`);
        }

        const width = imageData.width;
        const height = imageData.height;

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            throw new Error('[ASTCEncoder] Invalid image dimensions');
        }
        
        // Calculate number of blocks
        const blocksX = Math.ceil(width / block.width);
        const blocksY = Math.ceil(height / block.height);
        
        // ASTC block size: 128 bits = 16 bytes
        const blockDataSize = 16;
        const outputSize = blocksX * blocksY * blockDataSize;
        
        // Create output buffer
        const output = new ArrayBuffer(outputSize);
        const outputView = new Uint8Array(output);
        
        // Get pixel data (RGBA)
        const pixels = imageData.data;
        
        // Use WASM encoder if available, otherwise use placeholder
        if (this.wasmEncoderAvailable && this.wasmEncoder) {
            return await this._encodeWithWasm(pixels, width, height, block, options);
        }
        
        // Placeholder encoding - produces INVALID ASTC data
        console.warn(
            '[ASTCEncoder] WARNING: Placeholder encoding is being used. ' +
            'Output data will NOT be valid for GPU texture loading!'
        );
        
        // Encode each block with placeholder
        for (let by = 0; by < blocksY; by++) {
            for (let bx = 0; bx < blocksX; bx++) {
                const blockIndex = by * blocksX + bx;
                const offset = blockIndex * blockDataSize;
                
                // Extract block pixels
                const blockPixels = this.extractBlock(pixels, width, height, bx, by, block);
                
                // Encode block (placeholder - produces invalid data)
                const encoded = this._encodeBlockPlaceholder(blockPixels, block, colorProfile);
                
                // Write to output
                outputView.set(encoded, offset);
            }
        }
        
        return output;
    }

    /**
     * Encode block using WASM encoder (production path)
     */
    async _encodeWithWasm(pixels, width, height, block, options) {
        // This would use the real astcenc WASM implementation
        // const result = await this.wasmEncoder.encode(pixels, width, height, {
        //     blockWidth: block.width,
        //     blockHeight: block.height,
        //     quality: options.quality,
        //     profile: options.colorProfile
        // });
        // return result;
        
        throw new Error('[ASTCEncoder] WASM encoder not implemented - integrate astcenc');
    }

    /**
     * PLACEHOLDER: Encode a single ASTC block
     * 
     * This does NOT produce valid ASTC data. It exists only to demonstrate
     * the structure and allow testing of the KTX2 container.
     * 
     * For valid ASTC encoding, you MUST use a real encoder like astcenc.
     */
    _encodeBlockPlaceholder(blockPixels, block, colorProfile) {
        const blockData = new Uint8Array(16);
        
        // Calculate block endpoint colors (min/max for ASTC)
        let minR = 255, minG = 255, minB = 255, minA = 255;
        let maxR = 0, maxG = 0, maxB = 0, maxA = 0;
        
        for (let i = 0; i < blockPixels.length; i += 4) {
            minR = Math.min(minR, blockPixels[i]);
            minG = Math.min(minG, blockPixels[i + 1]);
            minB = Math.min(minB, blockPixels[i + 2]);
            minA = Math.min(minA, blockPixels[i + 3]);
            maxR = Math.max(maxR, blockPixels[i]);
            maxG = Math.max(maxG, blockPixels[i + 1]);
            maxB = Math.max(maxB, blockPixels[i + 2]);
            maxA = Math.max(maxA, blockPixels[i + 3]);
        }
        
        // ASTC void-extent block (for uniform blocks)
        // This follows the correct void-extent format for reference
        // Valid void-extent: bytes 0-1 = 0xFC, 0x5D
        if (minR === maxR && minG === maxG && minB === maxB && minA === maxA) {
            // Void-extent block: all pixels are the same RGBA color
            // Bytes 0-1: void-extent block descriptor (0xFC5D)
            blockData[0] = 0xFC;
            blockData[1] = 0x5D;
            // Bytes 2-15: RGBA values as 16-bit little-endian
            // R (16-bit)
            blockData[2] = minR;
            blockData[3] = 0;
            // G (16-bit)
            blockData[4] = minG;
            blockData[5] = 0;
            // B (16-bit)
            blockData[6] = minB;
            blockData[7] = 0;
            // A (16-bit)
            blockData[8] = minA;
            blockData[9] = 0;
            // Remaining bytes set to 0x80 for void-extent (RGBA void)
            for (let i = 10; i < 16; i++) {
                blockData[i] = 0x80;
            }
            return blockData;
        }
        
        // WARNING: For non-uniform blocks, this produces COMPLETELY INVALID data
        // This is just a placeholder that fills the buffer with something
        // DO NOT use this for actual texture compression
        
        // For demonstration only - fill with recognizable pattern
        blockData[0] = 0xFF;
        blockData[1] = 0xFF;
        
        // Store some color info for debugging purposes
        blockData[2] = Math.round((minR + maxR) / 2);
        blockData[3] = Math.round((minG + maxG) / 2);
        blockData[4] = Math.round((minB + maxB) / 2);
        blockData[5] = Math.round((minA + maxA) / 2);
        
        // Fill remaining with pattern indicating placeholder
        for (let i = 6; i < 16; i++) {
            blockData[i] = 0xAA;
        }
        
        return blockData;
    }

    /**
     * Extract pixels for a single block
     */
    extractBlock(pixels, imageWidth, imageHeight, blockX, blockY, block) {
        const blockPixels = new Uint8Array(block.width * block.height * 4);
        
        for (let y = 0; y < block.height; y++) {
            for (let x = 0; x < block.width; x++) {
                const px = blockX * block.width + x;
                const py = blockY * block.height + y;
                
                let r, g, b, a;
                
                if (px < imageWidth && py < imageHeight) {
                    const pixelIndex = (py * imageWidth + px) * 4;
                    r = pixels[pixelIndex];
                    g = pixels[pixelIndex + 1];
                    b = pixels[pixelIndex + 2];
                    a = pixels[pixelIndex + 3];
                } else {
                    // Transparent border for incomplete blocks
                    r = g = b = 0;
                    a = 0;
                }
                
                const blockPixelIndex = (y * block.width + x) * 4;
                blockPixels[blockPixelIndex] = r;
                blockPixels[blockPixelIndex + 1] = g;
                blockPixels[blockPixelIndex + 2] = b;
                blockPixels[blockPixelIndex + 3] = a;
            }
        }
        
        return blockPixels;
    }

    /**
     * Calculate color variance in a block
     */
    calculateVariance(pixels) {
        let sumR = 0, sumG = 0, sumB = 0;
        const count = pixels.length / 4;
        
        for (let i = 0; i < pixels.length; i += 4) {
            sumR += pixels[i];
            sumG += pixels[i + 1];
            sumB += pixels[i + 2];
        }
        
        const meanR = sumR / count;
        const meanG = sumG / count;
        const meanB = sumB / count;
        
        let varR = 0, varG = 0, varB = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            varR += (pixels[i] - meanR) ** 2;
            varG += (pixels[i + 1] - meanG) ** 2;
            varB += (pixels[i + 2] - meanB) ** 2;
        }
        
        return Math.sqrt((varR + varG + varB) / (3 * count));
    }

    /**
     * Create a KTX2 container for ASTC data (for GPU loading)
     * @param {ArrayBuffer} astcData - Raw ASTC data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {string} blockSize - Block size (e.g., '4x4')
     * @returns {ArrayBuffer} - KTX2 formatted data
     */
    createKTX2(astcData, width, height, blockSize) {
        const block = this.blockSizes[blockSize] || this.blockSizes['4x4'];
        const internalFormat = ASTC_INTERNAL_FORMATS[blockSize] || ASTC_INTERNAL_FORMATS['4x4'];
        
        // KTX2 header is always 80 bytes
        const headerSize = 80;
        const header = new Uint8Array(headerSize);
        
        // KTX2 identifier: «ktx« (12 bytes)
        // Actually, KTX2 identifier is 12 bytes starting with magic number
        const identifier = [0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x0D, 0x0A, 0x1A, 0x0A];
        header.set(identifier, 0);
        
        // Header length (u32)
        // Bytes 12-15: headerByteLength (unused in KTX2, but kept for compatibility)
        const headerByteLength = 80;
        header[12] = headerByteLength & 0xFF;
        header[13] = (headerByteLength >> 8) & 0xFF;
        header[14] = (headerByteLength >> 16) & 0xFF;
        header[15] = (headerByteLength >> 24) & 0xFF;
        
        // Number of mipmap levels (u32)
        // Bytes 16-19
        header[16] = 1;
        header[17] = 0;
        header[18] = 0;
        header[19] = 0;
        
        // Number of layers (u32)
        // Bytes 20-23
        header[20] = 1;
        header[21] = 0;
        header[22] = 0;
        header[23] = 0;
        
        // Number of faces (u32)
        // Bytes 24-27 (1 for 2D textures, 6 for cubemaps)
        header[24] = 1;
        header[25] = 0;
        header[26] = 0;
        header[27] = 0;
        
        // Bytes 28-31: number of source dimensions (unused, set to 0)
        header[28] = 0;
        header[29] = 0;
        header[30] = 0;
        header[31] = 0;
        
        // Pixel dimensions (u32 each)
        // Bytes 32-35: width
        header[32] = width & 0xFF;
        header[33] = (width >> 8) & 0xFF;
        header[34] = (width >> 16) & 0xFF;
        header[35] = (width >> 24) & 0xFF;
        
        // Bytes 36-39: height
        header[36] = height & 0xFF;
        header[37] = (height >> 8) & 0xFF;
        header[38] = (height >> 16) & 0xFF;
        header[39] = (height >> 24) & 0xFF;
        
        // Bytes 40-43: depth (1 for 2D textures)
        header[40] = 1;
        header[41] = 0;
        header[42] = 0;
        header[43] = 0;
        
        // Bytes 44-47: number of array elements (0 for non-array textures)
        header[44] = 0;
        header[45] = 0;
        header[46] = 0;
        header[47] = 0;
        
        // Bytes 48-51: format-specific data
        // For ASTC, this is the size of one compressed block
        const compressedBlockSize = 16;
        header[48] = compressedBlockSize & 0xFF;
        header[49] = (compressedBlockSize >> 8) & 0xFF;
        header[50] = (compressedBlockSize >> 16) & 0xFF;
        header[51] = (compressedBlockSize >> 24) & 0xFF;
        
        // Bytes 52-55: type of DFD follows
        header[52] = 0;
        header[53] = 0;
        header[54] = 0;
        header[55] = 0;
        
        // Bytes 56-59: offset of DFD from start of file
        const dfdOffset = headerSize;
        header[56] = dfdOffset & 0xFF;
        header[57] = (dfdOffset >> 8) & 0xFF;
        header[58] = (dfdOffset >> 16) & 0xFF;
        header[59] = (dfdOffset >> 24) & 0xFF;
        
        // Bytes 60-63: offset of first "image" data from start of file
        // For KTX2, image data follows DFD
        const dfdSize = 28; // Size of our ASTC DFD
        const imageDataOffset = headerSize + dfdSize;
        header[60] = imageDataOffset & 0xFF;
        header[61] = (imageDataOffset >> 8) & 0xFF;
        header[62] = (imageDataOffset >> 16) & 0xFF;
        header[63] = (imageDataOffset >> 24) & 0xFF;
        
        // Bytes 64-67: kvDataByteLength (key/value pairs, we have none)
        header[64] = 0;
        header[65] = 0;
        header[66] = 0;
        header[67] = 0;
        
        // Bytes 68-71: kvDataOffset (offset to key/value data, if any)
        // With no kvData, this points to end of file
        header[68] = 0;
        header[69] = 0;
        header[70] = 0;
        header[71] = 0;
        
        // Bytes 72-79: unused/padding
        for (let i = 72; i < 80; i++) {
            header[i] = 0;
        }
        
        // Create DFD (Data Format Descriptor) for ASTC
        // DFD for ASTC RGBA follows Khronos specification
        const dfd = new Uint8Array(dfdSize);
        
        // DFD total size (u32) - bytes 0-3
        dfd[0] = dfdSize & 0xFF;
        dfd[1] = (dfdSize >> 8) & 0xFF;
        dfd[2] = (dfdSize >> 16) & 0xFF;
        dfd[3] = (dfdSize >> 24) & 0xFF;
        
        // Vendor ID (u32) - bytes 4-7 (0 = Khronos)
        dfd[4] = 0;
        dfd[5] = 0;
        dfd[6] = 0;
        dfd[7] = 0;
        
        // Descriptor type (u16) - bytes 8-9
        dfd[8] = 0;
        dfd[9] = 1;
        
        // Descriptor block model (u8) - byte 10
        dfd[10] = 0;
        
        // Descriptor color model (u8) - byte 11 (6 = ASTC)
        dfd[11] = 6;
        
        // Descriptor color primaries (u8) - byte 12 (0 = unmodified)
        dfd[12] = 0;
        
        // Descriptor transfer function (u8) - byte 13 (0 = linear)
        dfd[13] = 0;
        
        // Flags (u8) - byte 14
        dfd[14] = 0;
        
        // Texel block dimension (u8) - byte 15
        // Bits 0-1: dimX-1, bits 2-3: dimY-1, bits 4-5: dimZ-1, bits 6-7: dimW-1
        dfd[15] = ((block.width - 1) << 0) | 
                  ((block.height - 1) << 2) | 
                  (0 << 4) | 
                  (0 << 6);
        
        // Bytes 16-19: planes (1 plane)
        dfd[16] = 1;
        dfd[17] = 0;
        dfd[18] = 0;
        dfd[19] = 0;
        
        // Bytes 20-23: bytes plane 0 (0 = calculate from dimensions)
        dfd[20] = 0;
        dfd[21] = 0;
        dfd[22] = 0;
        dfd[23] = 0;
        
        // Sample info starts at byte 24
        // For ASTC, we have one sample describing RGBA
        // Sample 0: bytes 24-27
        dfd[24] = 0x81; // channel ID: R, format: uint
        dfd[25] = 0x40; // qualifiers: none, sample-low: 0, sample-high: 1
        dfd[26] = 0x08; // bit offset: 0, bits: 8
        dfd[27] = 0x00; // reserved, plane: 0
        
        // Sample 1: bytes 28-31 (G)
        dfd[28] = 0x82; // channel ID: G
        dfd[29] = 0x40;
        dfd[30] = 0x08;
        dfd[31] = 0x00;
        
        // Sample 2: bytes 32-35 (B)
        dfd[32] = 0x83; // channel ID: B
        dfd[33] = 0x40;
        dfd[34] = 0x08;
        dfd[35] = 0x00;
        
        // Sample 3: bytes 36-39 (A)
        dfd[36] = 0x84; // channel ID: A
        dfd[37] = 0x40;
        dfd[38] = 0x08;
        dfd[39] = 0x00;
        
        // Combine header + DFD + ASTC data
        const combined = new Uint8Array(headerSize + dfdSize + astcData.byteLength);
        combined.set(header, 0);
        combined.set(dfd, headerSize);
        combined.set(new Uint8Array(astcData), headerSize + dfdSize);
        
        return combined.buffer;
    }

    /**
     * Get supported block sizes
     */
    getBlockSizes() {
        return Object.keys(this.blockSizes);
    }

    /**
     * Get quality modes
     */
    getQualityModes() {
        return Object.keys(this.qualityModes);
    }

    /**
     * Get color profiles
     */
    getColorProfiles() {
        return Object.keys(this.colorProfiles);
    }

    /**
     * Check if WASM encoder is available for production use
     */
    isProductionReady() {
        return this.wasmEncoderAvailable;
    }
}

// Export singleton instance
const astcEncoder = new ASTCEncoder();

export default astcEncoder;