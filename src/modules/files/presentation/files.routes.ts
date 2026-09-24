import { Router } from 'express';
import multer from 'multer';
import { requireAuth, filesRateLimiter } from '../../../shared/middleware';
import { FilesController } from './files.controller';
import { env } from '../../../config/env.config';

const router = Router();
const controller = new FilesController();

// Apply rate limiting across files endpoints (10 requests per 5 minutes per IP)
router.use(filesRateLimiter);

// Multer memory storage configurations:
// Separate upload size ceilings per specification (UPL-14, PRO-19):
// CV max ceiling 25MB; Profile photo max ceiling 5MB.
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max ceiling for CV (UPL-14)
  },
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
