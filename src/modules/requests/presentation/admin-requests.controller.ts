import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';
import { AdminStartReviewUseCase } from '../application/admin-start-review.usecase';
import { AdminRequestInfoUseCase } from '../application/admin-request-info.usecase';
import { AdminRejectRequestUseCase } from '../application/admin-reject-request.usecase';
import { AdminApproveRequestUseCase } from '../application/admin-approve-request.usecase';
import { AdminFulfillRequestUseCase } from '../application/admin-fulfill-request.usecase';
import { AdminMarkPaidUseCase } from '../application/admin-mark-paid.usecase';
import { AdminListRequestsUseCase } from '../application/admin-list-requests.usecase';
import { AdminGetRequestByIdUseCase } from '../application/admin-get-request-by-id.usecase';

export class AdminRequestsController {
  constructor(
    private readonly startReviewUseCase: AdminStartReviewUseCase = new AdminStartReviewUseCase(),
    private readonly requestInfoUseCase: AdminRequestInfoUseCase = new AdminRequestInfoUseCase(),
    private readonly rejectRequestUseCase: AdminRejectRequestUseCase = new AdminRejectRequestUseCase(),
    private readonly approveRequestUseCase: AdminApproveRequestUseCase = new AdminApproveRequestUseCase(),
    private readonly fulfillRequestUseCase: AdminFulfillRequestUseCase = new AdminFulfillRequestUseCase(),
    private readonly markPaidUseCase: AdminMarkPaidUseCase = new AdminMarkPaidUseCase(),
    private readonly listRequestsUseCase: AdminListRequestsUseCase = new AdminListRequestsUseCase(),
    private readonly getRequestByIdUseCase: AdminGetRequestByIdUseCase = new AdminGetRequestByIdUseCase(),
  ) {}

  private getRequestId(req: Request): string {
    const id = req.params.id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
    if (Array.isArray(id) && id[0]) {
      return id[0].trim();
    }
    throw new ValidationError('Request ID parameter is required.');
  }

  private getActorContext(req: Request) {
    if (!req.user || !req.user.staffRole) {
      throw new AuthenticationError('Staff authentication required.');
    }
    return {
      userId: req.user.id,
      staffRole: req.user.staffRole,
      ipAddress: getClientIp(req),
      requestId: req.id,
    };
  }

  listRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.getActorContext(req);
      const result = await this.listRequestsUseCase.execute(req.query);
      res.status(200).json({
        success: true,
        data: result.requests,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  getRequestById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.getActorContext(req);
      const id = this.getRequestId(req);
      const result = await this.getRequestByIdUseCase.execute(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  startReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.getRequestId(req);
      const actor = this.getActorContext(req);
      const result = await this.startReviewUseCase.execute(id, actor);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  requestInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.getRequestId(req);
      const actor = this.getActorContext(req);
      const result = await this.requestInfoUseCase.execute(
        id,
        { reviewNotes: req.body.reviewNotes },
        actor,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.getRequestId(req);
      const actor = this.getActorContext(req);
      const result = await this.rejectRequestUseCase.execute(
        id,
        { rejectionReason: req.body.rejectionReason },
        actor,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.getRequestId(req);
      const actor = this.getActorContext(req);
      const result = await this.approveRequestUseCase.execute(
        id,
        {
          baseAmount: req.body.baseAmount,
          adminNotes: req.body.adminNotes,
        },
        actor,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  fulfill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.getRequestId(req);
      const actor = this.getActorContext(req);
      const result = await this.fulfillRequestUseCase.execute(
        id,
        {
          deliveryNotes: req.body.deliveryNotes,
          customAccessUrl: req.body.customAccessUrl,
        },
        actor,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.getRequestId(req);
      const actor = this.getActorContext(req);
      const result = await this.markPaidUseCase.execute(
        id,
        {
          paymentRef: req.body.paymentRef,
          paymentReference: req.body.paymentReference,
          paidAmount: req.body.paidAmount,
          adminNotes: req.body.adminNotes,
        },
        actor,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
