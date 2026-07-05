import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { useFiltroEquipos } from '../context/FiltroEquiposContext';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';
import { api } from '../lib/api';
import { LATERALIDAD_OPCIONES, DEMARCACION_OPCIONES } from '../lib/campos';

const COLORES_MUNICIPIOS = [
  '#2a78d6',
  '#1baf7a',
  '#eda100',
  '#008300',
  '#4a3aa7',
  '#e34948',
  '#e87ba4',
  '#eb6834',
];

const TOP_MUNICIPIOS_CIRCULAR = 7;

function normalizarLocalidad(valor) {
  let v = valor.trim();
  v = v.replace(/\(.*$/, '').trim();
  v = v.replace(/[.,]+$/, '').trim();
  v = v.replace(/\s+/g, ' ');
  v = v.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return v;
}

function polarToCartesian(cx, cy, radio, anguloGrados) {
  const anguloRad = ((anguloGrados - 90) * Math.PI) / 180;
  return { x: cx + radio * Math.cos(anguloRad), y: cy + radio * Math.sin(anguloRad) };
}

function arcoSvg(cx, cy, radio, anguloInicio, anguloFin) {
  const inicio = polarToCartesian(cx, cy, radio, anguloFin);
  const fin = polarToCartesian(cx, cy, radio, anguloInicio);
  const arcoGrande = anguloFin - anguloInicio > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${inicio.x} ${inicio.y} A ${radio} ${radio} 0 ${arcoGrande} 0 ${fin.x} ${fin.y} Z`;
}

function detectarMovil() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function ordenarJugadoresAlfabeticamente(jugadores) {
  return [...jugadores].sort((a, b) => {
    const nombreA = `${a.nombre || ''} ${a.primer_apellido || ''} ${a.segundo_apellido || ''}`.trim();
    const nombreB = `${b.nombre || ''} ${b.primer_apellido || ''} ${b.segundo_apellido || ''}`.trim();
    return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
  });
}

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
  const [filtroAnio, setFiltroAnio] = useState('');
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');
  const { vista } = useVistaPlantillas();
  const [esMovil, setEsMovil] = useState(detectarMovil);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const actualizar = () => setEsMovil(mediaQuery.matches);

    actualizar();
    mediaQuery.addEventListener('change', actualizar);
    return () => mediaQuery.removeEventListener('change', actualizar);
  }, []);

  const vistaVisible = esMovil ? 'tabla' : vista;

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

  const jugadoresFiltrados = ordenarJugadoresAlfabeticamente(
    jugadores.filter((j) => {
      if (filtroLateralidad && j.lateralidad !== filtroLateralidad) return false;
      if (filtroDemarcacion && j.demarcacion !== filtroDemarcacion) return false;
      if (filtroAnio && String(anioNacimiento(j.fecha_nacimiento) || '') !== filtroAnio) return false;
      return true;
    })
  );

  const aniosDisponibles = useMemo(() => {
    const anios = new Set();
    jugadores.forEach((j) => {
      const anio = anioNacimiento(j.fecha_nacimiento);
      if (anio) anios.add(anio);
    });
    return Array.from(anios).sort((a, b) => b - a);
  }, [jugadores]);

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

  const renderIconoOjo = () => (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M10 3.5c-4.14 0-7.4 2.6-9 6.5 1.6 3.9 4.86 6.5 9 6.5s7.4-2.6 9-6.5c-1.6-3.9-4.86-6.5-9-6.5zm0 10.83A4.33 4.33 0 1110 5.67a4.33 4.33 0 010 8.66zm0-6.83a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
    </svg>
  );

  const renderGraficas = (lista) => {
    const porEquipo = contarPor(lista, (j) => j.equipo);
    const porDemarcacion = contarPor(lista, (j) => j.demarcacion);
    const porLateralidad = contarPor(lista, (j) => j.lateralidad);
    const porAnio = contarPor(lista, (j) => anioNacimiento(j.fecha_nacimiento));
    const conLocalidad = lista.filter((j) => j.localidad && j.localidad.trim() !== '');
    const conteoPorMunicipio = conLocalidad.reduce((acc, j) => {
      const municipio = normalizarLocalidad(j.localidad);
      (acc[municipio] ||= []).push(j);
      return acc;
    }, {});
    const filasMunicipio = Object.entries(conteoPorMunicipio)
      .map(([municipio, jugadoresMunicipio]) => ({ municipio, total: jugadoresMunicipio.length }))
      .sort((a, b) => b.total - a.total || a.municipio.localeCompare(b.municipio));
    const totalMunicipios = filasMunicipio.reduce((sum, f) => sum + f.total, 0);
    const maxMunicipios = filasMunicipio.reduce((max, f) => Math.max(max, f.total), 0);
    const filasCircular =
      filasMunicipio.length <= TOP_MUNICIPIOS_CIRCULAR
        ? filasMunicipio
        : [
            ...filasMunicipio.slice(0, TOP_MUNICIPIOS_CIRCULAR),
            {
              municipio: 'Otros',
              total: filasMunicipio.slice(TOP_MUNICIPIOS_CIRCULAR).reduce((sum, f) => sum + f.total, 0),
            },
          ];

    let anguloAcumulado = 0;
    const sectoresMunicipio = filasCircular.map((f, i) => {
      const porcentaje = totalMunicipios > 0 ? (f.total / totalMunicipios) * 100 : 0;
      const anguloInicio = anguloAcumulado;
      const anguloFin = anguloAcumulado + (porcentaje / 100) * 360;
      anguloAcumulado = anguloFin;
      const anguloMedio = (anguloInicio + anguloFin) / 2;
      const puntoEtiqueta = polarToCartesian(100, 100, 65, anguloMedio);
      return {
        ...f,
        porcentaje,
        color: COLORES_MUNICIPIOS[i % COLORES_MUNICIPIOS.length],
        path: arcoSvg(100, 100, 100, anguloInicio, anguloFin),
        etiquetaX: puntoEtiqueta.x,
        etiquetaY: puntoEtiqueta.y,
      };
    });

    const renderGraficaCircularMunicipios = () => (
      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-club-black/70 mb-4">
          Distribución por municipio
        </h3>
        {filasMunicipio.length === 0 ? (
          <p className="text-sm text-club-black/50">Sin datos disponibles.</p>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <svg viewBox="0 0 200 200" className="w-56 h-56 shrink-0" role="img" aria-label="Gráfica circular de jugadores por municipio">
              {sectoresMunicipio.map((s) => (
                <path key={s.municipio} d={s.path} fill={s.color} stroke="#fcfcfb" strokeWidth="2" />
              ))}
              {sectoresMunicipio
                .filter((s) => s.porcentaje >= 8)
                .map((s) => (
                  <text
                    key={`etq-${s.municipio}`}
                    x={s.etiquetaX}
                    y={s.etiquetaY}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="600"
                  >
                    <tspan x={s.etiquetaX} dy="-2">{`${Math.round(s.porcentaje)}%`}</tspan>
                    <tspan x={s.etiquetaX} dy="12">{`(${s.total})`}</tspan>
                  </text>
                ))}
            </svg>
            <ul className="w-full max-w-xs flex flex-col gap-1.5">
              {sectoresMunicipio.map((s) => (
                <li key={s.municipio} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <span className="text-club-black flex-1 truncate" title={s.municipio}>
                    {s.municipio}
                  </span>
                  <span className="text-club-black/70 tabular-nums">{s.total}</span>
                  <span className="text-club-black/50 tabular-nums w-14 text-right">
                    {s.porcentaje.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

    const renderGraficaBarrasMunicipios = () => (
      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-club-black/70 mb-4">
          Jugadores por municipio
        </h3>
        {filasMunicipio.length === 0 ? (
          <p className="text-sm text-club-black/50">Sin datos disponibles.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filasMunicipio.map((f) => {
              const anchoPct = maxMunicipios > 0 ? (f.total / maxMunicipios) * 100 : 0;
              return (
                <div key={f.municipio} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-club-black truncate" title={f.municipio}>
                      {f.municipio}
                    </span>
                    <span className="text-sm text-club-black/70 shrink-0 tabular-nums">{f.total}</span>
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

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderBarras('Jugadores por equipo', porEquipo)}
        {renderBarras('Jugadores por demarcación', porDemarcacion)}
        {renderBarras('Jugadores por lateralidad', porLateralidad)}
        {renderBarras('Jugadores por año de nacimiento', porAnio, { ordenNumerico: true })}
        {renderGraficaCircularMunicipios()}
        {renderGraficaBarrasMunicipios()}
      </div>
    );
  };

  const renderTablaJugadores = (lista) => (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-200">
      <table className="w-full divide-y divide-gray-200 bg-white text-sm sm:text-base">
        <thead className="bg-club-black text-white sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2 sm:px-4 sm:py-3" />
            <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Nombre</th>
            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fecha nacimiento</th>
            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Año</th>
            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Edad</th>
            <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Dorsal</th>
            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Lateralidad</th>
            <th className="hidden min-[380px]:table-cell px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Demarcación</th>
            <th className="px-2 py-2 sm:px-4 sm:py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lista.map((j) => (
            <tr key={j.id} className="hover:bg-red-50/40 transition-colors">
              <td className="px-2 py-2 sm:px-4 sm:py-3">
                {j.foto_url ? (
                  <img
                    src={j.foto_url}
                    alt={`Foto de ${j.nombre}`}
                    className="w-7 h-7 sm:w-9 sm:h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gray-200 flex items-center justify-center text-[8px] sm:text-[9px] text-club-black/40">
                    S/F
                  </div>
                )}
              </td>
              <td className="px-2 py-2 sm:px-4 sm:py-3 font-medium text-club-black max-w-[120px] sm:max-w-none truncate">
                {j.nombre} {j.primer_apellido} {j.segundo_apellido || ''}
              </td>
              <td className="hidden sm:table-cell px-4 py-3 text-club-black/80">{formatearFecha(j.fecha_nacimiento) || '-'}</td>
              <td className="hidden md:table-cell px-4 py-3 text-club-black/80">{anioNacimiento(j.fecha_nacimiento) ?? '-'}</td>
              <td className="hidden md:table-cell px-4 py-3 text-club-black/80">{calcularEdad(j.fecha_nacimiento) ?? '-'}</td>
              <td className="px-2 py-2 sm:px-4 sm:py-3 text-club-black/80">{j.dorsal ?? '-'}</td>
              <td className="hidden lg:table-cell px-4 py-3 text-club-black/80">{j.lateralidad || '-'}</td>
              <td className="hidden min-[380px]:table-cell px-2 py-2 sm:px-4 sm:py-3 text-club-black/80 max-w-[110px] truncate">{j.demarcacion || '-'}</td>
              <td className="px-2 py-2 sm:px-4 sm:py-3 text-right">
                <Link
                  to={`/plantillas/${j.id}`}
                  className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-club-red hover:bg-red-50 hover:text-club-redDark transition-colors"
                  aria-label={`Ver ficha de ${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim()}
                  title={`Ver ficha de ${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim()}
                >
                  {renderIconoOjo()}
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
            Año de nacimiento: {anioNacimiento(j.fecha_nacimiento) ?? '-'}
          </p>
          <p className="text-sm text-club-black/60">
            Lateralidad: {j.lateralidad || '-'}
          </p>
          <p className="text-sm text-club-black/60">
            Demarcación: {j.demarcacion || '-'}
          </p>
          <Link
            to={`/plantillas/${j.id}`}
            className="mt-2 inline-flex items-center justify-center w-8 h-8 rounded-full text-club-red hover:bg-red-50 hover:text-club-redDark transition-colors"
            aria-label={`Ver ficha de ${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim()}
            title={`Ver ficha de ${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim()}
          >
            {renderIconoOjo()}
          </Link>
        </div>
      ))}
    </div>
  );

  const renderJugadores = (lista) =>
    vistaVisible === 'tabla' ? renderTablaJugadores(lista) : renderTarjetasJugadores(lista);

  const renderContadorRegistros = (total) => (
    <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
      <span className="text-2xl font-bold text-club-red tabular-nums">{total}</span>
      <span className="text-sm font-medium text-club-black/70">{total === 1 ? 'jugador' : 'jugadores'}</span>
    </div>
  );

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
      <select
        value={filtroAnio}
        onChange={(e) => setFiltroAnio(e.target.value)}
        className="w-full sm:w-auto rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
      >
        <option value="">Todos los años</option>
        {aniosDisponibles.map((anio) => (
          <option key={anio} value={anio}>
            {anio}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Plantillas</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <div className="hidden md:block w-full lg:w-auto">
            {renderFiltrosDeportivos()}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={handleActualizar}
              disabled={refrescando}
              className="w-full sm:w-auto self-start sm:self-auto bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
            >
              {refrescando ? 'Actualizando...' : 'Actualizar datos'}
            </button>
            {esAdministrador && (
              <button
                onClick={handleSincronizar}
                disabled={sincronizando}
                className="w-full sm:w-auto self-start sm:self-auto bg-club-black hover:bg-black disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
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
            {!loading && !error && renderContadorRegistros(jugadoresFiltrados.length)}
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
          ) : vistaVisible === 'graficas' ? (
            renderGraficas(jugadoresFiltrados)
          ) : (
            renderJugadores(jugadoresFiltrados)
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <div>
            {renderFiltroEquipos()}
          </div>

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
            ) : vistaVisible === 'graficas' ? (
              <>
                <div className="mb-4">{renderContadorRegistros(jugadoresFiltrados.length)}</div>
                {renderGraficas(jugadoresFiltrados)}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {equiposSeleccionados.length === 1 && (
                    <Link
                      to={`/campogramas?equipo=${encodeURIComponent(equiposSeleccionados[0])}`}
                      className="inline-flex items-center gap-1.5 bg-club-red hover:bg-club-redDark text-white font-semibold px-3 py-1.5 rounded-md text-sm transition-colors"
                    >
                      <span className="text-base leading-none">+</span> Campograma
                    </Link>
                  )}
                  {renderContadorRegistros(jugadoresFiltrados.length)}
                </div>
                {renderJugadores(jugadoresFiltrados)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
