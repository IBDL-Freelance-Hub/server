import { PrismaClient, PostStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors';
import { ToggleReactionResult } from '../domain/community.types';

export interface TogglePostReactionInput {
  postId: string;
  userId: string;
  type?: string;
}

function isPrismaErrorCode(err: unknown, code: string): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === code) {
    return true;
  }
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === code;
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

    const result = await this.prisma.$transaction(
      async (tx) => {
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
          try {
            await tx.postReaction.delete({
              where: { id: existing.id },
            });
            reacted = false;
          } catch (err) {
            // Concurrent delete race: P2025 = Record to delete does not exist
            if (isPrismaErrorCode(err, 'P2025')) {
              reacted = false;
            } else {
              throw err;
            }
          }
        } else {
          try {
            await tx.postReaction.create({
              data: {
                postId: input.postId,
                userId: input.userId,
                type: reactionType,
              },
            });
            reacted = true;
          } catch (err) {
            // Concurrent create race: P2002 = Unique constraint violation
            if (isPrismaErrorCode(err, 'P2002')) {
              reacted = true;
            } else {
              throw err;
            }
          }
        }

        const totalCount = await tx.postReaction.count({
          where: { postId: input.postId },
        });

        return {
          reacted,
          type: reactionType,
          reactionCount: totalCount,
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );

    return result;
  }
}
