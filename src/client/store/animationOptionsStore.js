/**
 * AnimationOptions Store
 * 
 * Stores user options for BetterTA animation export:
 * - generateAnimation: Whether to generate Animation.json from sprite names
 * - fps: Frame rate for generated animations
 * - canvasWidth/Height: Canvas dimensions
 * - backgroundColor: Background color
 */

let options = {
    generateAnimation: false,
    fps: 24,
    canvasWidth: 1280,
    canvasHeight: 720,
    backgroundColor: "#999999"
};

/**
 * Get all animation options
 */
function getOptions() {
    return { ...options };
}

/**
 * Set generate animation flag
 */
function setGenerateAnimation(value) {
    options.generateAnimation = !!value;
}

/**
 * Get generate animation flag
 */
function getGenerateAnimation() {
    return options.generateAnimation;
}

/**
 * Update multiple options at once
 */
function setOptions(newOptions) {
    if (newOptions.generateAnimation !== undefined) {
        options.generateAnimation = !!newOptions.generateAnimation;
    }
    if (newOptions.fps !== undefined) {
        options.fps = Math.max(1, Math.min(240, parseInt(newOptions.fps) || 24));
    }
    if (newOptions.canvasWidth !== undefined) {
        options.canvasWidth = Math.max(1, parseInt(newOptions.canvasWidth) || 1280);
    }
    if (newOptions.canvasHeight !== undefined) {
        options.canvasHeight = Math.max(1, parseInt(newOptions.canvasHeight) || 720);
    }
    if (newOptions.backgroundColor !== undefined) {
        options.backgroundColor = newOptions.backgroundColor || "#999999";
    }
}

/**
 * Clear all options (reset to defaults)
 */
function clear() {
    options.generateAnimation = false;
    options.fps = 24;
    options.canvasWidth = 1280;
    options.canvasHeight = 720;
    options.backgroundColor = "#999999";
}

export {
    getOptions,
    setOptions,
    setGenerateAnimation,
    getGenerateAnimation,
    clear
};

export default {
    getOptions,
    setOptions,
    setGenerateAnimation,
    getGenerateAnimation,
    clear
};
