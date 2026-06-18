/**
 * AdvancedSmartSizeSolver - Multi-algorithm bin packing for optimal atlas dimensions
 * Implements: MaxRects variants, Guillotine, Shelf, Skyline algorithms
 * Selects the best packing based on efficiency and atlas dimensions
 */

const MAX_SIZE_LIMIT = 4096;

// ============================================
// MAXRECTS PACKER - All Variants
// ============================================
class MaxRectsPacker {
    constructor(width, height, padding = 0) {
        this.binWidth = width;
        this.binHeight = height;
        this.padding = padding;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
        this.usedRects = [];
    }

    clone() {
        const copy = new MaxRectsPacker(this.binWidth, this.binHeight, this.padding);
        copy.freeRects = this.freeRects.map(r => ({ ...r }));
        copy.usedRects = this.usedRects.map(r => ({ ...r }));
        return copy;
    }

    insert(width, height, method = 'BestShortSideFit') {
        let bestRect = null;
        let bestScore = { score1: Infinity, score2: Infinity };

        for (let i = 0; i < this.freeRects.length; i++) {
            const free = this.freeRects[i];

            if (free.w >= width && free.h >= height) {
                const result = this.scoreRect(free, width, height, method, false);
                if (this.isBetter(result, bestScore)) {
                    bestScore = result;
                    bestRect = { x: free.x, y: free.y, w: width, h: height, index: i, rotated: false };
                }
            }

            // Try rotation
            if (free.w >= height && free.h >= width) {
                const result = this.scoreRect(free, height, width, method, true);
                if (this.isBetter(result, bestScore)) {
                    bestScore = result;
                    bestRect = { x: free.x, y: free.y, w: height, h: width, index: i, rotated: true };
                }
            }
        }

        if (bestRect) {
            this.placeRect(bestRect);
            return bestRect;
        }
        return null;
    }

    scoreRect(free, width, height, method, rotated) {
        const leftoverH = free.w - width;
        const leftoverV = free.h - height;
        const shortSide = Math.min(leftoverH, leftoverV);
        const longSide = Math.max(leftoverH, leftoverV);
        const area = free.w * free.h;

        switch (method) {
            case 'BestShortSideFit':
                return { score1: shortSide, score2: longSide };
            case 'BestLongSideFit':
                return { score1: longSide, score2: shortSide };
            case 'BestAreaFit':
                return { score1: area - width * height, score2: shortSide };
            case 'BottomLeftRule':
                return { score1: free.y + height, score2: free.x };
            case 'ContactPoint':
                return { score1: this.contactScore(free.x, free.y, width, height), score2: 0 };
            default:
                return { score1: shortSide, score2: longSide };
        }
    }

    isBetter(newScore, bestScore) {
        if (newScore.score1 < bestScore.score1) return true;
        if (newScore.score1 === bestScore.score1 && newScore.score2 < bestScore.score2) return true;
        return false;
    }

    contactScore(x, y, width, height) {
        let score = 0;
        if (x === 0 || x + width === this.binWidth) score += height;
        if (y === 0 || y + height === this.binHeight) score += width;
        
        for (const rect of this.usedRects) {
            if (rect.x === x + width || rect.x + rect.w === x)
                score += this.intervalOverlap(rect.y, rect.y + rect.h, y, y + height);
            if (rect.y === y + height || rect.y + rect.h === y)
                score += this.intervalOverlap(rect.x, rect.x + rect.w, x, x + width);
        }
        return score;
    }

    intervalOverlap(aStart, aEnd, bStart, bEnd) {
        if (aEnd < bStart || bEnd < aStart) return 0;
        return Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
    }

    placeRect(rect) {
        // The placed rectangle's bounding box
        const pr = {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h
        };
        const prRight = pr.x + pr.w;
        const prBottom = pr.y + pr.h;

        // IMPORTANT: According to MaxRects algorithm (Jukka Jylänki),
        // we must split ALL free rects that intersect with the placed rectangle,
        // including the one we used for placement.
        // DO NOT remove the used free rect before the split loop!
        // The split loop will naturally exclude the used rect's original area
        // by generating splits only for non-overlapping parts.
        
        const newFreeRects = [];

        for (const free of this.freeRects) {
            const frRight = free.x + free.w;
            const frBottom = free.y + free.h;

            // Check if this free rect intersects with the placed rect
            if (pr.x >= frRight || prRight <= free.x ||
                pr.y >= frBottom || prBottom <= free.y) {
                // No intersection - keep this free rect as-is
                newFreeRects.push(free);
                continue;
            }

            // There IS an intersection - split this free rect against the placed rect
            // This creates up to 4 new free rects (like Guillotine)
            // The overlapping part is simply not included in any split
            
            // Split LEFT: area to the left of placed rect
            if (free.x < pr.x) {
                newFreeRects.push({
                    x: free.x,
                    y: free.y,
                    w: pr.x - free.x,
                    h: free.h
                });
            }

            // Split RIGHT: area to the right of placed rect
            if (frRight > prRight) {
                newFreeRects.push({
                    x: prRight,
                    y: free.y,
                    w: frRight - prRight,
                    h: free.h
                });
            }

            // Split TOP: area above placed rect
            if (free.y < pr.y) {
                newFreeRects.push({
                    x: free.x,
                    y: free.y,
                    w: free.w,
                    h: pr.y - free.y
                });
            }

            // Split BOTTOM: area below placed rect
            if (frBottom > prBottom) {
                newFreeRects.push({
                    x: free.x,
                    y: prBottom,
                    w: free.w,
                    h: frBottom - prBottom
                });
            }
            // NOTE: The overlapping area is NOT added - it becomes occupied space
        }

        // Replace free rects with the split results
        this.freeRects = newFreeRects;

        // Prune any remaining free rects that are contained within others
        this.pruneFreeRects();

        // Add the placed rect to used rects
        this.usedRects.push(rect);
    }

    pruneFreeRects() {
        for (let i = this.freeRects.length - 1; i >= 0; i--) {
            for (let j = this.freeRects.length - 1; j > i; j--) {
                if (this.containsRect(this.freeRects[i], this.freeRects[j])) {
                    this.freeRects.splice(j, 1);
                } else if (this.containsRect(this.freeRects[j], this.freeRects[i])) {
                    this.freeRects.splice(i, 1);
                    break;
                }
            }
        }
    }

    containsRect(a, b) {
        return a.x <= b.x && a.y <= b.y &&
               a.x + a.w >= b.x + b.w &&
               a.y + a.h >= b.y + b.h;
    }

    occupancy() {
        let usedArea = 0;
        for (const rect of this.usedRects) {
            usedArea += rect.w * rect.h;
        }
        return usedArea / (this.binWidth * this.binHeight);
    }
}

// ============================================
// GUILLOTINE PACKER
// ============================================
class GuillotinePacker {
    constructor(width, height, padding = 0) {
        this.binWidth = width;
        this.binHeight = height;
        this.padding = padding;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
        this.usedRects = [];
        this.splitMethod = 'BestShortSideFit';
    }

    insert(width, height) {
        const paddedW = width + this.padding * 2;
        const paddedH = height + this.padding * 2;

        let bestIndex = -1;
        let bestRect = null;
        let bestScore = Infinity;

        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];
            if (rect.w >= paddedW && rect.h >= paddedH) {
                const score = this.score(rect, paddedW, paddedH);
                if (score < bestScore) {
                    bestScore = score;
                    bestIndex = i;
                    bestRect = { ...rect };
                }
            }
        }

        if (bestIndex === -1) return null;

        this.freeRects.splice(bestIndex, 1);

        // Split the free rect to create new free rects
        const splitW = bestRect.w - paddedW;
        const splitH = bestRect.h - paddedH;

        if (splitW > 0 && splitH > 0) {
            // Split in both directions - creates two new free rects
            if (this.splitMethod === 'BestShortSideFit') {
                // Prefer splitting along the shorter remaining side
                if (splitW < splitH) {
                    // Split vertically first: right rect (splitW wide), bottom rect (full width)
                    this.freeRects.push({ 
                        x: bestRect.x + paddedW, 
                        y: bestRect.y, 
                        w: splitW, 
                        h: bestRect.h 
                    });
                    this.freeRects.push({ 
                        x: bestRect.x, 
                        y: bestRect.y + paddedH, 
                        w: bestRect.w,  // Full width for bottom rect
                        h: splitH 
                    });
                } else {
                    // Split horizontally first: bottom rect (splitH tall), right rect (full height)
                    this.freeRects.push({ 
                        x: bestRect.x, 
                        y: bestRect.y + paddedH, 
                        w: bestRect.w, 
                        h: splitH 
                    });
                    this.freeRects.push({ 
                        x: bestRect.x + paddedW, 
                        y: bestRect.y, 
                        w: splitW, 
                        h: paddedH  // Use paddedH (sprite height) for right rect
                    });
                }
            } else {
                // BestAreaFit: prefer split that leaves larger usable area
                if (splitW * bestRect.h > splitH * bestRect.w) {
                    // Split vertically: right rect
                    this.freeRects.push({ 
                        x: bestRect.x + paddedW, 
                        y: bestRect.y, 
                        w: splitW, 
                        h: bestRect.h 
                    });
                    this.freeRects.push({ 
                        x: bestRect.x, 
                        y: bestRect.y + paddedH, 
                        w: bestRect.w, 
                        h: splitH 
                    });
                } else {
                    // Split horizontally: bottom rect
                    this.freeRects.push({ 
                        x: bestRect.x, 
                        y: bestRect.y + paddedH, 
                        w: bestRect.w, 
                        h: splitH 
                    });
                    this.freeRects.push({ 
                        x: bestRect.x + paddedW, 
                        y: bestRect.y, 
                        w: splitW, 
                        h: paddedH 
                    });
                }
            }
        } else if (splitW > 0) {
            // Only horizontal split possible (vertical space exhausted)
            this.freeRects.push({ 
                x: bestRect.x + paddedW, 
                y: bestRect.y, 
                w: splitW, 
                h: bestRect.h 
            });
        } else if (splitH > 0) {
            // Only vertical split possible (horizontal space exhausted)
            this.freeRects.push({ 
                x: bestRect.x, 
                y: bestRect.y + paddedH, 
                w: bestRect.w, 
                h: splitH 
            });
        }

        const placed = { x: bestRect.x + this.padding, y: bestRect.y + this.padding, w: width, h: height, padded: true };
        this.usedRects.push(placed);
        return placed;
    }

    score(rect, width, height) {
        if (this.splitMethod === 'BestShortSideFit') {
            const leftoverH = rect.w - width;
            const leftoverV = rect.h - height;
            return Math.min(leftoverH, leftoverV);
        }
        return rect.w * rect.h - width * height;
    }

    occupancy() {
        let usedArea = 0;
        for (const rect of this.usedRects) {
            usedArea += rect.w * rect.h;
        }
        return usedArea / (this.binWidth * this.binHeight);
    }
}

// ============================================
// SHELF PACKER
// ============================================
class ShelfPacker {
    constructor(width, height, padding = 0) {
        this.binWidth = width;
        this.binHeight = height;
        this.padding = padding;
        this.shelves = [];
        this.usedRects = [];
        this.currentY = 0;
    }

    insert(width, height) {
        const paddedW = width + this.padding * 2;
        const paddedH = height + this.padding * 2;

        // Find best shelf
        let bestShelfIndex = -1;
        let bestScore = Infinity;

        for (let i = 0; i < this.shelves.length; i++) {
            const shelf = this.shelves[i];
            if (shelf.height >= paddedH && shelf.usedWidth + paddedW <= this.binWidth) {
                const leftover = shelf.height - paddedH;
                if (leftover < bestScore) {
                    bestScore = leftover;
                    bestShelfIndex = i;
                }
            }
        }

        let shelf;
        if (bestShelfIndex === -1) {
            // Create new shelf
            shelf = {
                height: paddedH,
                usedWidth: 0,
                y: this.currentY
            };
            this.shelves.push(shelf);
            this.currentY += paddedH;
        } else {
            shelf = this.shelves[bestShelfIndex];
        }

        const rect = {
            x: shelf.usedWidth + this.padding,
            y: shelf.y + this.padding,
            w: width,
            h: height
        };

        shelf.usedWidth += paddedW;
        this.usedRects.push(rect);
        return rect;
    }

    occupancy() {
        let usedArea = 0;
        for (const rect of this.usedRects) {
            usedArea += rect.w * rect.h;
        }
        return usedArea / (this.binWidth * this.binHeight);
    }

    getHeight() {
        if (this.shelves.length === 0) return 0;
        const lastShelf = this.shelves[this.shelves.length - 1];
        return lastShelf.y + lastShelf.height;
    }
}

// ============================================
// SKYLINE PACKER
// ============================================
class SkylinePacker {
    constructor(width, height, padding = 0) {
        this.binWidth = width;
        this.binHeight = height;
        this.padding = padding;
        this.skyline = [{ x: 0, y: 0, w: width }];
        this.usedRects = [];
    }

    insert(width, height) {
        const paddedW = width + this.padding * 2;
        const paddedH = height + this.padding * 2;

        let bestIndex = -1;
        let bestX = 0;
        let bestY = Infinity;

        for (let i = 0; i < this.skyline.length; i++) {
            const result = this.findPosition(i, paddedW);
            if (result.y < bestY || (result.y === bestY && result.x < bestX)) {
                bestIndex = result.index;
                bestX = result.x;
                bestY = result.y;
            }
        }

        if (bestY === Infinity || bestY + paddedH > this.binHeight) return null;

        // Place rectangle
        const rect = {
            x: bestX + this.padding,
            y: bestY + this.padding,
            w: width,
            h: height
        };

        // Update skyline - the new skyline level should be at top of placed rect
        // (bestY is the skyline height, rect.y = bestY + padding, top = rect.y + height)
        // So skyline node y should be: bestY + height (NOT bestY + paddedH)
        const newNode = { x: bestX, y: bestY + height, w: paddedW };
        this.skyline.splice(bestIndex, 0, newNode);

        // Merge adjacent skyline levels that have the same height
        // This consolidates the skyline and prevents fragmentation
        for (let i = 0; i < this.skyline.length - 1; i++) {
            const current = this.skyline[i];
            const next = this.skyline[i + 1];
            
            // If adjacent nodes have the same y, they can be merged
            if (current.y === next.y) {
                current.w += next.w;
                this.skyline.splice(i + 1, 1);
                i--;
            }
        }

        this.usedRects.push(rect);
        return rect;
    }

    findPosition(startIndex, width) {
        let bestX = this.skyline[startIndex].x;
        let bestY = this.findBestY(startIndex, width);
        let bestIndex = startIndex;

        for (let i = startIndex + 1; i < this.skyline.length; i++) {
            const x = this.skyline[i].x;
            const y = this.findBestY(i, width);
            if (y < bestY || (y === bestY && x < bestX)) {
                bestX = x;
                bestY = y;
                bestIndex = i;
            }
        }

        return { x: bestX, y: bestY, index: bestIndex };
    }

    findBestY(index, width) {
        let y = 0;
        let i = index;
        let x = this.skyline[index].x;

        while (i < this.skyline.length && x + width > this.skyline[i].x) {
            y = Math.max(y, this.skyline[i].y);
            x = this.skyline[i].x + this.skyline[i].w;
            i++;
        }

        return y;
    }

    occupancy() {
        let usedArea = 0;
        for (const rect of this.usedRects) {
            usedArea += rect.w * rect.h;
        }
        return usedArea / (this.binWidth * this.binHeight);
    }

    getHeight() {
        if (this.skyline.length === 0) return 0;
        // Find the maximum y position in the skyline
        // This represents the highest occupied space in the bin
        let maxY = 0;
        for (const node of this.skyline) {
            // Each node's y represents the top of placed rectangles at that x position
            // The height of the bin used is the max y value
            if (node.y > maxY) {
                maxY = node.y;
            }
        }
        return maxY;
    }
}

// ============================================
// MAIN SOLVER CLASS
// ============================================
class AdvancedSmartSizeSolver {
    // Algorithm identifiers
    static ALGORITHM = {
        BEST: 'best',
        MAXRECTS_BSSF: 'maxrects_bssf',
        MAXRECTS_BLSF: 'maxrects_blsf',
        MAXRECTS_BAF: 'maxrects_baf',
        MAXRECTS_BLR: 'maxrects_blr',
        MAXRECTS_CP: 'maxrects_cp',
        GUILLOTINE_BSSF: 'guillotine_bssf',
        GUILLOTINE_BAF: 'guillotine_baf',
        SHELF: 'shelf',
        SKYLINE: 'skyline'
    };

    static ALGORITHM_NAMES = {
        'best': 'Best Overall',
        'maxrects_bssf': 'MaxRects (Best Short Side)',
        'maxrects_blsf': 'MaxRects (Best Long Side)',
        'maxrects_baf': 'MaxRects (Best Area Fit)',
        'maxrects_blr': 'MaxRects (Bottom Left)',
        'maxrects_cp': 'MaxRects (Contact Point)',
        'guillotine_bssf': 'Guillotine (Short Side)',
        'guillotine_baf': 'Guillotine (Best Area)',
        'shelf': 'Shelf',
        'skyline': 'Skyline'
    };

    /**
     * Calculate optimal atlas dimensions using multiple algorithms
     * @param {Array} rects - Array of sprite rectangles with frame.w and frame.h
     * @param {Object} options - Solver options
     * @returns {Object} - { width, height, efficiency, algorithm, rects }
     */
    static calculateOptimalDimensions(rects, options = {}) {
        if (rects.length === 0) {
            return { width: 512, height: 512, efficiency: 0, algorithm: 'best' };
        }

        const padding = options.padding || 0;
        const borderPadding = options.borderPadding || 0;
        const allowRotation = options.allowRotation || false;
        const maxSizeLimit = options.disableMaxLimit ? 8192 : MAX_SIZE_LIMIT;
        const requestedAlgorithm = options.algorithm || AdvancedSmartSizeSolver.ALGORITHM.BEST;

        // Get sprite sizes with padding
        const sprites = rects.map(rect => ({
            w: rect.frame.w,
            h: rect.frame.h,
            originalIndex: rects.indexOf(rect)
        }));

        // Sort by area (largest first) for better packing
        sprites.sort((a, b) => (b.w * b.h) - (a.w * a.h));

        // Calculate bounds
        let maxSpriteWidth = Math.max(...sprites.map(s => s.w));
        let maxSpriteHeight = Math.max(...sprites.map(s => s.h));
        let totalArea = sprites.reduce((sum, s) => sum + s.w * s.h, 0);

        // Estimate initial width
        const initialWidth = Math.max(maxSpriteWidth, Math.ceil(Math.sqrt(totalArea)));

        // Generate candidate widths to try
        const widths = this.generateCandidateWidths(initialWidth, maxSpriteWidth, maxSpriteHeight, totalArea, maxSizeLimit);

        let bestOverall = null;

        // Determine which algorithms to run
        const algorithms = requestedAlgorithm === AdvancedSmartSizeSolver.ALGORITHM.BEST
            ? Object.values(AdvancedSmartSizeSolver.ALGORITHM).filter(a => a !== AdvancedSmartSizeSolver.ALGORITHM.BEST)
            : [requestedAlgorithm];

        // Initial exploration: try each width with a large height (maxSizeLimit) to find best packing
        for (const width of widths) {
            for (const algo of algorithms) {
                // Use maxSizeLimit as height for exploration - algorithm will use only what it needs
                const result = this.packWithAlgorithm(sprites, width, maxSizeLimit, algo, padding, borderPadding, maxSizeLimit);
                
                if (result.success && result.efficiency > 0) {
                    if (!bestOverall || this.isBetterResult(result, bestOverall)) {
                        bestOverall = {
                            ...result,
                            width: width,
                            height: result.usedHeight,  // Track actual height used
                            algorithm: algo
                        };
                    }
                }
            }
        }

        // If no packing succeeded, return minimal size
        if (!bestOverall) {
            return {
                width: maxSpriteWidth + padding * 2 + borderPadding * 2,
                height: maxSpriteHeight + padding * 2 + borderPadding * 2,
                efficiency: totalArea / ((maxSpriteWidth + padding * 2 + borderPadding * 2) * (maxSpriteHeight + padding * 2 + borderPadding * 2)),
                algorithm: requestedAlgorithm,
                rects: []
            };
        }

        // Apply border padding to final result
        const finalWidth = bestOverall.width + borderPadding * 2;
        const finalHeight = bestOverall.height + borderPadding * 2;

        // NOTE: We use the exploration result directly (bestOverall) rather than repacking.
        // The exploration packWithAlgorithm already computed correct rect positions
        // using maxSizeLimit as height. Adding borderPadding to positions is done inside
        // packWithAlgorithm when creating packed rects.

        return {
            width: finalWidth,
            height: finalHeight,
            efficiency: bestOverall.efficiency,
            algorithm: bestOverall.algorithm,
            rects: bestOverall.rects
        };
    }

    static generateCandidateWidths(initialWidth, maxSpriteWidth, maxSpriteHeight, totalArea, maxSizeLimit) {
        const widths = new Set();
        
        // Add some strategic widths
        widths.add(maxSpriteWidth);
        widths.add(initialWidth);
        widths.add(Math.ceil(Math.sqrt(totalArea)));
        widths.add(Math.ceil(totalArea / maxSpriteHeight));
        
        // Power of 2 candidates
        for (let w = 64; w <= maxSizeLimit; w *= 2) {
            if (w >= maxSpriteWidth) widths.add(w);
        }
        
        // Power of 2 + offset
        for (let w = 64; w <= maxSizeLimit; w *= 2) {
            if (w >= maxSpriteWidth) {
                widths.add(w - 32);
                widths.add(w + 32);
            }
        }

        // Generate range around initial width
        const step = 32;
        for (let w = Math.max(maxSpriteWidth, initialWidth - 256); w <= Math.min(initialWidth + 256, maxSizeLimit); w += step) {
            widths.add(w);
        }

        // Filter valid widths and sort
        return Array.from(widths)
            .filter(w => w >= maxSpriteWidth && w <= maxSizeLimit)
            .sort((a, b) => a - b);
    }

    static packWithAlgorithm(sprites, width, height, algorithm, padding, borderPadding, maxSizeLimit) {
        // Calculate inner dimensions (excluding border padding)
        const paddedWidth = width - borderPadding * 2;
        const paddedHeight = height - borderPadding * 2;

        let packer;
        let method = 'BestShortSideFit';

        switch (algorithm) {
            case AdvancedSmartSizeSolver.ALGORITHM.MAXRECTS_BSSF:
                packer = new MaxRectsPacker(paddedWidth, paddedHeight, padding);
                method = 'BestShortSideFit';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.MAXRECTS_BLSF:
                packer = new MaxRectsPacker(paddedWidth, paddedHeight, padding);
                method = 'BestLongSideFit';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.MAXRECTS_BAF:
                packer = new MaxRectsPacker(paddedWidth, paddedHeight, padding);
                method = 'BestAreaFit';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.MAXRECTS_BLR:
                packer = new MaxRectsPacker(paddedWidth, paddedHeight, padding);
                method = 'BottomLeftRule';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.MAXRECTS_CP:
                packer = new MaxRectsPacker(paddedWidth, paddedHeight, padding);
                method = 'ContactPoint';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.GUILLOTINE_BSSF:
                packer = new GuillotinePacker(paddedWidth, paddedHeight, padding);
                packer.splitMethod = 'BestShortSideFit';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.GUILLOTINE_BAF:
                packer = new GuillotinePacker(paddedWidth, paddedHeight, padding);
                packer.splitMethod = 'BestAreaFit';
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.SHELF:
                packer = new ShelfPacker(paddedWidth, paddedHeight, padding);
                break;
            case AdvancedSmartSizeSolver.ALGORITHM.SKYLINE:
                packer = new SkylinePacker(paddedWidth, paddedHeight, padding);
                break;
            default:
                packer = new MaxRectsPacker(paddedWidth, paddedHeight, padding);
                method = 'BestShortSideFit';
        }

        const packed = [];
        let maxY = 0;

        for (const sprite of sprites) {
            const rect = (packer instanceof MaxRectsPacker) 
                ? packer.insert(sprite.w, sprite.h, method)
                : packer.insert(sprite.w, sprite.h);
            if (!rect) {
                return { success: false };
            }
            packed.push({
                ...sprite,
                x: rect.x + borderPadding,
                y: rect.y + borderPadding
            });
            maxY = Math.max(maxY, rect.y + rect.h + borderPadding);
        }

        // Calculate actual height used
        let usedHeight = maxY;
        if (packer instanceof ShelfPacker) {
            usedHeight = packer.getHeight() + borderPadding;
        } else if (packer instanceof SkylinePacker) {
            usedHeight = packer.getHeight() + borderPadding;
        }

        // Calculate efficiency
        let totalSpriteArea = 0;
        for (const s of sprites) {
            totalSpriteArea += s.w * s.h;
        }

        const totalArea = width * usedHeight;
        const efficiency = totalSpriteArea / totalArea;

        return {
            success: true,
            width: width,
            height: usedHeight,
            efficiency: efficiency,
            rects: packed,
            usedHeight: usedHeight
        };
    }

    static isBetterResult(a, b) {
        // Prefer higher efficiency
        if (Math.abs(a.efficiency - b.efficiency) > 0.01) {
            return a.efficiency > b.efficiency;
        }
        // If efficiency is similar, prefer smaller area
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        if (areaA !== areaB) {
            return areaA < areaB;
        }
        // Prefer square-ish dimensions
        const ratioA = Math.max(a.width / a.height, a.height / a.width);
        const ratioB = Math.max(b.width / b.height, b.height / b.width);
        return ratioA < ratioB;
    }

    /**
     * Check if scaling is required for the given dimensions
     */
    static checkScaleRequired(width, height, maxSize = MAX_SIZE_LIMIT) {
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

export default AdvancedSmartSizeSolver;
