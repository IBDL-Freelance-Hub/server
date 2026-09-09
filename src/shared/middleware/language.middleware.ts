import { Request, Response, NextFunction } from 'express';

export const languageMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const acceptLanguage = req.headers['accept-language'] || '';
  const isArabic = acceptLanguage.toLowerCase().includes('ar');

  req.language = isArabic ? 'ar' : 'en';
  next();
};
