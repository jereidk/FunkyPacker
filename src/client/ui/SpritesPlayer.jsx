import React from 'react';
import ReactDOM from 'react-dom';
import {GLOBAL_EVENT, Observer} from "../Observer";
import {cleanPrefix, smartSortImages} from '../utils/common';
import sparrowStore from '../store/sparrowStore';

class SpritesPlayer extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            currentFrame: 0,
            isPlaying: false,
            zoom: 1,
            fps: 12,
            backgroundColor: '#1a1a2e',
            showGrid: false,
            playbackDirection: 'forward'
        };

        this.textures = [];
        this.currentTextures = [];
        this.currentFrame = 0;
        this.width = 0;
        this.height = 0;
        this.updateTimer = null;
        this.selectedImages = [];
        this.animationTimer = null;

        this.update = this.update.bind(this);
        this.updateCurrentTextures = this.updateCurrentTextures.bind(this);
        this.playAnimation = this.playAnimation.bind(this);
        this.stopAnimation = this.stopAnimation.bind(this);
        this.setZoom = this.setZoom.bind(this);

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
            if (this.state.playbackDirection === 'forward') {
                this.currentFrame++;
                if(this.currentFrame >= this.currentTextures.length) {
                    this.currentFrame = 0;
                }
            } else {
                this.currentFrame--;
                if(this.currentFrame < 0) {
                    this.currentFrame = this.currentTextures.length - 1;
                }
            }
        }
        this.renderTexture();

        this.updateTimer = setTimeout(this.update, 1000 / this.state.fps);
    }

    renderTexture() {
        let ctx = ReactDOM.findDOMNode(this.refs.view).getContext("2d");

        // Clear with background color
        ctx.fillStyle = this.state.backgroundColor;
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw grid if enabled
        if (this.state.showGrid) {
            this.drawGrid(ctx);
        }

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

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buffer, 0, 0);

        if(this.currentTextures.length > 1) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.font = "bold 12px Arial";
            ctx.fillText(`${this.currentFrame + 1}/${this.currentTextures.length}`, 5, 15);
        }
    }

    drawGrid(ctx) {
        const gridSize = 16;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= this.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
    }

    stop() {
        clearTimeout(this.updateTimer);
        this.updateTimer = null;
    }

    playAnimation() {
        if(this.animationTimer) return;

        this.animationTimer = setInterval(() => {
            if(!this.currentTextures.length) return;

            let nextFrame;
            if (this.state.playbackDirection === 'forward') {
                nextFrame = (this.state.currentFrame + 1) % this.currentTextures.length;
            } else {
                nextFrame = (this.state.currentFrame - 1 + this.currentTextures.length) % this.currentTextures.length;
            }

            this.setState({ currentFrame: nextFrame });
            this.renderTexture();
        }, 1000 / this.state.fps);
    }

    stopAnimation() {
        if(this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
    }

    setZoom(val) {
        this.setState({ zoom: val });
        let canvas = ReactDOM.findDOMNode(this.refs.view);
        canvas.style.transform = `scale(${val})`;
        canvas.style.transformOrigin = 'top left';
    }

    onFpsChange(e) {
        const newFps = parseInt(e.target.value) || 12;
        this.setState({ fps: newFps });
        if (this.animationTimer) {
            this.stopAnimation();
            this.playAnimation();
        }
    }

    onBackgroundColorChange(e) {
        const color = e.target.value;
        this.setState({ backgroundColor: color });
        this.renderTexture();
    }

    toggleGrid() {
        this.setState(prev => ({ showGrid: !prev.showGrid }));
        this.renderTexture();
    }

    toggleDirection() {
        this.setState(prev => ({ 
            playbackDirection: prev.playbackDirection === 'forward' ? 'reverse' : 'forward' 
        }));
    }

    goToFirstFrame() {
        this.setState({ currentFrame: 0 });
        this.currentFrame = 0;
        this.renderTexture();
    }

    goToLastFrame() {
        const lastFrame = this.currentTextures.length - 1;
        this.setState({ currentFrame: lastFrame });
        this.currentFrame = lastFrame;
        this.renderTexture();
    }

    nextFrame() {
        const next = (this.state.currentFrame + 1) % this.currentTextures.length;
        this.setState({ currentFrame: next });
        this.currentFrame = next;
        this.renderTexture();
    }

    prevFrame() {
        const prev = (this.state.currentFrame - 1 + this.currentTextures.length) % this.currentTextures.length;
        this.setState({ currentFrame: prev });
        this.currentFrame = prev;
        this.renderTexture();
    }

    render() {
        const { currentFrame, isPlaying, zoom, fps, backgroundColor, showGrid, playbackDirection } = this.state;
        
        return (
            <div className="player-view-container" ref="playerContainer">
                <div style={{ 
                    display: 'flex', 
                    height: '100%',
                    background: 'var(--bg-primary)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        padding: '10px'
                    }}>
                        <div style={{ 
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'auto',
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            minHeight: '200px',
                            padding: '10px'
                        }}>
                            <div style={{
                                position: 'relative',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}>
                                <canvas ref='view' style={{
                                    imageRendering: 'pixelated',
                                    display: 'block'
                                }}/>
                                <canvas ref='buffer' style={{ display: 'none' }}/>
                            </div>
                        </div>

                        <div style={{ 
                            padding: '12px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            marginTop: '8px'
                        }}>
                            {/* Playback Controls */}
                            <button
                                onClick={this.goToFirstFrame}
                                title="Go to first frame"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                ⏮
                            </button>
                            
                            <button
                                onClick={this.prevFrame}
                                title="Previous frame"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                ◀
                            </button>

                            <button
                                onClick={() => {
                                    if (this.animationTimer) {
                                        this.stopAnimation();
                                    } else {
                                        this.playAnimation();
                                    }
                                    this.setState(prev => ({ isPlaying: !prev.isPlaying }));
                                }}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: isPlaying ? '#ef4444' : '#22c55e',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '13px'
                                }}
                            >
                                {isPlaying ? '⏹ Stop' : '▶ Play'}
                            </button>

                            <button
                                onClick={this.nextFrame}
                                title="Next frame"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                ▶
                            </button>

                            <button
                                onClick={this.goToLastFrame}
                                title="Go to last frame"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                ⏭
                            </button>

                            <button
                                onClick={this.toggleDirection}
                                title="Toggle playback direction"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: playbackDirection === 'reverse' ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                {playbackDirection === 'forward' ? '→' : '←'}
                            </button>

                            {/* Divider */}
                            <div style={{width: '1px', height: '24px', background: 'var(--border-color)'}} />

                            {/* FPS Control */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>FPS:</label>
                                <input
                                    type="number"
                                    value={fps}
                                    onChange={this.onFpsChange}
                                    min="1"
                                    max="120"
                                    style={{
                                        width: '55px',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>

                            {/* Frame Counter */}
                            <div style={{ 
                                color: 'var(--text-primary)', 
                                fontSize: '12px',
                                fontWeight: 'bold',
                                background: 'var(--bg-tertiary)',
                                padding: '4px 10px',
                                borderRadius: '4px'
                            }}>
                                {currentFrame + 1} / {this.currentTextures.length}
                            </div>

                            {/* Divider */}
                            <div style={{width: '1px', height: '24px', background: 'var(--border-color)'}} />

                            {/* Background Color Picker */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>BG:</label>
                                <input
                                    type="color"
                                    value={backgroundColor}
                                    onChange={(e) => this.onBackgroundColorChange(e)}
                                    title="Background color"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        padding: '0',
                                        border: '2px solid var(--border-color)',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        background: 'transparent'
                                    }}
                                />
                            </div>

                            {/* Grid Toggle */}
                            <button
                                onClick={this.toggleGrid}
                                title="Toggle grid"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: showGrid ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                }}
                            >
                                # Grid
                            </button>

                            {/* Spacer */}
                            <div style={{ flex: 1 }} />

                            {/* Zoom Control */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Zoom:</label>
                                <input
                                    type="range"
                                    min="0.25"
                                    max="4"
                                    step="0.25"
                                    value={zoom}
                                    onChange={(e) => this.setZoom(parseFloat(e.target.value))}
                                    style={{ width: '80px' }}
                                />
                                <span style={{ color: 'var(--accent-color)', fontSize: '11px', minWidth: '35px' }}>{zoom}x</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ 
                        width: '220px',
                        background: 'var(--bg-secondary)',
                        borderLeft: '1px solid var(--border-color)',
                        padding: '10px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ 
                            color: 'var(--text-secondary)', 
                            fontSize: '11px',
                            marginBottom: '8px',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '6px'
                        }}>
                            📁 {this.currentTextures.length} sprites selected
                        </div>

                        <div style={{ fontSize: '11px' }}>
                            {this.currentTextures.slice(0, 50).map((tex, i) => (
                                <div 
                                    key={i}
                                    style={{
                                        padding: '4px 6px',
                                        background: currentFrame === i ? 'rgba(74, 158, 255, 0.2)' : 'transparent',
                                        borderRadius: '4px',
                                        marginBottom: '2px',
                                        cursor: 'pointer',
                                        borderLeft: currentFrame === i ? '2px solid var(--accent-color)' : '2px solid transparent',
                                        color: currentFrame === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => {
                                        this.setState({ currentFrame: i });
                                        this.currentFrame = i;
                                        this.renderTexture();
                                    }}
                                >
                                    {tex.name}
                                </div>
                            ))}
                            {this.currentTextures.length > 50 && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '8px', opacity: 0.6 }}>
                                    ... and {this.currentTextures.length - 50} more
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default SpritesPlayer;
