import { Prisma, PrismaClient } from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Generates canonical sequential invoice numbers per year:
 * Format: INV-YYYY-0nnnn (e.g., INV-2026-00001, INV-2026-00002)
 */
export function formatSequentialInvoiceNumber(year: number, sequenceNumber: number): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(5, '0');
  return `INV-${year}-${padded}`;
}

export function generateInvoiceNumber(
  sequenceNumber: number = 1,
  year: number = new Date().getUTCFullYear(),
): string {
  return formatSequentialInvoiceNumber(year, sequenceNumber);
}

export function isValidInvoiceNumber(code: string): boolean {
  return /^INV-\d{4}-\d{5,}$/.test(code);
}

export function parseInvoiceSequence(code: string): { year: number; sequence: number } | null {
  const match = /^INV-(\d{4})-(\d+)$/.exec(code);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}

export async function generateAtomicInvoiceNumber(
  client: DbClient,
  year: number = new Date().getUTCFullYear(),
): Promise<string> {
  const queryRawFn = (client as unknown as { $queryRaw?: unknown }).$queryRaw;
  if (typeof queryRawFn !== 'function') {
    return formatSequentialInvoiceNumber(year, Math.floor(Math.random() * 90000) + 10000);
  }

  const result = await client.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "invoice_sequence_counter" (year, "lastValue", "updatedAt")
    VALUES (${year}, 1, NOW())
    ON CONFLICT (year) DO UPDATE
    SET "lastValue" = "invoice_sequence_counter"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"
  `;
  const seq = Array.isArray(result) && result[0] ? result[0].lastValue : 1;
  return formatSequentialInvoiceNumber(year, Number(seq));
}
