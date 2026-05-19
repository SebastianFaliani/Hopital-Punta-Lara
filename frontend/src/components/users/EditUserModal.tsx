import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../../api/api';

type Role = {
  id: number;
  name: string;
};

type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;

  role_id: number;
  role: string;

  is_active: boolean;
};

type Props = {
  user: User;
  onClose: () => void;
  onUpdated: () => void;
};

export default function EditUserModal({
  user,
  onClose,
  onUpdated
}: Props) {

  const [roles, setRoles] =
    useState<Role[]>([]);

  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    username: user.username,
    role_id: user.role_id
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {

    async function loadRoles() {

      try {

        const res =
          await apiFetch('/roles');

        setRoles(res.data);

      } catch (error) {

        console.error(error);
      }
    }

    loadRoles();

  }, []);

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setError('');

    if (
      !form.first_name ||
      !form.last_name ||
      !form.email ||
      !form.username
    ) {

      setError(
        'Todos los campos son obligatorios'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        `/users/${user.id}`,
        {
          method: 'PUT',

          body: JSON.stringify(form)
        }
      );

      onUpdated();

      onClose();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement
    >
  ) {

    setForm({
      ...form,
      [e.target.name]:
        e.target.name === 'role_id'
          ? Number(e.target.value)
          : e.target.value
    });
  }

  return (

    <div className="modal-overlay">

      <div className="modal-content">

        <h2 className="modal-title">
          Editar usuario
        </h2>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <input
            className="auth-input"
            type="text"
            name="first_name"
            placeholder="Nombre"
            value={form.first_name}
            onChange={handleChange}
          />

          <input
            className="auth-input"
            type="text"
            name="last_name"
            placeholder="Apellido"
            value={form.last_name}
            onChange={handleChange}
          />

          <input
            className="auth-input"
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

          <input
            className="auth-input"
            type="text"
            name="username"
            placeholder="Usuario"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
          />

          <select
            className="auth-input"
            name="role_id"
            value={form.role_id}
            onChange={handleChange}
          >

            {roles.map((role) => (

              <option
                key={role.id}
                value={role.id}
              >
                {role.name}
              </option>

            ))}

          </select>

          {
            error && (

              <p className="auth-error">
                {error}
              </p>
            )
          }

          <div className="modal-actions">

            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {
                loading
                  ? 'Guardando...'
                  : 'Guardar cambios'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}
