import JSZip from 'jszip';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

class Downloader {

    static async run(files, fileName, savePath) {
        try {
            let zip = new JSZip();

            const currDate = new Date();
            const dateWithOffset = new Date(currDate.getTime() - currDate.getTimezoneOffset() * 60000);
            JSZip.defaults.date = dateWithOffset;

            for (let file of files) {
                zip.file(file.name, file.content, { base64: !!file.base64 });
            }

            let ext = fileName.split(".").pop();
            if (ext !== "zip") fileName = fileName + ".zip";

            const zipContent = await zip.generateAsync({ type: "blob" });
            const base64Data = await this.blobToBase64(zipContent);
            const timestamp = Date.now();
            const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `FunkinPacker_${timestamp}_${safeFileName}`;

            await Filesystem.writeFile({
                path: filePath,
                data: base64Data,
                directory: Directory.Downloads,
                encoding: Encoding.UTF8
            });

            try {
                const fileUri = await Filesystem.getUri({
                    path: filePath,
                    directory: Directory.Downloads
                });
                
                await Share.share({
                    title: 'Funkin Packer Export',
                    text: `Spritesheet: ${fileName}`,
                    url: fileUri.uri,
                    dialogTitle: 'Share your spritesheet'
                });
            } catch (shareError) {
                console.log('Share cancelled or not available:', shareError);
            }
        } catch (e) {
            console.error('Download error:', e);
        }
    }

    static async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

export default Downloader;