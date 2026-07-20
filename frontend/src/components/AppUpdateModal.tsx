import {
  useEffect,
  useState
} from 'react';

import {
  getApiUrl
} from '../api/api';

type UpdateInfo = {
  enabled: boolean;
  latest_version: string;
  download_url: string;
  release_notes: string;
};

const currentVersion =
  import.meta.env.VITE_APP_VERSION || '1.0';

function compareVersions(
  current: string,
  latest: string
) {
  const currentParts =
    current.split('.').map(Number);

  const latestParts =
    latest.split('.').map(Number);

  const length =
    Math.max(
      currentParts.length,
      latestParts.length
    );

  for (let index = 0; index < length; index += 1) {
    const currentPart =
      currentParts[index] || 0;

    const latestPart =
      latestParts[index] || 0;

    if (latestPart > currentPart) {
      return 1;
    }

    if (latestPart < currentPart) {
      return -1;
    }
  }

  return 0;
}

function dismissedKey(
  version: string
) {
  return `app-update-dismissed-${version}`;
}

export default function AppUpdateModal() {
  const [updateInfo, setUpdateInfo] =
    useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled =
      false;

    async function checkUpdate() {
      try {
        const response =
          await fetch(`${getApiUrl()}/app-update`);

        if (!response.ok) {
          return;
        }

        const result =
          await response.json();

        const data =
          result.data as UpdateInfo;

        if (
          !data?.enabled ||
          !data.latest_version ||
          !data.download_url ||
          compareVersions(
            currentVersion,
            data.latest_version
          ) <= 0 ||
          localStorage.getItem(
            dismissedKey(data.latest_version)
          )
        ) {
          return;
        }

        if (!cancelled) {
          setUpdateInfo(data);
        }
      } catch {
        // La actualizacion no debe bloquear el uso del sistema.
      }
    }

    void checkUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateInfo) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">
          Actualizacion disponible
        </h2>

        <p className="page-subtitle">
          Hay una nueva version de la app: {updateInfo.latest_version}
        </p>

        {updateInfo.release_notes && (
          <p>
            {updateInfo.release_notes}
          </p>
        )}

        <div className="modal-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              localStorage.setItem(
                dismissedKey(updateInfo.latest_version),
                'true'
              );
              setUpdateInfo(null);
            }}
          >
            Mas tarde
          </button>

          <button
            className="btn-success"
            type="button"
            onClick={() => {
              window.open(
                updateInfo.download_url,
                '_blank'
              );
            }}
          >
            Descargar actualizacion
          </button>
        </div>
      </div>
    </div>
  );
}
