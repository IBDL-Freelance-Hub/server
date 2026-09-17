import path from 'path';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import {
  FileValidatorService,
  fileValidatorService as defaultValidator,
} from '../infrastructure/file-validator.service';
import {
  StorageService,
  storageService as defaultStorage,
} from '../infrastructure/storage.service';

export interface UploadFileInput {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export interface UploadFileContext {
  ipAddress?: string;
  requestId?: string;
}

export class UploadProfilePhotoUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly validator: FileValidatorService = defaultValidator,
    private readonly storage: StorageService = defaultStorage,
  ) {}

  async execute(userId: string, fileInput: UploadFileInput, context?: UploadFileContext) {
    if (!fileInput || !fileInput.buffer) {
      throw new ValidationError('No file provided for upload');
    }

    // 1. Strict Magic Bytes & Size Validation (UPL-02, PRO-19, VAL-138)
    const validated = this.validator.validateProfilePhoto(fileInput.buffer, fileInput.originalname);

    // 2. Fetch existing member
    const member = await this.prisma.member.findUnique({
      where: { userId },
    });

    if (!member) {
      throw new NotFoundError('Member profile not found');
    }

    // 3. Persist file to storage with randomized UUID name (UPL-05)
    const storageKey = await this.storage.saveFile(fileInput.buffer, validated.extension);

    // 4. Atomic Transaction: Supersede old photos, save new record, update Member.photoFileId, and log audit
    const sanitizedOriginalName = path.basename(
      fileInput.originalname || `photo.${validated.extension}`,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // Supersede previous active photo records
      await tx.file.updateMany({
        where: {
          ownerId: member.id,
          category: 'PROFILE_PHOTO',
          status: 'ACTIVE',
        },
        data: {
          status: 'SUPERSEDED',
          supersededAt: new Date(),
        },
      });

      // Insert new active File record
      const createdFile = await tx.file.create({
        data: {
          ownerId: member.id,
          category: 'PROFILE_PHOTO',
          originalName: sanitizedOriginalName,
          storageKey,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          status: 'ACTIVE',
        },
      });

      // Update Member.photoFileId atomically
      await tx.member.update({
        where: { id: member.id },
        data: {
          photoFileId: createdFile.id,
        },
      });

      // Write AuditLog entry
      await tx.auditLog.create({
        data: {
          actorId: member.userId,
          actorRole: 'MEMBER',
          action: 'PROFILE_PHOTO_UPLOADED',
          resource: 'File',
          resourceId: createdFile.id,
          newState: {
            fileId: createdFile.id,
            category: 'PROFILE_PHOTO',
            originalName: createdFile.originalName,
            sizeBytes: createdFile.sizeBytes,
            mimeType: createdFile.mimeType,
            photoFileId: createdFile.id,
          },
          ipAddress: context?.ipAddress,
          requestId: context?.requestId,
        },
      });

      return createdFile;
    });

    return {
      file: {
        id: result.id,
        category: result.category,
        originalName: result.originalName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        status: result.status,
        createdAt: result.createdAt,
      },
      photoFileId: result.id,
    };
  }
}
