import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../../api/api';

type Role = {
  id: number;
  name: string;
};

type Facility = {
  id: number;
  name: string;
};

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateUserModal({
  onClose,
  onCreated
}: Props) {

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    role_id: 1,
    facility_id: ''
  });

  const [roles, setRoles] =
    useState<Role[]>([]);

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {

    async function loadInitialData() {

      try {

        const [rolesRes, facilitiesRes] =
          await Promise.all([
            apiFetch('/roles'),
            apiFetch('/health-facilities')
          ]);

        setRoles(rolesRes.data);
        setFacilities(facilitiesRes.data);

      } catch (error) {

        console.error(error);
      }
    }

    loadInitialData();

  }, []);

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setError('');

    // validaciones
    if (
      !form.first_name ||
      !form.last_name ||
      !form.email ||
      !form.username ||
      !form.password
    ) {

      setError(
        'Todos los campos son obligatorios'
      );

      return;
    }

    if (form.password.length < 6) {

      setError(
        'La contraseña debe tener mínimo 6 caracteres'
      );

      return;
    }

    try {

      setLoading(true);

      await apiFetch(
        '/users',
        {
          method: 'POST',

          body: JSON.stringify({
            ...form,
            role_id: Number(form.role_id),
            facility_id:
              form.facility_id
                ? Number(form.facility_id)
                : null
          })
        }
      );

      onCreated();

      onClose();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) {

    setForm({
      ...form,
      [e.target.name]:
        e.target.value
    });
  }

  return (

    <div className="modal-overlay">

      <div className="modal-content">

        <h2 className="modal-title">
          Nuevo usuario
        </h2>

        <form onSubmit={handleSubmit}
        className="auth-form"
        >

          <input
            type="text"
            name="first_name"
            placeholder="Nombre"
            value={form.first_name}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="text"
            name="last_name"
            placeholder="Apellido"
            value={form.last_name}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="form-input"
          />

          <input
            type="text"
            name="username"
            placeholder="Usuario"
            value={form.username}
            onChange={handleChange}
            className="form-input"
            autoComplete="username"
          />

          <input
            type="password"
            name="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={handleChange}
            className="form-input"
          />

          <select
            className="auth-input"
            name="role_id"
            value={form.role_id}
            onChange={(e) =>
              setForm({
                ...form,
                role_id: Number(e.target.value)
              })
            }
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

          <select
            className="auth-input"
            name="facility_id"
            value={form.facility_id}
            onChange={handleChange}
          >
            <option value="">
              Sin punto asignado / vista general
            </option>

            {facilities.map((facility) => (
              <option
                key={facility.id}
                value={facility.id}
              >
                {facility.name}
              </option>
            ))}

          </select>

          {error && (

            <p className="form-error">
              {error}
            </p>
          )}

          <div className="modal-actions">

            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-success"
            >
              {
                loading
                  ? 'Creando...'
                  : 'Crear usuario'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}
