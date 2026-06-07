import React from 'react';
import I18 from '../utils/I18';

// Log storage
const LogConsole = {
    logs: [],
    listeners: [],
    maxLogs: 500,
    
    log(type, args) {
        const timestamp = new Date().toLocaleTimeString();
        const message = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        const entry = { type, message, timestamp };
        this.logs.push(entry);
        
        // Keep only last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        this.notifyListeners(entry);
    },
    
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    },
    
    notifyListeners(entry) {
        this.listeners.forEach(callback => callback(entry));
    },
    
    clear() {
        this.logs = [];
        this.notifyListeners({ type: 'clear', message: '', timestamp: '' });
    },
    
    getLogs() {
        return [...this.logs];
    },
    
    getExportText() {
        return this.logs.map(entry => `[${entry.timestamp}] [${entry.type.toUpperCase()}] ${entry.message}`).join('\n');
    }
};

// Override console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    LogConsole.log('log', args);
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    LogConsole.log('warn', args);
};

console.error = function(...args) {
    originalError.apply(console, args);
    LogConsole.log('error', args);
};

// Also capture unhandled errors
window.addEventListener('error', (event) => {
    LogConsole.log('error', [`Unhandled Error: ${event.message} at ${event.filename}:${event.lineno}`]);
});

window.addEventListener('unhandledrejection', (event) => {
    LogConsole.log('error', [`Unhandled Promise Rejection: ${event.reason}`]);
});

class LogConsoleUI extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: false,
            logs: LogConsole.getLogs()
        };
        
        this.removeListener = null;
        this.scrollRef = null;
        
        this.toggle = this.toggle.bind(this);
        this.copyLogs = this.copyLogs.bind(this);
        this.clearLogs = this.clearLogs.bind(this);
    }
    
    componentDidMount() {
        this.removeListener = LogConsole.addListener((entry) => {
            if (entry.type === 'clear') {
                this.setState({ logs: [] });
            } else {
                this.setState({ logs: LogConsole.getLogs() }, () => {
                    if (this.scrollRef) {
                        this.scrollRef.scrollTop = this.scrollRef.scrollHeight;
                    }
                });
            }
        });
    }
    
    componentWillUnmount() {
        if (this.removeListener) {
            this.removeListener();
        }
    }
    
    toggle() {
        this.setState(prev => ({ visible: !prev.visible }));
    }
    
    copyLogs() {
        const text = LogConsole.getExportText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Logs copied to clipboard!');
            }).catch(err => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }
    
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('Logs copied to clipboard!');
        } catch (err) {
            alert('Failed to copy logs. Please select and copy manually.');
        }
        document.body.removeChild(textarea);
    }
    
    clearLogs() {
        LogConsole.clear();
    }
    
    getTypeClass(type) {
        switch(type) {
            case 'error': return 'log-error';
            case 'warn': return 'log-warn';
            default: return 'log-info';
        }
    }
    
    render() {
        if (!this.state.visible) {
            return (
                <div className="log-console-toggle" onClick={this.toggle} title="Open Console">
                    <span className="log-icon">📋</span>
                    <span className="log-count">{this.state.logs.length}</span>
                </div>
            );
        }
        
        return (
            <div className="log-console-panel">
                <div className="log-console-header">
                    <span>Console ({this.state.logs.length} logs)</span>
                    <div className="log-console-actions">
                        <button onClick={this.copyLogs} className="btn-small" title="Copy logs">
                            📋 Copy
                        </button>
                        <button onClick={this.clearLogs} className="btn-small" title="Clear logs">
                            🗑️ Clear
                        </button>
                        <button onClick={this.toggle} className="btn-small" title="Close">
                            ✕
                        </button>
                    </div>
                </div>
                <div className="log-console-content" ref={(ref) => this.scrollRef = ref}>
                    {this.state.logs.map((log, index) => (
                        <div key={index} className={`log-entry ${this.getTypeClass(log.type)}`}>
                            <span className="log-timestamp">{log.timestamp}</span>
                            <span className="log-type">[{log.type}]</span>
                            <span className="log-message">{log.message}</span>
                        </div>
                    ))}
                    {this.state.logs.length === 0 && (
                        <div className="log-empty">No logs yet</div>
                    )}
                </div>
            </div>
        );
    }
}

export default LogConsoleUI;
export { LogConsole };