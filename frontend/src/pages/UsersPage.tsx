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

          {users.map((u) => (

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

