import { useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'listas_maestras_v2';
const STORAGE_KEY_LEGACY = 'listas_maestras_v1';

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
    filas: [
      { id: 'club-romo', valor: 'ROMO', nombre: 'ROMO FC', escudo: '' },
      { id: 'club-arenas', valor: 'ARENAS', nombre: 'ARENAS CLUB', escudo: '' },
    ],
  },
  {
    id: 'equipos',
    titulo: 'EQUIPOS',
    descripcion: 'Equipos asociados a cada club.',
    columnas: [
      { key: 'id', label: 'ID', editable: false },
      { key: 'club', label: 'Club' },
      { key: 'nombre', label: 'Equipo' },
    ],
    filas: [],
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
  };
}

function crearListasBase() {
  return LISTAS_INICIALES.map((lista) => clonarLista(lista));
}

function leerListasGuardadas() {
  if (typeof localStorage === 'undefined') {
    return crearListasBase();
  }

  try {
    const persistidas = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_LEGACY);
    const guardadas = JSON.parse(persistidas);
    if (!Array.isArray(guardadas)) return crearListasBase();
    return normalizarListas(guardadas);
  } catch (_) {
    return crearListasBase();
  }
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

  return LISTAS_INICIALES.map((baseLista) => {
    const guardada = listasPorId.get(baseLista.id);
    if (!guardada) return clonarLista(baseLista);

    const filasGuardadas = Array.isArray(guardada.filas) ? guardada.filas : [];
    return {
      ...clonarLista(baseLista),
      ...guardada,
      id: baseLista.id,
      titulo: baseLista.titulo,
      descripcion: baseLista.descripcion,
      columnas: clonarLista(baseLista).columnas,
      filas: filasGuardadas.length > 0
        ? filasGuardadas.map((fila, indice) => normalizarFila(baseLista, fila, indice))
        : clonarLista(baseLista).filas,
    };
  });
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
