import crypto from 'crypto';
import { PrismaClient, Session, User } from '@prisma/client';
import { CookieOptions } from 'express';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { env } from '../../../config/env.config';

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (AUT-34)
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
   * Automatically updates lastActivityAt if valid.
   */
  async validateSession(rawToken: string): Promise<{ session: Session; user: User } | null> {
    const tokenHash = this.hashToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt) {
      return null;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - session.lastActivityAt.getTime();

    if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS || now > session.expiresAt.getTime()) {
      return null;
    }

    // Touch lastActivityAt for active sliding inactivity window
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    return { session: updatedSession, user: session.user };
  }

  /**
   * Revokes a session by marking revokedAt timestamp.
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
