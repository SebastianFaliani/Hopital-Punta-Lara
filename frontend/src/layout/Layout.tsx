import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {

  return (

    <div style={{ display: 'flex', height: '100vh' }}>

      {/* Sidebar */}
      <Sidebar />

      {/* Contenido */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        <Topbar />

        <main
          style={{
            flex: 1,
            padding: 24,
            background: 'var(--color-background)',
            overflowY: 'auto'
          }}
        >
          <Outlet />
        </main>

      </div>

    </div>
  );
}