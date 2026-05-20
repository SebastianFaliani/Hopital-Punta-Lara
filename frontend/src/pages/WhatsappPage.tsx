import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';

type Reply = {
  id: number;
  code: string;
  title: string;
  keywords: string;
  response: string;
  sort_order: number;
  is_active: boolean;
};

type WebStatus = {
  status: string;
  qrDataUrl: string | null;
  phone: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
  isReady: boolean;
  hasClient: boolean;
  initializing: boolean;
};

type MessageLog = {
  id: number;
  phone: string | null;
  incoming_message: string;
  response_message: string;
  created_at: string;
};

const emptyForm = {
  code: '',
  title: '',
  keywords: '',
  response: '',
  sort_order: 0,
  is_active: true
};

export default function WhatsappPage() {

  const [replies, setReplies] =
    useState<Reply[]>([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState<Reply | null>(null);

  const [testMessage, setTestMessage] =
    useState('');

  const [testResponse, setTestResponse] =
    useState('');

  const [error, setError] =
    useState('');

  const [webStatus, setWebStatus] =
    useState<WebStatus | null>(null);

  const [logs, setLogs] =
    useState<MessageLog[]>([]);

  const [connectionLoading, setConnectionLoading] =
    useState(false);

  async function loadReplies() {

    try {

      const res =
        await apiFetch('/whatsapp/replies');

      setReplies(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadWebStatus() {

    try {

      const res =
        await apiFetch('/whatsapp/web/status');

      setWebStatus(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadLogs() {

    try {

      const res =
        await apiFetch('/whatsapp/logs');

      setLogs(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleConnectionAction(
    action: 'start' | 'stop' | 'logout'
  ) {

    try {

      setConnectionLoading(true);
      setError('');

      const res =
        await apiFetch(
          `/whatsapp/web/${action}`,
          {
            method: 'POST'
          }
        );

      setWebStatus(res.data);
      await loadLogs();

    } catch (error: any) {

      setError(error.message);

    } finally {

      setConnectionLoading(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement
    >
  ) {

    const target =
      e.target as HTMLInputElement;

    setForm({
      ...form,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.name === 'sort_order'
            ? Number(target.value)
            : target.value
    });
  }

  function startEdit(
    reply: Reply
  ) {

    setEditing(reply);
    setForm({
      code: reply.code,
      title: reply.title,
      keywords: reply.keywords || '',
      response: reply.response,
      sort_order: reply.sort_order,
      is_active: Boolean(reply.is_active)
    });
  }

  function resetForm() {

    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        editing
          ? `/whatsapp/replies/${editing.id}`
          : '/whatsapp/replies',
        {
          method:
            editing ? 'PUT' : 'POST',
          body:
            JSON.stringify(form)
        }
      );

      resetForm();
      loadReplies();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleToggle(
    id: number
  ) {

    await apiFetch(
      `/whatsapp/replies/${id}/toggle`,
      {
        method: 'PATCH'
      }
    );

    loadReplies();
  }

  async function simulate() {

    setError('');
    setTestResponse('');

    try {

      const res =
        await apiFetch(
          '/whatsapp/simulate',
          {
            method: 'POST',
            body: JSON.stringify({
              message: testMessage
            })
          }
        );

      setTestResponse(
        res.data.response
      );

    } catch (error: any) {

      setError(error.message);
    }
  }

  useEffect(() => {

    loadReplies();
    loadWebStatus();
    loadLogs();

    const interval =
      window.setInterval(() => {
        loadWebStatus();
        loadLogs();
      }, 5000);

    return () =>
      window.clearInterval(interval);

  }, []);

  const connectionLabel =
    webStatus?.status === 'connected'
      ? 'Conectado'
      : webStatus?.status === 'qr'
        ? 'Esperando QR'
        : webStatus?.status === 'initializing'
          ? 'Iniciando'
          : webStatus?.status === 'authenticated'
            ? 'Autenticado'
            : webStatus?.status === 'not_configured'
              ? 'No configurado'
              : webStatus?.status === 'failed'
                ? 'Error'
                : 'Desconectado';

  const connectionBadgeClass =
    webStatus?.status === 'connected'
      ? 'badge badge-success'
      : webStatus?.status === 'qr' ||
          webStatus?.status === 'initializing' ||
          webStatus?.status === 'authenticated'
        ? 'badge badge-warning'
        : 'badge badge-danger';

  return (

    <div>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            WhatsApp
          </h1>
          <p className="page-subtitle">
            Menu automatico, palabras clave y respuestas para consultas frecuentes.
          </p>
        </div>
      </div>

      <section className="dashboard-panel whatsapp-preview">
        <div className="whatsapp-connection-header">
          <div>
            <h2>Conexion WhatsApp Web</h2>
            <p className="page-subtitle">
              Vincula el telefono escaneando el QR desde WhatsApp.
            </p>
          </div>

          <span className={connectionBadgeClass}>
            {connectionLabel}
          </span>
        </div>

        <div className="whatsapp-connection-grid">
          <div className="whatsapp-qr-box">
            {
              webStatus?.qrDataUrl ? (
                <img
                  src={webStatus.qrDataUrl}
                  alt="Codigo QR de WhatsApp"
                />
              ) : (
                <div className="whatsapp-qr-placeholder">
                  {
                    webStatus?.isReady
                      ? 'Telefono vinculado'
                      : 'Presiona iniciar para generar el QR'
                  }
                </div>
              )
            }
          </div>

          <div className="whatsapp-connection-info">
            <p>
              <strong>Telefono:</strong>{' '}
              {webStatus?.phone || '-'}
            </p>
            <p>
              <strong>Ultimo evento:</strong>{' '}
              {webStatus?.lastEvent || '-'}
            </p>
            <p>
              <strong>Actualizado:</strong>{' '}
              {
                webStatus?.lastEventAt
                  ? new Date(webStatus.lastEventAt)
                    .toLocaleString('es-AR')
                  : '-'
              }
            </p>

            <div className="management-actions">
              <button
                className="btn-primary"
                type="button"
                disabled={
                  connectionLoading ||
                  webStatus?.status === 'connected' ||
                  webStatus?.status === 'initializing'
                }
                onClick={() =>
                  handleConnectionAction('start')
                }
              >
                Iniciar conexion
              </button>

              <button
                className="btn-secondary"
                type="button"
                disabled={
                  connectionLoading ||
                  !webStatus?.hasClient
                }
                onClick={() =>
                  handleConnectionAction('stop')
                }
              >
                Detener
              </button>

              <button
                className="btn-danger"
                type="button"
                disabled={
                  connectionLoading ||
                  !webStatus?.hasClient
                }
                onClick={() =>
                  handleConnectionAction('logout')
                }
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-panel whatsapp-preview">
        <h2>Probar respuesta automatica</h2>

        <div className="whatsapp-test">
          <input
            className="form-input"
            placeholder="Ejemplo: quiero turno para traumatologia"
            value={testMessage}
            onChange={(e) =>
              setTestMessage(e.target.value)
            }
          />

          <button
            className="btn-primary"
            onClick={simulate}
          >
            Probar
          </button>
        </div>

        {
          testResponse && (
            <pre className="whatsapp-message">
              {testResponse}
            </pre>
          )
        }
      </section>

      <section className="dashboard-panel whatsapp-preview">
        <h2>Ultimos mensajes</h2>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Telefono</th>
                <th>Mensaje</th>
                <th>Respuesta</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {new Date(log.created_at)
                      .toLocaleString('es-AR')}
                  </td>
                  <td>{log.phone || '-'}</td>
                  <td>{log.incoming_message}</td>
                  <td>{log.response_message}</td>
                </tr>
              ))}

              {
                logs.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      Todavia no hay mensajes registrados.
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>
      </section>

      <form
        className="whatsapp-form"
        onSubmit={handleSubmit}
      >
        <input
          className="form-input"
          name="code"
          placeholder="Codigo u opcion, por ejemplo 1"
          value={form.code}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="title"
          placeholder="Titulo"
          value={form.title}
          onChange={handleChange}
        />

        <input
          className="form-input"
          type="number"
          name="sort_order"
          placeholder="Orden"
          value={form.sort_order}
          onChange={handleChange}
        />

        <input
          className="form-input"
          name="keywords"
          placeholder="Palabras clave separadas por coma"
          value={form.keywords}
          onChange={handleChange}
        />

        <textarea
          className="form-input whatsapp-response-input"
          name="response"
          placeholder="Respuesta automatica"
          rows={7}
          value={form.response}
          onChange={handleChange}
        />

        <label className="checkbox-row">
          <input
            type="checkbox"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
          />
          Activa
        </label>

        <div className="management-actions">
          <button
            className="btn-success"
            type="submit"
          >
            {
              editing
                ? 'Guardar respuesta'
                : 'Crear respuesta'
            }
          </button>

          {
            editing && (
              <button
                className="btn-secondary"
                type="button"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )
          }
        </div>
      </form>

      {
        error && (
          <p className="auth-error">
            {error}
          </p>
        )
      }

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Opcion</th>
              <th>Titulo</th>
              <th>Palabras clave</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {replies.map((reply) => (
              <tr key={reply.id}>
                <td>{reply.code}</td>
                <td>{reply.title}</td>
                <td>{reply.keywords}</td>
                <td>
                  <span
                    className={
                      reply.is_active
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {
                      reply.is_active
                        ? 'Activa'
                        : 'Inactiva'
                    }
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-primary"
                      onClick={() =>
                        startEdit(reply)
                      }
                    >
                      Editar
                    </button>

                    <button
                      className={
                        reply.is_active
                          ? 'btn-danger'
                          : 'btn-success'
                      }
                      onClick={() =>
                        handleToggle(reply.id)
                      }
                    >
                      {
                        reply.is_active
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

    </div>
  );
}
