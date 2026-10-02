import { PrismaClient, PostCategory, PostStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { PostAttachment } from '../domain/community.types';
import { ActorMeta } from './admin-create-post.usecase';

export interface AdminUpdatePostInput {
  title?: string;
  content?: string;
  category?: PostCategory;
  status?: PostStatus;
  isPinned?: boolean;
  attachments?: PostAttachment[];
}

export class AdminUpdatePostUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(postId: string, input: AdminUpdatePostInput, actor: ActorMeta) {
    const existing = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!existing) {
      throw new NotFoundError(`Community post with ID '${postId}' not found.`);
    }

    const data: Prisma.CommunityPostUpdateInput = {};

    if (input.title !== undefined) data.title = input.title.trim();
    if (input.content !== undefined) data.content = input.content.trim();
    if (input.category !== undefined) data.category = input.category;
    if (input.isPinned !== undefined) data.isPinned = input.isPinned;
    if (input.attachments !== undefined) {
      data.attachments = (input.attachments as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull;
    }

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === PostStatus.PUBLISHED && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const post = await tx.communityPost.update({
          where: { id: postId },
          data,
          include: {
            author: {
              select: {
                id: true,
                email: true,
                staff: { select: { role: true } },
                member: { select: { fullNameEn: true } },
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'COMMUNITY_POST_UPDATED',
            resource: 'CommunityPost',
            resourceId: post.id,
            reason: `Updated community post '${post.id}'`,
            ipAddress: actor.ipAddress,
            requestId: actor.requestId,
            previousState: {
              title: existing.title,
              status: existing.status,
              isPinned: existing.isPinned,
            },
            newState: {
              title: post.title,
              status: post.status,
              isPinned: post.isPinned,
            },
          },
        });

        return post;
      },
      { maxWait: 5000, timeout: 10000 },
    );

    return updated;
  }
}
