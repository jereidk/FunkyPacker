/**
 * MaxRects Overlap Test
 * 
 * This test verifies that the MaxRects bin packer correctly places
 * rectangles without any overlapping regions.
 * 
 * Run with: node test-maxrects-overlap.js
 */

// Import the relevant classes (adjust path as needed)
const path = require('path');

// Inline MaxRectsPacker for testing (simplified copy)
class MaxRectsPacker {
    constructor(width, height, padding = 0) {
        this.binWidth = width;
        this.binHeight = height;
        this.padding = padding;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
        this.usedRects = [];
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
            default:
                return { score1: shortSide, score2: longSide };
        }
    }

    isBetter(newScore, bestScore) {
        if (newScore.score1 < bestScore.score1) return true;
        if (newScore.score1 === bestScore.score1 && newScore.score2 < bestScore.score2) return true;
        return false;
    }

    placeRect(rect) {
        // Remove the free rect that was used for placement
        this.freeRects.splice(rect.index, 1);

        // The placed rectangle's bounding box
        const pr = {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h
        };
        const prRight = pr.x + pr.w;
        const prBottom = pr.y + pr.h;

        const newFreeRects = [];

        for (const free of this.freeRects) {
            const frRight = free.x + free.w;
            const frBottom = free.y + free.h;

            // Check if this free rect intersects with the placed rect
            if (pr.x >= frRight || prRight <= free.x ||
                pr.y >= frBottom || prBottom <= free.y) {
                newFreeRects.push(free);
                continue;
            }

            // Split LEFT
            if (free.x < pr.x) {
                newFreeRects.push({
                    x: free.x,
                    y: free.y,
                    w: pr.x - free.x,
                    h: free.h
                });
            }

            // Split RIGHT
            if (frRight > prRight) {
                newFreeRects.push({
                    x: prRight,
                    y: free.y,
                    w: frRight - prRight,
                    h: free.h
                });
            }

            // Split TOP
            if (free.y < pr.y) {
                newFreeRects.push({
                    x: free.x,
                    y: free.y,
                    w: free.w,
                    h: pr.y - free.y
                });
            }

            // Split BOTTOM
            if (frBottom > prBottom) {
                newFreeRects.push({
                    x: free.x,
                    y: prBottom,
                    w: free.w,
                    h: frBottom - prBottom
                });
            }
        }

        this.freeRects = newFreeRects;
        this.pruneFreeRects();
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

    rectsOverlap(a, b) {
        return !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
                 a.y + a.h <= b.y || b.y + b.h <= a.y);
    }
}

// Test cases
function runTests() {
    let passed = 0;
    let failed = 0;

    // Test 1: Basic rectangles
    console.log('\n=== Test 1: Basic 10x10 rectangles ===');
    {
        const packer = new MaxRectsPacker(100, 100);
        const rects = [
            { w: 30, h: 30 },
            { w: 30, h: 30 },
            { w: 30, h: 30 },
            { w: 30, h: 30 }
        ];

        const placed = [];
        for (const rect of rects) {
            const result = packer.insert(rect.w, rect.h);
            if (result) {
                placed.push(result);
            }
        }

        let hasOverlap = false;
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                if (packer.rectsOverlap(placed[i], placed[j])) {
                    console.log(`  FAIL: Rect ${i} and ${j} overlap!`);
                    hasOverlap = true;
                }
            }
        }

        // Also check free rects don't overlap with used rects
        for (const free of packer.freeRects) {
            for (const used of packer.usedRects) {
                if (packer.rectsOverlap(free, used)) {
                    console.log(`  FAIL: Free rect overlaps with used rect!`);
                    hasOverlap = true;
                }
            }
        }

        if (!hasOverlap) {
            console.log('  PASS: No overlapping rectangles');
            passed++;
        } else {
            failed++;
        }
    }

    // Test 2: Various sizes
    console.log('\n=== Test 2: Various sizes ===');
    {
        const packer = new MaxRectsPacker(256, 256);
        const rects = [
            { w: 64, h: 32 },
            { w: 32, h: 64 },
            { w: 128, h: 64 },
            { w: 32, h: 32 },
            { w: 64, h: 64 },
            { w: 96, h: 32 },
            { w: 32, h: 96 }
        ];

        const placed = [];
        for (const rect of rects) {
            const result = packer.insert(rect.w, rect.h);
            if (result) {
                placed.push(result);
            }
        }

        let hasOverlap = false;
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                if (packer.rectsOverlap(placed[i], placed[j])) {
                    console.log(`  FAIL: Rect ${i} and ${j} overlap!`);
                    hasOverlap = true;
                }
            }
        }

        if (!hasOverlap) {
            console.log('  PASS: No overlapping rectangles');
            passed++;
        } else {
            failed++;
        }
    }

    // Test 3: Random rectangles
    console.log('\n=== Test 3: Random rectangles ===');
    {
        const packer = new MaxRectsPacker(512, 512);
        const rects = [];
        for (let i = 0; i < 50; i++) {
            rects.push({
                w: Math.floor(Math.random() * 64) + 16,
                h: Math.floor(Math.random() * 64) + 16
            });
        }

        const placed = [];
        for (const rect of rects) {
            const result = packer.insert(rect.w, rect.h);
            if (result) {
                placed.push(result);
            }
        }

        console.log(`  Placed ${placed.length}/${rects.length} rectangles`);

        let hasOverlap = false;
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                if (packer.rectsOverlap(placed[i], placed[j])) {
                    console.log(`  FAIL: Rect ${i} and ${j} overlap!`);
                    hasOverlap = true;
                }
            }
        }

        if (!hasOverlap) {
            console.log('  PASS: No overlapping rectangles');
            passed++;
        } else {
            failed++;
        }
    }

    // Test 4: All algorithms
    console.log('\n=== Test 4: All MaxRects algorithms ===');
    {
        const algorithms = ['BestShortSideFit', 'BestLongSideFit', 'BestAreaFit', 'BottomLeftRule'];
        
        for (const algo of algorithms) {
            const packer = new MaxRectsPacker(256, 256);
            const rects = [
                { w: 64, h: 64 },
                { w: 128, h: 32 },
                { w: 32, h: 128 },
                { w: 64, h: 32 },
                { w: 32, h: 64 },
                { w: 96, h: 48 }
            ];

            const placed = [];
            for (const rect of rects) {
                const result = packer.insert(rect.w, rect.h, algo);
                if (result) {
                    placed.push(result);
                }
            }

            let hasOverlap = false;
            for (let i = 0; i < placed.length; i++) {
                for (let j = i + 1; j < placed.length; j++) {
                    if (packer.rectsOverlap(placed[i], placed[j])) {
                        console.log(`  ${algo}: FAIL - Rect ${i} and ${j} overlap!`);
                        hasOverlap = true;
                    }
                }
            }

            if (!hasOverlap) {
                console.log(`  ${algo}: PASS`);
                passed++;
            } else {
                failed++;
            }
        }
    }

    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    return failed === 0;
}

// Run tests
const success = runTests();
process.exit(success ? 0 : 1);
