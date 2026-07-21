import { useEffect, useState } from 'react';
import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import PageTitle from '../components/PageTitle';
import { formatDisplayDate } from '../utils/dateFormat';
import './PatientsPage.css';

type Patient = { id:number; document_number:string; last_name:string; first_name:string; phone:string|null; birth_date:string|null; laboratory_count:number; sent_count:number; partial_count:number; complete_count:number; picked_up_count:number };
type Lab = { id:number; study_date:string; status:string; has_blood_extraction:number; has_urine_sample:number; missing_details:string|null; pickup_date:string|null };
const emptyForm = { document_number:'', last_name:'', first_name:'', phone:'', birth_date:'' };
const badgeClass = (status:string) => status === 'enviado' ? 'badge badge-danger' : status === 'parcial' ? 'badge badge-warning' : status === 'retirado' ? 'badge badge-info' : status === 'completo' ? 'badge badge-success' : 'badge';

export default function PatientsPage() {
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'patients.manage', ['admin', 'dir', 'lab']);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const response = await apiFetch(`/patients?search=${encodeURIComponent(search)}&page=${page}&per_page=25`);
    setPatients(response.data);
    setPages(response.pagination.total_pages);
    setTotal(response.pagination.total);
  };
  useEffect(() => { void load(); }, [page, search]);

  const detail = async (id:number) => setSelected((await apiFetch(`/patients/${id}`)).data);
  const showForm = (patient?:Patient) => {
    setEditing(patient || null);
    setForm(patient ? { document_number:patient.document_number || '', last_name:patient.last_name || '', first_name:patient.first_name || '', phone:patient.phone || '', birth_date:patient.birth_date?.slice(0,10) || '' } : emptyForm);
    setOpen(true);
  };
  const save = async (event:any) => {
    event.preventDefault();
    await apiFetch(editing ? `/patients/${editing.id}` : '/patients', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
    setOpen(false);
    await load();
    if (editing) await detail(editing.id);
  };

  return <div>
    <div className="page-header">
      <div><PageTitle icon="pacientes">Pacientes</PageTitle><p className="page-subtitle">Datos personales e historial de atenciones.</p></div>
      {canEdit && <button className="btn-primary" onClick={() => showForm()}>+ Nuevo paciente</button>}
    </div>

    <div className="dashboard-grid">
      <div className="dashboard-card"><h3>Total</h3><p>{total}</p><span>Pacientes registrados</span></div>
    </div>

    <div className="filter-bar patients-filter-bar">
      <input className="form-input patients-search-filter" placeholder="Buscar por apellido, nombre o DNI" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
    </div>
    <p className="results-summary">Mostrando {patients.length} de {total} pacientes</p>

    <div className="pagination-bar"><span>Página {page} de {pages}</span><div className="table-actions"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Anterior</button><button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(v => v + 1)}>Siguiente</button></div></div>

    <div className="table-container"><table className="data-table"><thead><tr><th>Paciente</th><th>DNI</th><th>Teléfono</th><th>Nacimiento</th><th>Laboratorios</th><th>Acciones</th></tr></thead><tbody>
      {patients.map(patient => <tr key={patient.id}><td>{patient.last_name} {patient.first_name}</td><td>{patient.document_number}</td><td>{patient.phone || '-'}</td><td>{formatDisplayDate(patient.birth_date)}</td><td><span className="badge badge-info">{Number(patient.laboratory_count || 0)}</span></td><td><div className="table-actions"><IconButton icon="eye" label="Ver ficha" onClick={() => detail(patient.id)} variant="secondary" />{canEdit && <IconButton icon="edit" label="Editar paciente" onClick={() => showForm(patient)} variant="primary" />}</div></td></tr>)}
      {!patients.length && <tr><td colSpan={6}>No hay pacientes para mostrar.</td></tr>}
    </tbody></table></div>
    <div className="pagination-bar"><span>Página {page} de {pages}</span><div className="table-actions"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Anterior</button><button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(v => v + 1)}>Siguiente</button></div></div>

    {selected && <div className="modal-overlay"><div className="modal-content modal-content-wide patient-detail"><IconButton icon="close" label="Cerrar ficha" className="modal-close-button" onClick={() => setSelected(null)} /><h2 className="modal-title">{selected.patient.last_name} {selected.patient.first_name}</h2><p className="modal-subtitle">DNI {selected.patient.document_number} · Tel. {selected.patient.phone || '-'} · Nacimiento {formatDisplayDate(selected.patient.birth_date)}</p>
      <div className="dashboard-grid patient-detail-grid">{[['Total',selected.patient.laboratory_count,'Laboratorios registrados'],['Enviados',selected.patient.sent_count,'Esperando resultados'],['Parciales',selected.patient.partial_count,'Resultados incompletos'],['Completos',selected.patient.complete_count,'Resultados completos'],['Retirados',selected.patient.picked_up_count,'Estudios entregados']].map(item => <div className="dashboard-card" key={item[0]}><h3>{item[0]}</h3><p>{Number(item[1] || 0)}</p><span>{item[2]}</span></div>)}</div>
      <h3>Historial de laboratorios</h3><div className="table-container"><table className="data-table"><thead><tr><th>Fecha</th><th>Estado</th><th>Muestras</th><th>Pendiente</th><th>Retiro</th></tr></thead><tbody>{selected.laboratories.map((lab:Lab) => <tr key={lab.id}><td>{formatDisplayDate(lab.study_date)}</td><td><span className={badgeClass(lab.status)}>{lab.status}</span></td><td>{[lab.has_blood_extraction ? 'Extracción' : '', lab.has_urine_sample ? 'Orina' : ''].filter(Boolean).join(' + ')}</td><td>{lab.missing_details || '-'}</td><td>{formatDisplayDate(lab.pickup_date)}</td></tr>)}{!selected.laboratories.length && <tr><td colSpan={5}>Todavía no tiene laboratorios registrados.</td></tr>}</tbody></table></div>
    </div></div>}

    {open && <div className="modal-overlay"><form className="modal-content" onSubmit={save}><IconButton icon="close" label="Cerrar formulario" className="modal-close-button" onClick={() => setOpen(false)} /><h2 className="modal-title">{editing ? 'Modificar paciente' : 'Nuevo paciente'}</h2><p className="modal-subtitle">Completa los datos personales del paciente.</p><label>DNI<input className="form-input" value={form.document_number} onChange={e => setForm({...form, document_number:e.target.value})} required /></label><label>Apellido<input className="form-input" value={form.last_name} onChange={e => setForm({...form, last_name:e.target.value})} required /></label><label>Nombre<input className="form-input" value={form.first_name} onChange={e => setForm({...form, first_name:e.target.value})} required /></label><label>Teléfono<input className="form-input" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></label><label>Fecha de nacimiento<input type="date" className="form-input" value={form.birth_date} onChange={e => setForm({...form, birth_date:e.target.value})} /></label><div className="modal-actions"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" type="submit">Guardar paciente</button></div></form></div>}
  </div>;
}
