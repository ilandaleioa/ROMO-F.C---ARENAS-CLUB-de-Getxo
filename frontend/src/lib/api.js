const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  // FormData (subida de ficheros) no debe llevar Content-Type manual: el
  // navegador necesita fijar el boundary del multipart el mismo.
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError('No se pudo conectar con el servidor. Comprueba tu conexion.', 0);
  }

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    // Respuesta sin cuerpo JSON (p.ej. 204)
  }

  if (!res.ok) {
    throw new ApiError(body?.error || 'Ha ocurrido un error inesperado.', res.status);
  }

  return body;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postFile: (path, formData) => request(path, { method: 'POST', body: formData }),
};
