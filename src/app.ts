import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.config';
import {
  requestIdMiddleware,
  languageMiddleware,
  errorHandlerMiddleware,
} from './shared/middleware';
import { NotFoundError } from './shared/errors';

import { membersRouter } from './modules/members/presentation/members.routes';
import { authRouter } from './modules/auth/presentation/auth.routes';

const app: Express = express();

// 1. Request ID Generation Middleware
app.use(requestIdMiddleware);

// 2. HTTP Security Headers (Safe defaults for local dev & cross-origin assets)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// 3. Cross-Origin Resource Sharing (SEC-09)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : env.CORS_ORIGIN;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// 4. JSON Body Parser (Strict payload size limit 100kb for DDoS mitigation)
app.use(express.json({ limit: '100kb' }));

// 5. URL-Encoded Body Parser
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 6. Cookie Parser
app.use(cookieParser(env.SESSION_SECRET));

// 7. Language Preference Parser
app.use(languageMiddleware);

// 8. Health Check Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 9. API Module Routes
app.use('/api/v1/members', membersRouter);
app.use('/api/v1/auth', authRouter);

// 10. Catch-All 404 Route Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// 11. Global Error Handler (Must be registered last)
app.use(errorHandlerMiddleware);

export default app;
