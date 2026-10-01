import { Request, Response, NextFunction } from 'express';
import { ListDiagnosticToolsUseCase } from '../application/list-diagnostic-tools.usecase';
import { OrderDiagnosticToolUseCase } from '../application/order-diagnostic-tool.usecase';
import { AuthenticationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class ShopController {
  constructor(
    private readonly listDiagnosticToolsUseCase: ListDiagnosticToolsUseCase = new ListDiagnosticToolsUseCase(),
    private readonly orderDiagnosticToolUseCase: OrderDiagnosticToolUseCase = new OrderDiagnosticToolUseCase(),
  ) {}

  getTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isPublic = !req.user;
      const tools = await this.listDiagnosticToolsUseCase.execute(req.user?.id);

      if (isPublic) {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      } else {
        res.setHeader('Cache-Control', 'private, no-cache');
      }

      res.status(200).json({
        success: true,
        data: tools,
      });
    } catch (error) {
      next(error);
    }
  };

  orderTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError(
          'Authentication required to order diagnostic assessment tools.',
        );
      }

      const slug = String(req.params['slug'] ?? '');
      const clientIp = getClientIp(req);

      const result = await this.orderDiagnosticToolUseCase.execute(req.user.id, slug, req.body, {
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
