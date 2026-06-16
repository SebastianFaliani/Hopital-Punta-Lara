import {
  useEffect,
  useMemo,
  useState
} from 'react';

import type {
  FormEvent
} from 'react';

import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';

type Patient = {
  id: number;
  first_name: string;
  last_name: string;
  document: string | null;
  birth_date: string | null;
  phone: string | null;
  target_weight_kg: number | string | null;
  nutritional_diagnosis: string | null;
  meal_plan: string | null;
  physical_activity: string | null;
  has_diabetes: boolean | number;
  has_hypertension: boolean | number;
  has_high_cholesterol: boolean | number;
  medical_history: string | null;
  notes: string | null;
  is_active: boolean | number;
  last_control_date: string | null;
  last_weight_kg: number | string | null;
  last_height_m: number | string | null;
  last_bmi: number | string | null;
  last_waist_circumference_cm: number | string | null;
  first_weight_kg: number | string | null;
  controls_count: number | string;
  bmi_classification: string | null;
  weight_change_kg: number | string | null;
};

type Control = {
  id: number;
  control_date: string;
  weight_kg: number | string;
  height_m: number | string;
  bmi: number | string;
  waist_circumference_cm: number | string | null;
  notes: string | null;
  bmi_classification: string;
};

type Stats = {
  total_patients: number;
  active_patients: number;
  controls_this_month: number;
  average_last_bmi: number | null;
  patients_without_recent_control: number;
};

const emptyPatientForm = {
  first_name: '',
  last_name: '',
  document: '',
  birth_date: '',
  phone: '',
  target_weight_kg: '',
  nutritional_diagnosis: '',
  meal_plan: '',
  physical_activity: '',
  has_diabetes: false,
  has_hypertension: false,
  has_high_cholesterol: false,
  medical_history: '',
  notes: '',
  is_active: true
};

const emptyControlForm = {
  control_date:
    new Date().toISOString().slice(0, 10),
  weight_kg: '',
  height_m: '',
  waist_circumference_cm: '',
  notes: ''
};

const emptyStats = {
  total_patients: 0,
  active_patients: 0,
  controls_this_month: 0,
  average_last_bmi: null,
  patients_without_recent_control: 0
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

function formatDate(
  value?: string | null
) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString(
    'es-AR',
    {
      timeZone: 'UTC'
    }
  );
}

function numeric(
  value: number | string | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  return Number(value);
}

function formatNumber(
  value: number | string | null | undefined,
  suffix = ''
) {
  const number =
    numeric(value);

  if (number === null || Number.isNaN(number)) {
    return '-';
  }

  return `${number.toFixed(2)}${suffix}`;
}

function formatWeightProgress(
  delta: number
) {
  if (delta === 0) {
    return '0.00 kg acumulados';
  }

  return `${delta > 0 ? '+' : '-'} ${Math.abs(delta).toFixed(2)} kg acumulados`;
}

function calculateBmiPreview(
  weight: string,
  height: string
) {
  const weightValue =
    Number(weight);

  const heightValue =
    Number(height);

  if (
    !weightValue ||
    !heightValue ||
    heightValue <= 0
  ) {
    return '';
  }

  return (
    weightValue /
    (heightValue * heightValue)
  ).toFixed(2);
}

function getSeries(
  controls: Control[],
  key: 'weight_kg' | 'bmi' | 'waist_circumference_cm'
) {
  return controls
    .map((control) => ({
      label:
        formatDate(control.control_date),
      value:
        numeric(control[key])
    }))
    .filter((item) =>
      item.value !== null &&
      !Number.isNaN(item.value)
    ) as Array<{
      label: string;
      value: number;
    }>;
}

function MiniLineChart({
  title,
  data,
  color,
  yMin,
  yMax,
  width = 560,
  height = 300,
  expanded = false,
  onOpen
}: {
  title: string;
  data: Array<{
    label: string;
    value: number;
  }>;
  color: string;
  yMin?: number;
  yMax?: number;
  width?: number;
  height?: number;
  expanded?: boolean;
  onOpen?: () => void;
}) {
  const paddingLeft = 58;
  const paddingRight = 18;
  const paddingTop = 22;
  const paddingBottom = 44;

  const values =
    data.map((item) => item.value);

  const min =
    yMin ??
    Math.max(
      0,
      values.length
        ? Math.min(...values) - 2
        : 0
    );

  const max =
    yMax ??
    (
      values.length
        ? Math.max(...values) + 2
        : 1
    );

  const range =
    Math.max(1, max - min);

  const yTicks =
    Array.from(
      { length: 4 },
      (_, index) => {
        const value =
          min + (range * index) / 3;

        const y =
          height -
          paddingBottom -
          ((value - min) / range) *
            (height - paddingTop - paddingBottom);

        return {
          value,
          y
        };
      }
    );

  const xLabelIndexes =
    data.length <= 4
      ? data.map((_, index) => index)
      : Array.from(
        new Set([
          0,
          Math.floor((data.length - 1) / 2),
          data.length - 1
        ])
      );

  const points =
    data.map((item, index) => {
      const x =
        data.length === 1
          ? width / 2
          : paddingLeft +
            (index *
              (width - paddingLeft - paddingRight)) /
              (data.length - 1);

      const y =
        height -
        paddingBottom -
        ((item.value - min) / range) *
          (height - paddingTop - paddingBottom);

      return {
        ...item,
        x,
        y
      };
    });

  const polyline =
    points
      .map((point) =>
        `${point.x},${point.y}`
      )
      .join(' ');

  return (
    <div
      className={
        expanded
          ? 'nutrition-chart nutrition-chart-expanded'
          : 'nutrition-chart'
      }
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (
          onOpen &&
          (
            event.key === 'Enter' ||
            event.key === ' '
          )
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="nutrition-chart-title">
        <strong>{title}</strong>
        <span>
          {expanded
            ? `${data.length} control(es)`
            : 'Click para ampliar'}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="empty-state">
          Sin datos suficientes.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
        >
          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="#eef2f7"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
              >
                {tick.value.toFixed(1)}
              </text>
            </g>
          ))}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
              />
              <text
                x={point.x}
                y={point.y - 9}
                textAnchor="middle"
                fontSize="11"
                fill="#334155"
              >
                {point.value.toFixed(1)}
              </text>
              {xLabelIndexes.includes(index) && (
                <text
                  x={point.x}
                  y={height - 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                >
                  {point.label.slice(0, 5)}
                </text>
              )}
            </g>
          ))}
          <text
            x={paddingLeft}
            y={height - 4}
            textAnchor="middle"
            fontSize="10"
            fill="#475569"
          >
            Fecha
          </text>
          <text
            x={12}
            y={paddingTop}
            textAnchor="start"
            fontSize="10"
            fill="#475569"
          >
            Valor
          </text>
        </svg>
      )}
    </div>
  );
}

export default function NutritionPage() {
  const { user } =
    useAuth();

  const canView =
    hasPermission(
      user,
      'nutrition.view',
      ['admin', 'dir', 'nutri']
    );

  const canEdit =
    hasPermission(
      user,
      'nutrition.manage',
      ['admin', 'nutri']
    );

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [stats, setStats] =
    useState<Stats>(emptyStats);

  const [filters, setFilters] =
    useState({
      search: '',
      status: 'activo'
    });

  const [selectedPatient, setSelectedPatient] =
    useState<Patient | null>(null);

  const [controls, setControls] =
    useState<Control[]>([]);

  const [patientForm, setPatientForm] =
    useState(emptyPatientForm);

  const [controlForm, setControlForm] =
    useState(emptyControlForm);

  const [editingPatient, setEditingPatient] =
    useState<Patient | null>(null);

  const [editingControl, setEditingControl] =
    useState<Control | null>(null);

  const [showPatientForm, setShowPatientForm] =
    useState(false);

  const [showControlForm, setShowControlForm] =
    useState(false);

  const [expandedChart, setExpandedChart] =
    useState<{
      title: string;
      data: Array<{
        label: string;
        value: number;
      }>;
      color: string;
    } | null>(null);

  const [loading, setLoading] =
    useState(false);

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      if (filters.search) {
        params.set('search', filters.search);
      }

      if (filters.status !== 'todos') {
        params.set('status', filters.status);
      }

      const query =
        params.toString();

      return query
        ? `?${query}`
        : '';
    }, [filters]);

  async function loadPatients() {
    const response =
      await apiFetch(
        `/nutrition${queryString}`
      );

    setPatients(response.data);
    setStats({
      ...emptyStats,
      ...response.stats
    });

    if (selectedPatient) {
      const fresh =
        response.data.find(
          (item: Patient) =>
            item.id === selectedPatient.id
        );

      if (fresh) {
        setSelectedPatient(fresh);
      }
    }
  }

  async function loadControls(
    patient: Patient
  ) {
    const response =
      await apiFetch(
        `/nutrition/${patient.id}/controls`
      );

    setSelectedPatient({
      ...patient,
      ...response.data.patient
    });
    setControls(response.data.controls);
  }

  useEffect(() => {
    if (canView) {
      loadPatients().catch((error) =>
        showSystemAlert(error.message)
      );
    }
  }, [queryString, canView]);

  function openCreatePatient() {
    setEditingPatient(null);
    setPatientForm(emptyPatientForm);
    setShowPatientForm(true);
  }

  function openEditPatient(
    patient: Patient
  ) {
    setEditingPatient(patient);
    setPatientForm({
      first_name: patient.first_name || '',
      last_name: patient.last_name || '',
      document: patient.document || '',
      birth_date:
        patient.birth_date?.slice(0, 10) || '',
      phone: patient.phone || '',
      target_weight_kg:
        String(patient.target_weight_kg || ''),
      nutritional_diagnosis:
        patient.nutritional_diagnosis || '',
      meal_plan:
        patient.meal_plan || '',
      physical_activity:
        patient.physical_activity || '',
      has_diabetes:
        Boolean(patient.has_diabetes),
      has_hypertension:
        Boolean(patient.has_hypertension),
      has_high_cholesterol:
        Boolean(patient.has_high_cholesterol),
      medical_history:
        patient.medical_history || '',
      notes: patient.notes || '',
      is_active: Boolean(patient.is_active)
    });
    setShowPatientForm(true);
  }

  function openCreateControl() {
    setEditingControl(null);
    setControlForm(emptyControlForm);
    setShowControlForm(true);
  }

  function openEditControl(
    control: Control
  ) {
    setEditingControl(control);
    setControlForm({
      control_date:
        control.control_date.slice(0, 10),
      weight_kg:
        String(control.weight_kg || ''),
      height_m:
        String(control.height_m || ''),
      waist_circumference_cm:
        String(
          control.waist_circumference_cm || ''
        ),
      notes: control.notes || ''
    });
    setShowControlForm(true);
  }

  async function handlePatientSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !patientForm.first_name ||
      !patientForm.last_name
    ) {
      showSystemAlert(
        'Debe cargar nombre y apellido'
      );
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        editingPatient
          ? `/nutrition/${editingPatient.id}`
          : '/nutrition',
        {
          method: editingPatient
            ? 'PUT'
            : 'POST',
          body: JSON.stringify(patientForm)
        }
      );

      setShowPatientForm(false);
      setEditingPatient(null);
      await loadPatients();
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleControlSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!selectedPatient) {
      return;
    }

    if (
      !controlForm.control_date ||
      !controlForm.weight_kg ||
      !controlForm.height_m
    ) {
      showSystemAlert(
        'Debe cargar fecha, peso y talla'
      );
      return;
    }

    try {
      setLoading(true);

      await apiFetch(
        editingControl
          ? `/nutrition/${selectedPatient.id}/controls/${editingControl.id}`
          : `/nutrition/${selectedPatient.id}/controls`,
        {
          method: editingControl
            ? 'PUT'
            : 'POST',
          body: JSON.stringify(controlForm)
        }
      );

      setShowControlForm(false);
      setEditingControl(null);
      await Promise.all([
        loadPatients(),
        loadControls(selectedPatient)
      ]);
    } catch (error: any) {
      showSystemAlert(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return <h2>No autorizado</h2>;
  }

  const lastControl =
    controls[controls.length - 1];

  const previousControl =
    controls[controls.length - 2];

  const firstControl =
    controls[0];

  const lastWeight =
    numeric(lastControl?.weight_kg);

  const previousWeight =
    numeric(previousControl?.weight_kg);

  const firstWeight =
    numeric(firstControl?.weight_kg);

  const weightDelta =
    lastWeight !== null &&
    previousWeight !== null
      ? Number(
        (lastWeight - previousWeight)
          .toFixed(2)
      )
      : null;

  const initialWeightDelta =
    lastWeight !== null &&
    firstWeight !== null &&
    controls.length > 1
      ? Number(
        (lastWeight - firstWeight)
          .toFixed(2)
      )
      : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Nutricion
          </h1>
          <p className="page-subtitle">
            Seguimiento nutricional, controles e indicadores.
          </p>
        </div>

        {canEdit && (
          <button
            className="btn-primary"
            type="button"
            onClick={openCreatePatient}
          >
            + Nuevo paciente
          </button>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Pacientes</h3>
          <p>{stats.total_patients || 0}</p>
          <span>{stats.active_patients || 0} activos</span>
        </div>

        <div className="dashboard-card">
          <h3>Controles del mes</h3>
          <p>{stats.controls_this_month || 0}</p>
          <span>Registrados este mes</span>
        </div>

        <div className="dashboard-card">
          <h3>IMC promedio</h3>
          <p>
            {stats.average_last_bmi
              ? Number(stats.average_last_bmi).toFixed(2)
              : '-'}
          </p>
          <span>Ultimo control por paciente</span>
        </div>

        <div className="dashboard-card">
          <h3>Sin control reciente</h3>
          <p>
            {stats.patients_without_recent_control || 0}
          </p>
          <span>Activos sin control hace 45 dias</span>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          placeholder="Buscar nombre, apellido o DNI"
          value={filters.search}
          onChange={(event) =>
            setFilters({
              ...filters,
              search: event.target.value
            })
          }
        />

        <select
          className="form-input"
          value={filters.status}
          onChange={(event) =>
            setFilters({
              ...filters,
              status: event.target.value
            })
          }
        >
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="nutrition-layout">
        <div className="table-container nutrition-patient-list">
          <table className="data-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Ultimo control</th>
                <th>IMC</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className={
                    selectedPatient?.id === patient.id
                      ? 'selected-row'
                      : ''
                  }
                >
                  <td>
                    <strong>
                      {patient.last_name}, {patient.first_name}
                    </strong>
                    <br />
                    <span>{patient.document || '-'}</span>
                  </td>
                  <td>
                    {formatDate(patient.last_control_date)}
                    <br />
                    <span>
                      {patient.controls_count || 0} control(es)
                    </span>
                  </td>
                  <td>
                    {formatNumber(patient.last_bmi)}
                    <br />
                    <span>
                      {patient.bmi_classification || '-'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        loadControls(patient)
                      }
                    >
                      Ver ficha
                    </button>
                  </td>
                </tr>
              ))}

              {patients.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    No hay pacientes para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <section className="nutrition-detail-panel">
          {!selectedPatient ? (
            <div className="empty-state">
              Selecciona un paciente para ver su seguimiento.
            </div>
          ) : (
            <>
              <div className="nutrition-detail-header">
                <div>
                  <h2>
                    {selectedPatient.last_name}, {selectedPatient.first_name}
                  </h2>
                  <p>
                    DNI {selectedPatient.document || '-'} - Tel {selectedPatient.phone || '-'}
                  </p>
                </div>

                {canEdit && (
                  <div className="nutrition-actions">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        openEditPatient(selectedPatient)
                      }
                    >
                      Editar paciente
                    </button>
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={openCreateControl}
                    >
                      + Nuevo control
                    </button>
                  </div>
                )}
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Ultimo peso</h3>
                  <p>
                    {formatNumber(lastControl?.weight_kg, ' kg')}
                  </p>
                  <span>
                    {weightDelta !== null
                      ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg vs anterior`
                      : 'Sin comparacion'}
                  </span>
                  <span>
                    {initialWeightDelta !== null
                      ? formatWeightProgress(initialWeightDelta)
                      : controls.length > 0
                        ? 'Primer control'
                        : 'Sin peso inicial'}
                  </span>
                </div>

                <div className="dashboard-card">
                  <h3>IMC</h3>
                  <p>{formatNumber(lastControl?.bmi)}</p>
                  <span>
                    {lastControl?.bmi_classification || '-'}
                  </span>
                </div>

                <div className="dashboard-card">
                  <h3>Cintura</h3>
                  <p>
                    {formatNumber(
                      lastControl?.waist_circumference_cm,
                      ' cm'
                    )}
                  </p>
                  <span>Ultimo control</span>
                </div>
              </div>

              <div className="nutrition-profile-grid">
                <div className="nutrition-profile-item">
                  <strong>Objetivo de peso</strong>
                  <span>
                    {formatNumber(
                      selectedPatient.target_weight_kg,
                      ' kg'
                    )}
                  </span>
                </div>

                <div className="nutrition-profile-item">
                  <strong>Diagnostico nutricional</strong>
                  <span>
                    {selectedPatient.nutritional_diagnosis || '-'}
                  </span>
                </div>

                <div className="nutrition-profile-item">
                  <strong>Actividad fisica</strong>
                  <span>
                    {selectedPatient.physical_activity || '-'}
                  </span>
                </div>

                <div className="nutrition-profile-item">
                  <strong>Antecedentes</strong>
                  <span>
                    {[
                      selectedPatient.has_diabetes
                        ? 'Diabetes'
                        : '',
                      selectedPatient.has_hypertension
                        ? 'Hipertension'
                        : '',
                      selectedPatient.has_high_cholesterol
                        ? 'Colesterol'
                        : ''
                    ]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </span>
                </div>

                <div className="nutrition-profile-item nutrition-profile-wide">
                  <strong>Plan alimentario</strong>
                  <span>{selectedPatient.meal_plan || '-'}</span>
                </div>

                <div className="nutrition-profile-item nutrition-profile-wide">
                  <strong>Otros antecedentes</strong>
                  <span>{selectedPatient.medical_history || '-'}</span>
                </div>
              </div>

              <div className="nutrition-charts-grid">
                <MiniLineChart
                  title="Peso por fecha"
                  data={getSeries(controls, 'weight_kg')}
                  color="#2563eb"
                  onOpen={() =>
                    setExpandedChart({
                      title: 'Peso por fecha',
                      data: getSeries(controls, 'weight_kg'),
                      color: '#2563eb'
                    })
                  }
                />
                <MiniLineChart
                  title="IMC por fecha"
                  data={getSeries(controls, 'bmi')}
                  color="#16a34a"
                  onOpen={() =>
                    setExpandedChart({
                      title: 'IMC por fecha',
                      data: getSeries(controls, 'bmi'),
                      color: '#16a34a'
                    })
                  }
                />
                <MiniLineChart
                  title="Cintura por fecha"
                  data={getSeries(controls, 'waist_circumference_cm')}
                  color="#f97316"
                  onOpen={() =>
                    setExpandedChart({
                      title: 'Cintura por fecha',
                      data: getSeries(controls, 'waist_circumference_cm'),
                      color: '#f97316'
                    })
                  }
                />
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Peso</th>
                      <th>Talla</th>
                      <th>IMC</th>
                      <th>Cintura</th>
                      <th>Observaciones</th>
                      {canEdit && <th>Accion</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...controls]
                      .reverse()
                      .map((control) => (
                        <tr key={control.id}>
                          <td>{formatDate(control.control_date)}</td>
                          <td>{formatNumber(control.weight_kg, ' kg')}</td>
                          <td>{formatNumber(control.height_m, ' m')}</td>
                          <td>
                            {formatNumber(control.bmi)}
                            <br />
                            <span>{control.bmi_classification}</span>
                          </td>
                          <td>
                            {formatNumber(
                              control.waist_circumference_cm,
                              ' cm'
                            )}
                          </td>
                          <td>{control.notes || '-'}</td>
                          {canEdit && (
                            <td>
                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() =>
                                  openEditControl(control)
                                }
                              >
                                Editar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                    {controls.length === 0 && (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6}>
                          Este paciente todavia no tiene controles.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {expandedChart && (
        <div className="modal-overlay">
          <div className="modal-content nutrition-chart-modal">
            <button
              className="modal-close-button"
              type="button"
              onClick={() =>
                setExpandedChart(null)
              }
              aria-label="Cerrar"
            >
              x
            </button>

            <MiniLineChart
              title={expandedChart.title}
              data={expandedChart.data}
              color={expandedChart.color}
              width={980}
              height={520}
              expanded
            />
          </div>
        </div>
      )}

      {showPatientForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <button
              className="modal-close-button"
              type="button"
              onClick={() =>
                setShowPatientForm(false)
              }
              aria-label="Cerrar"
            >
              x
            </button>

            <h2 className="modal-title">
              {editingPatient
                ? 'Editar paciente'
                : 'Nuevo paciente'}
            </h2>

            <form
              className="management-form"
              onSubmit={handlePatientSubmit}
            >
              <label className="form-field">
                <span>Nombre</span>
                <input
                  className="form-input"
                  value={patientForm.first_name}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      first_name: event.target.value
                    })
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Apellido</span>
                <input
                  className="form-input"
                  value={patientForm.last_name}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      last_name: event.target.value
                    })
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>DNI</span>
                <input
                  className="form-input"
                  value={patientForm.document}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      document: event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Fecha de nacimiento</span>
                <input
                  className="form-input"
                  type="date"
                  value={patientForm.birth_date}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      birth_date: event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Telefono</span>
                <input
                  className="form-input"
                  value={patientForm.phone}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      phone: event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Objetivo de peso kg</span>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="0.01"
                  value={patientForm.target_weight_kg}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      target_weight_kg: event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field transfer-field-full">
                <span>Diagnostico nutricional</span>
                <textarea
                  className="form-input"
                  rows={2}
                  value={patientForm.nutritional_diagnosis}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      nutritional_diagnosis: event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field transfer-field-full">
                <span>Plan alimentario</span>
                <textarea
                  className="form-input"
                  rows={3}
                  value={patientForm.meal_plan}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      meal_plan: event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field transfer-field-full">
                <span>Actividad fisica</span>
                <textarea
                  className="form-input"
                  rows={2}
                  value={patientForm.physical_activity}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      physical_activity: event.target.value
                    })
                  }
                />
              </label>

              <div className="nutrition-history-checks transfer-field-full">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={patientForm.has_diabetes}
                    onChange={(event) =>
                      setPatientForm({
                        ...patientForm,
                        has_diabetes: event.target.checked
                      })
                    }
                  />
                  Diabetes
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={patientForm.has_hypertension}
                    onChange={(event) =>
                      setPatientForm({
                        ...patientForm,
                        has_hypertension: event.target.checked
                      })
                    }
                  />
                  Hipertension
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={patientForm.has_high_cholesterol}
                    onChange={(event) =>
                      setPatientForm({
                        ...patientForm,
                        has_high_cholesterol: event.target.checked
                      })
                    }
                  />
                  Colesterol
                </label>
              </div>

              <label className="form-field transfer-field-full">
                <span>Otros antecedentes</span>
                <textarea
                  className="form-input"
                  rows={2}
                  value={patientForm.medical_history}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      medical_history: event.target.value
                    })
                  }
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={patientForm.is_active}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      is_active: event.target.checked
                    })
                  }
                />
                Paciente activo
              </label>

              <label className="form-field transfer-field-full">
                <span>Observaciones</span>
                <textarea
                  className="form-input"
                  rows={3}
                  value={patientForm.notes}
                  onChange={(event) =>
                    setPatientForm({
                      ...patientForm,
                      notes: event.target.value
                    })
                  }
                />
              </label>

              <div className="modal-actions transfer-field-full">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() =>
                    setShowPatientForm(false)
                  }
                >
                  Cancelar
                </button>
                <button
                  className="btn-success"
                  type="submit"
                  disabled={loading}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showControlForm && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <button
              className="modal-close-button"
              type="button"
              onClick={() =>
                setShowControlForm(false)
              }
              aria-label="Cerrar"
            >
              x
            </button>

            <h2 className="modal-title">
              {editingControl
                ? 'Editar control'
                : 'Nuevo control'}
            </h2>

            <form
              className="management-form"
              onSubmit={handleControlSubmit}
            >
              <label className="form-field">
                <span>Fecha</span>
                <input
                  className="form-input"
                  type="date"
                  value={controlForm.control_date}
                  onChange={(event) =>
                    setControlForm({
                      ...controlForm,
                      control_date: event.target.value
                    })
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Peso kg</span>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="0.01"
                  value={controlForm.weight_kg}
                  onChange={(event) =>
                    setControlForm({
                      ...controlForm,
                      weight_kg: event.target.value
                    })
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Talla m</span>
                <input
                  className="form-input"
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={controlForm.height_m}
                  onChange={(event) =>
                    setControlForm({
                      ...controlForm,
                      height_m: event.target.value
                    })
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>IMC automatico</span>
                <input
                  className="form-input"
                  value={calculateBmiPreview(
                    controlForm.weight_kg,
                    controlForm.height_m
                  )}
                  readOnly
                />
              </label>

              <label className="form-field">
                <span>Circ. cintura cm</span>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="0.01"
                  value={controlForm.waist_circumference_cm}
                  onChange={(event) =>
                    setControlForm({
                      ...controlForm,
                      waist_circumference_cm:
                        event.target.value
                    })
                  }
                />
              </label>

              <label className="form-field transfer-field-full">
                <span>Observaciones</span>
                <textarea
                  className="form-input"
                  rows={3}
                  value={controlForm.notes}
                  onChange={(event) =>
                    setControlForm({
                      ...controlForm,
                      notes: event.target.value
                    })
                  }
                />
              </label>

              <div className="modal-actions transfer-field-full">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() =>
                    setShowControlForm(false)
                  }
                >
                  Cancelar
                </button>
                <button
                  className="btn-success"
                  type="submit"
                  disabled={loading}
                >
                  Guardar control
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
