import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {

  const [menuOpen, setMenuOpen] =
    useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  useEffect(() => {
    document.body.classList.toggle(
      'app-menu-open',
      menuOpen
    );

    return () =>
      document.body.classList.remove(
        'app-menu-open'
      );
  }, [menuOpen]);

  return (

    <div
      className={
        menuOpen
          ? 'app-shell app-shell-menu-open'
          : 'app-shell'
      }
    >

      <Sidebar onNavigate={closeMenu} />

      <button
        className="app-menu-backdrop"
        type="button"
        aria-label="Cerrar menu"
        onClick={closeMenu}
      />

      <div className="app-content">

        <Topbar
          menuOpen={menuOpen}
          onToggleMenu={() =>
            setMenuOpen((current) => !current)
          }
        />

        <main className="app-main">
          <Outlet />
        </main>

      </div>

    </div>
  );
}
