import { useEffect, useMemo, useState } from 'react';
import { obtenerEquiposPorClub } from '../data/equipos';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const INSTALACIONES_ROMO = ['GOGELA', 'GALEA', 'MULTIUSOS', 'GAZTELUETA'];
const EQUIPOS_ACTIVIDADES = ['Primer equipo', ...obtenerEquiposPorClub('ROMO')];
const ACTIVIDADES_STORAGE_KEY = 'romofc.actividades';

const ACTIVIDADES_MUESTRA = [];

function fechaClave(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

function crearFechaCalendario(fechaTexto) {
  const [dia, mes, anio] = fechaTexto.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12, 0, 0, 0);
}

function formatearHora(fecha, hora, horaFin) {
  if (hora && horaFin) return `Desde ${hora} Hasta ${horaFin}`;
  if (hora) return hora;
  return 'Hora pendiente';
}

function formatearFechaCorta(fecha) {
  return fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function IconoFlecha({ direccion }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d={direccion === 'izquierda' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoUbicacion() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconoMas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-4 w-4" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoBalon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 2.4 1.8-.9 2.9h-3l-.9-2.9L12 7Zm0 4.7 2.7 2-.9 2.8h-3.6l-.9-2.8 2.7-2ZM7.8 9.4l-2.3 1.7m10.7-1.7 2.3 1.7M9.2 16.5l-1.4 2m6.9-2 1.4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCarrera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
      <circle cx="14.5" cy="4.5" r="2" />
      <path d="m12 8-2.5 4 3 2.2-1.5 5M12 8l4 2 2 3M9.5 12 6 10M12.5 14.2l4.5 1.3 1.5 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCerrar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function IconoGuardar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
      <path d="M5 4h12l2 2v14H5V4Z" strokeLinejoin="round" />
      <path d="M8 4v5h8V4M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

function IconoEditar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="m4 20 4.5-1 10-10a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0l-10 10L4 20Z" strokeLinejoin="round" />
      <path d="m13 6 5 5" strokeLinecap="round" />
    </svg>
  );
}

const JORNADAS_ROMO = [
  ['13-09-2026', 'BARAKALDO C.F.', 'ROMO F.C.'],
  ['20-09-2026', 'ROMO F.C.', 'CULTURAL DPVA. DURANGO, S.'],
  ['27-09-2026', 'DEPORTIVO ALAVES "B"', 'ROMO F.C.'],
  ['04-10-2026', 'ROMO F.C.', 'LAUDIO F. SAN ROKEZAR, C.D. "A"'],
  ['11-10-2026', 'TOLOSA CLUB DE FUTBOL', 'ROMO F.C.'],
  ['18-10-2026', 'ROMO F.C.', 'VASCONIA, C.D.'],
  ['25-10-2026', 'AURRERA DE VITORIA, C.D.', 'ROMO F.C.'],
  ['01-11-2026', 'ROMO F.C.', 'ATHLETIC CLUB "B"'],
  ['08-11-2026', 'BERGARA K.E.', 'ROMO F.C.'],
  ['15-11-2026', 'ROMO F.C.', 'EIBAR, S.D. "B"'],
  ['22-11-2026', 'GERNIKA, S.D.', 'ROMO F.C.'],
  ['29-11-2026', 'ROMO F.C.', 'ANTIGUOKO KIROL ELKARTEA "B"'],
  ['06-12-2026', 'DANOK BAT CLUB "B"', 'ROMO F.C.'],
  ['13-12-2026', 'ROMO F.C.', 'REAL SOCIEDAD DE FUTBOL "B"'],
  ['20-12-2026', 'HERNANI, C.D.', 'ROMO F.C.'],
  ['03-01-2027', 'ZARAUTZ K.E.', 'ROMO F.C.'],
  ['10-01-2027', 'ROMO F.C.', 'LEIOA, S.D. "B"'],
  ['17-01-2027', 'ROMO F.C.', 'BARAKALDO C.F.'],
  ['24-01-2027', 'CULTURAL DPVA. DURANGO, S.', 'ROMO F.C.'],
  ['31-01-2027', 'ROMO F.C.', 'DEPORTIVO ALAVES "B"'],
  ['07-02-2027', 'LAUDIO F. SAN ROKEZAR, C.D. "A"', 'ROMO F.C.'],
  ['14-02-2027', 'ROMO F.C.', 'TOLOSA CLUB DE FUTBOL'],
  ['21-02-2027', 'VASCONIA, C.D.', 'ROMO F.C.'],
  ['28-02-2027', 'ROMO F.C.', 'AURRERA DE VITORIA, C.D.'],
  ['07-03-2027', 'ATHLETIC CLUB "B"', 'ROMO F.C.'],
  ['14-03-2027', 'ROMO F.C.', 'BERGARA K.E.'],
  ['21-03-2027', 'EIBAR, S.D. "B"', 'ROMO F.C.'],
  ['04-04-2027', 'ROMO F.C.', 'GERNIKA, S.D.'],
  ['11-04-2027', 'ANTIGUOKO KIROL ELKARTEA "B"', 'ROMO F.C.'],
  ['18-04-2027', 'ROMO F.C.', 'DANOK BAT CLUB "B"'],
  ['25-04-2027', 'REAL SOCIEDAD DE FUTBOL "B"', 'ROMO F.C.'],
  ['02-05-2027', 'ROMO F.C.', 'HERNANI, C.D.'],
  ['09-05-2027', 'ROMO F.C.', 'ZARAUTZ K.E.'],
  ['16-05-2027', 'LEIOA, S.D. "B"', 'ROMO F.C.'],
];

function actividadesRomo() {
  const sesionesMuestra = ACTIVIDADES_MUESTRA.map(([fechaTexto, hora, equipo, tipo, titulo, instalacion], indice) => ({
    id: `muestra-${indice + 1}`,
    tipo,
    evento: tipo === 'partido' ? 'Partido' : 'Sesión',
    competicion: tipo === 'partido' ? 'Pretemporada' : 'Entrenamiento',
    titulo,
    equipo,
    local: tipo === 'partido' ? titulo.split(' vs ')[0] : '',
    visitante: tipo === 'partido' ? titulo.split(' vs ')[1] : '',
    rival: tipo === 'partido' ? titulo.split(' vs ')[1] : '',
    ubicacion: instalacion,
    fecha: crearFechaCalendario(fechaTexto),
    hora,
    jornada: '',
    duracion: '90 min',
  }));

  const jornadas = JORNADAS_ROMO.map(([fechaTexto, local, visitante], indice) => {
    const esLocal = local === 'ROMO F.C.';
    const rival = esLocal ? visitante : local;

    return {
      id: `romo-jornada-${indice + 1}`,
      tipo: 'partido',
      evento: 'Partido',
      competicion: 'Liga Nacional Juvenil',
      titulo: `Jornada ${indice + 1} · ${local} - ${visitante}`,
      equipo: 'ROMO F.C.',
      local,
      visitante,
      rival,
      jornada: indice + 1,
      ubicacion: 'Pendiente de confirmar',
      fecha: crearFechaCalendario(fechaTexto),
      hora: null,
      duracion: `Jornada ${indice + 1} · horario pendiente`,
    };
  });

  return [...sesionesMuestra, ...jornadas];
}

function crearFechaActividad(fechaTexto, hora) {
  const fechaBase = String(fechaTexto || '').trim();
  if (!fechaBase) return new Date();

  const horaTexto = String(hora || '').trim();
  if (horaTexto) {
    return new Date(`${fechaBase}T${horaTexto}`);
  }

  return new Date(`${fechaBase}T12:00:00`);
}

function normalizarActividadGuardada(actividad) {
  if (!actividad) return null;

  const fechaGuardada = String(actividad.fecha || '').trim();
  const fechaTexto = fechaGuardada.slice(0, 10);
  const fecha = crearFechaActividad(fechaTexto, actividad.hora);

  if (Number.isNaN(fecha.getTime())) return null;

  return {
    ...actividad,
    fecha,
    hora: actividad.hora || '',
  };
}

function cargarActividadesIniciales() {
  const base = actividadesRomo();

  if (typeof window === 'undefined') return base;

  try {
    const guardadas = JSON.parse(window.localStorage.getItem(ACTIVIDADES_STORAGE_KEY) || 'null');
    if (!Array.isArray(guardadas) || guardadas.length === 0) return base;

    const normalizadas = guardadas.map(normalizarActividadGuardada).filter(Boolean);
    return normalizadas.length > 0 ? normalizadas : base;
  } catch (_) {
    return base;
  }
}

function claseActividad(tipo) {
  return tipo === 'partido'
    ? {
        punto: 'bg-club-red',
        texto: 'text-club-redDark',
        fondo: 'bg-club-red/10 hover:bg-club-red/15',
        borde: 'border-club-red/25',
        etiqueta: 'Partido',
      }
    : {
        punto: 'bg-emerald-500',
        texto: 'text-emerald-700',
        fondo: 'bg-emerald-50 hover:bg-emerald-100',
        borde: 'border-emerald-200',
        etiqueta: 'Sesión',
      };
}

function ActividadFila({ actividad, compacta = false }) {
  const estilo = claseActividad(actividad.tipo);

  return (
    <div className={`group rounded-xl border ${estilo.borde} ${estilo.fondo} ${compacta ? 'p-2' : 'p-3'}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${estilo.punto}`} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-bold ${estilo.texto}`}>{actividad.titulo}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-club-black/65">{actividad.equipo}</p>
          {!compacta && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-club-black/55">
              <span>{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
              {actividad.jornada && <span>Jornada {actividad.jornada}</span>}
              {actividad.rival && <span>vs {actividad.rival}</span>}
              <span className="inline-flex items-center gap-1">
                <IconoUbicacion />
                {actividad.ubicacion}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Escudos publicados por Euskadifutbol para la competición 24057860.
// Se mantienen aquí asociados al nombre oficial que devuelve la jornada para
// que los partidos sigan mostrando el escudo correcto aunque cambie el rival.
const ESCUDOS_CLUBES = {
  'ATHLETIC CLUB "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFVF/1001_grande.png',
  'AURRERA DE VITORIA, C.D.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFAF/7.jpg',
  'VASCONIA, C.D.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFGF/2051.jpg',
  'TOLOSA CLUB DE FUTBOL': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFGF/2006.jpg',
  'LAUDIO F. SAN ROKEZAR, C.D. "A"': 'https://fvf.filesnovanet.es/pnfg/pimg/Clubes/00100_0000114836_Laudio.png',
  'DEPORTIVO ALAVES "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFAF/100.jpg',
  'CULTURAL DPVA. DURANGO, S.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFVF/1020_grande.png',
  'BARAKALDO C.F.': 'https://fvf.filesnovanet.es/pnfg/pimg/Clubes/00100_0009922517_Screenshot_2024_09_19_18_02_50_64_40deb401b9ffe8e1df2f1cc5ba480b12.jpg',
  'ZARAUTZ K.E.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFGF/2016.JPG',
  'BERGARA K.E.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFGF/2025.png',
  'EIBAR, S.D. "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFGF/2012.jpg',
  'GERNIKA, S.D.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFVF/1019_grande.png',
  'ANTIGUOKO KIROL ELKARTEA "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFGF/2030.jpg',
  'DANOK BAT CLUB "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFVF/1086_grande.png',
  'REAL SOCIEDAD DE FUTBOL "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/Clubes/00100_0010131668_Real_Sociedad_vect.png',
  'HERNANI, C.D.': 'https://fvf.filesnovanet.es/pnfg/pimg/Clubes/00100_0000105113_hernani_vec.png',
  'ROMO F.C.': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFVF/1124_grande.png',
  'LEIOA, S.D. "B"': 'https://fvf.filesnovanet.es/pnfg/pimg/MigracionPV/escudosFVF/1034_grande.png',
};

function escudoEquipo(nombre) {
  const clave = String(nombre || '').trim().toUpperCase();
  return ESCUDOS_CLUBES[clave] || '/assets/escudo.png';
}

function nombreCortoEquipo(nombre) {
  if (!nombre) return 'Equipo pendiente';
  return nombre
    .replace('ROMO F.C.', 'Romo F.C.')
    .replace(' C.F.', '')
    .replace(' CLUB DE FUTBOL', '')
    .replace(' CLUB ', ' ')
    .replace(' C.D. ', ' ')
    .replace(' K.E.', '')
    .replace(' S.D. ', ' ')
    .replace('DEPORTIVO ALAVES', 'Alavés')
    .replace('CULTURAL DPVA. DURANGO', 'Durango')
    .replace('LAUDIO F. SAN ROKEZAR,', 'Laudio')
    .replace('ANTIGUOKO KIROL ELKARTEA', 'Antiguoko')
    .replace('AURRERA DE VITORIA', 'Aurrera Vitoria')
    .replace('DANOK BAT', 'Danok Bat')
    .trim();
}

function EquipoPartido({ nombre, alineacion }) {
  return (
    <div className={`min-w-0 text-center ${alineacion === 'derecha' ? 'order-3' : ''}`}>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/80 p-1.5 shadow-sm sm:h-11 sm:w-11">
        <img src={escudoEquipo(nombre)} alt="" className="h-full w-full object-contain" />
      </div>
      <p className="mt-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-pink-700/70" title={nombre}>
        {nombreCortoEquipo(nombre)}
      </p>
      <p className="truncate text-sm font-black text-pink-800" title={nombre}>
        {nombreCortoEquipo(nombre)}
      </p>
    </div>
  );
}

function ActividadCalendario({ actividad, onEditar }) {
  if (actividad.tipo === 'partido') {
    const local = actividad.local || actividad.equipo;
    const visitante = actividad.visitante || actividad.rival;

    return (
      <div className="group relative rounded-xl border-2 border-pink-400 bg-pink-100/85 p-2.5 text-pink-800 shadow-[0_8px_20px_rgba(236,72,153,0.08)] sm:p-3">
        {onEditar && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEditar(actividad);
            }}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-club-red shadow-sm transition hover:bg-club-red hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Editar"
            title="Editar"
          >
            <IconoEditar />
          </button>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/75 px-2 py-1 text-sm font-black text-pink-800">
          <IconoReloj />
          <span>{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-1">
          <EquipoPartido nombre={local} />
          <span className="flex h-9 items-center justify-center rounded-full bg-club-red px-2 text-xs font-black text-white shadow-sm">VS</span>
          <EquipoPartido nombre={visitante} alineacion="derecha" />
        </div>
        <p className="mt-2 truncate text-center text-sm font-black text-pink-900" title={actividad.competicion}>
          {actividad.equipo}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-100/80 px-2.5 py-2 text-emerald-800">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-200/80">
        <IconoCarrera />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black sm:text-sm">
          {formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)} · {actividad.equipo || 'Sesión de equipo'} {actividad.titulo && ` ${actividad.titulo}`}
        </p>
        <p className="truncate text-[10px] font-bold text-emerald-700/70">{actividad.ubicacion || 'Instalación pendiente'}</p>
      </div>
    </div>
  );
}

function FiltroSelect({ etiqueta, valor, opciones, onChange }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-club-black/50">{etiqueta}</span>
      <select
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-club-black shadow-sm outline-none transition focus:border-club-red focus:ring-2 focus:ring-club-red/15"
      >
        <option value="todos">Todos</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </label>
  );
}

function CampoFormulario({ etiqueta, children, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-club-black/60">{etiqueta}</span>
      {children}
    </label>
  );
}

function EntradaFormulario({ value, onChange, type = 'text', placeholder, required = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-club-black outline-none transition placeholder:text-slate-400 focus:border-club-red focus:ring-2 focus:ring-club-red/15"
    />
  );
}

function SelectorFormulario({ value, onChange, opciones, placeholder, required = false }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-club-black outline-none transition focus:border-club-red focus:ring-2 focus:ring-club-red/15"
    >
      <option value="">{placeholder}</option>
      {opciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
    </select>
  );
}

function ModalCrearActividad({ tipo, formulario, onChange, onClose, onSubmit, modo = 'crear', equipoOpciones }) {
  if (!tipo) return null;

  const esPartido = tipo === 'partido';
  const esEdicion = modo === 'editar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-actividad">
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3 text-club-red">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-club-red/10">
              {esPartido ? <IconoBalon /> : <IconoCarrera />}
            </span>
            <h2 id="titulo-actividad" className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
              {esEdicion ? 'Editar' : 'Nuevo'} {esPartido ? 'partido' : 'sesion'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-club-black" aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(100vh-170px)] overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoFormulario etiqueta="Fecha">
              <EntradaFormulario type="date" value={formulario.fecha} onChange={(value) => onChange('fecha', value)} required />
            </CampoFormulario>
            <CampoFormulario etiqueta="Hora">
              <EntradaFormulario type="time" value={formulario.hora} onChange={(value) => onChange('hora', value)} />
            </CampoFormulario>

            {esPartido ? (
              <>
                <CampoFormulario etiqueta="Competición">
                  <EntradaFormulario value={formulario.competicion} onChange={(value) => onChange('competicion', value)} placeholder="Competición" required />
                </CampoFormulario>
                <CampoFormulario etiqueta="Jornada">
                  <EntradaFormulario value={formulario.jornada} onChange={(value) => onChange('jornada', value)} placeholder="Ej. Jornada 1" />
                </CampoFormulario>
                <CampoFormulario etiqueta="Mi equipo" className="sm:col-span-2">
                  <SelectorFormulario value={formulario.equipo} onChange={(value) => onChange('equipo', value)} opciones={equipoOpciones} placeholder="Selecciona un equipo" required />
                </CampoFormulario>
                <CampoFormulario etiqueta="Equipos">
                  <EntradaFormulario value={formulario.local} onChange={(value) => onChange('local', value)} placeholder="Local" required />
                </CampoFormulario>
                <CampoFormulario etiqueta=" ">
                  <EntradaFormulario value={formulario.visitante} onChange={(value) => onChange('visitante', value)} placeholder="Visitante / rival" required />
                </CampoFormulario>
              </>
            ) : (
              <>
                <CampoFormulario etiqueta="Mi equipo" className="sm:col-span-2">
                  <SelectorFormulario value={formulario.equipo} onChange={(value) => onChange('equipo', value)} opciones={equipoOpciones} placeholder="Selecciona un equipo" required />
                </CampoFormulario>
              </>
            )}

            <CampoFormulario etiqueta="Instalación" className="sm:col-span-2">
              <SelectorFormulario value={formulario.instalacion} onChange={(value) => onChange('instalacion', value)} opciones={INSTALACIONES_ROMO} placeholder="Selecciona instalación" required />
            </CampoFormulario>
          </div>

          <button type="submit" className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-club-red px-5 text-base font-black uppercase tracking-wide text-white shadow-lg shadow-club-red/20 transition hover:bg-club-redDark focus:outline-none focus:ring-4 focus:ring-club-red/20">
            <IconoGuardar />
            {esEdicion ? 'Guardar cambios' : 'Guardar evento'}
          </button>
        </form>
      </div>
    </div>
  );
}

function IconoTabla() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></svg>;
}

function IconoEquipos() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.5-3 2.2-4.5 5.5-4.5s5 1.5 5.5 4.5M14 14.5c3.8-.5 5.9 1 6.5 4.5" /></svg>;
}

function IconoVistaHoras() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function VistaSelector({ vista, onChange }) {
  const opciones = [
    ['calendario', 'Calendario', <IconoCalendario key="calendario" />],
    ['tabla', 'Tabla', <IconoTabla key="tabla" />],
    ['equipos', 'Equipos', <IconoEquipos key="equipos" />],
    ['horas', 'Horas', <IconoVistaHoras key="horas" />],
  ];

  return (
    <div className="inline-flex w-full flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-auto" role="tablist" aria-label="Vistas de actividades">
      {opciones.map(([valor, etiqueta, icono]) => (
        <button
          key={valor}
          type="button"
          role="tab"
          aria-selected={vista === valor}
          onClick={() => onChange(valor)}
          className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold uppercase tracking-wide transition sm:flex-none ${vista === valor ? 'bg-club-red text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-club-black'}`}
        >
          {icono}
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

function obtenerInicioSemana(fecha) {
  const inicio = new Date(fecha);
  inicio.setHours(12, 0, 0, 0);
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  return inicio;
}

function diasDeSemana(inicio) {
  return Array.from({ length: 7 }, (_, indice) => sumarDias(inicio, indice));
}

function formatearFechaTabla(fecha) {
  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatearDiaSemana(fecha) {
  return fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).replace('.', '');
}

function NavegacionSemana({ semana, onChange, onHoy }) {
  const fin = sumarDias(semana, 6);
  const titulo = `${semana.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} – ${fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(-1)} className="rounded-lg p-2 text-slate-500 transition hover:bg-club-red/10 hover:text-club-red" aria-label="Semana anterior"><IconoFlecha direccion="izquierda" /></button>
        <h2 className="min-w-0 text-center text-base font-black capitalize text-club-black sm:min-w-[270px]">{titulo}</h2>
        <button type="button" onClick={() => onChange(1)} className="rounded-lg p-2 text-slate-500 transition hover:bg-club-red/10 hover:text-club-red" aria-label="Semana siguiente"><IconoFlecha direccion="derecha" /></button>
      </div>
      <button type="button" onClick={onHoy} className="self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600 transition hover:border-club-red/30 hover:text-club-red sm:self-auto">Esta semana</button>
    </div>
  );
}

function TablaActividades({ actividades, onEditar }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left">
          <thead className="bg-slate-100/90 text-[11px] uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Hora</th><th className="px-5 py-4">Equipo</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Actividad</th><th className="px-5 py-4">Lugar</th><th className="px-5 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actividades.length > 0 ? actividades.slice().sort((a, b) => a.fecha - b.fecha || String(a.hora || '').localeCompare(String(b.hora || ''))).map((actividad) => {
              const estilo = claseActividad(actividad.tipo);
              return <tr key={actividad.id} className="transition hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-sm font-black text-club-black">{formatearFechaTabla(actividad.fecha)}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-500">{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-600"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${estilo.punto}`} />{actividad.equipo}</td><td className="px-5 py-4"><span className={`inline-flex rounded-md border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${actividad.tipo === 'partido' ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{estilo.etiqueta}</span></td><td className="min-w-[260px] px-5 py-4 text-sm font-bold text-slate-700">{actividad.titulo}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-500">{actividad.ubicacion}</td><td className="whitespace-nowrap px-5 py-4 text-right"><button type="button" onClick={() => onEditar?.(actividad)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600 transition hover:border-club-red/30 hover:text-club-red"><IconoEditar /> Editar</button></td></tr>;
            }) : <tr><td colSpan="7" className="px-5 py-14 text-center text-sm font-semibold text-slate-400">No hay actividades para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquiposView({ actividades, semana, onChange, onHoy }) {
  const dias = diasDeSemana(semana);
  const equipos = Array.from(new Set([...EQUIPOS_ACTIVIDADES, ...actividades.map((actividad) => actividad.equipo)]));
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><NavegacionSemana semana={semana} onChange={onChange} onHoy={onHoy} /><div className="overflow-x-auto"><div className="min-w-[930px]">
    <div className="grid grid-cols-[190px_repeat(7,minmax(105px,1fr))] border-b border-slate-200 bg-slate-100/90 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><div className="flex items-end px-5 py-4 text-left">Equipo</div>{dias.map((dia) => <div key={fechaClave(dia)} className={`border-l border-slate-200 px-2 py-3 ${fechaClave(dia) === fechaClave(new Date()) ? 'text-club-red' : ''}`}><div>{formatearDiaSemana(dia).split(' ')[0]}</div><strong className="mt-1 block text-lg tracking-normal text-club-black">{dia.getDate()}</strong></div>)}</div>
    {equipos.map((equipo) => <div key={equipo} className="grid min-h-[92px] grid-cols-[190px_repeat(7,minmax(105px,1fr))] border-b border-slate-200 last:border-b-0"><div className="flex items-center gap-3 px-5 text-sm font-black text-slate-700"><span className={`h-3 w-3 shrink-0 rounded-full ${claseColorEquipo(equipo)}`} />{equipo}</div>{dias.map((dia) => { const delDia = actividades.filter((actividad) => actividad.equipo === equipo && fechaClave(actividad.fecha) === fechaClave(dia)); return <div key={fechaClave(dia)} className="border-l border-slate-200 p-2">{delDia.map((actividad) => <div key={actividad.id} className={`mb-1 rounded-lg border px-2 py-2 text-[11px] font-bold leading-tight ${actividad.tipo === 'partido' ? 'border-red-200 bg-red-50 text-red-700' : 'border-pink-200 bg-pink-50 text-pink-700'}`}><span className="block">{actividad.hora || '—'}</span><span className="mt-0.5 block line-clamp-2">{actividad.titulo}</span></div>)}</div>;})}</div>)}
  </div></div></div>;
}

function claseColorEquipo(equipo) {
  const colores = ['bg-pink-500', 'bg-lime-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-amber-500', 'bg-violet-500'];
  const indice = Array.from(String(equipo)).reduce((total, caracter) => total + caracter.charCodeAt(0), 0) % colores.length;
  return colores[indice];
}

function HorasView({ actividades, semana, onChange, onHoy }) {
  const dias = diasDeSemana(semana);
  const horas = Array.from({ length: 15 }, (_, indice) => indice + 8);
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><NavegacionSemana semana={semana} onChange={onChange} onHoy={onHoy} /><div className="overflow-x-auto"><div className="min-w-[930px]">
    <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-slate-200 bg-slate-100/90 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><div className="px-2 py-4">Hora</div>{dias.map((dia) => <div key={fechaClave(dia)} className="border-l border-slate-200 px-2 py-4">{formatearDiaSemana(dia)}</div>)}</div>
    {horas.map((hora) => <div key={hora} className="grid min-h-[70px] grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-slate-100 last:border-b-0"><div className="border-r border-slate-200 px-3 py-3 text-xs font-black text-slate-400">{String(hora).padStart(2, '0')}:00</div>{dias.map((dia) => { const delDia = actividades.filter((actividad) => fechaClave(actividad.fecha) === fechaClave(dia) && Number(String(actividad.hora || '').split(':')[0]) === hora); return <div key={fechaClave(dia)} className="border-l border-slate-100 p-1.5">{delDia.map((actividad) => <div key={actividad.id} className={`rounded-lg border px-2.5 py-2 text-[11px] font-bold leading-tight ${actividad.tipo === 'partido' ? 'border-red-200 bg-red-50 text-red-700' : 'border-pink-200 bg-pink-50 text-pink-700'}`}><span className="block font-black">{actividad.hora || `${String(hora).padStart(2, '0')}:00`}</span><span className="mt-0.5 block line-clamp-2">{actividad.titulo}</span><span className="mt-1 block truncate font-semibold opacity-70">{actividad.equipo}</span></div>)}</div>;})}</div>)}
  </div></div></div>;
}

export default function Actividades() {
  const { user } = useAuth();
  const { club } = useClub();
  const hoy = useMemo(() => new Date(), []);
  const [mesVisible, setMesVisible] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [vista, setVista] = useState('calendario');
  const [semanaVisible, setSemanaVisible] = useState(() => obtenerInicioSemana(hoy));
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => fechaClave(hoy));
  const [filtros, setFiltros] = useState({ equipo: 'todos', evento: 'todos', competicion: 'todos' });
  const [actividades, setActividades] = useState(() => cargarActividadesIniciales());
  const [equiposSelector, setEquiposSelector] = useState([]);
  const [tipoNuevo, setTipoNuevo] = useState(null);
  const [modoFormulario, setModoFormulario] = useState('crear');
  const [actividadEditandoId, setActividadEditandoId] = useState(null);
  const [formulario, setFormulario] = useState({});
  const [fechaMenuCreacion, setFechaMenuCreacion] = useState(null);
  const opcionesEquipo = useMemo(() => Array.from(new Set(actividades.map((actividad) => actividad.equipo))).sort(), [actividades]);
  const opcionesEvento = useMemo(() => Array.from(new Set(actividades.map((actividad) => actividad.evento))).sort(), [actividades]);
  const opcionesCompeticion = useMemo(() => Array.from(new Set(actividades.map((actividad) => actividad.competicion))).sort(), [actividades]);

  useEffect(() => {
    let cancelado = false;

    const cargarEquiposSelector = async () => {
      try {
        const { equipos } = await api.get('/jugadores/equipos');
        if (!cancelado) {
          setEquiposSelector(Array.isArray(equipos) ? equipos : []);
        }
      } catch (_) {
        if (!cancelado) {
          setEquiposSelector(obtenerEquiposPorClub(club || user?.club || 'ROMO'));
        }
      }
    };

    cargarEquiposSelector();

    return () => {
      cancelado = true;
    };
  }, [club, user?.club]);

  const opcionesEquipoModal = useMemo(() => {
    const base = equiposSelector.length > 0 ? equiposSelector : obtenerEquiposPorClub(club || user?.club || 'ROMO');
    if (formulario.equipo && !base.includes(formulario.equipo)) {
      return [...base, formulario.equipo];
    }
    return base;
  }, [club, equiposSelector, formulario.equipo, user?.club]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const serializadas = actividades.map((actividad) => ({
        ...actividad,
        fecha: fechaClave(actividad.fecha),
        hora: actividad.hora || '',
      }));
      window.localStorage.setItem(ACTIVIDADES_STORAGE_KEY, JSON.stringify(serializadas));
    } catch (_) {
      // Si localStorage no esta disponible, seguimos sin persistencia.
    }
  }, [actividades]);

  const actividadesFiltradas = useMemo(
    () =>
      actividades.filter(
        (actividad) =>
          (filtros.equipo === 'todos' || actividad.equipo === filtros.equipo) &&
          (filtros.evento === 'todos' || actividad.evento === filtros.evento) &&
          (filtros.competicion === 'todos' || actividad.competicion === filtros.competicion)
      ),
    [actividades, filtros]
  );

  const actividadesPorDia = useMemo(() => {
    const mapa = new Map();
    actividadesFiltradas.forEach((actividad) => {
      const clave = fechaClave(actividad.fecha);
      mapa.set(clave, [...(mapa.get(clave) || []), actividad]);
    });
    return mapa;
  }, [actividadesFiltradas]);

  const celdas = useMemo(() => {
    const primerDia = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
    const desplazamiento = (primerDia.getDay() + 6) % 7;
    const inicio = sumarDias(primerDia, -desplazamiento);
    return Array.from({ length: 42 }, (_, indice) => sumarDias(inicio, indice));
  }, [mesVisible]);

  const actividadesSeleccionadas = actividadesPorDia.get(fechaSeleccionada) || [];
  const proximas = actividadesFiltradas.filter((actividad) => actividad.fecha >= hoy).sort((a, b) => a.fecha - b.fecha).slice(0, 5);
  const tituloMes = `${MESES[mesVisible.getMonth()]} ${mesVisible.getFullYear()}`;
  const fechaSeleccionadaTexto = new Date(`${fechaSeleccionada}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const cambiarMes = (cantidad) => {
    const siguiente = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + cantidad, 1);
    setMesVisible(siguiente);
    setFechaSeleccionada(fechaClave(siguiente));
  };

  const irAHoy = () => {
    setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    setFechaSeleccionada(fechaClave(hoy));
    setSemanaVisible(obtenerInicioSemana(hoy));
  };

  const cambiarSemana = (cantidad) => setSemanaVisible((actual) => sumarDias(actual, cantidad * 7));

  const abrirCrear = (tipo, fecha = fechaSeleccionada) => {
    setFechaSeleccionada(fecha);
    setFechaMenuCreacion(null);
    setTipoNuevo(tipo);
    setModoFormulario('crear');
    setActividadEditandoId(null);
    setFormulario({
      fecha,
      hora: tipo === 'partido' ? '' : '18:00',
      horaFin: '',
      equipo: '',
      instalacion: '',
      competicion: '',
      jornada: '',
      local: '',
      visitante: '',
    });
  };

  const abrirEditar = (actividad) => {
    setFechaSeleccionada(fechaClave(actividad.fecha));
    setFechaMenuCreacion(null);
    setTipoNuevo(actividad.tipo);
    setModoFormulario('editar');
    setActividadEditandoId(actividad.id);
    setFormulario({
      fecha: fechaClave(actividad.fecha),
      hora: actividad.hora || '',
      horaFin: actividad.horaFin || '',
      equipo: actividad.equipo || '',
      instalacion: actividad.ubicacion || '',
      competicion: actividad.competicion || '',
      jornada: actividad.jornada ? String(actividad.jornada) : '',
      local: actividad.local || '',
      visitante: actividad.visitante || actividad.rival || '',
    });
  };

  const cerrarCrear = () => {
    setTipoNuevo(null);
    setModoFormulario('crear');
    setActividadEditandoId(null);
    setFormulario({});
    setFechaMenuCreacion(null);
  };

  const cambiarFormulario = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const guardarActividad = (event) => {
    event.preventDefault();
    const fecha = crearFechaActividad(formulario.fecha, formulario.hora);
    const esPartido = tipoNuevo === 'partido';
    const nuevaActividad = {
      id: actividadEditandoId || `${tipoNuevo}-${Date.now()}`,
      tipo: tipoNuevo,
      evento: esPartido ? 'Partido' : 'Sesión',
      competicion: esPartido ? formulario.competicion : 'Entrenamiento',
      titulo: esPartido ? `${formulario.local} vs ${formulario.visitante}` : 'Entrenamiento',
      equipo: formulario.equipo,
      local: esPartido ? formulario.local : '',
      visitante: esPartido ? formulario.visitante : '',
      rival: esPartido ? formulario.visitante : '',
      ubicacion: formulario.instalacion,
      fecha,
      hora: formulario.hora || '',
      horaFin: formulario.horaFin || '',
      jornada: esPartido ? formulario.jornada : '',
      duracion: esPartido
        ? `${formulario.hora || 'Hora pendiente'}${formulario.horaFin ? ` - ${formulario.horaFin}` : ''} · ${formulario.jornada || formulario.competicion}`
        : formulario.horaFin
          ? `${formulario.hora} - ${formulario.horaFin}`
          : formulario.hora || 'Hora pendiente',
    };

    setActividades((actuales) => {
      if (actividadEditandoId) {
        return actuales.map((actividad) => (actividad.id === actividadEditandoId ? nuevaActividad : actividad));
      }

      return [...actuales, nuevaActividad];
    });
    setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    setFechaSeleccionada(fechaClave(fecha));
    setSemanaVisible(obtenerInicioSemana(fecha));
    cerrarCrear();
  };

  return (
    <section className="min-h-full bg-slate-50/70 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-club-red">
              <IconoCalendario />
              <span className="text-xs font-extrabold uppercase tracking-[0.2em]">Planificación deportiva</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-club-black sm:text-3xl">Actividades</h1>
            <p className="mt-1 max-w-2xl text-sm text-club-black/55 sm:text-base">
              Consulta todas las jornadas oficiales del ROMO F.C. en la Liga Nacional Juvenil.
            </p>
          </div>
          <button
            type="button"
            onClick={irAHoy}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-club-black shadow-sm transition hover:border-club-red/40 hover:text-club-red"
          >
            <IconoCalendario />
            Hoy
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:px-5">
          <FiltroSelect
            etiqueta="Equipo"
            valor={filtros.equipo}
            opciones={opcionesEquipo}
            onChange={(valor) => setFiltros((actuales) => ({ ...actuales, equipo: valor }))}
          />
          <FiltroSelect
            etiqueta="Evento"
            valor={filtros.evento}
            opciones={opcionesEvento}
            onChange={(valor) => setFiltros((actuales) => ({ ...actuales, evento: valor }))}
          />
          <FiltroSelect
      etiqueta="Competición"
            valor={filtros.competicion}
            opciones={opcionesCompeticion}
            onChange={(valor) => setFiltros((actuales) => ({ ...actuales, competicion: valor }))}
          />
          {(filtros.equipo !== 'todos' || filtros.evento !== 'todos' || filtros.competicion !== 'todos') && (
            <button
              type="button"
              onClick={() => setFiltros({ equipo: 'todos', evento: 'todos', competicion: 'todos' })}
              className="shrink-0 rounded-lg px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-club-red transition hover:bg-club-red/10"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Organiza tu agenda</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Elige cómo quieres consultar las actividades.</p>
            </div>
            <VistaSelector vista={vista} onChange={setVista} />
          </div>

          {vista === 'tabla' && <TablaActividades actividades={actividadesFiltradas} onEditar={abrirEditar} />}
          {vista === 'equipos' && <EquiposView actividades={actividadesFiltradas} semana={semanaVisible} onChange={cambiarSemana} onHoy={() => setSemanaVisible(obtenerInicioSemana(hoy))} />}
          {vista === 'horas' && <HorasView actividades={actividadesFiltradas} semana={semanaVisible} onChange={cambiarSemana} onHoy={() => setSemanaVisible(obtenerInicioSemana(hoy))} />}

          <div className={vista === 'calendario' ? '' : 'hidden'}>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => cambiarMes(-1)} className="rounded-lg p-2 text-club-black/55 transition hover:bg-club-red/10 hover:text-club-black" aria-label="Mes anterior">
                  <IconoFlecha direccion="izquierda" />
                </button>
                <h2 className="min-w-[170px] text-center text-lg font-black capitalize text-club-black">{tituloMes}</h2>
                <button type="button" onClick={() => cambiarMes(1)} className="rounded-lg p-2 text-club-black/55 transition hover:bg-club-red/10 hover:text-club-black" aria-label="Mes siguiente">
                  <IconoFlecha direccion="derecha" />
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => abrirCrear('sesion')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100">
                  <IconoMas />
                  Sesión
                </button>
                <button type="button" onClick={() => abrirCrear('partido')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-club-red px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition hover:bg-club-redDark">
                  <IconoMas />
                  Partido
                </button>
          </div>
          </div>
        </div>

            <div className="overflow-x-auto border-b border-gray-100 bg-slate-50/80">
              <div className="grid min-w-[1050px] grid-cols-7">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia} className="px-1 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-club-black/45 sm:text-xs">
                    {dia}
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto bg-slate-50/70">
            <div className="grid min-w-[1050px] grid-cols-7 gap-3 p-3 sm:gap-4 sm:p-4">
              {celdas.map((fecha) => {
                const clave = fechaClave(fecha);
                const actividadesCelda = actividadesPorDia.get(clave) || [];
                const esMesActual = fecha.getMonth() === mesVisible.getMonth();
                const esHoy = clave === fechaClave(hoy);
                const seleccionada = clave === fechaSeleccionada;

                return (
                  <div
                    key={clave}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setFechaSeleccionada(clave);
                      setFechaMenuCreacion(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setFechaSeleccionada(clave);
                      }
                    }}
                    className={`group relative min-h-[176px] overflow-hidden rounded-2xl border p-2.5 text-left transition sm:p-3 ${
                      !esMesActual ? 'border-slate-200/70 bg-slate-100/70 text-club-black/30' : 'border-slate-200 bg-white'
                    } ${seleccionada ? 'ring-2 ring-inset ring-club-red/55' : 'hover:border-club-red/30 hover:shadow-sm'}`}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFechaSeleccionada(clave);
                        setFechaMenuCreacion((actual) => (actual === clave ? null : clave));
                      }}
                      className="absolute left-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-club-red text-white shadow-lg shadow-club-red/20 transition hover:scale-105 hover:bg-club-redDark focus:outline-none focus:ring-4 focus:ring-club-red/20"
                      aria-label={`Añadir actividad el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`}
                    >
                      <IconoMas />
                    </button>
                    {fechaMenuCreacion === clave && (
                      <div
                        className="absolute left-2 top-14 z-20 flex min-w-[118px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => abrirCrear('sesion', clave)}
                          className="rounded-lg bg-emerald-50 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                        >
                          SESION
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirCrear('partido', clave)}
                          className="rounded-lg bg-club-red px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-white transition hover:bg-club-redDark"
                        >
                          PARTIDO
                        </button>
                      </div>
                    )}
                    <span className={`absolute right-3 top-3 text-sm font-black ${esHoy ? 'text-club-red' : esMesActual ? 'text-club-black/70' : 'text-club-black/25'}`}>
                      {fecha.getDate()}
                    </span>
                    <div className="flex min-h-[148px] flex-col justify-end pt-12">
                      <div className="space-y-2">
                        {actividadesCelda.slice(0, 2).map((actividad) => (
                          <ActividadCalendario key={actividad.id} actividad={actividad} onEditar={abrirEditar} />
                        ))}
                        {actividadesCelda.length > 2 && <span className="block px-1 text-[10px] font-bold text-club-black/45">+{actividadesCelda.length - 2} más</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-xs font-semibold text-club-black/55 sm:px-5">
              <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sesión</span>
              <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-club-red" /> Partido</span>
              <span className="text-club-black/35">Selecciona un día para ver el detalle</span>
            </div>
          </div>

          <aside className="hidden" aria-hidden="true">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-club-red">Detalle del día</p>
                  <h2 className="mt-1 text-lg font-black capitalize text-club-black">{fechaSeleccionadaTexto}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-club-black/50">{actividadesSeleccionadas.length}</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {actividadesSeleccionadas.length > 0 ? (
                  actividadesSeleccionadas.map((actividad) => <ActividadFila key={actividad.id} actividad={actividad} />)
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm font-bold text-club-black/55">Día libre</p>
                    <p className="mt-1 text-xs text-club-black/40">No hay actividades programadas.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-club-black">Próximas actividades</h2>
                <span className="text-xs font-bold text-club-black/40">{proximas.length}</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {proximas.map((actividad) => (
                  <div key={actividad.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 text-club-black">
                      <span className="text-[10px] font-bold uppercase text-club-black/45">{actividad.fecha.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
                      <span className="text-base font-black leading-none">{actividad.fecha.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-club-black">{actividad.tipo === 'partido' ? `${actividad.equipo} vs ${actividad.rival}` : actividad.titulo}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-club-black/50">{formatearFechaCorta(actividad.fecha)} · {formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)} · Jornada {actividad.jornada}</p>
                    </div>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${claseActividad(actividad.tipo).punto}`} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <ModalCrearActividad
        tipo={tipoNuevo}
        formulario={formulario}
        onChange={cambiarFormulario}
        onClose={cerrarCrear}
        onSubmit={guardarActividad}
        modo={modoFormulario}
        equipoOpciones={opcionesEquipoModal}
      />
    </section>
  );
}
