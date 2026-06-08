/**
 * Smart Size Solver Worker
 * Calculates optimal atlas dimensions using maxrects-packer
 */

const SIZE_INCREMENT = 32;
const MAX_ITERATIONS = 100;

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
    const { maxSpriteHeight, totalHeight, padding, borderPadding, allowRotation, maxSizeLimit, rectsData } = config;

    // Calculate minimum height needed for this width using simple bin packing
    let height = maxSpriteHeight + padding * 2 + borderPadding * 2;
    
    // Ensure minimum height is at least reasonable
    const minHeight = Math.max(height, Math.ceil(totalHeight / (width / maxSpriteHeight)));

    let fitted = false;
    let iterations = 0;

    while (!fitted && height <= maxSizeLimit && iterations < MAX_ITERATIONS) {
        fitted = canFitSprites(width, height, rectsData, padding, borderPadding, allowRotation);
        if (!fitted) {
            height += SIZE_INCREMENT;
        }
        iterations++;
    }

    // Calculate efficiency
    let totalSpriteArea = 0;
    for (let rect of rectsData) {
        totalSpriteArea += rect.w * rect.h;
    }

    const atlasArea = width * height;
    const efficiency = atlasArea > 0 ? totalSpriteArea / atlasArea : 0;

    return {
        width: width,
        height: height,
        efficiency: Math.min(efficiency, 0.99),
        wastedArea: atlasArea - totalSpriteArea,
        sheets: 1
    };
}

function canFitSprites(width, height, rects, padding, borderPadding, allowRotation) {
    // Simple row-based packing simulation
    const usableWidth = width - borderPadding * 2;
    const usableHeight = height - borderPadding * 2;
    
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    let lastRowY = 0;

    for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const w = rect.w + padding * 2;
        const h = rect.h + padding * 2;

        // Check if fits in current row
        if (currentX + w <= usableWidth) {
            currentX += w;
            if (h > rowHeight) rowHeight = h;
        } else {
            // Move to next row
            currentX = w;
            currentY += rowHeight;
            rowHeight = h;
            lastRowY = currentY;
        }

        // Check if exceeds height
        if (currentY + rowHeight > usableHeight) {
            return false;
        }
    }

    return true;
}

function simpleBinPack(width, height, rects, padding, borderPadding, allowRotation) {
    const usableWidth = width - borderPadding * 2;
    const usableHeight = height - borderPadding * 2;
    
    // Sort by height (tallest first)
    const sortedRects = [...rects].sort((a, b) => (b.h + padding * 2) - (a.h + padding * 2));
    
    let placed = [];
    let freeSpaces = [{ x: 0, y: 0, w: usableWidth, h: usableHeight }];

    for (let rect of sortedRects) {
        const w = rect.w + padding * 2;
        const h = rect.h + padding * 2;

        let bestSpace = null;
        let bestScore = Infinity;

        for (let space of freeSpaces) {
            if (space.w >= w && space.h >= h) {
                const score = space.w * space.h - w * h; // Prefer tight fit
                if (score < bestScore) {
                    bestScore = score;
                    bestSpace = space;
                }
            }

            // Check rotated
            if (allowRotation && space.w >= h && space.h >= w) {
                const score = space.w * space.h - h * w;
                if (score < bestScore) {
                    bestScore = score;
                    bestSpace = space;
                }
            }
        }

        if (bestSpace) {
            placed.push({
                x: bestSpace.x,
                y: bestSpace.y,
                w: rect.w,
                h: rect.h,
                rotated: false
            });

            // Split free space
            const idx = freeSpaces.indexOf(bestSpace);
            freeSpaces.splice(idx, 1);

            // Add remaining spaces
            if (bestSpace.w > w) {
                freeSpaces.push({
                    x: bestSpace.x + w,
                    y: bestSpace.y,
                    w: bestSpace.w - w,
                    h: bestSpace.h
                });
            }
            if (bestSpace.h > h) {
                freeSpaces.push({
                    x: bestSpace.x,
                    y: bestSpace.y + h,
                    w: w,
                    h: bestSpace.h - h
                });
            }
        }
    }

    return placed.length === rects.length;
}