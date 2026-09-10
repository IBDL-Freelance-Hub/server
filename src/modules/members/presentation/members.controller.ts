import { Request, Response, NextFunction } from 'express';
import { RegisterMemberUseCase } from '../application/register-member.usecase';
import { CheckDuplicateRegistrationUseCase } from '../application/check-duplicate-registration.usecase';
import { RegisterMemberInput, CheckDuplicateInput } from './members.schema';

export class MembersController {
  constructor(
    private readonly registerMemberUseCase: RegisterMemberUseCase = new RegisterMemberUseCase(),
    private readonly checkDuplicateUseCase: CheckDuplicateRegistrationUseCase = new CheckDuplicateRegistrationUseCase(),
  ) {}

  register = async (
    req: Request<unknown, unknown, RegisterMemberInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.registerMemberUseCase.execute(req.body, {
        requestId: req.id,
        ipAddress: req.ip,
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
    req: Request<unknown, unknown, CheckDuplicateInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.checkDuplicateUseCase.execute(req.body, req.ip);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
