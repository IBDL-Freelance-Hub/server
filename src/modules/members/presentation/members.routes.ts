import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { validateRequest, requireAuth, registrationRateLimiter } from '../../../shared/middleware';
import { ValidationError } from '../../../shared/errors';
import {
  registerMemberSchema,
  checkDuplicateSchema,
  updateMemberProfileSchema,
} from './members.schema';
import { MembersController } from './members.controller';

const router = Router();
const controller = new MembersController();

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
      new ValidationError(
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
      new ValidationError(
        'Invalid CV file format. Only PDF, DOC, and DOCX files verified by signature are accepted (UPL-02, UPL-14).',
      ),
    );
  }

  cb(null, true);
};

const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max ceiling for CV (UPL-14)
  },
  fileFilter: cvFileFilter,
});

router.post(
  '/register',
  registrationRateLimiter,
  uploadCv.single('file'),
  (req, _res, next) => {
    const rawBody = req.body as Record<string, unknown> | undefined;
    if (rawBody && typeof rawBody.payload === 'string') {
      try {
        const parsed = JSON.parse(rawBody.payload);
        req.body = { ...rawBody, ...parsed };
        delete (req.body as Record<string, unknown>).payload;
      } catch {
        // Fallback: keep existing req.body
      }
    }
    const currentBody = req.body as Record<string, unknown> | undefined;
    if (currentBody) {
      const parseArray = (val: unknown): string[] => {
        if (Array.isArray(val)) return val.map(String);
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map(String);
          } catch {
            return val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
        return [];
      };

      if (currentBody.areasOfExpertise !== undefined) {
        currentBody.areasOfExpertise = parseArray(currentBody.areasOfExpertise);
      }
      if (currentBody.industriesServed !== undefined) {
        currentBody.industriesServed = parseArray(currentBody.industriesServed);
      }
      if (currentBody.directoryOptIn === 'true') currentBody.directoryOptIn = true;
      if (currentBody.directoryOptIn === 'false') currentBody.directoryOptIn = false;
      if (currentBody.termsAccepted === 'true') currentBody.termsAccepted = true;
    }
    next();
  },
  validateRequest({ body: registerMemberSchema }),
  controller.register,
);

router.post(
  '/check-duplicate',
  validateRequest({ body: checkDuplicateSchema }),
  controller.checkDuplicate,
);

// Member Dashboard & Profile Routes (Protected)
router.get('/dashboard', requireAuth, controller.getDashboard);
router.get('/profile', requireAuth, controller.getProfile);

router.patch(
  '/profile',
  requireAuth,
  validateRequest({ body: updateMemberProfileSchema }),
  controller.updateProfile,
);

// Member Requests & Workflow Tracking (MEM-78, MEM-78f)
import { memberRequestsRouter } from '../../requests/presentation/member-requests.routes';
router.use('/requests', memberRequestsRouter);

export const membersRouter = router;
