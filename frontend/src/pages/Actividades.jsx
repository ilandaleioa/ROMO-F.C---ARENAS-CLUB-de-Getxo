import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CLUBES_MAESTROS } from '../data/clubes';
import { EQUIPOS_BASE_CLUB, obtenerEquiposPorClub } from '../data/equipos';
import { EQUIPOS_MS, obtenerMsEquiposPorClub } from '../data/msEquipos';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';
import { useListas } from '../lib/listas';

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

const INSTALACIONES_ROMO = ['GOBELA', 'GALEA', 'MULTIUSOS', 'GAZTELUETA'];
const ESPACIOS_ACTIVIDAD = ['Entero', 'Medio'];
const EQUIPOS_MAESTROS = EQUIPOS_MS.map((equipo) => `${equipo.club} - ${equipo.nombre}`);
const EQUIPOS_ACTIVIDADES = ['Primer equipo', ...EQUIPOS_MAESTROS];
const ACTIVIDADES_STORAGE_KEY = 'romofc.actividades';
const OPCIONES_EVENTO = ['Sesión', 'Partido'];

function etiquetaInstalacionActividad(actividad, fallback = '') {
  const instalacion = String(actividad?.ubicacion || fallback || '').trim();
  if (!instalacion) return '';
  return String(actividad?.espacio || '').trim().toLowerCase() === 'medio' ? `${instalacion} 1/2` : instalacion;
}

const ACTIVIDADES_MUESTRA = [
  ['19-08-2026', '17:30', '19:00', 'ROMO - CADETE A', 'sesion', 'ROMO - CADETE A', 'GOBELA'],
  ['19-08-2026', '18:00', '19:30', 'ROMO - ITZU JUVENIL', 'sesion', 'ROMO - ITZU JUVENIL', 'GOBELA'],
  ['19-08-2026', '19:15', '21:30', 'ROMO CADETE A', 'partido', 'ROMO CADETE A - BARAKALDO', 'GOBELA'],
];

function etiquetaEquipoSelector(equipo) {
  return String(equipo || '').trim();
}
function normalizarEquipoMaestro(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '';

  const clave = normalizarClaveEquipo(texto);
  const equipoMaestro = EQUIPOS_MS.find((equipo) => {
    const variantes = [
      equipo.nombre,
      `${equipo.club} ${equipo.nombre}`,
      `${equipo.club} - ${equipo.nombre}`,
      `${equipo.club} FC ${equipo.nombre}`,
      `${equipo.club} CLUB ${equipo.nombre}`,
    ];

    return variantes.some((variante) => normalizarClaveEquipo(variante) === clave);
  });

  return equipoMaestro ? `${equipoMaestro.club} - ${equipoMaestro.nombre}` : texto;
}

function obtenerEquipoCanonico(valor, clubPreferido = '') {
  const texto = String(valor || '').trim();
  if (!texto) return '';

  const clave = normalizarClaveEquipo(texto);
  const clubClave = resolverClaveClubEquipo(clubPreferido);
  const candidatos = clubClave ? EQUIPOS_MS.filter((equipo) => equipo.club === clubClave) : EQUIPOS_MS;

  const coincidenciaExacta = candidatos.find((equipo) => {
    const variantes = [
      equipo.nombre,
      equipo.abreviatura,
      `${equipo.club} ${equipo.nombre}`,
      `${equipo.club} - ${equipo.nombre}`,
      `${equipo.club} FC ${equipo.nombre}`,
      `${equipo.club} CLUB ${equipo.nombre}`,
    ];

    return variantes.some((variante) => normalizarClaveEquipo(variante) === clave);
  });

  if (coincidenciaExacta) {
    return `${coincidenciaExacta.club} - ${coincidenciaExacta.nombre}`;
  }

  // No resolvemos por sufijo aquí. Los campos local/visitante también pueden
  // contener un equipo de otro club (p. ej. "BARAKALDO C.F. · Cadete A") y
  // hacerlo convertiría ese rival en el "CADETE A" del club activo.
  return texto;
}

function nombreEquipoFormulario(valor, clubPreferido = '') {
  const equipo = buscarEquipoMaestroCalendario(valor, clubPreferido);
  if (equipo && resolverClaveClubEquipo(clubPreferido || equipo.club) === equipo.club) {
    return equipo.nombre;
  }

  return textoLimpio(valor)
    .replace(/^(?:ROMO|ARENAS)(?:\s+FC|\s+CLUB)?\s*[-·]\s*/i, '')
    .trim();
}

const SEPARADOR_CLUB_EQUIPO = ' \u00b7 ';

function resolverClaveClubEquipo(valor) {
  const clave = normalizarClaveEquipo(valor);
  if (clave.includes('ROMO')) return 'ROMO';
  if (clave.includes('ARENAS')) return 'ARENAS';
  return clave;
}

function construirCatalogoLocalVisitante(clubes = CLUBES_MAESTROS, filasEquipos = []) {
  const clubesPorClave = new Map();
  [...clubes, ...CLUBES_MAESTROS].forEach((club, indice) => {
    const nombre = String(club?.nombre || club?.valor || '').trim();
    const clave = resolverClaveClubEquipo(nombre) || `CLUB-${indice + 1}`;
    if (!nombre || clubesPorClave.has(clave)) return;

    const nombreNormalizado = normalizarTextoBusqueda(nombre);
    clubesPorClave.set(clave, {
      clave,
      etiqueta: nombreNormalizado.includes('romo') ? 'ROMO FC' : nombreNormalizado.includes('arenas') ? 'ARENAS CLUB' : nombre,
      equiposClave: clave,
    });
  });

  const equiposPorClub = new Map();
  (filasEquipos || []).forEach((fila) => {
    const club = String(fila?.club || '').trim();
    const nombre = String(fila?.nombre || '').trim();
    if (!club || !nombre) return;

    const clave = resolverClaveClubEquipo(club);
    if (!equiposPorClub.has(clave)) equiposPorClub.set(clave, []);
    equiposPorClub.get(clave).push({
      nombre,
      abreviatura: String(fila?.abreviatura || '').trim(),
      orden: Number(fila?.orden) || 0,
    });
  });

  return Array.from(clubesPorClave.values()).map((club) => {
    const equiposInternos = obtenerMsEquiposPorClub(club.equiposClave);
    const equiposRegistrados = equiposPorClub.get(club.clave) || [];
    const equipos = equiposInternos.length > 0
      ? equiposInternos
      : equiposRegistrados.length > 0
        ? equiposRegistrados.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
        : EQUIPOS_BASE_CLUB.map((nombre, orden) => ({ nombre, abreviatura: '', orden }));

    return {
      ...club,
      equipos: equipos.map((equipo) => {
        const nombreEquipo = String(equipo.nombre || '').trim();
        const abreviatura = String(equipo.abreviatura || '').trim();
        const valor = `${club.etiqueta}${SEPARADOR_CLUB_EQUIPO}${nombreEquipo}`;

        return {
          valor,
          club: club.etiqueta,
          equipo: nombreEquipo,
          abreviatura,
          busqueda: normalizarTextoBusqueda(`${club.etiqueta} ${nombreEquipo} ${abreviatura}`),
        };
      }),
    };
  });
}

const CATALOGO_LOCAL_VISITANTE = construirCatalogoLocalVisitante();

function obtenerSeleccionClubEquipo(valor, catalogo = CATALOGO_LOCAL_VISITANTE) {
  const texto = String(valor || '').trim();
  if (!texto) return null;

  for (const club of catalogo) {
    const coincidencia = club.equipos.find((equipo) => equipo.valor === texto);
    if (coincidencia) {
      return {
        ...coincidencia,
        clubClave: club.clave,
        clubEtiqueta: club.etiqueta,
      };
    }
  }

  const partes = texto.split(SEPARADOR_CLUB_EQUIPO);
  if (partes.length >= 2) {
    const clubEtiqueta = partes[0].trim();
    const equipo = partes.slice(1).join(SEPARADOR_CLUB_EQUIPO).trim();
    const club = catalogo.find(
      (item) =>
        item.etiqueta === clubEtiqueta ||
        normalizarTextoBusqueda(item.etiqueta) === normalizarTextoBusqueda(clubEtiqueta)
    );

    return {
      valor: texto,
      clubClave: club?.clave || '',
      clubEtiqueta: club?.etiqueta || clubEtiqueta,
      equipo,
      abreviatura: '',
      busqueda: normalizarTextoBusqueda(texto),
    };
  }

  return {
    valor: texto,
    clubClave: '',
    clubEtiqueta: '',
    equipo: texto,
    abreviatura: '',
    busqueda: normalizarTextoBusqueda(texto),
  };
}

function normalizarTextoBusqueda(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function esLocalRomo(valor) {
  const local = normalizarTextoBusqueda(valor);
  return /^(?:romo fc|romo f c|romo juvenil a)(?:\s|$)/.test(local);
}

function obtenerInstalacionPorDefecto(tipo, local) {
  return String(tipo || '').trim().toLowerCase() === 'partido' && esLocalRomo(local) ? 'GOBELA' : '';
}

function normalizarClaveEquipo(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

const PALETA_EQUIPOS = [
  { acento: '#dc2626', fondo: '#fff1f2', borde: '#fda4af', texto: '#9f1239', fondoAcento: '#ffe4e6' },
  { acento: '#2563eb', fondo: '#eff6ff', borde: '#93c5fd', texto: '#1e3a8a', fondoAcento: '#dbeafe' },
  { acento: '#d97706', fondo: '#fffbeb', borde: '#fcd34d', texto: '#92400e', fondoAcento: '#fef3c7' },
  { acento: '#059669', fondo: '#ecfdf5', borde: '#6ee7b7', texto: '#065f46', fondoAcento: '#d1fae5' },
  { acento: '#7c3aed', fondo: '#f5f3ff', borde: '#c4b5fd', texto: '#5b21b6', fondoAcento: '#ede9fe' },
  { acento: '#0891b2', fondo: '#ecfeff', borde: '#67e8f9', texto: '#155e75', fondoAcento: '#cffafe' },
  { acento: '#ea580c', fondo: '#fff7ed', borde: '#fdba74', texto: '#9a3412', fondoAcento: '#ffedd5' },
  { acento: '#c026d3', fondo: '#fdf4ff', borde: '#e879f9', texto: '#86198f', fondoAcento: '#fae8ff' },
  { acento: '#4f46e5', fondo: '#eef2ff', borde: '#a5b4fc', texto: '#3730a3', fondoAcento: '#e0e7ff' },
  { acento: '#65a30d', fondo: '#f7fee7', borde: '#bef264', texto: '#3f6212', fondoAcento: '#ecfccb' },
  { acento: '#0284c7', fondo: '#f0f9ff', borde: '#7dd3fc', texto: '#075985', fondoAcento: '#e0f2fe' },
  { acento: '#e11d48', fondo: '#fff1f2', borde: '#fda4af', texto: '#9f1239', fondoAcento: '#ffe4e6' },
  { acento: '#0f766e', fondo: '#f0fdfa', borde: '#5eead4', texto: '#115e59', fondoAcento: '#ccfbf1' },
  { acento: '#db2777', fondo: '#fdf2f8', borde: '#f9a8d4', texto: '#9d174d', fondoAcento: '#fce7f3' },
  { acento: '#475569', fondo: '#f8fafc', borde: '#cbd5e1', texto: '#334155', fondoAcento: '#e2e8f0' },
  { acento: '#16a34a', fondo: '#f0fdf4', borde: '#86efac', texto: '#166534', fondoAcento: '#dcfce7' },
  { acento: '#0369a1', fondo: '#f0f9ff', borde: '#7dd3fc', texto: '#0c4a6e', fondoAcento: '#e0f2fe' },
  { acento: '#b45309', fondo: '#fffbeb', borde: '#fcd34d', texto: '#78350f', fondoAcento: '#fef3c7' },
  { acento: '#be123c', fondo: '#fff1f2', borde: '#fda4af', texto: '#881337', fondoAcento: '#ffe4e6' },
  { acento: '#4338ca', fondo: '#eef2ff', borde: '#a5b4fc', texto: '#312e81', fondoAcento: '#e0e7ff' },
  { acento: '#15803d', fondo: '#f0fdf4', borde: '#86efac', texto: '#14532d', fondoAcento: '#dcfce7' },
  { acento: '#a21caf', fondo: '#fdf4ff', borde: '#e879f9', texto: '#701a75', fondoAcento: '#fae8ff' },
  { acento: '#0e7490', fondo: '#ecfeff', borde: '#67e8f9', texto: '#164e63', fondoAcento: '#cffafe' },
  { acento: '#c2410c', fondo: '#fff7ed', borde: '#fdba74', texto: '#7c2d12', fondoAcento: '#ffedd5' },
  { acento: '#64748b', fondo: '#f8fafc', borde: '#cbd5e1', texto: '#1e293b', fondoAcento: '#e2e8f0' },
];

function indiceColorEquipo(equipo) {
  const clave = normalizarClaveEquipo(equipo);
  const equipoMaestro = EQUIPOS_MS.find((opcion) => {
    const club = normalizarClaveEquipo(opcion.club);
    const nombre = normalizarClaveEquipo(opcion.nombre);
    const abreviatura = normalizarClaveEquipo(opcion.abreviatura);
    const variantes = [
      `${club}${nombre}`,
      `${club}${abreviatura}`,
      `${club}FC${nombre}`,
      `${club}CLUB${nombre}`,
    ];
    return variantes.includes(clave);
  }) || (() => {
    const coincidenciasSinClub = EQUIPOS_MS.filter((opcion) => [opcion.nombre, opcion.abreviatura].some((valor) => normalizarClaveEquipo(valor) === clave));
    return coincidenciasSinClub.length === 1 ? coincidenciasSinClub[0] : null;
  })();

  if (equipoMaestro) {
    const indiceMaestro = EQUIPOS_MS.indexOf(equipoMaestro);
    return indiceMaestro % PALETA_EQUIPOS.length;
  }

  const suma = Array.from(clave).reduce((total, caracter) => total + caracter.charCodeAt(0), 0);
  return suma % PALETA_EQUIPOS.length;
}

function obtenerColorEquipo(equipo) {
  return PALETA_EQUIPOS[indiceColorEquipo(equipo)];
}

function textoLimpio(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

function quitarPrefijoJornadaPartido(texto) {
  return String(texto || '')
    .trim()
    .replace(/^Jornada\s+\d+\s*[·\-–—]\s*/i, '')
    .trim();
}

const NOMBRE_INTERNO_ROMO_JUVENIL = 'ROMO JUVENIL A';

function reemplazarNombreRomoJuvenil(valor) {
  return textoLimpio(valor).replace(/ROMO\s+F[.,]?\s*C[.,]?/gi, NOMBRE_INTERNO_ROMO_JUVENIL);
}

function esPartidoLigaRomoJuvenil(actividad) {
  if (String(actividad?.tipo || '').trim().toLowerCase() !== 'partido') return false;

  const competicion = normalizarTextoBusqueda(actividad?.competicion);
  const datosPartido = normalizarTextoBusqueda([
    actividad?.equipo,
    actividad?.local,
    actividad?.visitante,
    actividad?.rival,
    actividad?.titulo,
  ].filter(Boolean).join(' '));

  const esLigaJuvenil = competicion.includes('juvenil') || datosPartido.includes('juvenil');
  return competicion.includes('liga') && esLigaJuvenil && datosPartido.includes('romo');
}

function descomponerPartidoActividad(actividad) {
  if (actividad?.tipo !== 'partido') {
    return {
      local: textoLimpio(actividad?.local),
      visitante: textoLimpio(actividad?.visitante || actividad?.rival),
      titulo: String(actividad?.titulo || '').trim(),
    };
  }

  const equipo = textoLimpio(actividad?.equipo);
  const localGuardado = textoLimpio(actividad?.local);
  const visitanteGuardado = textoLimpio(actividad?.visitante || actividad?.rival);
  const tituloOriginal = String(actividad?.titulo || '').trim();
  const tituloLimpio = quitarPrefijoJornadaPartido(tituloOriginal);

  let local = localGuardado || equipo;
  let visitante = visitanteGuardado;

  const tituloEmpiezaPorEquipo = Boolean(equipo && tituloLimpio.startsWith(equipo));
  if ((!visitante || visitante === local || visitante === equipo) && tituloEmpiezaPorEquipo) {
    const resto = tituloLimpio.slice(equipo.length).replace(/^\s*[-–—]\s*/, '').trim();
    if (resto) visitante = resto;
  }

  if (!local && tituloLimpio) {
    const partes = tituloLimpio.split(/\s+[-–—]\s+/);
    if (partes.length >= 2) {
      local = textoLimpio(partes[0]);
      if (!visitante) visitante = textoLimpio(partes[partes.length - 1]);
    }
  }

  if (visitante === local || visitante === equipo) {
    visitante = '';
  }

  if (!visitante && tituloLimpio && tituloLimpio.includes(' vs ')) {
    const partes = tituloLimpio.split(/\s+vs\s+/i);
    if (partes.length >= 2) {
      visitante = textoLimpio(partes[partes.length - 1]);
    }
  }

  const titulo = local && visitante
    ? `${local} - ${visitante}`
    : tituloOriginal || [local, visitante].filter(Boolean).join(' - ');

  return {
    local,
    visitante,
    titulo: titulo || 'Partido',
  };
}

function tituloPartidoActividad(actividad) {
  if (actividad?.tipo !== 'partido') return String(actividad?.titulo || '').trim();
  return descomponerPartidoActividad(actividad).titulo;
}

function crearMapaAbreviaturasEquipos() {
  const mapa = new Map();
  // Las opciones del formulario contienen equipos de ambos clubes, aunque
  // el club activo sea solo uno de ellos. El calendario necesita resolver
  // cualquiera de esas opciones a su abreviatura.
  const equipos = EQUIPOS_MS;

  equipos.forEach((equipo) => {
    const abreviatura = String(equipo.abreviatura || '').trim();
    if (!abreviatura) return;

    const claves = new Set([
      normalizarClaveEquipo(equipo.nombre),
      normalizarClaveEquipo(`${equipo.club} ${equipo.nombre}`),
      normalizarClaveEquipo(abreviatura),
    ]);

    claves.forEach((clave) => {
      if (clave) mapa.set(clave, abreviatura);
    });
  });

  return mapa;
}

function compactarTextoCalendario(valor) {
  return String(valor || '').trim().replace(/\s+/g, '');
}

function etiquetaEquipoCalendario(valor, mapaAbreviaturas) {
  const texto = String(valor || '').trim();
  if (!texto) return 'Equipo pendiente';

  const clave = normalizarClaveEquipo(texto);
  const abreviaturaExacta = mapaAbreviaturas.get(clave);
  if (abreviaturaExacta) return abreviaturaExacta;

  // Algunas actividades guardadas incluyen el club delante del equipo
  // (por ejemplo, "ROMO FC · CADETE"). En ese caso usamos la coincidencia
  // más específica para no confundir "ITZU CADETE" con "CADETE".
  const abreviaturaConPrefijo = Array.from(mapaAbreviaturas.entries())
    .sort(([claveA], [claveB]) => claveB.length - claveA.length)
    .find(([nombreEquipo]) => clave.endsWith(nombreEquipo))?.[1];

  return abreviaturaConPrefijo || compactarTextoCalendario(texto);
}

function nombreEquipoCalendario(valor, clubPreferido = '') {
  const texto = String(valor || '').trim();
  if (!texto) return 'Equipo pendiente';

  const clave = normalizarClaveEquipo(texto);
  const clubClave = resolverClaveClubEquipo(clubPreferido);
  const candidatos = clubClave ? EQUIPOS_MS.filter((equipo) => equipo.club === clubClave) : EQUIPOS_MS;
  const equipoMaestro = candidatos.find((equipo) => {
    const variantes = [
      equipo.nombre,
      equipo.abreviatura,
      `${equipo.club} ${equipo.nombre}`,
      `${equipo.club} - ${equipo.nombre}`,
      `${equipo.club} FC ${equipo.nombre}`,
      `${equipo.club} CLUB ${equipo.nombre}`,
    ];

    return variantes.some((variante) => normalizarClaveEquipo(variante) === clave);
  });

  return equipoMaestro
    ? `${equipoMaestro.club} - ${equipoMaestro.nombre}`
    : texto;
}

function nombreEquipoLegible(valor, clubPreferido = '') {
  const texto = nombreEquipoCalendario(valor, clubPreferido);
  if (!texto) return 'Equipo pendiente';

  const limpio = texto
    .replace(/\b(F\.?C\.?|C\.?F\.?|C\.?D\.?|S\.?D\.?|K\.?E\.?)\b/gi, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limpio) return 'Equipo pendiente';

  return limpio
    .split(' ')
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ');
}

function buscarEquipoMaestroCalendario(valor, clubPreferido = '') {
  const clave = normalizarClaveEquipo(valor);
  const clubClave = resolverClaveClubEquipo(clubPreferido);
  const candidatos = clubClave ? EQUIPOS_MS.filter((equipo) => equipo.club === clubClave) : EQUIPOS_MS;

  const coincide = (equipo) => [
    equipo.nombre,
    equipo.abreviatura,
    `${equipo.club} ${equipo.nombre}`,
    `${equipo.club} - ${equipo.nombre}`,
    `${equipo.club} FC ${equipo.nombre}`,
    `${equipo.club} CLUB ${equipo.nombre}`,
  ].some((variante) => normalizarClaveEquipo(variante) === clave);

  // Primero respetamos el club de la actividad. Si el dato guardado trae
  // otro club delante, hacemos una segunda búsqueda global.
  return candidatos.find(coincide) || EQUIPOS_MS.find(coincide);
}

function nombreEquipoCalendarioConAbreviatura(valor, clubPreferido = '') {
  const nombre = nombreEquipoLegible(valor, clubPreferido);
  const abreviatura = abreviaturaEquipoCalendario(valor, clubPreferido);

  if (!abreviatura) return nombre;

  return `${abreviatura} ${nombre}`;
}

function abreviaturaEquipoCalendario(valor, clubPreferido = '') {
  const equipo = buscarEquipoMaestroCalendario(valor, clubPreferido);

  if (!equipo?.abreviatura) return '';

  // En la vista del calendario se usa la abreviatura solicitada para Arenas
  // Juvenil A: "AJ Arenas Juvenil A".
  return equipo.club === 'ARENAS' && equipo.nombre === 'JUVENIL A'
    ? 'AJ'
    : equipo.abreviatura;
}

function nombreClubLegible(valor, clubPreferido = '') {
  const texto = nombreEquipoCalendario(valor, clubPreferido);
  if (!texto) return 'Club pendiente';

  const limpio = texto
    .replace(/\b(F\.?C\.?|C\.?F\.?|C\.?D\.?|S\.?D\.?|K\.?E\.?)\b/gi, '')
    .replace(/\s*[-·|]\s*/g, ' ')
    .replace(/\b(JUVENIL|CADETE|INFANTIL|ALEVIN|BENJAMIN|PREBENJAMIN|SENIOR|FEM(?:ENINO)?|MASCULINO)\b/gi, '')
    .replace(/\b[ABCD]\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limpio) return 'Club pendiente';

  return limpio
    .split(' ')
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ');
}

function rivalJuegaComoLocal(actividad, local) {
  const clubRival = normalizarTextoBusqueda(nombreClubLegible(actividad?.rival));
  const clubLocal = normalizarTextoBusqueda(nombreClubLegible(local));
  return Boolean(clubRival && clubLocal && clubRival === clubLocal);
}

function esEquipoPropioPartido(actividad, nombre, clubPreferido = '') {
  const equipoPropio = normalizarTextoBusqueda(nombreEquipoCalendario(actividad?.equipo, clubPreferido));
  const candidato = normalizarTextoBusqueda(nombre);
  if (!equipoPropio || !candidato) return false;

  if (equipoPropio === candidato || equipoPropio.includes(candidato) || candidato.includes(equipoPropio)) {
    return true;
  }

  return normalizarTextoBusqueda(nombreClubLegible(actividad?.equipo, clubPreferido)) === normalizarTextoBusqueda(nombreClubLegible(nombre, clubPreferido));
}

function nombrePartidoCalendario(actividad, nombre, clubPreferido = '') {
  return esEquipoPropioPartido(actividad, nombre, clubPreferido)
    ? nombreEquipoCalendarioConAbreviatura(actividad?.equipo || nombre, clubPreferido)
    : nombreClubLegible(nombre, clubPreferido);
}

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
  if (hora && horaFin) return `${hora} - ${horaFin}`;
  if (hora) return hora;
  return 'Hora pendiente';
}

function ordenarActividades(a, b) {
  const diferencia = a.fecha - b.fecha;
  if (diferencia !== 0) return diferencia;
  const comparacionHora = String(a.hora || '').localeCompare(String(b.hora || ''));
  if (comparacionHora !== 0) return comparacionHora;
  const comparacionHoraFin = String(a.horaFin || '').localeCompare(String(b.horaFin || ''));
  if (comparacionHoraFin !== 0) return comparacionHoraFin;
  return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es');
}

function convertirHoraAMinutos(horaTexto) {
  const texto = String(horaTexto || '').trim();
  if (!texto) return null;

  const [horasTexto, minutosTexto = '0'] = texto.split(':');
  const horas = Number(horasTexto);
  const minutos = Number(minutosTexto);

  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  return horas * 60 + minutos;
}

function obtenerRangoActividad(actividad) {
  const inicio = convertirHoraAMinutos(actividad?.hora);
  if (inicio === null) return null;

  const finExplicito = convertirHoraAMinutos(actividad?.horaFin);
  const fin = finExplicito !== null && finExplicito > inicio ? finExplicito : inicio + 60;

  return { inicio, fin };
}

const HORA_VISTA_INICIO_DEFAULT = 8;
const HORA_VISTA_FIN_DEFAULT = 23;
const ALTURA_HORA_VISTA = 70;
const MINUTO_VISTA_INICIO_DEFAULT = HORA_VISTA_INICIO_DEFAULT * 60;
const MINUTO_VISTA_FIN_DEFAULT = HORA_VISTA_FIN_DEFAULT * 60;

function redondearAbajoAHora(minutos) {
  return Math.floor(minutos / 60) * 60;
}

function redondearArribaAHora(minutos) {
  return Math.ceil(minutos / 60) * 60;
}

function calcularRangoVistaHoras(actividades) {
  const rangos = actividades.map((actividad) => obtenerRangoActividad(actividad)).filter(Boolean);

  if (rangos.length === 0) {
    return {
      minutoInicio: MINUTO_VISTA_INICIO_DEFAULT,
      minutoFin: MINUTO_VISTA_FIN_DEFAULT,
    };
  }

  const minutoInicio = redondearAbajoAHora(Math.min(...rangos.map((rango) => rango.inicio)));
  const minutoFin = redondearArribaAHora(Math.max(...rangos.map((rango) => rango.fin)));

  return {
    minutoInicio,
    minutoFin: Math.max(minutoFin, minutoInicio + 60),
  };
}

function obtenerRangoActividadVisible(actividad, minutoInicioVista, minutoFinVista) {
  const rango = obtenerRangoActividad(actividad);
  if (!rango) return null;

  const inicio = Math.max(rango.inicio, minutoInicioVista);
  const fin = Math.min(rango.fin, minutoFinVista);
  if (fin <= inicio) return null;

  return { inicio, fin };
}

function agruparActividadesPorSolape(actividades) {
  const ordenadas = actividades
    .map((actividad) => ({
      actividad,
      rango: obtenerRangoActividad(actividad),
    }))
    .filter(({ rango }) => rango !== null)
    .sort((a, b) => a.rango.inicio - b.rango.inicio || a.rango.fin - b.rango.fin);

  const grupos = [];
  let grupoActual = [];
  let finGrupo = -1;

  ordenadas.forEach((entrada) => {
    if (grupoActual.length === 0 || entrada.rango.inicio < finGrupo) {
      grupoActual.push(entrada);
      finGrupo = Math.max(finGrupo, entrada.rango.fin);
      return;
    }

    grupos.push(grupoActual);
    grupoActual = [entrada];
    finGrupo = entrada.rango.fin;
  });

  if (grupoActual.length > 0) {
    grupos.push(grupoActual);
  }

  return grupos.map((grupo) => {
    const finalesPorColumna = [];

    grupo.forEach((entrada) => {
      const columnaLibre = finalesPorColumna.findIndex((finColumna) => finColumna <= entrada.rango.inicio);

      if (columnaLibre === -1) {
        finalesPorColumna.push(entrada.rango.fin);
        entrada.columna = finalesPorColumna.length - 1;
        return;
      }

      finalesPorColumna[columnaLibre] = entrada.rango.fin;
      entrada.columna = columnaLibre;
    });

    return {
      actividades: grupo.map(({ actividad, columna }) => ({
        ...actividad,
        columna,
      })),
      columnas: Math.max(1, finalesPorColumna.length),
    };
  });
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

function IconoExportarPDF() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M5 2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2V4h10V2H5z" />
      <path d="M15 6h2a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-2v-2h2V8h-1a1 1 0 0 1-1-1V6z" />
      <path d="M5 8h10v10H5V8zm2 2v6h2.5a2 2 0 0 0 0-4H9v-2H7zm2 4H9v-2h1a1 1 0 0 1 0 2z" />
    </svg>
  );
}

function IconoPantallaCompleta({ activa }) {
  return activa ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden="true">
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

function IconoSesion() {
  return (
    <span className="flex h-5 w-5 items-center justify-center text-[13px] font-black leading-none" aria-hidden="true">
      S
    </span>
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

function IconoVer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function textoCompeticion(competicion) {
  return String(competicion?.nombre || competicion?.equipo_fed || competicion?.equipo_interno || '').trim();
}

function IconoEditar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="m4 20 4.5-1 10-10a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0l-10 10L4 20Z" strokeLinejoin="round" />
      <path d="m13 6 5 5" strokeLinecap="round" />
    </svg>
  );
}

function IconoBorrar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" strokeLinejoin="round" />
      <path d="M7 7l1 13h8l1-13" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" strokeLinecap="round" />
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
  const sesionesMuestra = ACTIVIDADES_MUESTRA.map(([fechaTexto, hora, horaFin, equipo, tipo, titulo, instalacion], indice) => ({
    id: `muestra-${indice + 1}`,
    tipo,
    evento: tipo === 'partido' ? 'Partido' : 'Sesión',
    competicion: tipo === 'partido' ? 'Pretemporada' : 'Entrenamiento',
    titulo,
    equipo,
    local: tipo === 'partido' ? titulo.split(/\s+(?:vs|-)\s+/i)[0] : '',
    visitante: tipo === 'partido' ? titulo.split(/\s+(?:vs|-)\s+/i)[1] : '',
    rival: tipo === 'partido' ? titulo.split(/\s+(?:vs|-)\s+/i)[1] : '',
    ubicacion: instalacion,
    fecha: crearFechaCalendario(fechaTexto),
    hora,
    horaFin: horaFin || '',
    jornada: '',
    duracion: horaFin ? `${hora} - ${horaFin}` : '90 min',
  }));

  const jornadas = JORNADAS_ROMO.map(([fechaTexto, local, visitante], indice) => {
    const localInterno = reemplazarNombreRomoJuvenil(local);
    const visitanteInterno = reemplazarNombreRomoJuvenil(visitante);
    const esLocal = esLocalRomo(localInterno);
    const rival = esLocal ? visitanteInterno : localInterno;

    return {
      id: `romo-jornada-${indice + 1}`,
      tipo: 'partido',
      evento: 'Partido',
      competicion: 'Liga Nacional Juvenil',
      titulo: `Jornada ${indice + 1} · ${localInterno} - ${visitanteInterno}`,
      equipo: NOMBRE_INTERNO_ROMO_JUVENIL,
      local: localInterno,
      visitante: visitanteInterno,
      rival,
      jornada: indice + 1,
      ubicacion: esLocal ? 'GOBELA' : 'Pendiente de confirmar',
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

function normalizarActividadGuardada(actividad, clubPorDefecto = '') {
  if (!actividad) return null;

  const fechaGuardada = String(actividad.fecha || '').trim();
  const fechaTexto = fechaGuardada.slice(0, 10);
  const fecha = crearFechaActividad(fechaTexto, actividad.hora);
  const clubGuardado = textoLimpio(actividad.club);
  const clubInferido = resolverClaveClubEquipo(actividad.equipo || actividad.local || actividad.visitante || '');
  const club = resolverClaveClubEquipo(
    clubGuardado || (['ROMO', 'ARENAS'].includes(clubInferido) ? clubInferido : clubPorDefecto)
  );
  const tipo = textoLimpio(actividad.tipo).toLowerCase();
  const esLigaRomoJuvenil = esPartidoLigaRomoJuvenil(actividad);
  const equipo = esLigaRomoJuvenil
    ? NOMBRE_INTERNO_ROMO_JUVENIL
    : obtenerEquipoCanonico(actividad.equipo || '', club);
  const local = actividad.local
    ? esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.local) : obtenerEquipoCanonico(actividad.local, club)
    : '';
  const visitante = actividad.visitante
    ? esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.visitante) : obtenerEquipoCanonico(actividad.visitante, club)
    : '';
  const rival = actividad.rival
    ? esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.rival) : obtenerEquipoCanonico(actividad.rival, club)
    : '';
  const ubicacion = textoLimpio(actividad.ubicacion) || obtenerInstalacionPorDefecto(tipo, local);

  if (Number.isNaN(fecha.getTime())) return null;

  return {
    ...actividad,
    tipo,
    club,
    equipo,
    local,
    visitante,
    rival,
    titulo: esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.titulo) : actividad.titulo,
    ubicacion,
    fecha,
    hora: actividad.hora || '',
    horaFin: actividad.horaFin || actividad.hora_fin || '',
  };
}

function serializarActividadPersistible(actividad) {
  const tipo = textoLimpio(actividad.tipo).toLowerCase();
  const ubicacion = textoLimpio(actividad.ubicacion) || obtenerInstalacionPorDefecto(tipo, actividad.local);

  return {
    ...actividad,
    club: resolverClaveClubEquipo(
      textoLimpio(actividad.club) || resolverClaveClubEquipo(actividad.equipo || actividad.local || actividad.visitante || '')
    ),
    ubicacion,
    fecha: fechaClave(actividad.fecha),
    hora: actividad.hora || '',
    horaFin: actividad.horaFin || '',
  };
}

function fusionarActividades(remotas = [], locales = []) {
  const mapa = new Map();

  [...remotas, ...locales].forEach((actividad) => {
    const normalizada = normalizarActividadGuardada(actividad);
    if (!normalizada?.id || mapa.has(normalizada.id)) return;
    mapa.set(normalizada.id, normalizada);
  });

  return Array.from(mapa.values()).sort(ordenarActividades);
}

function cargarActividadesIniciales(clubPorDefecto = '') {
  const base = actividadesRomo();

  if (typeof window === 'undefined') return base;

  try {
    const guardadas = JSON.parse(window.localStorage.getItem(ACTIVIDADES_STORAGE_KEY) || 'null');
    if (!Array.isArray(guardadas) || guardadas.length === 0) return base;

    const normalizadas = guardadas.map((actividad) => normalizarActividadGuardada(actividad, clubPorDefecto)).filter(Boolean);
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
  const equipoCanonico = obtenerEquipoCanonico(actividad.equipo, actividad.club);
  const colorEquipo = obtenerColorEquipo(equipoCanonico);

  return (
    <div
      className={`group rounded-xl border transition hover:brightness-[0.99] ${compacta ? 'p-2' : 'p-3'}`}
      style={{ backgroundColor: colorEquipo.fondo, borderColor: colorEquipo.borde, color: colorEquipo.texto }}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorEquipo.acento }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{actividad.tipo === 'partido' ? tituloPartidoActividad(actividad) : actividad.titulo}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-club-black/65">{equipoCanonico}</p>
          <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-club-black/55 ${compacta ? 'leading-tight' : ''}`}>
            <span>{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
            {!compacta && (actividad.rival || actividad.visitante) && <span>vs {actividad.rival || actividad.visitante}</span>}
            {!compacta && (
              <span className="inline-flex items-center gap-1">
                <IconoUbicacion />
                {etiquetaInstalacionActividad(actividad)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Escudos publicados por Euskadifutbol para la competiciÃ³n 24057860.
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

const ESCUDOS_CLUBES_NORMALIZADOS = new Map(
  Object.entries(ESCUDOS_CLUBES).map(([nombre, escudo]) => [normalizarTextoBusqueda(nombre), escudo])
);

const ESCUDOS_CATALOGO = new Map(
  CLUBES_MAESTROS
    .filter((club) => club?.nombre && club?.escudo)
    .map((club) => [normalizarTextoBusqueda(club.nombre), club.escudo])
);

const ESCUDOS_CATALOGO_ENTRADAS = Array.from(ESCUDOS_CATALOGO.entries());

function variantesNombreClub(nombre) {
  const texto = String(nombre || '').trim();
  if (!texto) return [];

  return Array.from(
    new Set([
      texto,
      texto.split(/\s(?:\u00b7|\|)\s/)[0],
      texto.split(/\s(?:-|\u2013|\u2014)\s/)[0],
    ].map(normalizarTextoBusqueda).filter(Boolean))
  );
}

function escudoEquipo(nombre) {
  const claves = variantesNombreClub(nombre);
  for (const clave of claves) {
    const escudoOficial = ESCUDOS_CLUBES_NORMALIZADOS.get(clave);
    if (escudoOficial) return escudoOficial;

    const escudoCatalogo = ESCUDOS_CATALOGO.get(clave);
    if (escudoCatalogo) return escudoCatalogo;

    const primerToken = clave.split(' ')[0];
    if (primerToken) {
      const escudoCatalogoPorClub = ESCUDOS_CATALOGO_ENTRADAS.find(([nombreCatalogo]) => nombreCatalogo.split(' ')[0] === primerToken)?.[1];
      if (escudoCatalogoPorClub) return escudoCatalogoPorClub;
    }
  }

  return '/assets/escudo.png';
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

function EquipoPartido({ nombre, nombreMostrado, alineacion, compacta = false, detalle = false, tarjeta = false, color }) {
  const nombreVisible = nombreMostrado || compactarTextoCalendario(nombreCortoEquipo(nombre));

  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${
        alineacion === 'derecha' ? 'flex-row-reverse justify-start text-right' : 'text-left'
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/80 p-1.5 shadow-sm ${
          compacta ? 'h-7 w-7' : detalle ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-9 w-9 sm:h-10 sm:w-10'
        }`}
      >
        <img
          src={escudoEquipo(nombre)}
          alt={nombre ? `Escudo de ${nombre}` : 'Escudo'}
          className="h-full w-full object-contain"
          onError={(event) => {
            if (event.currentTarget.src.endsWith('/assets/escudo.png')) return;
            event.currentTarget.src = '/assets/escudo.png';
          }}
        />
      </div>

      <p className={`min-w-0 font-black text-pink-900 ${compacta ? 'truncate text-[9px]' : tarjeta ? 'line-clamp-2 overflow-hidden text-[10px] leading-tight sm:text-xs' : detalle ? 'line-clamp-2 overflow-hidden text-[10px] leading-tight sm:text-xs md:text-sm' : 'truncate text-sm'}`} style={color ? { color } : undefined} title={nombre}>
        {nombreVisible}
      </p>
    </div>
  );
}

function AccionesActividad({ actividad, abierta, cerrada, onVer, onEditar, onEliminar, onCerrar }) {
  if (!onVer && !onEditar && !onEliminar) return null;

  return (
    <div
      className={`actividades-acciones-actividad absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1 shadow-lg shadow-slate-900/10 backdrop-blur-sm transition-all duration-150 ${
        abierta
          ? 'opacity-100 ring-2 ring-club-red/15'
          : cerrada
            ? 'pointer-events-none translate-y-1 opacity-0'
            : 'pointer-events-none translate-y-1 opacity-0 group-hover/card:pointer-events-auto group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100'
      }`}
      aria-hidden={!abierta || cerrada}
    >
      {onVer && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onVer(actividad);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-club-black/5 text-club-black/70 transition hover:bg-club-black hover:text-white"
          aria-label="Ver actividad"
          title="Ver actividad"
        >
          <IconoVer />
        </button>
      )}
      {onEditar && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEditar(actividad);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-club-red shadow-sm transition hover:bg-club-red hover:text-white"
          aria-label="Editar actividad"
          title="Editar actividad"
        >
          <IconoEditar />
        </button>
      )}
      {onEliminar && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEliminar(actividad);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm transition hover:bg-rose-500 hover:text-white"
          aria-label="Eliminar actividad"
          title="Eliminar actividad"
        >
          <IconoBorrar />
        </button>
      )}
      {onCerrar && (
        <button
          type="button"
          onPointerDown={(event) => {
            // Cerramos al iniciar la pulsación para que el hover no pueda
            // volver a mostrar el panel antes de que termine el click.
            event.preventDefault();
            event.stopPropagation();
            onCerrar();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:bg-slate-700 hover:text-white"
          aria-label="Cerrar acciones"
          title="Cerrar acciones"
        >
          <IconoCerrar />
        </button>
      )}
    </div>
  );
}

function ActividadCalendario({ actividad, abierta, accionesCerradas, onVer, onEditar, onEliminar, onSeleccionar, equipoVisible, onToggleAcciones, onCerrarAcciones, onReactivarAcciones, mapaAbreviaturasEquipos, compacta = false }) {
  const { club: clubContexto } = useClub();
  const clubPreferido = actividad.club || clubContexto;
  const equipoCanonico = obtenerEquipoCanonico(actividad.equipo, clubPreferido);

  if (actividad.tipo === 'partido') {
    const partido = descomponerPartidoActividad(actividad);
    const localNombre = partido.local || actividad.local || equipoCanonico;
    const visitanteNombre = partido.visitante || actividad.visitante || actividad.rival;
    const localVisible = nombrePartidoCalendario(actividad, localNombre, clubPreferido);
    const visitanteVisible = nombrePartidoCalendario(actividad, visitanteNombre, clubPreferido);
    const tituloVisible = partido.titulo || actividad.titulo || 'Partido';
    const colorEquipo = obtenerColorEquipo(equipoCanonico);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onSeleccionar?.();
        }}
        onMouseEnter={() => onReactivarAcciones?.(actividad)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSeleccionar?.();
          }
        }}
        aria-expanded={abierta}
        className={`actividades-calendario-item group/card relative cursor-pointer rounded-xl border-2 shadow-sm transition hover:brightness-[0.99] hover:shadow-md ${
          compacta ? 'min-h-[64px] p-2 pr-16' : 'p-2 pr-16 sm:p-2.5'
        }`}
        style={{ backgroundColor: colorEquipo.fondo, borderColor: colorEquipo.borde, color: colorEquipo.texto }}
      >
        <AccionesActividad
          actividad={actividad}
          abierta={abierta}
          cerrada={accionesCerradas}
          onVer={onVer}
          onEditar={onEditar}
          onEliminar={onEliminar}
          onCerrar={() => onCerrarAcciones?.(actividad)}
        />
        {compacta ? (
          <div className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/75 px-1.5 py-0.5 text-[8px] font-black">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-club-red text-[8px] leading-none text-white" aria-hidden="true">
                  P
                </span>
                <span>{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
              </div>
              <span className="shrink-0 rounded-md bg-white/75 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide" title={etiquetaInstalacionActividad(actividad, 'GOBELA')}>
                {etiquetaInstalacionActividad(actividad, 'GOBELA')}
              </span>
            </div>
            <p className="min-w-0 text-[9px] font-black uppercase tracking-wide leading-tight line-clamp-2" title={tituloVisible}>
              {tituloVisible}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/75 px-2 py-1 text-xs font-black sm:text-sm">
                <IconoReloj />
                <span>{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                {etiquetaInstalacionActividad(actividad, 'GOBELA')}
              </span>
            </div>

            <div className="mt-1.5 grid items-center grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] gap-1.5">
              <EquipoPartido nombre={localNombre} nombreMostrado={localVisible} detalle color={colorEquipo.texto} />
              <span className="flex h-7 w-7 items-center justify-center rounded-full px-1 text-[8px] font-black text-white shadow-sm" style={{ backgroundColor: colorEquipo.acento }}>
                VS
              </span>
              <EquipoPartido nombre={visitanteNombre} nombreMostrado={visitanteVisible} alineacion="derecha" detalle color={colorEquipo.texto} />
            </div>


          </>
        )}
      </div>
    );
  }

  const colorEquipo = obtenerColorEquipo(equipoCanonico);
  const abreviaturaEquipoVisible = abreviaturaEquipoCalendario(equipoCanonico, clubPreferido) || equipoVisible;
  const nombreEquipoVisible = nombreEquipoLegible(equipoCanonico, clubPreferido);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onSeleccionar?.();
      }}
      onMouseEnter={() => onReactivarAcciones?.(actividad)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSeleccionar?.();
        }
      }}
      aria-expanded={abierta}
      className={`actividades-calendario-item group/card relative flex min-w-0 min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 transition hover:brightness-[0.99] hover:shadow-md ${compacta ? 'px-2 py-1.5 pr-16' : 'px-2.5 py-2 pr-16'}`}
      style={{ backgroundColor: colorEquipo.fondo, borderColor: colorEquipo.borde, color: colorEquipo.texto }}
    >
      <AccionesActividad
        actividad={actividad}
        abierta={abierta}
        cerrada={accionesCerradas}
        onVer={onVer}
        onEditar={onEditar}
        onEliminar={onEliminar}
        onCerrar={() => onCerrarAcciones?.(actividad)}
      />
      <span className={`flex shrink-0 items-center justify-center rounded-md font-black shadow-sm ${compacta ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-[11px]'}`} style={{ backgroundColor: colorEquipo.fondoAcento }}>
        <IconoSesion />
      </span>
      {compacta ? (
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="inline-flex min-w-0 shrink items-center gap-1 rounded-md bg-white/75 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide">
            <IconoReloj />
            <span>{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
            </span>
            <span className="min-w-0 truncate rounded-md bg-white/75 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide" title={etiquetaInstalacionActividad(actividad, 'Pendiente')}>
              {etiquetaInstalacionActividad(actividad, 'Pendiente')}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded-md bg-white/75 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide" title={abreviaturaEquipoVisible}>
              {abreviaturaEquipoVisible}
            </span>
            <p className="min-w-0 truncate text-[9px] font-bold opacity-80" title={nombreEquipoVisible}>
              {nombreEquipoVisible}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-x-1.5">
            <p className="min-w-0 flex-1 truncate text-xs font-black leading-tight sm:text-sm" title={equipoCanonico || equipoVisible}>
              {formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}
            </p>
            <span className="shrink-0 rounded-full bg-white/75 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide">
              {etiquetaInstalacionActividad(actividad, 'Pendiente')}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] sm:text-xs">
            <span className="shrink-0 rounded-full bg-white/75 px-2 py-0.5 font-black uppercase tracking-wide" title={abreviaturaEquipoVisible}>
              {abreviaturaEquipoVisible}
            </span>
            <span className="min-w-0 truncate font-black uppercase tracking-wide" title={nombreEquipoVisible}>
              {nombreEquipoVisible}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalDetalleActividad({ actividad, onClose, onEditar, onEliminar }) {
  if (!actividad) return null;

  const esPartido = actividad.tipo === 'partido';
  const fechaTexto = actividad.fecha.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="actividad-detalle-titulo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/25"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-3 px-5 py-4 text-white ${esPartido ? 'bg-pink-600' : 'bg-emerald-600'}`}>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/75">Vista rápida</p>
            <h2 id="actividad-detalle-titulo" className="mt-1 truncate text-lg font-black">
              {actividad.tipo === 'partido' ? tituloPartidoActividad(actividad) : actividad.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
            aria-label="Cerrar detalle"
            title="Cerrar detalle"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${esPartido ? 'bg-pink-100 text-pink-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {esPartido ? <IconoBalon /> : <IconoSesion />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-club-black">{fechaTexto}</p>
              <p className="text-sm text-club-black/60">{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Equipo</p>
              <p className="mt-1 font-bold text-club-black">{obtenerEquipoCanonico(actividad.equipo, actividad.club) || 'Equipo pendiente'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Lugar</p>
              <p className="mt-1 font-bold text-club-black">{etiquetaInstalacionActividad(actividad, 'Instalación pendiente')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Espacio</p>
              <p className="mt-1 font-bold text-club-black">{actividad.espacio || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Tipo</p>
              <p className="mt-1 font-bold text-club-black">{esPartido ? 'Partido' : 'Sesión'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Competición</p>
              <p className="mt-1 font-bold text-club-black">{actividad.competicion || '-'}</p>
            </div>
          </div>

          {esPartido ? (
            <div className="rounded-2xl border border-pink-200 bg-pink-50 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-pink-500">Local</p>
                  <EquipoPartido
                    nombre={actividad.local || actividad.equipo || 'Equipo local'}
                    nombreMostrado={actividad.local || actividad.equipo || 'Equipo local'}
                    detalle
                  />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-club-red text-xs font-black text-white">VS</span>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-pink-500">Visitante</p>
                  <EquipoPartido
                    nombre={descomponerPartidoActividad(actividad).visitante || actividad.visitante || actividad.rival || 'Equipo visitante'}
                    nombreMostrado={descomponerPartidoActividad(actividad).visitante || actividad.visitante || actividad.rival || 'Equipo visitante'}
                    alineacion="derecha"
                    detalle
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-500">Actividad</p>
              <p className="mt-1 font-black text-emerald-900">{actividad.titulo || 'Sesión'}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onVer?.(actividad)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-club-black transition hover:border-club-red/30 hover:text-club-red"
            >
              <IconoVer />
              Ver
            </button>
            <button
              type="button"
              onClick={() => onEditar?.(actividad)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-club-red px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white transition hover:bg-club-redDark"
            >
              <IconoEditar />
              Editar
            </button>
            <button
              type="button"
              onClick={() => onEliminar?.(actividad)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
            >
              <IconoBorrar />
              Borrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActividadSemana({ actividad, abierta, accionesCerradas, onToggleAcciones, onCerrarAcciones, onReactivarAcciones, onEditar, onEliminar }) {
  const esPartido = actividad.tipo === 'partido';
  const partido = descomponerPartidoActividad(actividad);
  const local = partido.local || actividad.local || actividad.equipo || 'Pendiente';
  const visitante = partido.visitante || actividad.visitante || actividad.rival || 'Pendiente';
  const equipoSesion = actividad.equipo || actividad.titulo || 'Sesión';

  return (
    <article
      onClick={() => onToggleAcciones?.(actividad)}
      onMouseEnter={() => onReactivarAcciones?.(actividad)}
      className={`group/card relative cursor-pointer overflow-hidden rounded-3xl border-2 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(15,23,42,0.08)] ${
        esPartido
          ? 'border-pink-300 bg-gradient-to-br from-pink-50 via-white to-pink-50'
          : 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50'
      }`}
    >
      <AccionesActividad
        actividad={actividad}
        abierta={abierta}
        cerrada={accionesCerradas}
        onEditar={onEditar}
        onEliminar={onEliminar}
        onCerrar={() => onCerrarAcciones?.(actividad)}
      />
      <div className="flex items-start gap-3 pr-16">
        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${esPartido ? 'bg-club-red text-white' : 'bg-emerald-500 text-white'}`}>
          <IconoReloj />
          {formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          {esPartido ? (
            <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-2">
              <EquipoPartido nombre={local} />
              <span className="flex h-10 items-center justify-center rounded-full bg-club-red px-2 text-xs font-black text-white shadow-sm">
                VS
              </span>
              <EquipoPartido nombre={visitante} alineacion="derecha" />
            </div>
          ) : (
            <p className="truncate text-base font-black leading-tight text-club-black" title={equipoSesion}>
              {equipoSesion}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function SemanaView({
  actividades,
  semana,
  onChange,
  onHoy,
  modo = 'detalle',
  actividadAccionesAbiertasId,
  actividadAccionesCerradasId,
  onToggleAccionesActividad,
  onCerrarAccionesActividad,
  onReactivarAccionesActividad,
  onVer,
  onEditar,
  onEliminar,
  onCrear,
  mapaAbreviaturasEquipos,
}) {
  const dias = diasDeSemana(semana);
  const actividadesSemana = useMemo(
    () =>
      dias.map((dia) => {
        const clave = fechaClave(dia);
        const delDia = actividades.filter((actividad) => fechaClave(actividad.fecha) === clave).sort(ordenarActividades);
        return { dia, clave, actividades: delDia };
      }),
    [actividades, dias]
  );
  const totalEventos = actividadesSemana.reduce((total, item) => total + item.actividades.length, 0);
  const semanaSinEventos = totalEventos === 0;
  const esMinimal = modo === 'minimal';
  const [fechaMenuCreacion, setFechaMenuCreacion] = useState(null);

  if (!esMinimal) {
    return (
      <div className="actividades-calendario overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <NavegacionSemana semana={semana} onChange={onChange} onHoy={onHoy} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-club-red/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-club-red">
              Vista semanal detallada
            </span>
            <span className="text-xs font-bold text-slate-500">{totalEventos} eventos visibles</span>
          </div>
          <span className="text-xs font-semibold text-slate-400">Todos los eventos de la semana, mostrados en detalle</span>
        </div>
        <div className="actividades-calendario-weekdays overflow-x-auto border-b border-gray-100 bg-slate-50/80">
          <div className="actividades-calendario-weekdays-grid grid min-w-[1050px] grid-cols-7">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia} className="px-1 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-club-black/45 sm:text-xs">
                {dia}
              </div>
            ))}
          </div>
        </div>
        <div className="actividades-calendario-body overflow-x-auto bg-slate-50/70">
          <div className="actividades-calendario-grid grid min-w-[1050px] grid-cols-7 gap-3 p-3 sm:gap-4 sm:p-4">
            {actividadesSemana.map(({ dia, clave, actividades: actividadesDia }) => {
              const esHoy = clave === fechaClave(new Date());

              return (
                <div
                  key={clave}
                  className={`actividades-calendario-day group relative overflow-hidden rounded-2xl border p-2.5 text-left transition sm:p-3 min-h-[176px] ${esHoy ? 'border-club-red/30 bg-club-red/5' : 'border-slate-200 bg-white'}`}
                >
                  <button
                    type="button"
                    onClick={() => setFechaMenuCreacion((actual) => (actual === clave ? null : clave))}
                    className="actividades-calendario-add absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-club-red text-white shadow-md shadow-club-red/15 transition hover:bg-club-redDark focus:outline-none focus:ring-4 focus:ring-club-red/15"
                    aria-label={`Añadir actividad el ${dia.getDate()} de ${MESES[dia.getMonth()]}`}
                  >
                    <IconoMas />
                  </button>
                  {fechaMenuCreacion === clave && (
                    <div className="actividades-calendario-menu absolute left-2 top-14 z-20 flex min-w-[118px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setFechaMenuCreacion(null);
                          onCrear?.('sesion', clave);
                        }}
                        className="rounded-lg bg-emerald-50 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                      >
                        SESIÓN
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFechaMenuCreacion(null);
                          onCrear?.('partido', clave);
                        }}
                        className="rounded-lg bg-club-red px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-white transition hover:bg-club-redDark"
                      >
                        PARTIDO
                      </button>
                    </div>
                  )}
                  <span className={`actividades-calendario-day-number absolute right-3 top-3 text-sm font-black ${esHoy ? 'text-club-red' : 'text-club-black/70'}`}>
                    {dia.getDate()}
                  </span>
                  <div className="actividades-calendario-day-content flex flex-col justify-start gap-1 pt-12 min-h-0">
                    <div className="space-y-1">
                      {actividadesDia.map((actividad) => (
                        <ActividadCalendario
                          key={actividad.id}
                          actividad={actividad}
                          abierta={actividadAccionesAbiertasId === actividad.id}
                          accionesCerradas={actividadAccionesCerradasId === actividad.id}
                          onVer={onVer}
                          onEditar={onEditar}
                          onEliminar={onEliminar}
                          onSeleccionar={() => {
                            setFechaMenuCreacion(null);
                            onToggleAccionesActividad?.(actividad);
                          }}
                          onToggleAcciones={onToggleAccionesActividad}
                          onCerrarAcciones={onCerrarAccionesActividad}
                          onReactivarAcciones={onReactivarAccionesActividad}
                          mapaAbreviaturasEquipos={mapaAbreviaturasEquipos}
                          equipoVisible={etiquetaEquipoCalendario(actividad.equipo, mapaAbreviaturasEquipos)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="actividades-calendario-leyenda flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-xs font-semibold text-club-black/55 sm:px-5">
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sesión</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-club-red" /> Partido</span>
          <span className="text-club-black/35">Selecciona una actividad para ver el detalle</span>
        </div>
      </div>
    );
  }

  return (
    <div className="actividades-semana overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <NavegacionSemana semana={semana} onChange={onChange} onHoy={onHoy} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-club-red/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-club-red">
            {esMinimal ? 'Vista semanal minimal' : 'Vista semanal detallada'}
          </span>
          <span className="text-xs font-bold text-slate-500">{totalEventos} eventos visibles</span>
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {esMinimal ? 'Todos los eventos de la semana, mostrados de forma compacta' : 'Todos los eventos de la semana, mostrados en tarjetas grandes'}
        </span>
      </div>
      <div className="overflow-x-auto bg-slate-50/70">
        <div className="actividades-semana-grid grid min-w-[1480px] grid-cols-7 gap-4 p-4">
          {actividadesSemana.map(({ dia, clave, actividades: actividadesDia }) => {
            const esHoy = clave === fechaClave(new Date());

            return (
              <section
                key={clave}
                className={`flex ${esMinimal ? 'min-h-[176px] rounded-2xl border p-2.5 sm:p-3' : `${semanaSinEventos ? 'min-h-0' : 'min-h-[520px]'} rounded-[28px] border p-4`} flex-col overflow-hidden ${
                  esHoy ? 'border-club-red/30 bg-club-red/5' : 'border-slate-200 bg-white'
                }`}
              >
                <header className={`flex items-center justify-between gap-3 rounded-2xl bg-slate-50 ${esMinimal ? 'px-3 py-2' : 'px-4 py-4'}`}>
                  <div className={esMinimal ? 'flex items-baseline gap-2' : ''}>
                    <p className={`text-[9px] font-extrabold uppercase tracking-[0.14em] ${esHoy ? 'text-club-red' : 'text-slate-400'}`}>
                      {dia.toLocaleDateString('es-ES', { weekday: 'long' })}
                    </p>
                    <h3 className={`${esMinimal ? 'text-lg' : 'mt-1 text-xl sm:text-2xl'} font-black capitalize leading-none text-club-black`}>
                      {dia.getDate()} {MESES[dia.getMonth()]}
                    </h3>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFechaMenuCreacion((actual) => (actual === clave ? null : clave));
                      }}
                      className={`inline-flex ${esMinimal ? 'h-9 w-9' : 'h-12 w-12'} items-center justify-center rounded-full bg-club-red text-white shadow-sm shadow-club-red/15 transition hover:scale-105 hover:bg-club-redDark focus:outline-none focus:ring-4 focus:ring-club-red/20`}
                      aria-label={`Añadir actividad el ${dia.getDate()} de ${MESES[dia.getMonth()]}`}
                    >
                      <IconoMas />
                    </button>
                    {fechaMenuCreacion === clave && (
                      <div className="absolute right-0 top-12 z-20 flex min-w-[118px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setFechaMenuCreacion(null);
                            onCrear?.('sesion', clave);
                          }}
                          className="rounded-lg bg-emerald-50 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                        >
                          SESIÓN
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFechaMenuCreacion(null);
                            onCrear?.('partido', clave);
                          }}
                          className="rounded-lg bg-club-red px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-white transition hover:bg-club-redDark"
                        >
                          PARTIDO
                        </button>
                      </div>
                    )}
                  </div>
                </header>

                <div className={`flex flex-col gap-1.5 ${esMinimal ? 'mt-3 min-h-[148px]' : semanaSinEventos ? 'mt-3' : 'mt-4 flex-1'}`}>
                  {actividadesDia.length > 0 ? (
                    actividadesDia.map((actividad) => (
                      esMinimal ? (
                        <ActividadCalendario
                          key={actividad.id}
                          actividad={actividad}
                          abierta={actividadAccionesAbiertasId === actividad.id}
                          accionesCerradas={actividadAccionesCerradasId === actividad.id}
                          onVer={onVer}
                          onEditar={onEditar}
                          onEliminar={onEliminar}
                          onSeleccionar={() => setFechaMenuCreacion(null)}
                          onToggleAcciones={onToggleAccionesActividad}
                          onCerrarAcciones={onCerrarAccionesActividad}
                          onReactivarAcciones={onReactivarAccionesActividad}
                          mapaAbreviaturasEquipos={mapaAbreviaturasEquipos}
                          compacta
                        />
                      ) : (
                        <ActividadSemana
                          key={actividad.id}
                          actividad={actividad}
                          abierta={actividadAccionesAbiertasId === actividad.id}
                          accionesCerradas={actividadAccionesCerradasId === actividad.id}
                          onToggleAcciones={onToggleAccionesActividad}
                          onCerrarAcciones={onCerrarAccionesActividad}
                          onReactivarAcciones={onReactivarAccionesActividad}
                          onEditar={onEditar}
                          onEliminar={onEliminar}
                        />
                      )
                    ))
                  ) : (
                    !esMinimal && (
                      <div className={`${semanaSinEventos ? 'px-1 pb-1 text-center' : 'flex flex-1 items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50/70 p-6 text-center'}`}>
                        {semanaSinEventos ? (
                          <p className="text-xs font-bold text-slate-400">Sin eventos</p>
                        ) : (
                          <div>
                            <p className="text-base font-black text-slate-500">Sin eventos</p>
                            <p className="mt-1 text-sm font-medium text-slate-400">Esta jornada no tiene actividades programadas.</p>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
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

function FiltroClub({ valor, onChange }) {
  const clubes = [
    { clave: 'ROMO', etiqueta: 'ROMO FC' },
    { clave: 'ARENAS', etiqueta: 'ARENAS CLUB' },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-club-black/50">Club</span>
      <div className="flex h-[42px] min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-sm">
        {clubes.map((club) => {
          const activo = valor === club.clave;

          return (
            <button
              key={club.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(activo ? 'todos' : club.clave)}
              className={`min-w-0 flex-1 rounded-md px-2 text-xs font-extrabold uppercase tracking-wide transition sm:text-sm ${
                activo
                  ? 'bg-club-red text-white shadow-sm'
                  : 'text-club-black/60 hover:bg-white hover:text-club-black'
              }`}
            >
              <span className="block truncate">{club.etiqueta}</span>
            </button>
          );
        })}
      </div>
    </div>
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

function EntradaFormulario({ value, onChange, type = 'text', placeholder, required = false, step }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      step={step}
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-club-black outline-none transition placeholder:text-slate-400 focus:border-club-red focus:ring-2 focus:ring-club-red/15"
    />
  );
}

function SelectorFormulario({ value, onChange, opciones = [], placeholder, required = false, formatearOpcion }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-club-black outline-none transition focus:border-club-red focus:ring-2 focus:ring-club-red/15"
    >
      <option value="">{placeholder}</option>
      {opciones.map((opcion) => (
        <option key={opcion} value={opcion}>
          {formatearOpcion ? formatearOpcion(opcion) : opcion}
        </option>
      ))}
    </select>
  );
}

function SelectorBuscadorClubEquipo({ value, onChange, placeholder, opciones = CATALOGO_LOCAL_VISITANTE, alineacion = 'left' }) {
  const contenedorRef = useRef(null);
  const botonRef = useRef(null);
  const menuRef = useRef(null);
  const buscadorRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [fase, setFase] = useState('club');
  const [busqueda, setBusqueda] = useState('');
  const [clubSeleccionado, setClubSeleccionado] = useState('');
  const [posicionMenu, setPosicionMenu] = useState(null);

  const seleccionado = useMemo(() => obtenerSeleccionClubEquipo(value, opciones), [opciones, value]);
  const busquedaNormalizada = useMemo(() => normalizarTextoBusqueda(busqueda), [busqueda]);
  const clubActual = useMemo(
    () => opciones.find((club) => club.clave === clubSeleccionado) || null,
    [clubSeleccionado, opciones]
  );

  const clubesFiltrados = useMemo(
    () =>
      opciones.filter(
        (club) =>
          !busquedaNormalizada ||
          normalizarTextoBusqueda(`${club.etiqueta} ${club.clave}`).includes(busquedaNormalizada)
      ),
    [busquedaNormalizada, opciones]
  );

  const equiposFiltrados = useMemo(() => {
    if (!clubActual) return [];

    return clubActual.equipos.filter(
      (equipo) =>
        !busquedaNormalizada ||
        normalizarTextoBusqueda(`${equipo.equipo} ${equipo.abreviatura}`).includes(busquedaNormalizada)
    );
  }, [busquedaNormalizada, clubActual]);

  useEffect(() => {
    if (!abierto) return;

    const cerrar = (event) => {
      if (!contenedorRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setAbierto(false);
      }
    };

    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);

    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('touchstart', cerrar);
    };
  }, [abierto]);

  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return undefined;

    const actualizarPosicion = () => {
      const rect = botonRef.current.getBoundingClientRect();
      const margen = 16;
      const ancho = Math.min(420, Math.max(rect.width, 320), window.innerWidth - margen * 2);
      const izquierdaPreferida = alineacion === 'right' ? rect.right - ancho : rect.left;
      const izquierda = Math.max(margen, Math.min(izquierdaPreferida, window.innerWidth - ancho - margen));
      const espacioAbajo = window.innerHeight - rect.bottom - margen;
      const espacioArriba = rect.top - margen;
      const alturaMinima = 260;
      const abrirArriba = espacioAbajo < alturaMinima && espacioArriba > espacioAbajo;
      const alturaDisponible = Math.max(220, abrirArriba ? espacioArriba : espacioAbajo);
      const alto = Math.min(520, alturaDisponible);
      const top = abrirArriba ? Math.max(margen, rect.top - alto - 8) : rect.bottom + 8;

      setPosicionMenu({ left: izquierda, top, width: ancho, maxHeight: alto });
    };

    actualizarPosicion();
    window.addEventListener('resize', actualizarPosicion);
    window.addEventListener('scroll', actualizarPosicion, true);

    return () => {
      window.removeEventListener('resize', actualizarPosicion);
      window.removeEventListener('scroll', actualizarPosicion, true);
    };
  }, [abierto, alineacion]);

  useEffect(() => {
    if (!abierto) return;
    const timer = window.setTimeout(() => buscadorRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [abierto, fase, posicionMenu]);

  useEffect(() => {
    if (!abierto) {
      setBusqueda('');
      setFase('club');
      setClubSeleccionado('');
      setPosicionMenu(null);
    }
  }, [abierto]);

  const abrirSelector = () => {
    setAbierto((actual) => {
      const siguiente = !actual;
      if (siguiente) {
        setFase('club');
        setBusqueda('');
        setClubSeleccionado(seleccionado?.clubClave || '');
      }
      return siguiente;
    });
  };

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        ref={botonRef}
        onClick={abrirSelector}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-base font-bold text-club-black outline-none transition hover:border-club-red focus:border-club-red focus:ring-2 focus:ring-club-red/15"
      >
        <span className={`truncate ${seleccionado ? '' : 'text-slate-400'}`}>{seleccionado?.valor || value || placeholder}</span>
        <span className="shrink-0 text-slate-400">{'\u2304'}</span>
      </button>

      {abierto && posicionMenu && typeof document !== 'undefined' ? createPortal(
        <div
          ref={menuRef}
          style={{
            left: posicionMenu.left,
            top: posicionMenu.top,
            width: posicionMenu.width,
            maxHeight: posicionMenu.maxHeight,
          }}
          className="fixed z-[70] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-100 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                {fase === 'club' ? 'Paso 1: club' : 'Paso 2: equipo'}
              </p>
              {fase === 'equipo' ? (
                <button
                  type="button"
                  onClick={() => {
                    setFase('club');
                    setBusqueda('');
                  }}
                  className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-club-red transition hover:text-club-redDark"
                >
                  Cambiar club
                </button>
              ) : null}
            </div>

            {fase === 'equipo' && clubActual ? (
              <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-club-black">
                {clubActual.etiqueta}
              </div>
            ) : null}

            <input
              ref={buscadorRef}
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setAbierto(false);
                }
              }}
              placeholder={fase === 'club' ? 'Buscar club' : 'Buscar equipo'}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-club-black outline-none transition placeholder:text-slate-400 focus:border-club-red focus:ring-2 focus:ring-club-red/15"
            />
          </div>

          <div className="overflow-y-auto p-2" style={{ maxHeight: Math.max(124, posicionMenu.maxHeight - 104) }}>
            {fase === 'club' ? (
              clubesFiltrados.length === 0 ? (
                <p className="px-3 py-4 text-sm font-semibold text-slate-400">No hay resultados.</p>
              ) : (
                clubesFiltrados.map((club) => (
                  <button
                    key={club.clave}
                    type="button"
                    onClick={() => {
                      setClubSeleccionado(club.clave);
                      setFase('equipo');
                      setBusqueda('');
                    }}
                    className={`mb-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                      clubSeleccionado === club.clave ? 'bg-club-red text-white' : 'bg-white text-club-black hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{club.etiqueta}</span>
                      <span className={`block truncate text-[11px] font-semibold ${clubSeleccionado === club.clave ? 'text-white/75' : 'text-slate-400'}`}>
                        {club.equipos.length > 0 ? 'Selecciona luego su equipo' : 'Sin equipos registrados'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                        clubSeleccionado === club.clave ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {club.clave}
                    </span>
                  </button>
                ))
              )
            ) : !clubActual ? (
              <p className="px-3 py-4 text-sm font-semibold text-slate-400">Elige primero un club.</p>
            ) : equiposFiltrados.length === 0 ? (
              <p className="px-3 py-4 text-sm font-semibold text-slate-400">No hay resultados.</p>
            ) : (
              equiposFiltrados.map((opcion) => {
                const estaSeleccionado = opcion.valor === value;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    onClick={() => {
                      onChange(opcion.valor);
                      setAbierto(false);
                      setBusqueda('');
                    }}
                    className={`mb-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      estaSeleccionado ? 'bg-club-red text-white' : 'bg-white text-club-black hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{opcion.equipo}</span>
                      <span className={`block truncate text-[11px] font-semibold ${estaSeleccionado ? 'text-white/75' : 'text-slate-400'}`}>
                        {opcion.club}
                      </span>
                    </span>
                    {opcion.abreviatura ? (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                          estaSeleccionado ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {opcion.abreviatura}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function ModalCrearActividad({ tipo, formulario, onChange, onClose, onSubmit, modo = 'crear', clubOpciones = [], equipoOpciones = [], competicionOpciones = [], catalogoLocalVisitante = CATALOGO_LOCAL_VISITANTE }) {
  if (!tipo) return null;

  const esPartido = tipo === 'partido';
  const esEdicion = modo === 'editar';

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-actividad">
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3 text-club-red">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-club-red/10">
              {esPartido ? <IconoBalon /> : <IconoSesion />}
            </span>
            <h2 id="titulo-actividad" className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
              {esEdicion ? 'Editar' : esPartido ? 'Nuevo' : 'Nueva'} {esPartido ? 'partido' : 'sesión'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-club-black" aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(100vh-170px)] overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoFormulario etiqueta="Fecha">
              <EntradaFormulario type="date" value={formulario.fecha} onChange={(value) => onChange('fecha', value)} required />
            </CampoFormulario>
            <CampoFormulario etiqueta="Desde">
              <EntradaFormulario type="time" step={60} value={formulario.hora} onChange={(value) => onChange('hora', value)} />
            </CampoFormulario>
            <CampoFormulario etiqueta="Hasta">
              <EntradaFormulario type="time" step={60} value={formulario.horaFin} onChange={(value) => onChange('horaFin', value)} />
            </CampoFormulario>

            {esPartido ? (
              <>
                <CampoFormulario etiqueta="Competición" className="sm:col-span-2">
                  <SelectorFormulario
                    value={formulario.competicion}
                    onChange={(value) => onChange('competicion', value)}
                    opciones={competicionOpciones}
                    placeholder="Selecciona una competición"
                    required
                  />
                </CampoFormulario>
                <CampoFormulario etiqueta="Club">
                  <SelectorFormulario value={formulario.club} onChange={(value) => onChange('club', value)} opciones={clubOpciones} placeholder="Selecciona un club" formatearOpcion={(valor) => valor === 'ARENAS' ? 'ARENAS CLUB' : 'ROMO FC'} required />
                </CampoFormulario>
                <CampoFormulario etiqueta="Mi equipo">
                  <SelectorFormulario value={formulario.equipo} onChange={(value) => onChange('equipo', value)} opciones={equipoOpciones} placeholder="Selecciona un equipo" formatearOpcion={etiquetaEquipoSelector} required />
                </CampoFormulario>
                <div className="grid gap-4 sm:col-span-3 sm:grid-cols-2">
                  <CampoFormulario etiqueta="Local">
                    <SelectorBuscadorClubEquipo value={formulario.local} onChange={(value) => onChange('local', value)} placeholder="Busca y selecciona local" opciones={catalogoLocalVisitante} alineacion="left" />
                  </CampoFormulario>
                  <CampoFormulario etiqueta="Visitante">
                    <SelectorBuscadorClubEquipo value={formulario.visitante} onChange={(value) => onChange('visitante', value)} placeholder="Busca y selecciona visitante" opciones={catalogoLocalVisitante} alineacion="right" />
                  </CampoFormulario>
                </div>
              </>
            ) : (
              <>
                <CampoFormulario etiqueta="Club">
                  <SelectorFormulario value={formulario.club} onChange={(value) => onChange('club', value)} opciones={clubOpciones} placeholder="Selecciona un club" formatearOpcion={(valor) => valor === 'ARENAS' ? 'ARENAS CLUB' : 'ROMO FC'} required />
                </CampoFormulario>
                <CampoFormulario etiqueta="Mi equipo">
                  <SelectorFormulario value={formulario.equipo} onChange={(value) => onChange('equipo', value)} opciones={equipoOpciones} placeholder="Selecciona un equipo" formatearOpcion={etiquetaEquipoSelector} required />
                </CampoFormulario>
              </>
            )}

            <CampoFormulario etiqueta="Instalación" className="sm:col-span-3">
              <SelectorFormulario value={formulario.instalacion} onChange={(value) => onChange('instalacion', value)} opciones={INSTALACIONES_ROMO} placeholder="Selecciona instalación" required />
            </CampoFormulario>
            <CampoFormulario etiqueta="Espacio" className="sm:col-span-3">
              <SelectorFormulario value={formulario.espacio} onChange={(value) => onChange('espacio', value)} opciones={ESPACIOS_ACTIVIDAD} placeholder="Selecciona espacio" />
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

function IconoVistaSemana() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v16M16 4v16" />
    </svg>
  );
}

function VistaSelector({ vista, onChange }) {
  const opciones = [
    ['semana', 'Semana', <IconoVistaSemana key="semana" />],
    ['calendario', 'Mes', <IconoCalendario key="calendario" />],
    ['equipos', 'Equipos', <IconoEquipos key="equipos" />],
    ['horas', 'Horas', <IconoVistaHoras key="horas" />],
    ['tabla', 'Tabla', <IconoTabla key="tabla" />],
  ];

  return (
    <div className="actividades-vista-selector inline-flex w-full flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-auto" role="tablist" aria-label="Vistas de actividades">
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

function SelectorModoCalendario({ modo, onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Densidad del calendario">
      {[
        ['minimal', 'MINIMAL'],
        ['detalle', 'DETALLE'],
      ].map(([valor, etiqueta]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={modo === valor}
          onClick={() => onChange(valor)}
          className={`rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${modo === valor ? 'bg-club-black text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-club-black'}`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

function ControlesCalendario({ modo, onChangeModo, pantallaCompleta, onTogglePantallaCompleta, onExportar }) {
  return (
    <div className="actividades-calendario-actions flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SelectorModoCalendario modo={modo} onChange={onChangeModo} />
      <button
        type="button"
        onClick={onTogglePantallaCompleta}
        title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-club-black transition hover:border-club-red/30 hover:text-club-red"
      >
        <IconoPantallaCompleta activa={pantallaCompleta} />
        {pantallaCompleta ? 'Salir' : 'Pantalla completa'}
      </button>
      <button
        type="button"
        onClick={onExportar}
        title="Exportar PDF"
        aria-label="Exportar PDF"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-club-black transition hover:border-club-red/30 hover:bg-white hover:text-club-red"
      >
        <IconoExportarPDF />
        PDF
      </button>
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
  const titulo = `${semana.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;

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

function TablaActividades({ actividades, onEditar, onEliminar }) {
  return (
    <div className="actividades-tabla overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left">
          <thead className="bg-slate-100/90 text-[11px] uppercase tracking-[0.12em] text-slate-500">
    <tr><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Horario</th><th className="px-5 py-4">Equipo</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Actividad</th><th className="px-5 py-4">Lugar</th><th className="actividades-tabla-acciones px-5 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actividades.length > 0 ? actividades.slice().sort((a, b) => a.fecha - b.fecha || String(a.hora || '').localeCompare(String(b.hora || ''))).map((actividad) => {
              const estilo = claseActividad(actividad.tipo);
              return <tr key={actividad.id} className="transition hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-sm font-black text-club-black">{formatearFechaTabla(actividad.fecha)}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-500">{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-600"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${estilo.punto}`} />{obtenerEquipoCanonico(actividad.equipo, actividad.club)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-md border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${actividad.tipo === 'partido' ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{estilo.etiqueta}</span></td><td className="min-w-[260px] px-5 py-4 text-sm font-bold text-slate-700">{actividad.tipo === 'partido' ? tituloPartidoActividad(actividad) : actividad.titulo}</td><td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-500">{actividad.ubicacion}</td><td className="actividades-tabla-acciones whitespace-nowrap px-5 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => onEditar?.(actividad)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600 transition hover:border-club-red/30 hover:text-club-red"><IconoEditar /> Editar</button><button type="button" onClick={() => onEliminar?.(actividad)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"><IconoBorrar /> Eliminar</button></div></td></tr>;
            }) : <tr><td colSpan="7" className="px-5 py-14 text-center text-sm font-semibold text-slate-400">No hay actividades para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquiposView({ actividades, semana, onChange, onHoy }) {
  const dias = diasDeSemana(semana);
  const equipos = useMemo(() => {
    const equiposBase = Array.from(new Set([...EQUIPOS_ACTIVIDADES, ...actividades.map((actividad) => obtenerEquipoCanonico(actividad.equipo, actividad.club))]));
    const clavesSemana = new Set(dias.map((dia) => fechaClave(dia)));

    return equiposBase.filter((equipo) =>
      actividades.some((actividad) => obtenerEquipoCanonico(actividad.equipo, actividad.club) === equipo && clavesSemana.has(fechaClave(actividad.fecha)))
    );
  }, [actividades, dias]);

  return <div className="actividades-equipos overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><NavegacionSemana semana={semana} onChange={onChange} onHoy={onHoy} /><div className="overflow-x-auto"><div className="min-w-[930px]">
    <div className="grid grid-cols-[190px_repeat(7,minmax(105px,1fr))] border-b border-slate-200 bg-slate-100/90 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><div className="flex items-end px-5 py-4 text-left">Equipo</div>{dias.map((dia) => <div key={fechaClave(dia)} className={`border-l border-slate-200 px-2 py-3 ${fechaClave(dia) === fechaClave(new Date()) ? 'text-club-red' : ''}`}><div>{formatearDiaSemana(dia).split(' ')[0]}</div><strong className="mt-1 block text-lg tracking-normal text-club-black">{dia.getDate()}</strong></div>)}</div>
    {equipos.length > 0 ? equipos.map((equipo) => <div key={equipo} className="grid min-h-[92px] grid-cols-[190px_repeat(7,minmax(105px,1fr))] border-b border-slate-200 last:border-b-0"><div className="flex items-center gap-3 px-5 text-sm font-black text-slate-700"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: obtenerColorEquipo(equipo).acento }} />{equipo}</div>{dias.map((dia) => { const delDia = actividades.filter((actividad) => obtenerEquipoCanonico(actividad.equipo, actividad.club) === equipo && fechaClave(actividad.fecha) === fechaClave(dia)); return <div key={fechaClave(dia)} className="border-l border-slate-200 p-2">{delDia.map((actividad) => { const equipoCanonico = obtenerEquipoCanonico(actividad.equipo, actividad.club); const colorEquipo = obtenerColorEquipo(equipoCanonico); return <div key={actividad.id} className="mb-1 rounded-lg border px-2 py-2 text-[11px] font-bold leading-tight" style={{ backgroundColor: colorEquipo.fondo, borderColor: colorEquipo.borde, color: colorEquipo.texto }}><span className="block">{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span><span className="mt-0.5 block line-clamp-2">{actividad.tipo === 'partido' ? tituloPartidoActividad(actividad) : actividad.titulo}</span></div>; })}</div>;})}</div>) : <div className="px-5 py-14 text-center text-sm font-semibold text-slate-400">No hay equipos con contenido en la semana seleccionada.</div>}
  </div></div></div>;
}

function HorasView({
  actividades,
  semana,
  onChange,
  onHoy,
  modo = 'minimal',
  actividadAccionesAbiertasId,
  actividadAccionesCerradasId,
  onToggleAccionesActividad,
  onCerrarAccionesActividad,
  onReactivarAccionesActividad,
  onVer,
  onEditar,
  onEliminar,
}) {
  const dias = diasDeSemana(semana);
  const rangoVista = useMemo(() => calcularRangoVistaHoras(actividades), [actividades]);
  const horasVista = useMemo(
    () => Array.from({ length: Math.max(1, (rangoVista.minutoFin - rangoVista.minutoInicio) / 60) }, (_, indice) => rangoVista.minutoInicio / 60 + indice),
    [rangoVista.minutoFin, rangoVista.minutoInicio]
  );
  const diasConActividades = useMemo(
    () =>
      dias.map((dia) => {
        const clave = fechaClave(dia);
        const actividadesDelDia = actividades
          .filter((actividad) => fechaClave(actividad.fecha) === clave)
          .sort(ordenarActividades);
        const grupos = agruparActividadesPorSolape(actividadesDelDia);

        return {
          clave,
          grupos: grupos
            .map((grupo) => {
              const actividadesVisibles = grupo.actividades
                .map((actividad) => {
                  const rango = obtenerRangoActividadVisible(
                    actividad,
                    rangoVista.minutoInicio,
                    rangoVista.minutoFin
                  );
                  if (!rango) return null;

                  const top = ((rango.inicio - rangoVista.minutoInicio) / 60) * ALTURA_HORA_VISTA;
                  const height = Math.max(36, ((rango.fin - rango.inicio) / 60) * ALTURA_HORA_VISTA);

                  return {
                    ...actividad,
                    rango,
                    top,
                    height,
                  };
                })
                .filter(Boolean);

              if (actividadesVisibles.length === 0) return null;

              const top = Math.min(...actividadesVisibles.map((actividad) => actividad.top));
              const bottom = Math.max(...actividadesVisibles.map((actividad) => actividad.top + actividad.height));

              return {
                columnas: grupo.columnas,
                top,
                height: Math.max(36, bottom - top),
                actividades: actividadesVisibles,
              };
            })
            .filter(Boolean),
        };
      }),
    [actividades, dias, rangoVista.minutoFin, rangoVista.minutoInicio]
  );

  return (
    <div className="actividades-horas overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <NavegacionSemana semana={semana} onChange={onChange} onHoy={onHoy} />
      <div className="overflow-x-auto">
        <div className="min-w-[930px]">
          <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-slate-200 bg-slate-100/90 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            <div className="px-2 py-4">Hora</div>
            {dias.map((dia) => (
              <div key={fechaClave(dia)} className="border-l border-slate-200 px-2 py-4">
                {formatearDiaSemana(dia)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))]">
            <div
              className="relative border-r border-slate-200 bg-slate-50"
              style={{
                height: `${horasVista.length * ALTURA_HORA_VISTA}px`,
                backgroundImage:
                  'linear-gradient(to bottom, rgba(226, 232, 240, 0.8) 1px, transparent 1px)',
                backgroundSize: `100% ${ALTURA_HORA_VISTA}px`,
              }}
            >
              {horasVista.map((hora) => (
                <div
                  key={hora}
                  className="absolute left-0 right-0 -translate-y-1/2 px-3 text-[10px] font-black text-slate-400"
                  style={{ top: `${(hora - rangoVista.minutoInicio / 60) * ALTURA_HORA_VISTA}px` }}
                >
                  <span className="block text-right">{String(hora).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            {diasConActividades.map(({ clave, grupos }) => (
              <div
                key={clave}
                className="relative border-l border-slate-100 bg-white"
                style={{
                  height: `${horasVista.length * ALTURA_HORA_VISTA}px`,
                  backgroundImage:
                    'linear-gradient(to bottom, rgba(226, 232, 240, 0.75) 1px, transparent 1px)',
                  backgroundSize: `100% ${ALTURA_HORA_VISTA}px`,
                }}
              >
                {grupos.map((grupo, indiceGrupo) => (
                  <div
                    key={`${clave}-grupo-${indiceGrupo}`}
                    className="absolute left-1.5 right-1.5"
                    style={{
                      top: `${grupo.top}px`,
                      height: `${grupo.height}px`,
                    }}
                  >
                    <div
                      className="grid h-full gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${grupo.columnas}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: grupo.columnas }, (_, columna) => (
                        <div key={columna} className="relative min-h-0">
                          {grupo.actividades
                            .filter((actividad) => actividad.columna === columna)
                            .map((actividad) => (
                              <div
                                key={actividad.id}
                                role="button"
                                tabIndex={0}
                                aria-expanded={actividadAccionesAbiertasId === actividad.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleAccionesActividad?.(actividad);
                                }}
                                onMouseEnter={() => onReactivarAccionesActividad?.(actividad)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onToggleAccionesActividad?.(actividad);
                                  }
                                }}
                                className={`actividades-horas-evento group/card absolute left-0 right-0 rounded-lg border text-[10px] font-bold leading-tight shadow-sm transition hover:shadow-md ${actividadAccionesAbiertasId === actividad.id ? 'z-20 overflow-visible ring-2 ring-club-red/20' : 'z-10 overflow-hidden'} ${modo === 'detalle' ? 'px-2.5 py-2' : 'px-2 py-1.5'}`}
                                style={{
                                  top: `${actividad.top - grupo.top}px`,
                                  height: `${actividad.height}px`,
                                  backgroundColor: obtenerColorEquipo(obtenerEquipoCanonico(actividad.equipo, actividad.club)).fondo,
                                  borderColor: obtenerColorEquipo(obtenerEquipoCanonico(actividad.equipo, actividad.club)).borde,
                                  color: obtenerColorEquipo(obtenerEquipoCanonico(actividad.equipo, actividad.club)).texto,
                                }}
                              >
                                <AccionesActividad
                                  actividad={actividad}
                                  abierta={actividadAccionesAbiertasId === actividad.id}
                                  cerrada={actividadAccionesCerradasId === actividad.id}
                                  onVer={onVer}
                                  onEditar={onEditar}
                                  onEliminar={onEliminar}
                                  onCerrar={() => onCerrarAccionesActividad?.(actividad)}
                                />
                                <span className="block font-black">{formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</span>
                                <span className="mt-0.5 block line-clamp-2">{actividad.tipo === 'partido' ? tituloPartidoActividad(actividad) : actividad.titulo}</span>
                                <span className={`${modo === 'detalle' ? 'mt-1' : 'mt-0.5'} block truncate font-semibold opacity-70`}>{obtenerEquipoCanonico(actividad.equipo, actividad.club)}</span>
                                {modo === 'detalle' && (
                                  <span className="mt-1 block truncate text-[9px] font-semibold opacity-60">
                                    {[etiquetaInstalacionActividad(actividad), actividad.competicion].filter(Boolean).join(' · ') || 'Sin información adicional'}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Actividades() {
  const { user } = useAuth();
  const { club } = useClub();
  const listas = useListas();
  const clubActivo = resolverClaveClubEquipo(club || user?.club || 'ROMO');
  const hoy = useMemo(() => new Date(), []);
  const puedeEscribirRemoto = ['administrador', 'director'].includes(String(user?.rol || '').toLowerCase());
  const calendarioRef = useRef(null);
  const [mesVisible, setMesVisible] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [vista, setVista] = useState('semana');
  const [modoCalendario, setModoCalendario] = useState('minimal');
  const [semanaVisible, setSemanaVisible] = useState(() => obtenerInicioSemana(hoy));
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => fechaClave(hoy));
  const [filtros, setFiltros] = useState({
    club: 'todos',
    equipo: 'todos',
    evento: 'todos',
    competicion: 'todos',
    instalacion: 'todos',
    horario: 'todos',
  });
  const [actividades, setActividades] = useState(() => cargarActividadesIniciales(clubActivo));
  const [equiposSelector, setEquiposSelector] = useState([]);
  const [competicionesSelector, setCompeticionesSelector] = useState([]);
  const [tipoNuevo, setTipoNuevo] = useState(null);
  const [modoFormulario, setModoFormulario] = useState('crear');
  const [actividadEditandoId, setActividadEditandoId] = useState(null);
  const [actividadAccionesAbiertasId, setActividadAccionesAbiertasId] = useState(null);
  const [actividadAccionesCerradasId, setActividadAccionesCerradasId] = useState(null);
  const [actividadVista, setActividadVista] = useState(null);
  const [formulario, setFormulario] = useState({});
  const [fechaMenuCreacion, setFechaMenuCreacion] = useState(null);
  const [calendarioPantallaCompleta, setCalendarioPantallaCompleta] = useState(false);
  const [sincronizacionRemotaLista, setSincronizacionRemotaLista] = useState(false);
  const [sincronizacionRemotaActiva, setSincronizacionRemotaActiva] = useState(false);
  const catalogoLocalVisitante = useMemo(() => {
    const listaClubes = listas.find((lista) => lista.id === 'clubes');
    const listaEquipos = listas.find((lista) => lista.id === 'equipos');
    return construirCatalogoLocalVisitante(listaClubes?.filas || CLUBES_MAESTROS, listaEquipos?.filas || []);
  }, [listas]);
  const mapaAbreviaturasEquipos = useMemo(() => crearMapaAbreviaturasEquipos(), []);
  const abreviaturasEquipos = useMemo(
    () =>
      EQUIPOS_MS.filter((equipo) => String(equipo.abreviatura || '').trim()).map((equipo) => ({
        club: equipo.club,
        abreviatura: String(equipo.abreviatura || '').trim(),
        nombre: String(equipo.nombre || '').trim(),
      })),
    []
  );
  const abreviaturasEquiposPorClub = useMemo(
    () => ({
      ROMO: abreviaturasEquipos.filter((equipo) => equipo.club === 'ROMO'),
      ARENAS: abreviaturasEquipos.filter((equipo) => equipo.club === 'ARENAS'),
    }),
    [abreviaturasEquipos]
  );
  // Las actividades se guardan en la colección del club activo; mostramos el
  // club explícitamente, pero no permitimos crear un registro en otra
  // colección desde esta pantalla.
  const opcionesClub = [clubActivo];
  const opcionesEquipo = useMemo(
    () => Array.from(new Set(actividades.map((actividad) => obtenerEquipoCanonico(actividad.equipo, actividad.club || clubActivo)).filter(Boolean))).sort(),
    [actividades, clubActivo]
  );
  const opcionesEvento = OPCIONES_EVENTO;
  const opcionesCompeticion = useMemo(() => Array.from(new Set(actividades.map((actividad) => actividad.competicion))).sort(), [actividades]);
  const opcionesInstalacion = useMemo(
    () =>
      Array.from(
        new Set(
          actividades
            .map((actividad) => textoLimpio(actividad.ubicacion))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [actividades]
  );
  const opcionesHorario = useMemo(
    () =>
      Array.from(
        new Set(
          actividades
            .map((actividad) => textoLimpio(actividad.hora))
            .filter(Boolean)
        )
      ).sort((a, b) => {
        const diferencia = (convertirHoraAMinutos(a) ?? Number.MAX_SAFE_INTEGER) - (convertirHoraAMinutos(b) ?? Number.MAX_SAFE_INTEGER);
        return diferencia !== 0 ? diferencia : a.localeCompare(b, 'es');
      }),
    [actividades]
  );

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

  useEffect(() => {
    let cancelado = false;

    const cargarCompeticionesSelector = async () => {
      try {
        const respuesta = await api.get('/competiciones');
        if (cancelado) return;

        const competiciones = Array.isArray(respuesta.competiciones)
          ? respuesta.competiciones.map((competicion) => textoCompeticion(competicion)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
          : [];

        setCompeticionesSelector(competiciones);
      } catch (_) {
        if (!cancelado) {
          setCompeticionesSelector([]);
        }
      }
    };

    cargarCompeticionesSelector();

    return () => {
      cancelado = true;
    };
  }, [club, user?.club]);

  useEffect(() => {
    let cancelado = false;

    const cargarActividadesRemotas = async () => {
      const locales = cargarActividadesIniciales(clubActivo);

      try {
        const respuesta = await api.get('/actividades');
        if (cancelado) return;

        const remotas = Array.isArray(respuesta.actividades) ? respuesta.actividades : [];
        const actividadesNormalizadas = remotas
          .map((actividad) => normalizarActividadGuardada(actividad, clubActivo))
          .filter(Boolean)
          .sort(ordenarActividades);
        const actividadesIniciales = puedeEscribirRemoto
          ? fusionarActividades(actividadesNormalizadas, locales)
          : actividadesNormalizadas;

        setActividades(actividadesIniciales.length > 0 ? actividadesIniciales : locales);
        setSincronizacionRemotaActiva(puedeEscribirRemoto);
      } catch (_) {
        if (!cancelado) {
          setActividades(locales);
          setSincronizacionRemotaActiva(false);
        }
      } finally {
        if (!cancelado) {
          setSincronizacionRemotaLista(true);
        }
      }
    };

    cargarActividadesRemotas();

    return () => {
      cancelado = true;
    };
  }, [clubActivo, puedeEscribirRemoto]);

  const opcionesCompeticionModal = useMemo(() => {
    const base = competicionesSelector.length > 0 ? competicionesSelector : opcionesCompeticion;
    if (formulario.competicion && !base.includes(formulario.competicion)) {
      return [...base, formulario.competicion];
    }
    return base;
  }, [competicionesSelector, formulario.competicion, opcionesCompeticion]);

  const opcionesEquipoModal = useMemo(() => {
    const clubFormulario = resolverClaveClubEquipo(formulario.club || clubActivo);
    const equiposDelClub = EQUIPOS_MS
      .filter((equipo) => equipo.club === clubFormulario)
      .map((equipo) => equipo.nombre);
    const equiposDetectados = equiposSelector
      .map((equipo) => nombreEquipoFormulario(equipo, clubFormulario));
    const extras = [
      ...equiposDetectados,
      formulario.equipo,
    ]
      .map((valor) => nombreEquipoFormulario(valor, clubFormulario))
      .filter(Boolean);

    return [...new Set([...equiposDelClub, ...extras])];
  }, [clubActivo, equiposSelector, formulario.club, formulario.equipo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (!sincronizacionRemotaLista) return;

      const serializadas = actividades.map(serializarActividadPersistible);
      window.localStorage.setItem(ACTIVIDADES_STORAGE_KEY, JSON.stringify(serializadas));
    } catch (_) {
      // Si localStorage no esta disponible, seguimos sin persistencia.
    }
  }, [actividades, sincronizacionRemotaLista]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sincronizacionRemotaLista || !puedeEscribirRemoto || !sincronizacionRemotaActiva) return;

    let cancelado = false;
    const serializadas = actividades.map(serializarActividadPersistible);

    const guardarActividadesRemotas = async () => {
      try {
        await api.put('/actividades', { actividades: serializadas });
      } catch (_) {
        if (!cancelado) {
          setSincronizacionRemotaActiva(false);
        }
      }
    };

    guardarActividadesRemotas();

    return () => {
      cancelado = true;
    };
  }, [actividades, sincronizacionRemotaLista, puedeEscribirRemoto, sincronizacionRemotaActiva]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setCalendarioPantallaCompleta(document.fullscreenElement === calendarioRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (document.fullscreenElement === calendarioRef.current || !calendarioPantallaCompleta) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [calendarioPantallaCompleta]);

  const actividadesFiltradas = useMemo(
    () =>
      actividades.filter(
        (actividad) =>
          (filtros.club === 'todos' || resolverClaveClubEquipo(actividad.club || obtenerEquipoCanonico(actividad.equipo, actividad.club)) === filtros.club) &&
          (filtros.equipo === 'todos' || obtenerEquipoCanonico(actividad.equipo, actividad.club) === filtros.equipo) &&
          (filtros.evento === 'todos' || actividad.evento === filtros.evento) &&
          (filtros.competicion === 'todos' || actividad.competicion === filtros.competicion) &&
          (filtros.instalacion === 'todos' || textoLimpio(actividad.ubicacion) === filtros.instalacion) &&
          (filtros.horario === 'todos' || textoLimpio(actividad.hora) === filtros.horario)
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
  const actividadesPorDiaConSolape = useMemo(() => {
    const mapa = new Map();

    celdas.forEach((fecha) => {
      const clave = fechaClave(fecha);
      const actividadesDelDia = actividadesPorDia.get(clave) || [];
      mapa.set(clave, agruparActividadesPorSolape(actividadesDelDia));
    });

    return mapa;
  }, [actividadesPorDia, celdas]);

  const proximas = actividadesFiltradas.filter((actividad) => actividad.fecha >= hoy).sort((a, b) => a.fecha - b.fecha).slice(0, 5);
  const tituloMes = `${MESES[mesVisible.getMonth()]} ${mesVisible.getFullYear()}`;
  const fechaSeleccionadaTexto = new Date(`${fechaSeleccionada}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const exportarPDF = async () => {
    const selectoresPorVista = {
      semana: '.actividades-semana',
      calendario: '.actividades-calendario',
      equipos: '.actividades-equipos',
      horas: '.actividades-horas',
      tabla: '.actividades-tabla',
    };
    const objetivo = calendarioRef.current?.querySelector(selectoresPorVista[vista]);

    if (!objetivo) {
      window.print();
      return;
    }

    const ancho = Math.max(objetivo.scrollWidth, Math.ceil(objetivo.getBoundingClientRect().width));
    const contenedor = document.createElement('div');
    const copia = objetivo.cloneNode(true);

    contenedor.className = 'pdf-export-clone';
    contenedor.style.cssText = `position: fixed; left: -100000px; top: 0; width: ${ancho}px; padding: 0; background: #ffffff; z-index: -1;`;
    copia.style.width = `${ancho}px`;
    copia.style.minWidth = `${ancho}px`;
    copia.style.maxWidth = 'none';
    copia.style.height = 'auto';
    copia.style.overflow = 'visible';

    copia.querySelectorAll('.overflow-x-auto, .overflow-y-auto').forEach((nodo) => {
      nodo.style.overflow = 'visible';
      nodo.style.maxWidth = 'none';
    });
    copia.querySelectorAll('button, .no-print, .actividades-acciones-actividad, .actividades-calendario-add, .actividades-calendario-menu, .actividades-calendario-leyenda, .actividades-calendario-actions').forEach((nodo) => {
      nodo.style.display = 'none';
    });

    contenedor.appendChild(copia);
    document.body.appendChild(contenedor);

    try {
      if (document.fonts?.ready) await document.fonts.ready;

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
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const margen = 6;
      const anchoPagina = 297 - margen * 2;
      const altoPagina = 210 - margen * 2;
      const altoImagen = (canvas.height * anchoPagina) / canvas.width;
      const imagen = canvas.toDataURL('image/png');
      let desplazamiento = 0;
      let pagina = 0;

      while (desplazamiento < altoImagen - 0.5) {
        if (pagina > 0) pdf.addPage();
        pdf.addImage(imagen, 'PNG', margen, margen - desplazamiento, anchoPagina, altoImagen, undefined, 'FAST');
        desplazamiento += altoPagina;
        pagina += 1;
      }

      const desde = semanaVisible.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '-');
      pdf.save(`actividades_${vista}_${desde}.pdf`);
    } catch (error) {
      console.error('No se pudo generar el PDF de actividades', error);
      window.print();
    } finally {
      contenedor.remove();
    }
  };

  const alternarPantallaCompletaCalendario = async () => {
    const nodo = calendarioRef.current;
    if (!nodo) return;

    try {
      if (document.fullscreenElement === nodo) {
        await document.exitFullscreen();
        return;
      }

      if (nodo.requestFullscreen) {
        await nodo.requestFullscreen();
        return;
      }
    } catch (_) {
      // Si el navegador bloquea fullscreen, usamos el modo visual local.
    }

    setCalendarioPantallaCompleta((actual) => !actual);
  };

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
      club: clubActivo === 'ARENAS' ? 'ARENAS' : 'ROMO',
      hora: tipo === 'partido' ? '' : '18:00',
      horaFin: '',
      equipo: '',
      instalacion: obtenerInstalacionPorDefecto(tipo, ''),
      espacio: '',
      competicion: '',
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
      club: resolverClaveClubEquipo(actividad.club || clubActivo),
      hora: actividad.hora || '',
      horaFin: actividad.horaFin || '',
      equipo: nombreEquipoFormulario(actividad.equipo || '', actividad.club || clubActivo),
      instalacion: actividad.ubicacion || obtenerInstalacionPorDefecto(actividad.tipo, actividad.local || ''),
      espacio: actividad.espacio || '',
      competicion: actividad.competicion || '',
      local: actividad.local || '',
      visitante: actividad.visitante || actividad.rival || '',
    });
  };

  const abrirVistaActividad = (actividad) => {
    if (!actividad) return;
    setActividadVista(actividad);
    setActividadAccionesAbiertasId(null);
    setActividadAccionesCerradasId(null);
  };

  const cerrarVistaActividad = () => {
    setActividadVista(null);
  };

  const alternarAccionesActividad = (actividad) => {
    if (!actividad) return;
    setActividadAccionesCerradasId(null);
    setActividadAccionesAbiertasId((actual) => (actual === actividad.id ? null : actividad.id));
  };

  const cerrarAccionesActividad = (actividad) => {
    if (!actividad) return;
    setActividadAccionesAbiertasId(null);
    setActividadAccionesCerradasId(actividad.id);
  };

  const reactivarAccionesActividad = (actividad) => {
    if (!actividad) return;
    setActividadAccionesCerradasId((actual) => (actual === actividad.id ? null : actual));
  };

  const eliminarActividad = (actividad) => {
    if (!actividad) return;

    const confirmado = window.confirm(`¿Quieres eliminar la actividad "${actividad.titulo}"? Esta accion no se puede deshacer.`);
    if (!confirmado) return false;

    setActividades((actuales) => actuales.filter((item) => item.id !== actividad.id));
    setActividadAccionesAbiertasId((actual) => (actual === actividad.id ? null : actual));
    if (actividadVista?.id === actividad.id) {
      cerrarVistaActividad();
    }

    if (actividadEditandoId === actividad.id) {
      cerrarCrear();
    }

    return true;
  };

  const cerrarCrear = () => {
    setTipoNuevo(null);
    setModoFormulario('crear');
    setActividadEditandoId(null);
    setFormulario({});
    setFechaMenuCreacion(null);
  };

  const cambiarFormulario = (campo, valor) => {
    setFormulario((actual) => {
      const siguiente = { ...actual, [campo]: valor };

      if (campo === 'local' && tipoNuevo === 'partido') {
        const instalacionDefecto = obtenerInstalacionPorDefecto('partido', valor);
        siguiente.instalacion = instalacionDefecto || (siguiente.instalacion === 'GOBELA' ? '' : siguiente.instalacion);
      }

      if (campo === 'club' && siguiente.equipo) {
        const equipoSeleccionado = buscarEquipoMaestroCalendario(siguiente.equipo, valor);
        if (equipoSeleccionado && equipoSeleccionado.club !== resolverClaveClubEquipo(valor)) {
          siguiente.equipo = '';
        }
      }

      return siguiente;
    });
  };

  const guardarActividad = (event) => {
    event.preventDefault();
    if (!tipoNuevo || !formulario.fecha) return;

    const equipo = textoLimpio(formulario.equipo);
    const local = textoLimpio(formulario.local);
    const visitante = textoLimpio(formulario.visitante);
    const instalacion = textoLimpio(formulario.instalacion);
    const espacioTexto = textoLimpio(formulario.espacio);
    const espacio = ESPACIOS_ACTIVIDAD.includes(espacioTexto) ? espacioTexto : '';
    const instalacionDefecto = obtenerInstalacionPorDefecto(tipoNuevo, local);
    const instalacionFinal = instalacion || instalacionDefecto;
    const competicion = textoLimpio(formulario.competicion);
    const esPartido = tipoNuevo === 'partido';
    const clubActividad = resolverClaveClubEquipo(formulario.club || clubActivo || user?.club || equipo || local || visitante || 'ROMO');
    const equipoCanonico = obtenerEquipoCanonico(equipo || local || visitante, clubActividad);
    const camposIncompletos = esPartido
      ? !equipo || !local || !visitante || !competicion || !instalacionFinal
      : !equipo || !instalacion;

    if (camposIncompletos) {
      setFormError(esPartido ? 'Completa equipo, competición, local, visitante e instalación.' : 'Completa equipo e instalación.');
      return;
    }

    const fecha = crearFechaActividad(formulario.fecha, formulario.hora);
    const nuevaActividad = {
      id: actividadEditandoId || `${tipoNuevo}-${Date.now()}`,
      tipo: tipoNuevo,
      evento: esPartido ? 'Partido' : 'Sesión',
      competicion: esPartido ? competicion : 'Entrenamiento',
      titulo: esPartido ? `${local} - ${visitante}` : 'Entrenamiento',
      club: clubActividad,
      equipo: nombreEquipoFormulario(equipo || equipoCanonico, clubActividad),
      local: esPartido ? local : '',
      visitante: esPartido ? visitante : '',
      rival: esPartido ? visitante : '',
      ubicacion: esPartido ? instalacionFinal : instalacion,
      espacio,
      fecha,
      hora: formulario.hora || '',
      horaFin: formulario.horaFin || '',
      duracion: esPartido
        ? `${formulario.hora || 'Hora pendiente'}${formulario.horaFin ? ` - ${formulario.horaFin}` : ''} · ${formulario.competicion}`
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
    <section className="actividades-page min-h-full bg-slate-50/70 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
      <div className="w-full">
        <div className="actividades-hero flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-club-black sm:text-3xl">Actividades</h1>
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

        <div className="actividades-filtros mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:px-5">
          <FiltroClub
            valor={filtros.club}
            onChange={(valor) => setFiltros((actuales) => ({ ...actuales, club: valor, equipo: 'todos' }))}
          />
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
          <FiltroSelect
            etiqueta="Instalación"
            valor={filtros.instalacion}
            opciones={opcionesInstalacion}
            onChange={(valor) => setFiltros((actuales) => ({ ...actuales, instalacion: valor }))}
          />
          <FiltroSelect
            etiqueta="Horario"
            valor={filtros.horario}
            opciones={opcionesHorario}
            onChange={(valor) => setFiltros((actuales) => ({ ...actuales, horario: valor }))}
          />
          {(filtros.club !== 'todos' || filtros.equipo !== 'todos' || filtros.evento !== 'todos' || filtros.competicion !== 'todos' || filtros.instalacion !== 'todos' || filtros.horario !== 'todos') && (
            <button
              type="button"
              onClick={() =>
                setFiltros({
                  club: 'todos',
                  equipo: 'todos',
                  evento: 'todos',
                  competicion: 'todos',
                  instalacion: 'todos',
                  horario: 'todos',
                })
              }
              className="shrink-0 rounded-lg px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-club-red transition hover:bg-club-red/10"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="actividades-agenda mt-4">
          <div
            ref={calendarioRef}
            data-fullscreen={calendarioPantallaCompleta ? 'true' : 'false'}
            className={`actividades-calendario-shell ${calendarioPantallaCompleta ? 'fixed inset-0 z-50 overflow-auto bg-slate-50 p-3 sm:p-6' : ''}`}
          >
            <div className="actividades-toolbar mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <VistaSelector vista={vista} onChange={setVista} />
              <ControlesCalendario
                modo={modoCalendario}
                onChangeModo={setModoCalendario}
                pantallaCompleta={calendarioPantallaCompleta}
                onTogglePantallaCompleta={alternarPantallaCompletaCalendario}
                onExportar={exportarPDF}
              />
            </div>

            {vista === 'semana' && (
              <SemanaView
                actividades={actividadesFiltradas}
                semana={semanaVisible}
                onChange={cambiarSemana}
                onHoy={() => setSemanaVisible(obtenerInicioSemana(hoy))}
                modo={modoCalendario}
                actividadAccionesAbiertasId={actividadAccionesAbiertasId}
                actividadAccionesCerradasId={actividadAccionesCerradasId}
                onToggleAccionesActividad={alternarAccionesActividad}
                onCerrarAccionesActividad={cerrarAccionesActividad}
                onReactivarAccionesActividad={reactivarAccionesActividad}
                onVer={abrirVistaActividad}
                onEditar={abrirEditar}
                onEliminar={eliminarActividad}
                onCrear={abrirCrear}
                mapaAbreviaturasEquipos={mapaAbreviaturasEquipos}
              />
            )}
            {vista === 'tabla' && <TablaActividades actividades={actividadesFiltradas} onEditar={abrirEditar} onEliminar={eliminarActividad} />}
            {vista === 'equipos' && <EquiposView actividades={actividadesFiltradas} semana={semanaVisible} onChange={cambiarSemana} onHoy={() => setSemanaVisible(obtenerInicioSemana(hoy))} />}
            {vista === 'horas' && (
              <HorasView
                actividades={actividadesFiltradas}
                semana={semanaVisible}
                onChange={cambiarSemana}
                onHoy={() => setSemanaVisible(obtenerInicioSemana(hoy))}
                modo={modoCalendario}
                actividadAccionesAbiertasId={actividadAccionesAbiertasId}
                actividadAccionesCerradasId={actividadAccionesCerradasId}
                onToggleAccionesActividad={alternarAccionesActividad}
                onCerrarAccionesActividad={cerrarAccionesActividad}
                onReactivarAccionesActividad={reactivarAccionesActividad}
                onVer={abrirVistaActividad}
                onEditar={abrirEditar}
                onEliminar={eliminarActividad}
              />
            )}

            <div className={vista === 'calendario' ? '' : 'hidden'}>
              <div
                className={`actividades-calendario overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${calendarioPantallaCompleta ? 'flex h-full min-h-0 flex-col shadow-2xl' : ''}`}
              >
                <div className="actividades-calendario-header flex flex-col gap-4 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => cambiarMes(-1)} className="rounded-lg p-2 text-club-black/55 transition hover:bg-club-red/10 hover:text-club-black" aria-label="Mes anterior">
                      <IconoFlecha direccion="izquierda" />
                    </button>
                    <h2 className="min-w-[170px] text-center text-lg font-black capitalize text-club-black">{tituloMes}</h2>
                    <button type="button" onClick={() => cambiarMes(1)} className="rounded-lg p-2 text-club-black/55 transition hover:bg-club-red/10 hover:text-club-black" aria-label="Mes siguiente">
                      <IconoFlecha direccion="derecha" />
                    </button>
                  </div>
                  <div className="actividades-calendario-actions flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <button type="button" onClick={() => abrirCrear('sesion')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100">
                      <IconoMas />
                      SESIÓN
                    </button>
                    <button type="button" onClick={() => abrirCrear('partido')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-club-red px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition hover:bg-club-redDark">
                      <IconoMas />
                      PARTIDO
                    </button>
                  </div>
                </div>
                <div className="actividades-calendario-weekdays overflow-x-auto border-b border-gray-100 bg-slate-50/80">
                  <div className="actividades-calendario-weekdays-grid grid min-w-[1050px] grid-cols-7">
                    {DIAS_SEMANA.map((dia) => (
                      <div key={dia} className="px-1 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-club-black/45 sm:text-xs">
                        {dia}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`actividades-calendario-body overflow-x-auto bg-slate-50/70 ${calendarioPantallaCompleta ? 'flex-1 min-h-0' : ''}`}>
                  <div className="actividades-calendario-grid grid min-w-[1050px] grid-cols-7 gap-3 p-3 sm:gap-4 sm:p-4">
                    {celdas.map((fecha, indice) => {
                      const clave = fechaClave(fecha);
                      const actividadesDelDia = (actividadesPorDia.get(clave) || []).slice().sort(ordenarActividades);
                      const semanaSinEventos = celdas
                        .slice(Math.floor(indice / 7) * 7, Math.floor(indice / 7) * 7 + 7)
                        .every((celda) => (actividadesPorDia.get(fechaClave(celda)) || []).length === 0);
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
                            setActividadAccionesAbiertasId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setFechaSeleccionada(clave);
                              setActividadAccionesAbiertasId(null);
                            }
                          }}
                          className={`actividades-calendario-day group relative overflow-hidden rounded-2xl border p-2.5 text-left transition sm:p-3 ${semanaSinEventos ? 'h-[112px] min-h-0' : 'min-h-[176px]'} ${
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
                            className="actividades-calendario-add absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-club-red text-white shadow-md shadow-club-red/15 transition hover:bg-club-redDark focus:outline-none focus:ring-4 focus:ring-club-red/15"
                            aria-label={`Añadir actividad el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`}
                          >
                            <IconoMas />
                          </button>
                          {fechaMenuCreacion === clave && (
                            <div
                              className="actividades-calendario-menu absolute left-2 top-14 z-20 flex min-w-[118px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => abrirCrear('sesion', clave)}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                              >
                          SESIÓN
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
                          <span className={`actividades-calendario-day-number absolute right-3 top-3 text-sm font-black ${esHoy ? 'text-club-red' : esMesActual ? 'text-club-black/70' : 'text-club-black/25'}`}>
                            {fecha.getDate()}
                          </span>
                          <div className={`actividades-calendario-day-content flex flex-col justify-start gap-1 ${semanaSinEventos ? 'pt-10' : 'pt-12'} ${semanaSinEventos ? 'min-h-0' : 'min-h-[148px]'}`}>
                            <div className="space-y-1">
                              {actividadesDelDia.map((actividad) => (
                                <ActividadCalendario
                                  key={actividad.id}
                                  actividad={actividad}
                                  abierta={actividadAccionesAbiertasId === actividad.id}
                                  accionesCerradas={actividadAccionesCerradasId === actividad.id}
                                  onVer={abrirVistaActividad}
                                  onEditar={abrirEditar}
                                  onEliminar={eliminarActividad}
                                  onSeleccionar={() => {
                                    setFechaSeleccionada(clave);
                                    setFechaMenuCreacion(null);
                                    alternarAccionesActividad(actividad);
                                  }}
                                  onToggleAcciones={alternarAccionesActividad}
                                  onCerrarAcciones={cerrarAccionesActividad}
                                  onReactivarAcciones={reactivarAccionesActividad}
                                  mapaAbreviaturasEquipos={mapaAbreviaturasEquipos}
                                  equipoVisible={etiquetaEquipoCalendario(actividad.equipo, mapaAbreviaturasEquipos)}
                                  compacta={modoCalendario === 'minimal'}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="actividades-calendario-leyenda flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-xs font-semibold text-club-black/55 sm:px-5">
                  <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#2563eb' }} /> Color del equipo</span>
                  <span className="text-club-black/55">El icono distingue sesión y partido</span>
                  <span className="text-club-black/35">Selecciona un día para ver el detalle</span>
                </div>
              </div>
            </div>
          </div>

          {abreviaturasEquipos.length > 0 && (
            <div className="no-print actividades-abreviaturas mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Colores y abreviaturas de equipos</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Cada equipo conserva este color en sus sesiones y partidos.</p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  {abreviaturasEquipos.length} códigos
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {['ROMO', 'ARENAS'].map((club) => {
                  const equiposDelClub = abreviaturasEquiposPorClub[club] || [];

                  return (
                    <div key={club} className="flex flex-wrap gap-2">
                      {equiposDelClub.map((equipo) => {
                        const colorEquipo = obtenerColorEquipo(`${equipo.club} - ${equipo.nombre}`);
                        const nombreEquipoVisible = [equipo.club, equipo.nombre].filter(Boolean).join(' ');

                        return (
                          <span
                            key={equipo.abreviatura}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold sm:text-[11px]"
                            style={{ backgroundColor: colorEquipo.fondo, borderColor: colorEquipo.borde, color: colorEquipo.texto }}
                            title={nombreEquipoVisible}
                          >
                            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black sm:text-[10px]" style={{ backgroundColor: colorEquipo.fondoAcento, color: colorEquipo.texto }}>
                              {equipo.abreviatura}
                            </span>
                            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: colorEquipo.acento }} aria-hidden="true" />
                            <span className="leading-none">{nombreEquipoVisible}</span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {false && (
            <div className={vista === 'calendario' ? '' : 'hidden'}>
            <div
              ref={calendarioRef}
              data-fullscreen={calendarioPantallaCompleta ? 'true' : 'false'}
              className={`actividades-calendario-shell ${calendarioPantallaCompleta ? 'fixed inset-0 z-50 bg-slate-50 p-3 sm:p-6' : ''}`}
            >
              <div className={`actividades-calendario overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${calendarioPantallaCompleta ? 'flex h-full min-h-0 flex-col shadow-2xl' : ''}`}>
                <div className="actividades-calendario-header flex flex-col gap-4 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => cambiarMes(-1)} className="rounded-lg p-2 text-club-black/55 transition hover:bg-club-red/10 hover:text-club-black" aria-label="Mes anterior">
                      <IconoFlecha direccion="izquierda" />
                    </button>
                    <h2 className="min-w-[170px] text-center text-lg font-black capitalize text-club-black">{tituloMes}</h2>
                    <button type="button" onClick={() => cambiarMes(1)} className="rounded-lg p-2 text-club-black/55 transition hover:bg-club-red/10 hover:text-club-black" aria-label="Mes siguiente">
                      <IconoFlecha direccion="derecha" />
                    </button>
                  </div>
                  <div className="actividades-calendario-actions flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <SelectorModoCalendario modo={modoCalendario} onChange={setModoCalendario} />
                    <button
                      type="button"
                      onClick={alternarPantallaCompletaCalendario}
                      title={calendarioPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                      aria-label={calendarioPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-club-black transition hover:border-club-red/30 hover:text-club-red"
                    >
                      <IconoPantallaCompleta activa={calendarioPantallaCompleta} />
                      {calendarioPantallaCompleta ? 'Salir' : 'Pantalla completa'}
                    </button>
                    <button
                      type="button"
                      onClick={exportarPDF}
                      title="Exportar PDF"
                      aria-label="Exportar PDF"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-club-black transition hover:border-club-red/30 hover:bg-white hover:text-club-red"
                    >
                      <IconoExportarPDF />
                      PDF
                    </button>
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
                <div className="actividades-calendario-weekdays overflow-x-auto border-b border-gray-100 bg-slate-50/80">
                  <div className="actividades-calendario-weekdays-grid grid min-w-[1050px] grid-cols-7">
                    {DIAS_SEMANA.map((dia) => (
                      <div key={dia} className="px-1 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-club-black/45 sm:text-xs">
                        {dia}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`actividades-calendario-body overflow-x-auto bg-slate-50/70 ${calendarioPantallaCompleta ? 'flex-1 min-h-0' : ''}`}>
                  <div className="actividades-calendario-grid grid min-w-[1050px] grid-cols-7 gap-3 p-3 sm:gap-4 sm:p-4">
                    {celdas.map((fecha, indice) => {
                      const clave = fechaClave(fecha);
                      const actividadesDelDia = (actividadesPorDia.get(clave) || []).slice().sort(ordenarActividades);
                      const semanaSinEventos = celdas
                        .slice(Math.floor(indice / 7) * 7, Math.floor(indice / 7) * 7 + 7)
                        .every((celda) => (actividadesPorDia.get(fechaClave(celda)) || []).length === 0);
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
                            setActividadAccionesAbiertasId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setFechaSeleccionada(clave);
                              setActividadAccionesAbiertasId(null);
                            }
                          }}
                          className={`actividades-calendario-day group relative overflow-hidden rounded-2xl border p-2.5 text-left transition sm:p-3 ${semanaSinEventos ? 'h-[112px] min-h-0' : 'min-h-[176px]'} ${
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
                            className="actividades-calendario-add absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-club-red text-white shadow-md shadow-club-red/15 transition hover:bg-club-redDark focus:outline-none focus:ring-4 focus:ring-club-red/15"
                            aria-label={`Añadir actividad el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`}
                          >
                            <IconoMas />
                          </button>
                          {fechaMenuCreacion === clave && (
                            <div
                              className="actividades-calendario-menu absolute left-2 top-14 z-20 flex min-w-[118px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => abrirCrear('sesion', clave)}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                              >
                                SESIÓN
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
                          <span className={`actividades-calendario-day-number absolute right-3 top-3 text-sm font-black ${esHoy ? 'text-club-red' : esMesActual ? 'text-club-black/70' : 'text-club-black/25'}`}>
                            {fecha.getDate()}
                          </span>
                          <div className={`actividades-calendario-day-content flex flex-col justify-start gap-1 ${semanaSinEventos ? 'pt-10' : 'pt-12'} ${semanaSinEventos ? 'min-h-0' : 'min-h-[148px]'}`}>
                            <div className="space-y-1">
                              {actividadesDelDia.map((actividad) => (
                                <ActividadCalendario
                                  key={actividad.id}
                                  actividad={actividad}
                                  abierta={actividadAccionesAbiertasId === actividad.id}
                                  accionesCerradas={actividadAccionesCerradasId === actividad.id}
                                  onVer={abrirVistaActividad}
                                  onEditar={abrirEditar}
                                  onEliminar={eliminarActividad}
                                  onSeleccionar={() => {
                                    setFechaSeleccionada(clave);
                                    setFechaMenuCreacion(null);
                                  }}
                                  onToggleAcciones={alternarAccionesActividad}
                                  onCerrarAcciones={cerrarAccionesActividad}
                                  onReactivarAcciones={reactivarAccionesActividad}
                                  mapaAbreviaturasEquipos={mapaAbreviaturasEquipos}
                                  equipoVisible={etiquetaEquipoCalendario(actividad.equipo, mapaAbreviaturasEquipos)}
                                  compacta={modoCalendario === 'minimal'}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="actividades-calendario-leyenda flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-xs font-semibold text-club-black/55 sm:px-5">
                  <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sesión</span>
                  <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-club-red" /> Partido</span>
                  <span className="text-club-black/35">Selecciona un día para ver el detalle</span>
                </div>
              </div>
            </div>
            </div>
          )}

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
                      <p className="truncate text-sm font-bold text-club-black">{actividad.tipo === 'partido' ? tituloPartidoActividad(actividad) : actividad.titulo}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-club-black/50">{formatearFechaCorta(actividad.fecha)} · {formatearHora(actividad.fecha, actividad.hora, actividad.horaFin)}</p>
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
        clubOpciones={opcionesClub}
        equipoOpciones={opcionesEquipoModal}
        competicionOpciones={opcionesCompeticionModal}
        catalogoLocalVisitante={catalogoLocalVisitante}
      />
      <ModalDetalleActividad
        actividad={actividadVista}
        onClose={cerrarVistaActividad}
        onEditar={(actividad) => {
          cerrarVistaActividad();
          abrirEditar(actividad);
        }}
        onEliminar={(actividad) => {
          if (eliminarActividad(actividad)) {
            cerrarVistaActividad();
          }
        }}
      />
    </section>
  );
}
