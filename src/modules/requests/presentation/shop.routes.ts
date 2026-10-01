import { Router } from 'express';
import { optionalAuth, requireAuth, validateRequest } from '../../../shared/middleware';
import { ShopController } from './shop.controller';
import { toolSlugParamSchema, orderDiagnosticToolSchema } from './shop.schema';

const router = Router();
const controller = new ShopController();

// GET /api/v1/shop/tools — Diagnostic Tools Shop Catalog (PQP™, CPAT™, Management Drives®)
router.get('/tools', optionalAuth, controller.getTools);

// POST /api/v1/shop/tools/:slug/order — Order a Diagnostic Assessment Instrument
router.post(
  '/tools/:slug/order',
  requireAuth,
  validateRequest({
    params: toolSlugParamSchema,
    body: orderDiagnosticToolSchema,
  }),
  controller.orderTool,
);

export const shopRouter = router;
