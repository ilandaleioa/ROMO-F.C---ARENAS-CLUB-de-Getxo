import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useLista } from '../lib/listas';
import SelectBuscador from '../components/SelectBuscador';

function normalizarFecha(valor) {
  const limpia = String(valor || '').trim();
  if (!limpia) return '';

  const iso = limpia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const es = limpia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (es) {
    const [, dia, mes, anio] = es;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return limpia;
}

function formatearFecha(valor) {
  const fecha = normalizarFecha(valor);
  if (!fecha) return '-';

  const [anio, mes, dia] = fecha.split('-');
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function formatearValor(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (typeof valor === 'boolean') return valor ? 'Si' : 'No';
  if (campo === 'fecha_alta' || campo === 'fecha_nacimiento') return formatearFecha(valor);
  if (campo === 'enlace' || campo === 'foto_jugador' || campo === 'foto_jugador_url') return String(valor);
  return String(valor);
}

function nombreCompleto(registro) {
  if (!registro) return '';
  return [registro.nombre, registro.primer_apellido].filter(Boolean).join(' ');
}

function obtenerFotoJugadorUrl(registro) {
  const firmada = String(registro?.foto_jugador_url || '').trim();
  if (firmada) return firmada;

  const valor = String(registro?.foto_jugador || '').trim();
  return /^https?:\/\//i.test(valor) || /^data:/i.test(valor) ? valor : '';
}

function calcularEdad(fechaNacimiento) {
  const fecha = normalizarFecha(fechaNacimiento);
  if (!fecha) return '-';

  const nacimiento = new Date(fecha);
  if (Number.isNaN(nacimiento.getTime())) return '-';

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplida =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());

  if (aunNoCumplida) edad -= 1;
  return `${edad}`;
}

const BLOQUES = [
  {
    title: 'Datos de alta',
    fields: ['fecha_alta', 'quien_da_alta'],
  },
  {
    title: 'Contexto deportivo',
    fields: ['club', 'equipo', 'etapa', 'categoria', 'grupo', 'enlace'],
  },
  {
    title: 'Perfil del jugador',
    fields: ['nombre', 'primer_apellido', 'nombre_completo', 'segundo_apellido', 'dorsal', 'altura', 'lateralidad', 'fecha_nacimiento', 'anio_nacimiento', 'edad', 'demarcacion', 'demarcacion_concreta', 'otra_demarcacion', 'valoracion_general'],
  },
  {
    title: 'Observaciones',
    fields: ['descripcion_jugador', 'observaciones'],
  },
];

const CAMPOS_INFORME = ['club', 'equipo', 'etapa', 'categoria', 'local', 'visitante', 'partido', 'dorsal', 'lateralidad', 'valoracion', 'titularidad', 'minutos_jugados', 'goles', 'goles_encajados', 'observador'];


const INFORME_COMPLETO_DEMARCACIONES = [
  'PORTERO',
  'LATERAL',
  'CENTRAL',
  'MEDIO',
  'EXTREMO',
  'DELANTERO',
  'MEDIA PUNTA',
];

const GRUPOS_INFORME_COMPLETO = [
  { key: 'fisico', label: 'Fisico' },
  { key: 'conBalon', label: 'Con balon' },
  { key: 'sinBalon', label: 'Sin balon' },
];

const COLOR_VALORACION_INFORME_COMPLETO = {
  1: '#d03b3b',
  2: '#ec835a',
  3: '#fab219',
  4: '#8bc34a',
  5: '#0ca30c',
};

const COLOR_NIVEL_VALORACION_INFORME = {
  BAJO: { dot: '#dc2626', texto: 'text-red-700', fondo: 'bg-red-50', borde: 'border-red-200' },
  MEDIO: { dot: '#ea580c', texto: 'text-orange-700', fondo: 'bg-orange-50', borde: 'border-orange-200' },
  ALTO: { dot: '#16a34a', texto: 'text-green-700', fondo: 'bg-green-50', borde: 'border-green-200' },
};

function normalizarClaveItemInformeCompleto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function construirItemsInformeCompleto(etiquetas) {
  const clavesUsadas = new Map();
  return etiquetas.map((label) => {
    const claveBase = normalizarClaveItemInformeCompleto(label);
    const veces = (clavesUsadas.get(claveBase) || 0) + 1;
    clavesUsadas.set(claveBase, veces);
    return { key: veces > 1 ? `${claveBase}_${veces}` : claveBase, label };
  });
}

const FISICO_ESTANDAR = ['Velocidad', 'Potencia', 'Aceleracion', 'Salto', 'Fuerza'];

const ITEMS_INFORME_COMPLETO_POR_DEMARCACION = {
  'PORTERO': {
    conBalon: construirItemsInformeCompleto([
      'Asociacion con linea defensiva',
      'Conduccion fijaciones',
      'Pases en corto',
      'Desplazamientos medios',
      'Desplazamientos largos',
      'Inicio de transicion ofensiva con pies',
      'Inicio de transicion ofensiva con manos',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Acciones debajo de los palos',
      'Salidas 1 contra 1',
      'Juego aereo frontal',
      'Juego aereo lateral',
      'Segundas jugadas',
      'Bloqueos',
      'Dominio area juego lateral',
      'Dominio distancia linea defensiva',
    ]),
    fisico: construirItemsInformeCompleto(['Velocidad', 'Potencia', 'Desplazamiento lateral', 'Salto', 'Fuerza']),
  },
  'LATERAL': {
    conBalon: construirItemsInformeCompleto([
      'Salida de balon',
      'Manejo espacio reducido',
      'Desplazamiento largo',
      'Incorporaciones',
      'Asociaciones en campo rival',
      'Desmarque ruptura',
      'Duelos 1 contra 1',
      'Centros laterales en ultimo tercio',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Acciones de duelo terrestre',
      'Acciones de duelo aereo',
      'Comportamiento dentro del area',
      'Orientaciones',
      'Defender situacion con pelota alejada',
      'Eleccion momento entrada',
      'Defensa balon espalda',
      'Dominio de la linea defensiva',
    ]),
    fisico: construirItemsInformeCompleto(FISICO_ESTANDAR),
  },
  'CENTRAL': {
    conBalon: construirItemsInformeCompleto([
      'Salida de balon (pases filtrados)',
      'Desplazamiento corto',
      'Desplazamiento largo',
      'Conducciones para progresar',
      'Incorporacion ataque',
      'Comunicacion',
      'Vigil',
      'Juego aereo ofensivo',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Defensa area',
      'Acciones de duelo terrestre',
      'Acciones de duelo aereo',
      'Anticipacion',
      'Ganar duelos en campo abierto',
      'Capacidad para girar',
      'Vigilancias',
      'Dominio de la linea defensiva',
    ]),
    fisico: construirItemsInformeCompleto(FISICO_ESTANDAR),
  },
  'MEDIO': {
    conBalon: construirItemsInformeCompleto([
      'Manejo balon',
      'Manejo tiempos',
      'Cambios de orientacion',
      'Capacidad para girar',
      'Dominio espacial - orientaciones',
      'Crear lineas de pase',
      'Primer contacto',
      'Controles orientados',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Defender juego aereo frontal/diagonal',
      'Defender situaciones en pasillo central/lateral',
      'Capacidad de ir a linea defensiva',
      'Temporizar',
      'Recuperaciones',
      'Anticipacion',
      'Repliegue',
      'Retornos',
    ]),
    fisico: construirItemsInformeCompleto(FISICO_ESTANDAR),
  },
  'EXTREMO': {
    conBalon: construirItemsInformeCompleto([
      'Desmarques de ruptura',
      'Centros laterales',
      'Asistencia',
      'Acciones de 1vs1 en movimiento',
      'Acciones de 1vs1 en parado',
      'Centros',
      'Finalizar desde fuera',
      'Ir al espalda linea defensiva',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Defender cerrando lado opuesto',
      'Capacidad recuperar en su zona',
      'Capacidad def de no ser superado',
      'Recuperaciones balon',
      'Ayudas al lateral',
      'Anticipacion',
      'Orientar la presion',
      'Tapar lineas de pase',
    ]),
    fisico: construirItemsInformeCompleto(FISICO_ESTANDAR),
  },
  'DELANTERO': {
    conBalon: construirItemsInformeCompleto([
      'Remates en area',
      'Juego de espaldas',
      'Tiro',
      'Asistencias',
      'Dar apoyo y continuidad al juego',
      'Dar profundidad (prolongacion/desvio)',
      'Remate de centro lateral',
      'Capacidad de jugar solo o con companero linea',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Presion orientada',
      'Presion tras perdida',
      'Duelo',
      'Retornos',
      'Ayudas al lateral',
      'Anticipacion',
      'Orientar la presion',
      'Tapar lineas de pase',
    ]),
    fisico: construirItemsInformeCompleto(FISICO_ESTANDAR),
  },
  'MEDIA PUNTA': {
    conBalon: construirItemsInformeCompleto([
      'Arrancadas - conducciones',
      'Ultimos y penultimos pases',
      'Remate',
      'Tiro',
      'Asistencia',
      'Movilidades dentro-fuera',
      'Romper linea defensiva',
      'Hace desmarque o se mueve reactivamente',
    ]),
    sinBalon: construirItemsInformeCompleto([
      'Presion orientada',
      'Presion tras perdida',
      'Duelo',
      'Anticipacion',
      'Retornos',
      'Duelos terrestres',
      'Duelos aereos',
      'Tapar lineas de pase',
    ]),
    fisico: construirItemsInformeCompleto(FISICO_ESTANDAR),
  },
};

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
const TITULARIDAD_OPCIONES = ['TITULAR', 'SUPLENTE', 'NO CONVOCA'];

const POSICIONES_CAMPO = {
  'Portero': { x: 50, y: 91 },
  'Lateral Dcho': { x: 82, y: 82 },
  'Lateral Izdo': { x: 18, y: 82 },
  'Central Dcho': { x: 62, y: 80 },
  'Central Izdo': { x: 38, y: 80 },
  'Pivote': { x: 50, y: 60 },
  'Media punta': { x: 50, y: 32 },
  'Interior Dcho': { x: 66, y: 46 },
  'Interior Izdo': { x: 34, y: 46 },
  'Extremo Dcho': { x: 85, y: 24 },
  'Extremo Izdo': { x: 15, y: 24 },
  'Delantero': { x: 50, y: 12 },
};

function CampoFutbolPosicion({ demarcacionConcreta }) {
  const posicion = POSICIONES_CAMPO[demarcacionConcreta];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-2">
      <svg viewBox="0 0 100 150" className="w-full" role="img" aria-label={`Posicion en el campo: ${demarcacionConcreta || 'sin asignar'}`}>
        <rect x="0" y="0" width="100" height="150" fill="#3f8a4b" />
        <rect x="2" y="2" width="96" height="146" fill="none" stroke="white" strokeWidth="0.6" />
        <line x1="2" y1="75" x2="98" y2="75" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="75" r="9" fill="none" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="75" r="0.8" fill="white" />
        <rect x="26" y="2" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="38" y="2" width="24" height="8" fill="none" stroke="white" strokeWidth="0.6" />
        <path d="M 38 20 A 9 9 0 0 0 62 20" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="26" y="130" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="38" y="140" width="24" height="8" fill="none" stroke="white" strokeWidth="0.6" />
        <path d="M 38 130 A 9 9 0 0 1 62 130" fill="none" stroke="white" strokeWidth="0.6" />
        {posicion ? (
          <g>
            <circle cx={posicion.x} cy={posicion.y} r="4.5" fill="#e2001a" stroke="white" strokeWidth="0.8" />
          </g>
        ) : null}
      </svg>
      <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wide text-club-black/60">
        {demarcacionConcreta || 'Sin demarcacion concreta'}
      </p>
    </div>
  );
}
const ETIQUETAS_INFORME = {
  club: 'Club',
  equipo: 'Equipo',
  etapa: 'Etapa',
  categoria: 'Categoria',
  local: 'Local',
  visitante: 'Visitante',
  partido: 'Partido',
  dorsal: 'Dorsal',
  lateralidad: 'Lateralidad',
  valoracion: 'Valoracion',
  titularidad: 'Titularidad',
  minutos_jugados: 'Minutos jugados',
  goles: 'Goles',
  goles_encajados: 'Goles encajados',
  tipologia: 'Tipologia',
  descripcion: 'Descripcion',
  demarcacion_concreta: 'Demarcacion concreta',
  observador: 'Observador',
};

const VALORACION_INFORME_OPCIONES = [
  { valor: 'BAJO', etiqueta: 'NIVEL BAJO' },
  { valor: 'MEDIO', etiqueta: 'NIVEL MEDIO' },
  { valor: 'ALTO', etiqueta: 'NIVEL ALTO' },
];

const ETIQUETAS = {
  fecha_alta: 'Fecha alta',
  quien_da_alta: 'Quien da alta',
  club: 'Club',
  equipo: 'Equipo',
  etapa: 'Etapa',
  categoria: 'Categoria',
  grupo: 'Grupo',
  enlace: 'Enlace federacion',
  nombre: 'Nombre',
  primer_apellido: 'Primer apellido',
  nombre_completo: 'Nombre completo',
  segundo_apellido: 'Segundo apellido',
  dorsal: 'Dorsal',
  altura: 'Altura (cm)',
  lateralidad: 'Lateralidad',
  foto_jugador: 'Foto jugador',
  fecha_nacimiento: 'Fecha nacimiento',
  anio_nacimiento: 'Anio nacimiento',
  edad: 'Edad',
  demarcacion: 'Demarcacion',
  demarcacion_concreta: 'Demarcacion concreta',
  otra_demarcacion: 'Otra demarcacion -',
  valoracion_general: 'Valoracion general',
  descripcion_jugador: 'Descripcion del jugador',
  observaciones: 'Observaciones',
};

function renderValor(registro, campo) {
  if (!registro) return '-';
  if (campo === 'edad') return calcularEdad(registro.fecha_nacimiento);
  if (campo === 'anio_nacimiento') {
    const fecha = normalizarFecha(registro.fecha_nacimiento);
    if (!fecha) return '-';
    const nacimiento = new Date(fecha);
    if (Number.isNaN(nacimiento.getTime())) return '-';
    return String(nacimiento.getFullYear());
  }
  if (campo === 'nombre_completo') return nombreCompleto(registro) || '-';

  const valor = registro[campo];
  if (campo === 'foto_jugador') {
    const fotoUrl = obtenerFotoJugadorUrl(registro);
    if (!fotoUrl) return '-';
    return fotoUrl;
  }

  return formatearValor(valor, campo);
}

function calcularPartidoInforme(informe) {
  const local = String(informe?.local || '').trim();
  const visitante = String(informe?.visitante || '').trim();
  if (local && visitante) return `${local} Vs ${visitante}`;
  return '';
}

function extraerEquiposDesdePartido(partido) {
  const texto = String(partido || '').trim();
  if (!texto) return { local: '', visitante: '' };

  const porVs = texto.match(/^(.*?)\s+vs\s+(.*?)$/i);
  if (porVs) {
    return {
      local: String(porVs[1] || '').trim(),
      visitante: String(porVs[2] || '').trim(),
    };
  }

  const porGuion = texto.match(/^(.*?)\s*-\s*(.*?)$/);
  if (porGuion) {
    return {
      local: String(porGuion[1] || '').trim(),
      visitante: String(porGuion[2] || '').trim(),
    };
  }

  return { local: '', visitante: '' };
}

function obtenerValorInforme(informe, campo) {
  const valor = String(informe?.[campo] || '').trim();
  if (valor) return valor;

  const { local, visitante } = extraerEquiposDesdePartido(informe?.partido);
  if (campo === 'local') return local || '-';
  if (campo === 'visitante') return visitante || '-';
  return '-';
}

function formatearValorInforme(valor) {
  const texto = String(valor ?? '').trim();
  return texto || '-';
}

function formatearFechaHora(valor) {
  if (!valor) return '-';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return formatearFecha(valor);
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()} ${String(
    fecha.getHours()
  ).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

export default function CaptacionDetalle() {
  const { id } = useParams();
  const [registro, setRegistro] = useState(null);
  const [informes, setInformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInformes, setLoadingInformes] = useState(true);
  const [error, setError] = useState('');
  const [errorInformes, setErrorInformes] = useState('');
  const [editandoInformeId, setEditandoInformeId] = useState(null);
  const [informeEditando, setInformeEditando] = useState(null);
  const [guardandoInforme, setGuardandoInforme] = useState(false);
  const [errorGuardarInforme, setErrorGuardarInforme] = useState('');

  const listaClubes = useLista('clubes');
  const listaEquipos = useLista('equipos');
  const listaEtapas = useLista('etapas');
  const listaCategorias = useLista('categorias');

  const opcionesClub = useMemo(
    () => (listaClubes?.filas || []).map(fila => fila.nombre || fila.valor).filter(Boolean),
    [listaClubes]
  );

  const opcionesEquipo = useMemo(() => {
    const clubSeleccionado = informeEditando?.club;
    if (!clubSeleccionado) return [];
    return (listaEquipos?.filas || [])
      .filter(fila => String(fila?.club || '').trim() === String(clubSeleccionado || '').trim())
      .map(fila => fila.nombre)
      .filter(Boolean);
  }, [listaEquipos, informeEditando?.club]);

  const opcionesEtapa = useMemo(
    () => (listaEtapas?.filas || []).map(fila => fila.nombre).filter(Boolean),
    [listaEtapas]
  );

  const opcionesCategoria = useMemo(
    () => (listaCategorias?.filas || []).map(fila => fila.nombre).filter(Boolean),
    [listaCategorias]
  );

  const fotoUrl = useMemo(() => obtenerFotoJugadorUrl(registro), [registro]);
  const nombre = useMemo(() => nombreCompleto(registro) || 'Detalle de captacion', [registro]);

  const abrirEdicionInforme = (informe) => {
    setEditandoInformeId(informe.id);
    setInformeEditando({ ...informe });
    setErrorGuardarInforme('');
  };

  const cancelarEdicionInforme = () => {
    setEditandoInformeId(null);
    setInformeEditando(null);
    setErrorGuardarInforme('');
  };

  const actualizarCampoInforme = (campo, valor) => {
    setInformeEditando((prev) => (prev ? { ...prev, [campo]: valor } : null));
  };

  const guardarInformeEditado = async () => {
    if (!informeEditando || !editandoInformeId) return;

    setGuardandoInforme(true);
    setErrorGuardarInforme('');
    try {
      const payload = {
        fecha: informeEditando.fecha || '',
        observador: informeEditando.observador || '',
        club: informeEditando.club || '',
        equipo: informeEditando.equipo || '',
        etapa: informeEditando.etapa || '',
        categoria: informeEditando.categoria || '',
        local: informeEditando.local || '',
        visitante: informeEditando.visitante || '',
        partido: informeEditando.partido || '',
        dorsal: informeEditando.dorsal || '',
        tipologia: informeEditando.tipologia || '',
        lateralidad: informeEditando.lateralidad || '',
        descripcion: informeEditando.descripcion || '',
        valoracion: informeEditando.valoracion || '',
        demarcacion_concreta: informeEditando.demarcacion_concreta || '',
        titularidad: informeEditando.titularidad || '',
        minutos_jugados: informeEditando.minutos_jugados || '',
        goles: informeEditando.goles || '',
        goles_encajados: informeEditando.goles_encajados || '',
        jugador_id: informeEditando.jugador_id || '',
      };

      const respuesta = await api.put(`/captacion/informes/${editandoInformeId}`, payload);

      setInformes((prev) =>
        prev.map((inf) => (inf.id === editandoInformeId ? respuesta.informe : inf))
      );

      setEditandoInformeId(null);
      setInformeEditando(null);
    } catch (err) {
      setErrorGuardarInforme(err.message);
    } finally {
      setGuardandoInforme(false);
    }
  };

  useEffect(() => {
    let cancelado = false;

    async function cargarDetalle() {
      setLoading(true);
      setError('');

      try {
        const detalle = await api.get(`/captacion/${id}`);

        if (cancelado) return;

        setRegistro(detalle?.registro || null);
      } catch (err) {
        if (!cancelado) {
          setRegistro(null);
          setError(err.message);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    }

    async function cargarInformes() {
      setLoadingInformes(true);
      setErrorInformes('');

      try {
        const respuestaInformes = await api.get('/captacion/informes');
        if (cancelado) return;

        const todosLosInformes = Array.isArray(respuestaInformes?.informes) ? respuestaInformes.informes : [];
        setInformes(todosLosInformes.filter((informe) => String(informe?.jugador_id || '') === String(id || '')));
      } catch (err) {
        if (!cancelado) {
          setInformes([]);
          setErrorInformes(err.message);
        }
      } finally {
        if (!cancelado) {
          setLoadingInformes(false);
        }
      }
    }

    cargarDetalle();
    cargarInformes();
    return () => {
      cancelado = true;
    };
  }, [id]);

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/captacion"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50"
          >
            Volver al listado
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50">Seguimiento</p>
            <h2 className="text-2xl font-bold text-club-black">Detalle de jugador de captacion</h2>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-club-black/60">
          Cargando detalle...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-club-red/20 bg-red-50 px-4 py-6 text-club-red">
          <p className="font-semibold">No se pudo cargar el registro.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : registro ? (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-3 text-white">
              <h3 className="text-2xl font-bold">{nombre}</h3>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[240px_1fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt={nombre} className="h-72 w-full object-cover" />
                  ) : (
                    <div className="flex h-72 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center text-sm font-semibold text-club-black/40">
                      Sin foto disponible
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Edad</p>
                    <p className="mt-1 text-xl font-bold text-club-black">{renderValor(registro, 'edad')}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Dorsal</p>
                    <p className="mt-1 text-xl font-bold text-club-black">{renderValor(registro, 'dorsal')}</p>
                  </div>
                </div>

                <CampoFutbolPosicion demarcacionConcreta={registro.demarcacion_concreta} />
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {['club', 'equipo', 'etapa', 'categoria', 'grupo', 'demarcacion', 'lateralidad'].map((campo) => {
                    const valor = renderValor(registro, campo);
                    if (!valor || valor === '-') return null;
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

                <div className="grid gap-4 lg:grid-cols-2">
                  {BLOQUES.map((bloque) => (
                    <section
                      key={bloque.title}
                      className={`rounded-2xl border border-gray-200 bg-gray-50 p-4 ${
                        bloque.title === 'Perfil del jugador' || bloque.title === 'Observaciones' ? 'lg:col-span-2' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{bloque.title}</h4>
                        {bloque.title === 'Perfil del jugador' && fotoUrl ? (
                          <a href={fotoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-club-red hover:underline">
                            Abrir foto
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {bloque.fields.map((campo) => {
                          const valor = renderValor(registro, campo);
                          const isLongText = campo === 'descripcion_jugador' || campo === 'observaciones';
                          return (
                            <div
                              key={campo}
                              className={`rounded-xl border border-gray-200 bg-white p-4 ${
                                isLongText ? 'sm:col-span-2 xl:col-span-3' : ''
                              }`}
                            >
                              <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">
                                {ETIQUETAS[campo]}
                              </p>
                              <div
                                className={`mt-2 text-sm text-club-black/80 ${
                                  isLongText ? 'whitespace-pre-line leading-6' : 'break-words'
                                }`}
                              >
                                {campo === 'enlace' && valor !== '-' ? (
                                  <a
                                    href={valor}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-club-red hover:underline"
                                  >
                                    Abrir enlace
                                  </a>
                                ) : campo === 'foto_jugador' && fotoUrl ? (
                                  <a
                                    href={fotoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-club-red hover:underline"
                                  >
                                    Abrir foto
                                  </a>
                                ) : (
                                  valor
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {(() => {
                    const valoracionItems = registro.valoracion_items || {};
                    const demarcacionInformeCompleto = valoracionItems.demarcacion || '';
                    const gruposDemarcacion = ITEMS_INFORME_COMPLETO_POR_DEMARCACION[demarcacionInformeCompleto];

                    return (
                      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 lg:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">Informe completo (Del 1 al 5)</h4>
                          {demarcacionInformeCompleto ? (
                            <span className="inline-flex items-center rounded-full border border-club-red/20 bg-club-red/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-club-red">
                              {demarcacionInformeCompleto}
                            </span>
                          ) : null}
                        </div>
                        {!gruposDemarcacion ? (
                          <p className="mt-3 text-sm text-club-black/55">
                            El jugador todavia no tiene una demarcacion de informe completo asignada.
                          </p>
                        ) : (
                          GRUPOS_INFORME_COMPLETO.map((grupo) => {
                            const items = gruposDemarcacion[grupo.key] || [];
                            if (!items.length) return null;

                            return (
                              <div key={grupo.key} className="mt-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">{grupo.label}</p>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                  {items.map((item) => {
                                    const valor = valoracionItems[grupo.key]?.[item.key];
                                    const color = COLOR_VALORACION_INFORME_COMPLETO[valor];
                                    return (
                                      <div key={item.key} className="rounded-xl border border-gray-200 bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{item.label}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                          {valor ? (
                                            <span
                                              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                              style={{ backgroundColor: color }}
                                            >
                                              {valor}
                                            </span>
                                          ) : (
                                            <span className="text-sm font-medium text-club-black">-</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </section>
                    );
                  })()}
                </div>
              </div>
            </div>
          </section>

          <section id="informes-vinculados" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50">Actividad relacionada</p>
                <h3 className="text-xl font-bold text-club-black">INFORMES</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-lg font-bold text-club-red tabular-nums">{informes.length}</span>
                <span className="text-sm text-club-black/70">{informes.length === 1 ? 'informe' : 'informes'}</span>
              </div>
            </div>

            {editandoInformeId && informeEditando ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h4 className="text-sm font-bold text-club-black">Editando informe del {formatearFecha(informeEditando.fecha)}</h4>
                  {errorGuardarInforme ? (
                    <p className="text-xs text-club-red font-semibold">{errorGuardarInforme}</p>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Datos básicos</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Fecha</label>
                        <input
                          type="date"
                          value={informeEditando.fecha || ''}
                          onChange={(e) => actualizarCampoInforme('fecha', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Observador</label>
                        <input
                          type="text"
                          value={informeEditando.observador || ''}
                          onChange={(e) => actualizarCampoInforme('observador', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <SelectBuscador
                        label="Club"
                        value={informeEditando.club || ''}
                        options={opcionesClub}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('club', valor)}
                      />
                      <SelectBuscador
                        label="Equipo"
                        value={informeEditando.equipo || ''}
                        options={opcionesEquipo}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('equipo', valor)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Partido</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <SelectBuscador
                        label="Etapa"
                        value={informeEditando.etapa || ''}
                        options={opcionesEtapa}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('etapa', valor)}
                      />
                      <SelectBuscador
                        label="Categoría"
                        value={informeEditando.categoria || ''}
                        options={opcionesCategoria}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('categoria', valor)}
                      />
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Local</label>
                        <input
                          type="text"
                          value={informeEditando.local || ''}
                          onChange={(e) => actualizarCampoInforme('local', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Visitante</label>
                        <input
                          type="text"
                          value={informeEditando.visitante || ''}
                          onChange={(e) => actualizarCampoInforme('visitante', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Partido</label>
                        <input
                          type="text"
                          value={informeEditando.partido || ''}
                          onChange={(e) => actualizarCampoInforme('partido', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Informe</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Dorsal</label>
                        <input
                          type="text"
                          value={informeEditando.dorsal || ''}
                          onChange={(e) => actualizarCampoInforme('dorsal', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Tipología</label>
                        <input
                          type="text"
                          value={informeEditando.tipologia || ''}
                          onChange={(e) => actualizarCampoInforme('tipologia', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <SelectBuscador
                        label="Lateralidad"
                        value={informeEditando.lateralidad || ''}
                        options={['Diestro', 'Zurdo', 'Ambas']}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('lateralidad', valor)}
                      />
                      <SelectBuscador
                        label="Demarcación concreta"
                        value={informeEditando.demarcacion_concreta || ''}
                        options={DEMARCACION_CONCRETA_OPCIONES}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('demarcacion_concreta', valor)}
                      />
                      <SelectBuscador
                        label="Titularidad"
                        value={informeEditando.titularidad || ''}
                        options={TITULARIDAD_OPCIONES}
                        emptyLabel="Seleccionar..."
                        onChange={(valor) => actualizarCampoInforme('titularidad', valor)}
                      />
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Minutos jugados</label>
                        <input
                          type="text"
                          value={informeEditando.minutos_jugados || ''}
                          onChange={(e) => actualizarCampoInforme('minutos_jugados', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Goles</label>
                        <input
                          type="text"
                          value={informeEditando.goles || ''}
                          onChange={(e) => actualizarCampoInforme('goles', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Goles encajados</label>
                        <input
                          type="text"
                          value={informeEditando.goles_encajados || ''}
                          onChange={(e) => actualizarCampoInforme('goles_encajados', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Descripción</label>
                    <textarea
                      value={informeEditando.descripcion || ''}
                      onChange={(e) => actualizarCampoInforme('descripcion', e.target.value)}
                      rows="3"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Valoracion</p>
                  {(() => {
                    const coloresValoracion = {
                      BAJO: 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500',
                      MEDIO: 'border-orange-300 bg-orange-50 text-orange-700 focus:ring-orange-500',
                      ALTO: 'border-green-300 bg-green-50 text-green-700 focus:ring-green-500',
                    };
                    const claseColor = coloresValoracion[informeEditando.valoracion || ''] || '';
                    return (
                      <select
                        value={informeEditando.valoracion || ''}
                        onChange={(e) => actualizarCampoInforme('valoracion', e.target.value)}
                        className={`w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 ${claseColor}`}
                      >
                        <option value="">Seleccionar...</option>
                        {VALORACION_INFORME_OPCIONES.map((opcion) => (
                          <option key={opcion.valor} value={opcion.valor}>
                            {opcion.etiqueta}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={guardarInformeEditado}
                    disabled={guardandoInforme}
                    className="rounded-md bg-club-red px-4 py-2 text-sm font-semibold text-white hover:bg-club-red/90 disabled:opacity-60"
                  >
                    {guardandoInforme ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarEdicionInforme}
                    disabled={guardandoInforme}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              {loadingInformes ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-club-black/60">
                  Cargando informes...
                </div>
              ) : errorInformes ? (
                <div className="rounded-lg border border-club-red/20 bg-red-50 px-4 py-4 text-sm text-club-red">
                  {errorInformes}
                </div>
              ) : informes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-club-black/55">
                  No hay informes asociados a este registro.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {informes.map((informe) => (
                    <article key={informe.id} className={`rounded-xl border bg-gray-50 p-4 ${editandoInformeId === informe.id ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-club-black">{formatearFecha(informe.fecha)}</p>
                          <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{informe.observador || 'Sin observador'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirEdicionInforme(informe)}
                          disabled={editandoInformeId !== null}
                          className="rounded-md border border-club-red/20 bg-club-red/5 px-3 py-1.5 text-xs font-semibold text-club-red hover:bg-club-red/10 disabled:opacity-50"
                        >
                          Editar
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {CAMPOS_INFORME.map((campo) => {
                          const valor = campo === 'partido'
                            ? formatearValorInforme(calcularPartidoInforme(informe) || informe.partido)
                            : formatearValorInforme(obtenerValorInforme(informe, campo));

                          if (campo === 'valoracion') {
                            const colorNivel = COLOR_NIVEL_VALORACION_INFORME[informe.valoracion || ''];
                            return (
                              <div
                                key={campo}
                                className={`rounded-lg border p-3 ${colorNivel ? `${colorNivel.borde} ${colorNivel.fondo}` : 'border-gray-200 bg-white'}`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                  {ETIQUETAS_INFORME[campo]}
                                </p>
                                <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${colorNivel ? colorNivel.texto : 'text-club-black'}`}>
                                  {colorNivel && (
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: colorNivel.dot }}
                                    />
                                  )}
                                  {valor === '-' ? valor : `NIVEL ${valor}`}
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div key={campo} className="rounded-lg border border-gray-200 bg-white p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                {ETIQUETAS_INFORME[campo]}
                              </p>
                              <p className="mt-1 text-sm font-medium text-club-black">{valor}</p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-club-black/55">Creado: {formatearFechaHora(informe.created_at)}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-club-black/60">
          El registro solicitado no existe.
        </div>
      )}
    </div>
  );
}
