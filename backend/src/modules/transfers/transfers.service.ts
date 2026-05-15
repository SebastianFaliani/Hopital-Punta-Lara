import { pool }
  from '../../config/database';

function normalizeDateTime(
  value: string | null | undefined
) {

  if (!value) {
    return null;
  }

  return value;
}

export async function getAllTransfers() {

  const [requestRows]: any =
    await pool.query(
      `
        SELECT
          tr.id,
          tr.patient_id,
          tr.patient_name,
          tr.origin_address,
          tr.destination_address,
          tr.destination_type,
          tr.transfer_date,
          tr.notes,
          tr.requires_return,
          tr.status,
          tr.created_by,
          tr.created_at,
          tr.updated_at,
          CONCAT(u.first_name, ' ', u.last_name)
            AS created_by_name
        FROM transfer_requests tr
        LEFT JOIN users u
          ON u.id = tr.created_by
        ORDER BY tr.transfer_date DESC, tr.id DESC
      `
    );

  const [tripRows]: any =
    await pool.query(
      `
        SELECT
          tt.id,
          tt.transfer_request_id,
          tt.trip_type,
          tt.ambulance_id,
          tt.driver_id,
          tt.scheduled_datetime,
          tt.departure_datetime,
          tt.arrival_datetime,
          tt.status,
          tt.notes,
          a.internal_code AS ambulance_code,
          a.plate AS ambulance_plate,
          CONCAT(d.first_name, ' ', d.last_name)
            AS driver_name
        FROM transfer_trips tt
        LEFT JOIN ambulances a
          ON a.id = tt.ambulance_id
        LEFT JOIN drivers d
          ON d.id = tt.driver_id
        ORDER BY tt.scheduled_datetime ASC, tt.id ASC
      `
    );

  return requestRows.map((request: any) => ({
    ...request,
    trips: tripRows.filter((trip: any) =>
      trip.transfer_request_id === request.id
    )
  }));
}

export async function createTransfer(
  data: any,
  createdBy: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [requestResult]: any =
      await connection.query(
        `
          INSERT INTO transfer_requests (
            patient_id,
            patient_name,
            origin_address,
            destination_address,
            destination_type,
            transfer_date,
            notes,
            requires_return,
            status,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.patient_id || null,
          data.patient_name,
          data.origin_address,
          data.destination_address,
          data.destination_type,
          data.transfer_date,
          data.notes || null,
          Boolean(data.requires_return),
          'programado',
          createdBy
        ]
      );

    const requestId =
      requestResult.insertId;

    const outbound =
      data.outbound_trip || {};

    await connection.query(
      `
        INSERT INTO transfer_trips (
          transfer_request_id,
          trip_type,
          ambulance_id,
          driver_id,
          scheduled_datetime,
          status,
          notes
        )
        VALUES (?, 'ida', ?, ?, ?, ?, ?)
      `,
      [
        requestId,
        outbound.ambulance_id || null,
        outbound.driver_id || null,
        normalizeDateTime(
          outbound.scheduled_datetime
        ),
        outbound.ambulance_id &&
          outbound.driver_id
          ? 'asignado'
          : 'pendiente',
        outbound.notes || null
      ]
    );

    if (data.requires_return) {

      const returnTrip =
        data.return_trip || {};

      await connection.query(
        `
          INSERT INTO transfer_trips (
            transfer_request_id,
            trip_type,
            ambulance_id,
            driver_id,
            scheduled_datetime,
            status,
            notes
          )
          VALUES (?, 'vuelta', ?, ?, ?, ?, ?)
        `,
        [
          requestId,
          returnTrip.ambulance_id || null,
          returnTrip.driver_id || null,
          normalizeDateTime(
            returnTrip.scheduled_datetime
          ),
          returnTrip.ambulance_id &&
            returnTrip.driver_id
            ? 'asignado'
            : 'pendiente',
          returnTrip.notes || null
        ]
      );
    }

    await connection.commit();

    return requestId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function updateTransferStatus(
  id: number,
  status: string
) {

  await pool.query(
    `
      UPDATE transfer_requests
      SET status = ?
      WHERE id = ?
    `,
    [
      status,
      id
    ]
  );

  return true;
}

export async function updateTransferTrip(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE transfer_trips
      SET
        ambulance_id = ?,
        driver_id = ?,
        scheduled_datetime = ?,
        departure_datetime = ?,
        arrival_datetime = ?,
        status = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      data.ambulance_id || null,
      data.driver_id || null,
      normalizeDateTime(
        data.scheduled_datetime
      ),
      normalizeDateTime(
        data.departure_datetime
      ),
      normalizeDateTime(
        data.arrival_datetime
      ),
      data.status,
      data.notes || null,
      id
    ]
  );

  return true;
}
