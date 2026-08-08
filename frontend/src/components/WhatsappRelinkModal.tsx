import { useEffect, useState } from 'react';

import { apiFetch } from '../api/api';
import { hasPermission } from '../auth/permissions';
import { useAuth } from '../auth/useAuth';

type WhatsappStatus = {
  isReady: boolean;
  status: string;
  qrDataUrl: string | null;
  hasClient: boolean;
  initializing: boolean;
  lastEvent: string | null;
};

export default function WhatsappRelinkModal() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canViewWhatsapp = hasPermission(
    user,
    'laboratory.whatsapp.link',
    ['admin']
  );

  useEffect(() => {
    if (!canViewWhatsapp) {
      setStatus(null);
      return;
    }

    let active = true;
    const loadStatus = async () => {
      try {
        const response = await apiFetch('/whatsapp/web/link-status');
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

  const requestNewQr = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setDismissed(false);
    setStatus((current) => current ? { ...current, qrDataUrl: null, status: 'restarting' } : current);
    try {
      await apiFetch('/whatsapp/web/refresh-qr', { method: 'POST' });
    } finally {
      window.setTimeout(() => setRefreshing(false), 3000);
    }
  };

  if (!status || status.isReady) return null;

  const agentOffline = !status.hasClient || status.status === 'offline';
  const connectionFailed = status.status === 'failed';

  if (agentOffline) {
    return (
      <div className="whatsapp-relink-banner whatsapp-agent-offline" role="status">
        <div>
          <strong>Agente de WhatsApp fuera de linea</strong>
          <span>
            La PC puede estar apagada, sin Internet o iniciando. El telefono sigue vinculado;
            no hace falta escanear otro QR.
          </span>
        </div>
      </div>
    );
  }

  if (!status.qrDataUrl || dismissed) {
    return (
      <div className={`whatsapp-relink-banner ${status.qrDataUrl ? '' : 'whatsapp-agent-connecting'}`} role="status">
        <div>
          <strong>
            {status.qrDataUrl
              ? 'WhatsApp necesita vinculacion'
              : connectionFailed
                ? 'WhatsApp necesita atencion'
                : 'Conectando WhatsApp...'}
          </strong>
          <span>
            {status.qrDataUrl
              ? 'El codigo esta listo para vincular el telefono.'
              : connectionFailed
                ? status.lastEvent || 'No se pudo recuperar la conexion de WhatsApp.'
                : 'El agente esta recuperando la sesion guardada. No hace falta vincular el telefono.'}
          </span>
        </div>
        {(status.qrDataUrl || connectionFailed) && (
          <button
            type="button"
            className="btn-primary"
            disabled={refreshing}
            onClick={status.qrDataUrl ? () => setDismissed(false) : requestNewQr}
          >
            {refreshing ? 'Generando...' : status.qrDataUrl ? 'Vincular WhatsApp' : 'Generar nuevo QR'}
          </button>
        )}
      </div>
    );
  }

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
          <button type="button" className="btn-secondary" disabled={refreshing} onClick={requestNewQr}>
            {refreshing ? 'Generando...' : 'Actualizar QR'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDismissed(true)}>
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
