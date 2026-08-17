import { getClub } from './clubStore';

// Si se configura una URL explícita, la respetamos. Si no, usamos /api tanto
// en desarrollo como en producción para que el proxy de Vite o el rewrite de
// despliegue resuelvan la ruta sin depender de un puerto concreto.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/$/, '')
  : '/api';

async function request(path, options = {}) {
  // FormData (subida de ficheros) no debe llevar Content-Type manual: el
  // navegador necesita fijar el boundary del multipart el mismo.
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { 'X-Club': getClub(), ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', 'X-Club': getClub(), ...(options.headers || {}) };

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
  let responseText = '';
  try {
    responseText = await res.text();
    body = responseText ? JSON.parse(responseText) : null;
  } catch (_) {
    // Respuesta sin cuerpo JSON (p.ej. 204 o una pagina HTML de error).
  }

  if (!res.ok) {
    const fallbackMessage =
      responseText && responseText.trim()
        ? responseText.trim().startsWith('<')
          ? `El backend no devolvio JSON en ${path}. Revisa el despliegue de la API en Vercel.`
          : `Error ${res.status} al llamar a ${path}.`
        : res.status >= 500
          ? `El backend devolvio un error ${res.status} sin detalle en ${path}. Revisa los logs de la API.`
          : 'Ha ocurrido un error inesperado.';
    throw new ApiError(body?.error || fallbackMessage, res.status);
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
