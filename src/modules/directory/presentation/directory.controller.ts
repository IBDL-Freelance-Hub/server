import { Request, Response, NextFunction } from 'express';
import { SearchDirectoryUseCase, GetPublicTrainerProfileUseCase } from '../application';
import { DirectoryFilterCriteria } from '../domain';

export class DirectoryController {
  constructor(
    private readonly searchDirectoryUseCase: SearchDirectoryUseCase = new SearchDirectoryUseCase(),
    private readonly getPublicTrainerProfileUseCase: GetPublicTrainerProfileUseCase = new GetPublicTrainerProfileUseCase(),
  ) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');

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
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');

      const slug = (req.params.slug as string) || '';
      const profile = await this.getPublicTrainerProfileUseCase.execute(slug);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };
}
