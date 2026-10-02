import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { ActorMeta } from './admin-create-post.usecase';

export class AdminModerateCommentUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(commentId: string, actor: ActorMeta, hardDelete: boolean = false) {
    const existing = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      throw new NotFoundError(`Comment with ID '${commentId}' not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (hardDelete) {
        await tx.postComment.delete({
          where: { id: commentId },
        });
      } else {
        await tx.postComment.update({
          where: { id: commentId },
          data: { isDeleted: true },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.role,
          action: hardDelete ? 'COMMUNITY_COMMENT_HARD_DELETED' : 'COMMUNITY_COMMENT_MODERATED',
          resource: 'PostComment',
          resourceId: commentId,
          reason: hardDelete
            ? `Moderator permanently deleted comment '${commentId}'`
            : `Moderator soft-deleted comment '${commentId}'`,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: {
            postId: existing.postId,
            userId: existing.userId,
            isDeleted: existing.isDeleted,
          },
        },
      });
    });

    return {
      id: commentId,
      postId: existing.postId,
      moderated: true,
      message: 'Comment moderated successfully.',
    };
  }
}
