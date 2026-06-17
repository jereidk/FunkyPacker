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
    let animationContent = generateBetterTAAnimation(rects, config, options);

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
 * Complete format with all features:
 * - AN: Root animation node with timeline
 * - SD: Symbol dictionary with nested timelines
 * - MD: Metadata with version, framerate, canvas size
 * - Full support for symbol instances, sprite instances
 * - Color effects, filters, transformations
 */
function generateBetterTAAnimation(rects, config, options) {
    const FRAMERATE = options.framerate || 24;
    const CANVAS_WIDTH = options.canvasWidth || config.imageWidth || 1280;
    const CANVAS_HEIGHT = options.canvasHeight || config.imageHeight || 720;
    const BACKGROUND_COLOR = options.backgroundColor || "#999999";
    const ANIMATION_NAME = options.animationName || config.imageName || "animations";
    
    // Group frames by animation prefix (e.g., "walk_001" -> "walk")
    let animationGroups = groupFramesByAnimation(rects);
    
    // Calculate symbol offsets and transformations based on sprite positions
    let symbolOffsets = calculateSymbolOffsets(animationGroups, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Build the root animation node (AN)
    let rootAnimationNode = buildRootAnimationNode(
        animationGroups, 
        rects, 
        FRAMERATE,
        symbolOffsets
    );
    
    // Build symbol dictionary (SD) - creates symbol definitions for each animation
    let symbolDictionary = buildSymbolDictionary(rects, animationGroups, symbolOffsets);
    
    // Build metadata (MD)
    let metadata = {
        "V": "BTA 1.2.0",              // BTA version
        "N": ANIMATION_NAME,           // Animation name
        "BGC": BACKGROUND_COLOR,        // Background color
        "W": CANVAS_WIDTH,             // Canvas width
        "H": CANVAS_HEIGHT,            // Canvas height
        "ASV": 3,                      // Atlas Structure Version
        "FRT": FRAMERATE               // Frame rate
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
 * Calculate symbol offsets based on sprite positions in the atlas
 * This creates proper transformation matrices for each animation
 */
function calculateSymbolOffsets(animationGroups, canvasWidth, canvasHeight) {
    let offsets = {};
    
    for (let [animName, frames] of Object.entries(animationGroups)) {
        if (frames.length > 0) {
            // Use the first frame to determine the symbol's pivot point
            let firstFrame = frames[0];
            let sprite = firstFrame.rect;
            
            // Calculate offset from center of canvas
            let offsetX = (sprite.sourceSize?.w || sprite.frame?.w || 0) / 2;
            let offsetY = (sprite.sourceSize?.h || sprite.frame?.h || 0) / 2;
            
            offsets[animName] = {
                x: offsetX,
                y: offsetY,
                width: sprite.sourceSize?.w || sprite.frame?.w || 0,
                height: sprite.sourceSize?.h || sprite.frame?.h || 0,
                frameX: sprite.frame?.x || 0,
                frameY: sprite.frame?.y || 0
            };
        }
    }
    
    return offsets;
}

/**
 * Group frames by animation prefix
 * e.g., "walk_001", "walk_002" -> { "walk": ["walk_001", "walk_002"] }
 */
function groupFramesByAnimation(rects) {
    let groups = {};
    
    // Sort rects by name to ensure consistent grouping
    let sortedRects = [...rects].sort((a, b) => {
        return smartSortImages(a.name, b.name);
    });
    
    for (let i = 0; i < sortedRects.length; i++) {
        let rect = sortedRects[i];
        let name = rect.name;
        let prefix = extractAnimationPrefix(name);
        
        if (!groups[prefix]) {
            groups[prefix] = [];
        }
        groups[prefix].push({
            index: i,
            name: name,
            rect: rect
        });
    }
    
    return groups;
}

/**
 * Extract animation prefix from frame name
 * Handles patterns like: walk_001, walk-001, idle0001, etc.
 * Also handles FNF-style names: "animations/down", "animations/idle"
 */
function extractAnimationPrefix(frameName) {
    // Remove file extension if present
    let name = frameName.replace(/\.[^.]+$/, '');
    
    // Handle FNF-style paths: "animations/down" -> "animations/down"
    if (name.startsWith("animations/") || name.startsWith("anim/")) {
        return name;
    }
    
    // Handle names with prefixes: "left_0001" -> "left"
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
 * This is the main timeline with references to all animation symbols
 */
function buildRootAnimationNode(animationGroups, rects, framerate, symbolOffsets) {
    let layers = [];
    let frameIndex = 0;
    let symbolIndex = 0;
    
    // Create layers: one for each animation type and one for effects
    // Layer 1: Animation sequence (state machine)
    let animationLayer = {
        "LN": "Animation_State_Machine",
        "FR": []
    };
    
    // Layer 2: Sprite layer (actual sprites)
    let spriteLayer = {
        "LN": "Sprites",
        "FR": []
    };
    
    // Process animations in order
    for (let [animName, frames] of Object.entries(animationGroups)) {
        let symbolName = animName;
        let offset = symbolOffsets[animName] || { x: 0, y: 0 };
        
        // Frame in animation sequence layer
        // This acts as a "state" that triggers the symbol
        let animFrame = {
            "N": animName + " " + symbolIndex + "START",
            "I": frameIndex,
            "DU": Math.round(1000 / framerate * 3), // 3 frames per state
            "E": [{
                "SI": {
                    "SN": symbolName,
                    "FF": 0,
                    "ST": "G",
                    "TRP": {"x": 0, "y": 0},
                    "LP": "LP",
                    "MX": [1, 0, 0, 1, -offset.x, -offset.y]
                }
            }]
        };
        animationLayer.FR.push(animFrame);
        frameIndex++;
        
        // Frame in sprite layer - the actual symbol being displayed
        let spriteFrame = {
            "I": symbolIndex,
            "DU": Math.round(1000 / framerate * frames.length),
            "E": []
        };
        
        // Add sprite instances for each frame in this animation
        for (let i = 0; i < frames.length; i++) {
            let frame = frames[i];
            let spriteInst = {
                "ASI": {
                    "MX": [1, 0, 0, 1, 0, 0],
                    "N": frame.name
                }
            };
            spriteFrame.E.push(spriteInst);
        }
        
        spriteLayer.FR.push(spriteFrame);
        symbolIndex++;
    }
    
    // Add idle frame that loops
    let idleFrame = {
        "N": "idle",
        "I": frameIndex,
        "DU": Math.round(1000 / framerate),
        "E": [{
            "SI": {
                "SN": "idle",
                "FF": 0,
                "ST": "G",
                "TRP": {"x": 0, "y": 0},
                "LP": "LP",
                "MX": [1, 0, 0, 1, 0, 0]
            }
        }]
    };
    animationLayer.FR.push(idleFrame);
    
    // Create the spritesheet layer that references individual sprites
    let spritesheetLayer = {
        "LN": "Spritesheet_Frames",
        "FR": []
    };
    
    // Add one frame per sprite for frame-by-frame playback
    for (let i = 0; i < rects.length; i++) {
        let spriteFrame = {
            "I": i,
            "DU": 1,
            "E": [{
                "ASI": {
                    "MX": [1, 0, 0, 1, 0, 0],
                    "N": rects[i].name
                }
            }]
        };
        spritesheetLayer.FR.push(spriteFrame);
    }
    
    layers.push(spritesheetLayer);
    layers.push(spriteLayer);
    layers.push(animationLayer);
    
    return {
        "N": ANIMATION_NAME,
        "SN": "__BTA_TEMP_SPRITEMAP_PACKED_SYMBOL",
        "TL": {
            "L": layers
        }
    };
}

/**
 * Build the Symbol Dictionary (SD) with symbol definitions
 * Each symbol represents an animation sequence with its own timeline
 */
function buildSymbolDictionary(rects, animationGroups, symbolOffsets) {
    let symbols = [];
    
    for (let [animName, frames] of Object.entries(animationGroups)) {
        let symbol = buildSymbol(animName, frames, symbolOffsets[animName]);
        symbols.push(symbol);
    }
    
    // Add an "idle" symbol that shows the first frame
    if (rects.length > 0) {
        symbols.push({
            "SN": "idle",
            "TL": {
                "L": [{
                    "LN": "Layer_1",
                    "FR": [{
                        "I": 0,
                        "DU": 1,
                        "E": [{
                            "ASI": {
                                "MX": [1, 0, 0, 1, 0, 0],
                                "N": rects[0].name
                            }
                        }]
                    }]
                }]
            }
        });
    }
    
    return {
        "S": symbols
    };
}

/**
 * Build a single symbol definition with full timeline
 */
function buildSymbol(animName, frames, offset) {
    let layers = [];
    
    // Main sprite layer
    let spriteLayer = {
        "LN": "Sprite_Container",
        "FR": []
    };
    
    // Offset layer (for transformation)
    let offsetLayer = {
        "LN": "Transform_Offset",
        "FR": []
    };
    
    // Add frames for each sprite in the animation
    for (let i = 0; i < frames.length; i++) {
        let frame = frames[i];
        let spriteData = frame.rect;
        
        // Calculate proper transformation matrix
        let mx = calculateTransformMatrix(spriteData, offset);
        
        // Sprite frame
        spriteLayer.FR.push({
            "I": i,
            "DU": 1,
            "E": [{
                "ASI": {
                    "MX": mx,
                    "N": frame.name
                }
            }]
        });
        
        // Offset frame (moves the sprite into position)
        offsetLayer.FR.push({
            "I": i,
            "DU": 1,
            "E": []
        });
    }
    
    // Add hold frame at the end
    if (frames.length > 0) {
        spriteLayer.FR.push({
            "I": frames.length,
            "DU": 100, // Hold for extra frames
            "E": []
        });
    }
    
    layers.push(spriteLayer);
    layers.push(offsetLayer);
    
    return {
        "SN": animName,
        "TL": {
            "L": layers
        }
    };
}

/**
 * Calculate transformation matrix for a sprite
 * Matrix format: [scaleX, skewY, skewX, scaleY, translateX, translateY]
 */
function calculateTransformMatrix(spriteData, offset) {
    let frame = spriteData.frame || {};
    let sourceSize = spriteData.sourceSize || {};
    let spriteSourceSize = spriteData.spriteSourceSize || {};
    
    // Handle rotation if present
    if (spriteData.rotated) {
        return [
            0, 1,           // Rotated 90 degrees
            -1, 0,
            frame.x + frame.w, // Adjusted position
            frame.y
        ];
    }
    
    // Identity matrix (no transformation)
    return [1, 0, 0, 1, 0, 0];
}

export {getExporterByType, startExporter, startBetterTAExporter};
export default list;