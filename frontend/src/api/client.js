const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'İstek başarısız');
  }

  return response.json();
}

export { API_BASE };
