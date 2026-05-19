import { PoolConnection }
  from 'mysql2/promise';

import { pool }
  from '../../config/database';

function normalizeDateTime(
  value: string | Date | null | undefined
) {
  if (!value) {
    return null;
  }

  return toSqlDateTime(value);
}

function toSqlDateTime(
  value: string | Date
) {
  if (value instanceof Date) {
    const pad = (number: number) =>
      String(number).padStart(2, '0');

    return [
      value.getFullYear(),
      pad(value.getMonth() + 1),
      pad(value.getDate())
    ].join('-') +
      ` ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  return String(value)
    .replace('T', ' ')
    .slice(0, 19);
}

function datePart(value: string | Date) {
  return toSqlDateTime(value).slice(0, 10);
}

function asDateTime(
  date: string,
  time: string
) {
  return `${datePart(date)} ${String(time).slice(0, 8)}`;
}

function addMinutesSqlDate(
  value: string,
  minutes: number
) {
  const normalized =
    value.replace('T', ' ').slice(0, 19);

  const [
    datePartValue,
    timePartValue
  ] = normalized.split(' ');

  const [
    year,
    month,
    day
  ] = datePartValue.split('-').map(Number);

  const [
    hour,
    minute,
    second = 0
  ] = timePartValue.split(':').map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day,
      hour,
      minute + minutes,
      second
    );

  const pad = (number: number) =>
    String(number).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function isAtLeastOneDayAhead(
  scheduled: string
) {
  const today =
    new Date();

  const tomorrow =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

  const scheduledDate =
    new Date(
      `${scheduled.replace(' ', 'T')}`
    );

  return scheduledDate >= tomorrow;
}

async function insertTrip(
  connection: PoolConnection,
  requestId: number,
  tripType: 'ida' | 'vuelta',
  trip: any
) {
  const scheduled =
    normalizeDateTime(
      trip.scheduled_datetime
    );

  const duration =
    Math.max(
      1,
      Number(
        trip.estimated_duration_minutes || 60
      )
    );

  const scheduledEnd =
    scheduled
      ? (
        normalizeDateTime(
          trip.scheduled_end_datetime
        ) ||
        addMinutesSqlDate(
          scheduled,
          duration
        )
      )
      : null;

  await connection.query(
    `
      INSERT INTO transfer_trips (
        transfer_request_id,
        trip_type,
        ambulance_id,
        driver_id,
        scheduled_datetime,
        scheduled_end_datetime,
        estimated_duration_minutes,
        status,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      requestId,
      tripType,
      trip.ambulance_id || null,
      trip.driver_id || null,
      scheduled,
      scheduledEnd,
      duration,
      trip.ambulance_id && trip.driver_id
        ? 'asignado'
        : 'pendiente',
      trip.notes || null
    ]
  );
}

async function getDayType(
  connection: PoolConnection,
  date: string | Date
) {
  const [holidayRows]: any =
    await connection.query(
      `
        SELECT id
        FROM transfer_holidays
        WHERE holiday_date = ?
        LIMIT 1
      `,
      [datePart(date)]
    );

  if (holidayRows.length > 0) {
    return 'feriado';
  }

  const [year, month, day] =
    datePart(date)
      .split('-')
      .map(Number);

  const weekday =
    new Date(year, month - 1, day)
      .getDay();

  if (weekday === 0) {
    return 'domingo';
  }

  if (weekday === 6) {
    return 'sabado';
  }

  return 'lunes_viernes';
}

async function validateTripCapacity(
  connection: PoolConnection,
  trip: any,
  excludeTripId?: number
) {
  if (
    !trip.scheduled_datetime ||
    trip.capacity_exception
  ) {
    return;
  }

  const scheduled =
    toSqlDateTime(
      trip.scheduled_datetime
    );

  const duration =
    Math.max(
      1,
      Number(
        trip.estimated_duration_minutes || 60
      )
    );

  const scheduledEnd =
    trip.scheduled_end_datetime
      ? toSqlDateTime(
        trip.scheduled_end_datetime
      )
      :
    addMinutesSqlDate(
      scheduled,
      duration
    );

  const dayType =
    await getDayType(
      connection,
      scheduled
    );

  const time =
    scheduled.slice(11, 19);

  const [ruleRows]: any =
    await connection.query(
      `
        SELECT
          id,
          max_simultaneous,
          start_time,
          end_time
        FROM transfer_capacity_rules
        WHERE day_type = ?
          AND is_active = TRUE
          AND ? >= start_time
          AND ? < end_time
        LIMIT 1
      `,
      [dayType, time, time]
    );

  if (ruleRows.length === 0) {
    throw new Error(
      'El horario seleccionado queda fuera de los turnos configurados.'
    );
  }

  const rule =
    ruleRows[0];

  const ruleEnd =
    `${scheduled.slice(0, 10)} ${String(rule.end_time).slice(0, 8)}`;

  if (scheduledEnd > ruleEnd) {
    throw new Error(
      `El traslado de ${scheduled.slice(11, 16)} a ${scheduledEnd.slice(11, 16)} no queda completo dentro del turno disponible. ` +
      `Este turno permite traslados entre ${String(rule.start_time).slice(0, 5)} y ${String(rule.end_time).slice(0, 5)}.`
    );
  }

  async function maxConcurrentWithCandidate(
    startValue: string,
    endValue: string
  ) {
    const params: any[] = [
      endValue,
      startValue
    ];

    let excludeSql = '';

    if (excludeTripId) {
      excludeSql =
        'AND tt.id <> ?';
      params.push(excludeTripId);
    }

    const [rows]: any =
      await connection.query(
        `
          SELECT
            DATE_FORMAT(
              tt.scheduled_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS starts_at,
            DATE_FORMAT(
              COALESCE(
                tt.scheduled_end_datetime,
                DATE_ADD(
                  tt.scheduled_datetime,
                  INTERVAL tt.estimated_duration_minutes MINUTE
                )
              ),
              '%Y-%m-%d %H:%i:%s'
            ) AS ends_at
          FROM transfer_trips tt
          INNER JOIN transfer_requests tr
            ON tr.id = tt.transfer_request_id
          WHERE tr.request_type <> 'oficio_urgente'
            AND tr.status IN (
              'pendiente_confirmacion',
              'confirmado',
              'programado',
              'en_proceso'
            )
            AND tt.status IN (
              'pendiente',
              'asignado',
              'en_camino'
            )
            AND tt.scheduled_datetime < ?
            AND COALESCE(
              tt.scheduled_end_datetime,
              DATE_ADD(
                tt.scheduled_datetime,
                INTERVAL tt.estimated_duration_minutes MINUTE
              )
            ) > ?
            ${excludeSql}
        `,
        params
      );

    const events:
      Array<{
        time: string;
        change: number;
      }> = [
        {
          time: startValue,
          change: 1
        },
        {
          time: endValue,
          change: -1
        }
      ];

    rows.forEach((row: any) => {
      events.push(
        {
          time: row.starts_at,
          change: 1
        },
        {
          time: row.ends_at,
          change: -1
        }
      );
    });

    events.sort((left, right) => {
      const byTime =
        left.time.localeCompare(
          right.time
        );

      if (byTime !== 0) {
        return byTime;
      }

      return left.change - right.change;
    });

    let active = 0;
    let peak = 0;

    events.forEach((event) => {
      active += event.change;
      peak = Math.max(peak, active);
    });

    return peak;
  }

  async function findSuggestedTime() {
    let candidate =
      addMinutesSqlDate(
        scheduled,
        15
      );

    while (
      candidate.slice(0, 10) ===
        scheduled.slice(0, 10)
    ) {
      const candidateEnd =
        addMinutesSqlDate(
          candidate,
          duration
        );

      if (candidateEnd > ruleEnd) {
        return null;
      }

      const candidatePeak =
        await maxConcurrentWithCandidate(
          candidate,
          candidateEnd
        );

      if (
        candidatePeak <=
        Number(rule.max_simultaneous)
      ) {
        return candidate.slice(11, 16);
      }

      candidate =
        addMinutesSqlDate(
          candidate,
          15
        );
    }

    return null;
  }

  const peak =
    await maxConcurrentWithCandidate(
      scheduled,
      scheduledEnd
    );

  if (
    peak >
      Number(rule.max_simultaneous)
  ) {
    const suggestion =
      await findSuggestedTime();

    throw new Error(
      `No hay disponibilidad para las ${scheduled.slice(11, 16)}.` +
      (
        suggestion
          ? ` Proba con ${suggestion}.`
          : ''
      )
    );
  }
}

export async function getAllTransfers(
  filters: any = {}
) {
  const params: any[] = [];
  const where: string[] = [];

  if (filters.date_from) {
    where.push('tr.transfer_date >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('tr.transfer_date <= ?');
    params.push(filters.date_to);
  }

  if (filters.status) {
    where.push('tr.status = ?');
    params.push(filters.status);
  }

  if (filters.request_type) {
    where.push('tr.request_type = ?');
    params.push(filters.request_type);
  }

  if (filters.facility_id) {
    where.push('tr.facility_id = ?');
    params.push(Number(filters.facility_id));
  }

  if (filters.search) {
    where.push(
      `(
        tr.patient_name LIKE ?
        OR tr.patient_document LIKE ?
        OR tr.destination_address LIKE ?
        OR tr.requester_name LIKE ?
        OR hf.name LIKE ?
      )`
    );
    const search =
      `%${filters.search}%`;
    params.push(
      search,
      search,
      search,
      search,
      search
    );
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const [requestRows]: any =
    await pool.query(
      `
        SELECT
          tr.*,
          DATE_FORMAT(
            tr.transfer_date,
            '%Y-%m-%d'
          ) AS transfer_date,
          DATE_FORMAT(
            tr.appointment_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS appointment_datetime,
          DATE_FORMAT(
            tr.confirmed_at,
            '%Y-%m-%dT%H:%i:%s'
          ) AS confirmed_at,
          hf.name AS facility_name,
          CONCAT(u.first_name, ' ', u.last_name)
            AS created_by_name,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS confirmed_by_name
        FROM transfer_requests tr
        LEFT JOIN users u
          ON u.id = tr.created_by
        LEFT JOIN users cu
          ON cu.id = tr.confirmed_by
        LEFT JOIN health_facilities hf
          ON hf.id = tr.facility_id
        ${whereSql}
        ORDER BY tr.transfer_date DESC, tr.id DESC
      `,
      params
    );

  if (requestRows.length === 0) {
    return [];
  }

  const requestIds =
    requestRows.map((item: any) => item.id);

  const placeholders =
    requestIds.map(() => '?').join(',');

  const [tripRows]: any =
    await pool.query(
      `
        SELECT
          tt.*,
          DATE_FORMAT(
            tt.scheduled_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS scheduled_datetime,
          DATE_FORMAT(
            tt.scheduled_end_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS scheduled_end_datetime,
          DATE_FORMAT(
            tt.departure_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS departure_datetime,
          DATE_FORMAT(
            tt.arrival_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS arrival_datetime,
          a.internal_code AS ambulance_code,
          a.plate AS ambulance_plate,
          CONCAT(d.first_name, ' ', d.last_name)
            AS driver_name
        FROM transfer_trips tt
        LEFT JOIN ambulances a
          ON a.id = tt.ambulance_id
        LEFT JOIN drivers d
          ON d.id = tt.driver_id
        WHERE tt.transfer_request_id IN (${placeholders})
        ORDER BY tt.scheduled_datetime ASC, tt.id ASC
      `,
      requestIds
    );

  return requestRows.map((request: any) => ({
    ...request,
    trips: tripRows.filter((trip: any) =>
      trip.transfer_request_id === request.id
    )
  }));
}

export async function getTransferOverview(
  date: string
) {
  const connection =
    await pool.getConnection();

  try {
    const dayType =
      await getDayType(connection, date);

    const [rules]: any =
      await connection.query(
        `
          SELECT
            id,
            day_type,
            TIME_FORMAT(start_time, '%H:%i') AS start_time,
            TIME_FORMAT(end_time, '%H:%i') AS end_time,
            max_simultaneous
          FROM transfer_capacity_rules
          WHERE day_type = ?
            AND is_active = TRUE
          ORDER BY start_time
        `,
        [dayType]
      );

    const transfers =
      await getAllTransfers({
        date_from: date,
        date_to: date
      });

    const trips =
      transfers
        .flatMap((request: any) =>
          request.trips.map((trip: any) => ({
            ...trip,
            request
          }))
        )
        .filter((trip: any) =>
          trip.scheduled_datetime &&
          trip.status !== 'cancelado' &&
          [
            'pendiente_confirmacion',
            'confirmado',
            'programado',
            'en_proceso'
          ].includes(trip.request.status)
        )
        .sort((a: any, b: any) =>
          String(a.scheduled_datetime)
            .localeCompare(
              String(b.scheduled_datetime)
            )
        );

    return {
      date,
      day_type: dayType,
      rules,
      trips
    };
  } finally {
    connection.release();
  }
}

export async function createTransfer(
  data: any,
  createdBy: number | null
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requestType =
      data.request_type || 'programado';

    const outbound =
      data.outbound_trip || {};

    if (!outbound.scheduled_datetime) {
      throw new Error(
        'La fecha y hora del viaje de ida son obligatorias.'
      );
    }

    if (
      requestType !== 'oficio_urgente' &&
      !data.is_advance_exception &&
      !isAtLeastOneDayAhead(
        outbound.scheduled_datetime
      )
    ) {
      throw new Error(
        'Los traslados programados deben solicitarse con al menos un dia de anticipacion. Marca la excepcion e indica el motivo para continuar.'
      );
    }

    if (
      (
        requestType === 'oficio_urgente' ||
        data.is_advance_exception
      ) &&
      !data.exception_reason
    ) {
      throw new Error(
        'Debes indicar el motivo de la excepcion o del traslado urgente de oficio.'
      );
    }

    if (
      requestType === 'oficio_urgente'
    ) {
      await validateTripCapacity(
        connection,
        {
          ...outbound,
          capacity_exception: true
        }
      );
    }

    const initialStatus =
      requestType === 'oficio_urgente'
        ? 'confirmado'
        : 'pendiente_confirmacion';

    const [requestResult]: any =
      await connection.query(
        `
          INSERT INTO transfer_requests (
            request_type,
            facility_id,
            patient_id,
            patient_name,
            patient_document,
            patient_phone,
            origin_address,
            destination_address,
            destination_type,
            transfer_date,
            appointment_datetime,
            service_name,
            mobility_type,
            mobility_notes,
            justification,
            requester_name,
            requester_role,
            requester_phone,
            notes,
            requires_return,
            is_advance_exception,
            exception_reason,
            exception_authorized_by,
            status,
            confirmed_by,
            confirmed_at,
            recurring_template_id,
            created_by
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `,
        [
          requestType,
          data.facility_id || null,
          data.patient_id || null,
          data.patient_name,
          data.patient_document || null,
          data.patient_phone || null,
          data.origin_address,
          data.destination_address,
          data.destination_type,
          datePart(
            outbound.scheduled_datetime
          ),
          normalizeDateTime(
            data.appointment_datetime
          ),
          data.service_name || null,
          data.mobility_type ||
            'propios_medios',
          data.mobility_notes || null,
          data.justification || null,
          data.requester_name || null,
          data.requester_role || null,
          data.requester_phone || null,
          data.notes || null,
          Boolean(data.requires_return),
          Boolean(
            data.is_advance_exception ||
            requestType === 'oficio_urgente'
          ),
          data.exception_reason || null,
          (
            data.is_advance_exception ||
            requestType === 'oficio_urgente'
          )
            ? createdBy
            : null,
          initialStatus,
          requestType === 'oficio_urgente'
            ? createdBy
            : null,
          requestType === 'oficio_urgente'
            ? new Date()
            : null,
          data.recurring_template_id || null,
          createdBy
        ]
      );

    const requestId =
      requestResult.insertId;

    await insertTrip(
      connection,
      requestId,
      'ida',
      outbound
    );

    if (data.requires_return) {
      const returnTrip =
        data.return_trip || {};

      if (!returnTrip.scheduled_datetime) {
        throw new Error(
          'La fecha y hora del viaje de vuelta son obligatorias.'
        );
      }

      await insertTrip(
        connection,
        requestId,
        'vuelta',
        returnTrip
      );
    }

    if (requestType !== 'oficio_urgente') {
      const [newTrips]: any =
        await connection.query(
          `
            SELECT *
            FROM transfer_trips
            WHERE transfer_request_id = ?
          `,
          [requestId]
        );

      for (const trip of newTrips) {
        await validateTripCapacity(
          connection,
          trip,
          trip.id
        );
      }
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

export async function confirmTransfer(
  id: number,
  confirmedBy: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [requests]: any =
      await connection.query(
        `
          SELECT *
          FROM transfer_requests
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (requests.length === 0) {
      throw new Error(
        'La solicitud no existe.'
      );
    }

    const request =
      requests[0];

    const [trips]: any =
      await connection.query(
        `
          SELECT *
          FROM transfer_trips
          WHERE transfer_request_id = ?
            AND status <> 'cancelado'
          FOR UPDATE
        `,
        [id]
      );

    if (trips.length === 0) {
      throw new Error(
        'La solicitud no tiene viajes para confirmar.'
      );
    }

    let preferredAssignment:
      {
        ambulance_id: number;
        driver_id: number;
      } | null = null;

    for (const trip of trips) {
      if (
        trip.ambulance_id &&
        trip.driver_id
      ) {
        preferredAssignment = {
          ambulance_id:
            Number(trip.ambulance_id),
          driver_id:
            Number(trip.driver_id)
        };
        continue;
      }

      const assignment =
        await findShiftAssignment(
          connection,
          trip,
          preferredAssignment
        );

      if (assignment) {
        await connection.query(
          `
            UPDATE transfer_trips
            SET
              ambulance_id = ?,
              driver_id = ?,
              status = 'asignado'
            WHERE id = ?
          `,
          [
            assignment.ambulance_id,
            assignment.driver_id,
            trip.id
          ]
        );

        trip.ambulance_id =
          assignment.ambulance_id;
        trip.driver_id =
          assignment.driver_id;

        preferredAssignment =
          assignment;
      }

      if (
        request.request_type !==
          'oficio_urgente' &&
        (
          !trip.ambulance_id ||
          !trip.driver_id
        )
      ) {
        throw new Error(
          `No hay una guardia disponible que cubra completamente el viaje de ${trip.trip_type}. Revisa las guardias o ajusta el horario antes de confirmar.`
        );
      }
    }

    if (
      request.request_type !==
      'oficio_urgente'
    ) {
      for (const trip of trips) {
        await validateTripCapacity(
          connection,
          trip,
          trip.id
        );
      }
    }

    await connection.query(
      `
        UPDATE transfer_requests
        SET
          status = 'confirmado',
          confirmed_by = ?,
          confirmed_at = NOW(),
          rejected_reason = NULL
        WHERE id = ?
      `,
      [confirmedBy, id]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findShiftAssignment(
  connection: PoolConnection,
  trip: any,
  preferred:
    {
      ambulance_id: number;
      driver_id: number;
    } | null
) {
  if (!trip.scheduled_datetime) {
    return null;
  }

  const start =
    toSqlDateTime(
      trip.scheduled_datetime
    );

  const end =
    trip.scheduled_end_datetime
      ? toSqlDateTime(
        trip.scheduled_end_datetime
      )
      : addMinutesSqlDate(
        start,
        Number(
          trip.estimated_duration_minutes || 60
        )
      );

  const [rows]: any =
    await connection.query(
      `
        SELECT
          ds.ambulance_id,
          ds.driver_id
        FROM driver_shifts ds
        INNER JOIN drivers d
          ON d.id = ds.driver_id
          AND d.is_active = TRUE
        INNER JOIN ambulances a
          ON a.id = ds.ambulance_id
          AND a.is_active = TRUE
        WHERE ds.status IN (
          'programada',
          'activa'
        )
          AND ds.start_datetime <= ?
          AND ds.end_datetime >= ?
          AND NOT EXISTS (
            SELECT 1
            FROM transfer_trips occupied_trip
            INNER JOIN transfer_requests occupied_request
              ON occupied_request.id =
                occupied_trip.transfer_request_id
            WHERE occupied_trip.id <> ?
              AND occupied_trip.status IN (
                'pendiente',
                'asignado',
                'en_camino'
              )
              AND occupied_request.status NOT IN (
                'cancelado',
                'rechazado'
              )
              AND (
                occupied_trip.driver_id = ds.driver_id
                OR occupied_trip.ambulance_id = ds.ambulance_id
              )
              AND occupied_trip.scheduled_datetime < ?
              AND COALESCE(
                occupied_trip.scheduled_end_datetime,
                DATE_ADD(
                  occupied_trip.scheduled_datetime,
                  INTERVAL occupied_trip.estimated_duration_minutes MINUTE
                )
              ) > ?
          )
        ORDER BY
          CASE
            WHEN ds.ambulance_id = ?
              AND ds.driver_id = ?
            THEN 0
            ELSE 1
          END,
          ds.start_datetime ASC,
          ds.id ASC
        LIMIT 1
      `,
      [
        start,
        end,
        trip.id || 0,
        end,
        start,
        preferred?.ambulance_id || 0,
        preferred?.driver_id || 0
      ]
    );

  return rows.length > 0
    ? {
      ambulance_id:
        Number(rows[0].ambulance_id),
      driver_id:
        Number(rows[0].driver_id)
    }
    : null;
}

async function findShiftAssignmentForDriver(
  connection: PoolConnection,
  trip: any,
  driverId: number
) {
  if (!trip.scheduled_datetime) {
    throw new Error(
      'El viaje no tiene horario programado.'
    );
  }

  const start =
    toSqlDateTime(
      trip.scheduled_datetime
    );

  const end =
    trip.scheduled_end_datetime
      ? toSqlDateTime(
        trip.scheduled_end_datetime
      )
      : addMinutesSqlDate(
        start,
        Number(
          trip.estimated_duration_minutes || 60
        )
      );

  const [rows]: any =
    await connection.query(
      `
        SELECT
          ds.ambulance_id,
          ds.driver_id
        FROM driver_shifts ds
        INNER JOIN drivers d
          ON d.id = ds.driver_id
          AND d.is_active = TRUE
        INNER JOIN ambulances a
          ON a.id = ds.ambulance_id
          AND a.is_active = TRUE
        WHERE ds.driver_id = ?
          AND ds.status IN (
            'programada',
            'activa'
          )
          AND ds.start_datetime <= ?
          AND ds.end_datetime >= ?
          AND NOT EXISTS (
            SELECT 1
            FROM transfer_trips occupied_trip
            INNER JOIN transfer_requests occupied_request
              ON occupied_request.id =
                occupied_trip.transfer_request_id
            WHERE occupied_trip.id <> ?
              AND occupied_trip.status IN (
                'pendiente',
                'asignado',
                'en_camino'
              )
              AND occupied_request.status NOT IN (
                'cancelado',
                'rechazado'
              )
              AND (
                occupied_trip.driver_id = ds.driver_id
                OR occupied_trip.ambulance_id = ds.ambulance_id
              )
              AND occupied_trip.scheduled_datetime < ?
              AND COALESCE(
                occupied_trip.scheduled_end_datetime,
                DATE_ADD(
                  occupied_trip.scheduled_datetime,
                  INTERVAL occupied_trip.estimated_duration_minutes MINUTE
                )
              ) > ?
          )
        ORDER BY ds.start_datetime ASC, ds.id ASC
        LIMIT 1
      `,
      [
        driverId,
        start,
        end,
        trip.id || 0,
        end,
        start
      ]
    );

  if (rows.length === 0) {
    throw new Error(
      'El chofer seleccionado no tiene una guardia disponible que cubra ese viaje, o ya tiene otro traslado superpuesto.'
    );
  }

  return {
    ambulance_id:
      Number(rows[0].ambulance_id),
    driver_id:
      Number(rows[0].driver_id)
  };
}

async function assertEarlierOverlappingTripsAssigned(
  connection: PoolConnection,
  trip: any
) {
  const start =
    toSqlDateTime(
      trip.scheduled_datetime
    );

  const end =
    trip.scheduled_end_datetime
      ? toSqlDateTime(
        trip.scheduled_end_datetime
      )
      : addMinutesSqlDate(
        start,
        Number(
          trip.estimated_duration_minutes || 60
        )
      );

  const [rows]: any =
    await connection.query(
      `
        SELECT
          tt.id,
          DATE_FORMAT(
            tt.scheduled_datetime,
            '%H:%i'
          ) AS start_time,
          tr.patient_name
        FROM transfer_trips tt
        INNER JOIN transfer_requests tr
          ON tr.id = tt.transfer_request_id
        WHERE tt.id <> ?
          AND tr.request_type <> 'oficio_urgente'
          AND tr.status NOT IN (
            'cancelado',
            'rechazado'
          )
          AND tt.status IN (
            'pendiente',
            'asignado',
            'en_camino'
          )
          AND (
            tt.driver_id IS NULL
            OR tt.ambulance_id IS NULL
          )
          AND tt.scheduled_datetime < ?
          AND tt.scheduled_datetime < ?
          AND COALESCE(
            tt.scheduled_end_datetime,
            DATE_ADD(
              tt.scheduled_datetime,
              INTERVAL tt.estimated_duration_minutes MINUTE
            )
          ) > ?
        ORDER BY tt.scheduled_datetime ASC
        LIMIT 1
      `,
      [
        trip.id || 0,
        start,
        end,
        start
      ]
    );

  if (rows.length > 0) {
    throw new Error(
      `Primero asigna el traslado de las ${rows[0].start_time} (${rows[0].patient_name}).`
    );
  }
}

export async function getAvailableDriversForTrip(
  tripId: number
) {
  const connection =
    await pool.getConnection();

  try {
    const [tripRows]: any =
      await connection.query(
        `
          SELECT
            tt.id,
            tt.transfer_request_id,
            DATE_FORMAT(
              tt.scheduled_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS scheduled_datetime,
            DATE_FORMAT(
              tt.scheduled_end_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS scheduled_end_datetime,
            tt.estimated_duration_minutes
          FROM transfer_trips tt
          WHERE tt.id = ?
          LIMIT 1
        `,
        [tripId]
      );

    if (tripRows.length === 0) {
      throw new Error(
        'El viaje no existe.'
      );
    }

    const trip =
      tripRows[0];

    const start =
      toSqlDateTime(
        trip.scheduled_datetime
      );

    const end =
      trip.scheduled_end_datetime
        ? toSqlDateTime(
          trip.scheduled_end_datetime
        )
        : addMinutesSqlDate(
          start,
          Number(
            trip.estimated_duration_minutes || 60
          )
        );

    await assertEarlierOverlappingTripsAssigned(
      connection,
      {
        ...trip,
        scheduled_datetime: start,
        scheduled_end_datetime: end
      }
    );

    const [rows]: any =
      await connection.query(
        `
          SELECT
            d.id,
            d.first_name,
            d.last_name,
            d.phone,
            ds.ambulance_id,
            a.internal_code AS ambulance_code,
            a.plate AS ambulance_plate
          FROM driver_shifts ds
          INNER JOIN drivers d
            ON d.id = ds.driver_id
            AND d.is_active = TRUE
          INNER JOIN ambulances a
            ON a.id = ds.ambulance_id
            AND a.is_active = TRUE
          WHERE ds.status IN (
            'programada',
            'activa'
          )
            AND ds.start_datetime <= ?
            AND ds.end_datetime >= ?
            AND NOT EXISTS (
              SELECT 1
              FROM transfer_trips occupied_trip
              INNER JOIN transfer_requests occupied_request
                ON occupied_request.id =
                  occupied_trip.transfer_request_id
              WHERE occupied_trip.id <> ?
                AND occupied_trip.status IN (
                  'pendiente',
                  'asignado',
                  'en_camino'
                )
                AND occupied_request.status NOT IN (
                  'cancelado',
                  'rechazado'
                )
                AND (
                  occupied_trip.driver_id = ds.driver_id
                  OR occupied_trip.ambulance_id = ds.ambulance_id
                )
                AND occupied_trip.scheduled_datetime < ?
                AND COALESCE(
                  occupied_trip.scheduled_end_datetime,
                  DATE_ADD(
                    occupied_trip.scheduled_datetime,
                    INTERVAL occupied_trip.estimated_duration_minutes MINUTE
                  )
                ) > ?
            )
          ORDER BY
            d.last_name ASC,
            d.first_name ASC
        `,
        [
          start,
          end,
          tripId,
          end,
          start
        ]
      );

    return rows;
  } finally {
    connection.release();
  }
}

export async function updateTransfer(
  id: number,
  data: any,
  user: any
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any =
      await connection.query(
        `
          SELECT *
          FROM transfer_requests
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (rows.length === 0) {
      throw new Error(
        'La solicitud no existe.'
      );
    }

    const current =
      rows[0];

    if (current.recurring_template_id) {
      throw new Error(
        'Esta solicitud pertenece a un traslado recurrente. Edita la programacion desde Recurrentes.'
      );
    }

    if (
      current.status !==
        'pendiente_confirmacion'
    ) {
      throw new Error(
        'Una solicitud confirmada no se puede editar. Primero debe volver a pendiente.'
      );
    }

    const outbound =
      data.outbound_trip || {};

    if (!outbound.scheduled_datetime) {
      throw new Error(
        'La fecha y hora del viaje de ida son obligatorias.'
      );
    }

    await connection.query(
      `
        UPDATE transfer_requests
        SET
          request_type = ?,
          facility_id = ?,
          patient_id = ?,
          patient_name = ?,
          patient_document = ?,
          patient_phone = ?,
          origin_address = ?,
          destination_address = ?,
          destination_type = ?,
          transfer_date = ?,
          appointment_datetime = ?,
          service_name = ?,
          mobility_type = ?,
          mobility_notes = ?,
          justification = ?,
          requester_name = ?,
          requester_role = ?,
          requester_phone = ?,
          notes = ?,
          requires_return = ?,
          is_advance_exception = ?,
          exception_reason = ?
        WHERE id = ?
      `,
      [
        data.request_type || current.request_type,
        data.facility_id || null,
        data.patient_id || null,
        data.patient_name,
        data.patient_document || null,
        data.patient_phone || null,
        data.origin_address,
        data.destination_address,
        data.destination_type,
        datePart(
          outbound.scheduled_datetime
        ),
        normalizeDateTime(
          data.appointment_datetime
        ),
        data.service_name || null,
        data.mobility_type ||
          'propios_medios',
        data.mobility_notes || null,
        data.justification || null,
        data.requester_name || null,
        data.requester_role || null,
        data.requester_phone || null,
        data.notes || null,
        Boolean(data.requires_return),
        Boolean(data.is_advance_exception),
        data.exception_reason || null,
        id
      ]
    );

    await connection.query(
      `
        DELETE FROM transfer_trips
        WHERE transfer_request_id = ?
      `,
      [id]
    );

    await insertTrip(
      connection,
      id,
      'ida',
      outbound
    );

    if (data.requires_return) {
      if (!data.return_trip?.scheduled_datetime) {
        throw new Error(
          'La fecha y hora de vuelta son obligatorias.'
        );
      }

      await insertTrip(
        connection,
        id,
        'vuelta',
        data.return_trip
      );
    }

    const [newTrips]: any =
      await connection.query(
        `
          SELECT *
          FROM transfer_trips
          WHERE transfer_request_id = ?
        `,
        [id]
      );

    if (
      current.status !==
        'pendiente_confirmacion' &&
      current.request_type !==
        'oficio_urgente'
    ) {
      let preferredAssignment:
        {
          ambulance_id: number;
          driver_id: number;
        } | null = null;

      for (const trip of newTrips) {
        const assignment =
          await findShiftAssignment(
            connection,
            trip,
            preferredAssignment
          );

        if (assignment) {
          await connection.query(
            `
              UPDATE transfer_trips
              SET
                ambulance_id = ?,
                driver_id = ?,
                status = 'asignado'
              WHERE id = ?
            `,
            [
              assignment.ambulance_id,
              assignment.driver_id,
              trip.id
            ]
          );

          preferredAssignment =
            assignment;
        }
      }
    }

    if (
      current.request_type !==
        'oficio_urgente'
    ) {
      for (const trip of newTrips) {
        await validateTripCapacity(
          connection,
          trip,
          trip.id
        );
      }
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateTransferStatus(
  id: number,
  status: string,
  userId?: number,
  reason?: string,
  userRole?: string
) {
  if (status === 'confirmado') {
    return confirmTransfer(
      id,
      Number(userId)
    );
  }

  if (status === 'pendiente_confirmacion') {
    if (userRole !== 'admin') {
      throw new Error(
        'Solo un administrador puede volver una solicitud confirmada a pendiente.'
      );
    }

    const connection =
      await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows]: any =
        await connection.query(
          `
            SELECT status
            FROM transfer_requests
            WHERE id = ?
            FOR UPDATE
          `,
          [id]
        );

      if (rows.length === 0) {
        throw new Error(
          'La solicitud no existe.'
        );
      }

      if (rows[0].status !== 'confirmado') {
        throw new Error(
          'Solo se puede volver a pendiente una solicitud confirmada.'
        );
      }

      await connection.query(
        `
          UPDATE transfer_requests
          SET
            status = 'pendiente_confirmacion',
            confirmed_by = NULL,
            confirmed_at = NULL,
            rejected_reason = NULL
          WHERE id = ?
        `,
        [id]
      );

      await connection.query(
        `
          UPDATE transfer_trips
          SET
            ambulance_id = NULL,
            driver_id = NULL,
            status = 'pendiente'
          WHERE transfer_request_id = ?
            AND status <> 'cancelado'
        `,
        [id]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  await pool.query(
    `
      UPDATE transfer_requests
      SET
        status = ?,
        rejected_reason =
          CASE
            WHEN ? = 'rechazado' THEN ?
            ELSE rejected_reason
          END
      WHERE id = ?
    `,
    [status, status, reason || null, id]
  );

  return true;
}

export async function updateTransferTrip(
  id: number,
  data: any,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any =
      await connection.query(
        `
          SELECT
            tt.*,
            DATE_FORMAT(
              tt.scheduled_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS scheduled_datetime,
            DATE_FORMAT(
              tt.scheduled_end_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS scheduled_end_datetime,
            DATE_FORMAT(
              tt.departure_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS departure_datetime,
            DATE_FORMAT(
              tt.arrival_datetime,
              '%Y-%m-%d %H:%i:%s'
            ) AS arrival_datetime,
            tr.status AS request_status,
            tr.request_type
          FROM transfer_trips tt
          INNER JOIN transfer_requests tr
            ON tr.id = tt.transfer_request_id
          WHERE tt.id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (rows.length === 0) {
      throw new Error(
        'El viaje no existe.'
      );
    }

    const current =
      rows[0];

    const scheduled =
      normalizeDateTime(
        data.scheduled_datetime
      ) ||
      toSqlDateTime(
        current.scheduled_datetime
      );

    const duration =
      Math.max(
        1,
        Number(
          data.estimated_duration_minutes ||
          current.estimated_duration_minutes ||
          60
        )
      );

    const scheduledEnd =
      scheduled
        ? (
          normalizeDateTime(
            data.scheduled_end_datetime
          ) ||
          addMinutesSqlDate(
            scheduled,
            duration
          )
        )
        : null;

    const hasDriverUpdate =
      Object.prototype.hasOwnProperty.call(
        data,
        'driver_id'
      );

    const hasAmbulanceUpdate =
      Object.prototype.hasOwnProperty.call(
        data,
        'ambulance_id'
      );

    let ambulanceId =
      hasAmbulanceUpdate
        ? data.ambulance_id
        : current.ambulance_id ?? null;

    const driverId =
      hasDriverUpdate
        ? data.driver_id
        : current.driver_id ?? null;

    if (
      hasDriverUpdate &&
      !data.driver_id
    ) {
      ambulanceId = null;
    }

    if (
      data.driver_id &&
      !data.ambulance_id
    ) {
      await assertEarlierOverlappingTripsAssigned(
        connection,
        {
          ...current,
          scheduled_datetime: scheduled,
          scheduled_end_datetime:
            scheduledEnd,
          estimated_duration_minutes:
            duration
        }
      );

      const assignment =
        await findShiftAssignmentForDriver(
          connection,
          {
            ...current,
            scheduled_datetime: scheduled,
            scheduled_end_datetime:
              scheduledEnd,
            estimated_duration_minutes:
              duration
          },
          Number(data.driver_id)
        );

      ambulanceId =
        assignment.ambulance_id;
    }

    if (
      current.request_type !==
        'oficio_urgente' &&
      !['cancelado', 'rechazado']
        .includes(current.request_status) &&
      (
        data.status ||
        current.status
      ) !== 'cancelado'
    ) {
      await validateTripCapacity(
        connection,
        {
          ...data,
          scheduled_datetime: scheduled,
          scheduled_end_datetime: scheduledEnd,
          estimated_duration_minutes:
            duration
        },
        id
      );
    }

    await connection.query(
      `
        UPDATE transfer_trips
        SET
          ambulance_id = ?,
          driver_id = ?,
          scheduled_datetime = ?,
          scheduled_end_datetime = ?,
          estimated_duration_minutes = ?,
          departure_datetime = ?,
          arrival_datetime = ?,
          status = ?,
          notes = ?,
          capacity_exception = ?,
          capacity_exception_reason = ?,
          capacity_exception_authorized_by = ?
        WHERE id = ?
      `,
      [
        ambulanceId,
        driverId,
        scheduled,
        scheduledEnd,
        duration,
        normalizeDateTime(
          data.departure_datetime
        ) ||
          current.departure_datetime,
        normalizeDateTime(
          data.arrival_datetime
        ) ||
          current.arrival_datetime,
        data.status ||
          (
            hasDriverUpdate
              ? (
                data.driver_id
                  ? 'asignado'
                  : 'pendiente'
              )
              : current.status
          ),
        data.notes ?? current.notes ?? null,
        Boolean(data.capacity_exception),
        data.capacity_exception_reason || null,
        data.capacity_exception
          ? userId || null
          : null,
        id
      ]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function formatDate(
  date: Date
) {
  const pad = (number: number) =>
    String(number).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
}

function normalizeWeekdays(
  value: any
) {
  return Array.from(
    new Set(
      (value || [])
        .map(Number)
        .filter((day: number) =>
          day >= 0 && day <= 6
        )
    )
  ) as number[];
}

function addDays(
  date: Date,
  days: number
) {
  const next =
    new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function generateRecurringRequests(
  connection: PoolConnection,
  templateId: number,
  data: any,
  createdBy: number | null,
  fromDate?: string
) {
  const weekdays =
    normalizeWeekdays(data.weekdays);

  const baseStart =
    fromDate &&
    fromDate > data.start_date
      ? fromDate
      : data.start_date;

  const start =
    new Date(`${baseStart}T12:00:00`);

  const maximum =
    addDays(start, 60);

  const requestedEnd =
    data.end_date
      ? new Date(`${data.end_date}T12:00:00`)
      : maximum;

  const end =
    requestedEnd < maximum
      ? requestedEnd
      : maximum;

  let generated = 0;

  for (
    const date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  ) {
    if (!weekdays.includes(date.getDay())) {
      continue;
    }

    const transferDate =
      formatDate(date);

    const [requestResult]: any =
      await connection.query(
        `
          INSERT INTO transfer_requests (
            request_type,
            facility_id,
            patient_id,
            patient_name,
            patient_document,
            patient_phone,
            origin_address,
            destination_address,
            destination_type,
            transfer_date,
            service_name,
            mobility_type,
            mobility_notes,
            justification,
            requester_name,
            requester_role,
            requester_phone,
            notes,
            requires_return,
            status,
            recurring_template_id,
            created_by
          )
          VALUES (
            'recurrente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, 'pendiente_confirmacion', ?, ?
          )
        `,
        [
          data.facility_id || null,
          data.patient_id || null,
          data.patient_name,
          data.patient_document || null,
          data.patient_phone || null,
          data.origin_address,
          data.destination_address,
          data.destination_type,
          transferDate,
          data.service_name || null,
          data.mobility_type ||
            'propios_medios',
          data.mobility_notes || null,
          data.justification || null,
          data.requester_name || null,
          data.requester_role || null,
          data.requester_phone || null,
          data.notes || null,
          Boolean(data.requires_return),
          templateId,
          createdBy
        ]
      );

    await insertTrip(
      connection,
      requestResult.insertId,
      'ida',
      {
        scheduled_datetime:
          asDateTime(
            transferDate,
            data.outbound_time
          ),
        estimated_duration_minutes:
          data.outbound_duration_minutes
      }
    );

    if (
      data.requires_return &&
      data.return_time
    ) {
      await insertTrip(
        connection,
        requestResult.insertId,
        'vuelta',
        {
          scheduled_datetime:
            asDateTime(
              transferDate,
              data.return_time
            ),
          estimated_duration_minutes:
            data.return_duration_minutes
        }
      );
    }

    const [newTrips]: any =
      await connection.query(
        `
          SELECT *
          FROM transfer_trips
          WHERE transfer_request_id = ?
        `,
        [requestResult.insertId]
      );

    for (const trip of newTrips) {
      await validateTripCapacity(
        connection,
        trip,
        trip.id
      );
    }

    generated += 1;
  }

  return generated;
}

export async function createRecurringTransfer(
  data: any,
  createdBy: number | null
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const weekdays =
      normalizeWeekdays(data.weekdays);

    if (weekdays.length === 0) {
      throw new Error(
        'Selecciona al menos un dia semanal.'
      );
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO recurring_transfer_templates (
            facility_id,
            patient_id,
            patient_name,
            patient_document,
            patient_phone,
            origin_address,
            destination_address,
            destination_type,
            service_name,
            mobility_type,
            mobility_notes,
            justification,
            requester_name,
            requester_role,
            requester_phone,
            weekdays,
            start_date,
            end_date,
            outbound_time,
            outbound_duration_minutes,
            requires_return,
            return_time,
            return_duration_minutes,
            notes,
            created_by
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
          )
        `,
        [
          data.facility_id || null,
          data.patient_id || null,
          data.patient_name,
          data.patient_document || null,
          data.patient_phone || null,
          data.origin_address,
          data.destination_address,
          data.destination_type,
          data.service_name || null,
          data.mobility_type ||
            'propios_medios',
          data.mobility_notes || null,
          data.justification || null,
          data.requester_name || null,
          data.requester_role || null,
          data.requester_phone || null,
          weekdays.join(','),
          data.start_date,
          data.end_date || null,
          data.outbound_time,
          Number(
            data.outbound_duration_minutes || 60
          ),
          Boolean(data.requires_return),
          data.return_time || null,
          Number(
            data.return_duration_minutes || 60
          ),
          data.notes || null,
          createdBy
        ]
      );

    const templateId =
      result.insertId;

    const generated =
      await generateRecurringRequests(
        connection,
        templateId,
        data,
        createdBy
      );

    await connection.commit();

    return {
      id: templateId,
      generated
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateRecurringTransfer(
  id: number,
  data: any,
  userId: number | null
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any =
      await connection.query(
        `
          SELECT *
          FROM recurring_transfer_templates
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (rows.length === 0) {
      throw new Error(
        'El traslado recurrente no existe.'
      );
    }

    const weekdays =
      normalizeWeekdays(data.weekdays);

    if (weekdays.length === 0) {
      throw new Error(
        'Selecciona al menos un dia semanal.'
      );
    }

    await connection.query(
      `
        UPDATE recurring_transfer_templates
        SET
          facility_id = ?,
          patient_id = ?,
          patient_name = ?,
          patient_document = ?,
          patient_phone = ?,
          origin_address = ?,
          destination_address = ?,
          destination_type = ?,
          service_name = ?,
          mobility_type = ?,
          mobility_notes = ?,
          justification = ?,
          requester_name = ?,
          requester_role = ?,
          requester_phone = ?,
          weekdays = ?,
          start_date = ?,
          end_date = ?,
          outbound_time = ?,
          outbound_duration_minutes = ?,
          requires_return = ?,
          return_time = ?,
          return_duration_minutes = ?,
          notes = ?
        WHERE id = ?
      `,
      [
        data.facility_id || null,
        data.patient_id || null,
        data.patient_name,
        data.patient_document || null,
        data.patient_phone || null,
        data.origin_address,
        data.destination_address,
        data.destination_type,
        data.service_name || null,
        data.mobility_type ||
          'propios_medios',
        data.mobility_notes || null,
        data.justification || null,
        data.requester_name || null,
        data.requester_role || null,
        data.requester_phone || null,
        weekdays.join(','),
        data.start_date,
        data.end_date || null,
        data.outbound_time,
        Number(
          data.outbound_duration_minutes || 60
        ),
        Boolean(data.requires_return),
        data.return_time || null,
        Number(
          data.return_duration_minutes || 60
        ),
        data.notes || null,
        id
      ]
    );

    const today =
      formatDate(new Date());

    const [pendingRows]: any =
      await connection.query(
        `
          SELECT id
          FROM transfer_requests
          WHERE recurring_template_id = ?
            AND status = 'pendiente_confirmacion'
            AND transfer_date >= ?
        `,
        [id, today]
      );

    if (pendingRows.length > 0) {
      const placeholders =
        pendingRows.map(() => '?').join(',');

      const requestIds =
        pendingRows.map((item: any) =>
          Number(item.id)
        );

      await connection.query(
        `
          DELETE FROM transfer_trips
          WHERE transfer_request_id IN (${placeholders})
        `,
        requestIds
      );

      await connection.query(
        `
          DELETE FROM transfer_requests
          WHERE id IN (${placeholders})
        `,
        requestIds
      );
    }

    const generated =
      await generateRecurringRequests(
        connection,
        id,
        {
          ...data,
          weekdays
        },
        userId,
        today
      );

    await connection.commit();

    return {
      id,
      generated
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getRecurringTransfers() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          rt.*,
          DATE_FORMAT(
            rt.start_date,
            '%Y-%m-%d'
          ) AS start_date,
          DATE_FORMAT(
            rt.end_date,
            '%Y-%m-%d'
          ) AS end_date,
          hf.name AS facility_name,
          TIME_FORMAT(
            rt.outbound_time,
            '%H:%i'
          ) AS outbound_time,
          TIME_FORMAT(
            rt.return_time,
            '%H:%i'
          ) AS return_time,
          CONCAT(u.first_name, ' ', u.last_name)
            AS created_by_name
        FROM recurring_transfer_templates rt
        LEFT JOIN users u
          ON u.id = rt.created_by
        LEFT JOIN health_facilities hf
          ON hf.id = rt.facility_id
        ORDER BY rt.is_active DESC, rt.patient_name ASC
      `
    );

  return rows;
}

export async function toggleRecurringTransfer(
  id: number,
  isActive: boolean
) {
  await pool.query(
    `
      UPDATE recurring_transfer_templates
      SET is_active = ?
      WHERE id = ?
    `,
    [isActive, id]
  );
}

export async function logRoutePrint(
  data: any,
  userId: number | null
) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO transfer_route_print_logs (
          route_date,
          shift_name,
          ambulance_id,
          driver_id,
          printed_by
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        data.route_date,
        data.shift_name || null,
        data.ambulance_id || null,
        data.driver_id || null,
        userId
      ]
    );

  return result.insertId;
}
