import {
  SessionService,
  sessionService as defaultSessionService,
  ActiveSessionDto,
} from '../infrastructure/session.service';

export class GetActiveSessionsUseCase {
  constructor(private readonly sessionSvc: SessionService = defaultSessionService) {}

  async execute(userId: string, currentSessionId?: string): Promise<ActiveSessionDto[]> {
    return this.sessionSvc.getActiveSessions(userId, currentSessionId);
  }
}
