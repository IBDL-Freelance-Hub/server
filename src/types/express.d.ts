export interface RequestUser {
  id: string;
  email: string;
  userType: 'MEMBER' | 'STAFF';
  status: 'ACTIVE' | 'UNACTIVATED' | 'SUSPENDED' | 'CLOSED';
  staffRole?: string | null;
  memberId?: string | null;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      language: 'en' | 'ar';
      user?: RequestUser;
    }
  }
}
