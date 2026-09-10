import crypto from 'crypto';
import { PrismaClient, Session, User, Member, Staff, Prisma } from '@prisma/client';
import { CookieOptions } from 'express';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { env } from '../../../config/env.config';
import { NotFoundError } from '../../../shared/errors';

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (AUT-34)
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const ACTIVITY_UPDATE_THRESHOLD_MS = 60 * 1000; // 60 seconds (SEC-14 write throttling)

export type UserWithRelations = User & {
  member: Member | null;
  staff: Staff | null;
};

export interface ActiveSessionDto {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export class SessionService {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Hashes a raw token string using SHA-256 for secure database lookup.
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Creates a new server-side session and stores the SHA-256 hashed token.
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress: ipAddress || '',
        userAgent: userAgent || '',
        lastActivityAt: new Date(),
        expiresAt,
      },
    });

    return { rawToken, expiresAt };
  }

  /**
   * Validates an incoming session token, enforcing 30-minute inactivity timeout (AUT-34).
   * Automatically updates lastActivityAt if > 60 seconds have elapsed since last write (SEC-14).
   */
  async validateSession(
    rawToken: string,
  ): Promise<{ session: Session; user: UserWithRelations } | null> {
    const tokenHash = this.hashToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            member: true,
            staff: true,
          },
        },
      },
    });

    if (!session || session.revokedAt) {
      return null;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - session.lastActivityAt.getTime();

    if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS || now > session.expiresAt.getTime()) {
      return null;
    }

    let updatedSession = session;
    // Touch lastActivityAt only if > 60 seconds have passed to prevent DB write amplification (SEC-14)
    if (timeSinceLastActivity > ACTIVITY_UPDATE_THRESHOLD_MS) {
      updatedSession = await this.prisma.session.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
        include: {
          user: {
            include: {
              member: true,
              staff: true,
            },
          },
        },
      });
    }

    return { session: updatedSession, user: updatedSession.user };
  }

  /**
   * Revokes a single session by marking revokedAt timestamp.
   */
  async revokeSession(rawToken: string, reason = 'User Logout'): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });
    }
  }

  /**
   * Retrieves all active (non-revoked, unexpired) sessions for a user (SEC-26).
   */
  async getActiveSessions(userId: string, currentSessionId?: string): Promise<ActiveSessionDto[]> {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActivityAt: s.lastActivityAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      isCurrent: Boolean(currentSessionId && s.id === currentSessionId),
    }));
  }

  /**
   * Revokes a specific session by ID ensuring ownership validation (SEC-26).
   */
  async revokeSessionById(
    userId: string,
    sessionId: string,
    reason = 'Revoked by user',
    tx?: Prisma.TransactionClient | PrismaClient,
  ): Promise<Session> {
    const client = tx || this.prisma;
    const session = await client.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundError('Session not found');
    }

    if (session.revokedAt) {
      return session;
    }

    return client.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  /**
   * Revokes all active sessions for a user (SEC-25).
   */
  async revokeAllUserSessions(
    userId: string,
    reason = 'Global User Revocation',
    tx?: Prisma.TransactionClient | PrismaClient,
  ): Promise<number> {
    const client = tx || this.prisma;
    const result = await client.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
    return result.count;
  }

  /**
   * Revokes all active sessions for a user EXCEPT the specified acting session (SEC-28, SEC-25).
   */
  async revokeOtherUserSessions(
    userId: string,
    exceptSessionId: string,
    reason = 'Password Changed',
    tx?: Prisma.TransactionClient | PrismaClient,
  ): Promise<number> {
    const client = tx || this.prisma;
    const result = await client.session.updateMany({
      where: {
        userId,
        id: { not: exceptSessionId },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
    return result.count;
  }

  /**
   * Deletes expired or revoked session records from database (AUT-38).
   */
  async deleteExpiredSessions(): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: thirtyDaysAgo } }],
      },
    });
    return result.count;
  }

  /**
   * Standard cookie options for setting the session cookie.
   */
  getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    };
  }
}

export const sessionService = new SessionService();
