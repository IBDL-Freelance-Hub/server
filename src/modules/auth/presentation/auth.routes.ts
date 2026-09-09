import { Router } from 'express';
import { validateRequest } from '../../../shared/middleware';
import { activateAccountSchema, loginSchema } from './auth.schema';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

router.post('/activate', validateRequest({ body: activateAccountSchema }), controller.activate);

router.post('/login', validateRequest({ body: loginSchema }), controller.login);

router.post('/logout', controller.logout);

export const authRouter = router;
