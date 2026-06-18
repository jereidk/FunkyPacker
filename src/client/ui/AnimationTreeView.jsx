/**
 * AnimationTreeView - Visual tree view of Animation.json contents
 * 
 * Shows the hierarchy of an Adobe Animate BetterTA Animation.json:
 * - Root Timeline (AN) with layers and frames
 * - Symbol Dictionary (SD) with symbols and usage counts
 * - Referenced Sprites with atlas presence status
 * 
 * Uses data already indexed by AnimationLinker - no new parsing needed.
 */

import React from 'react';
import { getAnimationLinker } from '../utils/AnimationLinker';
import I18 from '../utils/I18';

class AnimationTreeView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            expanded: {
                root: true,
                symbols: true,
                sprites: false
            }
        };
    }

    toggleSection(key) {
        this.setState(prev => ({
            expanded: {
                ...prev.expanded,
                [key]: !prev.expanded[key]
            }
        }));
    }

    getAnimationInfo() {
        let animLinker = getAnimationLinker();
        if (!animLinker.isLoaded()) return null;
        
        let animData = animLinker.getAnimationData();
        let metadata = animLinker.getMetadata();
        
        // Extract root timeline info
        let rootTimeline = animData.AN ? {
            name: animData.AN.N || 'Animation',
            layers: animData.AN.TL?.L || []
        } : null;
        
        // Extract symbol dictionary info
        let symbolDict = animData.SD ? {
            symbols: animData.SD.S || []
        } : null;
        
        // Get reference counts
        let refSprites = animLinker.getReferencedSprites();
        let refSymbols = animLinker.getReferencedSymbols();
        let symbolRefCounts = animLinker.getSymbolReferenceCounts(); // Real counts!
        let validation = animLinker.validateExistence(this.props.frames || []);
        
        return {
            metadata,
            rootTimeline,
            symbolDict,
            refSprites,
            refSymbols,
            symbolRefCounts,  // Real occurrence counts per symbol
            validation,
            totalSprites: refSprites.length,
            totalSymbols: refSymbols.length,
            orphanedCount: validation.total
        };
    }

    renderHeader(info) {
        let version = info.metadata?.V || 'Unknown';
        let fps = info.metadata?.FRT || '?';
        let canvas = info.metadata?.W && info.metadata?.H 
            ? `${info.metadata.W}x${info.metadata.H}` 
            : '?';
        
        return (
            <div className="anim-tree-header">
                <span className="anim-tree-badge">📦 Animation.json</span>
                <span className="anim-tree-meta">BTA {version} • {fps}fps • {canvas}</span>
                {info.orphanedCount > 0 && (
                    <span className="anim-tree-warning">⚠️ {info.orphanedCount} orphaned</span>
                )}
            </div>
        );
    }

    renderRootTimeline(info) {
        if (!info.rootTimeline) return null;
        
        let { layers } = info.rootTimeline;
        let isExpanded = this.state.expanded.root;
        
        // Collect all frame labels from all layers
        let allFrames = [];
        for (let layer of layers) {
            if (layer.FR) {
                for (let frame of layer.FR) {
                    if (frame.N) {
                        allFrames.push({
                            layer: layer.LN || 'Unnamed',
                            name: frame.N,
                            index: frame.I,
                            duration: frame.DU
                        });
                    }
                }
            }
        }
        
        return (
            <div className="anim-tree-section">
                <div className="anim-tree-section-header" onClick={() => this.toggleSection('root')}>
                    <span className="anim-tree-toggle">{isExpanded ? '▼' : '▶'}</span>
                    <span className="anim-tree-icon">🎬</span>
                    <span className="anim-tree-title">Root Timeline ({info.rootTimeline.name})</span>
                    <span className="anim-tree-count">{allFrames.length} frames</span>
                </div>
                {isExpanded && (
                    <div className="anim-tree-content">
                        {allFrames.slice(0, 50).map((frame, i) => (
                            <div key={i} className="anim-tree-frame">
                                <span className="anim-tree-frame-name">• {frame.name}</span>
                                <span className="anim-tree-frame-meta">@{frame.index} (dur:{frame.duration})</span>
                            </div>
                        ))}
                        {allFrames.length > 50 && (
                            <div className="anim-tree-more">... and {allFrames.length - 50} more frames</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    renderSymbolDictionary(info) {
        if (!info.symbolDict) return null;
        
        let { symbols } = info.symbolDict;
        let isExpanded = this.state.expanded.symbols;
        
        // Track which symbols are used and their real occurrence counts
        let usedSymbols = new Set(info.refSymbols);
        let symbolRefCounts = info.symbolRefCounts; // Map<symbolName, count>
        
        return (
            <div className="anim-tree-section">
                <div className="anim-tree-section-header" onClick={() => this.toggleSection('symbols')}>
                    <span className="anim-tree-toggle">{isExpanded ? '▼' : '▶'}</span>
                    <span className="anim-tree-icon">🧩</span>
                    <span className="anim-tree-title">Symbol Dictionary</span>
                    <span className="anim-tree-count">{symbols.length} symbols</span>
                </div>
                {isExpanded && (
                    <div className="anim-tree-content">
                        {symbols.slice(0, 30).map((sym, i) => {
                            let isUsed = usedSymbols.has(sym.SN);
                            let refCount = symbolRefCounts.get(sym.SN) || 0;
                            return (
                                <div key={i} className={`anim-tree-symbol ${!isUsed ? 'unused' : ''}`}>
                                    <span className="anim-tree-symbol-name">• {sym.SN}</span>
                                    <span className={`anim-tree-symbol-usage ${isUsed ? 'used' : 'unused'}`}>
                                        {isUsed ? `✓ ${refCount}x` : '⚠ unused'}
                                    </span>
                                </div>
                            );
                        })}
                        {symbols.length > 30 && (
                            <div className="anim-tree-more">... and {symbols.length - 30} more symbols</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    renderSprites(info) {
        let { refSprites, validation, frames } = info;
        let isExpanded = this.state.expanded.sprites;
        
        // Build presence map
        let frameNames = new Set((frames || []).map(f => f.name || f.originalFile || ''));
        let orphanedSprites = validation.sprites.map(s => s.name);
        
        return (
            <div className="anim-tree-section">
                <div className="anim-tree-section-header" onClick={() => this.toggleSection('sprites')}>
                    <span className="anim-tree-toggle">{isExpanded ? '▼' : '▶'}</span>
                    <span className="anim-tree-icon">🖼️</span>
                    <span className="anim-tree-title">Referenced Sprites</span>
                    <span className="anim-tree-count">
                        {refSprites.length} sprites
                        {orphanedSprites.length > 0 && (
                            <span className="anim-tree-warning-inline"> ({orphanedSprites.length} missing)</span>
                        )}
                    </span>
                </div>
                {isExpanded && (
                    <div className="anim-tree-content">
                        {refSprites.slice(0, 50).map((name, i) => {
                            let isPresent = frameNames.has(name);
                            return (
                                <div key={i} className={`anim-tree-sprite ${!isPresent ? 'missing' : ''}`}>
                                    <span className="anim-tree-sprite-name">• {name}</span>
                                    <span className={`anim-tree-sprite-status ${isPresent ? 'present' : 'missing'}`}>
                                        {isPresent ? '✓' : '⚠ missing'}
                                    </span>
                                </div>
                            );
                        })}
                        {refSprites.length > 50 && (
                            <div className="anim-tree-more">... and {refSprites.length - 50} more sprites</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    render() {
        let animLinker = getAnimationLinker();
        if (!animLinker.isLoaded()) return null;
        
        let info = this.getAnimationInfo();
        if (!info) return null;
        
        return (
            <div className="anim-tree-container">
                {this.renderHeader(info)}
                {this.renderRootTimeline(info)}
                {this.renderSymbolDictionary(info)}
                {this.renderSprites(info)}
            </div>
        );
    }
}

export default AnimationTreeView;
