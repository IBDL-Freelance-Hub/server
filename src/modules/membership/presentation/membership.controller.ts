import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { UpgradeMembershipUseCase } from '../application/upgrade-membership.usecase';
import { GetMembershipTiersUseCase } from '../application/get-membership-tiers.usecase';
import { UpgradeMembershipInput } from './membership.schema';
import { AuthenticationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class MembershipController {
  constructor(
    private readonly upgradeMembershipUseCase: UpgradeMembershipUseCase = new UpgradeMembershipUseCase(),
    private readonly getMembershipTiersUseCase: GetMembershipTiersUseCase = new GetMembershipTiersUseCase(),
  ) {}

  getTiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tiers = await this.getMembershipTiersUseCase.execute(req.user?.id);
      res.status(200).json({
        success: true,
        data: tiers,
      });
    } catch (error) {
      next(error);
    }
  };

  upgrade = async (
    req: Request<ParamsDictionary, unknown, UpgradeMembershipInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const clientIp = getClientIp(req);
      const result = await this.upgradeMembershipUseCase.execute(req.user.id, req.body, {
        requestId: req.id,
        ipAddress: clientIp,
      });

      // PAY-05, MEM-14: If payment was declined, return HTTP 402 Payment Required
      if (result.paymentStatus === 'DECLINED') {
        res.status(402).json({
          success: false,
          message: result.message,
          data: result,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
