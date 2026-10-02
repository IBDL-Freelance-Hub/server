import { PrismaClient, PostCategory, PostStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { PostAttachment } from '../domain/community.types';

export interface AdminCreatePostInput {
  title: string;
  content: string;
  category?: PostCategory;
  status?: PostStatus;
  isPinned?: boolean;
  attachments?: PostAttachment[];
}

export interface ActorMeta {
  userId: string;
  role: string;
  ipAddress?: string;
  requestId?: string;
}

export class AdminCreatePostUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: AdminCreatePostInput, actor: ActorMeta) {
    const status = input.status || PostStatus.PUBLISHED;
    const category = input.category || PostCategory.ANNOUNCEMENT;
    const isPinned = input.isPinned ?? false;
    const now = new Date();
    const publishedAt = status === PostStatus.PUBLISHED ? now : null;

    const post = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.communityPost.create({
          data: {
            authorId: actor.userId,
            title: input.title.trim(),
            content: input.content.trim(),
            category,
            status,
            isPinned,
            attachments: (input.attachments as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            publishedAt,
          },
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

        // Immutable Staff Audit Log
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            actorRole: actor.role,
            action: 'COMMUNITY_POST_CREATED',
            resource: 'CommunityPost',
            resourceId: created.id,
            reason: `Created community post: "${created.title.substring(0, 40)}"`,
            ipAddress: actor.ipAddress,
            requestId: actor.requestId,
            newState: {
              title: created.title,
              category: created.category,
              status: created.status,
              isPinned: created.isPinned,
            },
          },
        });

        return created;
      },
      { maxWait: 5000, timeout: 10000 },
    );

    return post;
  }
}
