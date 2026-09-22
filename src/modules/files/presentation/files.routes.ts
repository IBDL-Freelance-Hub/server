import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../../shared/middleware';
import { FilesController } from './files.controller';
import { env } from '../../../config/env.config';

const router = Router();
const controller = new FilesController();

// Multer memory storage configuration (UPL-02, UPL-14)
// In-memory buffer allows direct magic byte signature inspection before persisting to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max ceiling for multipart body
  },
});

// Protected File Endpoints (requireAuth)
router.post('/cv', requireAuth, upload.single('file'), controller.uploadCv);
router.post('/photo', requireAuth, upload.single('file'), controller.uploadProfilePhoto);
router.delete('/photo', requireAuth, controller.deleteProfilePhoto);
router.get('/:fileId/download', requireAuth, controller.downloadFile);

// Development/Testing Only Route: Exclusively registered when STORAGE_PROVIDER === 'local'
if (env.STORAGE_PROVIDER === 'local') {
  router.get(['/raw/:storageKey', '/raw/*'], controller.serveRawLocalFile);
}

export const filesRouter = router;
