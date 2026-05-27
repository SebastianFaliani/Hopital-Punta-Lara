const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema'
) {

  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant: 'error'
        }
      }
    )
  );
}

export function getApiUrl() {
  return API_URL;
}

async function refreshAccessToken() {

  const refreshToken =
    localStorage.getItem(
      'refreshToken'
    );

  if (!refreshToken) {

    throw new Error(
      'No refresh token'
    );
  }

  const response = await fetch(
    `${API_URL}/auth/refresh`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({
        refreshToken
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {

    localStorage.clear();

    throw new Error(
      'Sesión expirada'
    );
  }

  // guardar nuevo access token
  localStorage.setItem(
    'accessToken',
    data.accessToken
  );

  return data.accessToken;
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
) {

  let accessToken =
    localStorage.getItem(
      'accessToken'
    );

  const headers =
    new Headers({
      'Content-Type':
        'application/json',

      ...(options.headers || {})
    });

  // agregar token
  if (accessToken) {

    headers.set(
      'Authorization',
      `Bearer ${accessToken}`
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers
      }
    );
  } catch (error) {
    showSystemAlert(
      `No se pudo conectar con el servidor (${API_URL})`,
      'Conexion con el servidor'
    );

    throw new Error(
      `No se pudo conectar con el servidor (${API_URL})`
    );
  }

  // token expirado
  if (response.status === 401) {

    try {

      accessToken =
        await refreshAccessToken();

      headers.set(
        'Authorization',
        `Bearer ${accessToken}`
      );

      // retry request
      try {
        response = await fetch(
          `${API_URL}${endpoint}`,
          {
            ...options,
            headers
          }
        );
      } catch (error) {
        showSystemAlert(
          `No se pudo conectar con el servidor (${API_URL})`,
          'Conexion con el servidor'
        );

        throw new Error(
          `No se pudo conectar con el servidor (${API_URL})`
        );
      }

    } catch (error) {

      localStorage.clear();

      window.location.href = '/';

      throw error;
    }
  }

  const data =
    await response.json();

  if (!response.ok) {
    showSystemAlert(
      data.message || 'La operacion no se pudo completar'
    );

    throw new Error(
      data.message
    );
  }

  return data;
}
