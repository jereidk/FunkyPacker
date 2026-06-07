import Base64ImagesLoader from '../../utils/Base64ImagesLoader';

const IMAGES_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

class FileSystem {
    static fixPath(path) {
        return path.replace(/\\/g, '/');
    }

    static getExtFromPath(path) {
        return path.split('.').pop().toLowerCase();
    }

    static async selectFolder() {
        return null;
    }

    static async addImages() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = IMAGES_EXT.map(ext => `image/${ext === 'jpg' ? 'jpeg' : ext}`).join(',');
            input.multiple = true;
            
            input.onchange = async (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    let imageFiles = [];
                    for (let file of files) {
                        imageFiles.push({
                            name: file.name,
                            path: '',
                            folder: '',
                            data: file
                        });
                    }
                    let loadedFiles = await FileSystem.loadImagesFromBlobs(imageFiles);
                    resolve(loadedFiles);
                } else {
                    resolve(null);
                }
            };
            
            input.click();
        });
    }

    static async addFolder() {
        return await FileSystem.addImages();
    }

    static async loadImagesFromBlobs(list) {
        let files = [];
        let objectUrls = [];

        for (let item of list) {
            try {
                let url = URL.createObjectURL(item.data);
                objectUrls.push(url);
                files.push({
                    name: item.name,
                    url: url,
                    fsPath: item
                });
            } catch (e) {
                console.error('Error loading image:', e);
            }
        }

        return new Promise((resolve) => {
            let loader = new Base64ImagesLoader();
            loader.load(files, null, (res) => {
                for (let url of objectUrls) {
                    URL.revokeObjectURL(url);
                }
                resolve(res);
            });
        });
    }

    static startWatch(path) {}
    static stopWatch(path) {}
    static terminateWatch() {}
    
    static async saveProject(data, path = '') {
        return null;
    }
    
    static async loadProject(pathToLoad = '') {
        return { path: null, data: null };
    }
}

export default FileSystem;