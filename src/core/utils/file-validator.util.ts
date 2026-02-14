/**
 * File Magic Byte Validator
 * Validates file content matches declared MIME type to prevent malicious uploads
 */

// Magic byte signatures for common file types
const MAGIC_SIGNATURES: { [key: string]: Buffer[] } = {
  // Images
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF header, need to also check WEBP

  // Videos
  'video/mp4': [Buffer.from([0x00, 0x00, 0x00]), Buffer.from([0x66, 0x74, 0x79, 0x70])], // ftyp at offset 4
  'video/webm': [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
  'video/quicktime': [Buffer.from([0x00, 0x00, 0x00]), Buffer.from([0x66, 0x74, 0x79, 0x70])],

  // Audio
  'audio/mpeg': [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xFA]), Buffer.from([0x49, 0x44, 0x33])], // MP3 or ID3
  'audio/wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF
  'audio/ogg': [Buffer.from([0x4F, 0x67, 0x67, 0x53])],

  // Documents
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  
  // Archives 
  'application/zip': [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
  'application/x-zip-compressed': [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
  'application/x-rar-compressed': [Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07])], // Rar!
  'application/x-7z-compressed': [Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])], // 7z
  'application/gzip': [Buffer.from([0x1F, 0x8B])],
  'application/x-tar': [Buffer.from([0x75, 0x73, 0x74, 0x61, 0x72])], // ustar at offset 257
  
  // Office documents (all use ZIP container)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  
  // Legacy Office formats (OLE container)
  'application/msword': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
  'application/vnd.ms-excel': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],

  // Text/Code files - no magic bytes, skip validation
  'text/plain': [],
  'text/csv': [],
  'text/markdown': [],
  'text/x-markdown': [],
  'application/json': [],
  'text/xml': [],
  'application/xml': [],
  'text/javascript': [],
  'application/javascript': [],
  'text/typescript': [],
  'text/x-python': [],
  'text/x-java': [],
  'text/css': [],
  'text/html': [],
  'text/x-yaml': [],
  'application/x-yaml': [],
};

// MIME types that don't have reliable magic bytes
const SKIP_VALIDATION_TYPES = [
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
];

export interface ValidationResult {
  valid: boolean;
  detectedType?: string;
  error?: string;
}

/**
 * Validates file buffer against declared MIME type using magic bytes
 */
export function validateFileMagicBytes(
  buffer: Buffer,
  declaredMimeType: string
): ValidationResult {
  // Skip validation for text-based types
  if (SKIP_VALIDATION_TYPES.includes(declaredMimeType)) {
    return { valid: true };
  }

  // Get expected signatures for this MIME type
  const expectedSignatures = MAGIC_SIGNATURES[declaredMimeType];
  
  // If we don't have signatures for this type, allow it (be permissive for unknown types)
  if (!expectedSignatures || expectedSignatures.length === 0) {
    return { valid: true };
  }

  // Check if buffer starts with any of the expected signatures
  for (const signature of expectedSignatures) {
    if (buffer.length >= signature.length) {
      const bufferStart = buffer.subarray(0, signature.length);
      if (bufferStart.equals(signature)) {
        return { valid: true };
      }

      // Special handling for MP4/MOV (ftyp at offset 4)
      if ((declaredMimeType === 'video/mp4' || declaredMimeType === 'video/quicktime') && buffer.length >= 8) {
        const ftypSignature = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp'
        const ftypCheck = buffer.subarray(4, 8);
        if (ftypCheck.equals(ftypSignature)) {
          return { valid: true };
        }
      }

      // Special handling for WebP (RIFF + WEBP)
      if (declaredMimeType === 'image/webp' && buffer.length >= 12) {
        const riffSignature = Buffer.from([0x52, 0x49, 0x46, 0x46]); // 'RIFF'
        const webpSignature = Buffer.from([0x57, 0x45, 0x42, 0x50]); // 'WEBP'
        const riffCheck = buffer.subarray(0, 4);
        const webpCheck = buffer.subarray(8, 12);
        if (riffCheck.equals(riffSignature) && webpCheck.equals(webpSignature)) {
          return { valid: true };
        }
      }
    }
  }

  // Try to detect actual type
  const detectedType = detectFileType(buffer);

  return {
    valid: false,
    detectedType,
    error: `File content does not match declared type ${declaredMimeType}${detectedType ? `. Detected: ${detectedType}` : ''}`
  };
}

/**
 * Attempts to detect file type from buffer
 */
export function detectFileType(buffer: Buffer): string | undefined {
  for (const [mimeType, signatures] of Object.entries(MAGIC_SIGNATURES)) {
    if (signatures.length === 0) continue;
    
    for (const signature of signatures) {
      if (buffer.length >= signature.length) {
        const bufferStart = buffer.subarray(0, signature.length);
        if (bufferStart.equals(signature)) {
          return mimeType;
        }
      }
    }
  }
  return undefined;
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: { [key: string]: string } = {
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    // Videos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    // Documents
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',

    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',

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
  
  return mimeToExt[mimeType] || mimeType.split('/').pop() || 'bin';
}

export default {
  validateFileMagicBytes,
  detectFileType,
  getExtensionFromMimeType,
};
