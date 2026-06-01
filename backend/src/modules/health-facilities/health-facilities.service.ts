import { pool }
  from '../../config/database';

import {
  HealthFacilityInput
} from './health-facilities.types';

export async function getActiveFacilities() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          facility_type,
          address,
          phone,
          notes,
          is_active,
          created_at,
          updated_at
        FROM health_facilities
        WHERE is_active = TRUE
        ORDER BY
          FIELD(
            facility_type,
            'secretaria',
            'hospital',
            'unidad_sanitaria',
            'otro'
          ),
          name ASC
      `
    );

  return rows;
}

export async function getAllFacilities() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          facility_type,
          address,
          phone,
          notes,
          is_active,
          created_at,
          updated_at
        FROM health_facilities
        ORDER BY
          is_active DESC,
          FIELD(
            facility_type,
            'secretaria',
            'hospital',
            'unidad_sanitaria',
            'otro'
          ),
          name ASC
      `
    );

  return rows;
}

export async function createFacility(
  facility: HealthFacilityInput
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO health_facilities (
          name,
          facility_type,
          address,
          phone,
          notes
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        facility.name,
        facility.facility_type,
        facility.address ?? null,
        facility.phone ?? null,
        facility.notes ?? null
      ]
    );

  return result.insertId;
}

export async function updateFacility(
  id: number,
  facility: HealthFacilityInput
) {

  await pool.query(
    `
      UPDATE health_facilities
      SET
        name = ?,
        facility_type = ?,
        address = ?,
        phone = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      facility.name,
      facility.facility_type,
      facility.address ?? null,
      facility.phone ?? null,
      facility.notes ?? null,
      id
    ]
  );
}

export async function toggleFacility(
  id: number
) {

  await pool.query(
    `
      UPDATE health_facilities
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );
}

export async function getDefaultFacilityId(
  connection: any = pool
) {

  const [rows]: any =
    await connection.query(
      `
        SELECT id
        FROM health_facilities
        WHERE name = 'Hospital Municipal de Punta Lara'
        LIMIT 1
      `
    );

  if (rows.length > 0) {
    return Number(rows[0].id);
  }

  const [fallbackRows]: any =
    await connection.query(
      `
        SELECT id
        FROM health_facilities
        WHERE is_active = TRUE
        ORDER BY id ASC
        LIMIT 1
      `
    );

  return fallbackRows.length > 0
    ? Number(fallbackRows[0].id)
    : null;
}
