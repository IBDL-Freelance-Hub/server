import { Request, Response, NextFunction } from 'express';
import { UploadCvUseCase } from '../application/upload-cv.usecase';
import { UploadProfilePhotoUseCase } from '../application/upload-profile-photo.usecase';
import { DownloadFileUseCase } from '../application/download-file.usecase';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import { getClientIp } from '../../../shared/utils';
import { getStorageProvider } from '../infrastructure/storage-provider.factory';
import { LocalDiskStorageProvider } from '../infrastructure/local-disk-storage.provider';

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

      const { file, downloadUrl } = await this.downloadFileUseCase.execute(
        fileId,
        req.user.id,
        req.user.userType,
      );

      if (req.query.redirect === 'false' || req.headers.accept?.includes('application/json')) {
        res.status(200).json({
          success: true,
          data: {
            file,
            downloadUrl,
          },
        });
        return;
      }

      res.redirect(downloadUrl);
    } catch (error) {
      next(error);
    }
  };

  serveRawLocalFile = async (
    req: Request<{ storageKey: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { storageKey } = req.params;
      const { expires, sig } = req.query;

      if (!storageKey || !expires || !sig) {
        throw new ValidationError('Missing required signature or expiration parameter');
      }

      const expiresNum = Number(expires);
      if (isNaN(expiresNum)) {
        throw new ValidationError('Invalid expiration parameter');
      }

      const provider = getStorageProvider();
      if (!(provider instanceof LocalDiskStorageProvider)) {
        res.status(404).json({ success: false, message: 'Not found' });
        return;
      }

      const isValid = provider.verifySignedUrl(storageKey, expiresNum, String(sig));
      if (!isValid) {
        res.status(403).json({
          success: false,
          code: 'URL_EXPIRED_OR_INVALID',
          message: 'The requested download link has expired or is invalid.',
        });
        return;
      }

      const stream = provider.getFileInputStream(storageKey);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };
}
