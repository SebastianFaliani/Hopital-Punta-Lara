import {
  useEffect,
  useState
} from 'react';

type SystemAlert = {
  title: string;
  message: string;
  variant: 'error' | 'success' | 'info';
};

const emptyAlert: SystemAlert = {
  title: '',
  message: '',
  variant: 'info'
};

export function SystemAlertModal() {

  const [alert, setAlert] =
    useState<SystemAlert | null>(null);

  useEffect(() => {

    function handleSystemAlert(
      event: Event
    ) {

      const detail =
        (event as CustomEvent<Partial<SystemAlert>>).detail;

      setAlert({
        ...emptyAlert,
        ...detail,
        title:
          detail?.title ||
          'Aviso del sistema',
        message:
          detail?.message ||
          'Ocurrio un problema'
      });
    }

    window.addEventListener(
      'hospital-system-alert',
      handleSystemAlert
    );

    return () => {
      window.removeEventListener(
        'hospital-system-alert',
        handleSystemAlert
      );
    };
  }, []);

  if (!alert) {
    return null;
  }

  return (
    <div className="system-alert-overlay">
      <div
        className={`system-alert-modal system-alert-${alert.variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="system-alert-title"
      >
        <h2 id="system-alert-title">
          {alert.title}
        </h2>

        <p>{alert.message}</p>

        <div className="system-alert-actions">
          <button
            className="btn-primary"
            type="button"
            autoFocus
            onClick={() =>
              setAlert(null)
            }
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
