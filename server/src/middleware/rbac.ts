import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth.js';
import { AppError } from './errors.js';
import { Role, roleHas } from '../services/permissions.js';

/** Route-level permission gate. Every mutating admin route declares one. */
export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      return next(new AppError(401, 'Please sign in to continue.', 'unauthenticated'));
    }
    const allowed = permissions.some((permission) => roleHas(req.admin!.role, permission));
    if (!allowed) {
      return next(
        new AppError(
          403,
          'Your role does not include this action. Ask a studio owner for access.',
          'insufficient_permission'
        )
      );
    }
    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      return next(new AppError(401, 'Please sign in to continue.', 'unauthenticated'));
    }
    if (!roles.includes(req.admin.role)) {
      return next(new AppError(403, 'This area is restricted.', 'insufficient_role'));
    }
    next();
  };
}

export const requireSuperAdmin = requireRole('SUPER_ADMIN');
