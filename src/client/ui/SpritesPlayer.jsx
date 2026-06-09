import React from 'react';
import ReactDOM from 'react-dom';
import I18 from '../utils/I18';
import {GLOBAL_EVENT, Observer} from "../Observer";
import {cleanPrefix, smartSortImages} from '../utils/common';
import sparrowStore from '../store/sparrowStore';

class SpritesPlayer extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            sparrowTextures: [],
            sparrowAnimations: {},
            selectedSparrowAnim: null,
            xmlError: null,
            // Enhanced animation state
            animationMode: 'sparrow', // 'sparrow', 'sequence', 'texturepacker'
            currentFrame: 0,
            isPlaying: false,
            playbackDirection: 'forward', // 'forward', 'reverse', 'pingpong'
            pingpongForward: true,
            zoom: 1,
            showGrid: false,
            autoDetectAnimations: true,
            detectedAnimations: {},
            selectedSequence: null
        };

        this.textures = [];

        this.currentTextures = [];
        this.currentFrame = 0;

        this.width = 0;
        this.height = 0;

        this.updateTimer = null;

        this.selectedImages = [];

        this.animations = [];
        this.currentAnimation = null;
        this.animationTimer = null;

        this.update = this.update.bind(this);
        this.forceUpdate = this.forceUpdate.bind(this);
        this.updateCurrentTextures = this.updateCurrentTextures.bind(this);
        this.onSpeedChange = this.onSpeedChange.bind(this);
        this.onAnimationSpeedChange = this.onAnimationSpeedChange.bind(this);
        this.loadSparrowXML = this.loadSparrowXML.bind(this);
        this.loadTexturePackerJSON = this.loadTexturePackerJSON.bind(this);
        this.selectAnimation = this.selectAnimation.bind(this);
        this.playAnimation = this.playAnimation.bind(this);
        this.stopAnimation = this.stopAnimation.bind(this);
        this.playSequence = this.playSequence.bind(this);
        this.stopSequence = this.stopSequence.bind(this);
        this.detectAnimationsFromTextures = this.detectAnimationsFromTextures.bind(this);
        this.setPlaybackDirection = this.setPlaybackDirection.bind(this);
        this.setZoom = this.setZoom.bind(this);
        this.toggleGrid = this.toggleGrid.bind(this);
        this.goToFrame = this.goToFrame.bind(this);

        Observer.on(GLOBAL_EVENT.IMAGES_LIST_SELECTED_CHANGED, this.onImagesSelected, this);
    }

    onImagesSelected(list=[]) {
        this.selectedImages = list;
        this.updateCurrentTextures();
    }

    componentDidMount() {
        if(this.props.start) this.setup();
        else this.stop();
    }

    componentDidUpdate() {
        if(this.props.start) this.setup();
        else this.stop();
    }

    componentWillUnmount() {
        this.stopAnimation();
        this.stopSequence();
    }

    setup() {
        ReactDOM.findDOMNode(this.refs.playerContainer).className = "player-view-container " + this.props.textureBack;

        this.textures = [];

        if(!this.props.data) return;

        this.width = 0;
        this.height = 0;

        for(let part of this.props.data) {
            let baseTexture = part.buffer;

            for (let config of part.data) {
                var w = config.sourceSize.w;
                var h = config.sourceSize.h;

                var prefix = cleanPrefix(config.originalFile || config.file || config.name);

                var maxMap = sparrowStore.getMaxMapEntry(prefix);
                if (maxMap) {
                    w = maxMap.mw;
                    h = maxMap.mh;
                }

                if (this.width < w) this.width = w;
                if (this.height < h) this.height = h;

                this.textures.push({
                    config: config,
                    baseTexture: baseTexture,
                    name: config.name
                });
            }
        }

        if(this.width < 256) this.width = 256;
        if(this.height < 200) this.height = 200;

        let canvas = ReactDOM.findDOMNode(this.refs.view);
        canvas.width = this.width;
        canvas.height = this.height;

        this.updateCurrentTextures();
        
        // Auto-detect animations from loaded textures
        if (this.state.autoDetectAnimations && this.state.animationMode === 'sequence') {
            this.detectAnimationsFromTextures();
        }
    }

    forceUpdate(e) {
        let key = e.keyCode || e.which;
        if(key === 13) this.updateCurrentTextures();
    }

    onSpeedChange(e)
    {
        this.refs.fps.textContent = e.target.value + " fps";
    }

    onAnimationSpeedChange(e) {
        this.refs.animFps.textContent = e.target.value + " fps";
        if (this.animationTimer) {
            this.stopAnimation();
            this.playAnimation();
        }
        if (this.state.isPlaying) {
            this.stopSequence();
            this.playSequence();
        }
    }
    
    onSequenceSpeedChange(e) {
        this.refs.seqFps.textContent = e.target.value + " fps";
        if (this.state.isPlaying) {
            this.stopSequence();
            this.playSequence();
        }
    }

    updateCurrentTextures() {
        let textures = [];

        for(let tex of this.textures) {
            if(!tex.config.cloned && this.selectedImages.indexOf(tex.config.file) >= 0) {
                textures.push(tex);
            }

            if(tex.config.cloned && this.selectedImages.indexOf(tex.config.originalFile) >= 0) {
                textures.push(tex);
            }
        }

        textures = textures.sort((a, b) => {
            return smartSortImages(a.config.name, b.config.name);
        });

        this.currentTextures = textures;
        this.currentFrame = 0;
        this.update(true);
    }

    update(skipFrameUpdate) {
        clearTimeout(this.updateTimer);

        if(!skipFrameUpdate){
            this.currentFrame++;
            if(this.currentFrame >= this.currentTextures.length) {
                this.currentFrame = 0;
            }
        }
        this.renderTexture();

        this.updateTimer = setTimeout(this.update, 1000 / ReactDOM.findDOMNode(this.refs.speed).value);
    }

    renderTexture() {
        let ctx = ReactDOM.findDOMNode(this.refs.view).getContext("2d");

        ctx.clearRect(0, 0, this.width, this.height);

        let texture = this.currentTextures[this.currentFrame];
        if(!texture) return;

        var w = texture.config.sourceSize.w;
        var h = texture.config.sourceSize.h;

        var prefix = cleanPrefix(texture.config.originalFile || texture.config.file || texture.config.name);

        var maxMap = sparrowStore.getMaxMapEntry(prefix);
        if (maxMap) {
            w = maxMap.mw;
            h = maxMap.mh;
        }

        let buffer = ReactDOM.findDOMNode(this.refs.buffer);
        buffer.width = w;
        buffer.height = h;

        let bufferCtx = buffer.getContext("2d");
        bufferCtx.clearRect(0, 0, w, h);

        let x = this.width/2, y = this.height/2;

        if(texture.config.rotated) {
            bufferCtx.save();

            bufferCtx.translate(texture.config.spriteSourceSize.x + texture.config.spriteSourceSize.w/2, texture.config.spriteSourceSize.y + texture.config.spriteSourceSize.h/2);
            bufferCtx.rotate(-Math.PI/2);

            bufferCtx.drawImage(texture.baseTexture,
                texture.config.frame.x, texture.config.frame.y,
                texture.config.frame.h, texture.config.frame.w,
                -texture.config.spriteSourceSize.h/2, -texture.config.spriteSourceSize.w/2,
                texture.config.spriteSourceSize.h, texture.config.spriteSourceSize.w);

            bufferCtx.restore();
        }
        else {
            bufferCtx.drawImage(texture.baseTexture,
                texture.config.frame.x, texture.config.frame.y,
                texture.config.frame.w, texture.config.frame.h,
                texture.config.spriteSourceSize.x, texture.config.spriteSourceSize.y,
                texture.config.spriteSourceSize.w, texture.config.spriteSourceSize.h);
        }

        ctx.drawImage(buffer,
            0, 0,
            w, h,
            x - w/2, y - h/2,
            w, h);
    }

    stop() {
        clearTimeout(this.updateTimer);
    }
    
    // Detect animations from loaded textures by analyzing naming patterns
    detectAnimationsFromTextures() {
        const animations = {};
        const groups = {};
        
        // Group textures by prefix pattern
        for (let tex of this.textures) {
            const name = tex.config.name || tex.name;
            if (!name) continue;
            
            // Try different patterns to extract animation name and frame number
            let match = name.match(/^(.+?)(\d+)$/) || 
                       name.match(/^(.+?)_(\d+)$/) ||
                       name.match(/^(.+?)-(\d+)$/) ||
                       name.match(/^(.+?)_(\d+)_/) ||
                       name.match(/^(.+?)_([a-z])(\d+)$/i);
            
            if (match) {
                const baseName = match[1].replace(/[_\-\s]+$/, ''); // Remove trailing separators
                const frameNum = parseInt(match[2], 10);
                
                if (!groups[baseName]) {
                    groups[baseName] = [];
                }
                groups[baseName].push({ 
                    tex, 
                    frameNum,
                    name 
                });
            }
        }
        
        // Create animations from groups (only if more than 1 frame)
        for (let baseName in groups) {
            const frames = groups[baseName].sort((a, b) => a.frameNum - b.frameNum);
            if (frames.length > 1) {
                animations[baseName] = frames.map(f => ({
                    ...f.tex,
                    frameIndex: f.frameNum
                }));
            }
        }
        
        this.setState({ 
            detectedAnimations: animations,
            selectedSequence: Object.keys(animations)[0] || null
        });
        
        // Auto-play first animation if detected
        const animNames = Object.keys(animations);
        if (animNames.length > 0) {
            setTimeout(() => {
                if (!this.state.isPlaying) {
                    this.playSequence();
                }
            }, 100);
        }
        
        return animations;
    }

    // Parse Sparrow XML and extract animations
    parseSparrowXML(xmlString, baseTexture) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlString, "text/xml");
        
        const textures = [];
        const anims = {};
        
        // Parse SubTextures
        const subTextures = xml.getElementsByTagName('SubTexture');
        for (let sub of subTextures) {
            const name = sub.getAttribute('name') || '';
            const frameX = parseInt(sub.getAttribute('frameX') || '0');
            const frameY = parseInt(sub.getAttribute('frameY') || '0');
            const frameW = parseInt(sub.getAttribute('frameWidth') || sub.getAttribute('width') || '0');
            const frameH = parseInt(sub.getAttribute('frameHeight') || sub.getAttribute('height') || '0');
            
            textures.push({
                name: name,
                x: parseInt(sub.getAttribute('x') || '0'),
                y: parseInt(sub.getAttribute('y') || '0'),
                width: parseInt(sub.getAttribute('width') || '0'),
                height: parseInt(sub.getAttribute('height') || '0'),
                frameX: frameX,
                frameY: frameY,
                frameWidth: frameW,
                frameHeight: frameH,
                rotated: sub.getAttribute('rotated') === 'true'
            });
        }
        
        // Parse Animations from texture names
        const groups = {};
        for (let tex of textures) {
            const match = tex.name.match(/^(.+?)(\d+)$/) || tex.name.match(/^(.+?)_(\d+)$/);
            if (match) {
                const baseName = match[1];
                const frameNum = parseInt(match[2]);
                if (!groups[baseName]) {
                    groups[baseName] = [];
                }
                groups[baseName].push({ tex, frameNum });
            }
        }
        
        // Create animations from groups
        for (let baseName in groups) {
            const frames = groups[baseName].sort((a, b) => a.frameNum - b.frameNum);
            if (frames.length > 1) {
                anims[baseName] = frames.map(f => f.tex);
            }
        }
        
        return { textures, anims, baseTexture };
    }
    
    // Parse TexturePacker JSON format with animations metadata
    parseTexturePackerJSON(jsonString, baseTexture) {
        try {
            const json = JSON.parse(jsonString);
            const textures = [];
            const anims = {};
            
            // Handle TexturePacker format with frames object
            if (json.frames) {
                for (let frameName in json.frames) {
                    const frame = json.frames[frameName];
                    textures.push({
                        name: frameName,
                        x: frame.frame.x || 0,
                        y: frame.frame.y || 0,
                        width: frame.frame.w || 0,
                        height: frame.frame.h || 0,
                        frameX: frame.spriteSourceSize?.x || 0,
                        frameY: frame.spriteSourceSize?.y || 0,
                        frameWidth: frame.spriteSourceSize?.w || frame.frame.w || 0,
                        frameHeight: frame.spriteSourceSize?.h || frame.frame.h || 0,
                        rotated: frame.rotated || false,
                        trimmed: frame.trimmed || false,
                        sourceSize: frame.sourceSize || { w: frame.frame.w, h: frame.frame.h }
                    });
                }
            }
            
            // Check for animations in meta (TexturePacker PRO feature)
            if (json.meta?.animations) {
                const animationData = json.meta.animations;
                for (let animName in animationData) {
                    const frames = animationData[animName];
                    anims[animName] = frames.map(frameName => 
                        textures.find(t => t.name === frameName)
                    ).filter(Boolean);
                }
            }
            
            // Auto-detect animations from texture names if no metadata
            if (Object.keys(anims).length === 0) {
                const groups = {};
                for (let tex of textures) {
                    const match = tex.name.match(/^(.+?)(\d+)$/) || tex.name.match(/^(.+?)_(\d+)$/);
                    if (match) {
                        const baseName = match[1];
                        const frameNum = parseInt(match[2]);
                        if (!groups[baseName]) groups[baseName] = [];
                        groups[baseName].push({ tex, frameNum });
                    }
                }
                
                for (let baseName in groups) {
                    const frames = groups[baseName].sort((a, b) => a.frameNum - b.frameNum);
                    if (frames.length > 1) {
                        anims[baseName] = frames.map(f => f.tex);
                    }
                }
            }
            
            return { textures, anims, baseTexture, meta: json.meta };
        } catch (err) {
            console.error('Error parsing TexturePacker JSON:', err);
            throw err;
        }
    }

    // Load Sparrow XML file
    async loadSparrowXML(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            
            let baseTexture = this.props.data?.[0]?.buffer;
            
            if (!baseTexture && this.currentTextures.length > 0) {
                baseTexture = this.currentTextures[0].baseTexture;
            }

            const result = this.parseSparrowXML(text, baseTexture);
            
            this.setState({
                sparrowTextures: result.textures,
                sparrowAnimations: result.anims,
                sparrowBaseTexture: result.baseTexture,
                selectedSparrowAnim: null,
                animationMode: 'sparrow',
                xmlError: null
            });

            const animNames = Object.keys(result.anims);
            if (animNames.length > 0) {
                this.selectAnimation(animNames[0]);
            }
        } catch (err) {
            console.error('Error loading Sparrow XML:', err);
            this.setState({ xmlError: 'Failed to parse XML file: ' + err.message });
        }
    }
    
    // Load TexturePacker JSON file
    async loadTexturePackerJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            
            let baseTexture = this.props.data?.[0]?.buffer;
            
            if (!baseTexture && this.currentTextures.length > 0) {
                baseTexture = this.currentTextures[0].baseTexture;
            }
            
            const result = this.parseTexturePackerJSON(text, baseTexture);
            
            this.setState({
                sparrowTextures: result.textures,
                sparrowAnimations: result.anims,
                sparrowBaseTexture: result.baseTexture,
                selectedSparrowAnim: null,
                animationMode: 'texturepacker',
                xmlError: null
            });
            
            const animNames = Object.keys(result.anims);
            if (animNames.length > 0) {
                this.selectAnimation(animNames[0]);
            }
        } catch (err) {
            console.error('Error loading TexturePacker JSON:', err);
            this.setState({ xmlError: 'Failed to parse JSON file: ' + err.message });
        }
    }

    selectAnimation(animName) {
        const { sparrowAnimations } = this.state;
        if (!sparrowAnimations || !sparrowAnimations[animName]) return;

        this.setState({ selectedSparrowAnim: animName });
        this.stopAnimation();
        
        const frames = sparrowAnimations[animName];
        const maxW = Math.max(...frames.map(f => f.frameWidth || f.width));
        const maxH = Math.max(...frames.map(f => f.frameHeight || f.height));
        
        let canvas = ReactDOM.findDOMNode(this.refs.animView);
        if (canvas) {
            canvas.width = Math.max(maxW, 256);
            canvas.height = Math.max(maxH, 256);
        }
        
        this.playAnimation();
    }
    
    selectSequence(animName) {
        const { detectedAnimations } = this.state;
        if (!detectedAnimations || !detectedAnimations[animName]) return;
        
        this.setState({ selectedSequence: animName });
        this.stopSequence();
        this.playSequence();
    }
    
    playSequence() {
        const { selectedSequence, detectedAnimations, playbackDirection, pingpongForward } = this.state;
        if (!selectedSequence || !detectedAnimations) return;
        
        const frames = detectedAnimations[selectedSequence];
        if (!frames || frames.length === 0) return;
        
        this.setState({ isPlaying: true });
        
        let frameIndex = 0;
        const fps = parseInt(ReactDOM.findDOMNode(this.refs.seqSpeed)?.value || '12');
        let isForward = pingpongForward;
        
        const animate = () => {
            const frame = frames[frameIndex];
            this.renderSequenceFrame(frame, selectedSequence);
            
            // Update current frame in state for UI
            this.setState({ currentFrame: frameIndex });
            
            if (playbackDirection === 'pingpong') {
                if (isForward) {
                    frameIndex++;
                    if (frameIndex >= frames.length) {
                        frameIndex = frames.length - 2;
                        isForward = false;
                    }
                } else {
                    frameIndex--;
                    if (frameIndex < 0) {
                        frameIndex = 1;
                        isForward = true;
                    }
                }
            } else if (playbackDirection === 'reverse') {
                frameIndex--;
                if (frameIndex < 0) frameIndex = frames.length - 1;
            } else {
                frameIndex++;
                if (frameIndex >= frames.length) frameIndex = 0;
            }
            
            this.animationTimer = setTimeout(animate, 1000 / fps);
        };
        
        animate();
    }
    
    stopSequence() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        this.setState({ isPlaying: false });
    }
    
    renderSequenceFrame(tex, animName) {
        let canvas = ReactDOM.findDOMNode(this.refs.seqView);
        if (!canvas || !tex) return;
        
        const ctx = canvas.getContext("2d");
        
        // Set canvas size based on animation
        const { detectedAnimations } = this.state;
        const frames = detectedAnimations[animName] || [];
        const maxW = Math.max(...frames.map(f => f.config?.sourceSize?.w || f.config?.frame?.w || 256));
        const maxH = Math.max(...frames.map(f => f.config?.sourceSize?.h || f.config?.frame?.h || 256));
        
        if (canvas.width !== maxW || canvas.height !== maxH) {
            canvas.width = maxW;
            canvas.height = maxH;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const config = tex.config || tex;
        const baseTexture = tex.baseTexture;
        
        if (!baseTexture) return;
        
        const x = config.frame?.x || 0;
        const y = config.frame?.y || 0;
        const w = config.frame?.w || config.width || 0;
        const h = config.frame?.h || config.height || 0;
        const sx = config.spriteSourceSize?.x || 0;
        const sy = config.spriteSourceSize?.y || 0;
        const sw = config.spriteSourceSize?.w || w;
        const sh = config.spriteSourceSize?.h || h;
        const sourceW = config.sourceSize?.w || sw;
        const sourceH = config.sourceSize?.h || sh;
        
        const offsetX = (canvas.width - sourceW) / 2 - sx;
        const offsetY = (canvas.height - sourceH) / 2 - sy;
        
        // Apply zoom
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this.state.zoom, this.state.zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        
        if (config.rotated) {
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(
                baseTexture,
                x, y, h, w,
                -sh / 2, -sw / 2,
                sh, sw
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                baseTexture,
                x, y, w, h,
                offsetX, offsetY,
                sw, sh
            );
        }
        
        // Draw grid if enabled
        if (this.state.showGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    setPlaybackDirection(direction) {
        this.setState({ playbackDirection: direction });
    }
    
    setZoom(level) {
        this.setState({ zoom: level });
    }
    
    toggleGrid() {
        this.setState(prev => ({ showGrid: !prev.showGrid }));
    }
    
    goToFrame(index) {
        const { selectedSequence, detectedAnimations } = this.state;
        if (!selectedSequence || !detectedAnimations) return;
        
        const frames = detectedAnimations[selectedSequence];
        if (!frames || index < 0 || index >= frames.length) return;
        
        this.setState({ currentFrame: index });
        this.renderSequenceFrame(frames[index], selectedSequence);
    }

    playAnimation() {
        const { selectedSparrowAnim, sparrowAnimations, sparrowBaseTexture } = this.state;
        if (!selectedSparrowAnim || !sparrowAnimations || !sparrowBaseTexture) return;

        const frames = sparrowAnimations[selectedSparrowAnim];
        if (!frames || frames.length === 0) return;

        let frameIndex = 0;
        const fps = parseInt(ReactDOM.findDOMNode(this.refs.animSpeed)?.value || '12');

        const animate = () => {
            const frame = frames[frameIndex];
            this.renderAnimationFrame(frame, sparrowBaseTexture);
            
            frameIndex = (frameIndex + 1) % frames.length;
            this.animationTimer = setTimeout(animate, 1000 / fps);
        };

        animate();
    }

    stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
    }

    renderAnimationFrame(frame, baseTexture) {
        let canvas = ReactDOM.findDOMNode(this.refs.animView);
        if (!canvas || !baseTexture) return;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const x = frame.x || 0;
        const y = frame.y || 0;
        const w = frame.width || frame.frameWidth || 0;
        const h = frame.height || frame.frameHeight || 0;
        const fx = frame.frameX || 0;
        const fy = frame.frameY || 0;
        const fw = frame.frameWidth || w;
        const fh = frame.frameHeight || h;

        const offsetX = (canvas.width - fw) / 2 - fx;
        const offsetY = (canvas.height - fh) / 2 - fy;

        // Apply zoom
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this.state.zoom, this.state.zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        if (frame.rotated) {
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(
                baseTexture,
                x, y, h, w,
                -fh / 2, -fw / 2,
                fh, fw
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                baseTexture,
                x, y, w, h,
                offsetX, offsetY,
                fw, fh
            );
        }
        
        // Draw grid if enabled
        if (this.state.showGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    render() {
        const { 
            sparrowTextures, sparrowAnimations, selectedSparrowAnim, xmlError,
            animationMode, detectedAnimations, selectedSequence, isPlaying,
            currentFrame, playbackDirection, zoom, showGrid
        } = this.state;
        
        const hasAnimations = sparrowAnimations && Object.keys(sparrowAnimations).length > 0;
        const hasDetectedAnimations = detectedAnimations && Object.keys(detectedAnimations).length > 0;
        
        const currentAnimFrames = selectedSequence && detectedAnimations[selectedSequence] 
            ? detectedAnimations[selectedSequence].length 
            : 0;
        const currentAnimName = animationMode === 'sparrow' ? selectedSparrowAnim : selectedSequence;
        const currentAnimData = animationMode === 'sparrow' 
            ? (sparrowAnimations[selectedSparrowAnim] || [])
            : (detectedAnimations[selectedSequence] || []);

        return (
            <div ref="container" className="player-container">
                {/* Basic Sprite Player */}
                <div className="player-window border-color-gray">
                    <div ref="playerContainer">
                        <canvas ref="view"> </canvas>
                        <canvas ref="buffer" className="player-buffer"> </canvas>
                    </div>
                    <div>
                        <table>
                            <tbody>
                            <tr>
                                <td>
                                    {I18.f("ANIMATION_SPEED")}
                                </td>
                                <td>
                                    <input type="range" ref="speed" max="60" min="1" defaultValue="24" onChange={this.onSpeedChange}/>
                                </td>
                                <td>
                                    <div ref="fps" className="player-fps">24 fps</div>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Enhanced Animation Preview Section */}
                <div className="player-window border-color-gray" style={{ marginTop: '10px', padding: '15px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🎬</span> Animation Preview
                    </h4>
                    
                    {/* Mode Selector Tabs */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '4px', 
                        marginBottom: '12px',
                        background: '#1a1a2e',
                        padding: '4px',
                        borderRadius: '8px'
                    }}>
                        <button
                            onClick={() => this.setState({ animationMode: 'sparrow' })}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: animationMode === 'sparrow' ? '#6366f1' : 'transparent',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: animationMode === 'sparrow' ? 'bold' : 'normal'
                            }}
                        >
                            📄 Sparrow XML
                        </button>
                        <button
                            onClick={() => {
                                this.setState({ animationMode: 'texturepacker' });
                            }}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: animationMode === 'texturepacker' ? '#6366f1' : 'transparent',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: animationMode === 'texturepacker' ? 'bold' : 'normal'
                            }}
                        >
                            📋 TexturePacker JSON
                        </button>
                        <button
                            onClick={() => {
                                this.setState({ animationMode: 'sequence' });
                                this.detectAnimationsFromTextures();
                            }}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: animationMode === 'sequence' ? '#6366f1' : 'transparent',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: animationMode === 'sequence' ? 'bold' : 'normal'
                            }}
                        >
                            🔍 Auto-Detect
                        </button>
                    </div>
                    
                    {/* File Upload Section */}
                    <div style={{ marginBottom: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {animationMode === 'sparrow' && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <span style={{ 
                                    background: '#6366f1', 
                                    color: 'white', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px',
                                    fontSize: '12px'
                                }}>
                                    📁 Load Sparrow XML
                                </span>
                                <input 
                                    type="file" 
                                    accept=".xml" 
                                    onChange={this.loadSparrowXML}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        )}
                        {animationMode === 'texturepacker' && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <span style={{ 
                                    background: '#8b5cf6', 
                                    color: 'white', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px',
                                    fontSize: '12px'
                                }}>
                                    📁 Load TexturePacker JSON
                                </span>
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    onChange={this.loadTexturePackerJSON}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        )}
                        {animationMode === 'sequence' && (
                            <div style={{ 
                                background: '#22c55e22',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#86efac'
                            }}>
                                ✨ Animations auto-detected from texture names
                            </div>
                        )}
                    </div>

                    {xmlError && (
                        <div style={{ 
                            background: '#7f1d1d', 
                            padding: '8px', 
                            borderRadius: '6px', 
                            marginBottom: '10px',
                            fontSize: '12px',
                            color: '#fca5a5'
                        }}>
                            ⚠️ {xmlError}
                        </div>
                    )}

                    {/* Animation Canvas */}
                    <div style={{ 
                        background: '#1a1a2e', 
                        borderRadius: '8px', 
                        padding: '10px',
                        marginBottom: '12px',
                        position: 'relative'
                    }}>
                        {/* Frame Counter Overlay */}
                        {currentAnimFrames > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'rgba(0,0,0,0.7)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                zIndex: 10
                            }}>
                                {currentFrame + 1} / {currentAnimFrames}
                            </div>
                        )}
                        
                        {animationMode === 'sparrow' || animationMode === 'texturepacker' ? (
                            <canvas 
                                ref="animView" 
                                style={{ 
                                    display: 'block',
                                    margin: '0 auto',
                                    background: '#0a0a15',
                                    border: '1px solid #333',
                                    borderRadius: '4px'
                                }}
                            />
                        ) : (
                            <canvas 
                                ref="seqView" 
                                style={{ 
                                    display: 'block',
                                    margin: '0 auto',
                                    background: '#0a0a15',
                                    border: '1px solid #333',
                                    borderRadius: '4px'
                                }}
                            />
                        )}
                    </div>

                    {/* Animation Controls - Combined for all modes */}
                    {(hasAnimations || hasDetectedAnimations) && (
                        <div>
                            {/* Animation Selector */}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'block' }}>
                                    Animation:
                                </label>
                                <select 
                                    value={currentAnimName || ''}
                                    onChange={(e) => {
                                        if (animationMode === 'sparrow' || animationMode === 'texturepacker') {
                                            this.selectAnimation(e.target.value);
                                        } else {
                                            this.selectSequence(e.target.value);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        background: '#2a2a3a',
                                        color: 'white',
                                        border: '1px solid #444',
                                        fontSize: '13px'
                                    }}
                                >
                                    <option value="">-- Select Animation --</option>
                                    {(animationMode === 'sparrow' || animationMode === 'texturepacker' 
                                        ? Object.keys(sparrowAnimations) 
                                        : Object.keys(detectedAnimations)
                                    ).map(name => (
                                        <option key={name} value={name}>
                                            {name} ({animationMode === 'sparrow' || animationMode === 'texturepacker' 
                                                ? sparrowAnimations[name].length 
                                                : detectedAnimations[name].length} frames)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Playback Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <button
                                    onClick={() => {
                                        if (animationMode === 'sparrow' || animationMode === 'texturepacker') {
                                            this.stopAnimation();
                                            this.playAnimation();
                                        } else {
                                            this.stopSequence();
                                            this.playSequence();
                                        }
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#22c55e',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {isPlaying ? '▶ Playing...' : '▶ Play'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (animationMode === 'sparrow' || animationMode === 'texturepacker') {
                                            this.stopAnimation();
                                        } else {
                                            this.stopSequence();
                                        }
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ⏹ Stop
                                </button>
                                
                                {/* Speed Control */}
                                <div style={{ flex: 1 }}>
                                    <input 
                                        type="range" 
                                        ref={animationMode === 'sequence' ? "seqSpeed" : "animSpeed"} 
                                        max="60" 
                                        min="1" 
                                        defaultValue="12" 
                                        onChange={animationMode === 'sequence' ? this.onSequenceSpeedChange : this.onAnimationSpeedChange}
                                        style={{ width: '100%' }}
                                    />
                                    <div 
                                        ref={animationMode === 'sequence' ? "seqFps" : "animFps"} 
                                        style={{ fontSize: '11px', textAlign: 'center', color: '#888' }}
                                    >
                                        12 fps
                                    </div>
                                </div>
                            </div>
                            
                            {/* Direction Controls */}
                            <div style={{ 
                                display: 'flex', 
                                gap: '4px', 
                                marginBottom: '10px',
                                background: '#1a1a2e',
                                padding: '4px',
                                borderRadius: '6px'
                            }}>
                                <button
                                    onClick={() => this.setPlaybackDirection('forward')}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: playbackDirection === 'forward' ? '#3b82f6' : 'transparent',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    ▶ Forward
                                </button>
                                <button
                                    onClick={() => this.setPlaybackDirection('reverse')}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: playbackDirection === 'reverse' ? '#3b82f6' : 'transparent',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    ◀ Reverse
                                </button>
                                <button
                                    onClick={() => this.setPlaybackDirection('pingpong')}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        background: playbackDirection === 'pingpong' ? '#3b82f6' : 'transparent',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    ↔ Ping-Pong
                                </button>
                            </div>
                            
                            {/* Zoom and Grid Controls */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>
                                        Zoom: {zoom}x
                                    </label>
                                    <input 
                                        type="range" 
                                        min="0.25" 
                                        max="4" 
                                        step="0.25"
                                        value={zoom}
                                        onChange={(e) => this.setZoom(parseFloat(e.target.value))}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <button
                                    onClick={this.toggleGrid}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: showGrid ? '2px solid #22c55e' : '1px solid #444',
                                        background: showGrid ? '#22c55e33' : '#2a2a3a',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    {showGrid ? '☑' : '☐'} Grid
                                </button>
                            </div>

                            {/* Visual Timeline */}
                            {currentAnimData.length > 0 && (
                                <div style={{ 
                                    background: '#2a2a3a', 
                                    padding: '10px', 
                                    borderRadius: '6px',
                                    marginTop: '10px'
                                }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                                        Frame Timeline (click to jump)
                                    </div>
                                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                        {currentAnimData.map((frame, i) => (
                                            <div 
                                                key={i}
                                                onClick={() => {
                                                    if (animationMode === 'sparrow' || animationMode === 'texturepacker') {
                                                        // For Sparrow/texturepacker, just highlight
                                                        this.setState({ currentFrame: i });
                                                    } else {
                                                        this.goToFrame(i);
                                                    }
                                                }}
                                                style={{
                                                    background: currentFrame === i ? '#6366f1' : '#3a3a4a',
                                                    padding: '6px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    cursor: 'pointer',
                                                    border: currentFrame === i ? '2px solid #a5b4fc' : '1px solid transparent',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={frame.name || `Frame ${i + 1}`}
                                            >
                                                {i + 1}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* No animations message */}
                    {!hasAnimations && !hasDetectedAnimations && (
                        <div style={{ 
                            textAlign: 'center', 
                            color: '#666', 
                            padding: '30px',
                            fontSize: '13px'
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🎞️</div>
                            <div>
                                {animationMode === 'sequence' 
                                    ? 'Select textures in the main view to auto-detect animations'
                                    : 'Load a Sparrow XML or TexturePacker JSON file to preview animations'
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

}

export default SpritesPlayer;