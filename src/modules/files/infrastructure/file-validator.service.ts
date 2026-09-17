import { ValidationError } from '../../../shared/errors';

export const CV_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per UPL-14
export const PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per PRO-19

export interface ValidatedFileResult {
  mimeType: string;
  extension: string;
  sizeBytes: number;
}

export class FileValidatorService {
  /**
   * Validates Curriculum Vitae (CV) buffer, verifying magic bytes (UPL-02, VAL-138)
   * and 25MB maximum size (UPL-14).
   *
   * Allowed MIME types:
   * - application/pdf (.pdf)
   * - application/msword (.doc)
   * - application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
   */
  validateCv(buffer: Buffer, _originalName?: string): ValidatedFileResult {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('File buffer is empty or missing');
    }

    if (buffer.length > CV_MAX_SIZE_BYTES) {
      throw new ValidationError(
        `CV file size exceeds the 25 MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
      );
    }

    // 1. PDF signature: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    if (this.isPdf(buffer)) {
      return {
        mimeType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: buffer.length,
      };
    }

    // 2. Microsoft Word 97-2003 OLE Document (.doc): 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
    if (this.isDoc(buffer)) {
      return {
        mimeType: 'application/msword',
        extension: 'doc',
        sizeBytes: buffer.length,
      };
    }

    // 3. Microsoft Word OpenXML (.docx): ZIP header + word/ or [Content_Types].xml inspection
    if (this.isDocx(buffer)) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
        sizeBytes: buffer.length,
      };
    }

    throw new ValidationError(
      'Invalid CV file format. Only PDF, DOC, and DOCX files verified by signature are accepted (UPL-02, UPL-14).',
    );
  }

  /**
   * Validates Profile Photo image buffer, verifying magic bytes (UPL-02, VAL-138)
   * and 5MB maximum size (PRO-19).
   *
   * Allowed MIME types:
   * - image/jpeg (.jpg, .jpeg)
   * - image/png (.png)
   * - image/webp (.webp)
   */
  validateProfilePhoto(buffer: Buffer, _originalName?: string): ValidatedFileResult {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('File buffer is empty or missing');
    }

    if (buffer.length > PHOTO_MAX_SIZE_BYTES) {
      throw new ValidationError(
        `Profile photo file size exceeds the 5 MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
      );
    }

    // 1. JPEG signature: 0xFF 0xD8 0xFF
    if (this.isJpeg(buffer)) {
      return {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        sizeBytes: buffer.length,
      };
    }

    // 2. PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (this.isPng(buffer)) {
      return {
        mimeType: 'image/png',
        extension: 'png',
        sizeBytes: buffer.length,
      };
    }

    // 3. WEBP signature: RIFF at 0..3 and WEBP at 8..11
    if (this.isWebp(buffer)) {
      return {
        mimeType: 'image/webp',
        extension: 'webp',
        sizeBytes: buffer.length,
      };
    }

    throw new ValidationError(
      'Invalid profile photo format. Only JPEG, PNG, and WebP images verified by signature are accepted (PRO-19).',
    );
  }

  // --- Magic Byte Matchers ---

  private isPdf(buf: Buffer): boolean {
    if (buf.length < 5) return false;
    return (
      buf[0] === 0x25 && // %
      buf[1] === 0x50 && // P
      buf[2] === 0x44 && // D
      buf[3] === 0x46 && // F
      buf[4] === 0x2d // -
    );
  }

  private isDoc(buf: Buffer): boolean {
    if (buf.length < 8) return false;
    return (
      buf[0] === 0xd0 &&
      buf[1] === 0xcf &&
      buf[2] === 0x11 &&
      buf[3] === 0xe0 &&
      buf[4] === 0xa1 &&
      buf[5] === 0xb1 &&
      buf[6] === 0x1a &&
      buf[7] === 0xe1
    );
  }

  private isDocx(buf: Buffer): boolean {
    if (buf.length < 30) return false;
    // Standard ZIP local file header: 0x50 0x4B 0x03 0x04 (PK\x03\x04)
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

    if (!isZip) return false;

    // Prevent generic ZIP bypasses: scan for internal Word document markers
    // Standard DOCX packages contain "[Content_Types].xml" and "word/" folder entries
    const bufferSlice = buf.subarray(0, Math.min(buf.length, 4096)).toString('binary');
    const hasWordMarker =
      bufferSlice.includes('word/') ||
      bufferSlice.includes('[Content_Types].xml') ||
      buf.includes(Buffer.from('word/')) ||
      buf.includes(Buffer.from('[Content_Types].xml'));

    return hasWordMarker;
  }

  private isJpeg(buf: Buffer): boolean {
    if (buf.length < 3) return false;
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }

  private isPng(buf: Buffer): boolean {
    if (buf.length < 8) return false;
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }

  private isWebp(buf: Buffer): boolean {
    if (buf.length < 12) return false;
    const isRiff =
      buf[0] === 0x52 && // R
      buf[1] === 0x49 && // I
      buf[2] === 0x46 && // F
      buf[3] === 0x46; // F

    const isWebp =
      buf[8] === 0x57 && // W
      buf[9] === 0x45 && // E
      buf[10] === 0x42 && // B
      buf[11] === 0x50; // P

    return isRiff && isWebp;
  }
}

export const fileValidatorService = new FileValidatorService();
