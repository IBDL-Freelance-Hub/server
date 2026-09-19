import { Request, Response, NextFunction } from 'express';
import { FilesController } from '../../../../src/modules/files/presentation/files.controller';
import { UploadCvUseCase } from '../../../../src/modules/files/application/upload-cv.usecase';
import { UploadProfilePhotoUseCase } from '../../../../src/modules/files/application/upload-profile-photo.usecase';
import { DownloadFileUseCase } from '../../../../src/modules/files/application/download-file.usecase';
import { LocalDiskStorageProvider } from '../../../../src/modules/files/infrastructure/local-disk-storage.provider';
import * as storageFactory from '../../../../src/modules/files/infrastructure/storage-provider.factory';
import { AuthenticationError, ValidationError } from '../../../../src/shared/errors';

describe('FilesController Unit Tests', () => {
  let controller: FilesController;
  let mockUploadCvUseCase: jest.Mocked<UploadCvUseCase>;
  let mockUploadProfilePhotoUseCase: jest.Mocked<UploadProfilePhotoUseCase>;
  let mockDownloadFileUseCase: jest.Mocked<DownloadFileUseCase>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockUploadCvUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UploadCvUseCase>;

    mockUploadProfilePhotoUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UploadProfilePhotoUseCase>;

    mockDownloadFileUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DownloadFileUseCase>;

    controller = new FilesController(
      mockUploadCvUseCase,
      mockUploadProfilePhotoUseCase,
      mockDownloadFileUseCase,
    );

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('downloadFile', () => {
    it('should redirect to signed URL by default', async () => {
      mockReq = {
        user: { id: 'user-1', email: 'test@example.com', userType: 'MEMBER', status: 'ACTIVE' },
        params: { fileId: 'file-123' },
        query: {},
        headers: {},
      };

      mockDownloadFileUseCase.execute.mockResolvedValue({
        file: {
          id: 'file-123',
          category: 'CV',
          originalName: 'resume.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        downloadUrl: 'https://storage.example.com/file-123?sig=abc',
      });

      await controller.downloadFile(
        mockReq as Request<{ fileId: string }>,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.redirect).toHaveBeenCalledWith('https://storage.example.com/file-123?sig=abc');
    });

    it('should return JSON when redirect=false is passed', async () => {
      mockReq = {
        user: { id: 'user-1', email: 'test@example.com', userType: 'MEMBER', status: 'ACTIVE' },
        params: { fileId: 'file-123' },
        query: { redirect: 'false' },
        headers: {},
      };

      mockDownloadFileUseCase.execute.mockResolvedValue({
        file: {
          id: 'file-123',
          category: 'CV',
          originalName: 'resume.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        downloadUrl: 'https://storage.example.com/file-123?sig=abc',
      });

      await controller.downloadFile(
        mockReq as Request<{ fileId: string }>,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          file: expect.any(Object),
          downloadUrl: 'https://storage.example.com/file-123?sig=abc',
        },
      });
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError if req.user is missing', async () => {
      mockReq = {
        params: { fileId: 'file-123' },
      };

      await controller.downloadFile(
        mockReq as Request<{ fileId: string }>,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('serveRawLocalFile', () => {
    let mockLocalStorage: jest.Mocked<LocalDiskStorageProvider>;

    beforeEach(() => {
      mockLocalStorage = {
        verifySignedUrl: jest.fn(),
        getFileInputStream: jest.fn(),
      } as unknown as jest.Mocked<LocalDiskStorageProvider>;
      Object.setPrototypeOf(mockLocalStorage, LocalDiskStorageProvider.prototype);

      jest.spyOn(storageFactory, 'getStorageProvider').mockReturnValue(mockLocalStorage);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should stream file when signed URL is verified and valid', async () => {
      const mockStream = {
        pipe: jest.fn(),
      };
      mockLocalStorage.verifySignedUrl.mockReturnValue(true);
      mockLocalStorage.getFileInputStream.mockReturnValue(
        mockStream as unknown as import('fs').ReadStream,
      );

      mockReq = {
        params: { storageKey: 'test-key.pdf' },
        query: { expires: '1800000000', sig: 'valid-sig' },
      };

      await controller.serveRawLocalFile(
        mockReq as Request<{ storageKey: string }>,
        mockRes as Response,
        mockNext,
      );

      expect(mockLocalStorage.verifySignedUrl).toHaveBeenCalledWith(
        'test-key.pdf',
        1800000000,
        'valid-sig',
      );
      expect(mockLocalStorage.getFileInputStream).toHaveBeenCalledWith('test-key.pdf');
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('should respond 403 when signed URL is invalid or expired', async () => {
      mockLocalStorage.verifySignedUrl.mockReturnValue(false);

      mockReq = {
        params: { storageKey: 'test-key.pdf' },
        query: { expires: '1600000000', sig: 'expired-or-bad-sig' },
      };

      await controller.serveRawLocalFile(
        mockReq as Request<{ storageKey: string }>,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'URL_EXPIRED_OR_INVALID',
        }),
      );
    });

    it('should throw ValidationError when query params are missing', async () => {
      mockReq = {
        params: { storageKey: 'test-key.pdf' },
        query: {},
      };

      await controller.serveRawLocalFile(
        mockReq as Request<{ storageKey: string }>,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});
