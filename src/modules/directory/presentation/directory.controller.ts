import { Request, Response, NextFunction } from 'express';
import { SearchDirectoryUseCase, GetPublicTrainerProfileUseCase } from '../application';
import { DirectoryFilterCriteria } from '../domain';
import {
  DirectoryCacheService,
  directoryCacheService as defaultCacheService,
} from '../infrastructure/directory-cache.service';

export class DirectoryController {
  constructor(
    private readonly searchDirectoryUseCase: SearchDirectoryUseCase = new SearchDirectoryUseCase(),
    private readonly getPublicTrainerProfileUseCase: GetPublicTrainerProfileUseCase = new GetPublicTrainerProfileUseCase(),
    private readonly cacheService: DirectoryCacheService = defaultCacheService,
  ) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

      const cacheKey = `directory:cache:${JSON.stringify(req.query)}`;
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.status(200).json({
          success: true,
          data: cached,
        });
        return;
      }

      res.setHeader('X-Cache', 'MISS');

      const filter: DirectoryFilterCriteria = {
        search: req.query.search as string | undefined,
        expertise: req.query.expertise as string | string[] | undefined,
        industry: req.query.industry as string | string[] | undefined,
        language: req.query.language as string | string[] | undefined,
        country: req.query.country as string | undefined,
        city: req.query.city as string | undefined,
        tier: req.query.tier as DirectoryFilterCriteria['tier'],
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await this.searchDirectoryUseCase.execute(filter);
      this.cacheService.set(cacheKey, result, 30);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfileBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

      const slug = (req.params.slug as string) || '';
      const cacheKey = `directory:profile:${slug}`;
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.status(200).json({
          success: true,
          data: cached,
        });
        return;
      }

      res.setHeader('X-Cache', 'MISS');

      const profile = await this.getPublicTrainerProfileUseCase.execute(slug);
      this.cacheService.set(cacheKey, profile, 30);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };
}
