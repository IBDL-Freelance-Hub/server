import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth, filesRateLimiter } from '../../../shared/middleware';
import { FilesController } from './files.controller';
import { FileValidationError } from '../../../shared/errors';
import { env } from '../../../config/env.config';

const router = Router();
const controller = new FilesController();

// Apply rate limiting across files endpoints (10 requests per 5 minutes per IP)
router.use(filesRateLimiter);

const cvFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const isImageMime = file.mimetype.toLowerCase().startsWith('image/');
  const isImageExt = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.svg',
    '.bmp',
    '.ico',
    '.tiff',
    '.avif',
  ].includes(ext);

  if (isImageMime || isImageExt) {
    return cb(
      new FileValidationError(
        'Invalid CV file format. An image was uploaded instead of a CV document. Only PDF, DOC, and DOCX files verified by signature are accepted (UPL-02, UPL-14).',
      ),
    );
  }

  const allowedExts = ['.pdf', '.doc', '.docx'];
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ];

  if (
    !allowedExts.includes(ext) ||
    (!allowedMimes.includes(file.mimetype) && file.mimetype !== '')
  ) {
    return cb(
      new FileValidationError(
        'Invalid CV file format. Only PDF, DOC, and DOCX files verified by signature are accepted (UPL-02, UPL-14).',
      ),
    );
  }

  cb(null, true);
};

// Multer memory storage configurations:
// Separate upload size ceilings per specification (UPL-14, PRO-19):
// CV max ceiling 25MB; Profile photo max ceiling 5MB.
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max ceiling for CV (UPL-14)
  },
  fileFilter: cvFileFilter,
});

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max ceiling for Profile Photo (PRO-19)
  },
});

// Protected File Endpoints (requireAuth)
router.post('/cv', requireAuth, uploadCv.single('file'), controller.uploadCv);
router.post('/photo', requireAuth, uploadPhoto.single('file'), controller.uploadProfilePhoto);
router.delete('/photo', requireAuth, controller.deleteProfilePhoto);
router.get('/:fileId/download', requireAuth, controller.downloadFile);

// Development/Testing Only Route: Exclusively registered when STORAGE_PROVIDER === 'local'
if (env.STORAGE_PROVIDER === 'local') {
  router.get(['/raw/:storageKey', '/raw/*'], controller.serveRawLocalFile);
}

export const filesRouter = router;
