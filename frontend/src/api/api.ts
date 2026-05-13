const API_URL = 'http://localhost:4000';

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
) {

  const token = localStorage.getItem('token');

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers || {})
  });

  // agregar token si existe
  if (token) {

    headers.set(
      'Authorization',
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  return data;
}