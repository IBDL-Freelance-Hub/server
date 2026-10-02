import { PrismaClient, PostCategory, PostStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { CommunityPostSummaryDTO, PostAttachment } from '../domain/community.types';

export interface ListCommunityPostsInput {
  currentUserId?: string;
  category?: PostCategory;
  search?: string;
  status?: PostStatus;
  page?: number;
  limit?: number;
}

export class ListCommunityPostsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: ListCommunityPostsInput = {}) {
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(50, Math.max(1, input.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityPostWhereInput = {
      status: input.status || PostStatus.PUBLISHED,
    };

    if (input.category) {
      where.category = input.category;
    }

    if (input.search && input.search.trim()) {
      const q = input.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, posts] = await Promise.all([
      this.prisma.communityPost.count({ where }),
      this.prisma.communityPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          author: {
            select: {
              id: true,
              email: true,
              staff: { select: { role: true } },
              member: { select: { fullNameEn: true } },
            },
          },
          _count: {
            select: {
              comments: { where: { isDeleted: false } },
              reactions: true,
            },
          },
          reactions: {
            where: input.currentUserId ? { userId: input.currentUserId } : { userId: '__NONE__' },
            select: { id: true, type: true },
          },
        },
      }),
    ]);

    const items: CommunityPostSummaryDTO[] = posts.map((post) => {
      const authorName =
        post.author.member?.fullNameEn ||
        (post.author.staff
          ? `IBDL Staff (${post.author.staff.role})`
          : post.author.email.split('@')[0]) ||
        'IBDL Staff';
      const role = post.author.staff?.role || 'STAFF';
      const hasLiked = Array.isArray(post.reactions) && post.reactions.length > 0;

      return {
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        status: post.status,
        isPinned: post.isPinned,
        attachments: (post.attachments as unknown as PostAttachment[]) || undefined,
        publishedAt: post.publishedAt?.toISOString() || null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: {
          id: post.author.id,
          fullName: authorName,
          role,
        },
        commentCount: post._count.comments,
        reactionCount: post._count.reactions,
        hasLiked,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
