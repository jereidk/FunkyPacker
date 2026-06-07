/**
 * Theme Manager for Android App
 * Handles light/dark theme switching with persistence
 */

class ThemeManager {
    constructor() {
        this.THEME_KEY = 'app_theme';
        this.THEMES = {
            light: 'light',
            dark: 'dark',
            system: 'system'
        };
        
        this.currentTheme = this.loadTheme();
        this.listeners = [];
        
        // Initialize theme
        this.init();
    }
    
    init() {
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (this.currentTheme === this.THEMES.system) {
                    this.applyTheme();
                }
            });
        }
        
        // Apply initial theme
        this.applyTheme();
        
        console.log(`[ThemeManager] Initialized with theme: ${this.currentTheme}`);
    }
    
    loadTheme() {
        try {
            const saved = localStorage.getItem(this.THEME_KEY);
            if (saved && Object.values(this.THEMES).includes(saved)) {
                return saved;
            }
        } catch (e) {
            console.warn('[ThemeManager] Could not load theme:', e);
        }
        return this.THEMES.dark; // Default to dark
    }
    
    saveTheme(theme) {
        try {
            localStorage.setItem(this.THEME_KEY, theme);
        } catch (e) {
            console.warn('[ThemeManager] Could not save theme:', e);
        }
    }
    
    getTheme() {
        return this.currentTheme;
    }
    
    getResolvedTheme() {
        if (this.currentTheme === this.THEMES.system) {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return this.THEMES.dark;
            }
            return this.THEMES.light;
        }
        return this.currentTheme;
    }
    
    setTheme(theme) {
        if (!Object.values(this.THEMES).includes(theme)) {
            console.warn('[ThemeManager] Invalid theme:', theme);
            return;
        }
        
        this.currentTheme = theme;
        this.saveTheme(theme);
        this.applyTheme();
        this.notifyListeners();
        
        console.log(`[ThemeManager] Theme changed to: ${theme}`);
    }
    
    toggleTheme() {
        const resolved = this.getResolvedTheme();
        if (resolved === this.THEMES.dark) {
            this.setTheme(this.THEMES.light);
        } else {
            this.setTheme(this.THEMES.dark);
        }
    }
    
    applyTheme() {
        const resolved = this.getResolvedTheme();
        const isDark = resolved === this.THEMES.dark;
        
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', resolved);
        
        // Update body class for CSS
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${resolved}`);
        
        // Apply CSS variables for colors
        this.applyCSSVariables(isDark);
        
        console.log(`[ThemeManager] Applied theme: ${resolved} (dark: ${isDark})`);
    }
    
    applyCSSVariables(isDark) {
        const root = document.documentElement;
        
        if (isDark) {
            // Dark theme colors
            root.style.setProperty('--bg-primary', '#1a1a2e');
            root.style.setProperty('--bg-secondary', '#252540');
            root.style.setProperty('--bg-tertiary', '#2a2a4e');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#b0b0b0');
            root.style.setProperty('--text-muted', '#888888');
            root.style.setProperty('--border-color', '#4a4a6a');
            root.style.setProperty('--accent-color', '#4a9eff');
            root.style.setProperty('--accent-hover', '#6ab3ff');
            root.style.setProperty('--error-color', '#ff6b6b');
            root.style.setProperty('--success-color', '#4ade80');
            root.style.setProperty('--warning-color', '#fbbf24');
        } else {
            // Light theme colors
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f5f5f5');
            root.style.setProperty('--bg-tertiary', '#ebebeb');
            root.style.setProperty('--text-primary', '#1a1a1a');
            root.style.setProperty('--text-secondary', '#4a4a4a');
            root.style.setProperty('--text-muted', '#888888');
            root.style.setProperty('--border-color', '#d0d0d0');
            root.style.setProperty('--accent-color', '#3b82f6');
            root.style.setProperty('--accent-hover', '#2563eb');
            root.style.setProperty('--error-color', '#ef4444');
            root.style.setProperty('--success-color', '#22c55e');
            root.style.setProperty('--warning-color', '#f59e0b');
        }
    }
    
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }
    
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.currentTheme));
    }
    
    // Inject theme styles into the document
    injectStyles() {
        const style = document.createElement('style');
        style.id = 'theme-manager-styles';
        style.textContent = `
            /* Theme CSS Variables */
            :root {
                --bg-primary: #1a1a2e;
                --bg-secondary: #252540;
                --bg-tertiary: #2a2a4e;
                --text-primary: #ffffff;
                --text-secondary: #b0b0b0;
                --text-muted: #888888;
                --border-color: #4a4a6a;
                --accent-color: #4a9eff;
                --accent-hover: #6ab3ff;
                --error-color: #ff6b6b;
                --success-color: #4ade80;
                --warning-color: #fbbf24;
            }
            
            /* Light theme overrides */
            body.theme-light {
                --bg-primary: #ffffff;
                --bg-secondary: #f5f5f5;
                --bg-tertiary: #ebebeb;
                --text-primary: #1a1a1a;
                --text-secondary: #4a4a4a;
                --text-muted: #888888;
                --border-color: #d0d0d0;
                --accent-color: #3b82f6;
                --accent-hover: #2563eb;
                --error-color: #ef4444;
                --success-color: #22c55e;
                --warning-color: #f59e0b;
            }
            
            /* Theme toggle button */
            .theme-toggle-btn {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9990;
                background: var(--bg-secondary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }
            
            .theme-toggle-btn:hover {
                background: var(--bg-tertiary);
            }
            
            .theme-toggle-btn .icon {
                font-size: 16px;
            }
            
            /* Apply theme colors to common elements */
            .main-wrapper {
                background-color: var(--bg-primary) !important;
                color: var(--text-primary) !important;
            }
            
            .main-layout {
                background-color: var(--bg-secondary) !important;
                border-color: var(--border-color) !important;
            }
            
            .border-color-gray {
                border-color: var(--border-color) !important;
            }
            
            input, select, textarea {
                background-color: var(--bg-tertiary) !important;
                color: var(--text-primary) !important;
                border-color: var(--border-color) !important;
            }
            
            button {
                background-color: var(--accent-color) !important;
                color: white !important;
            }
            
            button:hover {
                background-color: var(--accent-hover) !important;
            }
        `;
        
        // Remove existing style if any
        const existing = document.getElementById('theme-manager-styles');
        if (existing) {
            existing.remove();
        }
        
        document.head.appendChild(style);
    }
}

// Singleton instance
const themeManager = new ThemeManager();

export default themeManager;
export { ThemeManager };