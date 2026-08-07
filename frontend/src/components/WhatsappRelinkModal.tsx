import { useEffect, useState } from 'react';

import { apiFetch } from '../api/api';
import { hasPermission } from '../auth/permissions';
import { useAuth } from '../auth/useAuth';

type WhatsappStatus = {
  isReady: boolean;
  status: string;
  qrDataUrl: string | null;
};

export default function WhatsappRelinkModal() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const canViewWhatsapp = hasPermission(
    user,
    'laboratory.view',
    ['admin', 'lab', 'user', 'dir']
  );

  useEffect(() => {
    if (!canViewWhatsapp) {
      setStatus(null);
      return;
    }

    let active = true;
    const loadStatus = async () => {
      try {
        const response = await apiFetch('/whatsapp/web/status');
        if (!active) return;
        const nextStatus = response.data as WhatsappStatus;
        setStatus(nextStatus);
        if (nextStatus.isReady) setDismissed(false);
      } catch {
        if (active) setStatus(null);
      }
    };

    void loadStatus();
    const interval = window.setInterval(loadStatus, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [canViewWhatsapp]);

  if (!status?.qrDataUrl || status.isReady || dismissed) return null;

  return (
    <div className="system-alert-overlay whatsapp-relink-overlay" role="dialog" aria-modal="true">
      <div className="system-alert-modal whatsapp-relink-modal">
        <h2>Volver a vincular WhatsApp</h2>
        <p>
          La sesion del telefono se desvinculo. Escanea este codigo desde
          WhatsApp &gt; Dispositivos vinculados.
        </p>
        <div className="whatsapp-relink-qr">
          <img src={status.qrDataUrl} alt="Codigo QR para vincular WhatsApp" />
        </div>
        <p className="whatsapp-relink-help">
          Esta ventana se cerrara automaticamente cuando el telefono quede conectado.
        </p>
        <div className="system-alert-actions">
          <button type="button" className="btn-secondary" onClick={() => setDismissed(true)}>
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
