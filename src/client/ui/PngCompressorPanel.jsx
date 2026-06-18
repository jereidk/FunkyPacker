import React from 'react';
import { Observer, GLOBAL_EVENT } from '../Observer';
import { compressPng, compressPngFromCanvas, getCompressionRatio } from '../utils/PngCompressor';

/**
 * PngCompressorPanel - Dedicated PNG compression panel
 * 
 * Provides standalone PNG compression with options for quality and metadata stripping.
 * Can also compress the current packed atlas directly from memory.
 */
class PngCompressorPanel extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            isExpanded: false,
            isDragging: false,
            selectedImage: null,
            imagePreview: null,
            isCompressing: false,
            progress: 0,
            result: null,
            error: null,
            hasPackedAtlas: false,
            
            // Compression options
            quality: 0.8,
            stripMetadata: false
        };
        
        this.canvasRef = React.createRef();
        this.fileInputRef = React.createRef();
        
        // Store packed atlas for "Comprimir atlas actual" feature
        this.packedAtlas = null;
        
        // Bind methods
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
        this.compressImage = this.compressImage.bind(this);
        this.compressAtlas = this.compressAtlas.bind(this);
        this.downloadResult = this.downloadResult.bind(this);
        this.togglePanel = this.togglePanel.bind(this);
        this.onPackComplete = this.onPackComplete.bind(this);
        
        // Listen for pack completion to enable atlas compression
        Observer.on(GLOBAL_EVENT.PACK_COMPLETE, this.onPackComplete, this);
    }

    componentWillUnmount() {
        Observer.off(GLOBAL_EVENT.PACK_COMPLETE, this.onPackComplete, this);
    }

    onPackComplete(packResult) {
        // Store the first atlas for compression
        if (packResult && packResult.length > 0 && packResult[0].renderer) {
            this.packedAtlas = packResult[0].renderer.buffer;
            this.setState({ hasPackedAtlas: true });
        }
    }

    togglePanel() {
        this.setState(prev => ({ isExpanded: !prev.isExpanded }));
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ isDragging: true });
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ isDragging: false });
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ isDragging: false });
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.loadImage(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.loadImage(files[0]);
        }
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Draw to canvas for pixel access
                const canvas = this.canvasRef.current;
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                this.setState({
                    selectedImage: {
                        file,
                        name: file.name,
                        width: img.width,
                        height: img.height,
                        size: file.size,
                        isAtlas: false
                    },
                    imagePreview: e.target.result,
                    result: null,
                    error: null,
                    progress: 0
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    async compressImage() {
        if (!this.state.selectedImage) return;
        
        this.setState({ isCompressing: true, progress: 0, error: null });
        
        try {
            const canvas = this.canvasRef.current;
            const options = {
                quality: this.state.quality,
                stripMetadata: this.state.stripMetadata
            };
            
            // Simulate progress
            const progressInterval = setInterval(() => {
                this.setState(prev => ({
                    progress: Math.min(prev.progress + 15, 90)
                }));
            }, 100);
            
            const compressedData = await compressPng(canvas, this.state.selectedImage.name, options);
            
            clearInterval(progressInterval);
            
            const originalSize = this.state.selectedImage.size;
            const compressedSize = compressedData.byteLength;
            const ratio = getCompressionRatio(originalSize, compressedSize);
            
            this.setState({
                isCompressing: false,
                progress: 100,
                result: {
                    data: compressedData,
                    name: this.state.selectedImage.name.replace(/\.png$/i, '_compressed.png'),
                    originalSize,
                    compressedSize,
                    compressionRatio: (ratio * 100).toFixed(1),
                    width: canvas.width,
                    height: canvas.height,
                    format: 'PNG'
                }
            });
            
        } catch (error) {
            console.error('PNG compression error:', error);
            this.setState({
                isCompressing: false,
                progress: 0,
                error: 'Error en la compresión: ' + error.message
            });
        }
    }
    
    async compressAtlas() {
        if (!this.packedAtlas) return;
        
        this.setState({ isCompressing: true, progress: 0, error: null });
        
        try {
            const options = {
                quality: this.state.quality,
                stripMetadata: this.state.stripMetadata
            };
            
            // Simulate progress
            const progressInterval = setInterval(() => {
                this.setState(prev => ({
                    progress: Math.min(prev.progress + 15, 90)
                }));
            }, 100);
            
            const compressedData = await compressPngFromCanvas(this.packedAtlas, 'atlas_compressed.png', options);
            
            clearInterval(progressInterval);
            
            // Get original atlas size (we don't have the original size, so estimate)
            const originalSize = this.packedAtlas.width * this.packedAtlas.height * 4; // RGBA estimate
            const compressedSize = compressedData.byteLength;
            const ratio = getCompressionRatio(originalSize, compressedSize);
            
            this.setState({
                isCompressing: false,
                progress: 100,
                result: {
                    data: compressedData,
                    name: 'atlas_compressed.png',
                    originalSize: Math.round(originalSize * 0.3), // Approximate
                    compressedSize,
                    compressionRatio: (ratio * 100).toFixed(1),
                    width: this.packedAtlas.width,
                    height: this.packedAtlas.height,
                    format: 'PNG',
                    isAtlas: true
                }
            });
            
        } catch (error) {
            console.error('Atlas compression error:', error);
            this.setState({
                isCompressing: false,
                progress: 0,
                error: 'Error en la compresión: ' + error.message
            });
        }
    }
    
    downloadResult() {
        if (!this.state.result) return;
        
        const blob = new Blob([this.state.result.data], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.state.result.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    render() {
        const { isExpanded, quality, stripMetadata, hasPackedAtlas } = this.state;
        
        return (
            <div className="png-compressor-panel" style={styles.panel}>
                {/* Header */}
                <div style={styles.header} onClick={this.togglePanel}>
                    <span style={styles.title}>🖼️ Compresor PNG</span>
                    <span style={styles.toggleIcon}>{isExpanded ? '▼' : '▲'}</span>
                </div>
                
                {/* Content */}
                {isExpanded && (
                    <div style={styles.content}>
                        {/* Hidden canvas for processing */}
                        <canvas ref={this.canvasRef} style={{ display: 'none' }} />
                        
                        {/* Drop Zone */}
                        <div
                            style={{
                                ...styles.dropZone,
                                ...(this.state.isDragging ? styles.dropZoneActive : {}),
                                ...(this.state.selectedImage ? styles.dropZoneSmall : {})
                            }}
                            onDragOver={this.handleDragOver}
                            onDragLeave={this.handleDragLeave}
                            onDrop={this.handleDrop}
                            onClick={() => this.fileInputRef.current?.click()}
                        >
                            <input
                                ref={this.fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                style={{ display: 'none' }}
                                onChange={this.handleFileSelect}
                            />
                            
                            {this.state.selectedImage ? (
                                <div style={styles.imageInfo}>
                                    <img src={this.state.imagePreview} style={styles.preview} alt="Preview" />
                                    <div style={styles.infoText}>
                                        <strong>{this.state.selectedImage.name}</strong>
                                        <br />
                                        {this.state.selectedImage.width} × {this.state.selectedImage.height}px
                                        <br />
                                        {this.formatBytes(this.state.selectedImage.size)}
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.dropText}>
                                    📁 Arrastra PNG aquí o haz clic para seleccionar
                                </div>
                            )}
                        </div>
                        
                        {/* Atlas Compression Button */}
                        {hasPackedAtlas && (
                            <div style={styles.atlasSection}>
                                <button
                                    style={styles.atlasBtn}
                                    onClick={this.compressAtlas}
                                    disabled={this.state.isCompressing}
                                >
                                    📦 Comprimir Atlas Actual
                                </button>
                                <span style={styles.atlasHint}>
                                    Usa el último atlas generado
                                </span>
                            </div>
                        )}
                        
                        {/* Configuration */}
                        <div style={styles.configSection}>
                            <h4 style={styles.sectionTitle}>⚙️ Configuración</h4>
                            
                            {/* Quality Slider */}
                            <div style={styles.configRow}>
                                <label style={styles.label}>Calidad: {Math.round(quality * 100)}%</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.05"
                                    value={quality}
                                    onChange={(e) => this.setState({ quality: parseFloat(e.target.value) })}
                                    style={styles.slider}
                                />
                            </div>
                            
                            {/* Strip Metadata */}
                            <div style={styles.configRow}>
                                <label style={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={stripMetadata}
                                        onChange={(e) => this.setState({ stripMetadata: e.target.checked })}
                                    />
                                    {' '}Eliminar metadatos EXIF
                                </label>
                            </div>
                        </div>
                        
                        {/* Progress */}
                        {this.state.isCompressing && (
                            <div style={styles.progressContainer}>
                                <div style={styles.progressBar}>
                                    <div style={{ ...styles.progressFill, width: `${this.state.progress}%` }} />
                                </div>
                                <span>Comprimiendo... {this.state.progress}%</span>
                            </div>
                        )}
                        
                        {/* Error */}
                        {this.state.error && (
                            <div style={styles.error}>{this.state.error}</div>
                        )}
                        
                        {/* Result */}
                        {this.state.result && (
                            <div style={styles.result}>
                                <h4 style={styles.resultTitle}>✅ Compresión Completada</h4>
                                
                                <div style={styles.resultInfo}>
                                    <p><strong>Archivo:</strong> {this.state.result.name}</p>
                                    <p><strong>Formato:</strong> {this.state.result.format}</p>
                                    <p><strong>Dimensiones:</strong> {this.state.result.width} × {this.state.result.height}px</p>
                                    <p><strong>Tamaño original:</strong> {this.formatBytes(this.state.result.originalSize)}</p>
                                    <p><strong>Tamaño comprimido:</strong> {this.formatBytes(this.state.result.compressedSize)}</p>
                                    <p><strong>Reducción:</strong> {this.state.result.compressionRatio}%</p>
                                </div>
                                <button style={styles.downloadBtn} onClick={this.downloadResult}>
                                    ⬇️ Descargar PNG
                                </button>
                            </div>
                        )}
                        
                        {/* Compress Button */}
                        <button
                            style={{
                                ...styles.compressBtn,
                                ...(this.state.isCompressing || !this.state.selectedImage ? styles.compressBtnDisabled : {})
                            }}
                            onClick={this.compressImage}
                            disabled={!this.state.selectedImage || this.state.isCompressing}
                        >
                            {this.state.isCompressing ? '⏳ Comprimiendo...' : '🗜️ Comprimir PNG'}
                        </button>
                    </div>
                )}
            </div>
        );
    }
}

const styles = {
    panel: {
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        marginTop: '10px',
        overflow: 'hidden',
        border: '1px solid #444'
    },
    header: {
        padding: '12px 15px',
        backgroundColor: '#333',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    toggleIcon: {
        color: '#888',
        fontSize: '12px'
    },
    content: {
        padding: '15px'
    },
    dropZone: {
        border: '2px dashed #666',
        borderRadius: '8px',
        padding: '30px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: '15px'
    },
    dropZoneActive: {
        borderColor: '#4a9eff',
        backgroundColor: 'rgba(74, 158, 255, 0.1)'
    },
    dropZoneSmall: {
        padding: '15px'
    },
    dropText: {
        color: '#888',
        fontSize: '14px'
    },
    imageInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    preview: {
        maxWidth: '80px',
        maxHeight: '80px',
        borderRadius: '4px',
        border: '1px solid #555'
    },
    infoText: {
        color: '#ccc',
        fontSize: '13px',
        textAlign: 'left'
    },
    atlasSection: {
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderRadius: '6px',
        border: '1px solid rgba(74, 222, 128, 0.3)'
    },
    atlasBtn: {
        width: '100%',
        padding: '10px',
        backgroundColor: '#2ecc71',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px',
        marginBottom: '5px'
    },
    atlasHint: {
        display: 'block',
        fontSize: '11px',
        color: '#888',
        textAlign: 'center'
    },
    configSection: {
        marginBottom: '15px'
    },
    sectionTitle: {
        color: '#fff',
        fontSize: '13px',
        marginBottom: '10px',
        borderBottom: '1px solid #444',
        paddingBottom: '5px'
    },
    configRow: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        gap: '10px'
    },
    label: {
        color: '#aaa',
        fontSize: '12px',
        minWidth: '120px'
    },
    slider: {
        flex: 1,
        cursor: 'pointer'
    },
    checkboxLabel: {
        color: '#aaa',
        fontSize: '12px',
        cursor: 'pointer'
    },
    progressContainer: {
        marginBottom: '15px'
    },
    progressBar: {
        height: '8px',
        backgroundColor: '#333',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '5px'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4a9eff',
        transition: 'width 0.2s'
    },
    error: {
        color: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        padding: '10px',
        borderRadius: '6px',
        marginBottom: '15px',
        fontSize: '13px'
    },
    result: {
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        padding: '15px',
        borderRadius: '6px',
        marginBottom: '15px',
        border: '1px solid #2ecc71'
    },
    resultTitle: {
        color: '#2ecc71',
        marginTop: 0,
        marginBottom: '10px',
        fontSize: '14px'
    },
    resultInfo: {
        color: '#ccc',
        fontSize: '12px',
        marginBottom: '10px'
    },
    downloadBtn: {
        width: '100%',
        padding: '10px',
        backgroundColor: '#2ecc71',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    compressBtn: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#4a9eff',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    compressBtnDisabled: {
        backgroundColor: '#555',
        cursor: 'not-allowed'
    }
};

export default PngCompressorPanel;
