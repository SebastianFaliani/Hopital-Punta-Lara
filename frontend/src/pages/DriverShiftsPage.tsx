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

type ShiftChangeHistory = {
  id: number;
  shift_date: string;
  shift_type: ShiftType;
  original_driver_name: string;
  previous_covering_driver_name: string | null;
  covering_driver_name: string | null;
  notes: string | null;
  changed_by_username: string | null;
  created_at: string;
};

type ShiftChangeCount = {
  driver_id: number;
  driver_name: string;
  total: number;
};

type ShiftChangePair = {
  original_driver_id: number;
  original_driver_name: string;
  covering_driver_id: number;
  covering_driver_name: string;
  total: number;
};

type ShiftChangeReport = {
  history: ShiftChangeHistory[];
  requested_by_driver: ShiftChangeCount[];
  covered_by_driver: ShiftChangeCount[];
  pairs: ShiftChangePair[];
};

type DriverCalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
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

function monthCalendarWeeks(
  month: string
) {
  const [year, monthNumber] =
    month.split('-').map(Number);

  const totalDays =
    daysInMonth(month);

  const firstWeekday =
    new Date(
      year,
      monthNumber - 1,
      1
    ).getDay();

  const cells: DriverCalendarDay[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({
      date: '',
      day: 0,
      inMonth: false
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      date:
        dayDate(month, day),
      day,
      inMonth: true
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      date: '',
      day: 0,
      inMonth: false
    });
  }

  const weeks: DriverCalendarDay[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
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

  const [selectedDriverCalendar, setSelectedDriverCalendar] =
    useState<Driver | null>(null);

  const [showChangeReport, setShowChangeReport] =
    useState(false);

  const [changeReport, setChangeReport] =
    useState<ShiftChangeReport | null>(null);

  const [changeFilters, setChangeFilters] =
    useState({
      date_from:
        `${currentMonth}-01`,
      date_to:
        `${currentMonth}-${String(daysInMonth(currentMonth)).padStart(2, '0')}`,
      driver_id: ''
    });

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

  const selectedDriverCalendarWeeks =
    useMemo(
      () =>
        monthCalendarWeeks(filters.month),
      [filters.month]
    );

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

  function shiftBelongsToDriver(
    shift: Shift,
    driverId: number | null
  ) {
    return (
      Number(shift.driver_id) ===
        Number(driverId) ||
      Number(shift.covered_by_driver_id || 0) ===
        Number(driverId)
    );
  }

  function shiftClassForDriver(
    shift: Shift,
    driverId: number | null
  ) {
    if (
      Number(shift.covered_by_driver_id || 0) ===
        Number(driverId)
    ) {
      return 'driver-shift-personal-chip-covering';
    }

    if (
      Number(shift.driver_id) ===
        Number(driverId) &&
      shift.covered_by_driver_id
    ) {
      return 'driver-shift-personal-chip-original-covered';
    }

    return 'driver-shift-personal-chip-active';
  }

  function shiftTextForDriver(
    shift: Shift,
    driverId: number | null
  ) {
    const label =
      shift.shift_type === 'manana'
        ? 'MAÑANA'
        : 'TARDE';

    if (
      Number(shift.covered_by_driver_id || 0) ===
        Number(driverId)
    ) {
      return `${label}: cubre a ${shift.driver_name}`;
    }

    if (
      Number(shift.driver_id) ===
        Number(driverId) &&
      shift.covered_by_driver_id
    ) {
      return `${label}: cubre ${shift.covered_by_driver_name}`;
    }

    return label;
  }

  function shiftsForDriverDate(
    driver: Driver,
    date: string
  ) {
    return filteredShifts
      .filter((shift) =>
        shift.shift_date === date &&
        shiftBelongsToDriver(shift, driver.id)
      )
      .sort((a, b) =>
        a.shift_type.localeCompare(b.shift_type)
      );
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

  async function loadChangeReport() {
    try {
      const params =
        new URLSearchParams();

      if (changeFilters.date_from) {
        params.set(
          'date_from',
          changeFilters.date_from
        );
      }

      if (changeFilters.date_to) {
        params.set(
          'date_to',
          changeFilters.date_to
        );
      }

      if (changeFilters.driver_id) {
        params.set(
          'driver_id',
          changeFilters.driver_id
        );
      }

      const response =
        await apiFetch(
          `/driver-shifts/changes/report?${params.toString()}`
        );

      setChangeReport(response.data);
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

    const weekDays = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miercoles',
      'Jueves',
      'Viernes',
      'Sabado'
    ];

    const rows =
      monthCalendarWeeks(filters.month).map((week) => `
        <tr>
          ${week.map((day) => {
            if (!day.inMonth) {
              return '<td class="empty"></td>';
            }

            const morning =
              shiftsByDate.get(`${day.date}-manana`) || [];

            const afternoon =
              shiftsByDate.get(`${day.date}-tarde`) || [];

            const renderShift = (shift: Shift) =>
              escapePrintHtml(
                shift.covered_by_driver_id
                  ? `${shift.driver_name} -> ${shift.covered_by_driver_name}`
                  : shift.driver_name
              );

            return `
              <td class="${dateState(filters.month, day.day).isSunday ? 'sunday' : ''}">
                <strong>${day.day}</strong>
                <section>
                  <b>MAÑANA</b>
                  <div>
                    ${morning.map((shift) => `<span>${renderShift(shift)}</span>`).join('') || '<em>-</em>'}
                  </div>
                </section>
                <section>
                  <b>TARDE</b>
                  <div>
                    ${afternoon.map((shift) => `<span>${renderShift(shift)}</span>`).join('') || '<em>-</em>'}
                  </div>
                </section>
              </td>
            `;
          }).join('')}
        </tr>
      `).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title></title>
          <style>
            @page { size: A4 landscape; margin: 7mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            html, body { margin: 0; padding: 0; }
            body { color: #111827; font-family: Arial, sans-serif; }
            .print-header { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; padding-bottom: 7px; border-bottom: 2px solid #0D3B66; }
            .print-logo { width: 112px; max-height: 42px; object-fit: contain; object-position: left center; }
            h1 { margin: 0; font-size: 18px; }
            p { margin: 3px 0 0; color: #475569; font-size: 11px; }
            table { width: 100%; height: 163mm; border-collapse: collapse; table-layout: fixed; }
            tbody tr { height: ${100 / monthCalendarWeeks(filters.month).length}%; }
            th { color: #ffffff !important; background: #1e5f93 !important; padding: 5px; font-size: 10px; text-align: center; }
            td { height: auto; border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; font-size: 8.5px; }
            td.empty { background: #f8fafc; }
            td strong { display: block; margin-bottom: 3px; color: #0f172a; font-size: 17px; line-height: 0.9; }
            td.sunday strong { color: #dc2626; }
            section { margin-top: 2px; }
            b { display: block; color: #0D3B66; font-size: 8.5px; line-height: 1.1; }
            section div { padding-left: 7px; }
            span { display: block; margin-top: 1px; line-height: 1.12; }
            em { color: #94a3b8; font-style: normal; }
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
                ${weekDays.map((day) => `<th>${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(
      () => printWindow.print(),
      1000
    );
  }

  function printDriverCalendar(
    driver: Driver
  ) {
    const printWindow =
      window.open('', '_blank', 'width=1100,height=800');

    if (!printWindow) {
      setError('No se pudo abrir la ventana de impresion');
      return;
    }

    const weekDays = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miercoles',
      'Jueves',
      'Viernes',
      'Sabado'
    ];

    const rows =
      selectedDriverCalendarWeeks.map((week) => `
        <tr>
          ${week.map((day) => {
            if (!day.inMonth) {
              return '<td class="empty"></td>';
            }

            const shifts =
              shiftsForDriverDate(driver, day.date);

            return `
              <td class="${dateState(filters.month, day.day).isSunday ? 'sunday' : ''}">
                <strong>${day.day}</strong>
                ${shifts.map((shift) => `
                  <span class="${escapePrintHtml(shiftClassForDriver(shift, driver.id))}">
                    ${escapePrintHtml(shiftTextForDriver(shift, driver.id))}
                  </span>
                `).join('')}
              </td>
            `;
          }).join('')}
        </tr>
      `).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title></title>
          <style>
            @page { size: A4 portrait; margin: 9mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            html, body { margin: 0; padding: 0; }
            body { color: #111827; font-family: Arial, sans-serif; }
            .print-header { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; padding-bottom: 7px; border-bottom: 2px solid #0D3B66; }
            .print-logo { width: 112px; max-height: 42px; object-fit: contain; object-position: left center; }
            h1 { margin: 0; font-size: 18px; }
            p { margin: 3px 0 0; color: #475569; font-size: 11px; }
            table { width: 100%; height: 118mm; border-collapse: collapse; table-layout: fixed; }
            tbody tr { height: ${100 / selectedDriverCalendarWeeks.length}%; }
            th { color: #ffffff !important; background: #1e5f93 !important; padding: 5px; font-size: 10px; text-align: center; }
            td { height: auto; border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; font-size: 9px; }
            td.empty { background: #f8fafc; }
            td strong { display: block; margin-bottom: 5px; color: #0f172a; font-size: 18px; line-height: 0.95; }
            td.sunday strong { color: #dc2626; }
            span { display: block; margin-top: 4px; margin-left: 6px; padding-left: 10px; border-left: 2px solid currentColor; overflow-wrap: anywhere; font-size: 9px; font-weight: 400; line-height: 1.15; }
            .driver-shift-personal-chip-active { color: #166534 !important; }
            .driver-shift-personal-chip-covering { color: #92400e !important; }
            .driver-shift-personal-chip-original-covered { color: #991b1b !important; text-decoration: line-through; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img class="print-logo" src="${window.location.origin}/menu-icons/sigsa-logo.png" />
            <div>
              <h1>Guardias de chofer</h1>
              <p>${escapePrintHtml(driverLabel(driver))} - ${escapePrintHtml(monthLabel(filters.month))}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                ${weekDays.map((day) => `<th>${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(
      () => printWindow.print(),
      1000
    );
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
          <div className="table-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setShowChangeReport(true);
                loadChangeReport();
              }}
            >
              Historial
            </button>
            <IconButton
              icon="print"
              label="Imprimir calendario"
              onClick={printCalendar}
            />
          </div>
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
                  <button
                    className="driver-shift-driver-button"
                    type="button"
                    onClick={() =>
                      setSelectedDriverCalendar(driver)
                    }
                  >
                    <strong>{driverLabel(driver)}</strong>
                  </button>
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

      {selectedDriverCalendar && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide driver-shift-personal-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Guardias de chofer
                </h2>
                <p>
                  {driverLabel(selectedDriverCalendar)}
                  {' - '}
                  {monthLabel(filters.month)}
                </p>
              </div>
              <button
                aria-label="Cerrar"
                className="modal-close-button"
                type="button"
                onClick={() =>
                  setSelectedDriverCalendar(null)
                }
              >
                x
              </button>
            </div>

            <div className="driver-shift-personal-actions">
              <IconButton
                icon="print"
                label="Imprimir guardias del chofer"
                onClick={() =>
                  printDriverCalendar(
                    selectedDriverCalendar
                  )
                }
              />
            </div>

            <div className="driver-shift-personal-calendar-wrap">
              <table className="driver-shift-personal-calendar">
                <thead>
                  <tr>
                    {[
                      'Domingo',
                      'Lunes',
                      'Martes',
                      'Miercoles',
                      'Jueves',
                      'Viernes',
                      'Sabado'
                    ].map((day) => (
                      <th key={day}>
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedDriverCalendarWeeks.map((week, weekIndex) => (
                    <tr key={weekIndex}>
                      {week.map((day, dayIndex) => {
                        const shifts =
                          day.inMonth
                            ? shiftsForDriverDate(
                              selectedDriverCalendar,
                              day.date
                            )
                            : [];

                        return (
                          <td
                            key={`${weekIndex}-${dayIndex}`}
                            className={
                              [
                                day.inMonth
                                  ? ''
                                  : 'driver-shift-personal-empty',
                                dayIndex === 0 &&
                                day.inMonth
                                  ? 'driver-shift-personal-sunday'
                                  : ''
                              ].filter(Boolean).join(' ')
                            }
                          >
                            {day.inMonth && (
                              <>
                                <strong>{day.day}</strong>
                                {shifts.map((shift) => (
                                  <span
                                    key={`${shift.id}-${shift.shift_type}`}
                                    className={[
                                      'driver-shift-personal-chip',
                                      shiftClassForDriver(
                                        shift,
                                        selectedDriverCalendar.id
                                      )
                                    ].join(' ')}
                                    title={
                                      shiftTextForDriver(
                                        shift,
                                        selectedDriverCalendar.id
                                      )
                                    }
                                  >
                                    {shiftTextForDriver(
                                      shift,
                                      selectedDriverCalendar.id
                                    )}
                                  </span>
                                ))}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showChangeReport && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide driver-shift-report-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Historial de cambios
                </h2>
                <p>
                  Cambios de guardia, cobertura y cruces entre choferes.
                </p>
              </div>
              <button
                aria-label="Cerrar"
                className="modal-close-button"
                type="button"
                onClick={() =>
                  setShowChangeReport(false)
                }
              >
                x
              </button>
            </div>

            <div className="shift-filter-panel driver-shift-report-filters">
              <input
                className="form-input"
                type="date"
                value={changeFilters.date_from}
                onChange={(event) =>
                  setChangeFilters({
                    ...changeFilters,
                    date_from:
                      event.target.value
                  })
                }
              />
              <input
                className="form-input"
                type="date"
                value={changeFilters.date_to}
                onChange={(event) =>
                  setChangeFilters({
                    ...changeFilters,
                    date_to:
                      event.target.value
                  })
                }
              />
              <select
                className="form-input"
                value={changeFilters.driver_id}
                onChange={(event) =>
                  setChangeFilters({
                    ...changeFilters,
                    driver_id:
                      event.target.value
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
              <button
                className="btn-primary"
                type="button"
                onClick={loadChangeReport}
              >
                Aplicar
              </button>
            </div>

            <div className="driver-shift-report-grid">
              <section>
                <h3>Mas cambios pedidos</h3>
                <table className="data-table">
                  <tbody>
                    {(changeReport?.requested_by_driver || []).map((item) => (
                      <tr key={item.driver_id}>
                        <td>{item.driver_name}</td>
                        <td>{item.total}</td>
                      </tr>
                    ))}
                    {(changeReport?.requested_by_driver || []).length === 0 && (
                      <tr>
                        <td colSpan={2}>Sin datos</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section>
                <h3>Mas guardias cubiertas</h3>
                <table className="data-table">
                  <tbody>
                    {(changeReport?.covered_by_driver || []).map((item) => (
                      <tr key={item.driver_id}>
                        <td>{item.driver_name}</td>
                        <td>{item.total}</td>
                      </tr>
                    ))}
                    {(changeReport?.covered_by_driver || []).length === 0 && (
                      <tr>
                        <td colSpan={2}>Sin datos</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section>
                <h3>Quien cubrio a quien</h3>
                <table className="data-table">
                  <tbody>
                    {(changeReport?.pairs || []).map((item) => (
                      <tr
                        key={`${item.original_driver_id}-${item.covering_driver_id}`}
                      >
                        <td>
                          {item.covering_driver_name}
                          {' cubrio a '}
                          {item.original_driver_name}
                        </td>
                        <td>{item.total}</td>
                      </tr>
                    ))}
                    {(changeReport?.pairs || []).length === 0 && (
                      <tr>
                        <td colSpan={2}>Sin datos</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </div>

            <div className="driver-shift-report-history">
              <h3>Detalle</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Turno</th>
                      <th>Original</th>
                      <th>Cubre</th>
                      <th>Cargado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(changeReport?.history || []).map((item) => (
                      <tr key={item.id}>
                        <td>{formatDisplayDate(item.shift_date)}</td>
                        <td>{shiftLabels[item.shift_type]}</td>
                        <td>{item.original_driver_name}</td>
                        <td>{item.covering_driver_name || 'Sin reemplazo'}</td>
                        <td>{item.changed_by_username || '-'}</td>
                      </tr>
                    ))}
                    {(changeReport?.history || []).length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          No hay cambios para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
