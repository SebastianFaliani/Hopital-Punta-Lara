import { pool }
  from '../../config/database';

type ReplyInput = {
  code: string;
  title: string;
  keywords: string;
  response: string;
  sort_order: number;
  is_active?: boolean;
};

type DoctorInput = {
  doctor_name: string;
  specialty: string;
  is_active?: boolean;
  is_booking_open?: boolean;
  next_open_at?: string | null;
  closed_message?: string | null;
};

type ScheduleInput = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
};

const weekdayNames: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
  7: 'Domingo'
};

function normalize(
  value: string
) {

  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatDateTimeForMessage(
  value: string | Date | null | undefined
) {
  if (!value) {
    return 'fecha a confirmar';
  }

  return new Date(value)
    .toLocaleString(
      'es-AR',
      {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Argentina/Buenos_Aires'
      }
    );
}

function formatTime(
  value: string
) {
  return String(value || '')
    .slice(0, 5);
}

function normalizePhone(
  value?: string | null
) {
  return String(value || 'sin-telefono')
    .trim();
}

function extractPatientData(
  message: string
) {
  const documentMatch =
    message.match(/\b\d{7,9}\b/);

  const document =
    documentMatch?.[0] || '';

  const patientName =
    message
      .replace(document, '')
      .replace(/dni/gi, '')
      .replace(/documento/gi, '')
      .replace(/nombre/gi, '')
      .replace(/[:,-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  return {
    patientName,
    document
  };
}

function extractLaboratorySearch(
  message: string
) {
  return message
    .replace(/resultado/gi, '')
    .replace(/resultados/gi, '')
    .replace(/laboratorio/gi, '')
    .replace(/analisis/gi, '')
    .replace(/dni/gi, '')
    .replace(/apellido/gi, '')
    .replace(/[:,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getConversationState(
  phone: string
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          state,
          payload
        FROM whatsapp_conversation_states
        WHERE phone = ?
        LIMIT 1
      `,
      [phone]
    );

  if (!rows.length) {
    return null;
  }

  const payload =
    typeof rows[0].payload === 'string'
      ? JSON.parse(rows[0].payload || '{}')
      : rows[0].payload || {};

  return {
    state: rows[0].state,
    payload
  };
}

async function setConversationState(
  phone: string,
  state: string,
  payload: any
) {
  await pool.query(
    `
      INSERT INTO whatsapp_conversation_states (
        phone,
        state,
        payload
      )
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        state = VALUES(state),
        payload = VALUES(payload)
    `,
    [
      phone,
      state,
      JSON.stringify(payload || {})
    ]
  );
}

async function clearConversationState(
  phone: string
) {
  await pool.query(
    'DELETE FROM whatsapp_conversation_states WHERE phone = ?',
    [phone]
  );
}

export async function getAllWhatsappReplies() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          code,
          title,
          keywords,
          response,
          sort_order,
          is_active,
          created_at,
          updated_at
        FROM whatsapp_auto_replies
        ORDER BY sort_order ASC, id ASC
      `
    );

  return rows;
}

export async function getRecentWhatsappLogs() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          phone,
          incoming_message,
          response_message,
          created_at
        FROM whatsapp_message_logs
        ORDER BY created_at DESC, id DESC
        LIMIT 25
      `
    );

  return rows;
}

export async function getAllWhatsappLogsForExport() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          phone,
          incoming_message,
          response_message,
          created_at
        FROM whatsapp_message_logs
        ORDER BY created_at DESC, id DESC
      `
    );

  return rows;
}

export async function deleteWhatsappLogsBefore(
  beforeDate: string
) {

  const [result]: any =
    await pool.query(
      `
        DELETE FROM whatsapp_message_logs
        WHERE created_at < ?
      `,
      [beforeDate]
    );

  return {
    deleted: Number(result.affectedRows || 0)
  };
}

export async function deleteAllWhatsappLogs() {

  const [result]: any =
    await pool.query(
      'DELETE FROM whatsapp_message_logs'
    );

  return {
    deleted: Number(result.affectedRows || 0)
  };
}

export async function getWhatsappAppointmentDoctors() {

  const [doctorRows]: any =
    await pool.query(
      `
        SELECT
          d.id,
          d.doctor_name,
          d.specialty,
          d.is_active,
          d.is_booking_open,
          d.next_open_at,
          d.closed_message
        FROM whatsapp_appointment_doctors d
        ORDER BY d.specialty ASC, d.doctor_name ASC
      `
    );

  const [scheduleRows]: any =
    await pool.query(
      `
        SELECT
          id,
          doctor_id,
          weekday,
          CASE weekday
            WHEN 1 THEN 'Lunes'
            WHEN 2 THEN 'Martes'
            WHEN 3 THEN 'Miercoles'
            WHEN 4 THEN 'Jueves'
            WHEN 5 THEN 'Viernes'
            WHEN 6 THEN 'Sabado'
            WHEN 7 THEN 'Domingo'
          END AS weekday_name,
          TIME_FORMAT(start_time, '%H:%i') AS start_time,
          TIME_FORMAT(end_time, '%H:%i') AS end_time,
          is_active
        FROM whatsapp_appointment_schedules
        ORDER BY weekday ASC, start_time ASC
      `
    );

  const schedulesByDoctor =
    scheduleRows.reduce(
      (
        groups: Record<number, any[]>,
        schedule: any
      ) => {
        const doctorId =
          Number(schedule.doctor_id);

        groups[doctorId] ||= [];
        groups[doctorId].push({
          id: schedule.id,
          weekday: schedule.weekday,
          weekday_name: schedule.weekday_name,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: Boolean(schedule.is_active)
        });

        return groups;
      },
      {}
    );

  return doctorRows.map((row: any) => ({
    ...row,
    is_active: Boolean(row.is_active),
    is_booking_open: Boolean(row.is_booking_open),
    schedules:
      schedulesByDoctor[Number(row.id)] || []
  }));
}

export async function createWhatsappAppointmentDoctor(
  data: DoctorInput
) {

  if (!data.doctor_name || !data.specialty) {
    throw new Error('Debe indicar medico y especialidad');
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO whatsapp_appointment_doctors (
          doctor_name,
          specialty,
          is_active,
          is_booking_open,
          next_open_at,
          closed_message
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.doctor_name.trim(),
        data.specialty.trim(),
        data.is_active ?? true,
        data.is_booking_open ?? false,
        data.next_open_at || null,
        data.closed_message || null
      ]
    );

  return {
    id: result.insertId
  };
}

export async function updateWhatsappAppointmentDoctor(
  id: number,
  data: DoctorInput
) {

  if (!data.doctor_name || !data.specialty) {
    throw new Error('Debe indicar medico y especialidad');
  }

  await pool.query(
    `
      UPDATE whatsapp_appointment_doctors
      SET
        doctor_name = ?,
        specialty = ?,
        is_active = ?,
        is_booking_open = ?,
        next_open_at = ?,
        closed_message = ?
      WHERE id = ?
    `,
    [
      data.doctor_name.trim(),
      data.specialty.trim(),
      data.is_active ?? true,
      data.is_booking_open ?? false,
      data.next_open_at || null,
      data.closed_message || null,
      id
    ]
  );

  return true;
}

export async function setWhatsappDoctorBookingStatus(
  id: number,
  data: any
) {

  const isOpen =
    Boolean(data.is_booking_open);

  if (!isOpen && !data.next_open_at) {
    throw new Error(
      'Al cerrar la turnera debe indicar cuando vuelve a abrir'
    );
  }

  await pool.query(
    `
      UPDATE whatsapp_appointment_doctors
      SET
        is_booking_open = ?,
        next_open_at = ?,
        closed_message = ?
      WHERE id = ?
    `,
    [
      isOpen,
      isOpen ? null : data.next_open_at,
      data.closed_message || null,
      id
    ]
  );

  return true;
}

export async function replaceWhatsappDoctorSchedules(
  doctorId: number,
  schedules: ScheduleInput[]
) {

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      'DELETE FROM whatsapp_appointment_schedules WHERE doctor_id = ?',
      [doctorId]
    );

    for (const schedule of schedules || []) {
      if (
        !schedule.weekday ||
        !schedule.start_time ||
        !schedule.end_time
      ) {
        continue;
      }

      await connection.query(
        `
          INSERT INTO whatsapp_appointment_schedules (
            doctor_id,
            weekday,
            start_time,
            end_time,
            is_active
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          doctorId,
          Number(schedule.weekday),
          schedule.start_time,
          schedule.end_time,
          schedule.is_active ?? true
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return true;
}

export async function getWhatsappAppointmentRequests(
  filters: any = {}
) {

  const where: string[] = [];
  const values: any[] = [];

  if (filters.doctor_id) {
    where.push('r.doctor_id = ?');
    values.push(Number(filters.doctor_id));
  }

  if (filters.status && filters.status !== 'todos') {
    where.push('r.status = ?');
    values.push(filters.status);
  }

  if (filters.search) {
    where.push(
      '(r.patient_name LIKE ? OR r.patient_document LIKE ? OR r.phone LIKE ?)'
    );
    values.push(
      `%${filters.search}%`,
      `%${filters.search}%`,
      `%${filters.search}%`
    );
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          r.id,
          r.phone,
          r.doctor_id,
          r.schedule_id,
          r.patient_name,
          r.patient_document,
          r.requested_weekday,
          r.requested_day_label,
          r.status,
          r.assigned_date,
          TIME_FORMAT(r.assigned_time, '%H:%i') AS assigned_time,
          r.admin_notes,
          r.created_at,
          d.doctor_name,
          d.specialty
        FROM whatsapp_appointment_requests r
        INNER JOIN whatsapp_appointment_doctors d
          ON d.id = r.doctor_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY
          CASE r.status
            WHEN 'pendiente' THEN 1
            WHEN 'confirmado' THEN 2
            WHEN 'sin_lugar' THEN 3
            ELSE 4
          END,
          r.created_at DESC
        LIMIT 300
      `,
      values
    );

  return rows;
}

export async function saveWhatsappChatMessage(
  data: {
    phone: string;
    direction: 'incoming' | 'outgoing';
    message: string;
    source?: string;
    sourceLogId?: number | null;
  }
) {
  if (!data.phone || !data.message) {
    return null;
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO whatsapp_chat_messages (
          phone,
          direction,
          message,
          source,
          source_log_id
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        data.phone,
        data.direction,
        data.message,
        data.source || 'manual',
        data.sourceLogId || null
      ]
    );

  return result.insertId;
}

export async function getWhatsappChatConversations() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          c.phone,
          MAX(c.created_at) AS last_message_at,
          SUBSTRING_INDEX(
            GROUP_CONCAT(
              c.message
              ORDER BY c.created_at DESC, c.id DESC
              SEPARATOR '\n'
            ),
            '\n',
            1
          ) AS last_message,
          SUM(
            CASE
              WHEN c.direction = 'incoming'
                THEN 1
              ELSE 0
            END
          ) AS incoming_count
        FROM whatsapp_chat_messages c
        GROUP BY c.phone
        ORDER BY last_message_at DESC
        LIMIT 200
      `
    );

  return rows;
}

export async function getWhatsappChatMessages(
  phone: string
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          phone,
          direction,
          message,
          source,
          created_at
        FROM whatsapp_chat_messages
        WHERE phone = ?
        ORDER BY created_at ASC, id ASC
        LIMIT 500
      `,
      [phone]
    );

  return rows;
}

export async function confirmWhatsappAppointmentRequest(
  id: number,
  data: any
) {

  if (!data.assigned_date || !data.assigned_time) {
    throw new Error('Debe indicar fecha y horario del turno');
  }

  await pool.query(
    `
      UPDATE whatsapp_appointment_requests
      SET
        status = 'confirmado',
        assigned_date = ?,
        assigned_time = ?,
        admin_notes = ?
      WHERE id = ?
    `,
    [
      data.assigned_date,
      data.assigned_time,
      data.admin_notes || null,
      id
    ]
  );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          r.phone,
          r.patient_name,
          r.assigned_date,
          TIME_FORMAT(r.assigned_time, '%H:%i') AS assigned_time,
          d.doctor_name,
          d.specialty
        FROM whatsapp_appointment_requests r
        INNER JOIN whatsapp_appointment_doctors d
          ON d.id = r.doctor_id
        WHERE r.id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0];
}

export async function markWhatsappAppointmentNoAvailability(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE whatsapp_appointment_requests
      SET
        status = 'sin_lugar',
        admin_notes = ?
      WHERE id = ?
    `,
    [
      data.admin_notes || null,
      id
    ]
  );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          r.phone,
          r.patient_name,
          d.doctor_name,
          d.specialty,
          d.next_open_at
        FROM whatsapp_appointment_requests r
        INNER JOIN whatsapp_appointment_doctors d
          ON d.id = r.doctor_id
        WHERE r.id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0];
}

export async function createWhatsappReply(
  data: ReplyInput
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO whatsapp_auto_replies (
          code,
          title,
          keywords,
          response,
          sort_order,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.code,
        data.title,
        data.keywords,
        data.response,
        data.sort_order,
        data.is_active ?? true
      ]
    );

  return result.insertId;
}

export async function updateWhatsappReply(
  id: number,
  data: ReplyInput
) {

  await pool.query(
    `
      UPDATE whatsapp_auto_replies
      SET
        code = ?,
        title = ?,
        keywords = ?,
        response = ?,
        sort_order = ?,
        is_active = ?
      WHERE id = ?
    `,
    [
      data.code,
      data.title,
      data.keywords,
      data.response,
      data.sort_order,
      data.is_active ?? true,
      id
    ]
  );

  return true;
}

export async function toggleWhatsappReply(
  id: number
) {

  await pool.query(
    `
      UPDATE whatsapp_auto_replies
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

async function getActiveDoctorsForBot(
  search?: string
) {
  const normalizedSearch =
    normalize(search || '');

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          doctor_name,
          specialty,
          is_booking_open,
          next_open_at,
          closed_message
        FROM whatsapp_appointment_doctors
        WHERE is_active = TRUE
        ORDER BY specialty ASC, doctor_name ASC
      `
    );

  if (!normalizedSearch) {
    return rows;
  }

  return rows.filter((doctor: any) =>
    normalize(
      `${doctor.specialty} ${doctor.doctor_name}`
    ).includes(normalizedSearch)
  );
}

async function getActiveSchedulesForDoctor(
  doctorId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          weekday,
          TIME_FORMAT(start_time, '%H:%i') AS start_time,
          TIME_FORMAT(end_time, '%H:%i') AS end_time
        FROM whatsapp_appointment_schedules
        WHERE doctor_id = ?
          AND is_active = TRUE
        ORDER BY weekday ASC, start_time ASC
      `,
      [doctorId]
    );

  return rows;
}

async function getActiveSpecialtiesForBot() {
  const [rows]: any =
    await pool.query(
      `
        SELECT DISTINCT
          specialty
        FROM whatsapp_appointment_doctors
        WHERE is_active = TRUE
        ORDER BY specialty ASC
      `
    );

  return rows.map((row: any) =>
    String(row.specialty)
  );
}

async function getActiveDoctorsBySpecialtyForBot(
  specialty: string
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          doctor_name,
          specialty,
          is_booking_open,
          next_open_at,
          closed_message
        FROM whatsapp_appointment_doctors
        WHERE is_active = TRUE
          AND specialty = ?
        ORDER BY doctor_name ASC
      `,
      [specialty]
    );

  return rows;
}

function buildSpecialtyOptionsMessage(
  specialties: string[]
) {
  if (!specialties.length) {
    return 'Por el momento no hay especialidades configuradas para solicitar turnos por WhatsApp.';
  }

  const lines =
    specialties.map((specialty, index) =>
      `${index + 1}. ${specialty}`
    );

  return [
    'Turnos',
    '',
    'Elegí la especialidad respondiendo con el número:',
    '',
    ...lines
  ].join('\n');
}

function buildDoctorsBySpecialtyMessage(
  specialty: string,
  doctors: any[]
) {
  if (!doctors.length) {
    return `Por el momento no hay medicos configurados para ${specialty}.`;
  }

  const lines =
    doctors.map((doctor, index) => {
      const status =
        doctor.is_booking_open
          ? 'Agenda abierta'
          : `Agenda cerrada. Vuelve a abrir: ${formatDateTimeForMessage(doctor.next_open_at)}`;

      return `${index + 1}. ${doctor.doctor_name} - ${status}`;
    });

  return [
    specialty,
    '',
    'Elegí el médico respondiendo con el número:',
    '',
    ...lines
  ].join('\n');
}

function buildDoctorOptionsMessage(
  doctors: any[]
) {
  if (!doctors.length) {
    return 'Por el momento no hay especialidades configuradas para solicitar turnos por WhatsApp.';
  }

  const lines =
    doctors.map((doctor, index) =>
      `${index + 1}. ${doctor.specialty} - ${doctor.doctor_name}`
    );

  return [
    'Turnos',
    '',
    'Elegí la especialidad o médico respondiendo con el número:',
    '',
    ...lines
  ].join('\n');
}

function buildScheduleOptionsMessage(
  doctor: any,
  schedules: any[]
) {
  if (!schedules.length) {
    return `La especialidad ${doctor.specialty} no tiene dias de atencion configurados. Dejanos tu consulta y administracion respondera cuando sea posible.`;
  }

  const lines =
    schedules.map((schedule, index) =>
      `${index + 1}. ${weekdayNames[Number(schedule.weekday)]} de ${formatTime(schedule.start_time)} a ${formatTime(schedule.end_time)}`
    );

  return [
    `${doctor.specialty} - ${doctor.doctor_name}`,
    '',
    'Dias de atencion:',
    '',
    ...lines,
    '',
    'Responde con el numero del dia que queres solicitar.'
  ].join('\n');
}

function buildClosedBookingMessage(
  doctor: any
) {
  const customMessage =
    doctor.closed_message?.trim();

  if (customMessage) {
    return customMessage;
  }

  return [
    `Por el momento no hay turnos disponibles para ${doctor.specialty} - ${doctor.doctor_name}.`,
    '',
    `La turnera vuelve a abrir el ${formatDateTimeForMessage(doctor.next_open_at)}.`
  ].join('\n');
}

async function searchLaboratoryResultsForBot(
  search: string
) {
  const cleanSearch =
    search.trim();

  if (!cleanSearch) {
    return [];
  }

  const isDocument =
    /^\d{7,9}$/.test(cleanSearch);

  const values: any[] =
    isDocument
      ? [cleanSearch]
      : [
        `%${cleanSearch}%`,
        `%${cleanSearch}%`,
        `%${cleanSearch}%`,
        `%${cleanSearch}%`
      ];

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          study_date,
          patient_last_name,
          patient_first_name,
          patient_document,
          is_complete,
          missing_details,
          pickup_date,
          picked_up_by,
          pickup_document
        FROM laboratory_records
        WHERE study_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND ${
            isDocument
              ? 'patient_document = ?'
              : `(
                  patient_last_name LIKE ?
                  OR patient_first_name LIKE ?
                  OR CONCAT(patient_last_name, ' ', patient_first_name) LIKE ?
                  OR CONCAT(patient_first_name, ' ', patient_last_name) LIKE ?
                )`
          }
        ORDER BY study_date DESC, id DESC
        LIMIT 5
      `,
      values
    );

  return rows;
}

function buildLaboratoryResultsMessage(
  rows: any[]
) {
  if (!rows.length) {
    return [
      'No encontramos resultados de laboratorio recientes con ese dato.',
      '',
      'Recordá que solo se consultan estudios de los últimos 6 meses.',
      'Podés intentar nuevamente enviando DNI o apellido.'
    ].join('\n');
  }

  const ready =
    rows.filter((row) =>
      Boolean(row.is_complete) &&
      !row.pickup_date
    );

  const delivered =
    rows.filter((row) =>
      Boolean(row.pickup_date)
    );

  const pending =
    rows.filter((row) =>
      !Boolean(row.is_complete)
    );

  if (ready.length > 0) {
    const lines =
      ready.map((row) =>
        `- ${row.patient_last_name} ${row.patient_first_name}, estudio del ${new Date(row.study_date).toLocaleDateString('es-AR')}`
      );

    return [
      'Resultados de laboratorio',
      '',
      'Tus resultados ya están disponibles para retirar.',
      '',
      ...lines,
      '',
      'Para retirarlos acercate con DNI. Si retira otra persona, debe presentar su DNI.'
    ].join('\n');
  }

  if (pending.length > 0) {
    return [
      'Resultados de laboratorio',
      '',
      'Encontramos un estudio reciente, pero todavía figura pendiente o incompleto.',
      '',
      'Por favor consultá nuevamente más tarde o comunicate con administración.'
    ].join('\n');
  }

  if (delivered.length > 0) {
    const lines =
      delivered.map((row) => {
        const patient =
          `${row.patient_last_name} ${row.patient_first_name}`.trim();

        const studyDate =
          new Date(row.study_date)
            .toLocaleDateString('es-AR');

        const pickupDate =
          row.pickup_date
            ? new Date(row.pickup_date)
              .toLocaleDateString('es-AR')
            : 'fecha no cargada';

        const pickedUpBy =
          row.picked_up_by ||
          'Retiro por titular';

        const pickupDocument =
          row.pickup_document
            ? ` DNI ${row.pickup_document}`
            : '';

        return `- ${patient}, estudio del ${studyDate}. Retirado el ${pickupDate} por ${pickedUpBy}${pickupDocument}.`;
      });

    return [
      'Resultados de laboratorio',
      '',
      'Encontramos estudios recientes, pero figuran como retirados:',
      '',
      ...lines,
      '',
      'Si necesitás consultar algo sobre el retiro, comunicate con administración.'
    ].join('\n');
  }

  return [
    'No encontramos resultados disponibles para retirar con ese dato.',
    '',
    'Podés intentar nuevamente enviando DNI o apellido.'
  ].join('\n');
}

function parseSelectedIndex(
  message: string,
  max: number
) {
  const value =
    Number(message.trim());

  if (!Number.isInteger(value) || value < 1 || value > max) {
    return null;
  }

  return value - 1;
}

async function buildAppointmentBotResponse(
  incomingMessage: string,
  phone?: string | null
) {
  const normalizedPhone =
    normalizePhone(phone);

  const normalizedMessage =
    normalize(incomingMessage || '');

  const state =
    await getConversationState(normalizedPhone);

  if (
    normalizedMessage === 'cancelar' ||
    normalizedMessage === 'menu'
  ) {
    await clearConversationState(normalizedPhone);
    return null;
  }

  if (state?.state === 'awaiting_specialty') {
    const specialties =
      state.payload?.specialties || [];

    const selectedIndex =
      parseSelectedIndex(
        incomingMessage,
        specialties.length
      );

    if (selectedIndex === null) {
      return 'No pude identificar la especialidad. Responde con el numero de la especialidad.';
    }

    const specialty =
      specialties[selectedIndex];

    const doctors =
      await getActiveDoctorsBySpecialtyForBot(
        specialty
      );

    await setConversationState(
      normalizedPhone,
      'awaiting_doctor',
      {
        specialty,
        doctors
      }
    );

    return buildDoctorsBySpecialtyMessage(
      specialty,
      doctors
    );
  }

  if (state?.state === 'awaiting_doctor') {
    const doctors =
      state.payload?.doctors || [];

    const selectedIndex =
      parseSelectedIndex(
        incomingMessage,
        doctors.length
      );

    if (selectedIndex === null) {
      return 'No pude identificar el medico. Responde con el numero del medico.';
    }

    const doctor =
      doctors[selectedIndex];

    if (!doctor.is_booking_open) {
      await clearConversationState(normalizedPhone);
      return buildClosedBookingMessage(doctor);
    }

    const schedules =
      await getActiveSchedulesForDoctor(
        Number(doctor.id)
      );

    await setConversationState(
      normalizedPhone,
      'awaiting_schedule',
      {
        doctor,
        schedules
      }
    );

    return buildScheduleOptionsMessage(
      doctor,
      schedules
    );
  }

  if (state?.state === 'awaiting_schedule') {
    const schedules =
      state.payload?.schedules || [];

    const selectedIndex =
      parseSelectedIndex(
        incomingMessage,
        schedules.length
      );

    if (selectedIndex === null) {
      return 'No pude identificar el dia. Responde con el numero del dia de atencion.';
    }

    const schedule =
      schedules[selectedIndex];

    await setConversationState(
      normalizedPhone,
      'awaiting_patient_data',
      {
        ...state.payload,
        schedule
      }
    );

    return [
      `Elegiste ${weekdayNames[Number(schedule.weekday)]} de ${formatTime(schedule.start_time)} a ${formatTime(schedule.end_time)}.`,
      '',
      'Ahora envia en un solo mensaje:',
      '- DNI',
      '- Nombre y apellido completo',
      '',
      'Ejemplo: 12345678 Juan Perez'
    ].join('\n');
  }

  if (state?.state === 'awaiting_patient_data') {
    const {
      patientName,
      document
    } = extractPatientData(incomingMessage);

    if (!document || !patientName) {
      return 'Necesito que envies DNI y nombre completo. Ejemplo: 12345678 Juan Perez';
    }

    const doctor =
      state.payload?.doctor;

    const schedule =
      state.payload?.schedule;

    await pool.query(
      `
        INSERT INTO whatsapp_appointment_requests (
          phone,
          doctor_id,
          schedule_id,
          patient_name,
          patient_document,
          requested_weekday,
          requested_day_label
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedPhone,
        doctor.id,
        schedule?.id || null,
        patientName,
        document,
        schedule?.weekday || null,
        schedule?.weekday
          ? weekdayNames[Number(schedule.weekday)]
          : null
      ]
    );

    await clearConversationState(normalizedPhone);

    return [
      'Solicitud recibida.',
      '',
      `Paciente: ${patientName}`,
      `DNI: ${document}`,
      `Especialidad: ${doctor.specialty}`,
      `Medico: ${doctor.doctor_name}`,
      schedule?.weekday
        ? `Dia solicitado: ${weekdayNames[Number(schedule.weekday)]}`
        : '',
      '',
      'Tenga paciencia. En el transcurso del dia estaremos confirmando el turno.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (state?.state === 'awaiting_laboratory_search') {
    const search =
      extractLaboratorySearch(incomingMessage);

    if (!search) {
      return 'Enviá el DNI o apellido del paciente para consultar resultados de laboratorio.';
    }

    const rows =
      await searchLaboratoryResultsForBot(search);

    await clearConversationState(normalizedPhone);

    return buildLaboratoryResultsMessage(rows);
  }

  const isLaboratoryResultIntent =
    normalizedMessage === '2' ||
    normalizedMessage.includes('resultado') ||
    normalizedMessage.includes('resultados') ||
    (
      normalizedMessage.includes('laboratorio') &&
      (
        normalizedMessage.includes('retirar') ||
        normalizedMessage.includes('retiro') ||
        normalizedMessage.includes('buscar')
      )
    );

  if (isLaboratoryResultIntent) {
    const search =
      normalizedMessage === '2'
        ? ''
        : extractLaboratorySearch(incomingMessage);

    if (search) {
      const rows =
        await searchLaboratoryResultsForBot(search);

      return buildLaboratoryResultsMessage(rows);
    }

    await setConversationState(
      normalizedPhone,
      'awaiting_laboratory_search',
      {}
    );

    return [
      'Resultados de laboratorio',
      '',
      'Para consultar si ya están disponibles, enviá el DNI o apellido del paciente.',
      '',
      'Solo se consultan estudios de los últimos 6 meses.'
    ].join('\n');
  }

  const isAppointmentIntent =
    normalizedMessage === '1' ||
    normalizedMessage.includes('turno') ||
    normalizedMessage.includes('consulta');

  if (!isAppointmentIntent) {
    return null;
  }

  const search =
    normalizedMessage === '1'
      ? ''
      : normalizedMessage
        .replace('turno', '')
        .replace('consulta', '')
        .replace('sacar', '')
        .trim();

  if (search) {
    const doctors =
      await getActiveDoctorsForBot(search);

    const specialties: string[] =
      Array.from(
        new Set(
          doctors.map((doctor: any) =>
            String(doctor.specialty)
          )
        )
      );

    await setConversationState(
      normalizedPhone,
      'awaiting_specialty',
      { specialties }
    );

    return buildSpecialtyOptionsMessage(specialties);
  }

  const specialties =
    await getActiveSpecialtiesForBot();

  await setConversationState(
    normalizedPhone,
    'awaiting_specialty',
    { specialties }
  );

  return buildSpecialtyOptionsMessage(specialties);
}

export async function buildWhatsappResponse(
  incomingMessage: string,
  phone?: string | null
) {

  let appointmentResponse: string | null = null;

  try {
    appointmentResponse =
      await buildAppointmentBotResponse(
        incomingMessage,
        phone
      );
  } catch (error: any) {
    if (
      error?.code !== 'ER_NO_SUCH_TABLE' &&
      error?.code !== 'ER_BAD_FIELD_ERROR'
    ) {
      throw error;
    }
  }

  if (appointmentResponse) {
    const [logResult]: any =
      await pool.query(
      `
        INSERT INTO whatsapp_message_logs (
          phone,
          incoming_message,
          response_message,
          matched_reply_id
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        phone ?? null,
        incomingMessage,
        appointmentResponse,
        null
      ]
    );

    if (phone) {
      await saveWhatsappChatMessage({
        phone,
        direction: 'incoming',
        message: incomingMessage,
        source: 'bot',
        sourceLogId: logResult.insertId
      });

      await saveWhatsappChatMessage({
        phone,
        direction: 'outgoing',
        message: appointmentResponse,
        source: 'bot',
        sourceLogId: logResult.insertId
      });
    }

    return {
      matchedReply: null,
      response: appointmentResponse
    };
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          code,
          title,
          keywords,
          response,
          sort_order
        FROM whatsapp_auto_replies
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, id ASC
      `
    );

  const normalizedMessage =
    normalize(incomingMessage || '');

  let matched =
    rows.find((reply: any) =>
      normalize(reply.code) === normalizedMessage
    );

  if (!matched) {

    matched =
      rows.find((reply: any) => {

        const keywords =
          String(reply.keywords || '')
            .split(',')
            .map((keyword) =>
              normalize(keyword)
            )
            .filter(Boolean);

        return keywords.some((keyword) =>
          normalizedMessage.includes(keyword)
        );
      });
  }

  const menu =
    rows.find((reply: any) =>
      reply.code === 'menu'
    );

  const selectedReply =
    matched || menu;

  const response =
    selectedReply?.response ||
    'Gracias por comunicarte con el hospital. En breve te responderemos.';

  const [logResult]: any =
    await pool.query(
    `
      INSERT INTO whatsapp_message_logs (
        phone,
        incoming_message,
        response_message,
        matched_reply_id
      )
      VALUES (?, ?, ?, ?)
    `,
    [
      phone ?? null,
      incomingMessage,
      response,
      selectedReply?.id ?? null
    ]
  );

  if (phone) {
    await saveWhatsappChatMessage({
      phone,
      direction: 'incoming',
      message: incomingMessage,
      source: 'bot',
      sourceLogId: logResult.insertId
    });

    await saveWhatsappChatMessage({
      phone,
      direction: 'outgoing',
      message: response,
      source: 'bot',
      sourceLogId: logResult.insertId
    });
  }

  return {
    matchedReply: selectedReply || null,
    response
  };
}
