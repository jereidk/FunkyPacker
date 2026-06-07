import { cleanPrefix } from '../utils/common';
import Splitter from './Splitter';

import xmlParser from 'xml2js';

// Remove BOM (Byte Order Mark) that causes xmldom errors
const stripBOM = (data) => {
    if (typeof data === 'string') {
        // Remove UTF-8 BOM if present
        return data.replace(/^\uFEFF/, '');
    }
    return data;
};

class Sparrow extends Splitter {
    static check(data, cb) {
        if(data == null) {
            cb(false);
            return;
        }

        try {
            const cleanData = stripBOM(data);

            xmlParser.parseString(cleanData, (err, atlas) => {
                if(err) {
                    cb(false);
                    return;
                }

                cb(atlas.TextureAtlas && Array.isArray(atlas.TextureAtlas.SubTexture));
            });
        }
        catch(e) {
            console.error(e);
            cb(false);
        }
    }

    static split(data, options, cb) {
        let res = [];

        if(data == null) {
            cb(false);
            return;
        }

        try {
            const cleanData = stripBOM(data);

            xmlParser.parseString(cleanData, (err, atlas) => {
                if(err) {
                    console.warn('[Sparrow] Parse error:', err.message);
                    cb(res);
                    return;
                }

                let list = atlas.TextureAtlas.SubTexture;

                var order = [];

                for(let item of list) {
                    item = item['$'];

                    var name = Splitter.fixFileName(item.name);
                    order.push(name);

                    let rotated = item.rotated === 'true';
                    if(rotated) {
                        // Unsure if i should swap the offsets too?
                        let temp = item.width;
                        item.width = item.height;
                        item.height = temp;
                    }

                    item.x = parseInt(item.x, 10);
                    item.y = parseInt(item.y, 10);
                    item.width = parseInt(item.width, 10);
                    item.height = parseInt(item.height, 10);
                    if(item.frameX != null) {
                        item.frameX = -parseInt(item.frameX, 10);
                        item.frameY = -parseInt(item.frameY, 10);
                        item.frameWidth = parseInt(item.frameWidth, 10);
                        item.frameHeight = parseInt(item.frameHeight, 10);
                    } else {
                        item.frameX = 0;
                        item.frameY = 0;
                        item.frameWidth = item.width;
                        item.frameHeight = item.height;
                    }

                    let trimmed = item.width < item.frameWidth || item.height < item.frameHeight;

                    item.frameWidth = Math.max(item.frameWidth, item.width + item.frameX);
                    item.frameHeight = Math.max(item.frameHeight, item.height + item.frameY);

                    res.push({
                        name: name,
                        frame: {
                            x: item.x,
                            y: item.y,
                            w: item.width,
                            h: item.height
                        },
                        spriteSourceSize: {
                            x: item.frameX,
                            y: item.frameY,
                            w: item.width,
                            h: item.height
                        },
                        sourceSize: {
                            w: item.frameWidth,
                            h: item.frameHeight
                        },
                        rotated: rotated,
                        trimmed: trimmed
                    });
                }

                var maxSizes = {};

                for(let item of res) {
                    var prefix = cleanPrefix(item.name);

                    if(maxSizes[prefix] == null) {
                        maxSizes[prefix] = {
                            mw: -Infinity,
                            mh: -Infinity,
                        };
                    }

                    maxSizes[prefix].mw = Math.max(item.sourceSize.w, maxSizes[prefix].mw);
                    maxSizes[prefix].mh = Math.max(item.sourceSize.h, maxSizes[prefix].mh);
                }

                for(let item of res) {
                    var prefix = cleanPrefix(item.name);

                    item.sourceSize.mw = maxSizes[prefix].mw;
                    item.sourceSize.mh = maxSizes[prefix].mh;
                }

                cb(res);
            });
        }
        catch(e) {
            console.error(e);
        }

        cb(res);
    }

    static get type() {
        return 'Sparrow';
    }
}

export default Sparrow;