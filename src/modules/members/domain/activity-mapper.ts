export type ActivityTone = 'positive' | 'neutral' | 'info';

export interface MemberActivityItem {
  text: {
    en: string;
    ar: string;
  };
  date: Date;
  tone: ActivityTone;
}

interface ActivityTemplate {
  text: {
    en: string;
    ar: string;
  };
  tone: ActivityTone;
}

/**
 * Mapping table from internal AuditLog action codes to bilingual, human-readable
 * member-facing activity statements (ACT-58).
 *
 * Any action code NOT explicitly present in this map is considered an internal
 * audit event and MUST be silently dropped when building the member activity feed.
 */
export const MEMBER_ACTIVITY_MAP: Record<string, ActivityTemplate> = {
  MEMBER_REGISTERED: {
    text: {
      en: 'Registration completed',
      ar: 'تم إكمال التسجيل',
    },
    tone: 'positive',
  },
  PROFILE_UPDATED: {
    text: {
      en: 'Profile updated',
      ar: 'تم تحديث الملف الشخصي',
    },
    tone: 'info',
  },
  MEMBER_PROFILE_UPDATED: {
    text: {
      en: 'Profile updated',
      ar: 'تم تحديث الملف الشخصي',
    },
    tone: 'info',
  },
  CV_UPLOADED: {
    text: {
      en: 'CV uploaded',
      ar: 'تم رفع السيرة الذاتية',
    },
    tone: 'info',
  },
  PHOTO_UPLOADED: {
    text: {
      en: 'Profile photo updated',
      ar: 'تم تحديث الصورة الشخصية',
    },
    tone: 'info',
  },
  PROFILE_PHOTO_UPLOADED: {
    text: {
      en: 'Profile photo updated',
      ar: 'تم تحديث الصورة الشخصية',
    },
    tone: 'info',
  },
  MEMBERSHIP_UPGRADED: {
    text: {
      en: 'Membership upgraded',
      ar: 'تمت ترقية العضوية',
    },
    tone: 'positive',
  },
  ACCOUNT_ACTIVATED: {
    text: {
      en: 'Account activated',
      ar: 'تم تفعيل الحساب',
    },
    tone: 'positive',
  },
  PASSWORD_CHANGED: {
    text: {
      en: 'Password changed',
      ar: 'تم تغيير كلمة المرور',
    },
    tone: 'neutral',
  },
  AUTH_PASSWORD_CHANGED: {
    text: {
      en: 'Password changed',
      ar: 'تم تغيير كلمة المرور',
    },
    tone: 'neutral',
  },
  PASSWORD_RESET: {
    text: {
      en: 'Password reset',
      ar: 'تمت إعادة تعيين كلمة المرور',
    },
    tone: 'neutral',
  },
  PASSWORD_RESET_SUCCESSFUL: {
    text: {
      en: 'Password reset',
      ar: 'تمت إعادة تعيين كلمة المرور',
    },
    tone: 'neutral',
  },
  USER_LOGIN: {
    text: {
      en: 'Logged in',
      ar: 'تم تسجيل الدخول',
    },
    tone: 'neutral',
  },
  SESSION_REVOKED: {
    text: {
      en: 'Session signed out',
      ar: 'تم تسجيل الخروج من الجلسة',
    },
    tone: 'neutral',
  },
  SESSION_ENDED: {
    text: {
      en: 'Session signed out',
      ar: 'تم تسجيل الخروج من الجلسة',
    },
    tone: 'neutral',
  },
};

/**
 * Maps an internal audit action code to a safe, projected member-facing activity entry.
 * Returns null if the action code has no mapping entry (silently excluded per ACT-58).
 */
export function mapAuditLogToMemberActivity(
  action: string,
  createdAt: Date,
): MemberActivityItem | null {
  const template = MEMBER_ACTIVITY_MAP[action];
  if (!template) {
    return null;
  }

  return {
    text: {
      en: template.text.en,
      ar: template.text.ar,
    },
    date: createdAt,
    tone: template.tone,
  };
}
