type SignatureCheck = (buffer: Buffer) => boolean;

const startsWith = (buffer: Buffer, signature: number[], offset = 0) => {
    if (buffer.length < offset + signature.length) return false;
    return signature.every((byte, i) => buffer[offset + i] === byte);
};

const MAGIC_CHECKS: Record<string, SignatureCheck> = {
    // Images
    'image/jpeg': buffer => startsWith(buffer, [0xff, 0xd8, 0xff]),
    'image/png': buffer => startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'image/gif': buffer =>
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
    'image/webp': buffer =>
        startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && // RIFF
        startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8), // WEBP

    // Video
    'video/mp4': buffer => startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4), // ftyp
    'video/quicktime': buffer => startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4),
    'video/webm': buffer => startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]),

    // Audio
    'audio/mpeg': buffer =>
        startsWith(buffer, [0xff, 0xfb]) ||
        startsWith(buffer, [0xff, 0xfa]) ||
        startsWith(buffer, [0x49, 0x44, 0x33]), // ID3
    'audio/wav': buffer => startsWith(buffer, [0x52, 0x49, 0x46, 0x46]), // RIFF
    'audio/ogg': buffer => startsWith(buffer, [0x4f, 0x67, 0x67, 0x53]),

    // Documents
    'application/pdf': buffer => startsWith(buffer, [0x25, 0x50, 0x44, 0x46]),

    // Archives
    'application/zip': buffer =>
        startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]),
    'application/x-rar-compressed': buffer =>
        startsWith(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]),
    'application/x-7z-compressed': buffer =>
        startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
    'application/gzip': buffer => startsWith(buffer, [0x1f, 0x8b]),
    'application/x-tar': buffer => startsWith(buffer, [0x75, 0x73, 0x74, 0x61, 0x72], 257),

    // Legacy Office (OLE)
    'application/msword': buffer =>
        startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    'application/vnd.ms-excel': buffer =>
        startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),

    // Modern Office (ZIP container)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        buffer => MAGIC_CHECKS['application/zip'](buffer),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        buffer => MAGIC_CHECKS['application/zip'](buffer),
};

// MIME types that cannot be reliably validated
const SKIP_VALIDATION = new Set([
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/x-markdown',
    'application/json',
    'text/xml',
    'application/xml',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-java',
    'text/css',
    'text/html',
    'text/x-yaml',
    'application/x-yaml',
]);

const MIME_TO_EXT: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',

    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',

    // Audio
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',

    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',

    // Archives
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',

    // Text
    'text/plain': 'txt',
    'application/json': 'json',
    'text/csv': 'csv',
    'text/xml': 'xml',
    'application/xml': 'xml',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'text/typescript': 'ts',
    'text/x-python': 'py',
    'text/x-java': 'java',
    'text/css': 'css',
    'text/html': 'html',
    'text/x-yaml': 'yaml',
    'application/x-yaml': 'yaml',
};

export interface ValidationResult {
    valid: boolean;
    detectedType?: string;
    error?: string;
}

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

    /**
     * Validate file magic bytes
     */
    static validateFileMagicBytes(buffer: Buffer, declaredMimeType: string): ValidationResult {
        if (!buffer || buffer.length === 0) {
            return { valid: false, error: 'Empty file buffer' };
        }

        if (SKIP_VALIDATION.has(declaredMimeType)) {
            return { valid: true };
        }

        const validator = MAGIC_CHECKS[declaredMimeType];

        // Unknown types: be permissive
        if (!validator) {
            return { valid: true };
        }

        if (validator(buffer)) {
            return { valid: true };
        }

        const detectedType = this.detectFileType(buffer);

        return {
            valid: false,
            detectedType,
            error: `File content does not match declared type ${declaredMimeType}${detectedType ? `. Detected: ${detectedType}` : ''
                }`,
        };
    }

    /**
     * Detect file type from magic bytes
     */
    static detectFileType(buffer: Buffer): string | undefined {
        for (const [mimeType, check] of Object.entries(MAGIC_CHECKS)) {
            if (check(buffer)) {
                return mimeType;
            }
        }
        return undefined;
    }

    /**
     * Get extension from mime type
     */
    static getExtensionFromMimeType(mimeType: string): string {
        return MIME_TO_EXT[mimeType] ?? mimeType.split('/').pop() ?? 'bin';
    }
}
