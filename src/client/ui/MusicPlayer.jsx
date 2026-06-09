import React from 'react';
import newgroundsService from '../utils/NewgroundsAudioService';

class MusicPlayer extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isOpen: false,
            searchQuery: '',
            searchResults: [],
            selectedTrack: null,
            isPlaying: false,
            isLoading: false,
            isOnline: navigator.onLine,
            volume: 0.5,
            showLocalFiles: false,
            localFiles: [],
            error: null
        };

        this.audioRef = React.createRef();
        this.searchTimeout = null;

        this.togglePanel = this.togglePanel.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.selectTrack = this.selectTrack.bind(this);
        this.playPause = this.playPause.bind(this);
        this.handleVolumeChange = this.handleVolumeChange.bind(this);
        this.handleOnlineStatus = this.handleOnlineStatus.bind(this);
        this.loadLocalFiles = this.loadLocalFiles.bind(this);
        this.playLocalFile = this.playLocalFile.bind(this);

        window.addEventListener('online', this.handleOnlineStatus);
        window.addEventListener('offline', this.handleOnlineStatus);
    }

    componentDidMount() {
        this.loadLocalFiles();
    }

    componentWillUnmount() {
        window.removeEventListener('online', this.handleOnlineStatus);
        window.removeEventListener('offline', this.handleOnlineStatus);
        if (this.audioRef.current) {
            this.audioRef.current.pause();
        }
    }

    handleOnlineStatus() {
        this.setState({ isOnline: navigator.onLine });
    }

    togglePanel() {
        this.setState(prev => ({ isOpen: !prev.isOpen }));
    }

    handleSearch(e) {
        const query = e.target.value;
        this.setState({ searchQuery: query, error: null });

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (query.length < 2) {
            this.setState({ searchResults: [] });
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            this.setState({ isLoading: true });
            try {
                const results = await newgroundsService.searchAudio(query);
                this.setState({ searchResults: results, isLoading: false });
            } catch (err) {
                this.setState({ error: 'Search failed', isLoading: false });
            }
        }, 500);
    }

    async selectTrack(track) {
        this.setState({ selectedTrack: track, isPlaying: false, error: null });
        
        if (this.audioRef.current) {
            this.audioRef.current.pause();
            this.audioRef.current.src = track.audioUrl || track.urls?.high || track.urls?.med;
            this.audioRef.current.volume = this.state.volume;
        }
    }

    playPause() {
        if (!this.audioRef.current || !this.state.selectedTrack) return;

        if (this.state.isPlaying) {
            this.audioRef.current.pause();
        } else {
            this.audioRef.current.play().catch(err => {
                this.setState({ error: 'Playback failed' });
            });
        }
        this.setState(prev => ({ isPlaying: !prev.isPlaying }));
    }

    handleVolumeChange(e) {
        const volume = parseFloat(e.target.value);
        this.setState({ volume });
        if (this.audioRef.current) {
            this.audioRef.current.volume = volume;
        }
    }

    loadLocalFiles() {
        // Check for previously loaded files in sessionStorage
        try {
            const saved = sessionStorage.getItem('musicPlayer_localFiles');
            if (saved) {
                this.setState({ localFiles: JSON.parse(saved) });
            }
        } catch (e) {
            console.error('Error loading local files:', e);
        }
    }

    playLocalFile(file) {
        this.setState({ selectedTrack: file, isPlaying: false, error: null });
        
        if (this.audioRef.current) {
            this.audioRef.current.pause();
            this.audioRef.current.src = file.audioUrl;
            this.audioRef.current.volume = this.state.volume;
        }
    }

    handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(f => f.type.startsWith('audio/'));
        
        const newFiles = validFiles.map(file => ({
            name: file.name,
            file: file,
            audioUrl: URL.createObjectURL(file),
            artist: 'Local',
            duration: 0
        }));

        // Update state and save to sessionStorage
        this.setState(prev => {
            const updated = [...prev.localFiles, ...newFiles];
            try {
                sessionStorage.setItem('musicPlayer_localFiles', JSON.stringify(
                    updated.map(f => ({ name: f.name, artist: f.artist }))
                ));
            } catch (e) {
                console.warn('MusicPlayer: Failed to save local files to sessionStorage', e);
            }
            return { localFiles: updated };
        });
    };

    render() {
        const { isOpen, searchQuery, searchResults, selectedTrack, isPlaying, isLoading, isOnline, volume, localFiles, error } = this.state;

        return (
            <div className="music-player" style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                zIndex: 1000
            }}>
                <audio ref={this.audioRef} crossOrigin="anonymous" />

                {/* Toggle Button */}
                <button 
                    onClick={this.togglePanel}
                    style={{
                        background: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        cursor: 'pointer',
                        fontSize: '20px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                    title="Music Player"
                >
                    🎵
                </button>

                {/* Panel */}
                {isOpen && (
                    <div style={{
                        position: 'absolute',
                        bottom: '60px',
                        right: '0',
                        width: '320px',
                        background: '#1e1e2e',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        color: 'white'
                    }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Music Player</h3>
                        
                        {/* Online Status */}
                        {!isOnline && (
                            <div style={{ 
                                background: '#ef4444', 
                                padding: '8px', 
                                borderRadius: '6px', 
                                marginBottom: '12px',
                                fontSize: '12px'
                            }}>
                                ⚠️ You're offline. Only local files available.
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div style={{ 
                                background: '#7f1d1d', 
                                padding: '8px', 
                                borderRadius: '6px', 
                                marginBottom: '12px',
                                fontSize: '12px'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Search */}
                        {isOnline && (
                            <div style={{ marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="Search Newgrounds..."
                                    value={searchQuery}
                                    onChange={this.handleSearch}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        border: '1px solid #3b3b4f',
                                        background: '#2a2a3a',
                                        color: 'white',
                                        fontSize: '13px'
                                    }}
                                />
                                {isLoading && <div style={{ fontSize: '11px', marginTop: '4px' }}>Searching...</div>}
                            </div>
                        )}

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div style={{ 
                                maxHeight: '150px', 
                                overflowY: 'auto',
                                marginBottom: '12px'
                            }}>
                                {searchResults.slice(0, 10).map((track, i) => (
                                    <div
                                        key={i}
                                        onClick={() => this.selectTrack(track)}
                                        style={{
                                            padding: '8px',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            marginBottom: '4px',
                                            background: selectedTrack?.id === track.id ? '#3b3b4f' : 'transparent',
                                            fontSize: '12px'
                                        }}
                                        onMouseEnter={e => e.target.style.background = '#3b3b4f'}
                                        onMouseLeave={e => e.target.style.background = selectedTrack?.id === track.id ? '#3b3b4f' : 'transparent'}
                                    >
                                        {track.name} - {track.artist?.name || 'Unknown'}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Local Files */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                                fontSize: '12px', 
                                marginBottom: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                Local Files
                                <label style={{ cursor: 'pointer', color: '#6366f1' }}>
                                    + Add
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        multiple
                                        onChange={this.handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {localFiles.map((file, i) => (
                                    <div
                                        key={i}
                                        onClick={() => this.playLocalFile(file)}
                                        style={{
                                            padding: '6px',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            marginBottom: '2px',
                                            background: selectedTrack?.name === file.name ? '#3b3b4f' : 'transparent',
                                            fontSize: '11px'
                                        }}
                                    >
                                        {file.name}
                                    </div>
                                ))}
                                {localFiles.length === 0 && (
                                    <div style={{ fontSize: '11px', color: '#666' }}>
                                        No local files. Add audio files to play offline.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Now Playing */}
                        {selectedTrack && (
                            <div style={{ 
                                background: '#2a2a3a', 
                                padding: '12px', 
                                borderRadius: '8px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                    Now: {selectedTrack.name}
                                </div>
                                <div style={{ fontSize: '11px', color: '#888' }}>
                                    {selectedTrack.artist?.name || selectedTrack.artist || 'Unknown Artist'}
                                </div>
                            </div>
                        )}

                        {/* Controls */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={this.playPause}
                                disabled={!selectedTrack}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: selectedTrack ? '#6366f1' : '#3b3b4f',
                                    color: 'white',
                                    cursor: selectedTrack ? 'pointer' : 'not-allowed',
                                    fontSize: '13px'
                                }}
                            >
                                {isPlaying ? '⏸ Pause' : '▶ Play'}
                            </button>
                            
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px' }}>🔊</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={volume}
                                    onChange={this.handleVolumeChange}
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default MusicPlayer;