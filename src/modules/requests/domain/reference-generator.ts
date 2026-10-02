/**
 * Generates canonical sequential request reference codes per year:
 * Format: REQ-YYYY-0nnn (e.g., REQ-2026-0001, REQ-2026-0002)
 */
export function formatSequentialReference(year: number, sequenceNumber: number): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(4, '0');
  return `REQ-${year}-${padded}`;
}

export function generateRequestReference(
  sequenceNumber: number = 1,
  year: number = new Date().getUTCFullYear(),
): string {
  return formatSequentialReference(year, sequenceNumber);
}

export function isValidRequestReference(code: string): boolean {
  return /^REQ-\d{4}-\d{4,}$/.test(code);
}

export function parseReferenceSequence(code: string): { year: number; sequence: number } | null {
  const match = /^REQ-(\d{4})-(\d+)$/.exec(code);
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}

import { Prisma, PrismaClient } from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export async function generateAtomicSequentialReference(
  client: DbClient,
  year: number = new Date().getUTCFullYear(),
): Promise<string> {
  const queryRawFn = (client as unknown as { $queryRaw?: unknown }).$queryRaw;
  if (typeof queryRawFn !== 'function') {
    return formatSequentialReference(year, Math.floor(Math.random() * 9000) + 1000);
  }

  const result = await client.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "RequestSequenceCounter" (year, "lastValue", "updatedAt")
    VALUES (${year}, 1, NOW())
    ON CONFLICT (year) DO UPDATE
    SET "lastValue" = "RequestSequenceCounter"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"
  `;
  const seq = Array.isArray(result) && result[0] ? result[0].lastValue : 1;
  return formatSequentialReference(year, Number(seq));
}
