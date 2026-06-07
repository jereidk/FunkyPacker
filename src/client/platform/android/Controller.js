class Controller {
    static init() {
        // Android-specific: setup back button handling
        if (typeof App !== 'undefined') {
            try {
                App.addListener('backButton', () => {
                    if (window.history.length > 1) {
                        window.history.back();
                    }
                });
            } catch (e) {
                // Ignore if App not available
            }
        }
    }
    static updateLocale() {}
}

export default Controller;