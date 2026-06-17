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
 * Values verified against Khronos OpenGL extension registry:
 * GL_KHR_texture_compression_astc_ldr
 */
const ASTC_INTERNAL_FORMATS = {
    '4x4': 0x93B0,  // GL_COMPRESSED_ASTC_4x4_KHR ✓
    '5x5': 0x93B2,  // GL_COMPRESSED_ASTC_5x5_KHR (was incorrectly 0x93B5)
    '6x6': 0x93B4,  // GL_COMPRESSED_ASTC_6x6_KHR (was incorrectly 0x93BA)
    '8x8': 0x93B7,  // GL_COMPRESSED_ASTC_8x8_KHR (was incorrectly 0x93BB)
    '10x10': 0x93BB, // GL_COMPRESSED_ASTC_10x10_KHR (was incorrectly 0x93BC)
    '12x12': 0x93BD  // GL_COMPRESSED_ASTC_12x12_KHR ✓
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
     * 
     * KTX2 spec header layout (after 12-byte identifier):
     * Offset  Size  Field                    Description
     *   12    4    vkFormat                Vulkan format (unused, set to 0 for ASTC)
     *   16    4    typeSize                Size of uncompressed type (1 for ASTC)
     *   20    4    pixelWidth              Image width in pixels
     *   24    4    pixelHeight            Image height in pixels
     *   28    4    pixelDepth             Image depth (1 for 2D)
     *   32    4    layerCount             Number of array elements (0 for 2D)
     *   36    4    faceCount              Number of faces (1 for 2D, 6 for cubemap)
     *   40    4    levelCount             Number of mipmap levels
     *   44    4    supercompressionScheme Compression scheme (0 = none for ASTC)
     *   48    4    dfdByteOffset          Offset to DFD from start of file
     *   52    4    dfdByteLength          Size of DFD
     *   56    4    kvdByteOffset          Offset to KV data from start
     *   60    4    kvdByteLength           Size of KV data
     *   64    8    sgdByteOffset          Offset to SGD from start (8 bytes)
     *   72    8    sgdByteLength           Size of SGD (8 bytes)
     */
    createKTX2(astcData, width, height, blockSize) {
        const block = this.blockSizes[blockSize] || this.blockSizes['4x4'];
        
        // KTX2 header is exactly 80 bytes
        const headerSize = 80;
        const header = new Uint8Array(headerSize);
        
        // 12-byte KTX2 identifier
        // «ktx» with version 2, EOI markers
        const identifier = new Uint8Array([
            0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x0D, 0x0A, 0x1A, 0x0A
        ]);
        header.set(identifier);
        
        // Helper to write u32 little-endian
        const writeU32 = (offset, value) => {
            header[offset] = value & 0xFF;
            header[offset + 1] = (value >> 8) & 0xFF;
            header[offset + 2] = (value >> 16) & 0xFF;
            header[offset + 3] = (value >> 24) & 0xFF;
        };
        
        // Helper to write u64 little-endian (for SGD offsets)
        const writeU64 = (offset, value) => {
            writeU32(offset, value & 0xFFFFFFFF);
            writeU32(offset + 4, Math.floor(value / 0x100000000));
        };
        
        // vkFormat (offset 12): 0 for compressed formats like ASTC
        writeU32(12, 0);
        
        // typeSize (offset 16): 1 for ASTC block size
        writeU32(16, 1);
        
        // pixelWidth (offset 20)
        writeU32(20, width);
        
        // pixelHeight (offset 24)
        writeU32(24, height);
        
        // pixelDepth (offset 28): 1 for 2D textures
        writeU32(28, 1);
        
        // layerCount (offset 32): 0 for non-array 2D textures
        writeU32(32, 0);
        
        // faceCount (offset 36): 1 for 2D textures
        writeU32(36, 1);
        
        // levelCount (offset 40): 1 for base level only
        writeU32(40, 1);
        
        // supercompressionScheme (offset 44): 0 = none (ASTC is already compressed)
        writeU32(44, 0);
        
        // Calculate DFD size (28 bytes for our RGBA sample)
        const dfdSize = 28;
        const dfdOffset = headerSize;
        
        // dfdByteOffset (offset 48)
        writeU32(48, dfdOffset);
        
        // dfdByteLength (offset 52)
        writeU32(52, dfdSize);
        
        // kvdByteOffset (offset 56): immediately after image data
        const imageDataSize = astcData.byteLength;
        const kvdOffset = dfdOffset + dfdSize + imageDataSize;
        writeU32(56, kvdOffset);
        
        // kvdByteLength (offset 60): 0 (no key/value data)
        writeU32(60, 0);
        
        // sgdByteOffset (offset 64): 0 = no SGD for uncompressed reference
        writeU64(64, 0);
        
        // sgdByteLength (offset 72): 0
        writeU64(72, 0);
        
        // Create DFD (Data Format Descriptor) for ASTC RGBA
        // This tells the decoder the color model and channel format
        const dfd = new Uint8Array(dfdSize);
        
        // DFD total size (u32 LE) - bytes 0-3
        writeU32(0, dfdSize);
        
        // vendorId (u32) - bytes 4-7 (0 = Khronos)
        writeU32(4, 0);
        
        // descriptorType (u16 LE) - bytes 8-9
        dfd[8] = 0;
        dfd[9] = 1;
        
        // descriptorBlockModel (u8) - byte 10
        dfd[10] = 0;
        
        // descriptorColorModel (u8) - byte 11
        // 6 = ASTC in KTX2 spec
        dfd[11] = 6;
        
        // descriptorColorPrimaries (u8) - byte 12
        // 0 = unmodified (sRGB/linear per data)
        dfd[12] = 0;
        
        // descriptorTransferFunction (u8) - byte 13
        // 0 = linear
        dfd[13] = 0;
        
        // flags (u8) - byte 14
        dfd[14] = 0;
        
        // texelBlockDimension (u8) - byte 15
        // bits 0-1: dimX-1, bits 2-3: dimY-1, bits 4-5: dimZ-1, bits 6-7: dimW-1
        dfd[15] = ((block.width - 1) << 0) | 
                  ((block.height - 1) << 2) | 
                  (0 << 4) | 
                  (0 << 6);
        
        // bytesPlane (u32) - bytes 16-19
        // 0 = calculate from other fields
        writeU32(16, 0);
        
        // Sample info starts at byte 24
        // For RGBA in ASTC, we have 4 samples (R, G, B, A)
        // Each sample is 4 bytes
        
        // Sample 0: Red channel
        dfd[24] = 0x01; // channelID: 1 = R, format: UINT
        dfd[25] = 0x00; // qualifiers: none
        dfd[26] = 0x08; // bits: 8
        dfd[27] = 0x00; // plane: 0
        
        // Sample 1: Green channel
        dfd[28] = 0x02; // channelID: 2 = G
        dfd[29] = 0x00;
        dfd[30] = 0x08;
        dfd[31] = 0x00;
        
        // Sample 2: Blue channel
        dfd[32] = 0x03; // channelID: 3 = B
        dfd[33] = 0x00;
        dfd[34] = 0x08;
        dfd[35] = 0x00;
        
        // Sample 3: Alpha channel
        dfd[36] = 0x04; // channelID: 4 = A
        dfd[37] = 0x00;
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