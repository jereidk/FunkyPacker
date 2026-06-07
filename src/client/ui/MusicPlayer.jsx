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
            cachedTracks: [],
            error: null
        };
        
        this.audioRef = React.createRef();
        this.searchTimeout = null;
        
        // Bind methods
        this.togglePanel = this.togglePanel.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.selectTrack = this.selectTrack.bind(this);
        this.playPause = this.playPause.bind(this);
        this.handleVolumeChange = this.handleVolumeChange.bind(this);
        this.handleOnlineStatus = this.handleOnlineStatus.bind(this);
        this.loadLocalFiles = this.loadLocalFiles.bind(this);
        this.loadCachedTracks = this.loadCachedTracks.bind(this);
        
        // Listen for online/offline events
        window.addEventListener('online', this.handleOnlineStatus);
        window.addEventListener('offline', this.handleOnlineStatus);
    }
    
    componentDidMount() {
        // Load cached tracks from localStorage
        this.loadCachedTracks();
        
        // Load default audio options
        const defaults = newgroundsService.getDefaultAudio(5);
        this.setState({ localFiles: defaults });
        
        // Check if audio element exists
        if (this.audioRef.current) {
            this.audioRef.current.volume = this.state.volume;
        }
    }
    
    componentWillUnmount() {
        window.removeEventListener('online', this.handleOnlineStatus);
        window.removeEventListener('offline', this.handleOnlineStatus);
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
    }
    
    handleOnlineStatus() {
        const isOnline = navigator.onLine;
        this.setState({ isOnline });
        console.log(`[MusicPlayer] Online status: ${isOnline}`);
        
        if (!isOnline) {
            this.setState({ 
                searchResults: [],
                error: 'You are offline. Only local and cached music is available.'
            });
        }
    }
    
    loadCachedTracks() {
        try {
            const cached = localStorage.getItem('musicPlayer_cached');
            if (cached) {
                const tracks = JSON.parse(cached);
                this.setState({ cachedTracks: tracks });
                console.log(`[MusicPlayer] Loaded ${tracks.length} cached tracks`);
            }
        } catch (e) {
            console.warn('[MusicPlayer] Could not load cached tracks:', e);
        }
    }
    
    saveCachedTrack(track) {
        try {
            const cached = this.state.cachedTracks;
            const exists = cached.find(t => t.id === track.id);
            
            if (!exists) {
                cached.push(track);
                localStorage.setItem('musicPlayer_cached', JSON.stringify(cached));
                this.setState({ cachedTracks: cached });
                console.log('[MusicPlayer] Track cached:', track.title);
            }
        } catch (e) {
            console.warn('[MusicPlayer] Could not cache track:', e);
        }
    }
    
    loadLocalFiles() {
        const files = newgroundsService.getDefaultAudio(5);
        this.setState({ localFiles: files });
    }
    
    togglePanel() {
        this.setState(prev => ({ isOpen: !prev.isOpen }));
    }
    
    handleSearch(e) {
        const query = e.target.value;
        this.setState({ searchQuery: query, isLoading: true, error: null });
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        if (!query.trim()) {
            this.setState({ searchResults: [], isLoading: false });
            return;
        }
        
        this.searchTimeout = setTimeout(async () => {
            if (!navigator.onLine) {
                this.setState({ 
                    searchResults: [],
                    isLoading: false,
                    error: 'You are offline. Search is not available.'
                });
                return;
            }
            
            try {
                const results = await newgroundsService.searchAudio(query, 15);
                this.setState({ 
                    searchResults: results,
                    isLoading: false,
                    error: results.length === 0 ? 'No results found. Try a different search.' : null
                });
            } catch (error) {
                console.error('[MusicPlayer] Search error:', error);
                this.setState({ 
                    searchResults: [],
                    isLoading: false,
                    error: 'Search failed. Please try again.'
                });
            }
        }, 500);
    }
    
    selectTrack(track) {
        console.log('[MusicPlayer] Selected track:', track.title);
        this.setState({ selectedTrack: track, error: null });
        
        // Save to cache if from Newgrounds
        if (track.source === 'newgrounds' && track.url) {
            this.saveCachedTrack(track);
        }
        
        // Set up audio
        if (this.audioRef.current) {
            if (track.url) {
                this.audioRef.current.src = track.url;
                this.audioRef.current.play().then(() => {
                    this.setState({ isPlaying: true });
                }).catch(err => {
                    console.error('[MusicPlayer] Play error:', err);
                    this.setState({ 
                        isPlaying: false,
                        error: 'Could not play this track. It may be unavailable.'
                    });
                });
            } else if (track.offline && track.localFile) {
                // Handle local/offline files
                this.handleLocalFile(track);
            } else {
                // Silence or no music
                this.audioRef.current.src = '';
                this.setState({ isPlaying: false });
            }
        }
    }
    
    handleLocalFile(track) {
        // For local files, we'll use Web Audio API to generate simple tones
        // or show a message that local files need to be added
        console.log('[MusicPlayer] Local file selected:', track.localFile);
        
        if (track.id === 'silence') {
            this.setState({ isPlaying: false });
            return;
        }
        
        // Show info message
        this.setState({ 
            error: `Local audio "${track.title}" requires audio files to be added to the APK.`
        });
    }
    
    playPause() {
        if (!this.audioRef.current || !this.state.selectedTrack?.url) {
            return;
        }
        
        if (this.state.isPlaying) {
            this.audioRef.current.pause();
            this.setState({ isPlaying: false });
        } else {
            this.audioRef.current.play().then(() => {
                this.setState({ isPlaying: true });
            }).catch(err => {
                console.error('[MusicPlayer] Play/Pause error:', err);
            });
        }
    }
    
    handleVolumeChange(e) {
        const volume = parseFloat(e.target.value);
        this.setState({ volume });
        
        if (this.audioRef.current) {
            this.audioRef.current.volume = volume;
        }
    }
    
    handleAudioError(e) {
        console.error('[MusicPlayer] Audio error:', e);
        this.setState({ 
            isPlaying: false,
            error: 'Audio playback error. The file may be unavailable.'
        });
    }
    
    handleAudioEnded() {
        // Loop the audio
        if (this.audioRef.current && this.state.selectedTrack?.url) {
            this.audioRef.current.currentTime = 0;
            this.audioRef.current.play();
        }
    }
    
    render() {
        const { 
            isOpen, searchQuery, searchResults, selectedTrack, 
            isPlaying, isLoading, isOnline, volume, 
            showLocalFiles, localFiles, cachedTracks, error 
        } = this.state;
        
        return (
            <div className="music-player">
                {/* Hidden audio element */}
                <audio 
                    ref={this.audioRef}
                    onError={(e) => this.handleAudioError(e)}
                    onEnded={() => this.handleAudioEnded()}
                    crossOrigin="anonymous"
                />
                
                {/* Toggle Button */}
                <button 
                    className="music-player-toggle"
                    onClick={this.togglePanel}
                    title="Music Player"
                >
                    {isPlaying ? '🔊' : '🎵'}
                </button>
                
                {/* Panel */}
                {isOpen && (
                    <div className="music-player-panel">
                        <div className="music-player-header">
                            <h3>🎵 Music Player</h3>
                            <div className="music-status">
                                {!isOnline && <span className="offline-badge">⚠️ Offline</span>}
                            </div>
                            <button className="close-btn" onClick={this.togglePanel}>✕</button>
                        </div>
                        
                        {/* Search */}
                        <div className="music-search">
                            <input
                                type="text"
                                placeholder="Search Newgrounds audio..."
                                value={searchQuery}
                                onChange={this.handleSearch}
                                disabled={!isOnline}
                            />
                            {isLoading && <span className="loading">⏳</span>}
                        </div>
                        
                        {/* Error Message */}
                        {error && (
                            <div className="music-error">
                                {error}
                            </div>
                        )}
                        
                        {/* Currently Playing */}
                        {selectedTrack && (
                            <div className="now-playing">
                                <div className="track-info">
                                    <span className="track-title">{selectedTrack.title}</span>
                                    <span className="track-artist">{selectedTrack.artist}</span>
                                </div>
                                <div className="track-controls">
                                    <button 
                                        className="play-pause-btn"
                                        onClick={this.playPause}
                                        disabled={!selectedTrack.url}
                                    >
                                        {isPlaying ? '⏸️' : '▶️'}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={volume}
                                        onChange={this.handleVolumeChange}
                                        className="volume-slider"
                                        title={`Volume: ${Math.round(volume * 100)}%`}
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* Tabs */}
                        <div className="music-tabs">
                            <button 
                                className={!showLocalFiles ? 'active' : ''}
                                onClick={() => this.setState({ showLocalFiles: false })}
                            >
                                🔍 Search
                            </button>
                            <button 
                                className={showLocalFiles ? 'active' : ''}
                                onClick={() => this.setState({ showLocalFiles: true })}
                            >
                                📁 Local
                            </button>
                        </div>
                        
                        {/* Track List */}
                        <div className="track-list">
                            {!showLocalFiles ? (
                                // Search Results
                                <>
                                    {searchResults.length > 0 ? (
                                        searchResults.map(track => (
                                            <div 
                                                key={track.id}
                                                className={`track-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
                                                onClick={() => this.selectTrack(track)}
                                            >
                                                <span className="track-title">{track.title}</span>
                                                <span className="track-artist">{track.artist}</span>
                                                <span className="track-source">🔗 Newgrounds</span>
                                            </div>
                                        ))
                                    ) : searchQuery && !isLoading ? (
                                        <div className="no-results">No results found</div>
                                    ) : (
                                        <div className="search-hint">
                                            Search for music on Newgrounds
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Local Files
                                <>
                                    {/* Cached Tracks */}
                                    {cachedTracks.length > 0 && (
                                        <div className="track-section">
                                            <h4>📥 Cached Tracks</h4>
                                            {cachedTracks.map(track => (
                                                <div 
                                                    key={`cached_${track.id}`}
                                                    className={`track-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
                                                    onClick={() => this.selectTrack(track)}
                                                >
                                                    <span className="track-title">{track.title}</span>
                                                    <span className="track-artist">{track.artist}</span>
                                                    <span className="track-source">📥 Cached</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Built-in Tracks */}
                                    <div className="track-section">
                                        <h4>🎵 Built-in Tracks</h4>
                                        {localFiles.map(track => (
                                            <div 
                                                key={`local_${track.id}`}
                                                className={`track-item ${selectedTrack?.id === track.id ? 'selected' : ''} ${!track.url ? 'disabled' : ''}`}
                                                onClick={() => track.url && this.selectTrack(track)}
                                            >
                                                <span className="track-title">{track.title}</span>
                                                <span className="track-artist">{track.artist}</span>
                                                <span className="track-source">
                                                    {track.id === 'silence' ? '🔇 System' : '💾 Local'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Footer Info */}
                        <div className="music-footer">
                            <small>
                                {isOnline 
                                    ? 'Search Newgrounds for music' 
                                    : 'Offline mode - Only cached music available'}
                            </small>
                        </div>
                    </div>
                )}
                
                {/* CSS Styles */}
                <style>{`
                    .music-player {
                        position: fixed;
                        bottom: 80px;
                        right: 20px;
                        z-index: 9990;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }
                    
                    .music-player-toggle {
                        background: #1a1a2e;
                        color: white;
                        border: none;
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 24px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .music-player-toggle:hover {
                        background: #2a2a4e;
                    }
                    
                    .music-player-panel {
                        position: absolute;
                        bottom: 60px;
                        right: 0;
                        width: 320px;
                        max-height: 500px;
                        background: #1a1a2e;
                        border-radius: 12px;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    
                    .music-player-header {
                        display: flex;
                        align-items: center;
                        padding: 12px;
                        background: #252540;
                        border-bottom: 1px solid #4a4a6a;
                    }
                    
                    .music-player-header h3 {
                        margin: 0;
                        font-size: 14px;
                        color: white;
                        flex: 1;
                    }
                    
                    .music-status {
                        margin-right: 8px;
                    }
                    
                    .offline-badge {
                        background: #ff6b6b;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 10px;
                    }
                    
                    .music-player-header .close-btn {
                        background: none;
                        border: none;
                        color: #888;
                        cursor: pointer;
                        font-size: 16px;
                        padding: 4px 8px;
                    }
                    
                    .music-player-header .close-btn:hover {
                        color: white;
                    }
                    
                    .music-search {
                        padding: 8px 12px;
                        display: flex;
                        gap: 8px;
                    }
                    
                    .music-search input {
                        flex: 1;
                        padding: 8px 12px;
                        border-radius: 6px;
                        border: 1px solid #4a4a6a;
                        background: #252540;
                        color: white;
                        font-size: 13px;
                    }
                    
                    .music-search input:focus {
                        outline: none;
                        border-color: #4a9eff;
                    }
                    
                    .music-search input:disabled {
                        opacity: 0.5;
                    }
                    
                    .loading {
                        display: flex;
                        align-items: center;
                    }
                    
                    .music-error {
                        margin: 0 12px 8px;
                        padding: 8px;
                        background: #3a1a1a;
                        border-radius: 6px;
                        color: #ff6666;
                        font-size: 12px;
                    }
                    
                    .now-playing {
                        margin: 0 12px 8px;
                        padding: 10px;
                        background: #252540;
                        border-radius: 8px;
                    }
                    
                    .now-playing .track-info {
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 8px;
                    }
                    
                    .now-playing .track-title {
                        color: white;
                        font-weight: bold;
                        font-size: 13px;
                    }
                    
                    .now-playing .track-artist {
                        color: #888;
                        font-size: 11px;
                    }
                    
                    .now-playing .track-controls {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .play-pause-btn {
                        background: #4a9eff;
                        border: none;
                        color: white;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 16px;
                    }
                    
                    .play-pause-btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    
                    .volume-slider {
                        flex: 1;
                        height: 4px;
                        -webkit-appearance: none;
                        background: #4a4a6a;
                        border-radius: 2px;
                    }
                    
                    .volume-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        width: 14px;
                        height: 14px;
                        background: #4a9eff;
                        border-radius: 50%;
                        cursor: pointer;
                    }
                    
                    .music-tabs {
                        display: flex;
                        padding: 0 12px;
                        gap: 8px;
                    }
                    
                    .music-tabs button {
                        flex: 1;
                        padding: 8px;
                        background: #252540;
                        border: none;
                        color: #888;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    
                    .music-tabs button.active {
                        background: #4a9eff;
                        color: white;
                    }
                    
                    .track-list {
                        flex: 1;
                        overflow-y: auto;
                        padding: 8px 12px;
                        max-height: 250px;
                    }
                    
                    .track-section {
                        margin-bottom: 12px;
                    }
                    
                    .track-section h4 {
                        margin: 0 0 8px;
                        color: #888;
                        font-size: 11px;
                        text-transform: uppercase;
                    }
                    
                    .track-item {
                        padding: 10px;
                        background: #252540;
                        border-radius: 6px;
                        margin-bottom: 6px;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    
                    .track-item:hover {
                        background: #3a3a5a;
                    }
                    
                    .track-item.selected {
                        background: #4a9eff;
                    }
                    
                    .track-item.disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    
                    .track-item .track-title {
                        color: white;
                        font-size: 12px;
                    }
                    
                    .track-item .track-artist {
                        color: #888;
                        font-size: 10px;
                    }
                    
                    .track-item .track-source {
                        color: #666;
                        font-size: 10px;
                        margin-top: 2px;
                    }
                    
                    .track-item.selected .track-source {
                        color: rgba(255,255,255,0.7);
                    }
                    
                    .no-results, .search-hint {
                        text-align: center;
                        color: #666;
                        padding: 20px;
                        font-size: 12px;
                    }
                    
                    .music-footer {
                        padding: 8px 12px;
                        border-top: 1px solid #4a4a6a;
                        text-align: center;
                    }
                    
                    .music-footer small {
                        color: #666;
                    }
                `}</style>
            </div>
        );
    }
}

export default MusicPlayer;