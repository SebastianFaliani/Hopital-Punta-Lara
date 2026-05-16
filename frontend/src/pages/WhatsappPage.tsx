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

  async function loadReplies() {

    try {

      const res =
        await apiFetch('/whatsapp/replies');

      setReplies(res.data);

    } catch (error: any) {

      setError(error.message);
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

  }, []);

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
