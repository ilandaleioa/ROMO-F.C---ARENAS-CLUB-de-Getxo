const DEFAULT_URL = 'https://deployvercel-alpha-nine.vercel.app/';

// Solo se admite una URL https: evita que una variable mal configurada cargue
// esquemas peligrosos (javascript:, data:) dentro del iframe.
export function urlEstadisticas() {
  const configurada = import.meta.env.VITE_ESTADISTICAS_URL?.trim();
  try {
    const url = new URL(configurada || DEFAULT_URL);
    return url.protocol === 'https:' ? url.href : DEFAULT_URL;
  } catch (_) {
    return DEFAULT_URL;
  }
}
