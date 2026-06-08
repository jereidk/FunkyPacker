import React from 'react';
import ReactDOM from 'react-dom';
import I18 from '../utils/I18';
import {GLOBAL_EVENT, Observer} from "../Observer";
import {cleanPrefix, smartSortImages} from '../utils/common';

class SpritesPlayer extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            sparrowTextures: [],
            sparrowAnimations: {},
            selectedSparrowAnim: null,
            xmlError: null
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
        this.currentAnimationFrame = 0;
        this.animationTimer = null;

        this.update = this.update.bind(this);
        this.forceUpdate = this.forceUpdate.bind(this);
        this.updateCurrentTextures = this.updateCurrentTextures.bind(this);
        this.onSpeedChange = this.onSpeedChange.bind(this);
        this.onAnimationSpeedChange = this.onAnimationSpeedChange.bind(this);
        this.loadSparrowXML = this.loadSparrowXML.bind(this);
        this.selectAnimation = this.selectAnimation.bind(this);
        this.playAnimation = this.playAnimation.bind(this);
        this.stopAnimation = this.stopAnimation.bind(this);

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
    }

    setup() {
        ReactDOM.findDOMNode(this.refs.playerContainer).className = "player-view-container " + this.props.textureBack;

        this.textures = [];

        if(!this.props.data) return;

        this.width = 0;
        this.height = 0;

        if(window.sparrowMaxMap == undefined) {
            window.sparrowMaxMap = {};
        }

        for(let part of this.props.data) {
            let baseTexture = part.buffer;

            for (let config of part.data) {
                var w = config.sourceSize.w;
                var h = config.sourceSize.h;

                var prefix = cleanPrefix(config.originalFile || config.file || config.name);

                if(window.sparrowMaxMap.hasOwnProperty(prefix)) {
                    var maxMap = window.sparrowMaxMap[prefix];

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

        if(window.sparrowMaxMap == undefined) {
            window.sparrowMaxMap = {};
        }

        if(window.sparrowMaxMap.hasOwnProperty(prefix)) {
            var maxMap = window.sparrowMaxMap[prefix];

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
        
        // Parse Animations (custom format in description or detect from names)
        // Group textures by prefix pattern to detect animations
        const groups = {};
        for (let tex of textures) {
            // Try to extract animation name and frame number
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

    // Load Sparrow XML file
    async loadSparrowXML(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            
            // Try to find associated PNG with same name
            const pngName = file.name.replace('.xml', '.png');
            let baseTexture = this.props.data?.[0]?.buffer;
            
            // If we have textures loaded, try to use one as base
            if (!baseTexture && this.currentTextures.length > 0) {
                baseTexture = this.currentTextures[0].baseTexture;
            }

            const result = this.parseSparrowXML(text, baseTexture);
            
            this.setState({
                sparrowTextures: result.textures,
                sparrowAnimations: result.anims,
                sparrowBaseTexture: result.baseTexture,
                selectedSparrowAnim: null
            });

            // Auto-select first animation if available
            const animNames = Object.keys(result.anims);
            if (animNames.length > 0) {
                this.selectAnimation(animNames[0]);
            }
        } catch (err) {
            console.error('Error loading Sparrow XML:', err);
            this.setState({ xmlError: 'Failed to parse XML file' });
        }
    }

    selectAnimation(animName) {
        const { sparrowAnimations } = this.state;
        if (!sparrowAnimations || !sparrowAnimations[animName]) return;

        this.setState({ selectedSparrowAnim: animName });
        this.stopAnimation();
        
        // Set canvas size based on animation frame
        const frames = sparrowAnimations[animName];
        const maxW = Math.max(...frames.map(f => f.frameWidth || f.width));
        const maxH = Math.max(...frames.map(f => f.frameHeight || f.height));
        
        let canvas = ReactDOM.findDOMNode(this.refs.animView);
        if (canvas) {
            canvas.width = Math.max(maxW, 256);
            canvas.height = Math.max(maxH, 256);
        }
        
        // Auto-play
        this.playAnimation();
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
    }

    render() {
        const { sparrowTextures, sparrowAnimations, selectedSparrowAnim, xmlError } = this.state;
        const hasAnimations = sparrowAnimations && Object.keys(sparrowAnimations).length > 0;

        return (
            <div ref="container" className="player-container">
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

                {/* Animation Preview Section - Enhanced */}
                <div className="player-window border-color-gray" style={{ marginTop: '10px', padding: '10px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#6366f1' }}>🎬 Animation Preview</h4>
                    
                    {/* XML Upload */}
                    <div style={{ marginBottom: '10px' }}>
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
                        <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>
                            Load .xml + ensure .png is in textures
                        </span>
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
                            {xmlError}
                        </div>
                    )}

                    {/* Animation Canvas */}
                    <div style={{ 
                        background: '#1a1a2e', 
                        borderRadius: '8px', 
                        padding: '10px',
                        marginBottom: '10px'
                    }}>
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
                    </div>

                    {/* Animation Controls */}
                    {hasAnimations && (
                        <div>
                            <div style={{ marginBottom: '8px' }}>
                                <label style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'block' }}>
                                    Animation:
                                </label>
                                <select 
                                    value={selectedSparrowAnim || ''}
                                    onChange={(e) => this.selectAnimation(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        background: '#2a2a3a',
                                        color: 'white',
                                        border: '1px solid #444'
                                    }}
                                >
                                    <option value="">-- Select Animation --</option>
                                    {Object.keys(sparrowAnimations).map(name => (
                                        <option key={name} value={name}>
                                            {name} ({sparrowAnimations[name].length} frames)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <button
                                    onClick={() => this.playAnimation()}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#22c55e',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    ▶ Play
                                </button>
                                <button
                                    onClick={() => this.stopAnimation()}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    ⏹ Stop
                                </button>
                                <div style={{ flex: 1 }}>
                                    <input 
                                        type="range" 
                                        ref="animSpeed" 
                                        max="60" 
                                        min="1" 
                                        defaultValue="12" 
                                        onChange={this.onAnimationSpeedChange}
                                        style={{ width: '100%' }}
                                    />
                                    <div ref="animFps" style={{ fontSize: '11px', textAlign: 'center', color: '#888' }}>12 fps</div>
                                </div>
                            </div>

                            {/* Animation Info */}
                            {selectedSparrowAnim && sparrowAnimations[selectedSparrowAnim] && (
                                <div style={{ 
                                    background: '#2a2a3a', 
                                    padding: '8px', 
                                    borderRadius: '6px',
                                    fontSize: '11px'
                                }}>
                                    <div style={{ color: '#888', marginBottom: '4px' }}>Frames:</div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {sparrowAnimations[selectedSparrowAnim].map((frame, i) => (
                                            <div 
                                                key={i}
                                                style={{
                                                    background: '#3a3a4a',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px'
                                                }}
                                                title={`${frame.name}`}
                                            >
                                                {i + 1}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* No animations loaded message */}
                    {!hasAnimations && (
                        <div style={{ 
                            textAlign: 'center', 
                            color: '#666', 
                            padding: '20px',
                            fontSize: '12px'
                        }}>
                            Load a Sparrow XML file to preview animations
                        </div>
                    )}
                </div>
            </div>
        )
    }

}

export default SpritesPlayer;