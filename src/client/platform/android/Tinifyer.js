class Tinifyer {
    static tinify(imageData, callback) {
        // No-op for Android (compression is done server-side or not supported)
        callback(imageData);
    }
    
    static async setKey(key) {
        // API key not supported on mobile
    }
}

export default Tinifyer;