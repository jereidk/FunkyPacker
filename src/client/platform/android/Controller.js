import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

class Controller {
    static init() {
        this.injectCss("static/css/index-android.css");
        this.setupMobileUI();
        this.setupBackButton();
    }

    static injectCss(path) {
        let el = document.createElement("link");
        el.rel = "stylesheet";
        el.type = "text/css";
        el.href = path;
        document.head.appendChild(el);
    }

    static async setupMobileUI() {
        try {
            const { StatusBar } = await import('@capacitor/status-bar');
            await StatusBar.setBackgroundColor({ color: '#1a1a2e' });
            await StatusBar.setStyle({ style: 'DARK' });
        } catch (e) {
            console.log('StatusBar not available:', e);
        }
        
        try {
            const { SplashScreen } = await import('@capacitor/splash-screen');
            await SplashScreen.hide();
        } catch (e) {
            console.log('SplashScreen not available:', e);
        }
    }

    static async setupBackButton() {
        try {
            const { App } = await import('@capacitor/app');
            await App.addListener('backButton', () => {
                const activeRoute = window.location.pathname;
                if (activeRoute !== '/' && window.history.length > 1) {
                    window.history.back();
                } else {
                    App.exitApp();
                }
            });
        } catch (e) {
            console.log('App back button listener not available:', e);
        }
    }

    static updateLocale() {}
    static updateProject(path) {
        if (path) {
            console.log('Project saved to:', path);
        }
    }
}

export default Controller;