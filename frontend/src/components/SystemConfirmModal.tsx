import { useEffect, useState } from 'react';

type SystemConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (confirmed: boolean) => void;
};

type ConfirmationOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function showSystemConfirm(message: string, options: ConfirmationOptions = {}) {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent('hospital-system-confirm', {
      detail: {
        title: options.title || 'Confirmar accion',
        message,
        confirmLabel: options.confirmLabel || 'Confirmar',
        cancelLabel: options.cancelLabel || 'Cancelar',
        resolve
      }
    }));
  });
}

export function SystemConfirmModal() {
  const [confirmation, setConfirmation] = useState<SystemConfirmation | null>(null);

  useEffect(() => {
    function handleConfirmation(event: Event) {
      setConfirmation((event as CustomEvent<SystemConfirmation>).detail);
    }
    window.addEventListener('hospital-system-confirm', handleConfirmation);
    return () => window.removeEventListener('hospital-system-confirm', handleConfirmation);
  }, []);

  if (!confirmation) return null;

  function decide(confirmed: boolean) {
    confirmation?.resolve(confirmed);
    setConfirmation(null);
  }

  return (
    <div className="system-alert-overlay">
      <div className="system-alert-modal system-alert-info" role="alertdialog" aria-modal="true" aria-labelledby="system-confirm-title">
        <h2 id="system-confirm-title">{confirmation.title}</h2>
        <p>{confirmation.message}</p>
        <div className="system-alert-actions">
          <button className="btn-secondary" type="button" onClick={() => decide(false)}>
            {confirmation.cancelLabel}
          </button>
          <button className="btn-primary" type="button" autoFocus onClick={() => decide(true)}>
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
