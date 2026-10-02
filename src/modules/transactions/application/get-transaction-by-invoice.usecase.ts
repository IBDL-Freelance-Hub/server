import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { TransactionDTO, toTransactionDTO } from '../domain/transaction.dto';

export interface GetTransactionByInvoiceInput {
  invoiceNumber: string;
  requesterUserId: string;
  isStaff: boolean;
}

export class GetTransactionByInvoiceUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(input: GetTransactionByInvoiceInput): Promise<TransactionDTO> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
    });

    if (!transaction) {
      throw new NotFoundError(
        `Transaction with invoice number '${input.invoiceNumber}' not found.`,
      );
    }

    // Tenant isolation guard: members can only view their own transactions
    if (!input.isStaff && transaction.userId !== input.requesterUserId) {
      throw new NotFoundError(
        `Transaction with invoice number '${input.invoiceNumber}' not found.`,
      );
    }

    return toTransactionDTO(transaction);
  }
}

export const getTransactionByInvoiceUseCase = new GetTransactionByInvoiceUseCase();
