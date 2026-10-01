import { Request, Response, NextFunction } from 'express';
import { StaffRole } from '@prisma/client';
import { AuthorizationError } from '../errors';

export type AllowedStaffRole = StaffRole | 'OPERATIONS_OFFICER';

/**
 * Normalizes staff role aliases (e.g. OPERATIONS_OFFICER -> REVIEWER_OPERATOR).
 */
function normalizeStaffRole(role: AllowedStaffRole): StaffRole {
  if (role === 'OPERATIONS_OFFICER') {
    return StaffRole.REVIEWER_OPERATOR;
  }
  return role;
}

/**
 * Middleware factory that restricts route access to staff members holding one of the specified roles.
 * Must be preceded by `requireAuth`.
 */
export function requireStaffRole(allowedRoles: AllowedStaffRole[]) {
  const normalizedAllowed = allowedRoles.map(normalizeStaffRole);

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || req.user.userType !== 'STAFF') {
      throw new AuthorizationError('Access restricted to authorized staff personnel.');
    }

    const userRole = req.user.staffRole as StaffRole | null;
    if (!userRole) {
      throw new AuthorizationError('Access denied. Staff profile has no assigned role.');
    }

    const isAuthorized =
      userRole === StaffRole.SYSTEM_ADMINISTRATOR || normalizedAllowed.includes(userRole);

    if (!isAuthorized) {
      throw new AuthorizationError(
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}].`,
      );
    }

    next();
  };
}
