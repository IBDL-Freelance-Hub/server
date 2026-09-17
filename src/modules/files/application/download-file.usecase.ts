import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import {
  StorageService,
  storageService as defaultStorage,
} from '../infrastructure/storage.service';

export interface DownloadFileResult {
  file: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
  };
  stream: fs.ReadStream;
}

export class DownloadFileUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly storage: StorageService = defaultStorage,
  ) {}

  async execute(
    fileId: string,
    userId: string,
    userType: 'MEMBER' | 'STAFF' = 'MEMBER',
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

    const stream = this.storage.getFileInputStream(file.storageKey);

    return {
      file: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        category: file.category,
      },
      stream,
    };
  }
}
