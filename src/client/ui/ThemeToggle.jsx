import React from 'react';
import themeManager from '../utils/ThemeManager';

class ThemeToggle extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            theme: themeManager.getTheme(),
            isOpen: false
        };
        
        this.toggleTheme = this.toggleTheme.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }
    
    componentDidMount() {
        // Inject styles
        themeManager.injectStyles();
        
        // Listen for theme changes
        this.removeListener = themeManager.addListener((theme) => {
            this.setState({ theme });
        });
    }
    
    componentWillUnmount() {
        if (this.removeListener) {
            this.removeListener();
        }
    }
    
    toggleTheme() {
        themeManager.toggleTheme();
    }
    
    handleClick() {
        this.setState(prev => ({ isOpen: !prev.isOpen }));
    }
    
    selectTheme(theme) {
        themeManager.setTheme(theme);
        this.setState({ isOpen: false });
    }
    
    getThemeIcon(theme) {
        switch(theme) {
            case 'light': return '☀️';
            case 'dark': return '🌙';
            case 'system': return '💻';
            default: return '🌙';
        }
    }
    
    getThemeLabel(theme) {
        switch(theme) {
            case 'light': return 'Light';
            case 'dark': return 'Dark';
            case 'system': return 'System';
            default: return 'Dark';
        }
    }
    
    render() {
        const { theme, isOpen } = this.state;
        const resolvedTheme = themeManager.getResolvedTheme();
        
        return (
            <div className="theme-toggle-container">
                <button 
                    className="theme-toggle-btn"
                    onClick={this.handleClick}
                    title={`Current: ${this.getThemeLabel(resolvedTheme)}`}
                >
                    <span className="icon">{this.getThemeIcon(resolvedTheme)}</span>
                    <span className="label">{this.getThemeLabel(theme)}</span>
                </button>
                
                {isOpen && (
                    <div className="theme-dropdown">
                        <div 
                            className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                            onClick={() => this.selectTheme('light')}
                        >
                            ☀️ Light
                        </div>
                        <div 
                            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                            onClick={() => this.selectTheme('dark')}
                        >
                            🌙 Dark
                        </div>
                        <div 
                            className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                            onClick={() => this.selectTheme('system')}
                        >
                            💻 System
                        </div>
                    </div>
                )}
                
                <style>{`
                    .theme-toggle-container {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        z-index: 9990;
                    }
                    
                    .theme-toggle-btn {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 8px 12px;
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.2s;
                    }
                    
                    .theme-toggle-btn:hover {
                        background: var(--bg-tertiary);
                    }
                    
                    .theme-toggle-btn .icon {
                        font-size: 16px;
                    }
                    
                    .theme-dropdown {
                        position: absolute;
                        top: 100%;
                        right: 0;
                        margin-top: 4px;
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        overflow: hidden;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    }
                    
                    .theme-option {
                        padding: 10px 16px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 13px;
                        color: var(--text-primary);
                        transition: background 0.2s;
                    }
                    
                    .theme-option:hover {
                        background: var(--bg-tertiary);
                    }
                    
                    .theme-option.active {
                        background: var(--accent-color);
                        color: white;
                    }
                `}</style>
            </div>
        );
    }
}

export default ThemeToggle;