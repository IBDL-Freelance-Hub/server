import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { env } from '../../config/env.config';

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const timestamp = new Date().toISOString();
  const requestId = req.id || 'N/A';

  if (err instanceof AppError) {
    if (env.NODE_ENV === 'development') {
      console.warn(`[AppError] [${requestId}] ${err.code} (${err.statusCode}): ${err.message}`);
    }

    const title =
      (err as unknown as Record<string, unknown>).title ||
      ((err.details as unknown as Record<string, unknown>)?.title as string) ||
      undefined;

    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      title,
      message: err.message,
      details: err.details ?? null,
      requestId,
      timestamp,
    });
    return;
  }

  // Handle Multer upload limits and errors gracefully (e.g. LIMIT_FILE_SIZE)
  if (err.name === 'MulterError') {
    const multerErr = err as unknown as { code?: string; message?: string };
    const message =
      multerErr.code === 'LIMIT_FILE_SIZE'
        ? 'File size exceeds maximum allowable limit (25 MB for CV, 5 MB for Photo)'
        : err.message || 'File upload failed';
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message,
      details: null,
      requestId,
      timestamp,
    });
    return;
  }

  // Internal Server Error (Unhandled)
  console.error(`[UnhandledError] [${requestId}]:`, err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred.',
      details: null,
      requestId,
      timestamp,
    },
  });
};
