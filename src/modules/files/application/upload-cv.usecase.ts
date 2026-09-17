import path from 'path';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { calculateProfileCompletion } from '../../members/domain';
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

export class UploadCvUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly validator: FileValidatorService = defaultValidator,
    private readonly storage: StorageService = defaultStorage,
  ) {}

  async execute(userId: string, fileInput: UploadFileInput, context?: UploadFileContext) {
    if (!fileInput || !fileInput.buffer) {
      throw new ValidationError('No file provided for upload');
    }

    // 1. Strict Magic Bytes & Size Validation (UPL-02, UPL-14, VAL-138)
    // If validation fails, existing CV remains untouched (VAL-60)
    const validated = this.validator.validateCv(fileInput.buffer, fileInput.originalname);

    // 2. Fetch existing member
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        user: true,
        files: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Member profile not found');
    }

    // 3. Persist file to storage with randomized UUID name (UPL-05)
    // If storage fails, existing CV remains untouched (VAL-60)
    const storageKey = await this.storage.saveFile(fileInput.buffer, validated.extension);

    // 4. Calculate updated profile completion rate with hasCv = true (VAL-58)
    const completion = calculateProfileCompletion({
      fullNameEn: member.fullNameEn,
      fullNameAr: member.fullNameAr,
      email: member.user.email,
      phone: member.phone,
      country: member.country,
      city: member.city,
      yearsOfExperience: member.yearsOfExperience,
      areasOfExpertise: member.areasOfExpertise,
      industriesServed: member.industriesServed,
      languages: member.languages,
      bioEn: member.bioEn,
      bioAr: member.bioAr,
      hasCv: true,
      photoFileId: member.photoFileId,
      linkedinUrl: member.linkedinUrl,
    });

    // 5. Atomic Transaction: Supersede old CV, save new record, update member completion, and log audit
    const sanitizedOriginalName = path.basename(
      fileInput.originalname || `cv.${validated.extension}`,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // Supersede previous active CV records
      await tx.file.updateMany({
        where: {
          ownerId: member.id,
          category: 'CV',
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
          category: 'CV',
          originalName: sanitizedOriginalName,
          storageKey,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          status: 'ACTIVE',
        },
      });

      // Update Member profileCompletionRate atomically
      await tx.member.update({
        where: { id: member.id },
        data: {
          profileCompletionRate: completion.completionPercentage,
        },
      });

      // Write AuditLog entry
      await tx.auditLog.create({
        data: {
          actorId: member.userId,
          actorRole: 'MEMBER',
          action: 'CV_UPLOADED',
          resource: 'File',
          resourceId: createdFile.id,
          newState: {
            fileId: createdFile.id,
            category: 'CV',
            originalName: createdFile.originalName,
            sizeBytes: createdFile.sizeBytes,
            mimeType: createdFile.mimeType,
            profileCompletionRate: completion.completionPercentage,
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
      profileCompletionRate: completion.completionPercentage,
      completionPercentage: completion.completionPercentage,
      missingFields: completion.missingItems,
    };
  }
}
