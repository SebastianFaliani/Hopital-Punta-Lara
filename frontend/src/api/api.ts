const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

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

  let response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers
    }
  );

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
      response = await fetch(
        `${API_URL}${endpoint}`,
        {
          ...options,
          headers
        }
      );

    } catch (error) {

      localStorage.clear();

      window.location.href = '/';

      throw error;
    }
  }

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data.message
    );
  }

  return data;
}
