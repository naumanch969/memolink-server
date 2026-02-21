export class FileUtil {
    /**
     * Extracts the file extension from a filename
     */
    static getFileExtension(filename: string): string {
        return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
    }

    /**
     * Converts byte size into a human-readable string (e.g., "1.5 MB")
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
