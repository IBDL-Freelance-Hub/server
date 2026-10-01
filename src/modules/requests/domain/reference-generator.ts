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

export interface SequenceCounterClient {
  requestSequenceCounter: {
    upsert: (args: {
      where: { year: number };
      create: { year: number; lastValue: number };
      update: { lastValue: { increment: number } };
    }) => Promise<{ year: number; lastValue: number }>;
  };
}

/**
 * Concurrency-safe sequential reference generation within an atomic database transaction.
 * Uses atomic row-level upsert increment on RequestSequenceCounter per year.
 */
export async function generateAtomicSequentialReference(
  client: SequenceCounterClient,
  year: number = new Date().getUTCFullYear(),
): Promise<string> {
  const counter = await client.requestSequenceCounter.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return formatSequentialReference(year, counter.lastValue);
}
