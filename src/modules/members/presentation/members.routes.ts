import { Router } from 'express';
import { validateRequest } from '../../../shared/middleware';
import { registerMemberSchema, checkDuplicateSchema } from './members.schema';
import { MembersController } from './members.controller';

const router = Router();
const controller = new MembersController();

router.post('/register', validateRequest({ body: registerMemberSchema }), controller.register);

router.post(
  '/check-duplicate',
  validateRequest({ body: checkDuplicateSchema }),
  controller.checkDuplicate,
);

export const membersRouter = router;
