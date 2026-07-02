import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Plantillas() {
  const { user } = useAuth();
  const esTecnico = user.rol === 'tecnico';

  const [equipos, setEquipos] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [vista, setVista] = useState('tabla');

  const cargarEquipos = useCallback(async () => {
    if (esTecnico) return;
    try {
      const { equipos } = await api.get('/jugadores/equipos');
      setEquipos(equipos);
    } catch (err) {
      setError(err.message);
    }
  }, [esTecnico]);

  const cargarJugadores = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (!esTecnico && equipoSeleccionado) params.set('equipo', equipoSeleccionado);
      if (busqueda.trim()) params.set('q', busqueda.trim());
      const { jugadores } = await api.get(`/jugadores?${params.toString()}`);
      setJugadores(jugadores);
    } catch (err) {
      setError(err.message);
    }
  }, [esTecnico, equipoSeleccionado, busqueda]);

  useEffect(() => {
    cargarEquipos();
  }, [cargarEquipos]);

  useEffect(() => {
    setLoading(true);
    cargarJugadores().finally(() => setLoading(false));
  }, [cargarJugadores]);

  const handleActualizar = async () => {
    setRefrescando(true);
    try {
      await cargarEquipos();
      await cargarJugadores();
    } finally {
      setRefrescando(false);
    }
  };

  const jugadoresPorEquipo = jugadores.reduce((acc, j) => {
    (acc[j.equipo] ||= []).push(j);
    return acc;
  }, {});
  const gruposEquipos = Object.keys(jugadoresPorEquipo).sort((a, b) => a.localeCompare(b));

  const renderTablaJugadores = (lista) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-club-black text-white">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nombre</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fecha nacimiento</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lista.map((j) => (
            <tr key={j.id} className="hover:bg-red-50/40 transition-colors">
              <td className="px-4 py-3 font-medium text-club-black">
                {j.nombre} {j.primer_apellido} {j.segundo_apellido || ''}
              </td>
              <td className="px-4 py-3 text-club-black/80">{j.equipo}</td>
              <td className="px-4 py-3 text-club-black/80">{j.fecha_nacimiento || '-'}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/plantillas/${j.id}`}
                  className="text-club-red font-semibold hover:underline text-sm"
                >
                  Ver ficha
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTarjetasJugadores = (lista) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {lista.map((j) => (
        <div
          key={j.id}
          className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-1 hover:shadow-md transition-shadow"
        >
          <p className="font-semibold text-club-black">
            {j.nombre} {j.primer_apellido} {j.segundo_apellido || ''}
          </p>
          <p className="text-sm text-club-black/80">{j.equipo}</p>
          <p className="text-sm text-club-black/60">
            Fecha nacimiento: {j.fecha_nacimiento || '-'}
          </p>
          <Link
            to={`/plantillas/${j.id}`}
            className="mt-2 text-club-red font-semibold hover:underline text-sm"
          >
            Ver ficha
          </Link>
        </div>
      ))}
    </div>
  );

  const renderJugadores = (lista) =>
    vista === 'tabla' ? renderTablaJugadores(lista) : renderTarjetasJugadores(lista);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Plantillas</h2>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setVista('tabla')}
              className={`px-3 py-2 text-sm font-semibold transition-colors ${
                vista === 'tabla' ? 'bg-club-red text-white' : 'bg-white text-club-black hover:bg-red-50/60'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => setVista('tarjeta')}
              className={`px-3 py-2 text-sm font-semibold border-l border-gray-300 transition-colors ${
                vista === 'tarjeta' ? 'bg-club-red text-white' : 'bg-white text-club-black hover:bg-red-50/60'
              }`}
            >
              Tarjetas
            </button>
          </div>
          <button
            onClick={handleActualizar}
            disabled={refrescando}
            className="self-start sm:self-auto bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            {refrescando ? 'Actualizando...' : 'Actualizar datos'}
          </button>
        </div>
      </div>

      {esTecnico ? (
        <div className="mb-6">
          <div className="text-sm font-semibold bg-club-black text-white px-4 py-2 rounded-md inline-block mb-4">
            Equipo: {user.equipo_asignado || 'sin asignar'}
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o apellidos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red mb-4"
          />
          {error && (
            <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
              {error}
            </p>
          )}
          {loading ? (
            <p className="text-club-black/60">Cargando jugadores...</p>
          ) : jugadores.length === 0 ? (
            <p className="text-club-black/60">No se han encontrado jugadores.</p>
          ) : (
            renderJugadores(jugadores)
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-64 shrink-0">
            <input
              type="text"
              placeholder="Buscar por nombre o apellidos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red mb-3"
            />
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                onClick={() => setEquipoSeleccionado('')}
                className={`w-full text-left px-4 py-2.5 text-sm font-semibold border-b border-gray-100 transition-colors ${
                  equipoSeleccionado === ''
                    ? 'bg-club-red text-white'
                    : 'text-club-black hover:bg-red-50/60'
                }`}
              >
                Todos los equipos
              </button>
              {equipos.map((eq) => (
                <button
                  key={eq}
                  onClick={() => setEquipoSeleccionado(eq)}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                    equipoSeleccionado === eq
                      ? 'bg-club-red text-white font-semibold'
                      : 'text-club-black/80 hover:bg-red-50/60'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {error && (
              <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-club-black/60">Cargando jugadores...</p>
            ) : jugadores.length === 0 ? (
              <p className="text-club-black/60">No se han encontrado jugadores.</p>
            ) : equipoSeleccionado ? (
              renderJugadores(jugadores)
            ) : (
              <div className="space-y-8">
                {gruposEquipos.map((eq) => (
                  <div key={eq}>
                    <h3 className="text-lg font-bold text-club-black mb-2">{eq}</h3>
                    {renderJugadores(jugadoresPorEquipo[eq])}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
