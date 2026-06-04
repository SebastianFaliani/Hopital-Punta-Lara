import { pool }
  from '../../config/database';

export function canAccessAllFacilities(
  user: any
) {

  return (
    user?.role === 'admin' ||
    user?.access_all_facilities ||
    user?.facility_type === 'secretaria' ||
    !user?.facility_id
  );
}

export function getScopedFacilityId(
  user: any,
  requestedFacilityId?: number | null
) {

  if (canAccessAllFacilities(user)) {
    return requestedFacilityId || null;
  }

  if (
    requestedFacilityId &&
    Array.isArray(user?.facility_ids) &&
    user.facility_ids
      .map(Number)
      .includes(Number(requestedFacilityId))
  ) {
    return Number(requestedFacilityId);
  }

  return Number(user.facility_id);
}

export function assertFacilityAccess(
  user: any,
  facilityId: number
) {

  if (canAccessFacility(user, facilityId)) {
    return;
  }

  throw new Error(
    'No tenes permiso para operar sobre este punto de stock'
  );
}

export function canAccessFacility(
  user: any,
  facilityId: number
) {
  if (canAccessAllFacilities(user)) {
    return true;
  }

  const allowedFacilityIds =
    Array.isArray(user?.facility_ids)
      ? user.facility_ids.map(Number)
      : [Number(user?.facility_id)];

  return allowedFacilityIds.includes(Number(facilityId));
}

export async function canPrepareFromSecretary(
  user: any
) {

  if (
    user?.role === 'admin' ||
    user?.access_all_facilities ||
    user?.facility_type === 'secretaria' ||
    !user?.facility_id
  ) {
    return true;
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT facility_type
        FROM health_facilities
        WHERE id = ?
          AND is_active = TRUE
        LIMIT 1
      `,
      [user.facility_id]
    );

  return (
    rows.length > 0 &&
    rows[0].facility_type === 'secretaria'
  );
}
