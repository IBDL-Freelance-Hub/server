import { PrismaClient, PostStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { ActorMeta } from './admin-create-post.usecase';

export class AdminDeletePostUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(postId: string, actor: ActorMeta, hardDelete: boolean = false) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.communityPost.findUnique({
          where: { id: postId },
        });

        if (!existing) {
          throw new NotFoundError(`Community post with ID '${postId}' not found.`);
        }

        if (!hardDelete && existing.status === PostStatus.ARCHIVED) {
          return {
            id: postId,
            deleted: true,
            mode: 'ARCHIVED',
            message: 'Post is already archived.',
          };
        }

        if (hardDelete) {
          await tx.communityPost.delete({
            where: { id: postId },
          });
        } else {
          await tx.communityPost.update({
            where: { id: postId },
            data: { status: PostStatus.ARCHIVED },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            actorRole: actor.role,
            action: hardDelete ? 'COMMUNITY_POST_HARD_DELETED' : 'COMMUNITY_POST_ARCHIVED',
            resource: 'CommunityPost',
            resourceId: postId,
            reason: hardDelete
              ? `Permanently deleted post '${postId}'`
              : `Archived post '${postId}'`,
            ipAddress: actor.ipAddress,
            requestId: actor.requestId,
            previousState: {
              title: existing.title,
              status: existing.status,
            },
          },
        });

        return {
          id: postId,
          deleted: true,
          mode: hardDelete ? 'HARD_DELETE' : 'ARCHIVED',
          message: hardDelete ? 'Post permanently deleted.' : 'Post archived successfully.',
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
}
