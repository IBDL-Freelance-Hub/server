import {
  FileValidatorService,
  CV_MAX_SIZE_BYTES,
  PHOTO_MAX_SIZE_BYTES,
} from '../../../../src/modules/files/infrastructure/file-validator.service';
import { ValidationError } from '../../../../src/shared/errors';

describe('FileValidatorService Unit Tests', () => {
  let validator: FileValidatorService;

  beforeEach(() => {
    validator = new FileValidatorService();
  });

  describe('CV Validation (UPL-02, UPL-14, VAL-138)', () => {
    it('should successfully validate valid PDF buffer by magic bytes', () => {
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.7\n'),
        Buffer.from('binary pdf content stream endstream'),
      ]);

      const result = validator.validateCv(pdfBuffer, 'resume.pdf');

      expect(result.mimeType).toBe('application/pdf');
      expect(result.extension).toBe('pdf');
      expect(result.sizeBytes).toBe(pdfBuffer.length);
    });

    it('should successfully validate valid legacy Word DOC buffer by OLE magic bytes', () => {
      const docHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      const docBuffer = Buffer.concat([docHeader, Buffer.from('legacy word document stream data')]);

      const result = validator.validateCv(docBuffer, 'my-cv.doc');

      expect(result.mimeType).toBe('application/msword');
      expect(result.extension).toBe('doc');
      expect(result.sizeBytes).toBe(docBuffer.length);
    });

    it('should successfully validate valid DOCX buffer with ZIP header and Word document parts', () => {
      const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const docxPayload = Buffer.from(
        'word/document.xml and [Content_Types].xml entries inside zip archive',
      );
      const docxBuffer = Buffer.concat([zipHeader, docxPayload]);

      const result = validator.validateCv(docxBuffer, 'cv-final.docx');

      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(result.extension).toBe('docx');
      expect(result.sizeBytes).toBe(docxBuffer.length);
    });

    it('should reject generic ZIP archives pretending to be DOCX (no Word parts)', () => {
      const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const genericZipPayload = Buffer.from(
        'generic_files/photo.png and documents/notes.txt inside zip',
      );
      const genericZipBuffer = Buffer.concat([zipHeader, genericZipPayload]);

      expect(() => validator.validateCv(genericZipBuffer, 'fake.docx')).toThrow(ValidationError);
      expect(() => validator.validateCv(genericZipBuffer, 'fake.docx')).toThrow(
        'Invalid CV file format',
      );
    });

    it('should reject executable or PHP script masquerading with .pdf extension', () => {
      const phpScript = Buffer.from('<?php echo "malicious payload"; ?>');

      expect(() => validator.validateCv(phpScript, 'innocent.pdf')).toThrow(ValidationError);
      expect(() => validator.validateCv(phpScript, 'innocent.pdf')).toThrow(
        'Invalid CV file format',
      );

      const elfBinary = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]);
      expect(() => validator.validateCv(elfBinary, 'exploit.pdf')).toThrow(ValidationError);
    });

    it('should reject CV file exceeding 25MB size limit (UPL-14)', () => {
      const oversizedBuffer = Buffer.alloc(CV_MAX_SIZE_BYTES + 1);
      // Put valid PDF signature at start
      oversizedBuffer[0] = 0x25;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x44;
      oversizedBuffer[3] = 0x46;
      oversizedBuffer[4] = 0x2d;

      expect(() => validator.validateCv(oversizedBuffer, 'huge.pdf')).toThrow(ValidationError);
      expect(() => validator.validateCv(oversizedBuffer, 'huge.pdf')).toThrow(
        'exceeds the 25 MB limit',
      );
    });

    it('should reject empty or null buffer', () => {
      expect(() => validator.validateCv(Buffer.alloc(0), 'empty.pdf')).toThrow(ValidationError);
    });
  });

  describe('Profile Photo Validation (PRO-19, UPL-02)', () => {
    it('should successfully validate valid JPEG image by magic bytes', () => {
      const jpegBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from('JFIF binary image stream'),
      ]);

      const result = validator.validateProfilePhoto(jpegBuffer, 'avatar.jpg');

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.extension).toBe('jpg');
      expect(result.sizeBytes).toBe(jpegBuffer.length);
    });

    it('should successfully validate valid PNG image by magic bytes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const pngBuffer = Buffer.concat([pngHeader, Buffer.from('IHDR binary data for png image')]);

      const result = validator.validateProfilePhoto(pngBuffer, 'avatar.png');

      expect(result.mimeType).toBe('image/png');
      expect(result.extension).toBe('png');
      expect(result.sizeBytes).toBe(pngBuffer.length);
    });

    it('should successfully validate valid WebP image by RIFF and WEBP magic bytes', () => {
      // RIFF header (4 bytes) + 4 bytes size + WEBP marker (4 bytes)
      const riffHeader = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
      const dummyLength = Buffer.from([0x00, 0x00, 0x00, 0x20]);
      const webpMarker = Buffer.from([0x57, 0x45, 0x42, 0x50]); // WEBP
      const webpBuffer = Buffer.concat([
        riffHeader,
        dummyLength,
        webpMarker,
        Buffer.from('VP8 binary stream'),
      ]);

      const result = validator.validateProfilePhoto(webpBuffer, 'photo.webp');

      expect(result.mimeType).toBe('image/webp');
      expect(result.extension).toBe('webp');
      expect(result.sizeBytes).toBe(webpBuffer.length);
    });

    it('should reject HTML or text file pretending to be PNG (extension spoofing)', () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body>Spoofed</body></html>');

      expect(() => validator.validateProfilePhoto(htmlBuffer, 'photo.png')).toThrow(
        ValidationError,
      );
      expect(() => validator.validateProfilePhoto(htmlBuffer, 'photo.png')).toThrow(
        'Invalid profile photo format',
      );
    });

    it('should reject photo exceeding 5MB size limit (PRO-19)', () => {
      const oversizedBuffer = Buffer.alloc(PHOTO_MAX_SIZE_BYTES + 1);
      // Valid PNG header
      oversizedBuffer[0] = 0x89;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;
      oversizedBuffer[4] = 0x0d;
      oversizedBuffer[5] = 0x0a;
      oversizedBuffer[6] = 0x1a;
      oversizedBuffer[7] = 0x0a;

      expect(() => validator.validateProfilePhoto(oversizedBuffer, 'huge.png')).toThrow(
        ValidationError,
      );
      expect(() => validator.validateProfilePhoto(oversizedBuffer, 'huge.png')).toThrow(
        'exceeds the 5 MB limit',
      );
    });
  });
});
