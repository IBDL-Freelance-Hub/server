import { Request, Response, NextFunction } from 'express';
import { ListMemberRequestsUseCase } from '../application/list-member-requests.usecase';
import { GetMemberRequestByRefUseCase } from '../application/get-member-request-by-ref.usecase';
import { CancelMemberRequestUseCase } from '../application/cancel-member-request.usecase';
import { PayMemberRequestUseCase } from '../application/pay-member-request.usecase';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class MemberRequestsController {
  constructor(
    private readonly listMemberRequestsUseCase: ListMemberRequestsUseCase = new ListMemberRequestsUseCase(),
    private readonly getMemberRequestByRefUseCase: GetMemberRequestByRefUseCase = new GetMemberRequestByRefUseCase(),
    private readonly cancelMemberRequestUseCase: CancelMemberRequestUseCase = new CancelMemberRequestUseCase(),
    private readonly payMemberRequestUseCase: PayMemberRequestUseCase = new PayMemberRequestUseCase(),
  ) {}

  private getIdentifier(req: Request): string {
    const raw = req.params['id'] ?? req.params['referenceCode'];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    if (Array.isArray(raw) && raw[0]) {
      return raw[0].trim();
    }
    throw new ValidationError('Request ID or reference code parameter is required.');
  }

  listRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to view your engagement requests.');
      }

      const result = await this.listMemberRequestsUseCase.execute(req.user.id, req.query);

      res.status(200).json({
        success: true,
        data: result.requests,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  getRequestByRef = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to view request details.');
      }

      const identifier = this.getIdentifier(req);
      const result = await this.getMemberRequestByRefUseCase.execute(req.user.id, identifier);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  cancelRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to cancel a request.');
      }

      const identifier = this.getIdentifier(req);
      const clientIp = getClientIp(req);

      const result = await this.cancelMemberRequestUseCase.execute(
        req.user.id,
        identifier,
        req.body,
        {
          ipAddress: clientIp,
          requestId: req.id,
        },
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  payRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to pay for a request.');
      }

      const identifier = this.getIdentifier(req);
      const clientIp = getClientIp(req);

      const result = await this.payMemberRequestUseCase.execute(
        req.user.id,
        identifier,
        req.body,
        {
          ipAddress: clientIp,
          requestId: req.id,
        },
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
