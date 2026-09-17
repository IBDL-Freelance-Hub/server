import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.config';
import { swaggerSpec } from './config/swagger.config';
import {
  requestIdMiddleware,
  languageMiddleware,
  errorHandlerMiddleware,
} from './shared/middleware';
import { NotFoundError } from './shared/errors';

import { membersRouter } from './modules/members/presentation/members.routes';
import { authRouter } from './modules/auth/presentation/auth.routes';
import { filesRouter } from './modules/files/presentation/files.routes';
import { membershipRouter } from './modules/membership/presentation/membership.routes';

const app: Express = express();

// 1. Request ID Generation Middleware
app.use(requestIdMiddleware);

// 2. HTTP Security Headers (Safe defaults for local dev, Swagger UI CDN & cross-origin assets)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdnjs.cloudflare.com',
        ],
        'style-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      },
    },
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

// 9. Swagger API Documentation Endpoints (Standalone HTML for Serverless Vercel Compatibility)
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get(['/docs', '/docs/', '/api-docs', '/api-docs/'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>IBDL Freelancers Hub API Documentation</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui.min.css" />
      <style>
        html { box-sizing: border-box; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui-bundle.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui-standalone-preset.min.js"></script>
      <script>
        window.onload = function() {
          window.ui = SwaggerUIBundle({
            url: "/api-docs.json",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
          });
        };
      </script>
    </body>
    </html>
  `);
});

// 10. API Module Routes
app.use('/api/v1/members', membersRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/memberships', membershipRouter);

// 11. Catch-All 404 Route Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// 12. Global Error Handler (Must be registered last)
app.use(errorHandlerMiddleware);

export default app;
