import MaxRectsBinPack from './packers/MaxRectsBin';
import OptimalPacker from './packers/OptimalPacker';
import allPackers from './packers';
import Trimmer from './utils/Trimmer';
import TextureRenderer from './utils/TextureRenderer';
import SmartSizeSolver from './utils/SmartSizeSolver';
import { Observer, GLOBAL_EVENT } from './Observer';

import I18 from './utils/I18';

const SOLVER_MODE = {
    SCALE: 'scale',
    AUTO: 'auto',
    MULTI_ATLAS: 'multi-atlas',
    MANUAL: 'manual'
};

class PackProcessor {
    static solver = null;
    static solverResult = null;
    static currentMode = SOLVER_MODE.SCALE;

    static detectIdentical(rects, didTrim) {
        let identical = [];

        const len = rects.length;

        for (let i = 0; i < len; i++) {
            let rect1 = rects[i];
            for (let n = i + 1; n < len; n++) {
                let rect2 = rects[n];
                if (identical.indexOf(rect2) === -1 && PackProcessor.compareImages(rect1, rect2, didTrim)) {
                    rect2.identical = rect1;
                    identical.push(rect2);
                }
            }
        }

        for (let rect of identical) {
            rects.splice(rects.indexOf(rect), 1);
        }

        return {
            rects: rects,
            identical: identical
        }
    }

    static compareImages(rect1, rect2, didTrim) {
        //return rect1.image._base64 == rect2.image._base64;
        if(!didTrim) {
            if(rect1.image._base64 === rect2.image._base64) {
                return true;
            }
            return rect1.image.src === rect2.image.src;
        }

        /*if(rect1.image.cachedDetection !== undefined) {
            if(rect1.image.cachedDetection[rect2.image]) {
                return true;
            }
        } else {
            rect1.image.cachedDetection = [];
        }
        if(rect2.image.cachedDetection !== undefined) {
            if(rect2.image.cachedDetection[rect1.image]) {
                return true;
            }
        } else {
            rect2.image.cachedDetection = [];
        }*/

        var i1 = rect1.trimmedImage;
        var i2 = rect2.trimmedImage;

        //return i1 === i2;

        if(i1.length !== i2.length) return false;

        var length = i1.length;

        while(length--) {
            if(i1[length] !== i2[length]) return false;
        }
        //rect1.image.cachedDetection.push(rect2.image);
        //rect2.image.cachedDetection.push(rect1.image);
        return true;
    }

    static applyIdentical(rects, identical) {
        let clones = [];
        let removeIdentical = [];

        for (let item of identical) {
            let ix = rects.indexOf(item.identical);
            if (ix >= 0) {
                let rect = rects[ix];

                let clone = Object.assign({}, rect);

                clone.name = item.name;
                clone.image = item.image;
                clone.originalFile = item.file;
                clone.frame = Object.assign({}, item.frame);
                clone.frame.x = rect.frame.x;
                clone.frame.y = rect.frame.y;
                clone.sourceSize = Object.assign({}, item.sourceSize);
                clone.spriteSourceSize = Object.assign({}, item.spriteSourceSize);
                clone.skipRender = true;

                removeIdentical.push(item);
                clones.push(clone);
            }
        }

        for (let item of removeIdentical) {
            identical.splice(identical.indexOf(item), 1);
        }

        for (let item of clones) {
            item.cloned = true;
            rects.push(item);
        }

        return rects;
    }

    static pack(images = {}, options = {}, onComplete = null, onError = null) {
        let rects = [];

        let spritePadding = options.spritePadding || 0;
        let borderPadding = options.borderPadding || 0;

        let maxWidth = 0, maxHeight = 0;
        let minWidth = 0, minHeight = 0;

        let alphaThreshold = options.alphaThreshold || 0;
        if (alphaThreshold > 255) alphaThreshold = 255;

        let names = Object.keys(images).sort();

        for (let key of names) {
            let img = images[key];

            let name = key.split(".")[0];

            maxWidth += img.width;
            maxHeight += img.height;

            if (img.width > minWidth) minWidth = img.width + spritePadding * 2;
            if (img.height > minHeight) minHeight = img.height + spritePadding * 2;

            rects.push({
                frame: { x: 0, y: 0, w: img.width, h: img.height },
                rotated: false,
                trimmed: false,
                spriteSourceSize: { x: 0, y: 0, w: img.width, h: img.height },
                sourceSize: { w: img.width, h: img.height },
                name: name,
                file: key,
                image: img
            });
        }

        minWidth += borderPadding * 2;
        minHeight += borderPadding * 2;

        // Store mode for use in async operations
        this.currentMode = options.solverMode || SOLVER_MODE.SCALE;
        
        // Handle manual mode (original behavior)
        if (this.currentMode === SOLVER_MODE.MANUAL) {
            return this.packManual(rects, options, onComplete, onError, minWidth, minHeight, maxWidth, maxHeight);
        }

        // Handle smart size solving
        this.packWithSolver(rects, options, onComplete, onError, minWidth, minHeight, maxWidth, maxHeight);
    }

    static packManual(rects, options, onComplete, onError, minWidth, minHeight, maxWidth, maxHeight) {
        let width = options.width || 0;
        let height = options.height || 0;

        if (!width) width = maxWidth;
        if (!height) height = maxHeight;

        if (options.powerOfTwo) {
            let sw = Math.round(Math.log(width) / Math.log(2));
            let sh = Math.round(Math.log(height) / Math.log(2));

            let pw = Math.pow(2, sw);
            let ph = Math.pow(2, sh);

            if (pw < width) pw = Math.pow(2, sw + 1);
            if (ph < height) ph = Math.pow(2, sh + 1);

            width = pw;
            height = ph;
        }

        if (width < minWidth || height < minHeight) {
            if (onError) onError({
                description: I18.f("INVALID_SIZE_ERROR", minWidth, minHeight)
            });
            return;
        }

        this.executePacking(rects, options, onComplete, width, height);
    }

    static packWithSolver(rects, options, onComplete, onError, minWidth, minHeight, maxWidth, maxHeight) {
        const solverOptions = {
            spritePadding: options.spritePadding || 0,
            borderPadding: options.borderPadding || 0,
            allowRotation: options.allowRotation || false,
            disableMaxLimit: options.disableMaxLimit || false
        };

        // Determine which mode to use
        let effectiveMode = this.currentMode;
        
        // Auto mode: decide between SCALE and MULTI_ATLAS based on efficiency
        if (this.currentMode === SOLVER_MODE.AUTO) {
            // First calculate SCALE mode result
            this.solver = new SmartSizeSolver();
            this.solver.calculate(rects, solverOptions, null, (scaleResult) => {
                if (scaleResult && scaleResult.efficiency >= 0.7) {
                    effectiveMode = SOLVER_MODE.SCALE;
                    this.executePackingWithSolver(rects, options, onComplete, scaleResult, SOLVER_MODE.SCALE);
                } else {
                    effectiveMode = SOLVER_MODE.MULTI_ATLAS;
                    // Emit info about auto selection
                    const efficiency = scaleResult ? (scaleResult.efficiency * 100).toFixed(1) : 'N/A';
                    console.log(`Auto mode: switching to Multi-Atlas (single atlas efficiency: ${efficiency}%)`);
                    this.executeMultiAtlas(rects, options, onComplete);
                }
            });
            return;
        }

        // SCALE or MULTI_ATLAS modes
        if (this.currentMode === SOLVER_MODE.SCALE) {
            this.solver = new SmartSizeSolver();
            this.solver.calculate(rects, solverOptions, null, (result) => {
                this.executePackingWithSolver(rects, options, onComplete, result, SOLVER_MODE.SCALE);
            });
        } else if (this.currentMode === SOLVER_MODE.MULTI_ATLAS) {
            this.executeMultiAtlas(rects, options, onComplete);
        }
    }

    static executePackingWithSolver(rects, options, onComplete, solverResult, mode) {
        let { width, height, efficiency } = solverResult;
        const maxSizeLimit = options.disableMaxLimit ? 8192 : 4096;

        // SCALE mode: check if needs scaling
        let scale = 1;
        if (mode === SOLVER_MODE.SCALE && (width > maxSizeLimit || height > maxSizeLimit)) {
            const scaleResult = SmartSizeSolver.checkScaleRequired(width, height, maxSizeLimit);
            scale = scaleResult.scale;
            width = scaleResult.scaledWidth;
            height = scaleResult.scaledHeight;
        }

        // Apply scale to rects for packing
        let scaledRects = rects;
        if (scale !== 1) {
            scaledRects = rects.map(rect => ({
                ...rect,
                frame: {
                    x: Math.round(rect.frame.x * scale),
                    y: Math.round(rect.frame.y * scale),
                    w: Math.round(rect.frame.w * scale),
                    h: Math.round(rect.frame.h * scale)
                },
                sourceSize: {
                    w: Math.round(rect.sourceSize.w * scale),
                    h: Math.round(rect.sourceSize.h * scale)
                },
                spriteSourceSize: {
                    x: Math.round(rect.spriteSourceSize.x * scale),
                    y: Math.round(rect.spriteSourceSize.y * scale),
                    w: Math.round(rect.spriteSourceSize.w * scale),
                    h: Math.round(rect.spriteSourceSize.h * scale)
                }
            }));
        }

        // Emit efficiency update
        Observer.emit(GLOBAL_EVENT.EFFICIENCY_UPDATE, {
            efficiency: efficiency * 100,
            width: width,
            height: height,
            mode: mode,
            scale: scale
        });

        this.executePacking(scaledRects, { ...options, scale: 1 }, onComplete, width, height);
    }

    static executeMultiAtlas(rects, options, onComplete) {
        const solverOptions = {
            spritePadding: options.spritePadding || 0,
            borderPadding: options.borderPadding || 0,
            allowRotation: options.allowRotation || false,
            disableMaxLimit: options.disableMaxLimit || false
        };

        SmartSizeSolver.calculateMultiAtlas(rects, solverOptions, null, (sheets) => {
            // Pack each sheet
            let allResults = [];
            let totalEfficiency = 0;

            for (let i = 0; i < sheets.length; i++) {
                const sheet = sheets[i];
                const sheetRects = sheet.rects;
                
                // Execute packing for this sheet
                const result = this.packSingleSheet(sheetRects, options, sheet.width, sheet.height);
                allResults.push(result);
                
                const sheetArea = sheet.width * sheet.height;
                let spriteArea = 0;
                for (let rect of sheetRects) {
                    spriteArea += rect.sourceSize.w * rect.sourceSize.h;
                }
                totalEfficiency += spriteArea / sheetArea;
            }

            const avgEfficiency = allResults.length > 0 ? (totalEfficiency / allResults.length) * 100 : 0;

            // Emit efficiency update
            Observer.emit(GLOBAL_EVENT.EFFICIENCY_UPDATE, {
                efficiency: avgEfficiency,
                sheets: allResults.length,
                mode: SOLVER_MODE.MULTI_ATLAS
            });

            if (onComplete) {
                onComplete(allResults);
            }
        });
    }

    static packSingleSheet(rects, options, width, height) {
        let spritePadding = options.spritePadding || 0;
        let borderPadding = options.borderPadding || 0;
        let alphaThreshold = options.alphaThreshold || 0;

        if (alphaThreshold > 255) alphaThreshold = 255;

        if (options.allowTrim) {
            Trimmer.trim(rects, alphaThreshold);
        }

        let identical = [];
        if (options.detectIdentical) {
            let res = PackProcessor.detectIdentical(rects, options.allowTrim);
            rects = res.rects;
            identical = res.identical;
        }

        let packerClass = options.packer || MaxRectsBinPack;
        let packerMethod = options.packerMethod || MaxRectsBinPack.methods.BestShortSideFit;

        let packer = new packerClass(width, height, options.allowRotation || false, spritePadding);
        let result = packer.pack(rects, packerMethod);

        if (options.detectIdentical) {
            result = PackProcessor.applyIdentical(result, identical);
        }

        for (let item of result) {
            item.frame.x += borderPadding;
            item.frame.y += borderPadding;
        }

        return result;
    }

    static executePacking(rects, options, onComplete, width, height) {
        let spritePadding = options.spritePadding || 0;
        let borderPadding = options.borderPadding || 0;
        let alphaThreshold = options.alphaThreshold || 0;

        if (alphaThreshold > 255) alphaThreshold = 255;

        if (options.allowTrim) {
            Trimmer.trim(rects, alphaThreshold);
        }

        let identical = [];

        if (options.detectIdentical) {
            let res = PackProcessor.detectIdentical(rects, options.allowTrim);

            rects = res.rects;
            identical = res.identical;
        }

        let getAllPackers = () => {
            let methods = [];
            for (let packerClass of allPackers) {
                if (packerClass !== OptimalPacker) {
                    for (let method in packerClass.methods) {
                        methods.push({ packerClass, packerMethod: packerClass.methods[method], allowRotation: false });
                        if (options.allowRotation) {
                            methods.push({ packerClass, packerMethod: packerClass.methods[method], allowRotation: true });
                        }
                    }
                }
            }
            return methods;
        };

        let packerClass = options.packer || MaxRectsBinPack;
        let packerMethod = options.packerMethod || MaxRectsBinPack.methods.BestShortSideFit;
        let packerCombos = (packerClass === OptimalPacker) ? getAllPackers() : [{ packerClass, packerMethod, allowRotation: options.allowRotation }];

        let optimalRes;
        let optimalSheets = Infinity;
        let optimalEfficiency = 0;

        let sourceArea = 0;
        for (let rect of rects) {
            sourceArea += rect.sourceSize.w * rect.sourceSize.h;
        }

        for (let combo of packerCombos) {
            let res = [];
            let sheetArea = 0;

            let _rects = packerCombos.length > 1 ? rects.map(rect => {
                return Object.assign({}, rect, {
                    frame: Object.assign({}, rect.frame),
                    spriteSourceSize: Object.assign({}, rect.spriteSourceSize),
                    sourceSize: Object.assign({}, rect.sourceSize)
                });
            }) : rects;

            let _identical = packerCombos.length > 1 ? identical.map(rect => {
                for (let rect2 of _rects) {
                    if (rect.identical.image._base64 === rect2.image._base64) {
                        return Object.assign({}, rect, { identical: rect2 });
                    }
                }
            }) : identical;

            while (_rects.length) {
                let packer = new combo.packerClass(width, height, combo.allowRotation, spritePadding);
                let result = packer.pack(_rects, combo.packerMethod);

                if (options.detectIdentical) {
                    result = PackProcessor.applyIdentical(result, _identical);
                }

                res.push(result);

                for (let item of result) {
                    this.removeRect(_rects, item.name);
                }

                let { width: sheetWidth, height: sheetHeight } = TextureRenderer.getSize(result, options);
                sheetArea += sheetWidth * sheetHeight;
            }

            let sheets = res.length;
            let efficiency = sourceArea / sheetArea;

            if (sheets < optimalSheets || (sheets === optimalSheets && efficiency > optimalEfficiency)) {
                optimalRes = res;
                optimalSheets = sheets;
                optimalEfficiency = efficiency;
            }
        }

        for (let sheet of optimalRes) {
            for (let item of sheet) {
                item.frame.x += borderPadding;
                item.frame.y += borderPadding;
            }
        }

        if (onComplete) {
            onComplete(optimalRes);
        }
    }

    static removeRect(rects, name) {
        for (let i = 0; i < rects.length; i++) {
            if (rects[i].name === name) {
                rects.splice(i, 1);
                return;
            }
        }
    }
}

export default PackProcessor;