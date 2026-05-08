import {
  useEffect,
  useMemo,
  useState
} from 'react';

import { apiFetch } from '../api/api';

type AuditLog = {
  id: number;
  username: string | null;
  user_role: string | null;
  module: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  ip_address: string | null;
  created_at: string;
};

export default function AuditPage() {

  const [logs, setLogs] =
    useState<AuditLog[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [filters, setFilters] =
    useState({
      search: '',
      module: 'todos',
      action: 'todos',
      date_from: '',
      date_to: ''
    });

  const modules =
    useMemo(
      () => Array.from(
        new Set(
          logs.map((log) => log.module)
        )
      ),
      [logs]
    );

  const actions =
    useMemo(
      () => Array.from(
        new Set(
          logs.map((log) => log.action)
        )
      ),
      [logs]
    );

  async function loadAuditLogs() {

    setLoading(true);
    setError('');

    try {

      const params =
        new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'todos') {
          params.set(key, value);
        }
      });

      const res =
        await apiFetch(
          `/audit?${params.toString()}`
        );

      setLogs(res.data);

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Auditoria
          </h1>
          <p className="page-subtitle">
            Movimientos importantes realizados en el sistema.
          </p>
        </div>
        <button
          className="btn-secondary"
          type="button"
          onClick={loadAuditLogs}
        >
          Actualizar
        </button>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          placeholder="Buscar por usuario, accion o detalle"
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
          value={filters.module}
          onChange={(e) =>
            setFilters({
              ...filters,
              module: e.target.value
            })
          }
        >
          <option value="todos">Todos los modulos</option>
          {modules.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filters.action}
          onChange={(e) =>
            setFilters({
              ...filters,
              action: e.target.value
            })
          }
        >
          <option value="todos">Todas las acciones</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>

        <input
          className="form-input"
          type="date"
          value={filters.date_from}
          onChange={(e) =>
            setFilters({
              ...filters,
              date_from: e.target.value
            })
          }
        />

        <input
          className="form-input"
          type="date"
          value={filters.date_to}
          onChange={(e) =>
            setFilters({
              ...filters,
              date_to: e.target.value
            })
          }
        />

        <button
          className="btn-primary"
          type="button"
          onClick={loadAuditLogs}
        >
          Filtrar
        </button>
      </div>

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}

      <p className="results-summary">
        {loading
          ? 'Cargando auditoria...'
          : `Mostrando ${logs.length} movimientos`}
      </p>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Modulo</th>
              <th>Accion</th>
              <th>Detalle</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.created_at)}</td>
                <td>
                  <strong>{log.username || '-'}</strong>
                  <br />
                  <span>{log.user_role || '-'}</span>
                </td>
                <td>{log.module}</td>
                <td>{log.action}</td>
                <td>{log.description}</td>
                <td>{log.ip_address || '-'}</td>
              </tr>
            ))}

            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={6}>
                  Todavia no hay movimientos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(
  value: string
) {

  if (!value) {
    return '-';
  }

  return new Date(value)
    .toLocaleString(
      'es-AR',
      {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    );
}
