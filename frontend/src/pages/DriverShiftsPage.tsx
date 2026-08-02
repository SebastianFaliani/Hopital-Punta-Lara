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

import { IconButton }
  from '../components/IconButton';
import TransfersHeader
  from '../components/transfers/TransfersHeader';

type Driver = {
  id: number | null;
  full_name: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

type ShiftType =
  'manana' |
  'tarde';

type Shift = {
  id: number;
  driver_id: number;
  covered_by_driver_id: number | string | null;
  shift_date: string;
  shift_type: ShiftType;
  start_datetime: string;
  end_datetime: string;
  status: string;
  notes: string | null;
  driver_name: string;
  covered_by_driver_name: string | null;
};

type ShiftModalState = {
  id?: number;
  original_driver_id: string;
  covering_driver_id: string;
  shift_date: string;
  shift_type: ShiftType;
  notes: string;
};

const shiftLabels: Record<ShiftType, string> = {
  manana: 'Manana',
  tarde: 'Tarde'
};

const shiftShortLabels: Record<ShiftType, string> = {
  manana: 'M',
  tarde: 'T'
};

const currentMonth =
  (() => {
    const date =
      new Date();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  })();

function driverLabel(
  driver: Driver
) {
  return (
    driver.full_name ||
    `${driver.first_name || ''} ${driver.last_name || ''}`.trim()
  );
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

function monthLabel(
  month: string
) {
  const [year, monthNumber] =
    month.split('-').map(Number);

  return new Date(
    year,
    monthNumber - 1,
    1
  ).toLocaleDateString(
    'es-AR',
    {
      month: 'long',
      year: 'numeric'
    }
  );
}

function dayDate(
  month: string,
  day: number
) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

function formatDisplayDate(
  value: string
) {
  const [
    year,
    month,
    day
  ] = value.split('-');

  return `${day}-${month}-${year}`;
}

function weekdayLabel(
  month: string,
  day: number
) {
  const [year, monthNumber] =
    month.split('-').map(Number);

  return new Date(
    year,
    monthNumber - 1,
    day
  ).toLocaleDateString(
    'es-AR',
    {
      weekday: 'short'
    }
  );
}

function dateState(
  month: string,
  day: number
) {
  const [year, monthNumber] =
    month.split('-').map(Number);

  const date =
    new Date(
      year,
      monthNumber - 1,
      day
    );

  const today =
    new Date();

  const normalizedToday =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

  return {
    isPast:
      date < normalizedToday,
    isToday:
      date.getTime() ===
        normalizedToday.getTime(),
    isSunday:
      date.getDay() === 0
  };
}

function escapePrintHtml(
  value: unknown
) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

  const [filters, setFilters] =
    useState({
      driver_id: '',
      month: currentMonth
    });

  const [editingShift, setEditingShift] =
    useState<ShiftModalState | null>(null);

  const [error, setError] =
    useState('');

  const activeDrivers =
    useMemo(
      () =>
        drivers.filter(
          (driver) =>
            driver.is_active &&
            driver.id
        ),
      [drivers]
    );

  const displayedDrivers =
    useMemo(
      () =>
        filters.driver_id
          ? activeDrivers.filter(
            (driver) =>
              String(driver.id) ===
                filters.driver_id
          )
          : activeDrivers,
      [activeDrivers, filters.driver_id]
    );

  const monthDays =
    useMemo(
      () =>
        Array.from(
          {
            length:
              daysInMonth(filters.month)
          },
          (_, index) => index + 1
        ),
      [filters.month]
    );

  const filteredShifts =
    useMemo(
      () =>
        shifts.filter((shift) => {
          return (
            String(shift.shift_date).slice(0, 7) ===
              filters.month &&
            (
              !filters.driver_id ||
              String(shift.driver_id) ===
                filters.driver_id ||
              String(shift.covered_by_driver_id || '') ===
                filters.driver_id
            ) &&
            true
          );
        }),
      [shifts, filters]
    );

  const shiftsByDriverDate =
    useMemo(() => {
      const map =
        new Map<string, Shift>();

      filteredShifts.forEach((shift) => {
        map.set(
          `${shift.driver_id}-${shift.shift_date}-${shift.shift_type}`,
          shift
        );

        if (shift.covered_by_driver_id) {
          map.set(
            `${shift.covered_by_driver_id}-${shift.shift_date}-${shift.shift_type}`,
            shift
          );
        }
      });

      return map;
    }, [filteredShifts]);

  const shiftsByDate =
    useMemo(() => {
      const map =
        new Map<string, Shift[]>();

      filteredShifts.forEach((shift) => {
        const key =
          `${shift.shift_date}-${shift.shift_type}`;

        const current =
          map.get(key) || [];

        current.push(shift);
        map.set(key, current);
      });

      return map;
    }, [filteredShifts]);

  function driverNameById(
    driverId: string
  ) {
    const driver =
      activeDrivers.find(
        (item) =>
          String(item.id) === driverId
      );

    return driver
      ? driverLabel(driver)
      : 'Chofer no disponible';
  }

  async function loadData() {

    try {

      const [
        shiftRes,
        driverRes
      ] = await Promise.all([
        apiFetch('/driver-shifts'),
        apiFetch('/drivers')
      ]);

      setShifts(shiftRes.data);
      setDrivers(driverRes.data);
      setError('');

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleCalendarShift(
    driver: Driver,
    day: number,
    shiftType: ShiftType
  ) {
    if (!driver.id) {
      return;
    }

    const date =
      dayDate(filters.month, day);

    const shift =
      shiftsByDriverDate.get(
        `${driver.id}-${date}-${shiftType}`
      );

    if (!shift) {
      try {
        await apiFetch(
          '/driver-shifts',
          {
            method: 'POST',
            body: JSON.stringify({
              driver_id: driver.id,
              shift_date: date,
              shift_type: shiftType
            })
          }
        );

        await loadData();
      } catch (error: any) {
        setError(error.message);
      }

      return;
    }

    setEditingShift({
      id: shift.id,
      original_driver_id:
        String(shift.driver_id || driver.id),
      covering_driver_id:
        String(
          shift.covered_by_driver_id ||
          shift.driver_id ||
          driver.id
        ),
      shift_date: date,
      shift_type: shiftType,
      notes:
        shift.notes || ''
    });
  }

  async function saveShift(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!editingShift) {
      return;
    }

    const payload = {
      driver_id:
        Number(editingShift.original_driver_id),
      covered_by_driver_id:
        editingShift.covering_driver_id !==
          editingShift.original_driver_id
          ? Number(editingShift.covering_driver_id)
          : null,
      shift_date:
        editingShift.shift_date,
      shift_type:
        editingShift.shift_type,
      notes:
        editingShift.notes
    };

    try {
      await apiFetch(
        editingShift.id
          ? `/driver-shifts/${editingShift.id}`
          : '/driver-shifts',
        {
          method:
            editingShift.id ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
        }
      );

      setEditingShift(null);
      await loadData();
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function removeShift() {
    if (!editingShift?.id) {
      return;
    }

    try {
      await apiFetch(
        `/driver-shifts/${editingShift.id}`,
        {
          method: 'DELETE'
        }
      );

      setEditingShift(null);
      await loadData();
    } catch (error: any) {
      setError(error.message);
    }
  }

  function printCalendar() {
    const printWindow =
      window.open('', '_blank', 'width=1200,height=800');

    if (!printWindow) {
      setError('No se pudo abrir la ventana de impresion');
      return;
    }

    const rows =
      monthDays.map((day) => {
        const date =
          dayDate(filters.month, day);

        const morning =
          shiftsByDate.get(`${date}-manana`) || [];

        const afternoon =
          shiftsByDate.get(`${date}-tarde`) || [];

        return `
          <tr>
            <td>
              <strong>${String(day).padStart(2, '0')}</strong>
              <span>${escapePrintHtml(weekdayLabel(filters.month, day))}</span>
            </td>
            <td>${morning.map((shift) => escapePrintHtml(
              shift.covered_by_driver_id
                ? `${shift.driver_name} -> ${shift.covered_by_driver_name}`
                : shift.driver_name
            )).join('<br>') || '-'}</td>
            <td>${afternoon.map((shift) => escapePrintHtml(
              shift.covered_by_driver_id
                ? `${shift.driver_name} -> ${shift.covered_by_driver_name}`
                : shift.driver_name
            )).join('<br>') || '-'}</td>
          </tr>
        `;
      }).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Guardias de choferes</title>
          <style>
            body { margin: 28px; color: #111827; font-family: Arial, sans-serif; }
            .print-header { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #0f766e; }
            .print-logo { width: 145px; max-height: 58px; object-fit: contain; object-position: left center; }
            h1 { margin: 0; font-size: 22px; }
            p { margin: 5px 0 0; color: #475569; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; }
            td:first-child { width: 80px; }
            td:first-child span { display: block; margin-top: 2px; color: #64748b; text-transform: uppercase; font-size: 10px; }
            @media print { body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img class="print-logo" src="${window.location.origin}/menu-icons/sigsa-logo.png" />
            <div>
              <h1>Guardias de choferes</h1>
              <p>${escapePrintHtml(monthLabel(filters.month))}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Turno manana</th>
                <th>Turno tarde</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <TransfersHeader
        title="Guardias"
        description="Organiza que chofer cubre cada turno y deja una grilla mensual lista para imprimir."
        actions={
          <IconButton
            icon="print"
            label="Imprimir calendario"
            onClick={printCalendar}
          />
        }
      />

      {!canEdit && (
        <p className="page-subtitle">
          Vista de consulta. Podes ver las guardias sin modificar datos.
        </p>
      )}

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      {canEdit && (
        <p className="driver-shift-help">
          Click en una celda vacia carga la guardia. Click en una celda marcada permite cambiar chofer o eliminarla.
        </p>
      )}

      <div className="shift-filter-panel driver-shift-filters">
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
          {activeDrivers.map((driver) => (
            <option
              key={driver.id}
              value={driver.id || ''}
            >
              {driverLabel(driver)}
            </option>
          ))}
        </select>

        <input
          className="form-input"
          type="month"
          value={filters.month}
          onChange={(event) =>
            setFilters({
              ...filters,
              month: event.target.value
            })
          }
        />

        <button
          className="btn-secondary"
          type="button"
          onClick={() =>
            setFilters({
              driver_id: '',
              month: currentMonth
            })
          }
        >
          Limpiar filtros
        </button>
      </div>

      <div className="driver-shift-calendar-wrap">
        <table className="data-table driver-shift-calendar">
          <thead>
            <tr>
              <th className="driver-shift-driver-col">
              </th>
              {monthDays.map((day) => (
                <th
                  key={day}
                  className={[
                    dateState(filters.month, day).isPast
                      ? 'driver-shift-day-past'
                      : '',
                    dateState(filters.month, day).isToday
                      ? 'driver-shift-day-today'
                      : '',
                    dateState(filters.month, day).isSunday
                      ? 'driver-shift-day-sunday'
                      : ''
                  ].filter(Boolean).join(' ')}
                >
                  <strong>{day}</strong>
                  <span>{weekdayLabel(filters.month, day)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedDrivers.map((driver) => (
              <tr key={driver.id}>
                <td className="driver-shift-driver-col">
                  <strong>{driverLabel(driver)}</strong>
                </td>
                {monthDays.map((day) => {
                  const date =
                    dayDate(filters.month, day);

                  const state =
                    dateState(filters.month, day);

                  return (
                    <td
                      key={day}
                      className={[
                        state.isPast
                          ? 'driver-shift-day-past'
                          : '',
                        state.isToday
                          ? 'driver-shift-day-today'
                          : '',
                        state.isSunday
                          ? 'driver-shift-day-sunday'
                          : ''
                      ].filter(Boolean).join(' ')}
                    >
                      {(['manana', 'tarde'] as ShiftType[]).map((type) => {
                        const shift =
                          shiftsByDriverDate.get(
                            `${driver.id}-${date}-${type}`
                          );

                        const isCoveredOriginal =
                          Boolean(
                            shift &&
                            Number(shift.driver_id) ===
                              Number(driver.id) &&
                            shift.covered_by_driver_id
                          );

                        const isCoveringDriver =
                          Boolean(
                            shift &&
                            Number(shift.covered_by_driver_id) ===
                              Number(driver.id)
                          );

                        const cellTitle =
                          !shift
                            ? `Cargar ${shiftLabels[type]}`
                            : isCoveredOriginal
                              ? `${shiftLabels[type]} cubierta por ${shift.covered_by_driver_name || ''}`
                              : isCoveringDriver
                                ? `${shiftLabels[type]} cubre a ${shift.driver_name}`
                                : `${shiftLabels[type]} asignado`;

                        return (
                          <button
                            key={type}
                            className={[
                              'driver-shift-cell',
                              shift
                                ? 'driver-shift-cell-active'
                                : '',
                              isCoveredOriginal
                                ? 'driver-shift-cell-original-covered'
                                : '',
                              isCoveringDriver
                                ? 'driver-shift-cell-covering'
                                : ''
                            ].filter(Boolean).join(' ')}
                            type="button"
                            disabled={!canEdit}
                            title={cellTitle}
                            onClick={() =>
                              handleCalendarShift(
                                driver,
                                day,
                                type
                              )
                            }
                          >
                            {shiftShortLabels[type]}
                          </button>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}

            {displayedDrivers.length === 0 && (
              <tr>
                <td colSpan={monthDays.length + 1}>
                  No hay choferes activos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingShift && (
        <div className="modal-overlay">
          <form
            className="modal-content"
            onSubmit={saveShift}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {editingShift.id
                    ? 'Editar guardia'
                    : 'Nueva guardia'}
                </h2>
                <p>
                  {formatDisplayDate(editingShift.shift_date)}
                  {' - '}
                  {shiftLabels[editingShift.shift_type]}
                </p>
              </div>
              <button
                aria-label="Cerrar"
                className="modal-close-button"
                type="button"
                onClick={() =>
                  setEditingShift(null)
                }
              >
                x
              </button>
            </div>

            <label className="form-field">
              <span>Asignada a</span>
              <input
                className="form-input"
                value={driverNameById(editingShift.original_driver_id)}
                readOnly
              />
            </label>

            <label className="form-field">
              <span>La cubre</span>
              <select
                className="form-input"
                value={editingShift.covering_driver_id}
                onChange={(event) =>
                  setEditingShift({
                    ...editingShift,
                    covering_driver_id:
                      event.target.value
                  })
                }
                required
              >
                {activeDrivers.map((driver) => (
                  <option
                    key={driver.id}
                    value={driver.id || ''}
                  >
                    {driverLabel(driver)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Observaciones</span>
              <textarea
                className="form-input"
                value={editingShift.notes}
                onChange={(event) =>
                  setEditingShift({
                    ...editingShift,
                    notes:
                      event.target.value
                  })
                }
                rows={3}
              />
            </label>

            <div className="modal-actions">
              {editingShift.id && (
                <button
                  className="btn-danger"
                  type="button"
                  onClick={removeShift}
                >
                  Eliminar
                </button>
              )}
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  setEditingShift(null)
                }
              >
                Cancelar
              </button>
              <button
                className="btn-success"
                type="submit"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
