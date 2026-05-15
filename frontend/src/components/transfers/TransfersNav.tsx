import {
  NavLink
} from 'react-router-dom';

export default function TransfersNav() {

  return (

    <div className="module-tabs">

      <NavLink
        to="/transfers"
        end
        className={({ isActive }) =>
          isActive
            ? 'module-tab module-tab-active'
            : 'module-tab'
        }
      >
        Solicitudes
      </NavLink>

      <NavLink
        to="/transfers/ambulances"
        className={({ isActive }) =>
          isActive
            ? 'module-tab module-tab-active'
            : 'module-tab'
        }
      >
        Ambulancias
      </NavLink>

      <NavLink
        to="/transfers/drivers"
        className={({ isActive }) =>
          isActive
            ? 'module-tab module-tab-active'
            : 'module-tab'
        }
      >
        Choferes
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
