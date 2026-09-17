import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { RegisterMemberUseCase } from '../application/register-member.usecase';
import { CheckDuplicateRegistrationUseCase } from '../application/check-duplicate-registration.usecase';
import { GetMemberProfileUseCase } from '../application/get-member-profile.usecase';
import { UpdateMemberProfileUseCase } from '../application/update-member-profile.usecase';
import { GetMemberDashboardUseCase } from '../application/get-member-dashboard.usecase';
import {
  RegisterMemberInput,
  CheckDuplicateInput,
  UpdateMemberProfileInput,
} from './members.schema';
import { AuthenticationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class MembersController {
  constructor(
    private readonly registerMemberUseCase: RegisterMemberUseCase = new RegisterMemberUseCase(),
    private readonly checkDuplicateUseCase: CheckDuplicateRegistrationUseCase = new CheckDuplicateRegistrationUseCase(),
    private readonly getProfileUseCase: GetMemberProfileUseCase = new GetMemberProfileUseCase(),
    private readonly updateProfileUseCase: UpdateMemberProfileUseCase = new UpdateMemberProfileUseCase(),
    private readonly getDashboardUseCase: GetMemberDashboardUseCase = new GetMemberDashboardUseCase(),
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

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const result = await this.getProfileUseCase.execute(req.user.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const result = await this.getDashboardUseCase.execute(req.user.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (
    req: Request<ParamsDictionary, unknown, UpdateMemberProfileInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const clientIp = getClientIp(req);
      const result = await this.updateProfileUseCase.execute(req.user.id, req.body, {
        requestId: req.id,
        ipAddress: clientIp,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
