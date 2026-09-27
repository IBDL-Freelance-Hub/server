import { Router } from 'express';
import multer from 'multer';
import { validateRequest, requireAuth, registrationRateLimiter } from '../../../shared/middleware';
import {
  registerMemberSchema,
  checkDuplicateSchema,
  updateMemberProfileSchema,
} from './members.schema';
import { MembersController } from './members.controller';

const router = Router();
const controller = new MembersController();

const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max ceiling for CV (UPL-14)
  },
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

export const membersRouter = router;
