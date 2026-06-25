import type { User } from './AuthContext';

type NavigationItem = {
  path: string;
  label: string;
};

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
    if (
      user.role === 'dir' &&
      permission.endsWith('.manage') &&
      user.permissions?.includes(
        permission.replace('.manage', '.view')
      )
    ) {
      return true;
    }

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

function canUseHospitalModules(
  user: User | null | undefined
) {
  if (!user) {
    return false;
  }

  return (
    user.role === 'admin' ||
    user.facility_type === 'secretaria' ||
    user.facility_type === 'hospital' ||
    !user.facility_id
  );
}

export function getAvailableNavigation(
  user: User | null | undefined
): NavigationItem[] {
  if (!user) {
    return [];
  }

  const hospitalModules =
    canUseHospitalModules(user);

  const items: NavigationItem[] = [];

  if (
    hasPermission(
      user,
      'dashboard.view',
      ['admin', 'dir']
    )
  ) {
    items.push({
      path: '/dashboard',
      label: 'Dashboard'
    });
  }

  if (user.role === 'admin') {
    items.push({
      path: '/users',
      label: 'Usuarios'
    });
    items.push({
      path: '/facilities',
      label: 'Dependencias'
    });
  }

  if (
    hasPermission(
      user,
      'personnel.view',
      ['admin', 'user', 'dir']
    )
  ) {
    items.push({
      path: '/personnel',
      label: 'Personal'
    });
  }

  if (
    hasPermission(
      user,
      'vaccines.view',
      ['admin', 'vacu', 'dir']
    )
  ) {
    items.push({
      path: '/vaccines',
      label: 'Vacunas'
    });
  }

  if (
    hasPermission(
      user,
      'medications.view',
      ['admin', 'farmacia', 'dir']
    )
  ) {
    items.push({
      path: '/medications',
      label: 'Medicamentos'
    });
  }

  if (
    hospitalModules &&
    hasPermission(
      user,
      'transfers.view',
      ['admin', 'user', 'dir']
    )
  ) {
    items.push({
      path: '/transfers',
      label: 'Traslados'
    });
  }

  if (
    hospitalModules &&
    hasPermission(
      user,
      'laboratory.view',
      ['admin', 'lab', 'user', 'dir']
    )
  ) {
    items.push({
      path: '/laboratory',
      label: 'Laboratorio'
    });
  }

  if (
    hospitalModules &&
    hasPermission(
      user,
      'nutrition.view',
      ['admin', 'dir', 'nutri']
    )
  ) {
    items.push({
      path: '/nutrition',
      label: 'Nutricion'
    });
  }

  if (
    hospitalModules &&
    hasPermission(
      user,
      'housekeeping.view',
      ['admin', 'mayo', 'dir']
    )
  ) {
    items.push({
      path: '/housekeeping',
      label: 'Mayordomia'
    });
  }

  if (user.role === 'admin') {
    items.push({
      path: '/whatsapp',
      label: 'WhatsApp'
    });
  }

  if (
    hasPermission(
      user,
      'audit.view',
      ['admin', 'dir']
    )
  ) {
    items.push({
      path: '/audit',
      label: 'Auditoria'
    });
  }

  return items;
}

export function getDefaultPath(
  user: User | null | undefined
) {
  return getAvailableNavigation(user)[0]?.path || '/login';
}
