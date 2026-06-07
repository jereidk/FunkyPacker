class Controller {
    static init() {
        // Initialize LogConsole for Android
        this.initLogConsole();
        
        // Android back button handling - wait for Capacitor to load
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            try {
                window.Capacitor.Plugins.App.addListener('backButton', () => {
                    if (window.history.length > 1) {
                        window.history.back();
                    }
                });
            } catch (e) {
                console.log('Back button error:', e);
            }
        }
    }
    
    static initLogConsole() {
        console.log('[Android] Initializing LogConsole...');
        
        // Inject styles
        const style = document.createElement('style');
        style.id = 'log-console-styles';
        style.textContent = `
            #log-console-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9998;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .log-console-toggle {
                background: #1a1a2e;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid #4a4a6a;
                min-width: 50px;
                justify-content: center;
                font-size: 14px;
            }
            .log-console-toggle:hover { background: #2a2a4e; }
            .log-console-toggle .log-icon { font-size: 18px; }
            .log-console-toggle .log-count {
                background: #ff4444;
                padding: 2px 6px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: bold;
            }
            .log-console-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                background: #1a1a2e;
                border-top: 2px solid #4a4a6a;
                display: flex;
                flex-direction: column;
                max-height: 50vh;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .log-console-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: #252540;
                border-bottom: 1px solid #4a4a6a;
                color: white;
                font-weight: bold;
                font-size: 13px;
            }
            .log-console-actions { display: flex; gap: 6px; }
            .log-console-actions button {
                background: #3a3a5a;
                color: white;
                border: 1px solid #5a5a7a;
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            }
            .log-console-actions button:hover { background: #4a4a6a; }
            .log-console-content {
                flex: 1;
                overflow-y: auto;
                padding: 6px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                max-height: 200px;
                background: #1a1a2e;
            }
            .log-entry {
                display: flex;
                gap: 6px;
                padding: 4px 6px;
                margin-bottom: 3px;
                border-radius: 3px;
                background: #252540;
                color: #e0e0e0;
                word-break: break-word;
            }
            .log-entry.log-error { background: #3a1a1a; border-left: 3px solid #ff4444; }
            .log-entry.log-warn { background: #3a3a1a; border-left: 3px solid #ffaa00; }
            .log-entry.log-info { border-left: 3px solid #44aaff; }
            .log-entry .log-timestamp { color: #888; flex-shrink: 0; }
            .log-entry .log-type { font-weight: bold; flex-shrink: 0; min-width: 45px; }
            .log-entry.log-error .log-type { color: #ff6666; }
            .log-entry.log-warn .log-type { color: #ffcc00; }
            .log-entry.log-info .log-type { color: #66ccff; }
            .log-entry .log-message { flex: 1; white-space: pre-wrap; }
            .log-empty { color: #888; text-align: center; padding: 16px; }
        `;
        document.head.appendChild(style);
        
        // Log storage
        const logs = [];
        const maxLogs = 500;
        let visible = false;
        let container = null;
        let contentEl = null;
        
        const formatArg = (arg) => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        };
        
        const getLogClass = (type) => {
            switch(type) {
                case 'error': return 'log-entry log-error';
                case 'warn': return 'log-entry log-warn';
                default: return 'log-entry log-info';
            }
        };
        
        const addLog = (type, args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = Array.from(args).map(formatArg).join(' ');
            const entry = { type, message, timestamp };
            logs.push(entry);
            if (logs.length > maxLogs) logs.shift();
            
            if (visible && contentEl) {
                const entryEl = document.createElement('div');
                entryEl.className = getLogClass(type);
                entryEl.innerHTML = `
                    <span class="log-timestamp">${timestamp}</span>
                    <span class="log-type">[${type}]</span>
                    <span class="log-message">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                `;
                contentEl.appendChild(entryEl);
                contentEl.scrollTop = contentEl.scrollHeight;
            }
        };
        
        // Override console
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        
        console.log = (...args) => { originalLog.apply(console, args); addLog('log', args); };
        console.warn = (...args) => { originalWarn.apply(console, args); addLog('warn', args); };
        console.error = (...args) => { originalError.apply(console, args); addLog('error', args); };
        
        window.addEventListener('error', (e) => addLog('error', [`Error: ${e.message}`]));
        window.addEventListener('unhandledrejection', (e) => addLog('error', [`Promise Error: ${e.reason}`]));
        
        const render = () => {
            if (!visible) {
                container.innerHTML = `
                    <div class="log-console-toggle" id="log-toggle-btn">
                        <span class="log-icon">📋</span>
                        ${logs.length > 0 ? `<span class="log-count">${logs.length}</span>` : ''}
                    </div>
                `;
                const btn = container.querySelector('#log-toggle-btn');
                if (btn) {
                    btn.onclick = () => { visible = true; render(); };
                }
            } else {
                let entriesHtml = '';
                if (logs.length === 0) {
                    entriesHtml = '<div class="log-empty">No logs</div>';
                } else {
                    entriesHtml = logs.map(entry => `
                        <div class="${getLogClass(entry.type)}">
                            <span class="log-timestamp">${entry.timestamp}</span>
                            <span class="log-type">[${entry.type}]</span>
                            <span class="log-message">${entry.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                        </div>
                    `).join('');
                }
                
                container.innerHTML = `
                    <div class="log-console-panel">
                        <div class="log-console-header">
                            <span>Console (${logs.length})</span>
                            <div class="log-console-actions">
                                <button id="log-copy">📋 Copy</button>
                                <button id="log-clear">🗑️</button>
                                <button id="log-close">✕</button>
                            </div>
                        </div>
                        <div class="log-console-content">${entriesHtml}</div>
                    </div>
                `;
                
                contentEl = container.querySelector('.log-console-content');
                if (contentEl) {
                    contentEl.scrollTop = contentEl.scrollHeight;
                }
                
                const copyBtn = container.querySelector('#log-copy');
                if (copyBtn) {
                    copyBtn.onclick = () => {
                        const text = logs.map(e => `[${e.timestamp}] [${e.type.toUpperCase()}] ${e.message}`).join('\n');
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(text);
                        }
                    };
                }
                
                const clearBtn = container.querySelector('#log-clear');
                if (clearBtn) {
                    clearBtn.onclick = () => { logs.length = 0; render(); };
                }
                
                const closeBtn = container.querySelector('#log-close');
                if (closeBtn) {
                    closeBtn.onclick = () => { visible = false; render(); };
                }
            }
        };
        
        // Create container
        container = document.createElement('div');
        container.id = 'log-console-container';
        document.body.appendChild(container);
        
        // Initial render
        render();
        
        console.log('[Android] LogConsole initialized');
    }
    
    static updateLocale() {}
}

export default Controller;