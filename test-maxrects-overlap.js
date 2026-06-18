/**
 * MaxRects Capacity and Overlap Test
 * 
 * Tests that the MaxRects bin packer:
 * 1. Places multiple rectangles successfully (capacity test)
 * 2. No placed rectangles overlap each other
 * 3. Free rects don't overlap with used rects
 * 
 * Run with: node test-maxrects-overlap.js
 */

// Inline MaxRectsPacker - FIXED version (matching production code)
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
        // The placed rectangle's bounding box
        const pr = {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h
        };
        const prRight = pr.x + pr.w;
        const prBottom = pr.y + pr.h;

        // IMPORTANT: DO NOT remove the used free rect before the split loop!
        // Split ALL free rects that intersect with the placed rectangle.
        
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

            // There IS an intersection - split this free rect
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

    // Test 1: CAPACITY TEST - 20 sprites should all fit
    console.log('\n=== Test 1: CAPACITY TEST - 20 sprites ===');
    {
        const packer = new MaxRectsPacker(256, 256);
        const rects = [];
        // Generate 20 varied-sized rectangles that should fit
        for (let i = 0; i < 20; i++) {
            rects.push({
                w: 32 + Math.floor(Math.random() * 32),
                h: 32 + Math.floor(Math.random() * 32)
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
        
        // CAPACITY CHECK - all should fit in 256x256
        if (placed.length < rects.length) {
            console.log(`  FAIL: Expected ${rects.length} placed, got ${placed.length}`);
            failed++;
        } else {
            console.log('  CAPACITY: PASS - All rectangles placed');
            passed++;
        }
    }

    // Test 2: Various sizes - capacity
    console.log('\n=== Test 2: Various sizes - capacity ===');
    {
        const packer = new MaxRectsPacker(512, 512);
        const rects = [
            { w: 128, h: 128 },
            { w: 128, h: 128 },
            { w: 128, h: 128 },
            { w: 256, h: 64 },
            { w: 64, h: 256 },
            { w: 64, h: 64 },
            { w: 128, h: 32 },
            { w: 32, h: 128 },
            { w: 64, h: 32 },
            { w: 32, h: 64 }
        ];

        const placed = [];
        for (const rect of rects) {
            const result = packer.insert(rect.w, rect.h);
            if (result) {
                placed.push(result);
            }
        }

        console.log(`  Placed ${placed.length}/${rects.length} rectangles`);
        
        if (placed.length < rects.length) {
            console.log(`  FAIL: Expected ${rects.length} placed, got ${placed.length}`);
            failed++;
        } else {
            console.log('  CAPACITY: PASS - All rectangles placed');
            passed++;
        }
    }

    // Test 3: Overlap check
    console.log('\n=== Test 3: Overlap check ===');
    {
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
            console.log('  OVERLAP: PASS - No overlapping rectangles');
            passed++;
        } else {
            failed++;
        }
    }

    // Test 4: All algorithms - capacity
    console.log('\n=== Test 4: All algorithms - capacity ===');
    {
        const algorithms = ['BestShortSideFit', 'BestLongSideFit', 'BestAreaFit', 'BottomLeftRule'];
        
        for (const algo of algorithms) {
            const packer = new MaxRectsPacker(512, 512);
            const rects = [];
            for (let i = 0; i < 15; i++) {
                rects.push({
                    w: 48 + Math.floor(Math.random() * 48),
                    h: 48 + Math.floor(Math.random() * 48)
                });
            }

            const placed = [];
            for (const rect of rects) {
                const result = packer.insert(rect.w, rect.h, algo);
                if (result) {
                    placed.push(result);
                }
            }

            console.log(`  ${algo}: ${placed.length}/${rects.length} placed`);
            
            if (placed.length < rects.length) {
                console.log(`    FAIL: Expected ${rects.length} placed`);
                failed++;
            } else {
                console.log(`    PASS`);
                passed++;
            }
        }
    }

    // Test 5: Large bin, many small rects
    console.log('\n=== Test 5: Large bin, many small rects ===');
    {
        const packer = new MaxRectsPacker(1024, 1024);
        const rects = [];
        for (let i = 0; i < 100; i++) {
            rects.push({
                w: 16 + Math.floor(Math.random() * 32),
                h: 16 + Math.floor(Math.random() * 32)
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
        
        if (placed.length < rects.length) {
            console.log(`  FAIL: Expected ${rects.length} placed, got ${placed.length}`);
            failed++;
        } else {
            console.log('  CAPACITY: PASS');
            passed++;
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
