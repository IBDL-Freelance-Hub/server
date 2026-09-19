import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { StorageProvider } from '../domain/storage-provider.interface';
import { defaultStorageProvider } from '../infrastructure/storage-provider.factory';

export interface DownloadFileResult {
  file: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
  };
  downloadUrl: string;
}

export class DownloadFileUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly storage: StorageProvider = defaultStorageProvider,
  ) {}

  async execute(
    fileId: string,
    userId: string,
    userType: 'MEMBER' | 'STAFF' = 'MEMBER',
    expiresInSeconds?: number,
  ): Promise<DownloadFileResult> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    // Zero-Trust: If file doesn't exist, return 404
    if (!file) {
      throw new NotFoundError('File not found');
    }

    // Zero-Trust Access Control (SEC-32, ERR-98):
    // If requester is a MEMBER, verify they are the exact owner of this file.
    // Never return 403 or disclose resource existence to unauthorized users.
    if (userType === 'MEMBER') {
      const member = await this.prisma.member.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!member || file.ownerId !== member.id) {
        throw new NotFoundError('File not found');
      }
    }

    const downloadUrl = await this.storage.getSignedDownloadUrl(file.storageKey, expiresInSeconds);

    return {
      file: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        category: file.category,
      },
      downloadUrl,
    };
  }
}
