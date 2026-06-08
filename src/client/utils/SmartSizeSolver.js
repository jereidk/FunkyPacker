/**
 * SmartSizeSolver - Calculates optimal atlas dimensions using parallel Web Workers
 * Optimized for FNF sprites with irregular sizes
 */
import { Observer, GLOBAL_EVENT } from '../Observer';

const MAX_SIZE_LIMIT = 4096;
const SIZE_INCREMENT = 32;

class SmartSizeSolver {
    constructor() {
        this.workers = [];
        this.isCalculating = false;
        this.results = [];
        this.onCompleteCallback = null;
        this.totalWorkers = 0;
        this.completedWorkers = 0;
    }

    /**
     * Calculate optimal dimensions for given sprites
     * @param {Array} rects - Array of sprite rectangles with frame dimensions
     * @param {Object} options - Solver options
     * @param {Function} onProgress - Progress callback
     * @param {Function} onComplete - Completion callback with result
     */
    calculate(rects, options = {}, onProgress = null, onComplete = null) {
        if (rects.length === 0) {
            if (onComplete) onComplete({ width: 512, height: 512, efficiency: 0, wastedArea: 0 });
            return;
        }

        this.isCalculating = true;
        this.results = [];
        this.onCompleteCallback = onComplete;
        this.totalWorkers = 0;
        this.completedWorkers = 0;

        // Calculate bounds for candidate widths
        let maxSpriteWidth = 0;
        let maxSpriteHeight = 0;
        let totalWidth = 0;
        let totalHeight = 0;

        for (let rect of rects) {
            let w = rect.frame.w;
            let h = rect.frame.h;
            if (w > maxSpriteWidth) maxSpriteWidth = w;
            if (h > maxSpriteHeight) maxSpriteHeight = h;
            totalWidth += w;
            totalHeight += h;
        }

        const padding = options.spritePadding || 0;
        const borderPadding = options.borderPadding || 0;
        const allowRotation = options.allowRotation || false;
        const maxSizeLimit = options.disableMaxLimit ? 8192 : MAX_SIZE_LIMIT;

        // Generate candidate widths from maxSpriteWidth to totalWidth
        let candidateWidths = [];
        for (let w = maxSpriteWidth; w <= Math.min(totalWidth, maxSizeLimit); w += SIZE_INCREMENT) {
            candidateWidths.push(w);
        }
        // Ensure we include totalWidth if within limits
        if (totalWidth <= maxSizeLimit && !candidateWidths.includes(totalWidth)) {
            candidateWidths.push(totalWidth);
        }

        if (candidateWidths.length === 0) {
            candidateWidths = [maxSpriteWidth];
        }

        // Determine number of workers based on hardware concurrency
        const workerCount = Math.min(navigator.hardwareConcurrency || 4, candidateWidths.length);
        const candidatesPerWorker = Math.ceil(candidateWidths.length / workerCount);

        // Emit start event
        Observer.emit(GLOBAL_EVENT.SOLVER_STARTED, { totalWorkers: workerCount });

        // Create and launch workers
        for (let i = 0; i < workerCount; i++) {
            const startIdx = i * candidatesPerWorker;
            const endIdx = Math.min(startIdx + candidatesPerWorker, candidateWidths.length);
            const workerWidths = candidateWidths.slice(startIdx, endIdx);

            if (workerWidths.length === 0) continue;

            this.launchWorker(workerWidths, {
                maxSpriteHeight,
                totalHeight,
                padding,
                borderPadding,
                allowRotation,
                maxSizeLimit,
                workerIndex: i,
                totalWorkers: workerCount
            }, onProgress);
        }
    }

    launchWorker(widths, config, onProgress) {
        const workerCode = this.getWorkerCode();
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        this.workers.push(worker);
        this.totalWorkers++;

        worker.onmessage = (e) => {
            this.handleWorkerMessage(e, onProgress);
        };

        worker.onerror = (e) => {
            console.error('Worker error:', e);
            this.completedWorkers++;
            this.checkCompletion(onProgress);
        };

        worker.postMessage({
            type: 'calculate',
            widths: widths,
            config: config
        });
    }

    getWorkerCode() {
        return `
            // Web Worker for SmartSizeSolver
            self.onmessage = function(e) {
                if (e.data.type === 'calculate') {
                    const { widths, config } = e.data;
                    const results = [];

                    for (const width of widths) {
                        const result = calculateForWidth(width, config);
                        results.push(result);
                    }

                    self.postMessage({
                        type: 'results',
                        results: results,
                        workerIndex: config.workerIndex
                    });
                }
            };

            function calculateForWidth(width, config) {
                const { maxSpriteHeight, totalHeight, padding, borderPadding, allowRotation, maxSizeLimit } = config;

                // Calculate minimum height needed for this width
                let height = calculateMinHeight(width, maxSpriteHeight, totalHeight, padding, borderPadding, allowRotation, maxSizeLimit);

                // Calculate efficiency
                let totalSpriteArea = 0;
                // Estimate based on average assumptions
                const avgArea = width * height / 4; // Rough estimate
                const efficiency = Math.min(0.95, avgArea > 0 ? (totalHeight * width * 0.3) / (width * height) : 0);

                // Calculate actual efficiency based on fitting
                const fitResult = fitSprites(width, height, maxSpriteHeight, padding, borderPadding, allowRotation);
                const wastedArea = (width * height) - fitResult.usedArea;

                return {
                    width: width,
                    height: height,
                    efficiency: fitResult.efficiency,
                    wastedArea: wastedArea,
                    sheets: fitResult.sheets
                };
            }

            function calculateMinHeight(baseWidth, maxSpriteHeight, totalHeight, padding, borderPadding, allowRotation, maxSizeLimit) {
                // Start with minimum and grow until sprites fit
                let height = maxSpriteHeight + padding * 2 + borderPadding * 2;
                const maxIterations = 100;
                let iterations = 0;

                while (height <= maxSizeLimit && iterations < maxIterations) {
                    const result = canFit(baseWidth, height, maxSpriteHeight, padding, borderPadding, allowRotation);
                    if (result.canFit) {
                        return height;
                    }
                    height += SIZE_INCREMENT;
                    iterations++;
                }

                return height;
            }

            function canFit(width, height, maxSpriteHeight, padding, borderPadding, allowRotation) {
                // Simple bin packing simulation
                let freeRects = [{ x: borderPadding, y: borderPadding, w: width - borderPadding * 2, h: height - borderPadding * 2 }];
                let totalArea = 0;

                // Estimate by simulating placement
                const testSprites = Math.ceil(width * height / ((maxSpriteHeight + padding) * (maxSpriteHeight + padding)));
                const usedArea = testSprites * (maxSpriteHeight + padding) * (maxSpriteHeight + padding);

                return {
                    canFit: usedArea <= width * height,
                    usedArea: usedArea
                };
            }

            function fitSprites(width, height, maxSpriteHeight, padding, borderPadding, allowRotation) {
                // Calculate how much area can be used
                const usableWidth = width - borderPadding * 2;
                const usableHeight = height - borderPadding * 2;
                const totalArea = usableWidth * usableHeight;

                // Estimate fitting efficiency based on dimensions
                const spriteSize = maxSpriteHeight + padding;
                const cols = Math.floor(usableWidth / spriteSize);
                const rows = Math.floor(usableHeight / spriteSize);
                const estimatedSprites = cols * rows;

                // Calculate actual used area
                const usedWidth = cols * spriteSize;
                const usedHeight = rows * spriteSize;
                const usedArea = usedWidth * usedHeight;

                const efficiency = totalArea > 0 ? usedArea / totalArea : 0;

                return {
                    usedArea: usedArea,
                    efficiency: Math.min(efficiency, 0.95)
                };
            }

            const SIZE_INCREMENT = 32;
        `;
    }

    handleWorkerMessage(e, onProgress) {
        const { results, workerIndex } = e.data;

        this.results = this.results.concat(results);
        this.completedWorkers++;

        if (onProgress) {
            onProgress({
                completedWorkers: this.completedWorkers,
                totalWorkers: this.totalWorkers,
                resultsCount: this.results.length
            });
        }

        Observer.emit(GLOBAL_EVENT.SOLVER_PROGRESS, {
            completedWorkers: this.completedWorkers,
            totalWorkers: this.totalWorkers
        });

        this.checkCompletion(onProgress);
    }

    checkCompletion(onProgress) {
        if (this.completedWorkers >= this.totalWorkers && this.totalWorkers > 0) {
            this.finalize(onProgress);
        }
    }

    finalize(onProgress) {
        // Find best result (highest efficiency)
        let bestResult = null;
        for (let result of this.results) {
            if (!bestResult || result.efficiency > bestResult.efficiency) {
                bestResult = result;
            } else if (result.efficiency === bestResult.efficiency) {
                // If efficiency is equal, prefer smaller area
                const resultArea = result.width * result.height;
                const bestArea = bestResult.width * bestResult.height;
                if (resultArea < bestArea) {
                    bestResult = result;
                }
            }
        }

        // Clean up workers
        this.cleanup();

        this.isCalculating = false;

        // Emit completion
        Observer.emit(GLOBAL_EVENT.SOLVER_COMPLETE, bestResult);

        if (this.onCompleteCallback) {
            this.onCompleteCallback(bestResult);
        }
    }

    cleanup() {
        for (let worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
    }

    /**
     * Check if dimensions exceed the limit and calculate scale factor if needed
     */
    static checkScaleRequired(width, height, maxSize = MAX_SIZE_LIMIT) {
        let scale = 1;
        let scaledWidth = width;
        let scaledHeight = height;

        if (width > maxSize || height > maxSize) {
            // Calculate scale to fit within limit
            const scaleX = maxSize / width;
            const scaleY = maxSize / height;
            scale = Math.min(scaleX, scaleY);

            // Ensure scale is a reasonable value (at least 0.25)
            if (scale < 0.25) scale = 0.25;

            scaledWidth = Math.floor(width * scale);
            scaledHeight = Math.floor(height * scale);
        }

        return { scale, scaledWidth, scaledHeight, requiresScale: scale < 1 };
    }

    /**
     * Calculate multi-atlas distribution
     */
    static calculateMultiAtlas(rects, options = {}, onProgress = null, onComplete = null) {
        if (rects.length === 0) {
            if (onComplete) onComplete([]);
            return [];
        }

        const maxSizeLimit = options.disableMaxLimit ? 8192 : MAX_SIZE_LIMIT;
        const padding = options.spritePadding || 0;
        const borderPadding = options.borderPadding || 0;
        const allowRotation = options.allowRotation || false;

        // Sort rects by area (largest first) for better packing
        const sortedRects = [...rects].sort((a, b) => {
            const areaA = a.frame.w * a.frame.h;
            const areaB = b.frame.w * b.frame.h;
            return areaB - areaA;
        });

        let sheets = [];
        let remainingRects = sortedRects;

        while (remainingRects.length > 0) {
            // Find optimal dimensions for current batch
            const result = SmartSizeSolver.findOptimalSingleSheet(remainingRects, {
                maxSizeLimit,
                padding,
                borderPadding,
                allowRotation
            });

            if (result.rects.length === 0) {
                break;
            }

            sheets.push({
                rects: result.rects,
                width: result.width,
                height: result.height,
                efficiency: result.efficiency
            });

            // Remove packed rects from remaining
            const packedNames = new Set(result.rects.map(r => r.name));
            remainingRects = remainingRects.filter(r => !packedNames.has(r.name));
        }

        if (onComplete) {
            onComplete(sheets);
        }

        return sheets;
    }

    static findOptimalSingleSheet(rects, options) {
        const { maxSizeLimit, padding, borderPadding, allowRotation } = options;

        // Calculate bounds
        let maxSpriteWidth = 0;
        let maxSpriteHeight = 0;
        let totalArea = 0;

        for (let rect of rects) {
            const w = rect.frame.w + padding * 2;
            const h = rect.frame.h + padding * 2;
            if (w > maxSpriteWidth) maxSpriteWidth = w;
            if (h > maxSpriteHeight) maxSpriteHeight = h;
            totalArea += rect.frame.w * rect.frame.h;
        }

        // Try different widths
        let bestResult = null;
        const startWidth = maxSpriteWidth;
        const endWidth = Math.min(maxSizeLimit, totalArea);

        for (let width = startWidth; width <= endWidth; width += SIZE_INCREMENT) {
            const height = SmartSizeSolver.calculateSheetHeight(rects, width, maxSpriteHeight, padding, borderPadding, maxSizeLimit);

            if (height <= maxSizeLimit) {
                const result = SmartSizeSolver.tryPack(rects, width, height, padding, borderPadding, allowRotation);

                if (result.success && (!bestResult || result.efficiency > bestResult.efficiency)) {
                    bestResult = { ...result, width, height };
                }
            }
        }

        return bestResult || { rects: [], width: maxSpriteWidth, height: maxSpriteHeight, efficiency: 0 };
    }

    static calculateSheetHeight(rects, width, maxSpriteHeight, padding, borderPadding, maxSizeLimit) {
        // Simple row-based calculation
        let currentX = borderPadding;
        let currentY = borderPadding;
        let rowHeight = 0;
        let maxY = borderPadding;

        for (let rect of rects) {
            const spriteW = rect.frame.w + padding * 2;
            const spriteH = rect.frame.h + padding * 2;

            if (currentX + spriteW > width - borderPadding) {
                // New row
                currentX = borderPadding;
                currentY += rowHeight;
                rowHeight = 0;
            }

            currentX += spriteW;
            if (spriteH > rowHeight) rowHeight = spriteH;
            maxY = currentY + rowHeight;
        }

        return maxY + borderPadding;
    }

    static tryPack(rects, width, height, padding, borderPadding, allowRotation) {
        // Simple bin packing simulation
        let freeRects = [{ x: borderPadding, y: borderPadding, w: width - borderPadding * 2, h: height - borderPadding * 2 }];
        let packedRects = [];
        let totalUsedArea = 0;

        for (let rect of rects) {
            const w = rect.frame.w + padding * 2;
            const h = rect.frame.h + padding * 2;

            // Find best position
            let bestPos = null;
            let bestShortSide = Infinity;

            for (let i = 0; i < freeRects.length; i++) {
                const fr = freeRects[i];

                if (fr.w >= w && fr.h >= h) {
                    const shortSide = Math.min(fr.w - w, fr.h - h);
                    if (shortSide < bestShortSide) {
                        bestShortSide = shortSide;
                        bestPos = { x: fr.x, y: fr.y, w: w, h: h, freeRectIndex: i };
                    }
                }

                // Check rotated
                if (allowRotation && fr.w >= h && fr.h >= w) {
                    const shortSide = Math.min(fr.w - h, fr.h - w);
                    if (shortSide < bestShortSide) {
                        bestShortSide = shortSide;
                        bestPos = { x: fr.x, y: fr.y, w: h, h: w, freeRectIndex: i, rotated: true };
                    }
                }
            }

            if (bestPos) {
                // Update rect with position
                const packedRect = { ...rect };
                packedRect.frame = { x: bestPos.x, y: bestPos.y, w: rect.frame.w, h: rect.frame.h };
                packedRect.rotated = bestPos.rotated || false;
                packedRects.push(packedRect);
                totalUsedArea += rect.frame.w * rect.frame.h;

                // Update free rectangles
                SmartSizeSolver.splitFreeRect(freeRects, bestPos);
            }
        }

        const efficiency = (width * height) > 0 ? totalUsedArea / (width * height) : 0;
        return {
            success: packedRects.length === rects.length,
            rects: packedRects,
            efficiency,
            usedArea: totalUsedArea
        };
    }

    static splitFreeRect(freeRects, placedRect) {
        const idx = placedRect.freeRectIndex;
        const fr = freeRects[idx];
        const { x, y, w, h } = placedRect;

        // Remove the used free rect
        freeRects.splice(idx, 1);

        // Add remaining rectangles
        // Right
        if (fr.x + fr.w > x + w) {
            freeRects.push({
                x: x + w,
                y: fr.y,
                w: fr.x + fr.w - (x + w),
                h: fr.h
            });
        }
        // Bottom
        if (fr.y + fr.h > y + h) {
            freeRects.push({
                x: fr.x,
                y: y + h,
                w: fr.w,
                h: fr.y + fr.h - (y + h)
            });
        }
    }

    cancel() {
        this.cleanup();
        this.isCalculating = false;
        Observer.emit(GLOBAL_EVENT.SOLVER_CANCELLED, {});
    }

    getIsCalculating() {
        return this.isCalculating;
    }
}

export default SmartSizeSolver;