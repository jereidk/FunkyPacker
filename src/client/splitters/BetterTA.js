import Splitter from './Splitter';

class BetterTA extends Splitter {
    static check(data) {
        // Check if the data is a valid BetterTA atlas format
        if (data && data.ATLAS && data.ATLAS.SPRITES && Array.isArray(data.ATLAS.SPRITES)) {
            return true;
        }
        
        // Also check for standard array format
        if (data && Array.isArray(data) && data.length > 0 && data[0].frame) {
            return true;
        }
        
        return false;
    }

    static split(data, options) {
        let frames = [];
        
        // BetterTA format: {ATLAS: {SPRITES: [{SPRITE: {...}}, ...]}}
        if (data.ATLAS && data.ATLAS.SPRITES) {
            for (let item of data.ATLAS.SPRITES) {
                // Handle nested SPRITE object
                let sprite = item.SPRITE || item;
                
                frames.push({
                    name: String(sprite.name || sprite.n || ''),
                    frame: {
                        x: parseInt(sprite.x) || 0,
                        y: parseInt(sprite.y) || 0,
                        w: parseInt(sprite.w) || 0,
                        h: parseInt(sprite.h) || 0
                    },
                    rotated: sprite.rotated === true || sprite.rotated === 'true' || sprite.rotated === 'true',
                    trimmed: false,
                    spriteSourceSize: {
                        x: 0,
                        y: 0,
                        w: parseInt(sprite.w) || 0,
                        h: parseInt(sprite.h) || 0
                    },
                    sourceSize: {
                        w: parseInt(sprite.w) || 0,
                        h: parseInt(sprite.h) || 0
                    },
                    originalFile: String(sprite.name || sprite.n || '')
                });
            }
        }
        // Standard format: array of frames
        else if (Array.isArray(data)) {
            for (let item of data) {
                frames.push({
                    name: String(item.name || item.n || ''),
                    frame: {
                        x: parseInt(item.frame?.x || item.x) || 0,
                        y: parseInt(item.frame?.y || item.y) || 0,
                        w: parseInt(item.frame?.w || item.w) || 0,
                        h: parseInt(item.frame?.h || item.h) || 0
                    },
                    rotated: item.rotated === true,
                    trimmed: item.trimmed === true,
                    spriteSourceSize: {
                        x: parseInt(item.spriteSourceSize?.x || 0),
                        y: parseInt(item.spriteSourceSize?.y || 0),
                        w: parseInt(item.spriteSourceSize?.w || item.frame?.w || item.w) || 0,
                        h: parseInt(item.spriteSourceSize?.h || item.frame?.h || item.h) || 0
                    },
                    sourceSize: {
                        w: parseInt(item.sourceSize?.w || item.frame?.w || item.w) || 0,
                        h: parseInt(item.sourceSize?.h || item.frame?.h || item.h) || 0
                    },
                    originalFile: String(item.name || item.n || '')
                });
            }
        }
        
        return frames;
    }

    static get type() {
        return 'BetterTA';
    }

    static get inverseRotation() {
        return false;
    }
}

export default BetterTA;
