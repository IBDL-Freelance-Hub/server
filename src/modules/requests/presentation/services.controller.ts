import { Request, Response, NextFunction } from 'express';
import { ListCoreServicesUseCase } from '../application/list-core-services.usecase';
import { RequestCoreServiceUseCase } from '../application/request-core-service.usecase';
import { AuthenticationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class ServicesController {
  constructor(
    private readonly listCoreServicesUseCase: ListCoreServicesUseCase = new ListCoreServicesUseCase(),
    private readonly requestCoreServiceUseCase: RequestCoreServiceUseCase = new RequestCoreServiceUseCase(),
  ) {}

  getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isPublic = !req.user;
      const services = await this.listCoreServicesUseCase.execute(req.user?.id);

      if (isPublic) {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      } else {
        res.setHeader('Cache-Control', 'private, no-cache');
      }

      res.status(200).json({
        success: true,
        data: services,
      });
    } catch (error) {
      next(error);
    }
  };

  requestService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to request hub services.');
      }

      const slug = String(req.params['slug'] ?? '');
      const clientIp = getClientIp(req);

      const result = await this.requestCoreServiceUseCase.execute(req.user.id, slug, req.body, {
        ipAddress: clientIp,
        requestId: req.id,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
