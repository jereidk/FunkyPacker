import React from 'react';
import { formatBytes } from '../utils/format';

class AtlasStatsHeader extends React.Component {
    constructor(props) {
        super(props);
        
        this.sizeElementRef = React.createRef();
        this.ramElementRef = React.createRef();
        this.observer = null;
        
        this.updateStats = this.updateStats.bind(this);
    }

    componentDidMount() {
        const config = { attributes: true, childList: true, subtree: true };
        this.observer = new MutationObserver(this.updateStats);
        
        const resultsView = document.getElementsByClassName("results-view")[0];
        if (resultsView) {
            this.observer.observe(resultsView, config);
        }
        
        // Initial update
        this.updateStats();
    }

    componentWillUnmount() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    updateStats() {
        if (!this.sizeElementRef.current || !this.ramElementRef.current) return;
        
        const sizes = [...document.getElementsByClassName("texture-view")].map(
            (v) => `${v.children[0].width}x${v.children[0].height}`
        );
        
        let ramTotal = 0;
        [...document.getElementsByClassName("texture-view")].forEach((v) => {
            ramTotal += parseInt(v.children[0].width, 10) * parseInt(v.children[0].height, 10) * 4;
        });
        
        const sizeText = sizes.join(" + ");
        this.sizeElementRef.current.textContent = sizeText;
        this.sizeElementRef.current.style.fontSize = sizeText.length > 60 ? "20px" : "14px";
        
        this.ramElementRef.current.textContent = formatBytes(ramTotal, 3) + " | " + formatBytes(ramTotal, 3, 1000);
    }

    render() {
        return (
            <div className="atlas-stats-header" style={{ position: 'relative' }}>
                <div 
                    ref={this.sizeElementRef}
                    style={{ fontSize: '20px', pointerEvents: 'none' }}
                >
                    0x0
                </div>
                <div 
                    ref={this.ramElementRef}
                    style={{ fontSize: '16px', position: 'relative', top: '-90px', pointerEvents: 'none' }}
                >
                    0 Bytes
                </div>
            </div>
        );
    }
}

export default AtlasStatsHeader;