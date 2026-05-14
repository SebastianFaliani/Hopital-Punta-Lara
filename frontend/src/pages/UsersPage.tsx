import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';

import { useAuth }
  from '../auth/useAuth';

import CreateUserModal
  from '../components/users/CreateUserModal';

import EditUserModal
  from '../components/users/EditUserModal';

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

  return (

    <div>

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          marginBottom: 24
        }}
      >

        <h1
          style={{
            margin: 0
          }}
        >
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

      <table
        style={{
          width: '100%',
          borderCollapse:
            'collapse',
          background: 'white',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow:
            '0 4px 12px rgba(0,0,0,0.08)'
        }}
      >

        <thead>

          <tr
            style={{
              background: '#f3f4f6'
            }}
          >

            <th style={thStyle}>
              ID
            </th>

            <th style={thStyle}>
              Nombre
            </th>

            <th style={thStyle}>
              Email
            </th>

            <th style={thStyle}>
              Rol
            </th>

            <th style={thStyle}>
              Estado
            </th>

            <th style={thStyle}>
              Acciones
            </th>

          </tr>

        </thead>

        <tbody>

          {users.map((u) => (

            <tr
              key={u.id}
              style={{
                borderBottom:
                  '1px solid #e5e7eb'
              }}
            >

              <td style={tdStyle}>
                {u.id}
              </td>

              <td style={tdStyle}>
                {u.first_name}
                {' '}
                {u.last_name}
              </td>

              <td style={tdStyle}>
                {u.email}
              </td>

              <td style={tdStyle}>
                {u.role}
              </td>

              <td style={tdStyle}>

                <span
                  style={{
                    padding:
                      '6px 10px',

                    borderRadius: 20,

                    fontSize: 13,

                    fontWeight: 600,

                    background:
                      u.is_active
                        ? '#dcfce7'
                        : '#fee2e2',

                    color:
                      u.is_active
                        ? '#166534'
                        : '#991b1b'
                  }}
                >
                  {
                    u.is_active
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </td>

              <td style={tdStyle}>

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
                      ? 'btn-secondary'
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

              </td>

            </tr>

          ))}

        </tbody>

      </table>

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

const thStyle = {

  padding: '14px',

  textAlign: 'left' as const,

  fontSize: 14,

  color: '#374151'
};

const tdStyle = {

  padding: '14px',

  fontSize: 14
};