import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';
import { useLista, useListaValores } from '../lib/listas';

const DEMARCACION_CONCRETA_OPCIONES = [
  'Portero',
  'Lateral Dcho',
  'Lateral Izdo',
  'Central Dcho',
  'Central Izdo',
  'Pivote',
  'Media punta',
  'Interior Dcho',
  'Interior Izdo',
  'Extremo Dcho',
  'Extremo Izdo',
  'Delantero',
];

const CAMPOS = [
  { key: 'id_jugador', label: 'ID JUGADOR', type: 'text' },
  { key: 'fecha_alta', label: 'FECHA ALTA', type: 'date' },
  { key: 'quien_da_alta', label: 'QUIEN DA ALTA', type: 'selectWithAdd' },
  { key: 'club', label: 'CLUB', type: 'clubSelect' },
  { key: 'equipo', label: 'EQUIPO', type: 'text' },
  { key: 'etapa', label: 'ETAPA', type: 'listaSelect', listaId: 'etapas' },
  { key: 'categoria', label: 'CATEGORIA', type: 'listaSelect', listaId: 'categorias' },
  { key: 'grupo', label: 'GRUPO', type: 'text' },
  { key: 'enlace', label: 'ENLACE FEDERACIÃ“N', type: 'url' },
  { key: 'nombre', label: 'NOMBRE', type: 'text', required: true },
  { key: 'primer_apellido', label: 'PRIMER APELLIDO', type: 'text', required: true },
  { key: 'nombre_completo', label: 'NOMBRE COMPLETO', type: 'computed' },
  { key: 'segundo_apellido', label: 'SEGUNDO APELLIDO', type: 'text' },
  { key: 'dorsal', label: 'DORSAL', type: 'number' },
  { key: 'altura', label: 'ALTURA (CM)', type: 'select', options: Array.from({ length: 51 }, (_, index) => String(index + 150)) },
  { key: 'lateralidad', label: 'LATERALIDAD', type: 'select', options: ['DIESTRO', 'ZURDO', 'AMBAS'] },
  { key: 'foto_jugador', label: 'FOTO JUGADOR', type: 'imageUpload' },
  { key: 'fecha_nacimiento', label: 'FECHA DE NACIMIENTO', type: 'date' },
  { key: 'anio_nacimiento', label: 'ANO DE NACIMIENTO', type: 'number' },
  { key: 'edad', label: 'EDAD', type: 'number' },
  { key: 'demarcacion', label: 'DEMARCACION', type: 'select', options: ['PORTERO', 'LATERAL', 'CENTRAL', 'MEDIO', 'MEDIA PUNTA', 'EXTREMO', 'DELANTERO'] },
  { key: 'otra_demarcacion', label: 'OTRA DEMARCACION -', type: 'select', options: ['PORTERO', 'LATERAL', 'CENTRAL', 'MEDIO', 'MEDIA PUNTA', 'EXTREMO', 'DELANTERO'] },
  { key: 'demarcacion_concreta', label: 'DEMARCACION CONCRETA', type: 'select', options: DEMARCACION_CONCRETA_OPCIONES },
  { key: 'valoracion_general', label: 'VALORACION GENERAL', type: 'ratingButtons' },
  { key: 'descripcion_jugador', label: 'DESCRIPCION DEL JUGADOR', type: 'textarea' },
  { key: 'observaciones', label: 'OBSERVACIONES', type: 'textarea' },
];

const VALORACION_GENERAL_OPCIONES = [1, 2, 3, 4, 5];
const FECHA_NACIMIENTO_POR_DEFECTO = '2020-01-01';
const RESPONSABLES_ALTA_INICIALES = ['Adrian', 'Alex', 'Mikel'];
const RESPONSABLES_ALTA_STORAGE_KEY = 'captacion.responsablesAlta';
const RESPONSABLES_ALTA_NUEVO_VALUE = '__nueva_opcion_responsable_alta__';
const SECCIONES_CAPTACION = [
  { id: 'base-datos', label: 'BASE DE DATOS' },
  { id: 'informes', label: 'INFORMES' },
];

const INFORME_TITULARIDAD_OPCIONES = ['TITULAR', 'SUPLENTE', 'NO CONVOCA'];
const CAMPOS_INFORME_JUGADOR = ['etapa', 'categoria', 'dorsal', 'tipologia', 'lateralidad'];
const CAMPOS_INFORME_TABLA = [
  { key: 'fecha', label: 'FECHA' },
  { key: 'observador', label: 'OBSERVADOR' },
  { key: 'jugador', label: 'JUGADOR' },
  { key: 'etapa', label: 'ETAPA' },
  { key: 'categoria', label: 'CATEGORIA' },
  { key: 'local', label: 'LOCAL' },
  { key: 'visitante', label: 'VISITANTE' },
  { key: 'partido', label: 'PARTIDO' },
  { key: 'dorsal', label: 'DORSAL' },
  { key: 'tipologia', label: 'TIPOLOGIA' },
  { key: 'lateralidad', label: 'LATERALIDAD' },
  { key: 'titularidad', label: 'TITULARIDAD' },
  { key: 'minutos_jugados', label: 'MINUTOS JUGADOS' },
  { key: 'goles', label: 'GOLES' },
  { key: 'goles_encajados', label: 'GOLES ENCAJADOS' },
];
const BLOQUES_INFORME_FORM = [
  { title: 'Datos basicos', fields: ['fecha', 'observador', 'jugador_id'] },
  { title: 'Partido', fields: ['etapa', 'categoria', 'local', 'visitante', 'partido'] },
  { title: 'Jugador', fields: ['dorsal', 'tipologia', 'lateralidad', 'titularidad'] },
  { title: 'Produccion', fields: ['minutos_jugados', 'goles', 'goles_encajados'] },
];

const ETIQUETAS_INFORME = {
  fecha: 'FECHA',
  observador: 'OBSERVADOR',
  jugador_id: 'JUGADOR',
  etapa: 'ETAPA',
  categoria: 'CATEGORIA',
  local: 'LOCAL',
  visitante: 'VISITANTE',
  partido: 'PARTIDO',
  dorsal: 'DORSAL',
  tipologia: 'TIPOLOGIA',
  lateralidad: 'LATERALIDAD',
  titularidad: 'TITULARIDAD',
  minutos_jugados: 'MINUTOS JUGADOS',
  goles: 'GOLES',
  goles_encajados: 'GOLES ENCAJADOS',
};

const BLOQUES_FORMULARIO_CAPTACION = [
  {
    title: 'Datos de alta',
    fields: ['id_jugador', 'fecha_alta', 'quien_da_alta'],
  },
  {
    title: 'Contexto deportivo',
    fields: ['club', 'equipo', 'etapa', 'categoria', 'grupo', 'enlace'],
  },
  {
    title: 'Perfil del jugador',
    fields: ['nombre', 'primer_apellido', 'nombre_completo', 'segundo_apellido', 'dorsal', 'altura', 'lateralidad', 'fecha_nacimiento', 'anio_nacimiento', 'edad', 'demarcacion', 'otra_demarcacion', 'demarcacion_concreta', 'valoracion_general'],
  },
  {
    title: 'Observaciones',
    fields: ['descripcion_jugador', 'observaciones'],
  },
];

const CAMPOS_CHIPS_RESUMEN = ['club', 'equipo', 'etapa', 'categoria', 'grupo', 'demarcacion', 'lateralidad'];

function crearInformeVacio() {
  return {
    fecha: obtenerFechaHoyISO(),
    observador: '',
    jugador_id: '',
    etapa: '',
    categoria: '',
    local: '',
    visitante: '',
    partido: '',
    dorsal: '',
    tipologia: '',
    lateralidad: '',
    titularidad: '',
    minutos_jugados: '',
    goles: '',
    goles_encajados: '',
  };
}
function calcularPartidoInforme(informe) {
  const local = String(informe?.local || '').trim();
  const visitante = String(informe?.visitante || '').trim();
  if (local && visitante) return `${local} - ${visitante}`;
  return local || visitante || '';
}

function obtenerDatosJugadorParaInforme(jugador) {
  if (!jugador) return {};

  return CAMPOS_INFORME_JUGADOR.reduce((resultado, campo) => {
    resultado[campo] = String(jugador?.[campo] || '').trim();
    return resultado;
  }, {});
}

function crearInformeNormalizado(datos = {}) {
  const base = crearInformeVacio();
  const informe = { ...base, ...datos };
  informe.fecha = normalizarFechaInput(informe.fecha) || obtenerFechaHoyISO();
  const partidoCalculado = String(calcularPartidoInforme(informe)).trim();
  informe.partido = partidoCalculado || String(informe.partido || '').trim();
  return informe;
}

function formatearValorInforme(valor) {
  const texto = String(valor ?? '').trim();
  return texto || '-';
}

function ordenarInformes(informes) {
  return [...informes].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
}

function normalizarListadoResponsablesAlta(valores = []) {
  return [...new Map(valores.map((valor) => [String(valor || '').trim().toLowerCase(), String(valor || '').trim()]))]
    .map(([, valor]) => valor)
    .filter(Boolean);
}

function leerResponsablesAltaGuardados() {
  if (typeof window === 'undefined') {
    return RESPONSABLES_ALTA_INICIALES;
  }

  try {
    const guardados = JSON.parse(window.localStorage.getItem(RESPONSABLES_ALTA_STORAGE_KEY) || '[]');
    return normalizarListadoResponsablesAlta([...RESPONSABLES_ALTA_INICIALES, ...(Array.isArray(guardados) ? guardados : [])]);
  } catch {
    return RESPONSABLES_ALTA_INICIALES;
  }
}

function guardarResponsablesAlta(valores) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(RESPONSABLES_ALTA_STORAGE_KEY, JSON.stringify(normalizarListadoResponsablesAlta(valores)));
  } catch {
    // Si localStorage no esta disponible, seguimos sin persistencia.
  }
}

function generarIdJugador() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caracter) => {
    const aleatorio = (Math.random() * 16) | 0;
    const valor = caracter === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}

function obtenerFechaHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function archivoADataUrl(archivo) {
  if (!archivo) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ''));
    lector.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    lector.readAsDataURL(archivo);
  });
}

function normalizarFechaInput(valor) {
  const limpia = String(valor || '').trim();
  if (!limpia) return '';

  const iso = limpia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const fechaEs = limpia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fechaEs) {
    const [, dia, mes, anio] = fechaEs;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return limpia;
}

function formatearFechaCorta(valor) {
  const fecha = normalizarFechaInput(valor);
  if (!fecha) return '-';

  const [anio, mes, dia] = fecha.split('-');
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function crearFormVacio({ clubPredeterminado = '', responsablePredeterminado = '' } = {}) {
  return CAMPOS.reduce(
    (acc, campo) => ({
      ...acc,
      [campo.key]:
        campo.key === 'fecha_alta'
          ? obtenerFechaHoyISO()
          : campo.key === 'fecha_nacimiento'
            ? FECHA_NACIMIENTO_POR_DEFECTO
          : campo.key === 'id_jugador'
            ? generarIdJugador()
            : campo.key === 'club'
              ? clubPredeterminado
              : campo.key === 'quien_da_alta'
                ? responsablePredeterminado
                : '',
    }),
    {}
  );
}

function ordenarRegistros(registros) {
  return [...registros].sort((a, b) => {
    const fechaA = normalizarFechaInput(a.fecha_alta);
    const fechaB = normalizarFechaInput(b.fecha_alta);
    return fechaB.localeCompare(fechaA) || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es', { sensitivity: 'base' });
  });
}

function parseFechaNacimiento(valor) {
  const limpia = String(valor || '').trim();
  const match = limpia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, dia, mes, anio] = match;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }

  const iso = limpia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }

  return null;
}

function calcularDatosNacimiento(fechaNacimiento) {
  const fecha = parseFechaNacimiento(fechaNacimiento);
  if (!fecha || Number.isNaN(fecha.getTime())) {
    return {
      anio_nacimiento: '',
      edad: '',
    };
  }

  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const cumplePendiente = hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate());

  if (cumplePendiente) edad -= 1;

  return {
    anio_nacimiento: String(fecha.getFullYear()),
    edad: String(edad),
  };
}

function nombreCompleto(registro) {
  if (!registro) return '';
  return [registro.nombre, registro.primer_apellido].filter(Boolean).join(' ');
}

function obtenerValorCampoTabla(registro, campo) {
  if (campo.key === 'nombre_completo') {
    return nombreCompleto(registro) || '-';
  }

  return registro[campo.key] || '-';
}

function obtenerFotoJugadorUrl(registro) {
  const firmada = String(registro?.foto_jugador_url || '').trim();
  if (firmada) return firmada;

  const valor = String(registro?.foto_jugador || '').trim();
  return /^https?:\/\//i.test(valor) || /^data:/i.test(valor) ? valor : '';
}

function normalizarComparacion(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function obtenerEquiposFiltradosPorClub(listaEquipos, clubSeleccionado) {
  const clubNormalizado = normalizarComparacion(clubSeleccionado);
  if (!clubNormalizado) return [];

  const equipos = [];
  const vistos = new Set();

  (listaEquipos?.filas || []).forEach((fila) => {
    const clubFila = String(fila?.club || '').trim();
    const equipoFila = String(fila?.nombre || '').trim();
    if (!clubFila || !equipoFila) return;
    if (clubNormalizado && normalizarComparacion(clubFila) !== clubNormalizado) return;

    const clave = normalizarComparacion(equipoFila);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    equipos.push(equipoFila);
  });

  return equipos;
}

function obtenerOpcionesEquipoFormulario(listaEquipos, clubSeleccionado, equipoActual = '') {
  const equipos = obtenerEquiposFiltradosPorClub(listaEquipos, clubSeleccionado);
  const equipoLimpio = String(equipoActual || '').trim();

  if (equipoLimpio && !equipos.some((equipo) => normalizarComparacion(equipo) === normalizarComparacion(equipoLimpio))) {
    equipos.push(equipoLimpio);
  }

  return equipos;
}

function obtenerOpcionesSelect(campo, valorActual = '') {
  const opcionesBase = Array.isArray(campo.options) ? campo.options : [];
  const valorLimpio = String(valorActual || '').trim();

  if (!valorLimpio) {
    return opcionesBase;
  }

  return opcionesBase.some((opcion) => opcion === valorLimpio) ? opcionesBase : [...opcionesBase, valorLimpio];
}

function obtenerOpcionesUnicas(...listados) {
  const vistos = new Set();
  const opciones = [];

  listados.flat().forEach((valor) => {
    const limpio = String(valor || '').trim();
    if (!limpio) return;

    const clave = normalizarComparacion(limpio);
    if (vistos.has(clave)) return;

    vistos.add(clave);
    opciones.push(limpio);
  });

  return opciones;
}

function filtrarRegistrosPorFiltros(registros, filtros, claveExcluida = '') {
  const criterios = Object.entries(filtros).filter(([clave, valor]) => clave !== claveExcluida && String(valor || '').trim());
  if (criterios.length === 0) return registros;

  return registros.filter((registro) =>
    criterios.every(([clave, valorSeleccionado]) => normalizarComparacion(registro?.[clave]) === normalizarComparacion(valorSeleccionado))
  );
}

function obtenerOpcionesFiltroDependientes(registros, filtros, clave, opcionesBase = []) {
  const registrosFiltrados = filtrarRegistrosPorFiltros(registros, filtros, clave);
  const valorActual = String(filtros?.[clave] || '').trim();
  const opcionesDesdeBase = Array.isArray(opcionesBase) && opcionesBase.length > 0
    ? opcionesBase.filter((opcion) =>
        registrosFiltrados.some((registro) => normalizarComparacion(registro?.[clave]) === normalizarComparacion(opcion))
      )
    : [];
  const opcionesDesdeRegistros = registrosFiltrados.map((registro) => registro?.[clave]);

  return obtenerOpcionesUnicas(opcionesDesdeBase, opcionesDesdeRegistros, valorActual ? [valorActual] : []);
}

function FiltroBuscador({ label, value, options, emptyLabel, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [busquedaInterna, setBusquedaInterna] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!abierto) {
      setBusquedaInterna('');
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [abierto]);

  useEffect(() => {
    const manejarClickFuera = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setAbierto(false);
      }
    };

    const manejarEscape = (event) => {
      if (event.key === 'Escape') {
        setAbierto(false);
      }
    };

    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarEscape);

    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, []);

  const opcionesFiltradas = useMemo(() => {
    const texto = normalizarComparacion(busquedaInterna);
    if (!texto) return options;

    return options.filter((opcion) => normalizarComparacion(opcion).includes(texto));
  }, [busquedaInterna, options]);

  const valorVisible = String(value || '').trim() || emptyLabel;

  const seleccionarOpcion = (opcion) => {
    onChange(opcion);
    setAbierto(false);
    setBusquedaInterna('');
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/50">{label}</span>
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-club-black shadow-sm transition-colors hover:border-club-red/40 focus:outline-none focus:ring-2 focus:ring-club-red"
      >
        <span className={String(value || '').trim() ? 'font-medium' : 'text-club-black/60'}>{valorVisible}</span>
        <span className={`ml-3 text-xs text-club-black/50 transition-transform ${abierto ? 'rotate-180' : ''}`}>âŒ„</span>
      </button>

      {abierto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
          <input
            ref={inputRef}
            type="text"
            value={busquedaInterna}
            onChange={(event) => setBusquedaInterna(event.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
          />

          <div className="mt-3 max-h-64 overflow-auto pr-1">
            <button
              type="button"
              onClick={() => seleccionarOpcion('')}
              className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                !String(value || '').trim() ? 'bg-club-red text-white' : 'text-club-black hover:bg-red-50'
              }`}
            >
              <span>{emptyLabel}</span>
            </button>

            {opcionesFiltradas.length === 0 ? (
              <p className="px-3 py-3 text-sm text-club-black/50">No hay opciones que coincidan.</p>
            ) : (
              opcionesFiltradas.map((opcion) => {
                const seleccionado = normalizarComparacion(opcion) === normalizarComparacion(value);
                return (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => seleccionarOpcion(opcion)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      seleccionado ? 'bg-club-red text-white' : 'text-club-black hover:bg-red-50'
                    }`}
                  >
                    <span>{opcion}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Captacion() {
  const { user } = useAuth();
  const { club } = useClub();
  const navigate = useNavigate();
  const esAdministrador = user?.rol === 'administrador';
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(() => crearFormVacio());
  const [responsablesAlta, setResponsablesAlta] = useState(() => leerResponsablesAltaGuardados());
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState({
    club: '',
    etapa: '',
    categoria: '',
    anio_nacimiento: '',
    lateralidad: '',
    demarcacion: '',
  });
  const [seccionActiva, setSeccionActiva] = useState('base-datos');
  const [fotoJugadorFile, setFotoJugadorFile] = useState(null);
  const [fotoJugadorBaseUrl, setFotoJugadorBaseUrl] = useState('');
  const [fotoJugadorPreview, setFotoJugadorPreview] = useState('');
  const [informes, setInformes] = useState([]);
  const [loadingInformes, setLoadingInformes] = useState(true);
  const [errorInformes, setErrorInformes] = useState('');
  const [formInforme, setFormInforme] = useState(() => crearInformeVacio());
  const [editandoInformeId, setEditandoInformeId] = useState(null);
  const [mostrarFormularioInforme, setMostrarFormularioInforme] = useState(false);
  const [guardandoInforme, setGuardandoInforme] = useState(false);
  const camposVisibles = useMemo(
    () => (esAdministrador ? CAMPOS : CAMPOS.filter((campo) => campo.key !== 'id_jugador')),
    [esAdministrador]
  );

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError('');

    async function cargarRegistros() {
      try {
        const { registros: data } = await api.get('/captacion');
        if (!cancelado) setRegistros(ordenarRegistros(data || []));
      } catch (err) {
        if (!cancelado) {
          setRegistros([]);
          setError(err.message);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    cargarRegistros();
    return () => {
      cancelado = true;
    };
  }, [club]);

  useEffect(() => {
    let cancelado = false;
    setLoadingInformes(true);
    setErrorInformes('');

    async function cargarInformes() {
      try {
        const respuesta = await api.get('/captacion/informes');
        const data = Array.isArray(respuesta?.informes) ? respuesta.informes.filter(Boolean) : [];
        if (!cancelado) setInformes(ordenarInformes(data));
      } catch (err) {
        if (!cancelado) {
          setInformes([]);
          setErrorInformes(err.message);
        }
      } finally {
        if (!cancelado) setLoadingInformes(false);
      }
    }

    cargarInformes();
    return () => {
      cancelado = true;
    };
  }, [club]);

  useEffect(() => {
    guardarResponsablesAlta(responsablesAlta);
  }, [responsablesAlta]);

  useEffect(() => {
    if (!user?.username) return;
    asegurarResponsableAlta(user.username);
  }, [user?.username]);

  useEffect(() => {
    return () => {
      if (fotoJugadorPreview.startsWith('blob:')) {
        URL.revokeObjectURL(fotoJugadorPreview);
      }
    };
  }, [fotoJugadorPreview]);

  const registrosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtrosActivos = Object.entries(filtros).filter(([, valor]) => String(valor || '').trim());

    return registros.filter((registro) => {
      const coincideTexto =
        !texto
        || camposVisibles.some((campo) => String(registro[campo.key] || '').toLowerCase().includes(texto))
        || nombreCompleto(registro).toLowerCase().includes(texto);

      if (!coincideTexto) return false;

      return filtrosActivos.every(([clave, valorSeleccionado]) => {
        const valorRegistro = String(registro[clave] || '').trim();
        return normalizarComparacion(valorRegistro) === normalizarComparacion(valorSeleccionado);
      });
    });
  }, [busqueda, camposVisibles, filtros, registros]);

  const clubes = useListaValores('clubes');
  const etapas = useListaValores('etapas');
  const categorias = useListaValores('categorias');
  const listaEquipos = useLista('equipos');

  const opcionesClubes = useMemo(() => {
    const opciones = clubes.map((nombre) => String(nombre || '').trim()).filter(Boolean);
    const clubFormulario = String(form.club || '').trim();
    if (clubFormulario && !opciones.some((opcion) => opcion.toLowerCase() === clubFormulario.toLowerCase())) {
      opciones.push(clubFormulario);
    }
    return [...new Map(opciones.map((opcion) => [opcion.toLowerCase(), opcion])).values()];
  }, [clubes, form.club]);

  const opcionesEquipos = useMemo(
    () => obtenerOpcionesEquipoFormulario(listaEquipos, form.club, form.equipo),
    [form.club, form.equipo, listaEquipos]
  );

  const opcionesListas = useMemo(
    () => ({
      etapas: etapas.map((nombre) => String(nombre || '').trim()).filter(Boolean),
      categorias: categorias.map((nombre) => String(nombre || '').trim()).filter(Boolean),
    }),
    [categorias, etapas]
  );

  const opcionesFiltros = useMemo(
    () => ({
      club: obtenerOpcionesFiltroDependientes(registros, filtros, 'club', clubes),
      etapa: obtenerOpcionesFiltroDependientes(registros, filtros, 'etapa', opcionesListas.etapas),
      categoria: obtenerOpcionesFiltroDependientes(registros, filtros, 'categoria', opcionesListas.categorias),
      anio_nacimiento: obtenerOpcionesFiltroDependientes(registros, filtros, 'anio_nacimiento'),
      lateralidad: obtenerOpcionesFiltroDependientes(registros, filtros, 'lateralidad', ['Diestro', 'Zurdo', 'Ambas']),
      demarcacion: obtenerOpcionesFiltroDependientes(registros, filtros, 'demarcacion', [
        'Portero',
        'Lateral',
        'Central',
        'Medio',
        'Media punta',
        'Extremo',
        'Delantero',
      ]),
    }),
    [clubes, filtros, opcionesListas.categorias, opcionesListas.etapas, registros]
  );

  const limpiarFiltros = () => {
    setFiltros({
      club: '',
      etapa: '',
      categoria: '',
      anio_nacimiento: '',
      lateralidad: '',
      demarcacion: '',
    });
  };

  const actualizarFiltro = (clave, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [clave]: valor,
    }));
  };

  const camposFormulario = useMemo(
    () =>
      camposVisibles.map((campo) =>
        campo.key === 'categoria'
          ? {
              ...campo,
              type: 'select',
              options: opcionesListas.categorias,
            }
          : campo
      ),
    [camposVisibles, opcionesListas.categorias]
  );

  const camposFormularioDetalle = useMemo(
    () => camposFormulario.filter((campo) => campo.key !== 'foto_jugador'),
    [camposFormulario]
  );

  const camposFormularioPorClave = useMemo(
    () => new Map(camposFormulario.map((campo) => [campo.key, campo])),
    [camposFormulario]
  );

  const actualizarCampo = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'club'
        ? {
            equipo: obtenerEquiposFiltradosPorClub(listaEquipos, value).some(
              (equipo) => normalizarComparacion(equipo) === normalizarComparacion(prev.equipo)
            )
              ? prev.equipo
              : '',
          }
        : {}),
      ...(key === 'fecha_nacimiento' ? calcularDatosNacimiento(value) : {}),
    }));
  };

  const asegurarResponsableAlta = (valor) => {
    const responsable = String(valor || '').trim();
    if (!responsable) return;

    setResponsablesAlta((prev) =>
      prev.some((opcion) => opcion.toLowerCase() === responsable.toLowerCase()) ? prev : [...prev, responsable]
    );
  };

  const pedirNuevoResponsableAlta = () => {
    const responsable = window.prompt('Nombre de quien da alta');
    const limpio = String(responsable || '').trim();
    if (!limpio) return;

    setResponsablesAlta((prev) => (prev.some((opcion) => opcion.toLowerCase() === limpio.toLowerCase()) ? prev : [...prev, limpio]));
    actualizarCampo('quien_da_alta', limpio);
  };

  const manejarCambioResponsableAlta = (valor) => {
    if (valor === RESPONSABLES_ALTA_NUEVO_VALUE) {
      pedirNuevoResponsableAlta();
      return;
    }

    actualizarCampo('quien_da_alta', valor);
  };

  const manejarCambioFotoJugador = (event) => {
    const archivo = event.target.files?.[0] || null;
    setFotoJugadorFile(archivo);
    setFotoJugadorPreview(archivo ? URL.createObjectURL(archivo) : fotoJugadorBaseUrl);
  };

  const cancelarFormulario = () => {
    setForm(crearFormVacio({ clubPredeterminado: club, responsablePredeterminado: user?.username || '' }));
    setEditandoId(null);
    setMostrarFormulario(false);
    setFotoJugadorFile(null);
    setFotoJugadorBaseUrl('');
    setFotoJugadorPreview('');
  };

  const nuevoRegistro = () => {
    setForm(crearFormVacio({ clubPredeterminado: club, responsablePredeterminado: user?.username || '' }));
    setEditandoId(null);
    setMostrarFormulario(true);
    setFotoJugadorFile(null);
    setFotoJugadorBaseUrl('');
    setFotoJugadorPreview('');
  };

  const editarRegistro = (registro) => {
    asegurarResponsableAlta(registro.quien_da_alta);
    const fotoUrl = obtenerFotoJugadorUrl(registro);
    setForm(
      camposVisibles.reduce(
        (acc, campo) => ({
          ...acc,
          [campo.key]:
            campo.key === 'fecha_nacimiento'
              ? normalizarFechaInput(registro[campo.key])
              : campo.key === 'anio_nacimiento' || campo.key === 'edad'
                ? String(registro[campo.key] || '').trim()
                : campo.type === 'date'
                  ? normalizarFechaInput(registro[campo.key])
                  : registro[campo.key] || '',
        }),
        {}
      )
    );
    setEditandoId(registro.id);
    setMostrarFormulario(true);
    setFotoJugadorFile(null);
    setFotoJugadorBaseUrl(fotoUrl);
    setFotoJugadorPreview(fotoUrl);
  };

  const eliminarRegistro = async (registro) => {
    if (!window.confirm(`Eliminar el registro de ${nombreCompleto(registro) || 'captacion'}?`)) return;

    try {
      await api.delete(`/captacion/${registro.id}`);
      setRegistros((prev) => prev.filter((item) => item.id !== registro.id));
      if (editandoId === registro.id) cancelarFormulario();
    } catch (err) {
      setError(`No se pudo eliminar el registro: ${err.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setGuardando(true);
    setError('');
    try {
      const datosNacimiento = calcularDatosNacimiento(form.fecha_nacimiento);
      const formCalculado = {
        ...form,
        ...datosNacimiento,
      };
      const payload = {
        ...camposVisibles.reduce(
          (acc, campo) => ({
            ...acc,
            [campo.key]: String(formCalculado[campo.key] || '').trim(),
          }),
          {}
        ),
      };

      if (fotoJugadorFile) {
        payload.foto_jugador = await archivoADataUrl(fotoJugadorFile);
      }

      let registroGuardado;
      if (editandoId) {
        const resultado = await api.put(`/captacion/${editandoId}`, payload);
        registroGuardado = resultado.registro;
        setRegistros((prev) => ordenarRegistros(prev.map((item) => (item.id === editandoId ? registroGuardado : item))));
      } else {
        const resultado = await api.post('/captacion', payload);
        registroGuardado = resultado.registro;
        setRegistros((prev) => ordenarRegistros([registroGuardado, ...prev]));
      }

      cancelarFormulario();
    } catch (err) {
      setError(`No se pudo guardar el registro: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const actualizarCampoInforme = (key, value) => {
    setFormInforme((prev) => {
      const siguiente = { ...prev, [key]: value };

      if (key === 'jugador_id') {
        const jugador = registros.find((registro) => String(registro.id) === String(value));
        const datosJugador = jugador
          ? obtenerDatosJugadorParaInforme(jugador)
          : CAMPOS_INFORME_JUGADOR.reduce((resultado, campo) => {
              resultado[campo] = '';
              return resultado;
            }, {});
        Object.assign(siguiente, datosJugador);
      }

      if (key === 'local' || key === 'visitante' || key === 'partido') {
        siguiente.partido = calcularPartidoInforme(siguiente);
      }

      return siguiente;
    });
  };

  const cancelarFormularioInforme = () => {
    setFormInforme(crearInformeVacio());
    setEditandoInformeId(null);
    setMostrarFormularioInforme(false);
  };

  const nuevoInforme = () => {
    setFormInforme(crearInformeVacio());
    setEditandoInformeId(null);
    setMostrarFormularioInforme(true);
    setErrorInformes('');
  };

  const editarInforme = (informe) => {
    setFormInforme(crearInformeNormalizado(informe));
    setEditandoInformeId(informe.id);
    setMostrarFormularioInforme(true);
    setErrorInformes('');
  };

  const eliminarInforme = async (informe) => {
    if (!window.confirm('Eliminar este informe de captacion?')) return;

    try {
      await api.delete(`/captacion/informes/${informe.id}`);
      setInformes((prev) => prev.filter((item) => item.id !== informe.id));
      if (editandoInformeId === informe.id) cancelarFormularioInforme();
    } catch (err) {
      setErrorInformes(`No se pudo eliminar el informe: ${err.message}`);
    }
  };

  const handleInformeSubmit = async (event) => {
    event.preventDefault();
    setGuardandoInforme(true);
    setErrorInformes('');

    try {
      const partido = calcularPartidoInforme(formInforme);
      const payload = {
        fecha: normalizarFechaInput(formInforme.fecha),
        observador: String(formInforme.observador || '').trim(),
        jugador_id: formInforme.jugador_id,
        etapa: String(formInforme.etapa || '').trim(),
        categoria: String(formInforme.categoria || '').trim(),
        local: String(formInforme.local || '').trim(),
        visitante: String(formInforme.visitante || '').trim(),
        partido,
        dorsal: String(formInforme.dorsal || '').trim(),
        tipologia: String(formInforme.tipologia || '').trim(),
        lateralidad: String(formInforme.lateralidad || '').trim(),
        titularidad: String(formInforme.titularidad || '').trim(),
        minutos_jugados: String(formInforme.minutos_jugados || '').trim(),
        goles: String(formInforme.goles || '').trim(),
        goles_encajados: String(formInforme.goles_encajados || '').trim(),
      };
      const resultado = editandoInformeId
        ? await api.put(`/captacion/informes/${editandoInformeId}`, payload)
        : await api.post('/captacion/informes', payload);
      const informeGuardado = resultado.informe;

      setInformes((prev) =>
        ordenarInformes(
          editandoInformeId
            ? prev.map((item) => (item.id === editandoInformeId ? informeGuardado : item))
            : [informeGuardado, ...prev]
        )
      );
      cancelarFormularioInforme();
    } catch (err) {
      setErrorInformes(`No se pudo guardar el informe: ${err.message}`);
    } finally {
      setGuardandoInforme(false);
    }
  };

  const renderCampoInforme = (campo) => {
    const valor = campo === 'partido' ? calcularPartidoInforme(formInforme) : formInforme[campo] || '';
    const inputClass =
      'w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red';
    const readOnlyClass = 'w-full rounded-2xl border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm text-club-black/70 cursor-not-allowed';
    const selectClass =
      'w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red';

    let control = null;
    if (campo === 'fecha') {
      control = <input type="date" required value={valor} onChange={(event) => actualizarCampoInforme(campo, event.target.value)} className={inputClass} />;
    } else if (campo === 'observador') {
      control = (
        <input
          type="text"
          required
          value={valor}
          onChange={(event) => actualizarCampoInforme(campo, event.target.value)}
          placeholder="Nombre del observador"
          className={inputClass}
        />
      );
    } else if (campo === 'jugador_id') {
      control = (
        <select
          required
          value={valor}
          onChange={(event) => actualizarCampoInforme(campo, event.target.value)}
          className={selectClass}
        >
          <option value="">Seleccionar jugador</option>
          {registros
            .filter((registro) => registro.id)
            .map((registro) => (
              <option key={registro.id} value={registro.id}>
                {nombreCompleto(registro) || 'Jugador sin nombre'}
                {registro.club ? ` - ${registro.club}` : ''}
              </option>
            ))}
        </select>
      );
    } else if (campo === 'lateralidad') {
      control = (
        <select value={valor} onChange={(event) => actualizarCampoInforme(campo, event.target.value)} className={selectClass}>
          <option value="">Seleccionar</option>
          {['DIESTRO', 'ZURDO', 'AMBAS'].map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      );
    } else if (campo === 'titularidad') {
      control = (
        <select value={valor} onChange={(event) => actualizarCampoInforme(campo, event.target.value)} className={selectClass}>
          <option value="">Seleccionar</option>
          {INFORME_TITULARIDAD_OPCIONES.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      );
    } else if (campo === 'partido') {
      control = <input type="text" value={valor} readOnly className={readOnlyClass} />;
    } else if (campo === 'dorsal' || campo === 'minutos_jugados' || campo === 'goles' || campo === 'goles_encajados') {
      control = (
        <input
          type="number"
          min="0"
          step="1"
          value={valor}
          onChange={(event) => actualizarCampoInforme(campo, event.target.value)}
          className={inputClass}
        />
      );
    } else {
      control = (
        <input
          type="text"
          value={valor}
          onChange={(event) => actualizarCampoInforme(campo, event.target.value)}
          className={inputClass}
        />
      );
    }

    return (
      <div key={campo} className="min-w-0">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/55">
          {ETIQUETAS_INFORME[campo] || campo.toUpperCase()}
        </label>
        {control}
      </div>
    );
  };

  const renderCampoFormulario = (campo) => {
    if (campo.type === 'imageUpload') {
      return null;
    }

    const valor = form[campo.key];
    const esAnchoCompleto = campo.type === 'textarea' || campo.type === 'ratingButtons';
    const inputClass =
      'w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red';
    const readOnlyClass = 'w-full rounded-2xl border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm text-club-black/70 cursor-not-allowed';
    const selectClass =
      'w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red';

    let contenido = null;

    if (campo.type === 'textarea') {
      contenido = (
        <textarea
          value={valor}
          onChange={(event) => actualizarCampo(campo.key, event.target.value)}
          rows={4}
          className={inputClass}
        />
      );
    } else if (campo.type === 'ratingButtons') {
      contenido = (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            {VALORACION_GENERAL_OPCIONES.map((opcion) => {
              const seleccionado = String(valor) === String(opcion);
              return (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => actualizarCampo(campo.key, String(opcion))}
                  aria-pressed={seleccionado}
                  aria-label={`Valoracion ${opcion}`}
                  className={`inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-club-red focus:ring-offset-1 ${
                    seleccionado
                      ? 'border-club-red bg-club-red text-white shadow-sm'
                      : 'border-gray-300 bg-white text-club-black hover:border-club-red/40 hover:bg-red-50'
                  }`}
                >
                  {opcion}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-club-black/45">Selecciona una puntuacion del 1 al 5.</p>
        </div>
      );
    } else if (campo.type === 'clubSelect') {
      contenido = (
        <select value={valor} onChange={(event) => actualizarCampo(campo.key, event.target.value)} className={selectClass}>
          <option value="">Seleccionar</option>
          {opcionesClubes.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      );
    } else if (campo.key === 'equipo') {
      contenido = (
        <select
          value={valor}
          onChange={(event) => actualizarCampo(campo.key, event.target.value)}
          disabled={!String(form.club || '').trim()}
          className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-club-black/50"
        >
          <option value="">
            {String(form.club || '').trim()
              ? opcionesEquipos.length > 0
                ? 'Seleccionar'
                : 'Sin equipos disponibles'
              : 'Selecciona primero un club'}
          </option>
          {opcionesEquipos.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      );
    } else if (campo.type === 'listaSelect') {
      contenido = (
        <select value={valor} onChange={(event) => actualizarCampo(campo.key, event.target.value)} className={selectClass}>
          <option value="">{(opcionesListas[campo.listaId] || []).length > 0 ? 'Seleccionar' : 'Sin opciones disponibles'}</option>
          {(opcionesListas[campo.listaId] || []).map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      );
    } else if (campo.type === 'selectWithAdd') {
      contenido = (
        <select value={valor} onChange={(event) => manejarCambioResponsableAlta(event.target.value)} className={selectClass}>
          <option value="">Seleccionar</option>
          {responsablesAlta.map((responsable) => (
            <option key={responsable} value={responsable}>
              {responsable}
            </option>
          ))}
          <option value={RESPONSABLES_ALTA_NUEVO_VALUE}>+ Anadir nuevo...</option>
        </select>
      );
    } else if (campo.type === 'computed' || campo.key === 'anio_nacimiento' || campo.key === 'edad') {
      contenido = (
        <input
          type="text"
          value={campo.type === 'computed' ? nombreCompleto(form) : valor}
          readOnly
          className={readOnlyClass}
        />
      );
    } else if (campo.type === 'select') {
      contenido = (
        <select value={valor} onChange={(event) => actualizarCampo(campo.key, event.target.value)} className={selectClass}>
          <option value="">Seleccionar</option>
          {obtenerOpcionesSelect(campo, valor).map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      );
    } else {
      contenido = (
        <input
          type={campo.type}
          required={campo.required}
          value={valor}
          readOnly={campo.key === 'id_jugador'}
          onChange={campo.key === 'id_jugador' ? undefined : (event) => actualizarCampo(campo.key, event.target.value)}
          className={`${campo.key === 'id_jugador' ? readOnlyClass : inputClass} ${
            campo.key === 'id_jugador' ? 'text-club-black/60' : ''
          }`}
        />
      );
    }

    return (
      <div
        key={campo.key}
        className={`rounded-2xl border border-gray-200 bg-white p-4 ${esAnchoCompleto ? 'sm:col-span-2 xl:col-span-3' : ''}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{campo.label}</p>
        <div className="mt-2">{contenido}</div>
      </div>
    );
  };

  const renderTablaInforme = (titulo, filas, columnas, emptyText) => (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-club-black">{titulo}</h3>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[520px] w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-club-black text-white">
            <tr>
              {columnas.map((columna) => (
                <th key={columna.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {columna.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="px-4 py-6 text-center text-club-black/60">
                  {emptyText}
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.id} className="hover:bg-red-50/40 transition-colors">
                  {columnas.map((columna) => (
                    <td key={columna.key} className="px-4 py-3 text-club-black/80">
                      {fila[columna.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const CaptacionFormulario = ({
    formActual,
    fotoJugadorPreviewActual,
    fotoJugadorFileActual,
    editandoIdActual,
    guardandoActual,
    cancelarFormularioActual,
    manejarCambioFotoJugadorActual,
    handleSubmitActual,
    camposFormularioDetalleActual,
    camposFormularioPorClaveActual,
    actualizarCampoFormulario,
    opcionesClubesFormulario,
    opcionesEquiposFormulario,
    opcionesListasFormulario,
    responsablesAltaFormulario,
    manejarCambioResponsableAltaFormulario,
  }) => {
    const nombreFormulario = [formActual.nombre, formActual.primer_apellido].filter(Boolean).join(' ');

    return (
      <form onSubmit={handleSubmitActual} className="mb-6">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ficha completa</p>
            <h3 className="mt-1 text-2xl font-bold">{nombreFormulario || (editandoIdActual ? 'Editar registro' : 'Nuevo registro')}</h3>
            <p className="text-sm text-white/80">{String(formActual.club || '').trim() || 'Sin club asignado'}</p>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[240px_1fr]">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                {fotoJugadorPreviewActual ? (
                  <img src={fotoJugadorPreviewActual} alt="Vista previa de la foto del jugador" className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center text-sm font-semibold text-club-black/40">
                    Sin foto disponible
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">Foto jugador</p>
                  <p className="mt-1 text-sm text-club-black/60">JPG, PNG o WEBP. Se guardara como imagen privada.</p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={manejarCambioFotoJugadorActual}
                  className="block w-full text-sm text-club-black file:mr-4 file:rounded-md file:border-0 file:bg-club-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-club-redDark"
                />
                {fotoJugadorPreviewActual ? (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <img
                      src={fotoJugadorPreviewActual}
                      alt="Vista previa de la foto del jugador"
                      className="h-16 w-16 rounded-md object-cover border border-gray-200 bg-white"
                    />
                    <div className="text-xs text-club-black/60">
                      <p className="font-semibold text-club-black/80">{fotoJugadorFileActual ? 'Nueva imagen seleccionada' : 'Imagen actual'}</p>
                      <p>La foto se actualizara al guardar.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-club-black/40">Todavia no hay foto cargada.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Edad</p>
                  <p className="mt-1 text-xl font-bold text-club-black">{formActual.edad || '-'}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Dorsal</p>
                  <p className="mt-1 text-xl font-bold text-club-black">{formActual.dorsal || '-'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {CAMPOS_CHIPS_RESUMEN.map((campo) => {
                  const valor = String(formActual[campo] || '').trim();
                  if (!valor) return null;
                  return (
                    <span
                      key={campo}
                      className="inline-flex items-center rounded-full border border-club-red/20 bg-club-red/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-club-red"
                    >
                      {valor}
                    </span>
                  );
                })}
              </div>

              <div className="space-y-4">
                {BLOQUES_FORMULARIO_CAPTACION.map((bloque) => (
                  <section key={bloque.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{bloque.title}</h4>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {bloque.fields
                        .filter((campoKey) => campoKey !== 'foto_jugador')
                        .map((campoKey) => {
                          const campo = camposFormularioPorClaveActual.get(campoKey) || camposFormularioDetalleActual.find((item) => item.key === campoKey);
                          return campo ? renderCampoFormulario(campo) : null;
                        })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="submit"
                    disabled={guardandoActual}
                    className="w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-5 py-2 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {guardandoActual ? 'Guardando...' : editandoIdActual ? 'Guardar cambios' : 'Crear registro'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarFormularioActual}
                    className="w-full sm:w-auto px-5 py-2 rounded-md font-semibold text-club-black border border-gray-300 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </form>
    );
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50 mb-2">Seguimiento</p>
          <h2 className="text-2xl font-bold text-club-black">Captacion</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {SECCIONES_CAPTACION.map((seccion) => (
            <button
              key={seccion.id}
              type="button"
              onClick={() => setSeccionActiva(seccion.id)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors border ${
                seccionActiva === seccion.id
                  ? 'bg-club-red text-white border-club-red'
                  : 'bg-white text-club-black/75 border-gray-300 hover:bg-red-50 hover:border-club-red/40'
              }`}
            >
              {seccion.label}
            </button>
          ))}
        </div>
      </div>

      {seccionActiva === 'base-datos' ? (
        <>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <input
              type="text"
              placeholder="Buscar jugador, club, equipo..."
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                className="w-full sm:w-72 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
              />
              {!mostrarFormulario && (
                <button
                  type="button"
                  onClick={nuevoRegistro}
                  className="w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-4 py-2 rounded-md transition-colors"
                >
                  + Nuevo registro
                </button>
              )}
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-end gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 flex-1">                <FiltroBuscador
                  label="Club"
                  value={filtros.club}
                  options={opcionesFiltros.club}
                  emptyLabel="Todos"
                  onChange={(valor) => actualizarFiltro('club', valor)}
                />                <FiltroBuscador
                  label="Etapa"
                  value={filtros.etapa}
                  options={opcionesFiltros.etapa}
                  emptyLabel="Todas"
                  onChange={(valor) => actualizarFiltro('etapa', valor)}
                />                <FiltroBuscador
                  label="Categoría"
                  value={filtros.categoria}
                  options={opcionesFiltros.categoria}
                  emptyLabel="Todas"
                  onChange={(valor) => actualizarFiltro('categoria', valor)}
                />                <FiltroBuscador
                  label="Categoría año"
                  value={filtros.anio_nacimiento}
                  options={opcionesFiltros.anio_nacimiento}
                  emptyLabel="Todos"
                  onChange={(valor) => actualizarFiltro('anio_nacimiento', valor)}
                />                <FiltroBuscador
                  label="Lateralidad"
                  value={filtros.lateralidad}
                  options={opcionesFiltros.lateralidad}
                  emptyLabel="Todas"
                  onChange={(valor) => actualizarFiltro('lateralidad', valor)}
                />                <FiltroBuscador
                  label="Demarcación"
                  value={filtros.demarcacion}
                  options={opcionesFiltros.demarcacion}
                  emptyLabel="Todas"
                  onChange={(valor) => actualizarFiltro('demarcacion', valor)}
                />
              </div>
              <button
                type="button"
                onClick={limpiarFiltros}
                className="w-full xl:w-auto rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {mostrarFormulario && (
            <CaptacionFormulario
              formActual={form}
              fotoJugadorPreviewActual={fotoJugadorPreview}
              fotoJugadorFileActual={fotoJugadorFile}
              editandoIdActual={editandoId}
              guardandoActual={guardando}
              cancelarFormularioActual={cancelarFormulario}
              manejarCambioFotoJugadorActual={manejarCambioFotoJugador}
              handleSubmitActual={handleSubmit}
              camposFormularioDetalleActual={camposFormularioDetalle}
              camposFormularioPorClaveActual={camposFormularioPorClave}
              actualizarCampoFormulario={actualizarCampo}
              opcionesClubesFormulario={opcionesClubes}
              opcionesEquiposFormulario={opcionesEquipos}
              opcionesListasFormulario={opcionesListas}
              responsablesAltaFormulario={responsablesAlta}
              manejarCambioResponsableAltaFormulario={manejarCambioResponsableAlta}
            />
          )}

          {false && (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6 shadow-sm space-y-4"
            >
              <h3 className="font-bold text-club-black">{editandoId ? 'Editar registro' : 'Nuevo registro'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {camposFormulario.map((campo) => (
                  <div key={campo.key} className={campo.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-club-black/70 mb-1">{campo.label}</label>
                    {campo.type === 'textarea' ? (
                      <textarea
                        value={form[campo.key]}
                        onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    ) : campo.type === 'ratingButtons' ? (
                      <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                        <div className="grid grid-cols-5 gap-2">
                          {VALORACION_GENERAL_OPCIONES.map((valor) => {
                            const seleccionado = String(form[campo.key]) === String(valor);
                            return (
                              <button
                                key={valor}
                                type="button"
                                onClick={() => actualizarCampo(campo.key, String(valor))}
                                aria-pressed={seleccionado}
                                aria-label={`Valoracion ${valor}`}
                                className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-club-red focus:ring-offset-1 ${
                                  seleccionado
                                    ? 'border-club-red bg-club-red text-white shadow-sm'
                                    : 'border-gray-300 bg-white text-club-black hover:border-club-red/40 hover:bg-red-50'
                                }`}
                              >
                                {valor}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-club-black/45">Selecciona una puntuacion del 1 al 5.</p>
                      </div>
                    ) : campo.type === 'clubSelect' ? (
                      <select
                        value={form[campo.key]}
                        onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                      >
                        <option value="">Seleccionar</option>
                        {opcionesClubes.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    ) : campo.key === 'equipo' ? (
                      <select
                        value={form[campo.key]}
                        onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                        disabled={!String(form.club || '').trim()}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-club-black/50"
                      >
                        <option value="">
                          {String(form.club || '').trim()
                            ? opcionesEquipos.length > 0
                              ? 'Seleccionar'
                              : 'Sin equipos disponibles'
                            : 'Selecciona primero un club'}
                        </option>
                        {opcionesEquipos.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    ) : campo.type === 'listaSelect' ? (
                      <select
                        value={form[campo.key]}
                        onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                      >
                        <option value="">{(opcionesListas[campo.listaId] || []).length > 0 ? 'Seleccionar' : 'Sin opciones disponibles'}</option>
                        {(opcionesListas[campo.listaId] || []).map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    ) : campo.type === 'selectWithAdd' ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={form[campo.key]}
                          onChange={(event) => manejarCambioResponsableAlta(event.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                        >
                          <option value="">Seleccionar</option>
                          {responsablesAlta.map((responsable) => (
                            <option key={responsable} value={responsable}>
                              {responsable}
                            </option>
                          ))}
                          <option value={RESPONSABLES_ALTA_NUEVO_VALUE}>+ Anadir nuevo...</option>
                        </select>
                      </div>
                    ) : campo.type === 'imageUpload' ? (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={manejarCambioFotoJugador}
                          className="block w-full text-sm text-club-black file:mr-4 file:rounded-md file:border-0 file:bg-club-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-club-redDark"
                        />
                        <p className="text-xs text-club-black/50">JPG, PNG o WEBP. Se guardarÃ¡ como imagen privada.</p>
                        {fotoJugadorPreview ? (
                          <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-2">
                            <img
                              src={fotoJugadorPreview}
                              alt="Vista previa de la foto del jugador"
                              className="h-16 w-16 rounded-md object-cover border border-gray-200 bg-white"
                            />
                            <div className="text-xs text-club-black/60">
                              <p className="font-semibold text-club-black/80">
                                {fotoJugadorFile ? 'Nueva imagen seleccionada' : 'Imagen actual'}
                              </p>
                              <p>La foto se actualizarÃ¡ al guardar.</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-club-black/40">TodavÃ­a no hay foto cargada.</p>
                        )}
                      </div>
                    ) : campo.type === 'computed' ? (
                      <input
                        type="text"
                        value={nombreCompleto(form)}
                        readOnly
                        className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-club-black/70 cursor-not-allowed"
                      />
                    ) : campo.key === 'anio_nacimiento' || campo.key === 'edad' ? (
                      <input
                        type="text"
                        value={form[campo.key]}
                        readOnly
                        className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-club-black/70 cursor-not-allowed"
                      />
                    ) : campo.type === 'select' ? (
                      <select
                        value={form[campo.key]}
                        onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                      >
                        <option value="">Seleccionar</option>
                        {obtenerOpcionesSelect(campo, form[campo.key]).map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={campo.type}
                        required={campo.required}
                        value={form[campo.key]}
                        readOnly={campo.key === 'id_jugador'}
                        onChange={campo.key === 'id_jugador' ? undefined : (event) => actualizarCampo(campo.key, event.target.value)}
                        className={`w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red ${
                          campo.key === 'id_jugador' ? 'bg-gray-100 text-club-black/60 cursor-not-allowed' : ''
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-5 py-2 rounded-md transition-colors"
                >
                  {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear registro'}
                </button>
                <button
                  type="button"
                  onClick={cancelarFormulario}
                  className="w-full sm:w-auto px-5 py-2 rounded-md font-semibold text-club-black border border-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {error && (
            <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <span className="text-2xl font-bold text-club-red tabular-nums">{registrosFiltrados.length}</span>
            <span className="text-sm font-medium text-club-black/70">{registrosFiltrados.length === 1 ? 'registro' : 'registros'}</span>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-200">
            <table className="min-w-[2600px] divide-y divide-gray-200 bg-white text-sm">
              <thead className="bg-club-black text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide sticky left-0 z-20 bg-club-black">
                    Acciones
                  </th>
                  {camposVisibles.map((campo) => (
                    <th key={campo.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      {campo.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={camposVisibles.length + 1} className="px-4 py-6 text-center text-club-black/60">
                      Cargando registros de captacion...
                    </td>
                  </tr>
                ) : registrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={camposVisibles.length + 1} className="px-4 py-6 text-center text-club-black/60">
                      No se han encontrado registros de captacion.
                    </td>
                  </tr>
                ) : (
                  registrosFiltrados.map((registro) => (
                    <tr key={registro.id} className="hover:bg-red-50/40 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-white whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/captacion/${registro.id}`)}
                            title="Ver"
                            aria-label="Ver"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-club-black/60 transition-colors hover:bg-gray-100 hover:text-club-black"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                              <path d="M10 4.5c3.8 0 6.9 2.3 8.1 5.5C16.9 13.2 13.8 15.5 10 15.5S3.1 13.2 1.9 10C3.1 6.8 6.2 4.5 10 4.5Zm0 1.5c-2.9 0-5.3 1.7-6.3 4 1 2.3 3.4 4 6.3 4s5.3-1.7 6.3-4c-1-2.3-3.4-4-6.3-4Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => editarRegistro(registro)}
                            title="Editar"
                            aria-label="Editar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-club-red transition-colors hover:bg-red-50 hover:text-club-redDark"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                              <path d="M13.9 2.9a2 2 0 0 1 2.8 2.8l-.8.8-2.8-2.8.8-.8Zm-2 2L4 12.8V16h3.2l7.9-7.9-3.2-3.2Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarRegistro(registro)}
                            title="Eliminar"
                            aria-label="Eliminar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-club-black/60 transition-colors hover:bg-red-50 hover:text-club-red"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                              <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V4h3a1 1 0 1 1 0 2h-1v9.5A2.5 2.5 0 0 1 12.5 18h-5A2.5 2.5 0 0 1 5 15.5V6H4a1 1 0 1 1 0-2h3v-.5ZM8.5 4h3v-.5h-3V4ZM7 6v9.5c0 .3.2.5.5.5h5a.5.5 0 0 0 .5-.5V6H7Zm2 2a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm3 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      {camposVisibles.map((campo) => (
                        <td
                          key={campo.key}
                          className="px-4 py-3 text-club-black/80 max-w-[220px] truncate"
                          title={campo.key === 'nombre_completo' ? nombreCompleto(registro) : registro[campo.key] || ''}
                        >
                          {campo.key === 'enlace' || campo.key === 'foto_jugador' ? (
                            (campo.key === 'foto_jugador' ? obtenerFotoJugadorUrl(registro) : registro[campo.key]) ? (
                              <a
                                href={campo.key === 'foto_jugador' ? obtenerFotoJugadorUrl(registro) : registro[campo.key]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-club-red font-semibold hover:underline"
                              >
                                Abrir
                              </a>
                            ) : (
                              '-'
                            )
                          ) : campo.key === 'nombre_completo' ? (
                            nombreCompleto(registro) || '-'
                          ) : (
                            registro[campo.key] || '-'
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-club-black">Informes de seguimiento</h3>
              <p className="text-sm text-club-black/60 mt-1">Cada informe queda vinculado a un jugador de la base de datos de captacion.</p>
            </div>
            {!mostrarFormularioInforme && (
              <button
                type="button"
                onClick={nuevoInforme}
                className="w-full lg:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-4 py-2 rounded-md transition-colors"
              >
                + Nuevo informe
              </button>
            )}
          </div>

          {mostrarFormularioInforme && (
            <form onSubmit={handleInformeSubmit} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-club-black">{editandoInformeId ? 'Editar informe' : 'Nuevo informe'}</h3>
              <div className="space-y-4">
                {BLOQUES_INFORME_FORM.map((bloque) => (
                  <section key={bloque.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{bloque.title}</h4>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {bloque.fields.map((campo) => renderCampoInforme(campo))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={guardandoInforme}
                  className="w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-5 py-2 rounded-md transition-colors"
                >
                  {guardandoInforme ? 'Guardando...' : editandoInformeId ? 'Guardar cambios' : 'Crear informe'}
                </button>
                <button
                  type="button"
                  onClick={cancelarFormularioInforme}
                  className="w-full sm:w-auto px-5 py-2 rounded-md font-semibold text-club-black border border-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {errorInformes && (
            <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
              {errorInformes}
            </p>
          )}

          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <span className="text-2xl font-bold text-club-red tabular-nums">{informes.length}</span>
            <span className="text-sm font-medium text-club-black/70">{informes.length === 1 ? 'informe' : 'informes'}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-[1800px] w-full divide-y divide-gray-200 bg-white text-sm">
              <thead className="bg-club-black text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Acciones</th>
                  {CAMPOS_INFORME_TABLA.map((campo) => (
                    <th key={campo.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      {campo.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingInformes ? (
                  <tr>
                    <td colSpan={CAMPOS_INFORME_TABLA.length + 1} className="px-4 py-6 text-center text-club-black/60">Cargando informes...</td>
                  </tr>
                ) : informes.length === 0 ? (
                  <tr>
                    <td colSpan={CAMPOS_INFORME_TABLA.length + 1} className="px-4 py-6 text-center text-club-black/60">No se han encontrado informes.</td>
                  </tr>
                ) : (
                  informes.map((informe) => (
                    <tr key={informe.id} className="hover:bg-red-50/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => editarInforme(informe)}
                          className="text-club-red font-semibold hover:underline text-sm mr-3"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarInforme(informe)}
                          className="text-club-black/60 font-semibold hover:underline text-sm"
                        >
                          Eliminar
                        </button>
                      </td>
                      {CAMPOS_INFORME_TABLA.map((campo) => {
                        const valor = campo.key === 'partido'
                          ? formatearValorInforme(calcularPartidoInforme(informe) || informe.partido)
                          : campo.key === 'jugador'
                            ? nombreCompleto(informe?.jugador) || 'Jugador no disponible'
                            : formatearValorInforme(informe[campo.key]);

                        return (
                          <td key={campo.key} className="px-4 py-3 text-club-black/80 max-w-[220px] truncate" title={valor}>
                            {campo.key === 'jugador' ? (
                              informe?.jugador?.id ? (
                                <Link
                                  to={`/captacion/${informe.jugador.id}`}
                                  className="font-semibold text-club-black hover:text-club-red hover:underline"
                                >
                                  {valor}
                                </Link>
                              ) : (
                                valor
                              )
                            ) : (
                              valor
                            )}
                            {campo.key === 'jugador' && informe?.jugador?.club ? (
                              <span className="block text-xs text-club-black/50">{informe.jugador.club}</span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

