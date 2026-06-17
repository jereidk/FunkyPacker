import { Observer, GLOBAL_EVENT } from './Observer';
import PackProcessor from './PackProcessor';
import TextureRenderer from './utils/TextureRenderer';
import { getFilterByType } from './filters';
import I18 from './utils/I18';
import { startExporter, startBetterTAExporter } from './exporters';
import { getAnimationLinker } from './utils/AnimationLinker';
import astcEncoder from './utils/astc/ASTCEncoder';
//import Tinifyer from 'platform/Tinifyer';
import Downloader from 'platform/Downloader';

// Idempotent polyfill at module scope - HMR-safe with configurable: true
if (!HTMLImageElement.prototype.hasOwnProperty('__fpToDataURL')) {
    Object.defineProperty(HTMLImageElement.prototype, '__fpToDataURL', { value: true, configurable: true, writable: true });
    Object.defineProperty(HTMLImageElement.prototype, 'toDataURL', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function(m, q) {
            let c = document.createElement('canvas');
            c.width = this.naturalWidth; c.height = this.naturalHeight;
            c.getContext('2d').drawImage(this, 0, 0); 
            return c.toDataURL(m, q);
        }
    });
}

let INSTANCE = null;

class APP {

    constructor() {
        INSTANCE = this;

        this.images = {};
        this.packOptions = {};
        this.packResult = null;

        this.onPackComplete = this.onPackComplete.bind(this);
        this.onPackError = this.onPackError.bind(this);

        Observer.on(GLOBAL_EVENT.IMAGES_LIST_CHANGED, this.onImagesListChanged, this);
        Observer.on(GLOBAL_EVENT.PACK_OPTIONS_CHANGED, this.onPackOptionsChanged, this);
        Observer.on(GLOBAL_EVENT.PACK_EXPORTER_CHANGED, this.onPackExporterOptionsChanged, this);
        Observer.on(GLOBAL_EVENT.START_EXPORT, this.startExport, this);
    }

    static get i() {
        return INSTANCE;
    }

    onImagesListChanged(data) {
        this.images = data;
        this.pack();
    }

    onPackOptionsChanged(data) {
        this.packOptions = data;
        this.pack();
    }

    onPackExporterOptionsChanged(data) {
        this.packOptions = data;
    }

    pack() {
        let keys = Object.keys(this.images);

        if (keys.length > 0) {
            Observer.emit(GLOBAL_EVENT.SHOW_SHADER);
            setTimeout(() => this.doPack(), 0);
        }
        else {
            this.doPack();
        }
    }

    doPack() {
        PackProcessor.pack(this.images, this.packOptions, this.onPackComplete, this.onPackError);
    }

    onPackComplete(res) {
        this.packResult = [];

        for (let data of res) {
            let renderer = new TextureRenderer(data, this.packOptions);

            this.packResult.push({
                data: data,
                buffer: renderer.buffer,
                renderer: renderer
            });
        }

        Observer.emit(GLOBAL_EVENT.PACK_COMPLETE, this.packResult);
        Observer.emit(GLOBAL_EVENT.HIDE_SHADER);
    }

    onPackError(err) {
        Observer.emit(GLOBAL_EVENT.HIDE_SHADER);
        Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, err.description);
    }

    startExport() {
        if (!this.packResult || !this.packResult.length) {
            Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, I18.f("NO_IMAGES_ERROR"));
            return;
        }

        //if (this.packOptions.tinify && !this.packOptions.tinifyKey) {
        //    Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, I18.f("NO_TINIFY_KEY_ERROR"));
        //    return;
        //}

        Observer.emit(GLOBAL_EVENT.SHOW_SHADER);
        setTimeout(() => this.doExport(), 0);
    }

    async doExport() {
        let exporter = this.packOptions.exporter;
        let textureName = this.packOptions.textureName;
        let filterClass = getFilterByType(this.packOptions.filter);
        let filter = new filterClass();

        let files = [];

        let ix = 0;
        for (let item of this.packResult) {

            let fName = textureName + (this.packResult.length > 1 ? "-" + ix : "");

            let buffer = item.renderer.scale(this.packOptions.scale);

            let imageData;
            let astcMeta = null;

            if (this.packOptions.textureFormat === 'astc') {
                // Generate ASTC texture
                const canvas = filter.apply(buffer);
                const ctx = canvas.getContext('2d');
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Get ASTC options from packOptions (with defaults)
                const astcOptions = {
                    blockSize: this.packOptions.astcBlockSize || '4x4',
                    quality: this.packOptions.astcQuality || 'medium',
                    colorProfile: this.packOptions.astcColorProfile || 'ldr-rgba'
                };

                // Encode to ASTC
                const astcData = await astcEncoder.encode(imgData, astcOptions);

                // Store ASTC data as binary (will be converted to base64)
                imageData = astcData;
                astcMeta = {
                    blockSize: astcOptions.blockSize,
                    width: canvas.width,
                    height: canvas.height
                };
            } else {
                imageData = filter.apply(buffer).toDataURL(this.packOptions.textureFormat === "png" ? "image/png" : "image/jpeg");
                let parts = imageData.split(",");
                parts.shift();
                imageData = parts.join(",");
            }

            /*try {
                imageData = await Tinifyer.start(imageData, this.packOptions);
            }
            catch (e) {
                Observer.emit(GLOBAL_EVENT.HIDE_SHADER);
                Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, e);
                return;
            }*/

            if (this.packOptions.textureFormat === 'astc') {
                // For ASTC, we need to store as binary array
                files.push({
                    name: `${fName}.astc`,
                    content: Array.from(new Uint8Array(imageData)),
                    binary: true,
                    astcMeta: astcMeta
                });
            } else {
                files.push({
                    name: `${fName}.${this.packOptions.textureFormat}`,
                    content: imageData,
                    base64: true
                });
            }

            //TODO: move to options
            let pixelFormat = this.packOptions.textureFormat === "png" ? "RGBA8888" :
                              this.packOptions.textureFormat === "astc" ? "ASTC_4x4" : "RGB888";

            let options = {
                imageName: `${fName}`,
                imageFile: `${fName}.${this.packOptions.textureFormat === 'astc' ? 'astc' : this.packOptions.textureFormat}`,
                imageData: this.packOptions.textureFormat === 'astc' ? undefined : imageData,
                format: pixelFormat,
                textureFormat: this.packOptions.textureFormat,
                imageWidth: buffer.width,
                imageHeight: buffer.height,
                removeFileExtension: this.packOptions.removeFileExtension,
                prependFolderName: this.packOptions.prependFolderName,
                base64Export: this.packOptions.base64Export,
                scale: this.packOptions.scale,
                trimMode: this.packOptions.trimMode,

                sortExportedRows: this.packOptions.sortExportedRows,
            };

            try {
                // Check if this is the BetterTA exporter
                if (exporter.type === "BetterTA (Atlas)") {
                    // Use BetterTA exporter which generates Atlas.json
                    let betterTAOutput = await startBetterTAExporter(exporter, item.data, options);
                    files.push({
                        name: betterTAOutput.atlas.name,
                        content: betterTAOutput.atlas.content
                    });
                    
                    // If we have a preserved Animation.json, validate and export
                    let animLinker = getAnimationLinker();
                    if (animLinker.isLoaded()) {
                        // Get all sprite names from the packed result
                        let spriteNames = item.data.map(d => d.name || d.originalFile || '');
                        
                        // Validate sprite existence in animation
                        let validation = animLinker.validateExistence(spriteNames);
                        
                        if (validation.total > 0) {
                            // Build warning message
                            let warnings = [];
                            if (validation.sprites.length > 0) {
                                warnings.push(validation.sprites.length + ' sprites');
                            }
                            if (validation.symbols.length > 0) {
                                warnings.push(validation.symbols.length + ' symbols');
                            }
                            
                            let warnMsg = 'Warning: Animation references may be broken:\n' +
                                '- ' + warnings.join(', ') + ' not found in atlas\n' +
                                '- Animation may not play correctly\n' +
                                '- Consider keeping original sprite names';
                            
                            Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, warnMsg);
                            console.warn('BetterTA: Orphaned references detected:', validation);
                        }
                        
                        // Log reference stats
                        let refSprites = animLinker.getReferencedSprites();
                        let refSymbols = animLinker.getReferencedSymbols();
                        console.log('BetterTA: Animation.json preserved', 
                            '(sprites:', refSprites.length, 
                            '| symbols:', refSymbols.length + ')');
                        
                        files.push({
                            name: betterTAOutput.animation.name,
                            content: animLinker.toJSON()
                        });
                    }
                } else {
                    // Standard exporter
                    files.push({
                        name: fName + "." + this.packOptions.exporter.fileExt,
                        content: await startExporter(exporter, item.data, options)
                    });
                }
            }
            catch (e) {
                Observer.emit(GLOBAL_EVENT.HIDE_SHADER);
                Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, I18.f("EXPORTER_ERROR", e));
                return;
            }

            ix++;
        }

        try {
            await Downloader.run(files, this.packOptions.fileName, this.packOptions.savePath);
        } catch (e) {
            Observer.emit(GLOBAL_EVENT.HIDE_SHADER);
            Observer.emit(GLOBAL_EVENT.SHOW_MESSAGE, I18.f("DOWNLOAD_ERROR", e));
            return;
        }
        Observer.emit(GLOBAL_EVENT.HIDE_SHADER);
    }
}

export default APP;