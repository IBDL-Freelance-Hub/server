import { Request, Response, NextFunction } from 'express';
import { SubmitUnifiedRequestUseCase } from '../application/submit-unified-request.usecase';
import { AuthenticationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class RequestsController {
  constructor(
    private readonly submitUnifiedRequestUseCase: SubmitUnifiedRequestUseCase = new SubmitUnifiedRequestUseCase(),
  ) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required to submit requests.');
      }

      const clientIp = getClientIp(req);
      const result = await this.submitUnifiedRequestUseCase.execute(
        req.user.id,
        {
          itemSlug: req.body.itemSlug,
          brief: req.body.brief,
          acknowledgement: req.body.acknowledgement,
          customRequirements: req.body.customRequirements,
        },
        {
          ipAddress: clientIp,
          requestId: req.id,
        },
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
