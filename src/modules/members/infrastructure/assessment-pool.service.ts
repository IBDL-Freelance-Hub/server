import { Prisma } from '@prisma/client';

export interface ClaimedCredential {
  username: string;
  password: string;
  accessUrl: string;
  isPoolExhausted: boolean;
}

interface PoolModelClient {
  findFirst(args: {
    where: { status: string };
    orderBy: { createdAt: 'asc' | 'desc' };
  }): Promise<{ id: string; username: string; password: string; accessUrl: string | null } | null>;
  update(args: {
    where: { id: string };
    data: { status: string; assignedTo: string; assignedAt: Date };
  }): Promise<unknown>;
}

/**
 * Claims an available assessment credential (supporting PQP and all 3 assessments) atomically from the database pool within a transaction.
 * If the pool is exhausted or empty, gracefully returns deterministic specimen fallback credentials (REG-65).
 */
export async function claimAssessmentCredential(
  tx: Prisma.TransactionClient,
  userId: string,
  fallbackUsername?: string,
): Promise<ClaimedCredential> {
  const poolModel = (tx as unknown as { assessmentCredentialPool: PoolModelClient })
    .assessmentCredentialPool;

  // 1. Find oldest available credential in pool
  const availableCredential = await poolModel.findFirst({
    where: { status: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Fallback when pool is empty or exhausted
  if (!availableCredential) {
    const defaultUsername = fallbackUsername || `flh.${userId.slice(0, 6)}`;
    return {
      username: defaultUsername,
      password: 'ASSESSMENT-2026-DEMO',
      accessUrl: 'https://assessment.ibdl.net/start',
      isPoolExhausted: true,
    };
  }

  // 3. Atomically assign credential to userId
  await poolModel.update({
    where: { id: availableCredential.id },
    data: {
      status: 'ASSIGNED',
      assignedTo: userId,
      assignedAt: new Date(),
    },
  });

  return {
    username: availableCredential.username,
    password: availableCredential.password,
    accessUrl: availableCredential.accessUrl || 'https://assessment.ibdl.net/start',
    isPoolExhausted: false,
  };
}
