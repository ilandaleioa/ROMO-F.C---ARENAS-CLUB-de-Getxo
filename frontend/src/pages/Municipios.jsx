import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export default function Municipios() {
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [municipioExpandido, setMunicipioExpandido] = useState(null);

  const cargarJugadores = useCallback(async () => {
    setError('');
    try {
      const { jugadores } = await api.get('/jugadores');
      setJugadores(jugadores);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    cargarJugadores().finally(() => setLoading(false));
  }, [cargarJugadores]);

  const conLocalidad = jugadores.filter((j) => j.localidad && j.localidad.trim() !== '');

  const conteoPorMunicipio = conLocalidad.reduce((acc, j) => {
    const municipio = j.localidad.trim();
    (acc[municipio] ||= []).push(j);
    return acc;
  }, {});

  const filas = Object.entries(conteoPorMunicipio)
    .map(([municipio, lista]) => ({ municipio, total: lista.length, jugadores: lista }))
    .sort((a, b) => b.total - a.total || a.municipio.localeCompare(b.municipio));

  const maxTotal = filas.reduce((max, f) => Math.max(max, f.total), 0);

  const toggleMunicipio = (municipio) => {
    setMunicipioExpandido((actual) => (actual === municipio ? null : municipio));
  };

  const renderTablaEmbebida = (f) => (
    <div className="mt-2 mb-1 overflow-x-auto rounded-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-club-black/70">Nombre</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-club-black/70">Equipo</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-club-black/70">Municipio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {f.jugadores.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-2 text-club-black">
                {`${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim()}
              </td>
              <td className="px-4 py-2 text-club-black/80">{j.equipo || '-'}</td>
              <td className="px-4 py-2 text-club-black/80">{f.municipio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderGrafica = () => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        {filas.map((f) => {
          const anchoPct = maxTotal > 0 ? (f.total / maxTotal) * 100 : 0;
          const expandido = municipioExpandido === f.municipio;
          return (
            <div key={f.municipio}>
              <button
                type="button"
                onClick={() => toggleMunicipio(f.municipio)}
                className={`w-full flex items-center gap-3 py-1.5 rounded-md transition-colors ${
                  expandido ? 'bg-red-50/60' : 'hover:bg-gray-50'
                }`}
                aria-expanded={expandido}
              >
                <span className="w-full flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-sm font-medium text-club-black text-left leading-tight"
                      title={f.municipio}
                    >
                      {f.municipio}
                    </span>
                    <span className="text-sm font-semibold text-club-black shrink-0">{f.total}</span>
                  </span>
                  <span className="block w-full h-5 rounded-sm bg-gray-100 overflow-hidden">
                    <span
                      className="block h-full rounded-sm bg-club-red transition-all"
                      style={{ width: `${anchoPct}%` }}
                    />
                  </span>
                </span>
              </button>
              {expandido && renderTablaEmbebida(f)}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Municipios</h2>
      </div>

      {error && (
        <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-club-black/60">Cargando datos...</p>
      ) : error ? null : filas.length === 0 ? (
        <p className="text-club-black/60">No hay datos de localidad disponibles.</p>
      ) : (
        renderGrafica()
      )}
    </div>
  );
}
