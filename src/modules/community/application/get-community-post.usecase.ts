import { PrismaClient, PostStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { CommunityPostDetailDTO, PostAttachment, PostCommentDTO } from '../domain/community.types';

export class GetCommunityPostUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(
    postId: string,
    currentUserId?: string,
    isStaff: boolean = false,
  ): Promise<CommunityPostDetailDTO> {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
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
          where: currentUserId ? { userId: currentUserId } : { userId: '__NONE__' },
          select: { id: true, type: true },
        },
        comments: {
          where: { isDeleted: false },
          take: 100,
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                staff: { select: { role: true } },
                member: { select: { fullNameEn: true } },
              },
            },
          },
        },
      },
    });

    if (!post || post.status === PostStatus.ARCHIVED) {
      throw new NotFoundError(`Community post with ID '${postId}' not found.`);
    }

    if (!isStaff && post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundError(`Community post with ID '${postId}' not found.`);
    }

    const authorName =
      post.author.member?.fullNameEn ||
      (post.author.staff
        ? `IBDL Staff (${post.author.staff.role})`
        : post.author.email.split('@')[0]) ||
      'IBDL Staff';
    const hasLiked = Array.isArray(post.reactions) && post.reactions.length > 0;

    const comments: PostCommentDTO[] = post.comments.map((c) => {
      const commentAuthorName =
        c.user.member?.fullNameEn ||
        (c.user.staff ? `IBDL Staff (${c.user.staff.role})` : c.user.email.split('@')[0]) ||
        'Member';
      const commentRole = c.user.staff?.role || 'MEMBER';

      return {
        id: c.id,
        postId: c.postId,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        author: {
          id: c.user.id,
          fullName: commentAuthorName,
          role: commentRole,
        },
      };
    });

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
        role: post.author.staff?.role || 'STAFF',
      },
      commentCount: post._count.comments,
      reactionCount: post._count.reactions,
      hasLiked,
      comments,
    };
  }
}
