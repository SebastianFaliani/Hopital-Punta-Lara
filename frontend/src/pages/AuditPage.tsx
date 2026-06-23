import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../api/api';
import {
  formatDisplayDateTime
} from '../utils/dateFormat';

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

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema'
) {
  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant: 'error'
        }
      }
    )
  );
}

export default function AuditPage() {

  const [logs, setLogs] =
    useState<AuditLog[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [filters, setFilters] =
    useState({
      search: '',
      module: 'todos',
      action: 'todos',
      date_from: '',
      date_to: '',
      page: 1,
      per_page: 25
    });

  const [pagination, setPagination] =
    useState({
      page: 1,
      per_page: 25,
      total: 0,
      total_pages: 1
    });

  const [options, setOptions] =
    useState({
      modules: [] as string[],
      actions: [] as string[]
    });

  async function loadAuditLogs() {

    setLoading(true);

    try {

      const params =
        new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== '' &&
          value !== null &&
          value !== undefined &&
          value !== 'todos'
        ) {
          params.set(key, String(value));
        }
      });

      const res =
        await apiFetch(
          `/audit?${params.toString()}`
      );

      setLogs(res.data);
      setPagination(
        res.pagination || {
          page: 1,
          per_page: filters.per_page,
          total: res.data.length,
          total_pages: 1
        }
      );
      setOptions(
        res.options || {
          modules: [],
          actions: []
        }
      );

    } catch (error: any) {

      showSystemAlert(error.message);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuditLogs();
  }, [
    filters.page,
    filters.per_page
  ]);

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
              search: e.target.value,
              page: 1
            })
          }
        />

        <select
          className="form-input"
          value={filters.module}
          onChange={(e) =>
            setFilters({
              ...filters,
              module: e.target.value,
              page: 1
            })
          }
        >
          <option value="todos">Todos los modulos</option>
          {options.modules.map((module) => (
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
              action: e.target.value,
              page: 1
            })
          }
        >
          <option value="todos">Todas las acciones</option>
          {options.actions.map((action) => (
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
              date_from: e.target.value,
              page: 1
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
              date_to: e.target.value,
              page: 1
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

      <p className="results-summary">
        {loading
          ? 'Cargando auditoria...'
          : `Mostrando ${logs.length} de ${pagination.total} movimientos`}
      </p>

      <div className="pagination-bar">
        <span>
          Pagina {pagination.page} de {pagination.total_pages}
        </span>

        <div className="table-actions">
          <select
            className="form-input"
            value={filters.per_page}
            onChange={(e) =>
              setFilters({
                ...filters,
                per_page: Number(e.target.value),
                page: 1
              })
            }
          >
            <option value={25}>25 por pagina</option>
            <option value={50}>50 por pagina</option>
            <option value={100}>100 por pagina</option>
          </select>

          <button
            className="btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() =>
              setFilters({
                ...filters,
                page: Math.max(1, pagination.page - 1)
              })
            }
          >
            Anterior
          </button>

          <button
            className="btn-secondary"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() =>
              setFilters({
                ...filters,
                page: Math.min(
                  pagination.total_pages,
                  pagination.page + 1
                )
              })
            }
          >
            Siguiente
          </button>
        </div>
      </div>

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

  return formatDisplayDateTime(value);
}
