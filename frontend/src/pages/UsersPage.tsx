import {
  useEffect,
  useState
} from 'react';

import { apiFetch }   from '../api/api';
import { useAuth }  from '../auth/useAuth';
import CreateUserModal  from '../components/users/CreateUserModal';
import EditUserModal   from '../components/users/EditUserModal';
import AdminResetPasswordModal from '../components/users/AdminResetPasswordModal';
import UserAccessModal from '../components/users/UserAccessModal';

type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  role_id: number;
  role: string;
  facility_id: number | null;
  facility_name: string | null;
  is_active: boolean;
};

type Role = {
  id: number;
  name: string;
  description: string;
};

export default function UsersPage() {

  const { user } = useAuth();

  const [users, setUsers] =
    useState<User[]>([]);

  const [roles, setRoles] =
    useState<Role[]>([]);

  const [activeTab, setActiveTab] =
    useState<'users' | 'roles'>('users');

  const [roleForm, setRoleForm] =
    useState({
      name: '',
      description: ''
    });

  const [roleSaving, setRoleSaving] =
    useState(false);

  const [roleError, setRoleError] =
    useState('');

  const [openModal, setOpenModal] =
    useState(false);

  const [editUser, setEditUser] =
    useState<User | null>(null);

  const [passwordUser, setPasswordUser] =
    useState<User | null>(null);

  const [accessUser, setAccessUser] =
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

  async function loadRoles() {

    try {

      const res =
        await apiFetch('/roles');

      setRoles(res.data);

    } catch (error) {

      console.error(error);
    }
  }

  useEffect(() => {

    loadUsers();
    loadRoles();

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

  async function handleCreateRole(
    e: React.FormEvent
  ) {

    e.preventDefault();

    setRoleError('');

    if (!roleForm.name.trim()) {
      setRoleError('El nombre del rol es obligatorio');
      return;
    }

    try {

      setRoleSaving(true);

      await apiFetch(
        '/roles',
        {
          method: 'POST',
          body: JSON.stringify(roleForm)
        }
      );

      setRoleForm({
        name: '',
        description: ''
      });

      await loadRoles();

    } catch (error: any) {

      setRoleError(error.message);

    } finally {

      setRoleSaving(false);
    }
  }

  if (user?.role !== 'admin') {

    return <h2>No autorizado</h2>;
  }

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

        {
          activeTab === 'users' && (

            <button
              className="btn-primary"
              onClick={() =>
                setOpenModal(true)
              }
            >
              + Nuevo usuario
            </button>
          )
        }

      </div>

      <div className="module-tabs">

        <button
          type="button"
          className={
            activeTab === 'users'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          onClick={() =>
            setActiveTab('users')
          }
        >
          Usuarios
        </button>

        <button
          type="button"
          className={
            activeTab === 'roles'
              ? 'module-tab module-tab-active'
              : 'module-tab'
          }
          onClick={() =>
            setActiveTab('roles')
          }
        >
          Roles
        </button>

      </div>

      {
        activeTab === 'users' && (

          <>

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
              key={role.id}
              value={role.name}
            >
              {role.description || role.name}
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
              Punto
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
                {u.facility_name || 'Vista general'}
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
                    onClick={() =>
                      setEditUser(u)
                    }
                  >
                    Editar
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setAccessUser(u)
                    }
                  >
                    Permisos
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setPasswordUser(u)
                    }
                  >
                    Nueva contraseña
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
                <td colSpan={7}>
                  No hay usuarios para esos filtros.
                </td>
              </tr>
            )
          }

        </tbody>

      </table>
</div>

          </>
        )
      }

      {
        activeTab === 'roles' && (

          <section>

            <form
              className="filter-bar"
              onSubmit={handleCreateRole}
            >

              <input
                className="form-input"
                placeholder="Nombre interno. Ej: nutri"
                value={roleForm.name}
                onChange={(e) =>
                  setRoleForm({
                    ...roleForm,
                    name: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Descripcion visible. Ej: Nutricion"
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm({
                    ...roleForm,
                    description: e.target.value
                  })
                }
              />

              <button
                className="btn-primary"
                type="submit"
                disabled={roleSaving}
              >
                {
                  roleSaving
                    ? 'Guardando...'
                    : '+ Crear rol'
                }
              </button>

            </form>

            {
              roleError && (

                <p className="form-error">
                  {roleError}
                </p>
              )
            }

            <p className="results-summary">
              Los permisos concretos se asignan desde el boton Permisos de cada usuario.
            </p>

            <div className="table-container">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>ID</th>

                    <th>Nombre interno</th>

                    <th>Descripcion</th>

                  </tr>

                </thead>

                <tbody>

                  {roles.map((role) => (

                    <tr key={role.id}>

                      <td>{role.id}</td>

                      <td>{role.name}</td>

                      <td>{role.description || role.name}</td>

                    </tr>
                  ))}

                  {
                    roles.length === 0 && (

                      <tr>

                        <td colSpan={3}>
                          No hay roles cargados.
                        </td>

                      </tr>
                    )
                  }

                </tbody>

              </table>

            </div>

          </section>
        )
      }

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

      {
        accessUser && (
          <UserAccessModal
            user={accessUser}
            onClose={() =>
              setAccessUser(null)
            }
            onUpdated={loadUsers}
          />
        )
      }

      {
        passwordUser && (

          <AdminResetPasswordModal
            user={passwordUser}
            onClose={() =>
              setPasswordUser(null)
            }
          />

        )
      }

    </div>
  );
}

