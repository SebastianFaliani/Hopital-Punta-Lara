import {
  useMemo,
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { useAuth }
  from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';

import TransfersNav
  from '../components/transfers/TransfersNav';

type Driver = {
  id: number;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

type Ambulance = {
  id: number;
  internal_code: string;
  plate: string;
  is_active: boolean;
};

type Shift = {
  id: number;
  driver_id: number;
  ambulance_id: number;
  start_datetime: string;
  end_datetime: string;
  status: string;
  driver_name: string;
  ambulance_code: string;
  ambulance_plate: string;
};

const currentMonth =
  (() => {
    const date =
      new Date();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  })();

const emptyBulkForm = {
  driver_id: '',
  ambulance_id: '',
  month: currentMonth,
  morning_days: [] as number[],
  afternoon_days: [] as number[],
  morning_start_time: '08:00',
  morning_end_time: '15:00',
  afternoon_start_time: '15:00',
  afternoon_end_time: '21:00'
};

function formatDateTime(
  value: string
) {

  const normalized =
    String(value)
      .replace(' ', 'T');

  const [
    datePart,
    timePart = ''
  ] = normalized.split('T');

  const [
    year,
    month,
    day
  ] = datePart.split('-');

  const [
    hour = '00',
    minute = '00'
  ] = timePart.split(':');

  return `${day}-${month}-${year} ${hour}:${minute}`;
}

export default function DriverShiftsPage() {
  const { user } =
    useAuth();

  const canEdit =
    hasPermission(
      user,
      'transfers.manage',
      ['admin', 'user']
    );

  const [shifts, setShifts] =
    useState<Shift[]>([]);

  const [drivers, setDrivers] =
    useState<Driver[]>([]);

  const [ambulances, setAmbulances] =
    useState<Ambulance[]>([]);

  const [bulkForm, setBulkForm] =
    useState(emptyBulkForm);

  const [error, setError] =
    useState('');

  const [filters, setFilters] =
    useState({
      driver_id: '',
      ambulance_id: '',
      status: '',
      date_from: '',
      date_to: ''
    });

  const filteredShifts =
    useMemo(
      () =>
        shifts.filter((shift) => {
          const shiftDate =
            String(shift.start_datetime)
              .slice(0, 10);

          return (
            (
              !filters.driver_id ||
              String(shift.driver_id) ===
                filters.driver_id
            ) &&
            (
              !filters.ambulance_id ||
              String(shift.ambulance_id) ===
                filters.ambulance_id
            ) &&
            (
              !filters.status ||
              shift.status === filters.status
            ) &&
            (
              !filters.date_from ||
              shiftDate >= filters.date_from
            ) &&
            (
              !filters.date_to ||
              shiftDate <= filters.date_to
            )
          );
        }),
      [shifts, filters]
    );

  const selectedDriverMonthSummary =
    useMemo(() => {
      if (
        !bulkForm.driver_id ||
        !bulkForm.month
      ) {
        return [];
      }

      const summary =
        new Map<
          number,
          {
            ambulance_id: number;
            ambulance_label: string;
            count: number;
          }
        >();

      shifts.forEach((shift) => {
        if (
          String(shift.driver_id) !==
            bulkForm.driver_id ||
          String(shift.start_datetime)
            .slice(0, 7) !== bulkForm.month
        ) {
          return;
        }

        const current =
          summary.get(shift.ambulance_id) || {
            ambulance_id: shift.ambulance_id,
            ambulance_label:
              `${shift.ambulance_code} - ${shift.ambulance_plate}`,
            count: 0
          };

        current.count += 1;
        summary.set(
          shift.ambulance_id,
          current
        );
      });

      return Array.from(summary.values());
    }, [
      bulkForm.driver_id,
      bulkForm.month,
      shifts
    ]);

  async function loadData() {

    try {

      const [
        shiftRes,
        driverRes,
        ambulanceRes
      ] = await Promise.all([
        apiFetch('/driver-shifts'),
        apiFetch('/drivers'),
        apiFetch('/ambulances')
      ]);

      setShifts(shiftRes.data);
      setDrivers(driverRes.data);
      setAmbulances(ambulanceRes.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function daysInMonth(
    month: string
  ) {
    const [year, monthNumber] =
      month.split('-').map(Number);

    return new Date(
      year,
      monthNumber,
      0
    ).getDate();
  }

  function toggleBulkDay(
    field:
      'morning_days' |
      'afternoon_days',
    day: number
  ) {
    setBulkForm((current) => ({
      ...current,
      [field]:
        current[field].includes(day)
          ? current[field].filter(
            (item) => item !== day
          )
          : [...current[field], day]
            .sort((a, b) => a - b)
    }));
  }

  async function handleBulkSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    await apiFetch(
      '/driver-shifts/bulk',
      {
        method: 'POST',
        body: JSON.stringify({
          ...bulkForm,
          driver_id:
            Number(bulkForm.driver_id),
          ambulance_id:
            Number(bulkForm.ambulance_id),
          sync_existing: true
        })
      }
    );

    setBulkForm({
      ...bulkForm,
      driver_id: bulkForm.driver_id,
      ambulance_id:
        bulkForm.ambulance_id,
      month: bulkForm.month,
      morning_days: [],
      afternoon_days: []
    });

    loadData();
  }

  useEffect(() => {

    loadData();

  }, []);

  useEffect(() => {
    if (
      !bulkForm.driver_id ||
      !bulkForm.ambulance_id ||
      !bulkForm.month ||
      shifts.length === 0
    ) {
      return;
    }

    const morningDays: number[] = [];
    const afternoonDays: number[] = [];

    shifts.forEach((shift) => {
      if (
        String(shift.driver_id) !==
          bulkForm.driver_id ||
        String(shift.ambulance_id) !==
          bulkForm.ambulance_id ||
        String(shift.start_datetime)
          .slice(0, 7) !== bulkForm.month
      ) {
        return;
      }

      const day =
        Number(
          String(shift.start_datetime)
            .slice(8, 10)
        );

      const startTime =
        String(shift.start_datetime)
          .slice(11, 16);

      if (
        startTime ===
        bulkForm.morning_start_time
      ) {
        morningDays.push(day);
      }

      if (
        startTime ===
        bulkForm.afternoon_start_time
      ) {
        afternoonDays.push(day);
      }
    });

    setBulkForm((current) => ({
      ...current,
      morning_days:
        Array.from(new Set(morningDays))
          .sort((a, b) => a - b),
      afternoon_days:
        Array.from(new Set(afternoonDays))
          .sort((a, b) => a - b)
    }));
  }, [
    bulkForm.driver_id,
    bulkForm.ambulance_id,
    bulkForm.month,
    bulkForm.morning_start_time,
    bulkForm.afternoon_start_time,
    shifts
  ]);

  return (

    <div>

      <TransfersNav />

      

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver las guardias sin modificar datos.
        </p>
      )}

      {canEdit && (
        <>
          <form
            className="bulk-shift-form"
            onSubmit={handleBulkSubmit}
          >
            <div className="bulk-shift-header">
              <label className="form-field">
                <span>Chofer</span>
                <select
                  className="form-input"
                  value={bulkForm.driver_id}
                  onChange={(event) =>
                    setBulkForm({
                      ...bulkForm,
                      driver_id:
                        event.target.value,
                      morning_days: [],
                      afternoon_days: []
                    })
                  }
                  required
                >
                  <option value="">Seleccionar</option>
                  {drivers
                    .filter((item) => item.is_active)
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.first_name} {item.last_name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="form-field">
                <span>Ambulancia</span>
                <select
                  className="form-input"
                  value={bulkForm.ambulance_id}
                  onChange={(event) =>
                    setBulkForm({
                      ...bulkForm,
                      ambulance_id:
                        event.target.value,
                      morning_days: [],
                      afternoon_days: []
                    })
                  }
                  required
                >
                  <option value="">Seleccionar</option>
                  {ambulances
                    .filter((item) => item.is_active)
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.internal_code} - {item.plate}
                      </option>
                    ))}
                </select>
              </label>

              <label className="form-field">
                <span>Mes</span>
                <input
                  className="form-input"
                  type="month"
                  value={bulkForm.month}
                  onChange={(event) =>
                    setBulkForm({
                      ...bulkForm,
                      month: event.target.value,
                      morning_days: [],
                      afternoon_days: []
                    })
                  }
                  required
                />
              </label>
            </div>

            {selectedDriverMonthSummary.length > 0 && (
              <div className="bulk-shift-summary">
                <span>
                  Guardias ya cargadas para este chofer en el mes:
                </span>
                {selectedDriverMonthSummary.map((item) => (
                  <button
                    key={item.ambulance_id}
                    className={
                      String(item.ambulance_id) ===
                        bulkForm.ambulance_id
                        ? 'bulk-shift-summary-chip bulk-shift-summary-chip-active'
                        : 'bulk-shift-summary-chip'
                    }
                    type="button"
                    onClick={() =>
                      setBulkForm({
                        ...bulkForm,
                        ambulance_id:
                          String(item.ambulance_id),
                        morning_days: [],
                        afternoon_days: []
                      })
                    }
                  >
                    {item.ambulance_label}
                    {' · '}
                    {item.count} guardias
                  </button>
                ))}
              </div>
            )}

            {([
              [
                'morning_days',
                'Turno mañana',
                'morning_start_time',
                'morning_end_time'
              ],
              [
                'afternoon_days',
                'Turno tarde (sabados, domingos y feriados hasta 22:00)',
                'afternoon_start_time',
                'afternoon_end_time'
              ]
            ] as const).map((group) => (
              <section
                className="bulk-shift-group"
                key={group[0]}
              >
                <div className="bulk-shift-group-heading">
                  <strong>{group[1]}</strong>
                  <input
                    className="form-input"
                    type="time"
                    value={bulkForm[group[2]]}
                    onChange={(event) =>
                      setBulkForm({
                        ...bulkForm,
                        [group[2]]:
                          event.target.value
                      })
                    }
                  />
                  <span>a</span>
                  <input
                    className="form-input"
                    type="time"
                    value={bulkForm[group[3]]}
                    onChange={(event) =>
                      setBulkForm({
                        ...bulkForm,
                        [group[3]]:
                          event.target.value
                      })
                    }
                  />
                </div>

                <div className="bulk-shift-days">
                  {Array.from(
                    {
                      length:
                        daysInMonth(
                          bulkForm.month
                        )
                    },
                    (_, index) => index + 1
                  ).map((day) => (
                    <button
                      className={
                        bulkForm[group[0]]
                          .includes(day)
                          ? 'bulk-shift-day bulk-shift-day-selected'
                          : 'bulk-shift-day'
                      }
                      type="button"
                      key={day}
                      onClick={() =>
                        toggleBulkDay(
                          group[0],
                          day
                        )
                      }
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <div className="bulk-shift-footer">
              <span>
                {bulkForm.morning_days.length +
                  bulkForm.afternoon_days.length}
                {' '}guardias seleccionadas
              </span>
              <button
                className="btn-success"
                type="submit"
              >
                Guardar guardias del mes
              </button>
            </div>
          </form>
        </>
      )}

      {
        error && (
          <p className="auth-error">
            {error}
          </p>
        )
      }

      <div className="shift-filter-panel">
        <select
          className="form-input"
          value={filters.driver_id}
          onChange={(event) =>
            setFilters({
              ...filters,
              driver_id: event.target.value
            })
          }
        >
          <option value="">
            Todos los choferes
          </option>
          {drivers.map((driver) => (
            <option
              key={driver.id}
              value={driver.id}
            >
              {driver.first_name} {driver.last_name}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filters.ambulance_id}
          onChange={(event) =>
            setFilters({
              ...filters,
              ambulance_id: event.target.value
            })
          }
        >
          <option value="">
            Todas las ambulancias
          </option>
          {ambulances.map((ambulance) => (
            <option
              key={ambulance.id}
              value={ambulance.id}
            >
              {ambulance.internal_code} - {ambulance.plate}
            </option>
          ))}
        </select>

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
          <option value="">
            Todos los estados
          </option>
          <option value="programada">
            Programada
          </option>
          <option value="activa">
            Activa
          </option>
          <option value="finalizada">
            Finalizada
          </option>
        </select>

        <label className="form-field">
          <span>Desde</span>
          <input
            className="form-input"
            type="date"
            value={filters.date_from}
            onChange={(event) =>
              setFilters({
                ...filters,
                date_from: event.target.value
              })
            }
          />
        </label>

        <label className="form-field">
          <span>Hasta</span>
          <input
            className="form-input"
            type="date"
            value={filters.date_to}
            onChange={(event) =>
              setFilters({
                ...filters,
                date_to: event.target.value
              })
            }
          />
        </label>

        <button
          className="btn-secondary"
          type="button"
          onClick={() =>
            setFilters({
              driver_id: '',
              ambulance_id: '',
              status: '',
              date_from: '',
              date_to: ''
            })
          }
        >
          Limpiar filtros
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Chofer</th>
              <th>Ambulancia</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredShifts.map((shift) => (
              <tr key={shift.id}>
                <td>{shift.driver_name}</td>
                <td>
                  {shift.ambulance_code} - {shift.ambulance_plate}
                </td>
                <td>
                  {formatDateTime(
                    shift.start_datetime
                  )}
                </td>
                <td>
                  {formatDateTime(
                    shift.end_datetime
                  )}
                </td>
                <td>{shift.status}</td>
              </tr>
            ))}

            {filteredShifts.length === 0 && (
              <tr>
                <td colSpan={5}>
                  No hay guardias para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
