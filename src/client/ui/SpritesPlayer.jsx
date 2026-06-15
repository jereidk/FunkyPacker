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
            fps: 12
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
            this.currentFrame++;
            if(this.currentFrame >= this.currentTextures.length) {
                this.currentFrame = 0;
            }
        }
        this.renderTexture();

        this.updateTimer = setTimeout(this.update, 1000 / this.state.fps);
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
            ctx.fillStyle = "#fff";
            ctx.font = "12px Arial";
            ctx.fillText(`${this.currentFrame + 1}/${this.currentTextures.length}`, 5, 15);
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

            this.setState(prev => {
                let nextFrame = (prev.currentFrame + 1) % this.currentTextures.length;
                return { currentFrame: nextFrame };
            });

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
        this.setState({ fps: parseInt(e.target.value) || 12 });
        if (this.animationTimer) {
            this.stopAnimation();
            this.playAnimation();
        }
    }

    render() {
        const { currentFrame, isPlaying, zoom, fps } = this.state;
        
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
                            minHeight: '200px'
                        }}>
                            <canvas ref='view' style={{
                                imageRendering: 'pixelated',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '4px'
                            }}/>
                            <canvas ref='buffer' style={{ display: 'none' }}/>
                        </div>

                        <div style={{ 
                            padding: '10px',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            marginTop: '8px'
                        }}>
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
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: isPlaying ? '#ef4444' : '#22c55e',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {isPlaying ? '⏹ Stop' : '▶ Play'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>FPS:</label>
                                <input
                                    type="number"
                                    value={fps}
                                    onChange={this.onFpsChange}
                                    min="1"
                                    max="60"
                                    style={{
                                        width: '50px',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>

                            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                Frame: {currentFrame + 1} / {this.currentTextures.length}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
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
                        width: '200px',
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
                                        color: currentFrame === i ? 'var(--text-primary)' : 'var(--text-secondary)'
                                    }}
                                    onClick={() => {
                                        this.setState({ currentFrame: i });
                                        this.renderTexture();
                                    }}
                                >
                                    {tex.name}
                                </div>
                            ))}
                            {this.currentTextures.length > 50 && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '8px', opacity: 0.6 }}>
                                    ... y {this.currentTextures.length - 50} más
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
