import list from './list.json';
import appInfo from '../../../package.json';
import {GET} from '../utils/ajax';
import mustache from 'mustache';
import wax from '@jvitela/mustache-wax';
import { smartSortImages, removeFromArray } from '../utils/common';

wax(mustache);

mustache.Formatters = {
    add: (v1, v2) => {
        return v1 + v2;
    },
    subtract: (v1, v2) => {
        return v1 - v2;
    },
    multiply: (v1, v2) => {
        return v1 * v2;
    },
    divide: (v1, v2) => {
        return v1 / v2;
    },
    offsetLeft: (start, size1, size2) => {
        let x1 = start + size1 / 2;
        let x2 = size2 / 2;
        return x1 - x2;
    },
    offsetRight: (start, size1, size2) => {
        let x1 = start + size1 / 2;
        let x2 = size2 / 2;
        return x2 - x1;
    },
    mirror: (start, size1, size2) => {
        return size2 - start - size1;
    },
    escapeName: (name) => {
        return name.replace(/%/g, "%25")
            .replace(/#/g, "%23")
            .replace(/:/g, "%3A")
            .replace(/;/g, "%3B")
            .replace(/\\/g, "-")
            .replace(/\//g, "-");
    }
};

function getExporterByType(type) {
    for(let item of list) {
        if(item.type === type) {
            return item;
        }
    }
    return null;
}

function prepareData(data, options) {

    let opt = Object.assign({}, options);

    opt.imageName = opt.imageName || "texture";
    opt.imageFile = opt.imageFile || (opt.imageName + "." + options.textureFormat);
    opt.format = opt.format || "RGBA8888";
    opt.scale = opt.scale || 1;
    opt.base64Prefix = options.textureFormat === "png" ? "data:image/png;base64," : "data:image/jpeg;base64,";

    let ret = [];

    for(let item of data) {

        let name = item.originalFile || item.file;
        var origName = name;

        if(options.trimSpriteNames) {
            name.trim();
        }

        if(options.removeFileExtension) {
            let parts = name.split(".");
            if(parts.length > 1) parts.pop();
            name = parts.join(".");
        }

        if(!options.prependFolderName) {
            name = name.split("/").pop();
        }

        let frame = {x: item.frame.x, y: item.frame.y, w: item.frame.w, h: item.frame.h, hw: item.frame.w/2, hh: item.frame.h/2};
        let spriteSourceSize = {x: item.spriteSourceSize.x, y: item.spriteSourceSize.y, w: item.spriteSourceSize.w, h: item.spriteSourceSize.h};
        let sourceSize = {w: item.sourceSize.w, h: item.sourceSize.h};

        let trimmed = item.trimmed;

        if(item.trimmed && options.trimMode === 'crop') {
            trimmed = false;
            spriteSourceSize.x = 0;
            spriteSourceSize.y = 0;
            sourceSize.w = spriteSourceSize.w;
            sourceSize.h = spriteSourceSize.h;
        }

        if(opt.scale !== 1) { // Maybe round if sparrow?
            frame.x *= opt.scale;
            frame.y *= opt.scale;
            frame.w *= opt.scale;
            frame.h *= opt.scale;
            frame.hw *= opt.scale;
            frame.hh *= opt.scale;

            spriteSourceSize.x *= opt.scale;
            spriteSourceSize.y *= opt.scale;
            spriteSourceSize.w *= opt.scale;
            spriteSourceSize.h *= opt.scale;

            sourceSize.w *= opt.scale;
            sourceSize.h *= opt.scale;
        }

        ret.push({
            name: name,
            origName: origName,
            frame: frame,
            spriteSourceSize: spriteSourceSize,
            sourceSize: sourceSize,
            rotated: item.rotated,
            trimmed: trimmed
        });

    }

    return {rects: ret, config: opt};
}

function startExporter(exporter, data, options) {
    return new Promise((resolve, reject) => {
        let {rects, config} = prepareData(data, options);
        let renderOptions = {
            rects: rects,
            config: config,
            appInfo: appInfo
        };

        // Sort the exported rows
        if(options.sortExportedRows) {
            rects = rects.sort((a, b) => {
                return smartSortImages(a.name, b.name);
            });
        }

        let sparrowOrder = window.__sparrow_order;

        // Make order the same as before
        if(sparrowOrder != null) {
            sparrowOrder = [...sparrowOrder];
            /* if(options.removeFileExtension) {
                for(let i = 0; i < sparrowOrder.length; i++) {
                    let name = sparrowOrder[i];
                    let parts = name.split(".");
                    if(parts.length > 1) parts.pop();
                    sparrowOrder[i] = parts.join(".");
                }
            } */

            let oldRects = [...rects];
            let nameMap = {};
            for (const v of rects) {
                nameMap[v.origName] = v;
            }

            let array = sparrowOrder.filter((v) => {
                return nameMap[v] !== undefined; // filter for frames which exist
            }).map(name => {
                const item = nameMap[name];
                removeFromArray(oldRects, item);
                return item;
            });

            array = array.concat(oldRects);

            rects = array;
        }

        // Fix sourceSize
        if(window.sparrowOrigMap != null) {
            for(var i = 0; i < rects.length; i++) {
                if(!window.sparrowOrigMap.hasOwnProperty(rects[i].name)) {
                    continue;
                }
                var orig = window.sparrowOrigMap[rects[i].name];
                if(orig != null) {
                    // sorry for this horrendus code
                    rects[i] = JSON.parse(JSON.stringify(rects[i]));

                    //console.log(orig);

                    rects[i].sourceSize.w = orig.frameWidth;
                    rects[i].sourceSize.h = orig.frameHeight;
                }
            }
        }

        //console.log(rects.map((v)=>v.name));

        if(rects.length) {
            rects[0].first = true;
            rects[rects.length-1].last = true;
        }

        data = rects;
        renderOptions.rects = rects;

        if(exporter.content) {
            finishExporter(exporter, renderOptions, resolve, reject);
            return;
        }

        GET("static/exporters/" + exporter.template, null, (template) => {
            exporter.content = template;
            finishExporter(exporter, renderOptions, resolve, reject);
        }, () => reject(exporter.template + " not found"));
    });
}

function finishExporter(exporter, renderOptions, resolve, reject) {
    try {
        let ret = mustache.render(exporter.content, renderOptions);
        resolve(ret);
    }
    catch(e) {
        reject(e.message);
    }
}

/**
 * BetterTA Exporter - Generates both Atlas.json and Animation.json
 */
async function startBetterTAExporter(exporter, data, options) {
    let {rects, config} = prepareData(data, options);
    let renderOptions = {
        rects: rects,
        config: config,
        appInfo: appInfo
    };

    // Sort the exported rows
    if(options.sortExportedRows) {
        rects = rects.sort((a, b) => {
            return smartSortImages(a.name, b.name);
        });
    }

    // Mark first and last for template
    if(rects.length) {
        rects[0].first = true;
        rects[rects.length-1].last = true;
    }

    // Load atlas template
    let atlasTemplate;
    if (exporter.content) {
        atlasTemplate = exporter.content;
    } else {
        atlasTemplate = await new Promise((resolve, reject) => {
            GET("static/exporters/" + exporter.template, null, resolve, () => reject(exporter.template + " not found"));
        });
        exporter.content = atlasTemplate;
    }

    // Generate Atlas.json
    let atlasContent = mustache.render(atlasTemplate, renderOptions);

    // Generate Animation.json with frame metadata following BetterTA format
    let animationContent = generateBetterTAAnimation(rects, config);

    return {
        atlas: {
            name: config.imageName + ".json",
            content: atlasContent
        },
        animation: {
            name: config.imageName + "Animation.json",
            content: animationContent
        }
    };
}

/**
 * Parse animation name from frame name
 * e.g., "walk_0001" -> "walk", "idle_001" -> "idle"
 */
function parseAnimationName(frameName) {
    // Try multiple patterns to extract animation name
    let name = frameName;
    
    // Pattern 1: Remove numeric suffix with separator (walk_0001, walk-001)
    name = name.replace(/[_\-]\d+$/g, '');
    
    // Pattern 2: Remove trailing numbers only (walk0001 -> walk)
    name = name.replace(/\d+$/g, '');
    
    // Pattern 3: Remove trailing separators
    name = name.replace(/[_\-]+$/g, '');
    
    return name || frameName;
}

/**
 * Generate Animation.json for BetterTA format
 * This matches the format used by Adobe Animate Better TA Extension
 * 
 * Structure:
 * {
 *   "ATLAS": {
 *     "ANIMATIONS": {
 *       "animationName": {
 *         "start": 0,
 *         "end": 10,
 *         "speed": 12,
 *         "loop": true,
 *         "name": "animationName",
 *         "frames": ["frame0", "frame1", ...]
 *       }
 *     },
 *     "SPRITES": [...] // Frame references by index
 *   },
 *   "meta": {...}
 * }
 */
function generateBetterTAAnimation(rects, config) {
    // Group frames by animation name while maintaining order
    let animations = {};
    let frameNames = [];

    for (let i = 0; i < rects.length; i++) {
        let rect = rects[i];
        let animName = parseAnimationName(rect.name);
        
        // Skip empty names
        if (!animName) animName = 'default';

        frameNames.push(rect.name);

        // Initialize animation group if needed
        if (!animations[animName]) {
            animations[animName] = {
                start: i,
                end: i,
                frames: []
            };
        }
        
        // Update end index and add frame reference
        animations[animName].end = i;
        animations[animName].frames.push(i); // Store index, not name
    }

    // Build sprite references using atlas sprite names
    let sprites = frameNames.map((name, index) => ({
        name: name,
        index: index
    }));

    // Convert animation indices to names
    let animationsOutput = {};
    for (let [animName, animData] of Object.entries(animations)) {
        animationsOutput[animName] = {
            start: animData.start,
            end: animData.end,
            speed: 12,  // Default FPS
            name: animName,
            loop: true,
            pingpong: false,
            frames: animData.frames.map(idx => frameNames[idx])
        };
    }

    // Build complete animation JSON structure matching BetterTA format
    let animation = {
        "ATLAS": {
            "ANIMATIONS": animationsOutput,
            "SPRITES": sprites
        },
        "meta": {
            "app": "FunkyPacker",
            "version": appInfo.version,
            "image": config.imageFile,
            "format": config.format,
            "size": {
                "w": config.imageWidth,
                "h": config.imageHeight
            },
            "resolution": config.scale || "1",
            "framerate": 12
        }
    };

    return JSON.stringify(animation, null, 2);
}

export {getExporterByType, startExporter, startBetterTAExporter};
export default list;