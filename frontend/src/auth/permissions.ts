import type { User } from './AuthContext';

export function hasPermission(
  user: User | null | undefined,
  permission: string,
  fallbackRoles: string[] = []
) {
  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.permissions_configured) {
    return Boolean(
      user.permissions?.includes(permission) ||
      (
        permission.endsWith('.view') &&
        user.permissions?.includes(
          permission.replace('.view', '.manage')
        )
      )
    );
  }

  return fallbackRoles.includes(user.role);
}
