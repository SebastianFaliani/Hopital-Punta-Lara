import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {

  return (

    <div className="app-shell">

      <Sidebar />

      <div className="app-content">

        <Topbar />

        <main className="app-main">
          <Outlet />
        </main>

      </div>

    </div>
  );
}
