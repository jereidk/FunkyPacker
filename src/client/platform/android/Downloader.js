class Downloader {
    static download(filename, data) {
        // Use web download functionality for Android
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    static downloadImage(filename, imageData) {
        Downloader.download(filename, imageData);
    }
    
    static downloadZip(filename, data) {
        Downloader.download(filename, data);
    }
}

export default Downloader;