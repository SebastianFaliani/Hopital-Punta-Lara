import {
  NavLink
} from 'react-router-dom';
import {
  useEffect,
  useState
} from 'react';
import { apiFetch }
  from '../../api/api';

type TransferAlertSummary = {
  alert_count: number;
  overdue_count: number;
};

export default function TransfersNav() {
  const [ambulanceAlerts, setAmbulanceAlerts] =
    useState<TransferAlertSummary>({
      alert_count: 0,
      overdue_count: 0
    });

  const [driverAlerts, setDriverAlerts] =
    useState<TransferAlertSummary>({
      alert_count: 0,
      overdue_count: 0
    });

  useEffect(() => {
    let active =
      true;

    async function loadAlerts() {
      try {
        const [
          ambulanceRes,
          driverRes
        ] = await Promise.all([
          apiFetch('/ambulances/maintenance-alerts'),
          apiFetch('/drivers/license-alerts')
        ]);

        if (active) {
          setAmbulanceAlerts(ambulanceRes.data);
          setDriverAlerts(driverRes.data);
        }
      } catch (error) {
        if (active) {
          setAmbulanceAlerts({
            alert_count: 0,
            overdue_count: 0
          });
          setDriverAlerts({
            alert_count: 0,
            overdue_count: 0
          });
        }
      }
    }

    loadAlerts();

    const interval =
      window.setInterval(
        loadAlerts,
        5 * 60 * 1000
      );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const hasAmbulanceAlerts =
    ambulanceAlerts.alert_count > 0;

  const hasDriverAlerts =
    driverAlerts.alert_count > 0;

  function renderAlertBadge(
    alerts: TransferAlertSummary,
    overdueTitle: string,
    alertTitle: string
  ) {
    if (alerts.alert_count === 0) {
      return null;
    }

    return (
      <span
        className={
          alerts.overdue_count > 0
            ? 'module-tab-alert module-tab-alert-danger'
            : 'module-tab-alert'
        }
        title={
          alerts.overdue_count > 0
            ? `${alerts.overdue_count} ${overdueTitle}`
            : `${alerts.alert_count} ${alertTitle}`
        }
      >
        {alerts.alert_count}
      </span>
    );
  }

  return (

    <div className="module-tabs">

      <NavLink
        to="/transfers/ambulances"
        className={({ isActive }) =>
          [
            'module-tab',
            isActive ? 'module-tab-active' : '',
            hasAmbulanceAlerts ? 'module-tab-with-alert' : ''
          ]
            .filter(Boolean)
            .join(' ')
        }
      >
        <span>
          Ambulancias
        </span>
        {renderAlertBadge(
          ambulanceAlerts,
          'alertas de mantenimiento vencidas',
          'alertas de mantenimiento'
        )}
      </NavLink>

      <NavLink
        to="/transfers/drivers"
        className={({ isActive }) =>
          [
            'module-tab',
            isActive ? 'module-tab-active' : '',
            hasDriverAlerts ? 'module-tab-with-alert' : ''
          ]
            .filter(Boolean)
            .join(' ')
        }
      >
        <span>
          Choferes
        </span>
        {renderAlertBadge(
          driverAlerts,
          'licencias vencidas',
          'licencias por vencer'
        )}
      </NavLink>

      <NavLink
        to="/transfers/shifts"
        className={({ isActive }) =>
          isActive
            ? 'module-tab module-tab-active'
            : 'module-tab'
        }
      >
        Guardias
      </NavLink>

    </div>
  );
}
