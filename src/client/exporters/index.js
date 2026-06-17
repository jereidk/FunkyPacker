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

    // Generate Animation.json following exact BetterTA/BTA format
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
 * Generate Animation.json following the exact BetterTA (BTA) format
 * used by Adobe Animate with the Better Texture Atlas extension.
 * 
 * Format structure:
 * {
 *   "AN": { ... } - Animation Node (root timeline)
 *   "SD": { ... } - Symbol Dictionary
 *   "MD": { ... } - Metadata
 * }
 */
function generateBetterTAAnimation(rects, config) {
    const FRAMERATE = 24; // Default 24 FPS for Adobe Animate
    
    // Group frames by animation prefix (e.g., "walk_001" -> "walk")
    let animationGroups = groupFramesByAnimation(rects);
    
    // Build the root animation node (AN)
    let rootAnimationNode = buildRootAnimationNode(animationGroups, rects, FRAMERATE);
    
    // Build symbol dictionary (SD) - creates symbol definitions for each frame
    let symbolDictionary = buildSymbolDictionary(rects);
    
    // Build metadata (MD)
    let metadata = {
        "V": "BTA 1.2.0",       // BTA version
        "N": config.imageName,  // Animation name
        "BGC": "#999999",        // Background color
        "W": config.imageWidth,  // Canvas width
        "H": config.imageHeight, // Canvas height
        "ASV": 3,               // Atlas Structure Version
        "FRT": FRAMERATE        // Frame rate
    };
    
    // Build complete animation JSON
    let animation = {
        "AN": rootAnimationNode,
        "SD": symbolDictionary,
        "MD": metadata
    };
    
    return JSON.stringify(animation);
}

/**
 * Group frames by animation prefix
 * e.g., "walk_001", "walk_002" -> { "walk": ["walk_001", "walk_002"] }
 */
function groupFramesByAnimation(rects) {
    let groups = {};
    
    for (let i = 0; i < rects.length; i++) {
        let name = rects[i].name;
        let prefix = extractAnimationPrefix(name);
        
        if (!groups[prefix]) {
            groups[prefix] = [];
        }
        groups[prefix].push({
            index: i,
            name: name,
            rect: rects[i]
        });
    }
    
    return groups;
}

/**
 * Extract animation prefix from frame name
 * Handles patterns like: walk_001, walk-001, idle0001, etc.
 */
function extractAnimationPrefix(frameName) {
    // Remove file extension if present
    let name = frameName.replace(/\.[^.]+$/, '');
    
    // Try multiple patterns to extract prefix
    // Pattern: prefix_number (e.g., walk_001, walk-001)
    let match = name.match(/^(.+?)[_\-]?\d+$/);
    if (match && match[1]) {
        return match[1].replace(/[_\-]+$/, '');
    }
    
    // Pattern: prefixNNN (e.g., walk001)
    match = name.match(/^(.+?)(\d+)$/);
    if (match && match[1].length > 1) {
        return match[1];
    }
    
    return name;
}

/**
 * Build the root Animation Node (AN) structure
 */
function buildRootAnimationNode(animationGroups, rects, framerate) {
    let layers = [];
    let symbolIndex = 0;
    let frameIndex = 0;
    
    // Create main layer for the animation sequence
    let mainLayer = {
        "LN": "Layer_1",
        "FR": []
    };
    
    for (let [animName, frames] of Object.entries(animationGroups)) {
        // Create a frame for each animation
        let frameData = {
            "N": animName,
            "I": frameIndex,
            "DU": Math.round(1000 / framerate), // Duration in ms
            "E": []
        };
        
        // Add symbol instance for this animation
        if (frames.length > 0) {
            let firstFrame = frames[0];
            let symbolEntry = {
                "SI": {
                    "SN": animName,
                    "FF": 0,
                    "ST": "G",
                    "TRP": {"x": 0, "y": 0},
                    "LP": "LP",
                    "MX": [1, 0, 0, 1, 0, 0] // Identity matrix
                }
            };
            frameData.E.push(symbolEntry);
        }
        
        mainLayer.FR.push(frameData);
        frameIndex++;
    }
    
    layers.push(mainLayer);
    
    // Build the root timeline
    return {
        "N": "animations",
        "SN": "__BTA_TEMP_SPRITEMAP_PACKED_SYMBOL",
        "TL": {
            "L": layers
        }
    };
}

/**
 * Build the Symbol Dictionary (SD) with symbol definitions
 * Each symbol represents a frame/animation in the atlas
 */
function buildSymbolDictionary(rects) {
    let symbols = [];
    
    // Group by animation prefix
    let animationGroups = groupFramesByAnimation(rects);
    
    for (let [animName, frames] of Object.entries(animationGroups)) {
        // Create a symbol for this animation with its own timeline
        let symbol = {
            "SN": animName,
            "TL": buildSymbolTimeline(frames, rects)
        };
        symbols.push(symbol);
    }
    
    return {
        "S": symbols
    };
}

/**
 * Build timeline for a symbol (animation)
 */
function buildSymbolTimeline(frames, rects) {
    let layers = [];
    
    // Main layer with sprite instances
    let mainLayer = {
        "LN": "Layer_1",
        "FR": []
    };
    
    for (let i = 0; i < frames.length; i++) {
        let frame = frames[i];
        let frameData = {
            "I": i,
            "DU": 1, // Each frame lasts 1 tick
            "E": []
        };
        
        // Add atlas sprite instance
        let spriteInstance = {
            "ASI": {
                "MX": [1, 0, 0, 1, 0, 0], // Identity matrix
                "N": frame.name
            }
        };
        frameData.E.push(spriteInstance);
        
        mainLayer.FR.push(frameData);
    }
    
    layers.push(mainLayer);
    
    return {
        "L": layers
    };
}

export {getExporterByType, startExporter, startBetterTAExporter};
export default list;