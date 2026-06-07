import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

import Base64ImagesLoader from '../../utils/Base64ImagesLoader';

const IMAGES_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

class FileSystem {
    static fixPath(path) {
        return path.split("\\").join("/");
    }

    static getExtFromPath(path) {
        return path.split(".").pop().toLowerCase();
    }

    static async selectFolder() {
        return null;
    }

    static async addImages() {
        return new Promise(async (resolve) => {
            try {
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
                                folder: "",
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
            } catch (e) {
                console.log('File picker error:', e);
                resolve(null);
            }
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
                console.log('Error loading image:', e);
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

    static async saveProject(data, path = "") {
        try {
            let projectData = JSON.stringify(data, null, 2);
            
            const result = await Filesystem.writeFile({
                path: 'funkin-packer-project.ftpp',
                data: projectData,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });

            console.log('Project saved to:', result.uri);
            return result.uri;
        } catch (e) {
            console.log('Save project error:', e);
            return null;
        }
    }

    static async loadProject(pathToLoad = "") {
        try {
            if (pathToLoad) {
                const contents = await Filesystem.readFile({
                    path: pathToLoad,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });

                let data = JSON.parse(contents.data);
                console.log('Project loaded from:', pathToLoad);
                return { path: pathToLoad, data };
            } else {
                return { path: null, data: null };
            }
        } catch (e) {
            console.log('Load project error:', e);
            return { path: null, data: null };
        }
    }
}

export default FileSystem;