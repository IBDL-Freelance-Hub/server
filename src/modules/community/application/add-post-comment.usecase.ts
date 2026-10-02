import { PrismaClient, PostStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError, ValidationError } from '../../../shared/errors';
import { PostCommentDTO } from '../domain/community.types';

export interface AddPostCommentInput {
  postId: string;
  userId: string;
  content: string;
}

export class AddPostCommentUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: AddPostCommentInput): Promise<PostCommentDTO> {
    const trimmed = input.content?.trim();
    if (!trimmed || trimmed.length === 0) {
      throw new ValidationError('Comment content cannot be empty.');
    }
    if (trimmed.length > 1000) {
      throw new ValidationError('Comment cannot exceed 1000 characters.');
    }

    const post = await this.prisma.communityPost.findUnique({
      where: { id: input.postId },
      select: { id: true, status: true },
    });

    if (!post) {
      throw new NotFoundError(`Community post with ID '${input.postId}' not found.`);
    }

    if (post.status !== PostStatus.PUBLISHED) {
      throw new BusinessRuleError('Comments can only be added to published posts.');
    }

    const created = await this.prisma.postComment.create({
      data: {
        postId: input.postId,
        userId: input.userId,
        content: trimmed,
      },
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
    });

    const authorName =
      created.user.member?.fullNameEn ||
      (created.user.staff
        ? `IBDL Staff (${created.user.staff.role})`
        : created.user.email.split('@')[0]) ||
      'Member';
    const role = created.user.staff?.role || 'MEMBER';

    return {
      id: created.id,
      postId: created.postId,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      author: {
        id: created.user.id,
        fullName: authorName,
        role,
      },
    };
  }
}
