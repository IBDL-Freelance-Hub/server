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

const app: Express = express();

// 1. Request ID Generation Middleware
app.use(requestIdMiddleware);

// 2. HTTP Security Headers
app.use(helmet());

// 3. Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// 4. JSON Body Parser
app.use(express.json({ limit: '10mb' }));

// 5. URL-Encoded Body Parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// 9. Catch-All 404 Route Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// 10. Global Error Handler (Must be registered last)
app.use(errorHandlerMiddleware);

export default app;
