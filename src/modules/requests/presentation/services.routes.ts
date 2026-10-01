import { Router } from 'express';
import { optionalAuth, requireAuth, validateRequest } from '../../../shared/middleware';
import { ServicesController } from './services.controller';
import { slugParamSchema, requestCoreServiceSchema } from './services.schema';

const router = Router();
const controller = new ServicesController();

// GET /api/v1/services — 12 Canonical Core Hub Services Catalog
router.get('/', optionalAuth, controller.getServices);

// POST /api/v1/services/:slug/request — Request a Core Hub Service
router.post(
  '/:slug/request',
  requireAuth,
  validateRequest({
    params: slugParamSchema,
    body: requestCoreServiceSchema,
  }),
  controller.requestService,
);

export const servicesRouter = router;
