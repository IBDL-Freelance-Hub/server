import { PrismaClient, TransactionStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { TransactionDTO, toTransactionDTO } from '../domain/transaction.dto';

export interface ListTransactionsInput {
  requesterUserId: string;
  isStaff: boolean;
  targetUserId?: string;
  cursor?: string;
  limit?: number;
  sourceType?: string;
  status?: TransactionStatus;
}

export interface ListTransactionsResult {
  items: TransactionDTO[];
  nextCursor?: string;
  total?: number;
}

export class ListTransactionsUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: ListTransactionsInput): Promise<ListTransactionsResult> {
    const where: Prisma.TransactionWhereInput = {};

    if (!input.isStaff) {
      where.userId = input.requesterUserId;
    } else if (input.targetUserId) {
      where.userId = input.targetUserId;
    }

    if (input.sourceType) {
      where.sourceType = input.sourceType;
    }

    if (input.status) {
      where.status = input.status;
    }

    const limit = Math.min(Math.max(1, input.limit || 20), 100);

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        take: limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    let nextCursor: string | undefined;
    if (items.length > limit) {
      items.pop();
      nextCursor = items[items.length - 1]?.id;
    }

    return {
      items: items.map(toTransactionDTO),
      nextCursor,
      total,
    };
  }
}

export const listTransactionsUseCase = new ListTransactionsUseCase();
