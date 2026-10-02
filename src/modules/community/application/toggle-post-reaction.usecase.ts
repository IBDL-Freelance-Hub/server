import { PrismaClient, PostStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors';
import { ToggleReactionResult } from '../domain/community.types';

export interface TogglePostReactionInput {
  postId: string;
  userId: string;
  type?: string;
}

export class TogglePostReactionUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: TogglePostReactionInput): Promise<ToggleReactionResult> {
    const reactionType = input.type?.trim().toUpperCase() || 'LIKE';

    const post = await this.prisma.communityPost.findUnique({
      where: { id: input.postId },
      select: { id: true, status: true },
    });

    if (!post) {
      throw new NotFoundError(`Community post with ID '${input.postId}' not found.`);
    }

    if (post.status !== PostStatus.PUBLISHED) {
      throw new BusinessRuleError('Reactions can only be added to published posts.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.postReaction.findUnique({
        where: {
          postId_userId_type: {
            postId: input.postId,
            userId: input.userId,
            type: reactionType,
          },
        },
      });

      let reacted = false;
      if (existing) {
        await tx.postReaction.delete({
          where: { id: existing.id },
        });
        reacted = false;
      } else {
        await tx.postReaction.create({
          data: {
            postId: input.postId,
            userId: input.userId,
            type: reactionType,
          },
        });
        reacted = true;
      }

      const totalCount = await tx.postReaction.count({
        where: { postId: input.postId },
      });

      return {
        reacted,
        type: reactionType,
        reactionCount: totalCount,
      };
    });

    return result;
  }
}
