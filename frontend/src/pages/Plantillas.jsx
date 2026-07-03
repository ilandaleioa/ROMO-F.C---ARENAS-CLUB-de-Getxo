import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { useFiltroEquipos } from '../context/FiltroEquiposContext';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';
import { api } from '../lib/api';
import { LATERALIDAD_OPCIONES, DEMARCACION_OPCIONES } from '../lib/campos';

export default function Plantillas() {
  const { user } = useAuth();
  const { club } = useClub();
  const esTecnico = user.rol === 'tecnico' && user.equipo_asignado !== 'Todos';
  const esAdministrador = user.rol === 'administrador';
  const { equiposDisponibles, equiposSeleccionados, seleccionarEquipoUnico, limpiarSeleccion, recargarEquipos } =
    useFiltroEquipos();

  const [busqueda, setBusqueda] = useState('');
  const [filtroLateralidad, setFiltroLateralidad] = useState('');
  const [filtroDemarcacion, setFiltroDemarcacion] = useState('');
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');
  const { vista } = useVistaPlantillas();

  const cargarJugadores = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (!esTecnico) equiposSeleccionados.forEach((eq) => params.append('equipo', eq));
      if (busqueda.trim()) params.set('q', busqueda.trim());
      const { jugadores } = await api.get(`/jugadores?${params.toString()}`);
      setJugadores(jugadores);
    } catch (err) {
      setError(err.message);
    }
  }, [club, esTecnico, equiposSeleccionados, busqueda]);

  useEffect(() => {
    setLoading(true);
    cargarJugadores().finally(() => setLoading(false));
  }, [cargarJugadores]);

  const handleActualizar = async () => {
    setRefrescando(true);
    try {
      await recargarEquipos();
      await cargarJugadores();
    } finally {
      setRefrescando(false);
    }
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    setMensajeSync('');
    try {
      const resultado = await api.post('/jugadores/sync');
      const motivos = resultado.omisiones_por_motivo || {};
      const detallesOmisiones = Object.entries(motivos)
        .map(([motivo, total]) => `${total} por ${motivo}`)
        .join(', ');
      setMensajeSync(
        `Sincronización completada: ${resultado.insertados} jugador(es) nuevo(s) importado(s)` +
          (resultado.omitidos
            ? `, ${resultado.omitidos} fila(s) omitida(s) por datos incompletos${
                detallesOmisiones ? ` (${detallesOmisiones})` : ''
              }.`
            : '.')
      );
      await recargarEquipos();
      await cargarJugadores();
    } catch (err) {
      setMensajeSync(err.message);
    } finally {
      setSincronizando(false);
    }
  };

  const jugadoresFiltrados = jugadores.filter((j) => {
    if (filtroLateralidad && j.lateralidad !== filtroLateralidad) return false;
    if (filtroDemarcacion && j.demarcacion !== filtroDemarcacion) return false;
    return true;
  });

  const jugadoresPorEquipo = jugadoresFiltrados.reduce((acc, j) => {
    (acc[j.equipo] ||= []).push(j);
    return acc;
  }, {});
  const gruposEquipos = Object.keys(jugadoresPorEquipo).sort((a, b) => a.localeCompare(b));

  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const nacimiento = new Date(fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const noHaCumplidoAun =
      hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (noHaCumplidoAun) edad -= 1;
    return edad;
  };

  const formatearFecha = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const [anio, mes, dia] = fechaNacimiento.split('-');
    if (!anio || !mes || !dia) return fechaNacimiento;
    return `${dia}-${mes}-${anio}`;
  };

  const anioNacimiento = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const nacimiento = new Date(fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    return nacimiento.getFullYear();
  };

  const contarPor = (lista, obtenerClave) =>
    lista.reduce((acc, j) => {
      const clave = obtenerClave(j);
      const etiqueta = clave === null || clave === undefined || clave === '' ? 'Sin dato' : String(clave);
      acc[etiqueta] = (acc[etiqueta] || 0) + 1;
      return acc;
    }, {});

  const renderBarras = (titulo, conteo, { ordenNumerico = false } = {}) => {
    const entradas = Object.entries(conteo);
    const filas = ordenNumerico
      ? entradas.sort(([a], [b]) => {
          if (a === 'Sin dato') return 1;
          if (b === 'Sin dato') return -1;
          return Number(a) - Number(b);
        })
      : entradas.sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b));
    const maxTotal = filas.reduce((max, [, total]) => Math.max(max, total), 0);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-club-black/70 mb-4">{titulo}</h3>
        {filas.length === 0 ? (
          <p className="text-sm text-club-black/50">Sin datos disponibles.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filas.map(([etiqueta, total]) => {
              const anchoPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
              return (
                <div key={etiqueta} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-club-black truncate" title={etiqueta}>
                      {etiqueta}
                    </span>
                    <span className="text-sm text-club-black/70 shrink-0 tabular-nums">{total}</span>
                  </div>
                  <span className="block w-full h-4 rounded-sm bg-gray-100 overflow-hidden">
                    <span
                      className="block h-full rounded-sm bg-club-red transition-all"
                      style={{ width: `${anchoPct}%` }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderGraficas = (lista) => {
    const porEquipo = contarPor(lista, (j) => j.equipo);
    const porDemarcacion = contarPor(lista, (j) => j.demarcacion);
    const porLateralidad = contarPor(lista, (j) => j.lateralidad);
    const porAnio = contarPor(lista, (j) => anioNacimiento(j.fecha_nacimiento));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderBarras('Jugadores por equipo', porEquipo)}
        {renderBarras('Jugadores por demarcación', porDemarcacion)}
        {renderBarras('Jugadores por lateralidad', porLateralidad)}
        {renderBarras('Jugadores por año de nacimiento', porAnio, { ordenNumerico: true })}
      </div>
    );
  };

  const renderTablaJugadores = (lista) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-club-black text-white">
          <tr>
            <th className="px-4 py-3" />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nombre</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fecha nacimiento</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Año</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Edad</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Dorsal</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Lateralidad</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Demarcación</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lista.map((j) => (
            <tr key={j.id} className="hover:bg-red-50/40 transition-colors">
              <td className="px-4 py-3">
                {j.foto_url ? (
                  <img
                    src={j.foto_url}
                    alt={`Foto de ${j.nombre}`}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-club-black/40">
                    S/F
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-club-black">
                {j.nombre} {j.primer_apellido} {j.segundo_apellido || ''}
              </td>
              <td className="px-4 py-3 text-club-black/80">{formatearFecha(j.fecha_nacimiento) || '-'}</td>
              <td className="px-4 py-3 text-club-black/80">{anioNacimiento(j.fecha_nacimiento) ?? '-'}</td>
              <td className="px-4 py-3 text-club-black/80">{calcularEdad(j.fecha_nacimiento) ?? '-'}</td>
              <td className="px-4 py-3 text-club-black/80">{j.dorsal ?? '-'}</td>
              <td className="px-4 py-3 text-club-black/80">{j.lateralidad || '-'}</td>
              <td className="px-4 py-3 text-club-black/80">{j.demarcacion || '-'}</td>
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
          <div className="flex items-center gap-3 mb-1">
            {j.foto_url ? (
              <img
                src={j.foto_url}
                alt={`Foto de ${j.nombre}`}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-club-black/40 shrink-0">
                S/F
              </div>
            )}
            <p className="font-semibold text-club-black">
              {j.nombre} {j.primer_apellido} {j.segundo_apellido || ''}
            </p>
          </div>
          <p className="text-sm text-club-black/80">{j.equipo}</p>
          <p className="text-sm text-club-black/60">
            Fecha nacimiento: {formatearFecha(j.fecha_nacimiento) || '-'}
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

  const renderFiltroEquipos = () => (
    <aside className="md:w-64 shrink-0">
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={limpiarSeleccion}
          className={`w-full text-left px-4 py-2.5 text-sm font-semibold border-b border-gray-100 transition-colors ${
            equiposSeleccionados.length === 0
              ? 'bg-club-red text-white'
              : 'text-club-black hover:bg-red-50/60'
          }`}
        >
          Todos los equipos
        </button>
        {equiposDisponibles.map((eq) => (
          <label
            key={eq}
            className="flex items-center gap-2 px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 text-club-black/80 hover:bg-red-50/60 cursor-pointer"
          >
            <input
              type="radio"
              name="filtro-equipo"
              checked={equiposSeleccionados.includes(eq)}
              onClick={() => seleccionarEquipoUnico(eq)}
              onChange={() => {}}
              className="h-4 w-4 accent-club-red"
            />
            {eq}
          </label>
        ))}
      </div>
    </aside>
  );

  const renderFiltrosDeportivos = () => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-full sm:w-48 flex flex-col gap-1">
        <label htmlFor="filtro-jugadores" className="text-xs font-semibold text-club-black/60 uppercase tracking-wide">
          Jugadores
        </label>
        <input
          id="filtro-jugadores"
          type="text"
          placeholder="Buscar por nombre o apellidos..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
        />
      </div>
      <select
        value={filtroLateralidad}
        onChange={(e) => setFiltroLateralidad(e.target.value)}
        className="w-full sm:w-auto rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
      >
        <option value="">Todas las lateralidades</option>
        {LATERALIDAD_OPCIONES.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
      <select
        value={filtroDemarcacion}
        onChange={(e) => setFiltroDemarcacion(e.target.value)}
        className="w-full sm:w-auto rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
      >
        <option value="">Todas las demarcaciones</option>
        {DEMARCACION_OPCIONES.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Plantillas</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {renderFiltrosDeportivos()}
          <div className="flex items-center gap-3">
            <button
              onClick={handleActualizar}
              disabled={refrescando}
              className="self-start sm:self-auto bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
            >
              {refrescando ? 'Actualizando...' : 'Actualizar datos'}
            </button>
            {esAdministrador && (
              <button
                onClick={handleSincronizar}
                disabled={sincronizando}
                className="self-start sm:self-auto bg-club-black hover:bg-black disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
              >
                {sincronizando ? 'Sincronizando...' : 'Sincronizar Google Sheets'}
              </button>
            )}
          </div>
        </div>
      </div>

      {mensajeSync && (
        <p className="text-sm text-club-black bg-gray-100 border border-gray-200 rounded-md px-3 py-2 mb-4">
          {mensajeSync}
        </p>
      )}

      {esTecnico ? (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="text-sm font-semibold bg-club-black text-white px-4 py-2 rounded-md inline-block">
              Equipo: {user.equipo_asignado || 'sin asignar'}
            </div>
            {user.equipo_asignado && (
              <Link
                to={`/campogramas?equipo=${encodeURIComponent(user.equipo_asignado)}`}
                className="inline-flex items-center gap-1.5 bg-club-red hover:bg-club-redDark text-white font-semibold px-3 py-2 rounded-md text-sm transition-colors"
              >
                <span className="text-base leading-none">+</span> Campograma
              </Link>
            )}
          </div>
          {error && (
            <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
              {error}
            </p>
          )}
          {loading ? (
            <p className="text-club-black/60">Cargando jugadores...</p>
          ) : error ? null : jugadoresFiltrados.length === 0 ? (
            <p className="text-club-black/60">No se han encontrado jugadores.</p>
          ) : vista === 'graficas' ? (
            renderGraficas(jugadoresFiltrados)
          ) : (
            renderJugadores(jugadoresFiltrados)
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {renderFiltroEquipos()}

          <div className="flex-1 min-w-0">
            {error && (
              <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-club-black/60">Cargando jugadores...</p>
            ) : jugadoresFiltrados.length === 0 ? (
              <p className="text-club-black/60">No se han encontrado jugadores.</p>
            ) : vista === 'graficas' ? (
              renderGraficas(jugadoresFiltrados)
            ) : (
              <div className="space-y-8">
                {gruposEquipos.map((eq) => (
                  <div key={eq}>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-club-black">{eq}</h3>
                      <Link
                        to={`/campogramas?equipo=${encodeURIComponent(eq)}`}
                        className="inline-flex items-center gap-1.5 bg-club-red hover:bg-club-redDark text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors"
                      >
                        <span className="text-base leading-none">+</span> Campograma
                      </Link>
                    </div>
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
