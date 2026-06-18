# 🕵️ Deep Audit Report: FunkyPacker Core Modules

This report documents deep logical flaws, inconsistencies, and "pseudo-implementations" found in the core logic of FunkyPacker.

## 1. 🎯 Smart Size Solver: Broken MaxRects Logic
**Location:** `src/client/utils/AdvancedSmartSizeSolver.js`

### Issue: Incomplete Rectangle Splitting
The current implementation of `MaxRectsPacker.placeRect` (Line 108) is fundamentally flawed. In a true MaxRects algorithm, when a rectangle is placed, **every** overlapping free rectangle must be split into up to 4 new maximal free rectangles.
The current code only splits the **one** free rectangle that was selected for placement, which leads to:
*   Overlapping sprites in the atlas.
*   Inefficient use of space.
*   Invalid atlas generation if complex packing is required.

### Impact:
Calculated "Smart Sizes" may be incorrect or lead to overlapping textures, which will cause visual glitches in the final game.

---

## 2. 🔄 ASTC Encoder: Pseudo-Implementation & Precision Loss
**Location:** `src/client/utils/astc/ASTCEncoder.js`

### Issue A: Invalid "Direct Encoding"
The code claims to produce "100% valid ASTC blocks," but the "direct encoding" path (Line 80) does not implement the ASTC specification's Integer Sequence Encoding (ISE) or the complex bit-packing required for weight/endpoint data. It uses a simplified layout that will likely be rejected or misinterpreted by real GPUs.

### Issue B: Precision Loss in Uniform Blocks
In `void-extent` (uniform color) blocks (Line 58), the 16-bit color components are being set with the 8-bit color in the high byte and `0` in the low byte.
*   **Current:** `blockData[3] = 0;`
*   **Correct:** Should be `blockData[3] = minR;` (replicating bits to maintain 16-bit precision/intensity).

### Impact:
Textures exported as ASTC may look corrupted, have wrong colors, or fail to load on mobile devices.

---

## 3. 🎬 Animation Preview: Broken Rotation Math
**Location:** `src/client/ui/SpritesPlayer.jsx` vs `src/client/utils/TextureRenderer.js`

### Issue: Inconsistent Rotation Direction
FunkyPacker supports 90-degree rotation to save space.
*   **Renderer:** `TextureRenderer.js` (Line 168) uses `Math.PI / 2` (90° Clockwise).
*   **Preview:** `SpritesPlayer.jsx` (Line 240) uses `-Math.PI / 2` (90° Counter-Clockwise).

### Impact:
Rotated sprites in the atlas will appear "flipped" or upside-down in the Animation Preview, making it difficult for users to verify their animations before exporting.

---

## 4. 📦 KTX2 Export: Metadata Non-Compliance
The `texelBlockDimension` mapping and DFD (Data Format Descriptor) generation have minor inconsistencies with the Khronos KTX2 specification, particularly regarding how block dimensions are encoded into bitfields.

---

## 🛠️ Recommended Action Plan
1.  **Refactor `placeRect`** to implement the global free-list splitting required for MaxRects.
2.  **Harmonize rotation logic** across all preview and render components.
3.  **Fix color expansion** in the ASTC encoder and add clear developer warnings about the current placeholder state of non-uniform encoding.
4.  **Integrate WASM path** or a real encoding library like `@gpu-tex-enc/astc` (which is already in `package.json` but ignored).
