import {
  useEffect,
  useMemo,
  useState
} from 'react';

import { apiFetch } from '../../api/api';

type User = {
  id: number;
  first_name: string;
  last_name: string;
  facility_id: number | null;
};

type Permission = {
  permission_key: string;
  module_name: string;
  description: string;
  allowed: boolean;
  source: string;
};

type Facility = {
  id: number;
  name: string;
  facility_type: string;
};

type Props = {
  user: User;
  onClose: () => void;
  onUpdated: () => void;
};

export default function UserAccessModal({
  user,
  onClose,
  onUpdated
}: Props) {
  const [permissions, setPermissions] =
    useState<Permission[]>([]);

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [selectedPermissions, setSelectedPermissions] =
    useState<string[]>([]);

  const [selectedFacilities, setSelectedFacilities] =
    useState<number[]>([]);

  const [accessAllFacilities, setAccessAllFacilities] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [accessRes, facilitiesRes] =
          await Promise.all([
            apiFetch(`/users/${user.id}/access`),
            apiFetch('/health-facilities')
          ]);

        setPermissions(accessRes.data.permissions);
        setSelectedPermissions(
          accessRes.data.permissions
            .filter((permission: Permission) =>
              permission.allowed
            )
            .map((permission: Permission) =>
              permission.permission_key
            )
        );
        setSelectedFacilities(
          accessRes.data.facility_ids.map(Number)
        );
        setAccessAllFacilities(
          Boolean(accessRes.data.access_all_facilities)
        );
        setFacilities(facilitiesRes.data);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user.id]);

  const permissionGroups =
    useMemo(() => {
      return permissions.reduce(
        (
          groups: Record<string, Permission[]>,
          permission
        ) => {
          groups[permission.module_name] ||= [];
          groups[permission.module_name].push(permission);
          return groups;
        },
        {}
      );
    }, [permissions]);

  function togglePermission(
    permissionKey: string
  ) {
    setSelectedPermissions((current) =>
      current.includes(permissionKey)
        ? current.filter((key) =>
          key !== permissionKey
        )
        : [...current, permissionKey]
    );
  }

  function toggleFacility(
    facilityId: number
  ) {
    setSelectedFacilities((current) =>
      current.includes(facilityId)
        ? current.filter((id) =>
          id !== facilityId
        )
        : [...current, facilityId]
    );
  }

  async function saveAccess() {
    try {
      setSaving(true);
      setError('');

      await apiFetch(
        `/users/${user.id}/access`,
        {
          method: 'PUT',
          body: JSON.stringify({
            permission_keys: selectedPermissions,
            facility_ids: selectedFacilities,
            access_all_facilities: accessAllFacilities
          })
        }
      );

      onUpdated();
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPermissions() {
    try {
      setSaving(true);
      setError('');

      await apiFetch(
        `/users/${user.id}/access/permissions`,
        { method: 'DELETE' }
      );

      onUpdated();
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content access-modal">
        <div className="modal-title-row">
          <div>
            <h2 className="modal-title">
              Permisos y dependencias
            </h2>
            <p>
              {user.first_name} {user.last_name}
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p>Cargando accesos...</p>
        ) : (
          <>
            <section className="access-section">
              <h3>Modulos permitidos</h3>
              <div className="access-permission-table-wrap">
                <table className="access-permission-table">
                  <thead>
                    <tr>
                      <th>Modulo</th>
                      <th>Permiso</th>
                      <th>Habilitado</th>
                      <th>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(permissionGroups)
                      .map(([moduleName, items]) => {
                        const sortedItems =
                          [...items].sort((a, b) => {
                            const order = (key: string) => {
                              if (key.endsWith('.view')) {
                                return 1;
                              }

                              if (key.endsWith('.manage')) {
                                return 2;
                              }

                              return 3;
                            };

                            return (
                              order(a.permission_key) -
                                order(b.permission_key) ||
                              a.description.localeCompare(
                                b.description
                              )
                            );
                          });

                        return sortedItems.map(
                          (permission, index) => (
                            <tr key={permission.permission_key}>
                              {index === 0 && (
                                <td rowSpan={sortedItems.length}>
                                  <strong>{moduleName}</strong>
                                </td>
                              )}
                              <td>
                                <strong>
                                  {permission.description}
                                </strong>
                                <span>
                                  {permission.permission_key}
                                </span>
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={
                                    permission.description
                                  }
                                  checked={
                                    selectedPermissions.includes(
                                      permission.permission_key
                                    )
                                  }
                                  onChange={() =>
                                    togglePermission(
                                      permission.permission_key
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <span className="permission-source">
                                  {
                                    permission.source ===
                                      'personalizado'
                                      ? 'Personalizado'
                                      : 'Rol'
                                  }
                                </span>
                              </td>
                            </tr>
                          )
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="access-section">
              <h3>Dependencias permitidas</h3>
              <label className="checkbox-row access-all-dependencies">
                <input
                  type="checkbox"
                  checked={accessAllFacilities}
                  onChange={(event) =>
                    setAccessAllFacilities(event.target.checked)
                  }
                />
                Puede acceder a todas las dependencias
              </label>

              {!accessAllFacilities && (
                <div className="access-facility-grid">
                  {facilities.map((facility) => (
                    <label
                      className="checkbox-row"
                      key={facility.id}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedFacilities.includes(facility.id)
                        }
                        disabled={facility.id === user.facility_id}
                        onChange={() =>
                          toggleFacility(facility.id)
                        }
                      />
                      {facility.name}
                      {facility.id === user.facility_id
                        ? ' (principal)'
                        : ''}
                    </label>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {error && (
          <p className="form-error">{error}</p>
        )}

        <div className="modal-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={resetPermissions}
            disabled={saving || loading}
          >
            Usar permisos del rol
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={saveAccess}
            disabled={saving || loading}
          >
            {saving ? 'Guardando...' : 'Guardar accesos'}
          </button>
        </div>
      </div>
    </div>
  );
}
