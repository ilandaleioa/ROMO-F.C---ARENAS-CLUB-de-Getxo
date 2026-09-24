import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { useFiltroEquipos } from '../context/FiltroEquiposContext';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';
import { api } from '../lib/api';
import { useListaValores } from '../lib/listas';
import { equiposAsignadosLabel, parseEquiposAsignados, usuarioLimitadoAUnEquipo } from '../lib/equiposAsignados';
import { usuarioPuedeVerApartado } from '../lib/apartados';
import TableScroll from '../components/TableScroll';
import CampoFutbolPosicion from '../components/CampoFutbolPosicion';
import { ETIQUETAS_JUGADOR, SECCIONES_FICHA, LOCALIDAD_OPCIONES } from '../lib/campos';
import BotonesVistaPlantillas from '../components/BotonesVistaPlantillas';

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
    const nombreA = nombreCompleto(a);
    const nombreB = nombreCompleto(b);
    return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
  });
}

function nombreCompleto(jugador) {
  return [jugador.nombre, jugador.primer_apellido, jugador.segundo_apellido].filter(Boolean).join(' ');
}

function opcionesPresentes(lista, obtenerValor) {
  const presentes = new Set();

  lista.forEach((item) => {
    const valor = String(obtenerValor(item) || '').trim();
    if (valor) presentes.add(valor);
  });

  return Array.from(presentes);
}

function fechaHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function crearJugadorVacio(equipo = '') {
  return {
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    equipo,
    fecha_nacimiento: fechaHoyISO(),
    dorsal: '',
    lateralidad: '',
    demarcacion: '',
  };
}

// Secciones excluidas del bloque de datos inferiores del formulario porque sus
// campos ya se editan arriba, junto a la foto y el campo de futbol (como en la ficha).
const SECCIONES_FORMULARIO_JUGADOR = SECCIONES_FICHA.filter(
  (seccion) => seccion.titulo !== 'Datos deportivos' && seccion.titulo !== 'Nacimiento'
);
const CAMPOS_NUMERICOS_FORMULARIO = new Set(['altura_cm', 'peso_kg']);
const CAMPOS_OBLIGATORIOS_FORMULARIO = new Set(['nombre', 'primer_apellido', 'equipo']);

function generarHorasSalidaColegio() {
  const horas = [];
  for (let minutos = 14 * 60; minutos <= 18 * 60; minutos += 15) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    horas.push(`${h}:${m}`);
  }
  return horas;
}
const HORAS_SALIDA_COLEGIO_OPCIONES = generarHorasSalidaColegio();

export default function Plantillas({ soloGraficas = false }) {
  const navigate = useNavigate();
  const { id: jugadorIdParam } = useParams();
  const { user } = useAuth();
  const { club } = useClub();
  const lateralidades = useListaValores('lateralidad');
  const demarcaciones = useListaValores('demarcacion');
  const equiposAsignadosUsuario = useMemo(() => parseEquiposAsignados(user.equipo_asignado), [user.equipo_asignado]);
  const limitadoAUnEquipo = usuarioLimitadoAUnEquipo(user);
  const puedeSincronizar = !soloGraficas && (user.rol === 'administrador' || user.rol === 'director');
  const puedeAnadirJugadores = !soloGraficas && ['administrador', 'director', 'responsable'].includes(user.rol);
  const puedeBorrarJugadores = !soloGraficas && (user.rol === 'administrador' || user.rol === 'director');
  const puedeEditarJugadores = !soloGraficas && ['administrador', 'director', 'responsable', 'tecnico'].includes(user.rol);
  const { equiposDisponibles, equiposSeleccionados, seleccionarEquipoUnico, limpiarSeleccion, recargarEquipos } =
    useFiltroEquipos();

  const [busqueda, setBusqueda] = useState('');
  const [filtroClub, setFiltroClub] = useState('todos');
  const [filtroEquipo, setFiltroEquipo] = useState('todos');
  const [filtroLateralidad, setFiltroLateralidad] = useState([]);
  const [filtroDemarcacion, setFiltroDemarcacion] = useState([]);
  const [filtroAnio, setFiltroAnio] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [jugadorBorrandoId, setJugadorBorrandoId] = useState(null);
  const [mostrarFormularioJugador, setMostrarFormularioJugador] = useState(false);
  const [formularioJugador, setFormularioJugador] = useState(() => crearJugadorVacio());
  const [guardandoJugador, setGuardandoJugador] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');
  const [filtroEquiposAbierto, setFiltroEquiposAbierto] = useState(false);
  const [filtroDeportivoAbierto, setFiltroDeportivoAbierto] = useState(null);
  const [tarjetaAccionesAbiertaId, setTarjetaAccionesAbiertaId] = useState(null);
  const { vista, setVista } = useVistaPlantillas();
  const [esMovil, setEsMovil] = useState(detectarMovil);
  const [jugadorEditando, setJugadorEditando] = useState(null);
  const [cargandoEdicion, setCargandoEdicion] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const estaEditando = Boolean(jugadorIdParam);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const actualizar = () => setEsMovil(mediaQuery.matches);

    actualizar();
    mediaQuery.addEventListener('change', actualizar);
    return () => mediaQuery.removeEventListener('change', actualizar);
  }, []);

  useEffect(() => {
    if (!estaEditando) {
      setJugadorEditando(null);
      return;
    }

    setCargandoEdicion(true);
    api
      .get(`/jugadores/${jugadorIdParam}`)
      .then(({ jugador }) => {
        setJugadorEditando(jugador);
        setMostrarFormularioJugador(true);
        setFormularioJugador(jugador);
      })
      .catch((err) => {
        setError(err.message);
        navigate('/plantillas');
      })
      .finally(() => setCargandoEdicion(false));
  }, [jugadorIdParam, estaEditando]);

  useEffect(() => {
    const cerrarFiltros = (event) => {
      if (!event.target.closest('[data-filtro-deportivo]')) {
        setFiltroDeportivoAbierto(null);
      }
    };
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setFiltroDeportivoAbierto(null);
    };

    document.addEventListener('click', cerrarFiltros);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('click', cerrarFiltros);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, []);

  const vistaVisible = soloGraficas ? 'graficas' : esMovil ? 'tabla' : vista;

  useEffect(() => {
    if (vistaVisible !== 'tarjetas') {
      setTarjetaAccionesAbiertaId(null);
    }
  }, [vistaVisible]);

  const cargarJugadores = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (!limitadoAUnEquipo) equiposSeleccionados.forEach((eq) => params.append('equipo', eq));
      if (busqueda.trim()) params.set('q', busqueda.trim());
      const query = params.toString();
      const { jugadores } = await api.get(query ? `/jugadores?${query}` : '/jugadores');
      setJugadores(jugadores);
    } catch (err) {
      setError(err.message);
    }
  }, [club, limitadoAUnEquipo, equiposSeleccionados, busqueda]);

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
      const detalleHoja = resultado.sync_bidireccional
        ? `, Google Sheets: ${resultado.hoja_actualizados || 0} fila(s) actualizada(s) y ${
            resultado.hoja_insertados || 0
          } fila(s) a\u00f1adida(s)` +
          (resultado.hoja_eliminados ? `, ${resultado.hoja_eliminados} fila(s) eliminada(s)` : '')
        : ', Google Sheets no se pudo actualizar';
      setMensajeSync(
        `Sincronización completada: ${resultado.insertados} jugador(es) nuevo(s) importado(s)` +
          `, ${resultado.actualizados || 0} registro(s) actualizado(s)` +
          (resultado.borrados ? `, ${resultado.borrados} jugador(es) eliminado(s) de la base de datos` : '') +
          (resultado.supabase_ganadores
            ? `, ${resultado.supabase_ganadores} cambio(s) de Supabase enviado(s) a la hoja`
            : '') +
          (resultado.conflictos ? `, ${resultado.conflictos} conflicto(s) resuelto(s) usando Google Sheets` : '') +
          (resultado.no_encontrados ? `, ${resultado.no_encontrados} ID_SYNC sin jugador en la base de datos` : '') +
          (resultado.duplicados ? `, ${resultado.duplicados} duplicado(s) ya existente(s) omitido(s)` : '') +
          detalleHoja +
          (resultado.omitidos
            ? `, ${resultado.omitidos} fila(s) omitida(s) por datos incompletos${
                detallesOmisiones ? ` (${detallesOmisiones})` : ''
              }.`
            : '.') +
          (resultado.aviso ? ` ${resultado.aviso}` : '')
      );
      await recargarEquipos();
      await cargarJugadores();
    } catch (err) {
      setMensajeSync(err.message);
    } finally {
      setSincronizando(false);
    }
  };

  const handleBorrarJugador = async (jugador) => {
    if (jugadorBorrandoId) return;

    const nombre = nombreCompleto(jugador);
    const confirmado = window.confirm(`Borrar a ${nombre}? Esta accion no se puede deshacer.`);
    if (!confirmado) return;

    setError('');
    setMensajeSync('');
    setJugadorBorrandoId(jugador.id);
    try {
      await api.delete(`/jugadores/${jugador.id}`);
      setJugadores((actuales) => actuales.filter((j) => j.id !== jugador.id));
      setMensajeSync(`${nombre} borrado correctamente.`);
      await recargarEquipos();
    } catch (err) {
      setError(err.message);
    } finally {
      setJugadorBorrandoId(null);
    }
  };

  const abrirFormularioJugador = () => {
    setError('');
    setMensajeSync('');
    setFormularioJugador(crearJugadorVacio(equiposSeleccionados.length === 1 ? equiposSeleccionados[0] : ''));
    setMostrarFormularioJugador(true);
  };

  const cerrarFormularioJugador = () => {
    if (guardandoJugador) return;
    setMostrarFormularioJugador(false);
    setFormularioJugador(crearJugadorVacio());
    setJugadorEditando(null);
    setErrorFoto('');
    if (estaEditando) {
      navigate('/plantillas');
    }
  };

  const handleFotoJugadorEditandoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !jugadorEditando?.id) return;

    setSubiendoFoto(true);
    setErrorFoto('');
    try {
      const formData = new FormData();
      formData.append('foto', file);
      const { foto_url } = await api.postFile(`/jugadores/${jugadorEditando.id}/foto`, formData);
      setJugadorEditando((actual) => (actual ? { ...actual, foto_url } : actual));
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const actualizarFormularioJugador = (campo, valor) => {
    setFormularioJugador((actual) => ({ ...actual, [campo]: valor }));
  };

  const handleCrearJugador = async (event) => {
    event.preventDefault();
    setGuardandoJugador(true);
    setError('');
    setMensajeSync('');

    try {
      // id_legible es una columna generada por la base de datos y foto_url es
      // derivado (URL firmada): nunca se deben reenviar en el payload.
      const { id_legible, foto_url, ...formularioSinDerivados } = formularioJugador;
      const datosJugador = {
        ...formularioSinDerivados,
        dorsal: formularioJugador.dorsal === '' ? null : Number(formularioJugador.dorsal),
        lateralidad: formularioJugador.lateralidad || null,
        demarcacion: formularioJugador.demarcacion || null,
      };
      CAMPOS_NUMERICOS_FORMULARIO.forEach((campo) => {
        datosJugador[campo] = formularioJugador[campo] === '' || formularioJugador[campo] === undefined
          ? null
          : Number(formularioJugador[campo]);
      });

      let resultado;
      if (jugadorEditando?.id) {
        resultado = await api.put(`/jugadores/${jugadorEditando.id}`, datosJugador);
        setMensajeSync('Jugador actualizado correctamente.');
      } else {
        resultado = await api.post('/jugadores', datosJugador);
        setMensajeSync('Jugador creado correctamente.');
      }

      setMostrarFormularioJugador(false);
      setFormularioJugador(crearJugadorVacio());
      setJugadorEditando(null);
      await recargarEquipos();
      await cargarJugadores();

      if (estaEditando) {
        navigate('/plantillas');
      } else if (resultado?.jugador && equiposSeleccionados.length === 0) {
        setJugadores((actuales) => (actuales.some((j) => j.id === resultado.jugador.id) ? actuales : [resultado.jugador, ...actuales]));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoJugador(false);
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

  const clubesDisponibles = useMemo(() => {
    const clubes = new Set(
      jugadores
        .map((jugador) => String(jugador?.club || '').trim())
        .filter(Boolean)
    );
    return Array.from(clubes).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [jugadores]);

  const equiposPorClub = useMemo(() => {
    const mapa = new Map();
    jugadores.forEach((jugador) => {
      const club = String(jugador?.club || '').trim();
      const equipo = String(jugador?.equipo || '').trim();
      if (!club || !equipo) return;
      if (!mapa.has(club)) mapa.set(club, new Set());
      mapa.get(club).add(equipo);
    });

    return Array.from(mapa.entries()).reduce((resultado, [club, equipos]) => {
      resultado[club] = Array.from(equipos).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      return resultado;
    }, {});
  }, [jugadores]);

  useEffect(() => {
    if (filtroClub !== 'todos' && filtroEquipo !== 'todos') {
      const equiposDelClub = equiposPorClub[filtroClub] || [];
      if (!equiposDelClub.includes(filtroEquipo)) {
        setFiltroEquipo('todos');
      }
    }
  }, [equiposPorClub, filtroClub, filtroEquipo]);

  const jugadoresFiltrados = ordenarJugadoresAlfabeticamente(
    jugadores.filter((j) => {
      const clubJugador = String(j?.club || '').trim();
      const equipoJugador = String(j?.equipo || '').trim();

      if (filtroClub !== 'todos' && clubJugador !== filtroClub) return false;
      if (filtroEquipo !== 'todos' && equipoJugador !== filtroEquipo) return false;
      if (equiposSeleccionados.length > 0 && !equiposSeleccionados.includes(equipoJugador)) return false;
      if (filtroLateralidad.length > 0 && !filtroLateralidad.includes(j.lateralidad)) return false;
      if (filtroDemarcacion.length > 0 && !filtroDemarcacion.includes(j.demarcacion)) return false;
      if (filtroAnio.length > 0 && !filtroAnio.includes(String(anioNacimiento(j.fecha_nacimiento) || ''))) {
        return false;
      }
      return true;
    })
  );

  const alternarFiltro = (setFiltro, valor) => {
    setFiltro((seleccionados) =>
      seleccionados.includes(valor)
        ? seleccionados.filter((seleccionado) => seleccionado !== valor)
        : [...seleccionados, valor]
    );
  };

  const aniosDisponibles = useMemo(() => {
    const anios = new Set();
    jugadores.forEach((j) => {
      const anio = anioNacimiento(j.fecha_nacimiento);
      if (anio) anios.add(anio);
    });
    return Array.from(anios).sort((a, b) => b - a);
  }, [jugadores]);

  const equiposDisponiblesTabla = useMemo(() => {
    const equiposPresentes = new Set(opcionesPresentes(jugadores, (j) => j.equipo));
    return equiposDisponibles.filter((equipo) => equiposPresentes.has(equipo));
  }, [equiposDisponibles, jugadores]);

  const lateralidadesDisponibles = useMemo(() => {
    const lateralidadesPresentes = new Set(opcionesPresentes(jugadores, (j) => j.lateralidad));
    return lateralidades.filter((opcion) => lateralidadesPresentes.has(opcion));
  }, [jugadores, lateralidades]);

  const demarcacionesDisponibles = useMemo(() => {
    const demarcacionesPresentes = new Set(opcionesPresentes(jugadores, (j) => j.demarcacion));
    return demarcaciones.filter((opcion) => demarcacionesPresentes.has(opcion));
  }, [demarcaciones, jugadores]);

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

  const renderIconoLapiz = () => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M4 13.5V16h2.5L15.8 6.7a1.8 1.8 0 0 0 0-2.5l-.1-.1a1.8 1.8 0 0 0-2.5 0L4 13.5Z" />
      <path d="m12.8 4.4 2.8 2.8" />
    </svg>
  );

  const renderIconoPapelera = () => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M3.5 5h13" />
      <path d="M8 5V3.5h4V5" />
      <path d="M6 5.5l.7 10.5h6.6L14 5.5" />
      <path d="M8.5 8v5.5" />
      <path d="M11.5 8v5.5" />
    </svg>
  );

  const renderIconoMas = () => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M10 4v12" />
      <path d="M4 10h12" />
    </svg>
  );

  const renderIconoCerrar = () => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M5 5l10 10" />
      <path d="M15 5 5 15" />
    </svg>
  );

  const renderFormularioJugador = () => {
    if (!mostrarFormularioJugador) return null;

    const esEdicion = Boolean(jugadorEditando?.id);
    const tituloFormulario = esEdicion ? 'Editar jugador' : 'Nuevo jugador';
    const descripcionFormulario = esEdicion
      ? `Edita los datos de ${nombreCompleto(jugadorEditando)}`
      : 'Completa los datos del jugador.';
    const textoBtnGuardar = esEdicion
      ? (guardandoJugador ? 'Guardando...' : 'Actualizar jugador')
      : (guardandoJugador ? 'Guardando...' : 'Crear jugador');

    const renderCampoSeccion = (campo) => {
      const etiqueta = ETIQUETAS_JUGADOR[campo] || campo;
      const requerido = CAMPOS_OBLIGATORIOS_FORMULARIO.has(campo);

      if (campo === 'tiene_hermanos_club') {
        const valorActual = formularioJugador[campo];
        return (
          <label key={campo} className="block rounded-xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{etiqueta}</span>
            <select
              value={valorActual === true ? 'si' : valorActual === false ? 'no' : ''}
              onChange={(event) =>
                actualizarFormularioJugador(campo, event.target.value === '' ? null : event.target.value === 'si')
              }
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Sin especificar</option>
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>
        );
      }

      if (campo === 'equipo') {
        return (
          <label key={campo} className="block rounded-xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-club-black/45">
              {etiqueta}
              {requerido ? ' *' : ''}
            </span>
            <select
              required={requerido}
              value={formularioJugador[campo] ?? ''}
              onChange={(event) => actualizarFormularioJugador(campo, event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Seleccionar equipo</option>
              {equiposDisponibles.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
            </select>
          </label>
        );
      }

      if (campo === 'localidad') {
        return (
          <label key={campo} className="block rounded-xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{etiqueta}</span>
            <select
              value={formularioJugador[campo] ?? ''}
              onChange={(event) => actualizarFormularioJugador(campo, event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Seleccionar localidad</option>
              {LOCALIDAD_OPCIONES.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
            </select>
          </label>
        );
      }

      if (campo === 'hora_salida_colegio') {
        return (
          <label key={campo} className="block rounded-xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{etiqueta}</span>
            <select
              value={formularioJugador[campo] ?? ''}
              onChange={(event) => actualizarFormularioJugador(campo, event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Sin especificar</option>
              {HORAS_SALIDA_COLEGIO_OPCIONES.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
            </select>
          </label>
        );
      }

      const esNumerico = CAMPOS_NUMERICOS_FORMULARIO.has(campo);
      const esTelefono = campo.startsWith('telefono');
      const valorTelefono = esTelefono ? String(formularioJugador[campo] ?? '').trim() : '';

      return (
        <label key={campo} className="block rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-club-black/45">
            {etiqueta}
            {requerido ? ' *' : ''}
          </span>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type={esNumerico ? 'number' : 'text'}
              required={requerido}
              value={formularioJugador[campo] ?? ''}
              onChange={(event) => actualizarFormularioJugador(campo, event.target.value)}
              className="w-full min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
            />
            {esTelefono && valorTelefono && (
              <>
                <a
                  href={`https://wa.me/${valorTelefono.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  title="Abrir WhatsApp"
                  aria-label="Abrir WhatsApp"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-600 text-white transition-colors hover:bg-green-700"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.94L2 22l5.2-1.36A9.94 9.94 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm0 18.06c-1.6 0-3.12-.43-4.44-1.19l-.32-.19-3.09.81.83-3.01-.21-.31A8.05 8.05 0 014 12c0-4.43 3.6-8.03 8.04-8.03S20.08 7.57 20.08 12s-3.6 8.06-8.04 8.06zm4.4-6.03c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4-.14-.01-.3-.01-.46-.01s-.42.06-.64.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28z" />
                  </svg>
                </a>
                <a
                  href={`tel:${valorTelefono.replace(/[^0-9+]/g, '')}`}
                  onClick={(event) => event.stopPropagation()}
                  title="Llamar"
                  aria-label="Llamar"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-club-black text-white transition-colors hover:bg-black"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.02l-2.2 2.2z" />
                  </svg>
                </a>
              </>
            )}
          </div>
        </label>
      );
    };

    return (
      <section className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{tituloFormulario}</p>
            <h3 className="mt-1 text-2xl font-bold">
              {esEdicion ? nombreCompleto(jugadorEditando) || 'Jugador sin nombre' : 'Nuevo jugador'}
            </h3>
            <p className="text-sm text-white/80">{descripcionFormulario}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="formulario-jugador"
              disabled={guardandoJugador}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-club-red hover:bg-white/90 disabled:opacity-60"
            >
              {textoBtnGuardar}
            </button>
            <button
              type="button"
              onClick={cerrarFormularioJugador}
              disabled={guardandoJugador}
              className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>

        <form id="formulario-jugador" onSubmit={handleCrearJugador} className="space-y-6 p-6">
          <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
            <div className="w-full max-w-xs shrink-0 space-y-2.5 md:w-56">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                {jugadorEditando?.foto_url ? (
                  <img src={jugadorEditando.foto_url} alt="Foto del jugador" className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-3 text-center text-sm font-semibold text-club-black/40">
                    Sin foto disponible
                  </div>
                )}
              </div>
              {esEdicion && puedeEditarJugadores && (
                <div className="space-y-1.5">
                  <label className="inline-flex w-full items-center justify-center rounded-md border border-club-red/20 bg-club-red/5 px-3 py-2 text-xs font-semibold text-club-red cursor-pointer hover:bg-club-red/10 transition-colors">
                    {subiendoFoto ? 'Subiendo foto...' : 'Cambiar foto'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleFotoJugadorEditandoChange}
                      disabled={subiendoFoto}
                    />
                  </label>
                  {errorFoto ? <p className="text-xs text-club-red">{errorFoto}</p> : null}
                </div>
              )}
            </div>

            <div className="w-full max-w-sm space-y-3 md:w-72 md:shrink-0">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Dorsal</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={formularioJugador.dorsal ?? ''}
                    onChange={(event) => actualizarFormularioJugador('dorsal', event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-center text-base font-bold text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                  />
                </label>
                <label className="block rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Fecha nac.</span>
                  <input
                    type="date"
                    value={formularioJugador.fecha_nacimiento || ''}
                    onChange={(event) => actualizarFormularioJugador('fecha_nacimiento', event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-1 py-1 text-center text-sm font-semibold text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                  />
                </label>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Edad</p>
                  <p className="mt-1 text-base font-bold text-club-black">
                    {calcularEdad(formularioJugador.fecha_nacimiento) ?? '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Año</p>
                  <p className="mt-1 text-base font-bold text-club-black">
                    {anioNacimiento(formularioJugador.fecha_nacimiento) ?? '-'}
                  </p>
                </div>
                <label className="block rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Lateralidad</span>
                  <select
                    value={formularioJugador.lateralidad || ''}
                    onChange={(event) => actualizarFormularioJugador('lateralidad', event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-1 py-1 text-center text-sm font-semibold text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                  >
                    <option value="">-</option>
                    {lateralidades.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="w-full max-w-xs shrink-0 space-y-2 md:w-56">
              <CampoFutbolPosicion demarcacion={formularioJugador.demarcacion} />
              <select
                value={formularioJugador.demarcacion || ''}
                onChange={(event) => actualizarFormularioJugador('demarcacion', event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
              >
                <option value="">Seleccionar posición</option>
                {demarcaciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {SECCIONES_FORMULARIO_JUGADOR.map((seccion) => {
              const esSeccionAncha = seccion.titulo === 'Datos del jugador' || seccion.titulo === 'Colegio';
              const esDomicilio = seccion.titulo === 'Domicilio';
              return (
                <section
                  key={seccion.titulo}
                  className={`rounded-2xl border border-gray-200 bg-gray-50 p-4 ${esSeccionAncha ? 'lg:col-span-2' : ''}`}
                >
                  <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{seccion.titulo}</h4>
                  {esDomicilio ? (
                    <>
                      <div className="mt-4">{renderCampoSeccion('domicilio')}</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {seccion.campos.filter((campo) => campo !== 'domicilio').map((campo) => renderCampoSeccion(campo))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {seccion.campos.map((campo) => renderCampoSeccion(campo))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </form>
      </section>
    );
  };

  const renderBotonVer = (jugador) => (
    <Link
      to={`/fichas/${jugador.id}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border border-club-red/20 bg-white text-club-red hover:bg-red-50 hover:text-club-redDark transition-colors"
      aria-label={`Ver ficha de ${nombreCompleto(jugador)}`}
      title={`Ver ficha de ${nombreCompleto(jugador)}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path d="M10 3.5c-4.14 0-7.4 2.6-9 6.5 1.6 3.9 4.86 6.5 9 6.5s7.4-2.6 9-6.5c-1.6-3.9-4.86-6.5-9-6.5zm0 10.83A4.33 4.33 0 1110 5.67a4.33 4.33 0 010 8.66zm0-6.83a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
      </svg>
    </Link>
  );

  const renderBotonEditar = (jugador) => {
    if (!puedeEditarJugadores) return null;

    return (
      <Link
        to={`/plantillas/${jugador.id}`}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border border-club-red/20 bg-white text-club-red hover:bg-red-50 hover:text-club-redDark transition-colors"
        aria-label={`Editar a ${nombreCompleto(jugador)}`}
        title={`Editar a ${nombreCompleto(jugador)}`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
          <path d="M4 13.5V16h2.5L15.8 6.7a1.8 1.8 0 0 0 0-2.5l-.1-.1a1.8 1.8 0 0 0-2.5 0L4 13.5Z" />
          <path d="m12.8 4.4 2.8 2.8" />
        </svg>
      </Link>
    );
  };

  const renderBotonBorrar = (jugador) => {
    if (!puedeBorrarJugadores) return null;

    const nombre = nombreCompleto(jugador);
    const borrando = jugadorBorrandoId === jugador.id;

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleBorrarJugador(jugador);
        }}
        disabled={Boolean(jugadorBorrandoId)}
        className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border border-club-red/20 bg-white text-club-red hover:bg-red-50 hover:text-club-redDark disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        aria-label={`Borrar a ${nombre}`}
        title={`Borrar a ${nombre}`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
          <path d="M3.5 5h13" />
          <path d="M8 5V3.5h4V5" />
          <path d="M6 5.5l.7 10.5h6.6L14 5.5" />
          <path d="M8.5 8v5.5" />
          <path d="M11.5 8v5.5" />
        </svg>
        <span className="sr-only">{borrando ? 'Borrando...' : 'Borrar'}</span>
      </button>
    );
  };

  const renderAccionesJugador = (jugador, { mostrarCerrar = false, onCerrar } = {}) => (
    <div className="inline-flex items-center justify-start gap-0.5" onClick={(event) => event.stopPropagation()}>
      {renderBotonVer(jugador)}
      {renderBotonEditar(jugador)}
      {renderBotonBorrar(jugador)}
      {mostrarCerrar && onCerrar && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCerrar();
          }}
          className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border border-club-red/20 bg-white text-club-red hover:bg-red-50 hover:text-club-redDark transition-colors"
          aria-label={`Cerrar acciones de ${nombreCompleto(jugador)}`}
          title={`Cerrar acciones de ${nombreCompleto(jugador)}`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
            <path d="M5 5l10 10" />
            <path d="M15 5 5 15" />
          </svg>
        </button>
      )}
    </div>
  );

  const abrirFichaJugador = (jugador) => {
    navigate(`/plantillas/${jugador.id}`);
  };

  const renderGraficas = (lista) => {
    const porEquipo = contarPor(lista, (j) => j.equipo);
    const porDemarcacion = contarPor(lista, (j) => j.demarcacion);
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
        {renderBarras('Jugadores por posición', porDemarcacion)}
        {renderBarras('Jugadores por año de nacimiento', porAnio, { ordenNumerico: true })}
        {renderGraficaCircularMunicipios()}
        {renderGraficaBarrasMunicipios()}
      </div>
    );
  };

  const renderTablaJugadores = (lista) => (
    <div className="max-w-6xl">
      <TableScroll className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-200">
        <table className="w-full divide-y divide-gray-200 bg-white text-sm sm:text-base">
        <thead className="bg-club-black text-white sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3" />
            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">
              <span className="inline-flex items-center gap-1">
                <span className="hidden sm:inline">Acciones</span>
                {puedeAnadirJugadores && (
                  <button
                    type="button"
                    onClick={abrirFormularioJugador}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-club-red/20 bg-white text-club-red hover:bg-red-50 hover:text-club-redDark transition-colors"
                    aria-label="Abrir formulario para añadir jugador"
                    title="Añadir jugador"
                  >
                    {renderIconoMas()}
                  </button>
                )}
              </span>
            </th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Foto</th>
            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Nombre</th>
            <th className="hidden sm:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">F. nac.</th>
            <th className="hidden md:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Año</th>
            <th className="hidden md:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Edad</th>
            <th className="hidden min-[380px]:table-cell px-2 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">Posición</th>
            <th className="hidden lg:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-left text-xs font-semibold uppercase tracking-wide">ID jugador</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lista.map((j, index) => (
            <tr
              key={j.id}
              className="cursor-pointer hover:bg-red-50/40 transition-colors"
              onClick={() => abrirFichaJugador(j)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  abrirFichaJugador(j);
                }
              }}
              role="link"
              tabIndex={0}
              aria-label={`Abrir ficha de ${nombreCompleto(j)}`}
              title={`Abrir ficha de ${nombreCompleto(j)}`}
            >
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-200 flex items-center justify-center text-[8px] sm:text-[10px] font-semibold text-club-black/60">
                  {index + 1}
                </div>
              </td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                <div onClick={(event) => event.stopPropagation()}>
                  {renderAccionesJugador(j)}
                </div>
              </td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                {j.foto_url ? (
                  <img
                    src={j.foto_url}
                    alt={`Foto de ${j.nombre}`}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-200 flex items-center justify-center text-[8px] sm:text-[10px] font-semibold text-club-black/40">
                    -
                  </div>
                )}
              </td>
              <td className="px-2 py-2.5 sm:px-3 sm:py-3 font-medium text-club-black max-w-[120px] sm:max-w-none truncate">
                <div className="flex items-center gap-1">
                  <span className="shrink-0 min-w-[1.2rem] text-center rounded-full bg-club-red/10 px-1 py-0 text-[10px] font-semibold text-club-red">
                    {j.dorsal ?? '-'}
                  </span>
                  <span className="truncate text-xs sm:text-sm">
                    {nombreCompleto(j)}
                  </span>
                </div>
              </td>
              <td className="hidden sm:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-club-black/80 text-sm">{formatearFecha(j.fecha_nacimiento) || '-'}</td>
              <td className="hidden md:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-club-black/80 text-sm">{anioNacimiento(j.fecha_nacimiento) ?? '-'}</td>
              <td className="hidden md:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-club-black/80 text-sm max-w-[110px] truncate">{calcularEdad(j.fecha_nacimiento) ?? '-'}</td>
              <td className="hidden min-[380px]:table-cell px-2 py-2.5 sm:px-3 sm:py-3 text-club-black/80 text-sm max-w-[110px] truncate">{j.demarcacion || '-'}</td>
              <td className="hidden lg:table-cell px-2.5 py-2.5 sm:px-3 sm:py-3 text-club-black/60 text-xs max-w-[160px] truncate" title={j.id_legible || '-'}>{j.id_legible || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
    </div>
  );

  const renderTarjetasJugadores = (lista) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {lista.map((j) => (
        <div
          key={j.id}
          className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-1 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() =>
            setTarjetaAccionesAbiertaId((actual) => (actual === j.id ? null : j.id))
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setTarjetaAccionesAbiertaId((actual) => (actual === j.id ? null : j.id));
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={tarjetaAccionesAbiertaId === j.id}
          aria-label={`Mostrar acciones de ${nombreCompleto(j)}`}
        >
          <div className="flex items-center gap-3 mb-1">
            {j.foto_url ? (
              <img
                src={j.foto_url}
                alt={`Foto de ${j.nombre}`}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-club-black/60 shrink-0">
                {j.dorsal ?? '-'}
              </div>
            )}
            <div>
              <p className="font-semibold text-club-black">
                {nombreCompleto(j)}
              </p>
              {j.id_legible && (
                <p className="text-xs text-club-black/50 truncate">{j.id_legible}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-club-black/80">{j.equipo}</p>
          <p className="text-sm text-club-black/60">
            Año de nacimiento: {anioNacimiento(j.fecha_nacimiento) ?? '-'}
          </p>
          <p className="text-sm text-club-black/60">
            Lateralidad: {j.lateralidad || '-'}
          </p>
          <p className="text-sm text-club-black/60">
            Posición: {j.demarcacion || '-'}
          </p>
          <div
            className={`mt-2 overflow-hidden transition-all duration-200 ${
              tarjetaAccionesAbiertaId === j.id
                ? 'max-h-16 opacity-100 translate-y-0'
                : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-end gap-1.5 pt-1">
              {renderAccionesJugador(j, {
                mostrarCerrar: true,
                onCerrar: () => setTarjetaAccionesAbiertaId(null),
              })}
            </div>
          </div>
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


  const renderFiltroEquipos = () => {
    const etiquetaSeleccion =
      equiposSeleccionados.length === 0 ? 'Todos los equipos' : equiposSeleccionados[0];

    return (
      <aside className="md:w-64 shrink-0">
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setFiltroEquiposAbierto((abierto) => !abierto)}
            className="md:hidden w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-club-black"
          >
            <span className="truncate">{etiquetaSeleccion}</span>
            <span className={`transition-transform ${filtroEquiposAbierto ? 'rotate-180' : ''}`}>▾</span>
          </button>
          <div className={`${filtroEquiposAbierto ? 'block' : 'hidden'} md:block border-t border-gray-100 md:border-t-0`}>
            <button
              onClick={() => {
                limpiarSeleccion();
                setFiltroEquiposAbierto(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold border-b border-gray-100 transition-colors ${
                equiposSeleccionados.length === 0
                  ? 'bg-club-red text-white'
                  : 'text-club-red hover:bg-red-50/60'
              }`}
            >
              Todos los equipos
            </button>
            {equiposDisponibles.map((eq) => (
              <button
                key={eq}
                onClick={() => {
                  seleccionarEquipoUnico(eq);
                  setFiltroEquiposAbierto(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                  equiposSeleccionados.includes(eq)
                    ? 'bg-club-red text-white font-semibold'
                    : 'text-club-black/80 hover:bg-red-50/60'
                }`}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      </aside>
    );
  };

  const renderFiltroSimpleSelect = ({ label, value, onChange, opciones, emptyLabel }) => (
    <div className="w-full sm:w-48 flex flex-col gap-1">
      <label className="text-xs font-semibold text-club-black/60 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
      >
        <option value="todos">{emptyLabel}</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>{opcion}</option>
        ))}
      </select>
    </div>
  );

  const renderFiltroMultiseleccion = ({ id, etiquetaTodos, opciones, seleccionados, setSeleccionados }) => {
    const abierto = filtroDeportivoAbierto === id;
    const etiqueta =
      seleccionados.length === 0
        ? etiquetaTodos
        : seleccionados.length === 1
          ? seleccionados[0]
          : `${seleccionados.length} seleccionados`;

    return (
      <div className="relative w-full sm:w-60" data-filtro-deportivo>
        <button
          type="button"
          onClick={() => setFiltroDeportivoAbierto((actual) => (actual === id ? null : id))}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
          aria-haspopup="listbox"
          aria-expanded={abierto}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="truncate">{etiqueta}</span>
            <span
              className={`h-2 w-2 shrink-0 border-b-2 border-r-2 border-club-black/70 transition-transform ${
                abierto ? 'rotate-[225deg]' : 'rotate-45'
              }`}
              aria-hidden="true"
            />
          </span>
        </button>
        {abierto && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => setSeleccionados([])}
              className={`w-full px-3 py-2 text-left text-sm font-semibold transition-colors ${
                seleccionados.length === 0 ? 'bg-club-red text-white' : 'text-club-black hover:bg-red-50/60'
              }`}
            >
              {etiquetaTodos}
            </button>
            <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
              {opciones.map((opcion) => {
                const valor = String(opcion);
                const seleccionado = seleccionados.includes(valor);

                return (
                  <label
                    key={valor}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-club-black/80 hover:bg-red-50/60"
                  >
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      onChange={() => alternarFiltro(setSeleccionados, valor)}
                      className="h-4 w-4 accent-club-red"
                    />
                    <span className="truncate" title={valor}>
                      {valor}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFiltrosDeportivos = () => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
      {renderFiltroSimpleSelect({
        label: 'Club',
        value: filtroClub,
        onChange: (valor) => {
          setFiltroClub(valor);
          if (valor !== 'todos') {
            const equiposDelClub = equiposPorClub[valor] || [];
            if (filtroEquipo !== 'todos' && !equiposDelClub.includes(filtroEquipo)) {
              setFiltroEquipo('todos');
            }
          }
        },
        opciones: clubesDisponibles,
        emptyLabel: 'Todos los clubes',
      })}
      {renderFiltroSimpleSelect({
        label: 'Equipo',
        value: filtroEquipo,
        onChange: setFiltroEquipo,
        opciones: filtroClub === 'todos' ? [...new Set(jugadores.map((jugador) => String(jugador?.equipo || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })) : (equiposPorClub[filtroClub] || []),
        emptyLabel: 'Todos los equipos',
      })}
      <div className="w-full sm:w-48 flex flex-col gap-1">
        <label htmlFor="filtro-jugadores" className="text-xs font-semibold text-club-black/60 uppercase tracking-wide">
          Jugador
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
      {renderFiltroMultiseleccion({
        id: 'lateralidad',
        etiquetaTodos: 'Todas las lateralidades',
        opciones: lateralidadesDisponibles,
        seleccionados: filtroLateralidad,
        setSeleccionados: setFiltroLateralidad,
      })}
      {renderFiltroMultiseleccion({
        id: 'demarcacion',
        etiquetaTodos: 'Todas las posiciones',
        opciones: demarcacionesDisponibles,
        seleccionados: filtroDemarcacion,
        setSeleccionados: setFiltroDemarcacion,
      })}
      {renderFiltroMultiseleccion({
        id: 'anio',
        etiquetaTodos: 'Todos los a\u00f1os',
        opciones: aniosDisponibles,
        seleccionados: filtroAnio,
        setSeleccionados: setFiltroAnio,
      })}
    </div>
  );

  if (estaEditando && cargandoEdicion) {
    return (
      <div className="w-full px-3 sm:px-4 py-4 flex items-center justify-center min-h-[400px]">
        <p className="text-club-black/60">Cargando formulario de edición...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 py-4">
      {estaEditando && (
        <div className="mb-4 flex flex-col gap-2">
          <Link
            to="/plantillas"
            className="inline-flex items-center gap-2 w-fit text-sm font-semibold text-club-red hover:text-club-redDark transition-colors"
          >
            ← Volver a plantillas
          </Link>
          {error && (
            <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {mensajeSync && (
            <p className="text-sm text-club-black bg-gray-100 border border-gray-200 rounded-md px-3 py-2">
              {mensajeSync}
            </p>
          )}
        </div>
      )}

      {!estaEditando && (
        <>
          <div className="flex flex-col gap-4 mb-4">
            <h2 className="text-2xl font-bold text-club-black text-center lg:text-left">Plantillas</h2>
            <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-3 w-full">
              <div className="hidden md:block">
                {renderFiltrosDeportivos()}
              </div>
              <div className="hidden md:flex md:flex-row md:items-center gap-3">
                <button
                  onClick={handleActualizar}
                  disabled={refrescando}
                  className="inline-flex h-12 w-full sm:w-auto items-center justify-center whitespace-nowrap bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
                >
                  {refrescando ? 'Actualizando...' : 'Actualizar datos'}
                </button>
                {puedeSincronizar && (
                  <button
                    onClick={handleSincronizar}
                    disabled={sincronizando}
                    className="inline-flex h-12 w-full sm:w-auto items-center justify-center whitespace-nowrap bg-club-black hover:bg-black disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-md transition-colors"
                  >
                    {sincronizando ? 'Sincronizando...' : 'Sincronizar Google Sheets'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {mensajeSync && (
            <p className="text-sm text-club-black bg-gray-100 border border-gray-200 rounded-md px-3 py-2 mb-3">
              {mensajeSync}
            </p>
          )}
        </>
      )}

      {mostrarFormularioJugador && (
        <div className="mx-auto w-full max-w-6xl">
          {renderFormularioJugador()}
        </div>
      )}

      {!estaEditando && (limitadoAUnEquipo ? (
        <div className="mb-4">
          <div className="mb-4">
            <BotonesVistaPlantillas vistaActual={soloGraficas ? 'graficas' : vista} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="text-sm font-semibold bg-club-black text-white px-4 py-2 rounded-md inline-block">
              Equipo: {equiposAsignadosLabel(user.equipo_asignado)}
            </div>
            {equiposAsignadosUsuario[0] && (
              <Link
                to={`/campogramas?equipo=${encodeURIComponent(equiposAsignadosUsuario[0])}`}
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="hidden md:block">
            {renderFiltroEquipos()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <BotonesVistaPlantillas vistaActual={soloGraficas ? 'graficas' : vista} />
            </div>
            {error && (
              <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-3">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-club-black/60">Cargando jugadores...</p>
            ) : jugadoresFiltrados.length === 0 ? (
              <p className="text-club-black/60">No se han encontrado jugadores.</p>
            ) : vistaVisible === 'graficas' ? (
              <>
                <div className="mb-3">{renderContadorRegistros(jugadoresFiltrados.length)}</div>
                {renderGraficas(jugadoresFiltrados)}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
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
      ))}
    </div>
  );
}
