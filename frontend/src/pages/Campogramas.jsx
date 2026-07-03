import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';
import { DEMARCACION_OPCIONES } from '../lib/campos';

const MAX_JUGADORES_POR_PUESTO = 3;

function nombreCompleto(j) {
  return `${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim();
}

export default function Campogramas() {
  const { user } = useAuth();
  const { club } = useClub();
  const navigate = useNavigate();
  const esTecnico = user.rol === 'tecnico' && user.equipo_asignado !== 'Todos';
  const puedeEditar = ['administrador', 'responsable', 'tecnico'].includes(user.rol);
  const [searchParams] = useSearchParams();
  const equipoInicial = searchParams.get('equipo') || '';

  const [sistemas, setSistemas] = useState([]);
  const [sistemaId, setSistemaId] = useState('');
  const [equipos, setEquipos] = useState([]);
  const [equipo, setEquipo] = useState('');
  const [jugadores, setJugadores] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [posicionEligiendo, setPosicionEligiendo] = useState(null);
  const [busquedaModal, setBusquedaModal] = useState('');
  const [seleccionModal, setSeleccionModal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const sistema = useMemo(() => sistemas.find((s) => s.id === sistemaId) || null, [sistemas, sistemaId]);

  useEffect(() => {
    (async () => {
      try {
        const [{ sistemas: listaSistemas }, { equipos: listaEquipos }] = await Promise.all([
          api.get('/campogramas/sistemas'),
          api.get('/jugadores/equipos'),
        ]);
        setSistemas(listaSistemas);
        setSistemaId(listaSistemas[0]?.id || '');
        setEquipos(listaEquipos);
        if (esTecnico) {
          setEquipo(user.equipo_asignado || '');
        } else if (equipoInicial && listaEquipos.includes(equipoInicial)) {
          setEquipo(equipoInicial);
        } else {
          setEquipo(listaEquipos[0] || '');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [esTecnico, user.equipo_asignado, equipoInicial, club]);

  const cargarDatos = useCallback(async () => {
    if (!equipo || !sistemaId) return;
    setError('');
    setAviso('');
    try {
      const params = new URLSearchParams({ equipo, sistema: sistemaId });
      const [{ jugadores: listaJugadores }, { campograma }] = await Promise.all([
        api.get(`/jugadores?equipo=${encodeURIComponent(equipo)}`),
        api.get(`/campogramas?${params.toString()}`),
      ]);
      setJugadores(listaJugadores);
      const asignacionesRecibidas = campograma?.asignaciones || {};
      const asignacionesValidas = {};
      for (const [posicionId, jugadorIdsPuesto] of Object.entries(asignacionesRecibidas)) {
        if (Array.isArray(jugadorIdsPuesto)) {
          asignacionesValidas[posicionId] = jugadorIdsPuesto;
        }
      }
      setAsignaciones(asignacionesValidas);
    } catch (err) {
      setError(err.message);
    }
  }, [equipo, sistemaId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const jugadoresPorId = useMemo(() => {
    const mapa = new Map();
    jugadores.forEach((j) => mapa.set(j.id, j));
    return mapa;
  }, [jugadores]);

  const idsAsignados = useMemo(
    () => new Set(Object.values(asignaciones).filter(Array.isArray).flat()),
    [asignaciones]
  );
  const jugadoresDisponibles = jugadores.filter((j) => !idsAsignados.has(j.id));

  const gruposJugadoresDisponibles = useMemo(() => {
    const grupos = new Map();
    jugadoresDisponibles.forEach((j) => {
      const clave = j.demarcacion || 'Sin demarcación';
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(j);
    });
    const orden = [...DEMARCACION_OPCIONES, 'Sin demarcación'];
    return [...grupos.entries()].sort((a, b) => {
      const ia = orden.indexOf(a[0]);
      const ib = orden.indexOf(b[0]);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [jugadoresDisponibles]);

  const asignarJugadores = (posicionId, jugadorIdsNuevos) => {
    setAsignaciones((prev) => {
      const actuales = prev[posicionId] || [];
      const huecoDisponible = MAX_JUGADORES_POR_PUESTO - actuales.length;
      const aAnadir = jugadorIdsNuevos.filter((id) => !actuales.includes(id)).slice(0, huecoDisponible);
      if (aAnadir.length === 0) return prev;
      return { ...prev, [posicionId]: [...actuales, ...aAnadir] };
    });
    cerrarModal();
  };

  const toggleSeleccionModal = (jugadorId, huecoDisponible) => {
    setSeleccionModal((prev) => {
      if (prev.includes(jugadorId)) return prev.filter((id) => id !== jugadorId);
      if (prev.length >= huecoDisponible) return prev;
      return [...prev, jugadorId];
    });
  };

  const quitarJugador = (posicionId, jugadorId) => {
    setAsignaciones((prev) => {
      const restantes = (prev[posicionId] || []).filter((id) => id !== jugadorId);
      const copia = { ...prev };
      if (restantes.length > 0) copia[posicionId] = restantes;
      else delete copia[posicionId];
      return copia;
    });
  };

  const cerrarModal = () => {
    setPosicionEligiendo(null);
    setBusquedaModal('');
    setSeleccionModal([]);
  };

  const abrirModal = (posicionId) => {
    setPosicionEligiendo(posicionId);
    setSeleccionModal([]);
  };

  const posicionSeleccionada = sistema?.positions.find((p) => p.id === posicionEligiendo) || null;
  const jugadoresDelModal = jugadoresDisponibles.filter((j) =>
    nombreCompleto(j).toLowerCase().includes(busquedaModal.trim().toLowerCase())
  );
  const huecoDisponibleModal = posicionSeleccionada
    ? MAX_JUGADORES_POR_PUESTO - (asignaciones[posicionSeleccionada.id]?.length || 0)
    : 0;

  const guardarCampograma = async () => {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      await api.put('/campogramas', { equipo, sistema: sistemaId, asignaciones });
      setAviso(`Campograma de ${equipo} (${sistema?.label || sistemaId}) guardado.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return <div className="w-full px-4 sm:px-6 py-6 text-club-black/60">Cargando...</div>;
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Campogramas</h2>
        {puedeEditar && (
          <button
            onClick={guardarCampograma}
            disabled={guardando || !equipo}
            className="bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            {guardando ? 'Guardando...' : 'Guardar campograma'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {aviso && (
        <p className="text-sm text-green-700 font-medium bg-green-50 border border-green-300 rounded-md px-3 py-2 mb-4">
          {aviso}
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {!esTecnico && (
          <aside className="md:w-64 shrink-0">
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {equipos.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => setEquipo(eq)}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                    eq === equipo ? 'bg-club-red text-white font-semibold' : 'text-club-black/80 hover:bg-red-50/60'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <select
            value={sistemaId}
            onChange={(e) => setSistemaId(e.target.value)}
            className="w-64 mb-6 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
          >
            {sistemas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {!equipo ? (
            <p className="text-club-black/60">Selecciona un equipo.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3">
            <div className="relative w-full aspect-[3/2] max-w-4xl mx-auto rounded-lg bg-green-700 border-4 border-white/80 overflow-hidden shadow-inner">
              {/* Linea de medio campo y circulo central */}
              <div className="absolute inset-y-0 left-1/2 border-l-2 border-white/60" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[14%] aspect-square rounded-full border-2 border-white/60" />
              {/* Areas */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-[10%] border-2 border-l-0 border-white/60" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-1/2 w-[10%] border-2 border-r-0 border-white/60" />

              {sistema?.positions.map((pos) => {
                const jugadorIds = Array.isArray(asignaciones[pos.id]) ? asignaciones[pos.id] : [];
                const puestoJugadores = jugadorIds.map((id) => jugadoresPorId.get(id)).filter(Boolean);
                const hayHueco = puestoJugadores.length < MAX_JUGADORES_POR_PUESTO;
                return (
                  <div
                    key={pos.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {puestoJugadores.map((jugador) => (
                        <div
                          key={jugador.id}
                          className="flex items-center bg-club-black rounded-full shadow-md overflow-hidden shrink-0"
                        >
                          {jugador.foto_url ? (
                            <img
                              src={jugador.foto_url}
                              alt={nombreCompleto(jugador)}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-500 flex items-center justify-center text-[8px] text-white/80 shrink-0">
                              S/F
                            </div>
                          )}
                          <span className="text-[11px] font-semibold text-white pl-2 pr-1 whitespace-nowrap">
                            {jugador.nombre} {jugador.primer_apellido}
                          </span>
                          {jugador.dorsal !== null && jugador.dorsal !== undefined && jugador.dorsal !== '' && (
                            <span className="w-5 h-5 rounded-full bg-club-red text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {jugador.dorsal}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/plantillas/${jugador.id}`)}
                            title={`Ver ficha de ${nombreCompleto(jugador)}`}
                            className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white shrink-0"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M10 3.5c-4.14 0-7.4 2.6-9 6.5 1.6 3.9 4.86 6.5 9 6.5s7.4-2.6 9-6.5c-1.6-3.9-4.86-6.5-9-6.5zm0 10.83A4.33 4.33 0 1110 5.67a4.33 4.33 0 010 8.66zm0-6.83a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
                            </svg>
                          </button>
                          {puedeEditar && (
                            <button
                              type="button"
                              onClick={() => quitarJugador(pos.id, jugador.id)}
                              title={`Quitar a ${nombreCompleto(jugador)}`}
                              className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white mr-0.5 shrink-0"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      {puedeEditar && hayHueco && (
                        <button
                          type="button"
                          onClick={() => abrirModal(pos.id)}
                          className="w-5 h-5 rounded-full bg-white/90 hover:bg-white text-club-red text-xs leading-none font-bold flex items-center justify-center shadow-md border-2 border-dashed border-club-red shrink-0"
                          title={`Añadir jugador en ${pos.label}`}
                        >
                          +
                        </button>
                      )}
                    </div>
                    {puestoJugadores.length === 0 && (
                      <span className="text-[10px] font-semibold text-club-black bg-white px-1.5 py-0.5 rounded shadow-md whitespace-nowrap">
                        {pos.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-club-black mb-3">
              Jugadores sin colocar ({jugadoresDisponibles.length})
            </h3>
            <div className="space-y-4">
              {gruposJugadoresDisponibles.map(([demarcacion, jugadoresGrupo]) => (
                <div key={demarcacion}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-club-black/50 mb-2">
                    {demarcacion} ({jugadoresGrupo.length})
                  </h4>
                  <div className="space-y-2">
                    {jugadoresGrupo.map((j) => (
                      <div
                        key={j.id}
                        className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        {j.foto_url ? (
                          <img src={j.foto_url} alt={nombreCompleto(j)} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-club-black/40">
                            S/F
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-club-black truncate">{nombreCompleto(j)}</p>
                          <p className="text-xs text-club-black/50">{j.demarcacion || 'Sin demarcación'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {jugadoresDisponibles.length === 0 && (
                <p className="text-sm text-club-black/60">Todos los jugadores están colocados.</p>
              )}
            </div>
          </div>
            </div>
          )}
        </div>
      </div>

      {posicionSeleccionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={cerrarModal}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-club-black">
                  Elegir jugador · {posicionSeleccionada.label}
                </h3>
                <p className="text-xs text-club-black/50 mt-0.5">
                  Puedes seleccionar hasta {huecoDisponibleModal} jugador{huecoDisponibleModal === 1 ? '' : 'es'} más.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                className="text-club-black/50 hover:text-club-black text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100">
              <input
                type="text"
                autoFocus
                value={busquedaModal}
                onChange={(e) => setBusquedaModal(e.target.value)}
                placeholder="Buscar jugador..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {jugadoresDelModal.length === 0 ? (
                <p className="px-5 py-6 text-center text-club-black/60">No hay jugadores disponibles.</p>
              ) : (
                jugadoresDelModal.map((j) => {
                  const seleccionado = seleccionModal.includes(j.id);
                  const bloqueado = !seleccionado && seleccionModal.length >= huecoDisponibleModal;
                  return (
                    <button
                      key={j.id}
                      type="button"
                      disabled={bloqueado}
                      onClick={() => toggleSeleccionModal(j.id, huecoDisponibleModal)}
                      className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
                        seleccionado ? 'bg-red-50' : 'hover:bg-red-50/60'
                      } ${bloqueado ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          seleccionado ? 'bg-club-red border-club-red text-white' : 'border-gray-300'
                        }`}
                      >
                        {seleccionado && (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z" />
                          </svg>
                        )}
                      </span>
                      {j.foto_url ? (
                        <img
                          src={j.foto_url}
                          alt={nombreCompleto(j)}
                          className="w-12 h-12 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-club-black/40 shrink-0">
                          S/F
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-club-black truncate">{nombreCompleto(j)}</p>
                        <p className="text-sm text-club-black/50">{j.demarcacion || 'Sin demarcación'}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-gray-200">
              <span className="text-sm text-club-black/60">
                {seleccionModal.length} seleccionado{seleccionModal.length === 1 ? '' : 's'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-4 py-2 rounded-md border border-gray-300 text-club-black/70 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={seleccionModal.length === 0}
                  onClick={() => asignarJugadores(posicionSeleccionada.id, seleccionModal)}
                  className="px-4 py-2 rounded-md bg-club-red hover:bg-club-redDark disabled:opacity-50 text-white font-semibold transition-colors"
                >
                  Añadir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
