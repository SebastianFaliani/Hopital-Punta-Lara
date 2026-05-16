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

function normalize(
  value: string
) {

  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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

export async function buildWhatsappResponse(
  incomingMessage: string,
  phone?: string | null
) {

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

  return {
    matchedReply: selectedReply || null,
    response
  };
}
