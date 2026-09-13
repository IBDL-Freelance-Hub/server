import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';

export class LogoutUseCase {
  constructor(private sessionSvc: SessionService = defaultSessionService) {}

  async execute(
    rawToken: string,
    reason = 'User Logout',
    meta?: { ipAddress?: string; requestId?: string },
  ): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.sessionSvc.revokeSession(rawToken, reason, meta?.ipAddress, meta?.requestId);
  }
}
