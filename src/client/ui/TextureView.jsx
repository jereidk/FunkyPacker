import React from 'react';
import ReactDOM from 'react-dom';
import {Observer, GLOBAL_EVENT} from '../Observer';

class TextureView extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            scale: props.scale || 1,
            translateX: 0,
            translateY: 0,
            isDragging: false,
            lastTouchX: 0,
            lastTouchY: 0,
            initialDistance: 0,
            initialScale: 1
        };

        this.onViewClick = this.onViewClick.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.resetView = this.resetView.bind(this);
    }

    componentDidMount() {
        this.updateView();
        
        // Listen for reset zoom events (from Android Controller)
        window.addEventListener('resetZoom', this.resetView);
    }
    
    componentWillUnmount() {
        window.removeEventListener('resetZoom', this.resetView);
    }

    componentDidUpdate(prevProps) {
        // Update view when data changes
        if (prevProps.data !== this.props.data || prevProps.scale !== this.props.scale) {
            this.updateView();
        }
    }
    
    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    onTouchStart(e) {
        if (e.touches.length === 2) {
            // Start pinch zoom
            const distance = this.getDistance(e.touches[0], e.touches[1]);
            this.setState({
                initialDistance: distance,
                initialScale: this.state.scale
            });
            e.preventDefault();
        } else if (e.touches.length === 1) {
            // Start drag
            this.setState({
                isDragging: true,
                lastTouchX: e.touches[0].clientX,
                lastTouchY: e.touches[0].clientY
            });
        }
    }
    
    onTouchMove(e) {
        if (e.touches.length === 2) {
            // Pinch zoom
            const distance = this.getDistance(e.touches[0], e.touches[1]);
            const scaleChange = distance / this.state.initialDistance;
            let newScale = this.state.initialScale * scaleChange;
            
            // Clamp scale between 0.1 and 10
            newScale = Math.max(0.1, Math.min(10, newScale));
            
            this.setState({ scale: newScale });
            e.preventDefault();
        } else if (e.touches.length === 1 && this.state.isDragging) {
            // Pan
            const dx = e.touches[0].clientX - this.state.lastTouchX;
            const dy = e.touches[0].clientY - this.state.lastTouchY;
            
            this.setState(prev => ({
                translateX: prev.translateX + dx,
                translateY: prev.translateY + dy,
                lastTouchX: e.touches[0].clientX,
                lastTouchY: e.touches[0].clientY
            }));
            
            e.preventDefault();
        }
    }
    
    onTouchEnd(e) {
        if (e.touches.length < 2) {
            this.setState({
                isDragging: false
            });
        }
    }
    
    onWheel(e) {
        // Mouse wheel zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(10, this.state.scale * delta));
        
        this.setState({ scale: newScale });
        e.preventDefault();
    }
    
    resetView() {
        this.setState({
            scale: this.props.scale || 1,
            translateX: 0,
            translateY: 0
        });
        console.log('[TextureView] View reset');
    }

    updateView() {
        let view = ReactDOM.findDOMNode(this.refs.view);
        if(view) {
            view.width = this.props.data.buffer.width;
            view.height = this.props.data.buffer.height;

            // Use state scale for touch zoom, or props.scale for default
            const displayScale = this.state.scale || this.props.scale;
            
            view.style.width = Math.floor(view.width * displayScale) + "px";
            view.style.height = Math.floor(view.height * displayScale) + "px";
            
            // Apply transforms
            const container = ReactDOM.findDOMNode(this.refs.back);
            container.style.transform = `translate(${this.state.translateX}px, ${this.state.translateY}px)`;
            container.style.transformOrigin = 'center center';

            let ctx = view.getContext("2d");

            ctx.clearRect(0, 0, view.width, view.height);

            if(this.props.selectedImages.length) {
                ctx.globalAlpha = 0.35;
            }

            ctx.drawImage(this.props.data.buffer, 0, 0, view.width, view.height, 0, 0, view.width, view.height);

            if(this.props.displayOutline) {
                for (let item of this.props.data.data) {
                    if(!item.cloned) {
                        this.drawOutline(ctx, item);
                    }
                }
            }

            ctx.globalAlpha = 1;

            for (let item of this.props.data.data) {
                if(this.props.selectedImages.indexOf(item.file) >= 0 || this.props.selectedImages.indexOf(item.originalFile) >= 0) {
                    let frame = item.frame;

                    let w = frame.w, h = frame.h;
                    if(item.rotated) {
                        w = frame.h;
                        h = frame.w;
                    }

                    ctx.clearRect(frame.x, frame.y, w, h);
                    ctx.drawImage(this.props.data.buffer, frame.x, frame.y, w, h, frame.x, frame.y, w, h);

                    if(this.props.displayOutline) this.drawOutline(ctx, item);

                    ctx.beginPath();

                    if(ctx.setLineDash) ctx.setLineDash([4, 2]);
                    ctx.strokeStyle = "#000";
                    ctx.lineWidth = 1;
                    ctx.rect(frame.x, frame.y, w, h);

                    ctx.stroke();
                }
            }

            let back = ReactDOM.findDOMNode(this.refs.back);
            back.className = "texture-view " + this.props.textureBack;
        }
    }

    drawOutline(ctx, item) {
        let frame = item.frame;
        let w = frame.w, h = frame.h;
        if(item.rotated) {
            w = frame.h;
            h = frame.w;
        }

        ctx.strokeStyle = "#00F";
        ctx.fillStyle = "rgba(0,0,255,0.25)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.fillRect(frame.x, frame.y, w, h);
        ctx.rect(frame.x, frame.y, w, h);
        ctx.moveTo(frame.x, frame.y);
        ctx.lineTo(frame.x + w, frame.y + h);
        ctx.stroke();
    }

    onViewClick(e) {
        let selectedItem = null;

        let canvas = ReactDOM.findDOMNode(this.refs.view);
        let rect = canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left) / this.props.scale;
        let y = (e.clientY - rect.top) / this.props.scale;

        for (let item of this.props.data.data) {
            let w = item.frame.w;
            let h = item.frame.h;
            if(item.rotated) {
                w = item.frame.h;
                h = item.frame.w;
            }

            if(x >= item.frame.x &&
               x < item.frame.x + w &&
               y >= item.frame.y &&
               y < item.frame.y + h
            ) {
                selectedItem = item;
                break;
            }
        }

        if(selectedItem) {
            Observer.emit(GLOBAL_EVENT.IMAGE_ITEM_SELECTED, {
                isFolder: false,
                path: selectedItem.file,
                ctrlKey: e.ctrlKey || e.shiftKey,
                shiftKey: false
            });

            this.selectCloned(selectedItem);
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    selectCloned(selectedItem) {
        for (let item of this.props.data.data) {
            if(item.cloned && item.file === selectedItem.file) {
                Observer.emit(GLOBAL_EVENT.IMAGE_ITEM_SELECTED, {
                    isFolder: false,
                    path: item.originalFile,
                    ctrlKey: true,
                    shiftKey: false
                });
            }
        }
    }

    render() {
        return (
            <div 
                ref="back" 
                className="texture-view"
                onTouchStart={this.onTouchStart}
                onTouchMove={this.onTouchMove}
                onTouchEnd={this.onTouchEnd}
                onWheel={this.onWheel}
            >
                <canvas ref="view" onClick={this.onViewClick}> </canvas>
            </div>
        );
    }
}

export default TextureView;