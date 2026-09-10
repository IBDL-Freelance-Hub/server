import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';

export interface AssessmentCredentialRecord {
  username: string;
  password: string;
  accessUrl?: string;
}

/**
 * Bulk ingests pre-generated assessment credentials into the database pool.
 * Uses createMany with skipDuplicates to prevent errors on duplicate usernames.
 */
export async function ingestAssessmentCredentials(
  records: AssessmentCredentialRecord[],
  prisma: PrismaClient = defaultPrisma,
): Promise<{ count: number }> {
  if (!records || records.length === 0) {
    return { count: 0 };
  }

  // Cast client dynamically to remain compatible with IDE language servers across Prisma regenerations
  const poolModel = (
    prisma as unknown as {
      assessmentCredentialPool: {
        createMany: (args: {
          data: Array<{
            username: string;
            password: string;
            accessUrl: string | null;
            status: string;
          }>;
          skipDuplicates?: boolean;
        }) => Promise<{ count: number }>;
      };
    }
  ).assessmentCredentialPool;

  const result = await poolModel.createMany({
    data: records.map((row) => ({
      username: row.username.trim(),
      password: row.password.trim(),
      accessUrl: row.accessUrl?.trim() || null,
      status: 'AVAILABLE',
    })),
    skipDuplicates: true,
  });

  return { count: result.count };
}
