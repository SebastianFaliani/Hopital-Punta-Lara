import {
  useEffect,
  useMemo,
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
  is_system?: boolean;
};

type RolePermission = {
  permission_key: string;
  module_name: string;
  description: string;
  allowed: boolean;
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

  const [editingRole, setEditingRole] =
    useState<Role | null>(null);

  const [editingRoleForm, setEditingRoleForm] =
    useState({
      name: '',
      description: ''
    });

  const [rolePermissions, setRolePermissions] =
    useState<RolePermission[]>([]);

  const [selectedRolePermissions, setSelectedRolePermissions] =
    useState<string[]>([]);

  const [loadingRoleAccess, setLoadingRoleAccess] =
    useState(false);

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

  async function openRoleEditor(
    role: Role
  ) {
    setRoleError('');
    setEditingRole(role);
    setEditingRoleForm({
      name: role.name,
      description: role.description || role.name
    });
    setRolePermissions([]);
    setSelectedRolePermissions([]);
    setLoadingRoleAccess(true);

    try {
      const res =
        await apiFetch(`/roles/${role.id}/access`);

      setEditingRole(res.data.role);
      setEditingRoleForm({
        name: res.data.role.name,
        description:
          res.data.role.description ||
          res.data.role.name
      });
      setRolePermissions(res.data.permissions);
      setSelectedRolePermissions(
        res.data.permissions
          .filter((permission: RolePermission) =>
            permission.allowed
          )
          .map((permission: RolePermission) =>
            permission.permission_key
          )
      );
    } catch (error: any) {
      setRoleError(error.message);
      setEditingRole(null);
    } finally {
      setLoadingRoleAccess(false);
    }
  }

  function closeRoleEditor() {
    setEditingRole(null);
    setRolePermissions([]);
    setSelectedRolePermissions([]);
    setEditingRoleForm({
      name: '',
      description: ''
    });
  }

  function toggleRolePermission(
    permissionKey: string
  ) {
    setSelectedRolePermissions((current) =>
      current.includes(permissionKey)
        ? current.filter((item) => item !== permissionKey)
        : [
            ...current,
            permissionKey
          ]
    );
  }

  async function handleUpdateRole(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!editingRole) {
      return;
    }

    setRoleError('');
    setRoleSaving(true);

    try {
      await apiFetch(
        `/roles/${editingRole.id}`,
        {
          method: 'PUT',
          body:
            JSON.stringify(editingRoleForm)
        }
      );

      await apiFetch(
        `/roles/${editingRole.id}/permissions`,
        {
          method: 'PUT',
          body:
            JSON.stringify({
              permission_keys: selectedRolePermissions
            })
        }
      );

      closeRoleEditor();
      await Promise.all([
        loadRoles(),
        loadUsers()
      ]);
    } catch (error: any) {
      setRoleError(error.message);
    } finally {
      setRoleSaving(false);
    }
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

  const groupedRolePermissions =
    useMemo(() => {
      return rolePermissions.reduce(
        (
          groups: Record<string, RolePermission[]>,
          permission
        ) => {
          groups[permission.module_name] ||= [];
          groups[permission.module_name].push(permission);
          return groups;
        },
        {}
      );
    }, [rolePermissions]);

  if (user?.role !== 'admin') {

    return <h2>No autorizado</h2>;
  }

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
              Los permisos del rol son la base para todos los usuarios de ese rol. Los permisos de cada usuario pueden ajustarse desde el boton Permisos.
            </p>

            <div className="table-container">

              <table className="data-table">

                <thead>

                  <tr>

                    <th>ID</th>

                    <th>Nombre interno</th>

                    <th>Descripcion</th>

                    <th>Acciones</th>

                  </tr>

                </thead>

                <tbody>

                  {roles.map((role) => (

                    <tr key={role.id}>

                      <td>{role.id}</td>

                      <td>{role.name}</td>

                      <td>{role.description || role.name}</td>

                      <td>
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() =>
                            openRoleEditor(role)
                          }
                        >
                          Editar
                        </button>
                      </td>

                    </tr>
                  ))}

                  {
                    roles.length === 0 && (

                      <tr>

                        <td colSpan={4}>
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
        editingRole && (
          <div className="modal-overlay">
            <div className="modal-content modal-content-wide">
              <button
                className="modal-close-button"
                type="button"
                onClick={closeRoleEditor}
              >
                x
              </button>

              <h2 className="modal-title">
                Editar rol
              </h2>

              <form onSubmit={handleUpdateRole}>
                <div className="personnel-form">
                  <label className="form-field">
                    <span>Nombre interno</span>
                    <input
                      className="form-input"
                      value={editingRoleForm.name}
                      disabled={Boolean(editingRole.is_system)}
                      onChange={(e) =>
                        setEditingRoleForm({
                          ...editingRoleForm,
                          name: e.target.value
                        })
                      }
                    />
                  </label>

                  <label className="form-field">
                    <span>Nombre visible</span>
                    <input
                      className="form-input"
                      value={editingRoleForm.description}
                      onChange={(e) =>
                        setEditingRoleForm({
                          ...editingRoleForm,
                          description: e.target.value
                        })
                      }
                    />
                  </label>
                </div>

                {editingRole.is_system && (
                  <p className="results-summary">
                    Este rol es del sistema. Se puede cambiar el nombre visible y sus permisos base, pero no el nombre interno.
                  </p>
                )}

                {loadingRoleAccess ? (
                  <p>Cargando permisos...</p>
                ) : (
                  <div className="permissions-grid">
                    {Object.entries(groupedRolePermissions).map((
                      [
                        moduleName,
                        items
                      ]
                    ) => (
                      <section
                        className="permission-group"
                        key={moduleName}
                      >
                        <h3>{moduleName}</h3>

                        {items.map((permission) => (
                          <label
                            className="permission-row"
                            key={permission.permission_key}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRolePermissions.includes(
                                permission.permission_key
                              )}
                              onChange={() =>
                                toggleRolePermission(
                                  permission.permission_key
                                )
                              }
                            />
                            <span>{permission.description}</span>
                          </label>
                        ))}
                      </section>
                    ))}
                  </div>
                )}

                <div className="management-actions">
                  <button
                    className="btn-success"
                    type="submit"
                    disabled={roleSaving}
                  >
                    {
                      roleSaving
                        ? 'Guardando...'
                        : 'Guardar rol'
                    }
                  </button>

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={closeRoleEditor}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
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

