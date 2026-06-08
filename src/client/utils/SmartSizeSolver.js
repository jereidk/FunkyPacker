/**
 * SmartSizeSolver - Calculates optimal atlas dimensions
 * Optimized for FNF sprites with irregular sizes
 */

const MAX_SIZE_LIMIT = 4096;

class SmartSizeSolver {
    static calculateOptimalDimensions(rects, options = {}) {
        if (rects.length === 0) {
            return { width: 512, height: 512, efficiency: 0 };
        }

        const padding = options.padding || 0;
        const borderPadding = options.borderPadding || 0;
        const allowRotation = options.allowRotation || false;
        const maxSizeLimit = options.disableMaxLimit ? 8192 : MAX_SIZE_LIMIT;

        // Find min/max dimensions
        let maxSpriteWidth = 0;
        let maxSpriteHeight = 0;
        let totalWidth = 0;

        for (let rect of rects) {
            const w = rect.frame.w + padding * 2;
            const h = rect.frame.h + padding * 2;
            if (w > maxSpriteWidth) maxSpriteWidth = w;
            if (h > maxSpriteHeight) maxSpriteHeight = h;
            totalWidth += rect.frame.w + padding * 2;
        }

        // Try different widths to find optimal
        let bestResult = null;
        const startWidth = maxSpriteWidth;
        const endWidth = Math.min(totalWidth, maxSizeLimit);

        for (let width = startWidth; width <= endWidth; width += 32) {
            const height = this.calculateMinHeight(rects, width, padding, borderPadding, maxSizeLimit);
            
            if (height <= maxSizeLimit) {
                const result = this.tryPack(rects, width, height, padding, allowRotation);
                result.width = width;
                result.height = height;
                
                if (!bestResult || result.efficiency > bestResult.efficiency) {
                    bestResult = result;
                }
            }
        }

        return bestResult || { width: maxSpriteWidth, height: maxSpriteHeight, efficiency: 0 };
    }

    static calculateMinHeight(rects, width, padding, borderPadding, maxSizeLimit) {
        let height = padding + borderPadding;
        let rowHeight = 0;
        let x = borderPadding + padding;

        // Sort by height (tallest first)
        const sorted = [...rects].sort((a, b) => b.frame.h - a.frame.h);

        for (let rect of sorted) {
            const spriteWidth = rect.frame.w + padding * 2;
            const spriteHeight = rect.frame.h + padding * 2;

            if (x + spriteWidth > width - borderPadding - padding) {
                // New row
                x = borderPadding + padding;
                height += rowHeight;
                rowHeight = 0;
            }

            x += spriteWidth;
            if (spriteHeight > rowHeight) rowHeight = spriteHeight;
        }

        height += rowHeight + borderPadding + padding;
        return Math.min(height, maxSizeLimit);
    }

    static tryPack(rects, width, height, padding, allowRotation) {
        const freeRects = [{ x: padding, y: padding, w: width - padding * 2, h: height - padding * 2 }];
        const packed = [];
        let totalArea = width * height;
        let usedArea = 0;

        for (let rect of rects) {
            const spriteWidth = rect.frame.w + padding * 2;
            const spriteHeight = rect.frame.h + padding * 2;

            let bestRect = null;
            let bestShortSideFit = Infinity;
            let bestLongSideFit = Infinity;
            let rotated = false;

            for (let i = 0; i < freeRects.length; i++) {
                const free = freeRects[i];

                // Try without rotation
                if (free.w >= spriteWidth && free.h >= spriteHeight) {
                    const leftoverH = free.w - spriteWidth;
                    const leftoverV = free.h - spriteHeight;
                    const shortSideFit = Math.min(leftoverH, leftoverV);
                    const longSideFit = Math.max(leftoverH, leftoverV);

                    if (shortSideFit < bestShortSideFit || 
                        (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)) {
                        bestRect = { x: free.x, y: free.y, w: spriteWidth, h: spriteHeight, freeRectIndex: i };
                        bestShortSideFit = shortSideFit;
                        bestLongSideFit = longSideFit;
                        rotated = false;
                    }
                }

                // Try with rotation
                if (allowRotation && free.w >= spriteHeight && free.h >= spriteWidth) {
                    const leftoverH = free.w - spriteHeight;
                    const leftoverV = free.h - spriteWidth;
                    const shortSideFit = Math.min(leftoverH, leftoverV);
                    const longSideFit = Math.max(leftoverH, leftoverV);

                    if (shortSideFit < bestShortSideFit || 
                        (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)) {
                        bestRect = { x: free.x, y: free.y, w: spriteHeight, h: spriteWidth, freeRectIndex: i };
                        bestShortSideFit = shortSideFit;
                        bestLongSideFit = longSideFit;
                        rotated = true;
                    }
                }
            }

            if (bestRect) {
                // Split free rectangle
                const free = freeRects[bestRect.freeRectIndex];
                freeRects.splice(bestRect.freeRectIndex, 1);

                // Right
                if (free.x + free.w > bestRect.x + bestRect.w) {
                    freeRects.push({
                        x: bestRect.x + bestRect.w,
                        y: free.y,
                        w: free.x + free.w - (bestRect.x + bestRect.w),
                        h: free.h
                    });
                }

                // Bottom
                if (free.y + free.h > bestRect.y + bestRect.h) {
                    freeRects.push({
                        x: free.x,
                        y: bestRect.y + bestRect.h,
                        w: free.w,
                        h: free.y + free.h - (bestRect.y + bestRect.h)
                    });
                }

                packed.push({
                    ...rect,
                    frame: {
                        x: bestRect.x + padding,
                        y: bestRect.y + padding,
                        w: rotated ? rect.frame.h : rect.frame.w,
                        h: rotated ? rect.frame.w : rect.frame.h
                    },
                    rotated: rotated
                });
                usedArea += rect.frame.w * rect.frame.h;
            }
        }

        return {
            rects: packed,
            efficiency: totalArea > 0 ? usedArea / totalArea : 0,
            width: width,
            height: height
        };
    }

    static checkScaleRequired(width, height, maxSize = 4096) {
        if (width <= maxSize && height <= maxSize) {
            return { requiresScale: false, scale: 1, scaledWidth: width, scaledHeight: height };
        }

        const scaleW = maxSize / width;
        const scaleH = maxSize / height;
        const scale = Math.min(scaleW, scaleH);

        return {
            requiresScale: true,
            scale: Math.max(0.25, scale),
            scaledWidth: Math.round(width * scale),
            scaledHeight: Math.round(height * scale)
        };
    }
}

export default SmartSizeSolver;