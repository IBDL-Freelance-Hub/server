import { Request, Response, NextFunction } from 'express';
import { UploadCvUseCase } from '../application/upload-cv.usecase';
import { UploadProfilePhotoUseCase } from '../application/upload-profile-photo.usecase';
import { DownloadFileUseCase } from '../application/download-file.usecase';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';

export class FilesController {
  constructor(
    private readonly uploadCvUseCase: UploadCvUseCase = new UploadCvUseCase(),
    private readonly uploadProfilePhotoUseCase: UploadProfilePhotoUseCase = new UploadProfilePhotoUseCase(),
    private readonly downloadFileUseCase: DownloadFileUseCase = new DownloadFileUseCase(),
  ) {}

  uploadCv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      if (!req.file) {
        throw new ValidationError('CV file is required');
      }

      const clientIp = getClientIp(req);
      const result = await this.uploadCvUseCase.execute(
        req.user.id,
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          size: req.file.size,
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

  uploadProfilePhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      if (!req.file) {
        throw new ValidationError('Profile photo image is required');
      }

      const clientIp = getClientIp(req);
      const result = await this.uploadProfilePhotoUseCase.execute(
        req.user.id,
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          size: req.file.size,
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

  downloadFile = async (
    req: Request<{ fileId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Your session has ended. Please sign in again.');
      }

      const { fileId } = req.params;
      if (!fileId || typeof fileId !== 'string') {
        throw new ValidationError('File ID is required');
      }

      const { file, stream } = await this.downloadFileUseCase.execute(
        fileId,
        req.user.id,
        req.user.userType,
      );

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.sizeBytes);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`,
      );

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };
}
