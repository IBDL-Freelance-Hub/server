import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';

export interface DeleteProfilePhotoContext {
  ipAddress?: string;
  requestId?: string;
}

export class DeleteProfilePhotoUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId: string, context?: DeleteProfilePhotoContext) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
    });

    if (!member) {
      throw new NotFoundError('Member profile not found');
    }

    const previousPhotoId = member.photoFileId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Supersede any active PROFILE_PHOTO records for this member
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

      // 2. Set Member.photoFileId to null
      await tx.member.update({
        where: { id: member.id },
        data: {
          photoFileId: null,
        },
      });

      // 3. Write AuditLog
      await tx.auditLog.create({
        data: {
          actorId: member.userId,
          actorRole: 'MEMBER',
          action: 'PROFILE_PHOTO_REMOVED',
          resource: 'Member',
          resourceId: member.id,
          previousState: {
            photoFileId: previousPhotoId,
          },
          newState: {
            photoFileId: null,
          },
          ipAddress: context?.ipAddress,
          requestId: context?.requestId,
        },
      });
    });

    return {
      success: true,
      message: 'Profile photo removed successfully',
    };
  }
}
