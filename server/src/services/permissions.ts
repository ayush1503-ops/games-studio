export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';

export const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR'];

/**
 * Permission matrix — the single source of truth for server-side authorisation.
 * The admin UI mirrors this list for hiding controls, but the API always
 * re-checks it: the browser is never trusted.
 */
const MATRIX: Record<Role, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'dashboard:read',
    'games:read', 'games:create', 'games:update', 'games:delete', 'games:publish', 'games:feature',
    'news:read', 'news:create', 'news:update', 'news:delete', 'news:publish', 'news:feature',
    'categories:read', 'categories:create', 'categories:update', 'categories:delete',
    'jobs:read', 'jobs:create', 'jobs:update', 'jobs:delete', 'jobs:publish',
    'media:read', 'media:upload', 'media:delete',
    'players:read', 'players:update', 'players:delete',
    'subscribers:read', 'subscribers:update', 'subscribers:export', 'subscribers:delete',
    'contacts:read', 'contacts:update', 'contacts:delete',
    'content:read', 'content:update',
    'settings:read', 'settings:update',
    'activity:read',
    'team:read',
    'backup:export',
  ],
  EDITOR: [
    'dashboard:read',
    'games:read', 'games:create', 'games:update', 'games:publish', 'games:feature',
    'news:read', 'news:create', 'news:update', 'news:publish', 'news:feature',
    'categories:read',
    'jobs:read', 'jobs:create', 'jobs:update', 'jobs:publish',
    'media:read', 'media:upload',
    'players:read',
    'subscribers:read',
    'contacts:read', 'contacts:update',
    'content:read', 'content:update',
    'activity:read',
    'team:read',
  ],
};

export function permissionsForRole(role: Role): string[] {
  return MATRIX[role] ?? [];
}

export function roleHas(role: Role, permission: string): boolean {
  const list = permissionsForRole(role);
  return list.includes('*') || list.includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Studio Owner',
  ADMIN: 'Studio Manager',
  EDITOR: 'Content Editor',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Unrestricted access, including the team, settings and backups.',
  ADMIN: 'Full content, audience and media access. Cannot manage team accounts.',
  EDITOR: 'Creates, edits, publishes and features games, posts and roles. No deletes or audience exports.',
};

/** Exposed to the admin UI so permission tooltips match what the API enforces. */
export const ROLE_MATRIX = ROLES.map((role) => ({
  role,
  label: ROLE_LABELS[role],
  description: ROLE_DESCRIPTIONS[role],
  permissions: permissionsForRole(role),
}));
