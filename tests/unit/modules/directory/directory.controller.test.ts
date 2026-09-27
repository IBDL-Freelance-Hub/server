import { Request, Response, NextFunction } from 'express';
import { DirectoryController } from '../../../../src/modules/directory/presentation/directory.controller';
import {
  SearchDirectoryUseCase,
  GetPublicTrainerProfileUseCase,
} from '../../../../src/modules/directory/application';
import { MembershipTier } from '@prisma/client';

describe('DirectoryController Unit Tests', () => {
  let mockSearchUseCase: {
    execute: jest.Mock;
  };
  let mockGetProfileUseCase: {
    execute: jest.Mock;
  };
  let controller: DirectoryController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockSearchUseCase = {
      execute: jest.fn(),
    };
    mockGetProfileUseCase = {
      execute: jest.fn(),
    };
    controller = new DirectoryController(
      mockSearchUseCase as unknown as SearchDirectoryUseCase,
      mockGetProfileUseCase as unknown as GetPublicTrainerProfileUseCase,
    );

    mockReq = {
      query: {},
      params: {},
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('search', () => {
    it('should set public cache headers and return 200 with search results', async () => {
      mockReq.query = {
        search: 'Leadership',
        country: 'Egypt',
        page: '1',
        limit: '10',
      };

      const mockSearchResult = {
        trainers: [
          {
            id: 'm-1',
            slug: 'john-doe',
            firstName: 'John',
            lastName: 'Doe',
            titleEn: null,
            titleAr: null,
            bioEn: 'Trainer bio',
            bioAr: null,
            photoUrl: null,
            country: 'Egypt',
            city: 'Cairo',
            areasOfExpertise: ['Leadership'],
            industriesServed: ['Tech'],
            languages: ['English'],
            tier: MembershipTier.MASTER,
            badgeType: 'PRIORITY',
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      mockSearchUseCase.execute.mockResolvedValue(mockSearchResult);

      await controller.search(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=60, stale-while-revalidate=120',
      );
      expect(mockSearchUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Leadership',
          country: 'Egypt',
          page: 1,
          limit: 10,
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should forward unexpected errors to next()', async () => {
      const error = new Error('Database connection failed');
      mockSearchUseCase.execute.mockRejectedValue(error);

      await controller.search(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getProfileBySlug', () => {
    it('should set public cache headers and return 200 with trainer profile', async () => {
      mockReq.params = { slug: 'hassan-mahmoud' };

      const mockProfile = {
        id: 'm-1',
        slug: 'hassan-mahmoud',
        firstName: 'Hassan',
        lastName: 'Mahmoud',
        titleEn: null,
        titleAr: null,
        bioEn: 'Software Architect',
        bioAr: null,
        photoUrl: null,
        country: 'Egypt',
        city: 'Cairo',
        yearsOfExperience: '6-10',
        areasOfExpertise: ['Node.js'],
        industriesServed: ['FinTech'],
        languages: ['Arabic', 'English'],
        linkedinUrl: 'https://linkedin.com/in/hassanmahmoud',
        tier: MembershipTier.PROFESSIONAL,
        badgeType: 'FEATURED',
      };

      mockGetProfileUseCase.execute.mockResolvedValue(mockProfile);

      await controller.getProfileBySlug(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=60, stale-while-revalidate=120',
      );
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith('hassan-mahmoud');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockProfile,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should forward errors to next() when profile is not found or use case fails', async () => {
      const error = new Error('Trainer profile not found');
      mockReq.params = { slug: 'unknown-trainer' };
      mockGetProfileUseCase.execute.mockRejectedValue(error);

      await controller.getProfileBySlug(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
