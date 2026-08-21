import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

const CAMPOS_INFORME = ['club', 'equipo', 'etapa', 'categoria', 'local', 'visitante', 'partido', 'dorsal', 'lateralidad', 'valoracion', 'titularidad', 'minutos_jugados', 'goles', 'goles_encajados', 'observador', 'descripcion'];

const CAMPOS_INFORME_OCULTOS_VISTA_JUGADOR = ['club', 'equipo', 'etapa', 'categoria', 'local', 'visitante'];
const CAMPOS_INFORME_VISTA_JUGADOR = CAMPOS_INFORME.filter((campo) => !CAMPOS_INFORME_OCULTOS_VISTA_JUGADOR.includes(campo));

const CAMPOS_INFORME_FILA_COMPLETA = ['partido', 'descripcion'];

const OBSERVADORES_STORAGE_KEY = 'captacion.observadores';
const OBSERVADOR_NUEVO_VALOR = '__nueva_opcion_observador__';

function normalizarComparacionTexto(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es');
}

function normalizarListadoObservadores(valores = []) {
  const vistos = new Set();
  const resultado = [];

  (Array.isArray(valores) ? valores : []).forEach((valor) => {
    const limpio = String(valor || '').trim();
    if (!limpio) return;

    const clave = normalizarComparacionTexto(limpio);
    if (vistos.has(clave)) return;

    vistos.add(clave);
    resultado.push(limpio);
  });

  return resultado.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function leerObservadoresGuardados() {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  try {
    const guardados = JSON.parse(window.localStorage.getItem(OBSERVADORES_STORAGE_KEY) || '[]');
    return normalizarListadoObservadores(Array.isArray(guardados) ? guardados : []);
  } catch (_) {
    return [];
  }
}

function guardarObservadoresEnStorage(valores) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(OBSERVADORES_STORAGE_KEY, JSON.stringify(normalizarListadoObservadores(valores)));
  } catch (_) {
    // Si el almacenamiento local falla, mantenemos el estado en memoria.
  }
}

function obtenerOpcionesClubEquipo(listaEquipos, valoresActuales = []) {
  const opciones = [];
  const vistos = new Set();

  (listaEquipos?.filas || []).forEach((fila) => {
    const club = String(fila?.club || '').trim();
    const equipo = String(fila?.nombre || '').trim();
    if (!club || !equipo) return;

    const etiqueta = `${club} - ${equipo}`;
    const clave = normalizarComparacionTexto(etiqueta);
    if (vistos.has(clave)) return;

    vistos.add(clave);
    opciones.push(etiqueta);
  });

  (Array.isArray(valoresActuales) ? valoresActuales : [valoresActuales]).forEach((valor) => {
    const limpio = String(valor || '').trim();
    if (!limpio) return;

    const clave = normalizarComparacionTexto(limpio);
    if (vistos.has(clave)) return;

    vistos.add(clave);
    opciones.push(limpio);
  });

  return opciones.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

const NIVEL_TEXTO_A_VALOR_INFORME = { BAJO: '2', MEDIO: '3', ALTO: '4' };

function obtenerInfoValoracionInforme(valoracion) {
  const bruto = String(valoracion || '').trim();
  if (!bruto) return null;
  const valorNormalizado = NIVEL_TEXTO_A_VALOR_INFORME[bruto.toUpperCase()] || bruto;
  const opcion = VALORACION_INFORME_OPCIONES.find((item) => item.valor === valorNormalizado);
  if (!opcion) return null;
  return { etiqueta: opcion.valor, color: COLOR_VALORACION_INFORME[opcion.valor] };
}


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
  'Portero': { x: 50, y: 140 },
  'Lateral Dcho': { x: 82, y: 108 },
  'Lateral Izdo': { x: 18, y: 108 },
  'Central Dcho': { x: 62, y: 115 },
  'Central Izdo': { x: 38, y: 115 },
  'Pivote': { x: 50, y: 72 },
  'Media punta': { x: 50, y: 32 },
  'Interior Dcho': { x: 66, y: 50 },
  'Interior Izdo': { x: 34, y: 50 },
  'Extremo Dcho': { x: 85, y: 24 },
  'Extremo Izdo': { x: 15, y: 24 },
  'Delantero': { x: 50, y: 12 },
};

function CampoFutbolPosicion({ demarcacionConcreta, otraDemarcacion }) {
  const posicion = POSICIONES_CAMPO[demarcacionConcreta];
  const posicionOtra = POSICIONES_CAMPO[otraDemarcacion];

  const obtenerPosicionEspejo = (demarcacion) => {
    if (!demarcacion) return null;
    const mapeoEspejo = {
      'Lateral Dcho': 'Lateral Izdo',
      'Lateral Izdo': 'Lateral Dcho',
      'Central Dcho': 'Central Izdo',
      'Central Izdo': 'Central Dcho',
      'Interior Dcho': 'Interior Izdo',
      'Interior Izdo': 'Interior Dcho',
      'Extremo Dcho': 'Extremo Izdo',
      'Extremo Izdo': 'Extremo Dcho',
    };
    const espejo = mapeoEspejo[demarcacion];
    return espejo ? POSICIONES_CAMPO[espejo] : null;
  };

  const posicionEspejo = !otraDemarcacion ? obtenerPosicionEspejo(demarcacionConcreta) : null;

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
        {otraDemarcacion && posicionOtra ? (
          <circle cx={posicionOtra.x} cy={posicionOtra.y} r="4.5" fill="none" stroke="#9ca3af" strokeWidth="0.8" />
        ) : posicionEspejo ? (
          <circle cx={posicionEspejo.x} cy={posicionEspejo.y} r="4.5" fill="#e2001a" fillOpacity="0.25" stroke="#e2001a" strokeOpacity="0.5" strokeWidth="0.8" />
        ) : null}
        {posicion ? (
          <g>
            <circle cx={posicion.x} cy={posicion.y} r="4.5" fill="#e2001a" stroke="white" strokeWidth="0.8" />
          </g>
        ) : null}
      </svg>
      <div className="mt-2 space-y-1">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-club-black/60">
          {demarcacionConcreta || 'Sin demarcacion concreta'}
        </p>
        {otraDemarcacion && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-club-red" />
              <span className="font-semibold text-club-black/70">{demarcacionConcreta}</span>
            </span>
            <span className="text-club-black/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-gray-400 bg-transparent" />
              <span className="font-semibold text-club-black/70">{otraDemarcacion}</span>
            </span>
          </div>
        )}
      </div>
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
  demarcacion_concreta: 'Posicion',
  observador: 'Observador',
};

const VALORACION_INFORME_OPCIONES = [
  { valor: '1', etiqueta: '1 - Muy Bajo' },
  { valor: '2', etiqueta: '2 - Bajo' },
  { valor: '3', etiqueta: '3 - Medio' },
  { valor: '4', etiqueta: '4 - Alto' },
  { valor: '5', etiqueta: '5 - Muy Alto' },
];

const COLOR_VALORACION_INFORME = {
  '1': '#d03b3b',
  '2': '#ec835a',
  '3': '#fab219',
  '4': '#8bc34a',
  '5': '#0ca30c',
};

const ETIQUETAS = {
  fecha_alta: 'Fecha de alta',
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
  demarcacion_concreta: 'Posicion',
  otra_demarcacion: 'Otra posicion',
  informe_realizado_por: 'Informe realizado por',
  valoracion_responsable: 'Valoracion responsable',
  valoracion_general: 'Valoracion general',
  descripcion_jugador: 'Descripcion del jugador',
  observaciones: 'Observaciones',
  tutor_nombre: 'Nombre del tutor',
  tutor_telefono: 'Telefono del tutor',
  telefono_jugador: 'Telefono del jugador',
};

const OPCIONES_VALORACION_DIRECCION = [
  { value: 'DESCARTAR', clase: 'border-red-600 bg-red-600 text-white' },
  { value: 'SEGUIR', clase: 'border-amber-500 bg-amber-500 text-white' },
  { value: 'POTENCIAL', clase: 'border-green-600 bg-green-600 text-white' },
];

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

function InformeCompletoBody({ registro }) {
  const valoracionItems = registro.valoracion_items || {};
  const demarcacionInformeCompleto = valoracionItems.demarcacion || '';
  const gruposDemarcacion = ITEMS_INFORME_COMPLETO_POR_DEMARCACION[demarcacionInformeCompleto];
  const direccionInformeCompleto = valoracionItems.direccion || '';
  const opcionDireccion = OPCIONES_VALORACION_DIRECCION.find((opcion) => opcion.value === direccionInformeCompleto);

  return (
    <>
      <div className="mb-3 flex flex-col items-center gap-2">
        <h4 className="text-xl font-bold uppercase tracking-wider text-club-red">Informe responsable</h4>
        {opcionDireccion ? (
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-md ${opcionDireccion.clase}`}>
            {opcionDireccion.value}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-gray-200 bg-white p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-club-black/60 text-center">
            {ETIQUETAS.informe_realizado_por}
          </p>
          <div className="mt-1 text-sm font-bold text-club-red break-words text-center leading-tight">
            {renderValor(registro, 'informe_realizado_por')}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-2.5 flex items-center justify-between gap-2">
          <p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-club-black/60">
            {ETIQUETAS.valoracion_responsable}
          </p>
          {registro.valoracion_general ? (
            <span
              className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: COLOR_VALORACION_INFORME_COMPLETO[registro.valoracion_general] }}
            >
              {registro.valoracion_general}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-club-black flex-shrink-0">-</span>
          )}
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-club-black/60">
            {ETIQUETAS.descripcion_jugador}
          </p>
          <div className="mt-1 whitespace-pre-line leading-5 text-[11px] text-club-black/80 line-clamp-none">
            {renderValor(registro, 'descripcion_jugador')}
          </div>
        </div>
      </div>
      {!gruposDemarcacion ? (
        <p className="mt-2 text-xs text-club-black/55">
          El jugador todavia no tiene una demarcacion de informe completo asignada.
        </p>
      ) : (
        GRUPOS_INFORME_COMPLETO.map((grupo) => {
          const items = gruposDemarcacion[grupo.key] || [];
          if (!items.length) return null;

          return (
            <div key={grupo.key} className="mt-3">
              {grupo.key === 'conBalon' && demarcacionInformeCompleto ? (
                <div className="mb-2 flex justify-center">
                  <span className="inline-flex items-center rounded-full border border-club-red bg-club-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    {demarcacionInformeCompleto}
                  </span>
                </div>
              ) : null}
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-club-red">{grupo.label}</p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => {
                  const valor = valoracionItems[grupo.key]?.[item.key];
                  const color = COLOR_VALORACION_INFORME_COMPLETO[valor];
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5"
                    >
                      <p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-club-black/60 leading-snug line-clamp-none">{item.label}</p>
                      {valor ? (
                        <span
                          className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {valor}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-club-black flex-shrink-0">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </>
  );
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

function obtenerFechaHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
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
  const [mostrarModalInformes, setMostrarModalInformes] = useState(false);
  const [errorGuardarInforme, setErrorGuardarInforme] = useState('');
  const [mostrarModalNuevoInforme, setMostrarModalNuevoInforme] = useState(false);
  const [nuevoInforme, setNuevoInforme] = useState(null);
  const [guardandoNuevoInforme, setGuardandoNuevoInforme] = useState(false);
  const [errorNuevoInforme, setErrorNuevoInforme] = useState('');
  const [observadores, setObservadores] = useState(() => leerObservadoresGuardados());
  const [bloquesOcultos, setBloquesOcultos] = useState({});
  const [mostrarModalValoracionResponsable, setMostrarModalValoracionResponsable] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const fichaRef = useRef(null);
  const informesRef = useRef(null);

  const alternarBloque = (titulo) => {
    setBloquesOcultos((prev) => ({ ...prev, [titulo]: !prev[titulo] }));
  };

  const listaClubes = useLista('clubes');
  const listaEquipos = useLista('equipos');
  const listaEtapas = useLista('etapas');
  const listaCategorias = useLista('categorias');

  const opcionesClub = useMemo(
    () => (listaClubes?.filas || []).map(fila => fila.nombre || fila.valor).filter(Boolean),
    [listaClubes]
  );

  const escudoClub = useMemo(() => {
    const clubRegistro = String(registro?.club || '').trim();
    if (!clubRegistro) return '';
    const fila = (listaClubes?.filas || []).find(
      (item) => String(item?.nombre || item?.valor || '').trim() === clubRegistro
    );
    return fila?.escudo || '';
  }, [listaClubes, registro]);

  const opcionesEquipo = useMemo(() => {
    const clubSeleccionado = informeEditando?.club;
    if (!clubSeleccionado) return [];
    return (listaEquipos?.filas || [])
      .filter(fila => String(fila?.club || '').trim() === String(clubSeleccionado || '').trim())
      .map(fila => fila.nombre)
      .filter(Boolean);
  }, [listaEquipos, informeEditando?.club]);

  const opcionesEquipoNuevoInforme = useMemo(() => {
    const clubSeleccionado = nuevoInforme?.club;
    if (!clubSeleccionado) return [];
    return (listaEquipos?.filas || [])
      .filter(fila => String(fila?.club || '').trim() === String(clubSeleccionado || '').trim())
      .map(fila => fila.nombre)
      .filter(Boolean);
  }, [listaEquipos, nuevoInforme?.club]);

  const opcionesEtapa = useMemo(
    () => (listaEtapas?.filas || []).map(fila => fila.nombre).filter(Boolean),
    [listaEtapas]
  );

  const opcionesCategoria = useMemo(
    () => (listaCategorias?.filas || []).map(fila => fila.nombre).filter(Boolean),
    [listaCategorias]
  );

  const opcionesClubEquipoInformeEditando = useMemo(
    () => obtenerOpcionesClubEquipo(listaEquipos, [informeEditando?.local, informeEditando?.visitante]),
    [listaEquipos, informeEditando?.local, informeEditando?.visitante]
  );

  const opcionesClubEquipoNuevoInforme = useMemo(
    () => obtenerOpcionesClubEquipo(listaEquipos, [nuevoInforme?.local, nuevoInforme?.visitante]),
    [listaEquipos, nuevoInforme?.local, nuevoInforme?.visitante]
  );

  useEffect(() => {
    guardarObservadoresEnStorage(observadores);
  }, [observadores]);

  useEffect(() => {
    const observadoresDesdeInformes = informes.map((informe) => informe?.observador).filter(Boolean);
    if (observadoresDesdeInformes.length === 0) return;

    setObservadores((prev) => normalizarListadoObservadores([...prev, ...observadoresDesdeInformes]));
  }, [informes]);

  const fotoUrl = useMemo(() => obtenerFotoJugadorUrl(registro), [registro]);
  const nombre = useMemo(() => nombreCompleto(registro) || 'Detalle de captacion', [registro]);

  const numeroInformes = informes.length;
  const mediaValoracion = useMemo(() => {
    const valores = informes
      .map((informe) => Number.parseFloat(informe?.valoracion))
      .filter((valor) => !Number.isNaN(valor));
    if (!valores.length) return '-';
    const media = valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
    return media.toFixed(1);
  }, [informes]);

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

  const asegurarObservador = (valor) => {
    const observador = String(valor || '').trim();
    if (!observador) return;

    setObservadores((prev) =>
      prev.some((opcion) => normalizarComparacionTexto(opcion) === normalizarComparacionTexto(observador))
        ? prev
        : normalizarListadoObservadores([...prev, observador])
    );
  };

  const manejarCambioObservadorInforme = (valor) => {
    if (valor === OBSERVADOR_NUEVO_VALOR) {
      const nuevoObservador = window.prompt('Nombre del observador');
      const limpio = String(nuevoObservador || '').trim();
      if (!limpio) return;

      asegurarObservador(limpio);
      actualizarCampoInforme('observador', limpio);
      return;
    }

    actualizarCampoInforme('observador', valor);
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

  const abrirModalNuevoInforme = () => {
    setNuevoInforme({
      fecha: obtenerFechaHoyISO(),
      observador: '',
      club: registro?.club || '',
      equipo: registro?.equipo || '',
      etapa: registro?.etapa || '',
      categoria: registro?.categoria || '',
      local: '',
      visitante: '',
      partido: '',
      dorsal: registro?.dorsal || '',
      tipologia: '',
      lateralidad: registro?.lateralidad || '',
      descripcion: '',
      valoracion: '',
      demarcacion_concreta: registro?.demarcacion_concreta || '',
      titularidad: '',
      minutos_jugados: '',
      goles: '',
      goles_encajados: '',
      jugador_id: id,
    });
    setErrorNuevoInforme('');
    setMostrarModalNuevoInforme(true);
  };

  const cerrarModalNuevoInforme = () => {
    setMostrarModalNuevoInforme(false);
    setNuevoInforme(null);
    setErrorNuevoInforme('');
  };

  const actualizarCampoNuevoInforme = (campo, valor) => {
    setNuevoInforme((prev) => (prev ? { ...prev, [campo]: valor } : null));
  };

  const manejarCambioObservadorNuevoInforme = (valor) => {
    if (valor === OBSERVADOR_NUEVO_VALOR) {
      const nuevoObservador = window.prompt('Nombre del observador');
      const limpio = String(nuevoObservador || '').trim();
      if (!limpio) return;

      asegurarObservador(limpio);
      actualizarCampoNuevoInforme('observador', limpio);
      return;
    }

    actualizarCampoNuevoInforme('observador', valor);
  };

  const guardarNuevoInforme = async () => {
    if (!nuevoInforme) return;

    setGuardandoNuevoInforme(true);
    setErrorNuevoInforme('');
    try {
      const payload = {
        fecha: nuevoInforme.fecha || '',
        observador: nuevoInforme.observador || '',
        club: nuevoInforme.club || '',
        equipo: nuevoInforme.equipo || '',
        etapa: nuevoInforme.etapa || '',
        categoria: nuevoInforme.categoria || '',
        local: nuevoInforme.local || '',
        visitante: nuevoInforme.visitante || '',
        partido: nuevoInforme.partido || '',
        dorsal: nuevoInforme.dorsal || '',
        tipologia: nuevoInforme.tipologia || '',
        lateralidad: nuevoInforme.lateralidad || '',
        descripcion: nuevoInforme.descripcion || '',
        valoracion: nuevoInforme.valoracion || '',
        demarcacion_concreta: nuevoInforme.demarcacion_concreta || '',
        titularidad: nuevoInforme.titularidad || '',
        minutos_jugados: nuevoInforme.minutos_jugados || '',
        goles: nuevoInforme.goles || '',
        goles_encajados: nuevoInforme.goles_encajados || '',
        jugador_id: id,
      };

      const respuesta = await api.post('/captacion/informes', payload);

      setInformes((prev) => [respuesta.informe, ...prev]);
      cerrarModalNuevoInforme();
    } catch (err) {
      setErrorNuevoInforme(err.message);
    } finally {
      setGuardandoNuevoInforme(false);
    }
  };

  async function cargarImagenComoDataUrl(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return null;
    }
  }

  async function prepararClonParaPdf(nodoOriginal) {
    const ancho = Math.max(nodoOriginal.scrollWidth, Math.ceil(nodoOriginal.getBoundingClientRect().width));
    const contenedor = document.createElement('div');
    const copia = nodoOriginal.cloneNode(true);

    contenedor.className = 'pdf-export-clone';
    contenedor.style.cssText = `position: fixed; left: -100000px; top: 0; width: ${ancho}px; padding: 0; background: #ffffff; z-index: -1;`;
    copia.style.width = `${ancho}px`;
    copia.style.minWidth = `${ancho}px`;
    copia.style.maxWidth = 'none';
    copia.style.height = 'auto';
    copia.style.overflow = 'visible';

    // Sustituye las imagenes externas por su version en base64 para que html2canvas pueda leerlas sin problemas de CORS.
    const imagenesOriginales = nodoOriginal.querySelectorAll('img');
    const imagenesCopia = copia.querySelectorAll('img');
    await Promise.all(
      Array.from(imagenesOriginales).map(async (imgOriginal, indice) => {
        const src = imgOriginal.getAttribute('src');
        if (!src || src.startsWith('data:')) return;
        const dataUrl = await cargarImagenComoDataUrl(src);
        if (dataUrl && imagenesCopia[indice]) {
          imagenesCopia[indice].setAttribute('src', dataUrl);
        }
      })
    );

    copia.querySelectorAll('button, a[aria-label="Editar jugador"], .no-print').forEach((nodo) => {
      nodo.style.display = 'none';
    });

    contenedor.appendChild(copia);
    document.body.appendChild(contenedor);

    return { contenedor, copia, ancho };
  }

  async function capturarCanvasParaPdf(nodoOriginal) {
    const { contenedor, copia, ancho } = await prepararClonParaPdf(nodoOriginal);
    const canvas = await html2canvas(copia, {
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      logging: false,
      scale: 2,
      useCORS: true,
      width: ancho,
      height: copia.scrollHeight,
      windowWidth: ancho,
      windowHeight: Math.max(copia.scrollHeight, 900),
    });
    return { canvas, contenedor, copia, ancho };
  }

  async function generarInformePdf() {
    if (!registro || generandoPdf || !fichaRef.current) return;

    setGenerandoPdf(true);
    const contenedoresParaLimpiar = [];

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const margen = 8;
      const anchoDisponible = 297 - margen * 2;
      const altoDisponible = 210 - margen * 2;

      // Pagina 1: ficha del jugador, ajustada para que quepa entera en una sola hoja.
      const ficha = await capturarCanvasParaPdf(fichaRef.current);
      contenedoresParaLimpiar.push(ficha.contenedor);

      const altoNaturalFicha = (ficha.canvas.height * anchoDisponible) / ficha.canvas.width;
      let anchoFicha = anchoDisponible;
      let altoFicha = altoNaturalFicha;
      if (altoNaturalFicha > altoDisponible) {
        const escala = altoDisponible / altoNaturalFicha;
        anchoFicha = anchoDisponible * escala;
        altoFicha = altoDisponible;
      }
      const xFicha = margen + (anchoDisponible - anchoFicha) / 2;
      doc.addImage(ficha.canvas.toDataURL('image/png'), 'PNG', xFicha, margen, anchoFicha, altoFicha, undefined, 'FAST');

      // A partir de la pagina 2: informes vinculados, evitando cortar una tarjeta a mitad.
      if (informes.length > 0 && informesRef.current) {
        const nodoInformes = informesRef.current;
        const topeContenedor = nodoInformes.getBoundingClientRect().top;
        const puntosSeguros = Array.from(nodoInformes.querySelectorAll('[data-pdf-card="informe"]'))
          .map((tarjeta) => tarjeta.getBoundingClientRect().bottom - topeContenedor)
          .sort((a, b) => a - b);

        const informesCapturados = await capturarCanvasParaPdf(nodoInformes);
        contenedoresParaLimpiar.push(informesCapturados.contenedor);

        const mmPorPx = anchoDisponible / informesCapturados.canvas.width;
        const alturaTotalPx = informesCapturados.canvas.height;
        const alturaPaginaPx = altoDisponible / mmPorPx;
        const escalaPx = informesCapturados.canvas.width / informesCapturados.ancho;
        const puntosSegurosPx = puntosSeguros.map((valor) => valor * escalaPx);
        const altoImagenInformesMm = alturaTotalPx * mmPorPx;
        const imagenInformes = informesCapturados.canvas.toDataURL('image/png');

        let inicioPx = 0;
        while (inicioPx < alturaTotalPx - 0.5) {
          doc.addPage();

          const limitePx = inicioPx + alturaPaginaPx;
          let finPx = puntosSegurosPx.filter((punto) => punto > inicioPx + 0.5 && punto <= limitePx).pop();
          if (!finPx || finPx <= inicioPx) {
            finPx = Math.min(limitePx, alturaTotalPx);
          }
          if (alturaTotalPx - finPx < 40) {
            finPx = alturaTotalPx;
          }

          const desplazamientoMm = inicioPx * mmPorPx;
          doc.addImage(
            imagenInformes,
            'PNG',
            margen,
            margen - desplazamientoMm,
            anchoDisponible,
            altoImagenInformesMm,
            undefined,
            'FAST'
          );

          inicioPx = finPx;
        }
      }

      const nombreArchivo = `captacion_${nombre.replace(/\s+/g, '_').toLowerCase()}.pdf`;
      doc.setProperties({ title: nombreArchivo });

      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (error) {
      console.error('No se pudo generar el PDF de captacion', error);
    } finally {
      contenedoresParaLimpiar.forEach((nodo) => nodo.remove());
      setGenerandoPdf(false);
    }
  }

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
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <section ref={fichaRef} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-3 text-white">
              <h3 className="text-2xl font-bold">{nombre}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generarInformePdf}
                  disabled={generandoPdf}
                  title="Exportar PDF"
                  aria-label="Exportar PDF"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5" />
                    <path d="M13 12v5" />
                    <path d="M16.5 12H15v5h1.5" />
                  </svg>
                </button>
                <Link
                  to={`/captacion?editar=${registro.id}`}
                  title="Editar jugador"
                  aria-label="Editar jugador"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
                <div className="w-full max-w-xs shrink-0 space-y-2.5 md:w-56">
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    {fotoUrl ? (
                      <img src={fotoUrl} alt={nombre} className="h-72 w-full object-cover" />
                    ) : (
                      <div className="flex h-72 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center text-sm font-semibold text-club-black/40">
                        Sin foto disponible
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Fecha nac.</p>
                      <p className="mt-0.5 text-sm font-bold text-club-black">{renderValor(registro, 'fecha_nacimiento')}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Año</p>
                      <p className="mt-0.5 text-sm font-bold text-club-black">{renderValor(registro, 'anio_nacimiento')}</p>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3 md:w-72 md:shrink-0">
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                    {escudoClub ? (
                      <img src={escudoClub} alt={registro.club} className="h-10 w-10 flex-shrink-0 object-contain" />
                    ) : (
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-club-black">{renderValor(registro, 'club')}</p>
                      <p className="truncate text-xs text-club-black/55">{renderValor(registro, 'equipo')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Dorsal</p>
                      <p className="mt-0.5 text-base font-bold text-club-black">{renderValor(registro, 'dorsal')}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Lateralidad</p>
                      <p className="mt-0.5 text-base font-bold text-club-black">{renderValor(registro, 'lateralidad')}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col items-center gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Nº informes en partidos</p>
                      <span className="text-2xl font-bold text-club-red">
                        {numeroInformes}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setMostrarModalInformes(true)}
                          disabled={numeroInformes === 0}
                          title="Ver informes del jugador"
                          aria-label="Ver informes del jugador"
                          className="text-club-black/40 hover:text-club-red disabled:opacity-30 disabled:hover:text-club-black/40"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                            <path d="M10 3.5c-4.5 0-7.5 3.5-8.5 6.5 1 3 4 6.5 8.5 6.5s7.5-3.5 8.5-6.5c-1-3-4-6.5-8.5-6.5zm0 10.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
                            <circle cx="10" cy="10" r="2" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={abrirModalNuevoInforme}
                          title="Crear informe"
                          aria-label="Crear informe"
                          className="text-club-black/40 hover:text-club-red"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                            <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 flex flex-col items-center gap-1.5">
                      <div className="flex w-full items-center justify-between gap-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Media valoración partidos</p>
                        <button
                          type="button"
                          onClick={() => setMostrarModalValoracionResponsable(true)}
                          title="Ver informe completo"
                          aria-label="Ver informe completo"
                          className="shrink-0 text-club-black/40 hover:text-club-red"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="M9 13h6" />
                            <path d="M9 17h6" />
                            <path d="M9 9h1" />
                          </svg>
                        </button>
                      </div>
                      {mediaValoracion !== '-' ? (
                        <span
                          className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                          style={{
                            backgroundColor:
                              COLOR_VALORACION_INFORME_COMPLETO[
                                Math.min(5, Math.max(1, Math.round(Number.parseFloat(mediaValoracion))))
                              ] || '#9ca3af',
                          }}
                        >
                          {mediaValoracion}
                        </span>
                      ) : (
                        <p className="mt-0.5 text-base font-bold text-club-black">-</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-xs shrink-0 md:w-56">
                  <CampoFutbolPosicion demarcacionConcreta={registro.demarcacion_concreta} otraDemarcacion={registro.otra_demarcacion} />
                </div>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 lg:col-span-2">
                  <InformeCompletoBody registro={registro} />
                </section>
              </div>
            </div>
          </section>

          <section id="informes-vinculados" ref={informesRef} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50">Actividad relacionada</p>
                <h3 className="text-xl font-bold text-club-black">INFORME EN PARTIDOS</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-lg font-bold text-club-red tabular-nums">{informes.length}</span>
                  <span className="text-sm text-club-black/70">{informes.length === 1 ? 'informe' : 'informes'}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-lg font-bold text-club-red tabular-nums">{mediaValoracion}</span>
                  <span className="text-sm text-club-black/70">media valoración</span>
                </div>
                <button
                  type="button"
                  onClick={() => alternarBloque('INFORME EN PARTIDOS')}
                  title={bloquesOcultos['INFORME EN PARTIDOS'] ? 'Mostrar sección' : 'Ocultar sección'}
                  aria-label={bloquesOcultos['INFORME EN PARTIDOS'] ? 'Mostrar sección' : 'Ocultar sección'}
                  className="text-club-black/40 hover:text-club-red"
                >
                  {bloquesOcultos['INFORME EN PARTIDOS'] ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 3.5c-4.5 0-7.5 3.5-8.5 6.5 1 3 4 6.5 8.5 6.5s7.5-3.5 8.5-6.5c-1-3-4-6.5-8.5-6.5zm0 10.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
                      <circle cx="10" cy="10" r="2" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M2.28 2.22a.75.75 0 0 0-1.06 1.06l1.86 1.86C1.68 6.53.66 8.06.1 9.15a.75.75 0 0 0 0 .7c1 2 4 6.65 9.9 6.65 1.93 0 3.55-.5 4.89-1.24l2.13 2.13a.75.75 0 1 0 1.06-1.06L2.28 2.22zM10 15c-4.5 0-7.03-3.6-7.98-5.5.5-.98 1.42-2.31 2.79-3.42l1.6 1.6a4 4 0 0 0 5.4 5.4l1.36 1.36c-.96.36-2.03.56-3.17.56zm3.98-3.36-5.6-5.6A4 4 0 0 1 14 9.99c0 .6-.13 1.16-.02 1.65zm4.61 1.86-1.11-1.11c.5-.75.89-1.5 1.15-2.09-.95-1.9-3.48-5.5-7.98-5.5-.7 0-1.35.08-1.97.22L7.36 3.7A9.9 9.9 0 0 1 10 3.35c5.9 0 8.9 4.65 9.9 6.65a.75.75 0 0 1 0 .7c-.34.68-.98 1.77-1.9 2.9z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {bloquesOcultos['INFORME EN PARTIDOS'] ? null : (
              <>
                {editandoInformeId && informeEditando && (
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
                        <select
                          value={informeEditando.observador || ''}
                          onChange={(e) => manejarCambioObservadorInforme(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        >
                          <option value="">{observadores.length > 0 ? 'Seleccionar...' : 'Sin opciones disponibles'}</option>
                          {observadores.map((observador) => (
                            <option key={observador} value={observador}>
                              {observador}
                            </option>
                          ))}
                          <option value={OBSERVADOR_NUEVO_VALOR}>+ Añadir nuevo...</option>
                        </select>
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
                      <SelectBuscador
                        label="Local"
                        value={informeEditando.local || ''}
                        options={opcionesClubEquipoInformeEditando}
                        emptyLabel="Seleccionar club/equipo..."
                        onChange={(valor) => actualizarCampoInforme('local', valor)}
                      />
                      <SelectBuscador
                        label="Visitante"
                        value={informeEditando.visitante || ''}
                        options={opcionesClubEquipoInformeEditando}
                        emptyLabel="Seleccionar club/equipo..."
                        onChange={(valor) => actualizarCampoInforme('visitante', valor)}
                      />
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
                        label="Posición"
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
                )}

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
                    <article key={informe.id} data-pdf-card="informe" className={`rounded-xl border bg-gray-50 p-4 ${editandoInformeId === informe.id ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
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
                        {CAMPOS_INFORME_VISTA_JUGADOR.map((campo) => {
                          const valor = campo === 'partido'
                            ? formatearValorInforme(calcularPartidoInforme(informe) || informe.partido)
                            : formatearValorInforme(obtenerValorInforme(informe, campo));
                          const claseFila = CAMPOS_INFORME_FILA_COMPLETA.includes(campo) ? 'sm:col-span-2 xl:col-span-3' : '';

                          if (campo === 'valoracion') {
                            const infoValoracion = obtenerInfoValoracionInforme(informe.valoracion);
                            return (
                              <div
                                key={campo}
                                className={`rounded-lg border p-3 ${claseFila}`}
                                style={infoValoracion ? { borderColor: infoValoracion.color, backgroundColor: `${infoValoracion.color}1a` } : undefined}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                  {ETIQUETAS_INFORME[campo]}
                                </p>
                                <p
                                  className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-club-black"
                                  style={infoValoracion ? { color: infoValoracion.color } : undefined}
                                >
                                  {infoValoracion ? (
                                    <>
                                      <span
                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: infoValoracion.color }}
                                      />
                                      <span>{infoValoracion.etiqueta}</span>
                                    </>
                                  ) : (
                                    '-'
                                  )}
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div key={campo} className={`rounded-lg border border-gray-200 bg-white p-3 ${claseFila}`}>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                {ETIQUETAS_INFORME[campo]}
                              </p>
                              <p className="mt-1 text-sm font-medium text-club-black whitespace-pre-wrap">{valor}</p>
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
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-club-black/60">
          El registro solicitado no existe.
        </div>
      )}

      {mostrarModalValoracionResponsable && registro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setMostrarModalValoracionResponsable(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-club-black">Valoración del responsable</h3>
              <button
                type="button"
                onClick={() => setMostrarModalValoracionResponsable(false)}
                className="text-club-black/50 hover:text-club-black text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <InformeCompletoBody registro={registro} />
            </div>
          </div>
        </div>
      )}

      {mostrarModalInformes && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setMostrarModalInformes(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-club-black">Informes de {nombre}</h3>
                <p className="text-xs text-club-black/50 mt-0.5">
                  {numeroInformes} {numeroInformes === 1 ? 'informe registrado' : 'informes registrados'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalInformes(false)}
                className="text-club-black/50 hover:text-club-black text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {informes.length === 0 ? (
                <p className="px-1 py-6 text-center text-club-black/55">No hay informes asociados a este registro.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {informes.map((informe) => (
                    <article key={informe.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-club-black">{formatearFecha(informe.fecha)}</p>
                          <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{informe.observador || 'Sin observador'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMostrarModalInformes(false);
                            abrirEdicionInforme(informe);
                          }}
                          className="rounded-md border border-club-red/20 bg-club-red/5 p-1.5 text-club-red hover:bg-club-red/10"
                          aria-label="Editar informe"
                          title="Editar informe"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {CAMPOS_INFORME_VISTA_JUGADOR.map((campo) => {
                          const valor = campo === 'partido'
                            ? formatearValorInforme(calcularPartidoInforme(informe) || informe.partido)
                            : formatearValorInforme(obtenerValorInforme(informe, campo));
                          const claseFila = CAMPOS_INFORME_FILA_COMPLETA.includes(campo) ? 'sm:col-span-2 xl:col-span-3' : '';

                          if (campo === 'valoracion') {
                            const infoValoracion = obtenerInfoValoracionInforme(informe.valoracion);
                            return (
                              <div
                                key={campo}
                                className={`rounded-lg border p-3 ${claseFila}`}
                                style={infoValoracion ? { borderColor: infoValoracion.color, backgroundColor: `${infoValoracion.color}1a` } : undefined}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                  {ETIQUETAS_INFORME[campo]}
                                </p>
                                <p
                                  className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-club-black"
                                  style={infoValoracion ? { color: infoValoracion.color } : undefined}
                                >
                                  {infoValoracion ? (
                                    <>
                                      <span
                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: infoValoracion.color }}
                                      />
                                      <span>{infoValoracion.etiqueta}</span>
                                    </>
                                  ) : (
                                    '-'
                                  )}
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div key={campo} className={`rounded-lg border border-gray-200 bg-white p-3 ${claseFila}`}>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                {ETIQUETAS_INFORME[campo]}
                              </p>
                              <p className="mt-1 text-sm font-medium text-club-black whitespace-pre-wrap">{valor}</p>
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
          </div>
        </div>
      )}

      {mostrarModalNuevoInforme && nuevoInforme && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={cerrarModalNuevoInforme}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-club-black">Crear informe de {nombre}</h3>
                <p className="text-xs text-club-black/50 mt-0.5">Rellena los datos del informe y guarda para asociarlo a este jugador.</p>
              </div>
              <button
                type="button"
                onClick={cerrarModalNuevoInforme}
                className="text-club-black/50 hover:text-club-black text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {errorNuevoInforme ? (
                <p className="mb-3 text-xs text-club-red font-semibold">{errorNuevoInforme}</p>
              ) : null}

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Datos básicos</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={nuevoInforme.fecha || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('fecha', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Observador</label>
                      <select
                        value={nuevoInforme.observador || ''}
                        onChange={(e) => manejarCambioObservadorNuevoInforme(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      >
                        <option value="">{observadores.length > 0 ? 'Seleccionar...' : 'Sin opciones disponibles'}</option>
                        {observadores.map((observador) => (
                          <option key={observador} value={observador}>
                            {observador}
                          </option>
                        ))}
                        <option value={OBSERVADOR_NUEVO_VALOR}>+ Añadir nuevo...</option>
                      </select>
                    </div>
                    <SelectBuscador
                      label="Club"
                      value={nuevoInforme.club || ''}
                      options={opcionesClub}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('club', valor)}
                    />
                    <SelectBuscador
                      label="Equipo"
                      value={nuevoInforme.equipo || ''}
                      options={opcionesEquipoNuevoInforme}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('equipo', valor)}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Partido</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <SelectBuscador
                      label="Etapa"
                      value={nuevoInforme.etapa || ''}
                      options={opcionesEtapa}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('etapa', valor)}
                    />
                    <SelectBuscador
                      label="Categoría"
                      value={nuevoInforme.categoria || ''}
                      options={opcionesCategoria}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('categoria', valor)}
                    />
                    <SelectBuscador
                      label="Local"
                      value={nuevoInforme.local || ''}
                      options={opcionesClubEquipoNuevoInforme}
                      emptyLabel="Seleccionar club/equipo..."
                      onChange={(valor) => actualizarCampoNuevoInforme('local', valor)}
                    />
                    <SelectBuscador
                      label="Visitante"
                      value={nuevoInforme.visitante || ''}
                      options={opcionesClubEquipoNuevoInforme}
                      emptyLabel="Seleccionar club/equipo..."
                      onChange={(valor) => actualizarCampoNuevoInforme('visitante', valor)}
                    />
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Partido</label>
                      <input
                        type="text"
                        value={nuevoInforme.partido || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('partido', e.target.value)}
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
                        value={nuevoInforme.dorsal || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('dorsal', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Tipología</label>
                      <input
                        type="text"
                        value={nuevoInforme.tipologia || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('tipologia', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                    <SelectBuscador
                      label="Lateralidad"
                      value={nuevoInforme.lateralidad || ''}
                      options={['Diestro', 'Zurdo', 'Ambas']}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('lateralidad', valor)}
                    />
                    <SelectBuscador
                      label="Posición"
                      value={nuevoInforme.demarcacion_concreta || ''}
                      options={DEMARCACION_CONCRETA_OPCIONES}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('demarcacion_concreta', valor)}
                    />
                    <SelectBuscador
                      label="Titularidad"
                      value={nuevoInforme.titularidad || ''}
                      options={TITULARIDAD_OPCIONES}
                      emptyLabel="Seleccionar..."
                      onChange={(valor) => actualizarCampoNuevoInforme('titularidad', valor)}
                    />
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Minutos jugados</label>
                      <input
                        type="text"
                        value={nuevoInforme.minutos_jugados || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('minutos_jugados', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Goles</label>
                      <input
                        type="text"
                        value={nuevoInforme.goles || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('goles', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Goles encajados</label>
                      <input
                        type="text"
                        value={nuevoInforme.goles_encajados || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('goles_encajados', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">Descripción</label>
                  <textarea
                    value={nuevoInforme.descripcion || ''}
                    onChange={(e) => actualizarCampoNuevoInforme('descripcion', e.target.value)}
                    rows="3"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-club-black/70 mb-3">Valoracion</p>
                  {(() => {
                    const coloresValoracion = {
                      BAJO: 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500',
                      MEDIO: 'border-orange-300 bg-orange-50 text-orange-700 focus:ring-orange-500',
                      ALTO: 'border-green-300 bg-green-50 text-green-700 focus:ring-green-500',
                    };
                    const claseColor = coloresValoracion[nuevoInforme.valoracion || ''] || '';
                    return (
                      <select
                        value={nuevoInforme.valoracion || ''}
                        onChange={(e) => actualizarCampoNuevoInforme('valoracion', e.target.value)}
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
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={guardarNuevoInforme}
                disabled={guardandoNuevoInforme}
                className="rounded-md bg-club-red px-4 py-2 text-sm font-semibold text-white hover:bg-club-red/90 disabled:opacity-60"
              >
                {guardandoNuevoInforme ? 'Guardando...' : 'Crear informe'}
              </button>
              <button
                type="button"
                onClick={cerrarModalNuevoInforme}
                disabled={guardandoNuevoInforme}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
