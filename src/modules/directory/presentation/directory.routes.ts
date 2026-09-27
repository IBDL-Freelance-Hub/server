import { Router } from 'express';
import { validateRequest } from '../../../shared/middleware';
import { directoryFilterQuerySchema, getTrainerSlugParamsSchema } from './directory.schema';
import { DirectoryController } from './directory.controller';

const router = Router();
const controller = new DirectoryController();

// GET /api/v1/directory - Public directory search and filter (DIR-01 to DIR-18, PRO-33 to PRO-38)
router.get('/', validateRequest({ query: directoryFilterQuerySchema }), controller.search);

// GET /api/v1/directory/:slug - Public trainer profile by slug (DIR-19, DIR-20, PRO-34)
router.get(
  '/:slug',
  validateRequest({ params: getTrainerSlugParamsSchema }),
  controller.getProfileBySlug,
);

export const directoryRouter = router;
