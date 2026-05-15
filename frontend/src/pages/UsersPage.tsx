import {
  useEffect,
  useState
} from 'react';

import { apiFetch }   from '../api/api';
import { useAuth }  from '../auth/useAuth';
import CreateUserModal  from '../components/users/CreateUserModal';
import EditUserModal   from '../components/users/EditUserModal';

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

export default function UsersPage() {

  const { user } = useAuth();

  const [users, setUsers] =
    useState<User[]>([]);

  const [openModal, setOpenModal] =
    useState(false);

  const [editUser, setEditUser] =
    useState<User | null>(null);

  const [filters, setFilters] =
    useState({
      search: '',
      role: 'todos',
      status: 'todos'
    });

  async function loadUsers() {

    try {

      const res =
        await apiFetch('/users');

      setUsers(res.data);

    } catch (error) {

      console.error(error);
    }
  }

  useEffect(() => {

    loadUsers();

  }, []);

  async function handleToggle(
    id: number
  ) {

    try {

      await apiFetch(
        `/users/${id}/status`,
        {
          method: 'PATCH'
        }
      );

      loadUsers();

    } catch (error) {

      console.error(error);
    }
  }

  if (user?.role !== 'admin') {

    return <h2>No autorizado</h2>;
  }

  const roles =
    Array.from(
      new Set(
        users.map((u) => u.role)
      )
    );

  const filteredUsers =
    users.filter((u) => {

      const search =
        filters.search.toLowerCase();

      const matchesSearch =
        `${u.first_name} ${u.last_name}`
          .toLowerCase()
          .includes(search) ||
        u.email
          .toLowerCase()
          .includes(search) ||
        (u.username || '')
          .toLowerCase()
          .includes(search);

      const matchesRole =
        filters.role === 'todos' ||
        u.role === filters.role;

      const matchesStatus =
        filters.status === 'todos' ||
        (
          filters.status === 'activo' &&
          u.is_active
        ) ||
        (
          filters.status === 'inactivo' &&
          !u.is_active
        );

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });

  return (

    <div>

      <div className="page-header">

        <h1 className="page-title">
          Usuarios
        </h1>

        <button
          className="btn-primary"
          onClick={() =>
            setOpenModal(true)
          }
        >
          + Nuevo usuario
        </button>

      </div>

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar por nombre, email o usuario"
          value={filters.search}
          onChange={(e) =>
            setFilters({
              ...filters,
              search: e.target.value
            })
          }
        />

        <select
          className="form-input"
          value={filters.role}
          onChange={(e) =>
            setFilters({
              ...filters,
              role: e.target.value
            })
          }
        >
          <option value="todos">
            Todos los roles
          </option>
          {roles.map((role) => (
            <option
              key={role}
              value={role}
            >
              {role}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filters.status}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: e.target.value
            })
          }
        >
          <option value="todos">
            Todos los estados
          </option>
          <option value="activo">
            Activos
          </option>
          <option value="inactivo">
            Inactivos
          </option>
        </select>

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              search: '',
              role: 'todos',
              status: 'todos'
            })
          }
        >
          Limpiar
        </button>

      </div>

      <p className="results-summary">
        Mostrando {filteredUsers.length} de {users.length} usuarios
      </p>

<div className="table-container">

      <table className="data-table">

        <thead>

          <tr
            style={{
              background: '#f3f4f6'
            }}
          >

            <th>
              ID
            </th>

            <th>
              Nombre
            </th>

            <th>
              Email
            </th>

            <th>
              Rol
            </th>

            <th>
              Estado
            </th>

            <th>
              Acciones
            </th>

          </tr>

        </thead>

        <tbody>

          {filteredUsers.map((u) => (

            <tr
              key={u.id}
              style={{
                borderBottom:
                  '1px solid #e5e7eb'
              }}
            >

              <td>
                {u.id}
              </td>

              <td>
                {u.first_name}
                {' '}
                {u.last_name}
              </td>

              <td>
                {u.email}
              </td>

              <td>
                {u.role}
              </td>

              <td>

                <span
                  className={
                    u.is_active
                      ? 'badge badge-success'
                      : 'badge badge-danger'
                  }
                >
                  {
                    u.is_active
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </td>

              <td>

                <div className="table-actions">

                  <button
                    className="btn-primary"
                    style={{
                      marginRight: 10
                    }}
                    onClick={() =>
                      setEditUser(u)
                    }
                  >
                    Editar
                  </button>

                  <button
                    className={
                      u.is_active
                        ? 'btn-danger'
                        : 'btn-success'
                    }
                    onClick={() =>
                      handleToggle(u.id)
                    }
                  >
                    {
                      u.is_active
                        ? 'Desactivar'
                        : 'Activar'
                    }
                  </button>

                </div>


              </td>

            </tr>

          ))}

          {
            filteredUsers.length === 0 && (

              <tr>
                <td colSpan={6}>
                  No hay usuarios para esos filtros.
                </td>
              </tr>
            )
          }

        </tbody>

      </table>
</div>

      {
        openModal && (

          <CreateUserModal
            onClose={() =>
              setOpenModal(false)
            }
            onCreated={loadUsers}
          />

        )
      }

      {
        editUser && (

          <EditUserModal
            user={editUser}
            onClose={() =>
              setEditUser(null)
            }
            onUpdated={loadUsers}
          />

        )
      }

    </div>
  );
}

