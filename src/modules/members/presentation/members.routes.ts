import { Router } from 'express';
import { validateRequest } from '../../../shared/middleware';
import { registerMemberSchema } from './members.schema';
import { MembersController } from './members.controller';

const router = Router();
const controller = new MembersController();

router.post('/register', validateRequest({ body: registerMemberSchema }), controller.register);

export const membersRouter = router;
