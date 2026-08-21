import { useMemo, useSyncExternalStore } from 'react';
import { CLUBES_MAESTROS } from '../data/clubes';
import { obtenerEquiposPorClub } from '../data/equipos';
import { EQUIPOS_MS } from '../data/msEquipos';

const STORAGE_KEY = 'listas_maestras_v3';
const STORAGE_KEY_LEGACY = 'listas_maestras_v1';
const STORAGE_KEY_PREFIX = 'listas_maestras_v3:listas:';

function limpiarTextoLocal(valor) {
  return String(valor ?? '').trim();
}

function normalizarClaveClub(valor) {
  return limpiarTextoLocal(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function normalizarClaveEquipo(valor) {
  return limpiarTextoLocal(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function normalizarNombreEquipo(club, nombre) {
  const texto = limpiarTextoLocal(nombre);
  if (!texto) return '';

  const claveClub = normalizarClaveClub(club);
  const alias = {
    ROMO: {
      ROMOJUVENIL: 'JUVENIL',
      ROMOCADETE: 'CADETE',
    },
  };
  const aliasClub = Object.keys(alias).find((clave) => claveClub.includes(clave));
  const aliasNombre = aliasClub ? alias[aliasClub][normalizarClaveEquipo(texto)] : '';
  const nombreBuscado = aliasNombre || texto;
  const clubCanonico = claveClub.includes('ROMO') ? 'ROMO' : claveClub.includes('ARENAS') ? 'ARENAS' : '';
  const nombresCanonicos = clubCanonico
    ? EQUIPOS_MS.filter((equipo) => equipo.club === clubCanonico).map((equipo) => equipo.nombre)
    : obtenerEquiposPorClub(club);
  const nombreCoincidente = nombresCanonicos.find(
    (equipo) => normalizarClaveEquipo(equipo) === normalizarClaveEquipo(texto)
  );
  if (nombreCoincidente) return nombreCoincidente;

  const nombreCanonico = nombresCanonicos.find(
    (equipo) => normalizarClaveEquipo(equipo) === normalizarClaveEquipo(nombreBuscado)
  );

  return nombreCanonico || nombreBuscado;
}

function normalizarFilaClub(fila, fallback = {}, indice = 0) {
  const nombre = limpiarTextoLocal(fila?.nombre) || limpiarTextoLocal(fallback?.nombre);
  const valor = limpiarTextoLocal(fila?.valor) || nombre || limpiarTextoLocal(fallback?.valor) || limpiarTextoLocal(fallback?.nombre);

  return {
    id: limpiarTextoLocal(fila?.id) || limpiarTextoLocal(fallback?.id) || `club-${String(indice + 1).padStart(3, '0')}`,
    valor,
    nombre,
    escudo: limpiarTextoLocal(fila?.escudo) || limpiarTextoLocal(fallback?.escudo),
  };
}

function crearClubesIniciales() {
  return CLUBES_MAESTROS.map((club, indice) => {
    const nombre = limpiarTextoLocal(club?.nombre);
    return normalizarFilaClub(
      {
        id: `club-${String(indice + 1).padStart(3, '0')}`,
        valor: nombre,
        nombre,
        escudo: limpiarTextoLocal(club?.escudo),
      },
      {},
      indice
    );
  });
}

function crearEquiposIniciales(clubes = crearClubesIniciales()) {
  return (clubes || []).flatMap((club, indiceClub) => {
    const clubNombre = limpiarTextoLocal(club?.nombre || club?.valor);
    if (!clubNombre) return [];

    const clubClave = normalizarClaveClub(club?.valor || clubNombre);
    const equiposClub = obtenerEquiposPorClub(clubNombre);
    return equiposClub.map((equipoNombre, indiceEquipo) =>
      normalizarFilaEquipo(
        {
          id: `equipo-${clubClave}-${normalizarClaveEquipo(equipoNombre)}`,
          club: clubNombre,
          nombre: equipoNombre,
        },
        {},
        indiceClub * equiposClub.length + indiceEquipo
      )
    );
  });
}

function normalizarFilaEquipo(fila, fallback = {}, indice = 0) {
  const club = limpiarTextoLocal(fila?.club) || limpiarTextoLocal(fallback?.club);
  const nombre = normalizarNombreEquipo(
    club,
    limpiarTextoLocal(fila?.nombre) || limpiarTextoLocal(fallback?.nombre)
  );
  const nombreFederacion =
    limpiarTextoLocal(fila?.nombre_federacion) || limpiarTextoLocal(fallback?.nombre_federacion);
  const abreviatura = limpiarTextoLocal(fila?.abreviatura) || limpiarTextoLocal(fallback?.abreviatura);

  return {
    id: limpiarTextoLocal(fila?.id) || limpiarTextoLocal(fallback?.id) || `equipo-${String(indice + 1).padStart(3, '0')}`,
    club,
    nombre,
    nombre_federacion: nombreFederacion,
    abreviatura,
  };
}

function normalizarIdsEliminados(valor) {
  if (!Array.isArray(valor)) return [];

  return Array.from(
    new Set(
      valor
        .map((item) => limpiarTextoLocal(item))
        .filter(Boolean)
    )
  );
}

function filtrarFilasEliminadas(filas = [], idsEliminados = []) {
  if (!Array.isArray(filas) || idsEliminados.length === 0) return filas;

  const eliminadas = new Set(idsEliminados);
  return filas.filter((fila) => !eliminadas.has(fila.id));
}

function fusionarFilasClubes(filasBase, filasGuardadas) {
  const baseNormalizadas = (filasBase || []).map((fila, indice) => normalizarFilaClub(fila, {}, indice));

  const guardadasNormalizadas = (filasGuardadas || []).map((fila, indice) => normalizarFilaClub(fila, {}, indice));
  const guardadasPorClave = new Map();
  guardadasNormalizadas.forEach((fila) => {
    const clave = normalizarClaveClub(fila.valor || fila.nombre);
    if (clave && !guardadasPorClave.has(clave)) {
      guardadasPorClave.set(clave, fila);
    }
  });

  const resultado = baseNormalizadas.map((baseFila) => {
    const clave = normalizarClaveClub(baseFila.valor || baseFila.nombre);
    const guardada = guardadasPorClave.get(clave);
    if (!guardada) return baseFila;

    return {
      ...baseFila,
      ...guardada,
      id: guardada.id || baseFila.id,
      valor: guardada.valor || baseFila.valor,
      nombre: guardada.nombre || baseFila.nombre,
      escudo: guardada.escudo || baseFila.escudo,
    };
  });

  const clavesBase = new Set(baseNormalizadas.map((fila) => normalizarClaveClub(fila.valor || fila.nombre)).filter(Boolean));
  guardadasNormalizadas.forEach((fila) => {
    const clave = normalizarClaveClub(fila.valor || fila.nombre);
    if (!clave || clavesBase.has(clave)) return;
    resultado.push(fila);
  });

  return resultado;
}

function fusionarFilasEquipos(filasBase, filasGuardadas) {
  const baseNormalizadas = (filasBase || []).map((fila, indice) => normalizarFilaEquipo(fila, {}, indice));
  const guardadasNormalizadas = (filasGuardadas || []).map((fila, indice) => normalizarFilaEquipo(fila, {}, indice));
  const guardadasPorId = new Map();
  const guardadasPorClave = new Map();

  guardadasNormalizadas.forEach((fila) => {
    if (fila.id && !guardadasPorId.has(fila.id)) {
      guardadasPorId.set(fila.id, fila);
    }

    const clave = `${normalizarClaveClub(fila.club)}|${normalizarClaveEquipo(fila.nombre)}`;
    if (clave && !guardadasPorClave.has(clave)) {
      guardadasPorClave.set(clave, fila);
    }
  });

  const filasGuardadasUsadas = new Set();
  const resultado = baseNormalizadas.map((baseFila) => {
    const clave = `${normalizarClaveClub(baseFila.club)}|${normalizarClaveEquipo(baseFila.nombre)}`;
    const guardada = guardadasPorId.get(baseFila.id) || guardadasPorClave.get(clave);
    if (!guardada) return baseFila;

    filasGuardadasUsadas.add(guardada);

    return {
      ...baseFila,
      ...guardada,
      id: guardada.id || baseFila.id,
      club: guardada.club || baseFila.club,
      nombre: guardada.nombre || baseFila.nombre,
      nombre_federacion: guardada.nombre_federacion || baseFila.nombre_federacion,
      abreviatura: guardada.abreviatura || baseFila.abreviatura,
    };
  });

  const clavesBase = new Set(
    baseNormalizadas.map((fila) => `${normalizarClaveClub(fila.club)}|${normalizarClaveEquipo(fila.nombre)}`).filter(Boolean)
  );
  guardadasNormalizadas.forEach((fila) => {
    const clave = `${normalizarClaveClub(fila.club)}|${normalizarClaveEquipo(fila.nombre)}`;
    if (filasGuardadasUsadas.has(fila) || (!clave || clavesBase.has(clave))) return;
    resultado.push(fila);
  });

  return resultado;
}

export const LISTAS_INICIALES = [
  {
    id: 'clubes',
    titulo: 'CLUBES',
    descripcion: 'Clubes disponibles para trabajar en la aplicacion.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'nombre', label: 'Club' },
      { key: 'escudo', label: 'Escudo', tipo: 'imagen' },
    ],
    filas: crearClubesIniciales(),
  },
  {
    id: 'equipos',
    titulo: 'EQUIPOS',
    descripcion: 'Asigna el nombre federativo y modifica el nombre interno de cada equipo.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'club', label: 'Club' },
      { key: 'nombre_federacion', label: 'Nombre FED', obligatorio: false },
      { key: 'nombre', label: 'Equipo interno' },
      { key: 'abreviatura', label: 'Abreviatura', obligatorio: false },
    ],
    filas: crearEquiposIniciales(),
  },
  {
    id: 'etapas',
    titulo: 'ETAPAS',
    descripcion: 'Etapas deportivas utilizadas para clasificar los equipos.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'nombre', label: 'Etapa' },
    ],
    filas: ['Prebenjamin', 'Benjamin', 'Alevin', 'Infantil', 'Cadete', 'Juvenil'].map((nombre) => ({
      id: `etapa-${nombre.toLowerCase()}`,
      nombre,
    })),
  },
  {
    id: 'categorias',
    titulo: 'CATEGORIAS',
    descripcion: 'Categorias deportivas utilizadas para clasificar los equipos.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'nombre', label: 'Categoria' },
    ],
    filas: ['Juvenil Nacion', 'Cadete Vsca', 'Cadete Honor'].map((nombre) => ({
      id: `categoria-${nombre.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
      nombre,
    })),
  },
  {
    id: 'demarcacion',
    titulo: 'DEMARCACION',
    descripcion: 'Posiciones disponibles en la ficha y en los campogramas.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'nombre', label: 'Demarcacion' },
    ],
    filas: ['Portero', 'Lateral', 'Central', 'Medio', 'Media punta', 'Extremo', 'Delantero'].map((nombre) => ({
      id: `demarcacion-${nombre.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
      nombre,
    })),
  },
  {
    id: 'lateralidad',
    titulo: 'LATERALIDAD',
    descripcion: 'Opciones disponibles para definir la lateralidad del jugador.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'nombre', label: 'Lateralidad' },
    ],
    filas: ['Diestro', 'Zurdo', 'Ambas'].map((nombre) => ({
      id: `lateralidad-${nombre.toLowerCase()}`,
      nombre,
    })),
  },
];

function clonarFila(fila) {
  return { ...fila };
}

function clonarLista(lista) {
  return {
    ...lista,
    columnas: lista.columnas.map((columna) => ({ ...columna })),
    filas: lista.filas.map((fila) => clonarFila(fila)),
    filasEliminadas: Array.isArray(lista.filasEliminadas) ? [...lista.filasEliminadas] : [],
  };
}

function crearListasBase() {
  return LISTAS_INICIALES.map((lista) => clonarLista(lista));
}

function claveListaPersistida(listaId) {
  return `${STORAGE_KEY_PREFIX}${listaId}`;
}

function parseJsonSeguro(valor) {
  if (!valor) return null;
  try {
    return JSON.parse(valor);
  } catch (_) {
    return null;
  }
}

function leerListasGuardadas() {
  if (typeof localStorage === 'undefined') {
    return crearListasBase();
  }

  const guardadasPorId = new Map();

  const persistidas = parseJsonSeguro(localStorage.getItem(STORAGE_KEY)) || parseJsonSeguro(localStorage.getItem(STORAGE_KEY_LEGACY));
  if (Array.isArray(persistidas)) {
    persistidas.forEach((lista) => {
      if (lista && typeof lista === 'object' && typeof lista.id === 'string') {
        guardadasPorId.set(lista.id, lista);
      }
    });
  }

  for (const baseLista of LISTAS_INICIALES) {
    const lista = parseJsonSeguro(localStorage.getItem(claveListaPersistida(baseLista.id)));
    if (lista && typeof lista === 'object' && typeof lista.id === 'string') {
      guardadasPorId.set(lista.id, lista);
    }
  }

  if (guardadasPorId.size === 0) return crearListasBase();
  return normalizarListas(Array.from(guardadasPorId.values()));
}

function normalizarTexto(valor) {
  return String(valor ?? '').trim();
}

function obtenerValorClub(fila, base) {
  const valor = normalizarTexto(fila?.valor);
  if (valor) return valor;
  if (base?.valor) return base.valor;
  const id = normalizarTexto(fila?.id || base?.id);
  if (id === 'club-romo') return 'ROMO';
  if (id === 'club-arenas') return 'ARENAS';
  return '';
}

function normalizarFila(listaBase, fila, indice = 0) {
  const baseFila = listaBase.filas[indice] || {};
  const resultado = {};

  listaBase.columnas.forEach((columna) => {
    if (columna.key === 'id') {
      resultado.id = normalizarTexto(fila?.id) || normalizarTexto(baseFila.id) || `${listaBase.id}-${indice + 1}`;
      return;
    }

    if (columna.tipo === 'imagen') {
      resultado[columna.key] = normalizarTexto(fila?.[columna.key]);
      return;
    }

    resultado[columna.key] = normalizarTexto(fila?.[columna.key]);
  });

  if (listaBase.id === 'clubes') {
    resultado.valor = obtenerValorClub(fila, baseFila);
  }

  return resultado;
}

function normalizarListas(listas) {
  if (!Array.isArray(listas)) return crearListasBase();

  const listasPorId = new Map(
    listas
      .filter((lista) => lista && typeof lista === 'object' && typeof lista.id === 'string')
      .map((lista) => [lista.id, lista])
  );

  let clubesNormalizados = null;
  const listasNormalizadas = [];

  for (const baseLista of LISTAS_INICIALES) {
    const guardada = listasPorId.get(baseLista.id);
    const baseClonada = clonarLista(baseLista);
    const idsEliminados = normalizarIdsEliminados(guardada?.filasEliminadas || guardada?.filas_eliminadas);
    const filasBase =
      baseLista.id === 'equipos'
        ? crearEquiposIniciales(clubesNormalizados?.filas || crearClubesIniciales())
        : baseClonada.filas;

    if (!guardada) {
      const listaBase = {
        ...baseClonada,
        filas: filtrarFilasEliminadas(filasBase, idsEliminados),
        filasEliminadas: idsEliminados,
      };
      listasNormalizadas.push(listaBase);
      if (listaBase.id === 'clubes') clubesNormalizados = listaBase;
      continue;
    }

    const filasGuardadas = Array.isArray(guardada.filas) ? guardada.filas : [];
    const filasNormalizadas =
      baseLista.id === 'clubes'
        ? filtrarFilasEliminadas(fusionarFilasClubes(baseClonada.filas, filasGuardadas), idsEliminados)
        : baseLista.id === 'equipos'
          ? filtrarFilasEliminadas(fusionarFilasEquipos(filasBase, filasGuardadas), idsEliminados)
          : filtrarFilasEliminadas(
              filasGuardadas.length > 0
                ? filasGuardadas.map((fila, indice) => normalizarFila(baseLista, fila, indice))
                : filasBase,
              idsEliminados
            );

    const lista = {
      ...baseClonada,
      ...guardada,
      id: baseLista.id,
      titulo: baseLista.titulo,
      descripcion: baseLista.descripcion,
      columnas: baseClonada.columnas,
      filas: filasNormalizadas,
      filasEliminadas: idsEliminados,
    };
    if (lista.id === 'clubes') clubesNormalizados = lista;
    listasNormalizadas.push(lista);
  }

  return listasNormalizadas;
}

let listas = leerListasGuardadas();
const listeners = new Set();

function guardarListas() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listas));
  } catch (_) {
    // Si el almacenamiento local falla, mantenemos el estado en memoria.
  }

  try {
    listas.forEach((lista) => {
      localStorage.setItem(claveListaPersistida(lista.id), JSON.stringify(lista));
    });
  } catch (_) {
    // El guardado por lista puede seguir funcionando aunque la copia global no quepa.
  }
}

function emitirCambio() {
  listeners.forEach((listener) => listener());
}

export function getListas() {
  return listas;
}

export function subscribeListas(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setListas(nuevasListas) {
  listas = normalizarListas(nuevasListas);
  guardarListas();
  emitirCambio();
}

export function actualizarLista(listaId, actualizador) {
  const listaActual = listas.find((lista) => lista.id === listaId);
  if (!listaActual) return;

  const siguiente = actualizador(clonarLista(listaActual));
  if (!siguiente || typeof siguiente !== 'object') return;

  setListas(listas.map((lista) => (lista.id === listaId ? siguiente : lista)));
}

export function crearFilaLista(listaId, fila) {
  actualizarLista(listaId, (lista) => ({
    ...lista,
    filas: [...lista.filas, fila],
  }));
}

export function actualizarFilaLista(listaId, filaId, cambios) {
  actualizarLista(listaId, (lista) => ({
    ...lista,
    filas: lista.filas.map((fila) => (fila.id === filaId ? { ...fila, ...cambios } : fila)),
  }));
}

export function eliminarFilaLista(listaId, filaId) {
  actualizarLista(listaId, (lista) => ({
    ...lista,
    filas: lista.filas.filter((fila) => fila.id !== filaId),
    filasEliminadas: normalizarIdsEliminados([...(lista.filasEliminadas || []), filaId]),
  }));
}

export function useListas() {
  return useSyncExternalStore(subscribeListas, getListas, getListas);
}

export function useLista(listaId) {
  const listasActuales = useListas();
  return useMemo(() => listasActuales.find((lista) => lista.id === listaId) || null, [listasActuales, listaId]);
}

export function useListaValores(listaId, clave = 'nombre') {
  const lista = useLista(listaId);
  return useMemo(
    () => (lista?.filas || []).map((fila) => normalizarTexto(fila?.[clave])).filter(Boolean),
    [lista, clave]
  );
}
