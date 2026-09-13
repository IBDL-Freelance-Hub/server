import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { RegisterMemberUseCase } from '../application/register-member.usecase';
import { CheckDuplicateRegistrationUseCase } from '../application/check-duplicate-registration.usecase';
import { RegisterMemberInput, CheckDuplicateInput } from './members.schema';
import { getClientIp } from '../../../shared/utils';

export class MembersController {
  constructor(
    private readonly registerMemberUseCase: RegisterMemberUseCase = new RegisterMemberUseCase(),
    private readonly checkDuplicateUseCase: CheckDuplicateRegistrationUseCase = new CheckDuplicateRegistrationUseCase(),
  ) {}

  register = async (
    req: Request<ParamsDictionary, unknown, RegisterMemberInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const clientIp = getClientIp(req);
      const result = await this.registerMemberUseCase.execute(req.body, {
        requestId: req.id,
        ipAddress: clientIp,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  checkDuplicate = async (
    req: Request<ParamsDictionary, unknown, CheckDuplicateInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const clientIp = getClientIp(req);
      const result = await this.checkDuplicateUseCase.execute(req.body, clientIp);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
