import { pool }
  from '../../config/database';

export async function getRoles() {

  const [rows] =
    await pool.query(
      `
        SELECT
          id,
          name,
          COALESCE(description, name) AS description
        FROM roles
        ORDER BY name ASC
      `
    );

  return rows;
}

function normalizeRoleName(
  name: string
) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export async function createRole(
  data: any
) {
  const name =
    normalizeRoleName(data.name || '');

  const description =
    String(data.description || '').trim();

  if (!name) {
    throw new Error('El nombre del rol es obligatorio');
  }

  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(
      'El nombre del rol solo puede tener letras, numeros y guion bajo'
    );
  }

  const [existing]: any =
    await pool.query(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      [name]
    );

  if (existing.length > 0) {
    throw new Error('Ya existe un rol con ese nombre');
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO roles (
          name,
          description
        )
        VALUES (?, ?)
      `,
      [
        name,
        description || name
      ]
    );

  return {
    id: result.insertId,
    name,
    description: description || name
  };
}
