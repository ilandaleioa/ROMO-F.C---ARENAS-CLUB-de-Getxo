import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { actualizarFilaLista, actualizarLista, crearFilaLista, eliminarFilaLista, useListas } from '../lib/listas';
import { compararEquipos } from '../lib/equiposOrden';
import TableScroll from './TableScroll';

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function textoLimpio(valor) {
  return String(valor ?? '').trim();
}

function normalizarComparacion(valor) {
  return textoLimpio(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function normalizarClave(valor) {
  return textoLimpio(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function esRomoClub(valor) {
  return normalizarClave(valor) === 'ROMOFC';
}

function compararConRomoPrimero(valorA, valorB) {
  const romoA = esRomoClub(valorA);
  const romoB = esRomoClub(valorB);

  if (romoA !== romoB) return romoA ? -1 : 1;
  return textoLimpio(valorA).localeCompare(textoLimpio(valorB), 'es', { sensitivity: 'base' });
}

function ordenarEquiposPersonalizado(_club, a, b) {
  return compararEquipos(a, b);
}

function formularioInicial(lista, fila = null, opciones = {}) {
  return lista.columnas.reduce(
    (formulario, columna) => ({
      ...formulario,
      [columna.key]:
        fila && Object.prototype.hasOwnProperty.call(fila, columna.key)
          ? fila[columna.key] || ''
          : columna.key === 'id'
            ? generarId()
            : lista.id === 'equipos' && columna.key === 'club'
              ? opciones.clubPorDefecto || ''
              : '',
    }),
    lista.id === 'clubes' && fila?.valor !== undefined ? { valor: fila.valor || '' } : {}
  );
}

function construirFila(lista, formulario) {
  const fila = Object.fromEntries(
    lista.columnas.map((columna) => [
      columna.key,
      columna.tipo === 'imagen' ? String(formulario[columna.key] || '') : String(formulario[columna.key] || '').trim(),
    ])
  );

  if (lista.id === 'clubes') {
    fila.valor = String(formulario.valor || '').trim();
  }

  return fila;
}

function camposObligatorios(lista) {
  return lista.columnas.filter(
    (columna) => columna.key !== 'id' && columna.tipo !== 'imagen' && columna.obligatorio !== false
  );
}

export function obtenerClubesDisponibles(listaClubes) {
  const opciones = [];
  const vistos = new Set();

  (listaClubes?.filas || []).forEach((fila) => {
    const valor = textoLimpio(fila?.nombre || fila?.valor);
    if (!valor) return;

    const clave = normalizarComparacion(valor);
    if (vistos.has(clave)) return;

    vistos.add(clave);
    opciones.push({ value: valor, label: valor });
  });

  return opciones.sort((a, b) => compararConRomoPrimero(a.label, b.label));
}

function obtenerEtiquetaClub(valor, clubesDisponibles) {
  const texto = textoLimpio(valor);
  if (!texto) return 'Sin club';

  const coincidencia = clubesDisponibles.find(
    (opcion) => normalizarComparacion(opcion.value) === normalizarComparacion(texto)
  );
  return coincidencia?.label || texto;
}

function agruparEquiposPorClub(filas, clubesDisponibles) {
  const grupos = new Map();

  (filas || []).forEach((fila) => {
    const club = textoLimpio(fila?.club) || 'Sin club';
    const equipo = textoLimpio(fila?.nombre) || 'Sin nombre';

    if (!grupos.has(club)) {
      grupos.set(club, []);
    }

    grupos.get(club).push({
      id: fila?.id || equipo,
      nombre: equipo,
      nombreFederacion: textoLimpio(fila?.nombre_federacion),
    });
  });

  return Array.from(grupos.entries())
    .map(([club, equipos]) => ({
      club,
      etiqueta: obtenerEtiquetaClub(club, clubesDisponibles),
      equipos: Array.from(
        new Map(equipos.map((equipo) => [normalizarComparacion(equipo.nombre), equipo])).values()
      ).sort((a, b) => ordenarEquiposPersonalizado(club, a.nombre, b.nombre)),
    }))
    .sort((a, b) => compararConRomoPrimero(a.etiqueta, b.etiqueta));
}

function agruparEquiposPorClubTabla(filas = []) {
  const equiposPorClub = new Map();

  filas.forEach((fila) => {
    const club = textoLimpio(fila?.club);
    const equipo = textoLimpio(fila?.nombre);
    if (!club || !equipo) return;

    const clave = normalizarComparacion(club);
    if (!equiposPorClub.has(clave)) equiposPorClub.set(clave, []);
    equiposPorClub.get(clave).push({
      id: fila?.id || equipo,
      nombre: equipo,
      nombreFederacion: textoLimpio(fila?.nombre_federacion),
    });
  });

  equiposPorClub.forEach((equipos, clave) => {
    equiposPorClub.set(
      clave,
      Array.from(new Map(equipos.map((equipo) => [normalizarComparacion(equipo.nombre), equipo])).values()).sort((a, b) =>
        ordenarEquiposPersonalizado(clave, a.nombre, b.nombre)
      )
    );
  });

  return equiposPorClub;
}

export default function ListaEditable({
  lista,
  clubesDisponibles = [],
  filaAutoEdicion = null,
  autoEdicionKey = '',
  clubEnfocado = '',
  filtroClub = '',
}) {
  const { user } = useAuth();
  const listas = useListas();
  const esAdministrador = user?.rol === 'administrador';
  const columnasVisibles = (esAdministrador ? lista.columnas : lista.columnas.filter((columna) => columna.key !== 'id')).filter(
    (columna) => !(lista.id === 'clubes' && columna.key === 'escudo')
  );
  const clubPorDefecto = clubesDisponibles[0]?.value || '';
  const [formulario, setFormulario] = useState(() => formularioInicial(lista, null, { clubPorDefecto }));
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filaOriginal, setFilaOriginal] = useState(null);
  const [error, setError] = useState('');
  const [equipoEnEdicion, setEquipoEnEdicion] = useState(null);
  const [nombreEquipoEditado, setNombreEquipoEditado] = useState('');
  const [errorEquipo, setErrorEquipo] = useState('');
  const listaEquipos = useMemo(() => listas.find((item) => item.id === 'equipos') || null, [listas]);
  const formSectionRef = useRef(null);

  const filasOrdenadas = useMemo(() => {
    if (lista.id === 'clubes') {
      const filasFiltradas = filtroClub
        ? lista.filas.filter((fila) => normalizarComparacion(fila?.nombre || fila?.valor).includes(filtroClub))
        : lista.filas;

      return [...filasFiltradas].sort((a, b) =>
        compararConRomoPrimero(textoLimpio(a?.nombre || a?.valor), textoLimpio(b?.nombre || b?.valor))
      );
    }

    if (lista.id !== 'equipos') return lista.filas;

    return [...lista.filas].sort((a, b) => {
      const clubA = obtenerEtiquetaClub(a?.club, clubesDisponibles);
      const clubB = obtenerEtiquetaClub(b?.club, clubesDisponibles);
      const comparacionClub = compararConRomoPrimero(clubA, clubB);
      if (comparacionClub !== 0) return comparacionClub;

      const equipoA = textoLimpio(a?.nombre);
      const equipoB = textoLimpio(b?.nombre);
      return ordenarEquiposPersonalizado(clubA, equipoA, equipoB);
    });
  }, [clubesDisponibles, filtroClub, lista.filas, lista.id]);

  const gruposEquipos = useMemo(
    () => (lista.id === 'equipos' ? agruparEquiposPorClub(filasOrdenadas, clubesDisponibles) : []),
    [clubesDisponibles, filasOrdenadas, lista.id]
  );
  const equiposPorClub = useMemo(
    () => (lista.id === 'clubes' ? agruparEquiposPorClubTabla(listaEquipos?.filas || []) : new Map()),
    [lista.id, listaEquipos]
  );

  const equiposClubEnEdicion = useMemo(() => {
    if (lista.id !== 'clubes' || !editandoId || !filaOriginal) return [];
    const clubNombre = textoLimpio(filaOriginal.nombre || filaOriginal.valor);
    if (!clubNombre) return [];
    return equiposPorClub.get(normalizarComparacion(clubNombre)) || [];
  }, [lista.id, editandoId, filaOriginal, equiposPorClub]);

  const camposUnicos = lista.id === 'equipos' ? ['club', 'nombre'] : camposObligatorios(lista).map((columna) => columna.key);

  const opcionesClubFormulario = useMemo(() => {
    if (lista.id !== 'equipos') return [];

    const opciones = [...clubesDisponibles];
    const valorActual = textoLimpio(formulario.club);
    if (valorActual && !opciones.some((opcion) => normalizarComparacion(opcion.value) === normalizarComparacion(valorActual))) {
      opciones.unshift({ value: valorActual, label: valorActual });
    }
    return opciones;
  }, [clubesDisponibles, formulario.club, lista.id]);

  const limpiarFormulario = () => {
    setFormulario(formularioInicial(lista, null, { clubPorDefecto }));
    setEditandoId(null);
    setFilaOriginal(null);
    setFormAbierto(false);
    setError('');
  };

  const abrirCrear = () => {
    setFormulario(formularioInicial(lista, null, { clubPorDefecto }));
    setEditandoId(null);
    setFilaOriginal(null);
    setFormAbierto(true);
    setError('');
  };

  const abrirEdicion = (fila) => {
    setFormulario(formularioInicial(lista, fila, { clubPorDefecto }));
    setEditandoId(fila.id);
    setFilaOriginal(fila);
    setFormAbierto(true);
    setError('');
  };

  const cambiarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    setError('');
  };

  const cambiarEscudo = (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen.');
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      setFormulario((actual) => ({ ...actual, escudo: lector.result || '' }));
      setError('');
    };
    lector.onerror = () => setError('No se pudo leer la imagen.');
    lector.readAsDataURL(archivo);
  };

  const abrirEdicionEquipo = (club, equipo) => {
    setEquipoEnEdicion({ club, id: equipo.id });
    setNombreEquipoEditado(equipo.nombre);
    setErrorEquipo('');
  };

  const cancelarEdicionEquipo = () => {
    setEquipoEnEdicion(null);
    setNombreEquipoEditado('');
    setErrorEquipo('');
  };

  const guardarNombreEquipo = (evento, club, equipo) => {
    evento.preventDefault();
    const nombreNuevo = textoLimpio(nombreEquipoEditado);

    if (!nombreNuevo) {
      setErrorEquipo('Escribe un nombre para el equipo.');
      return;
    }

    const existeOtroEquipo = (listaEquipos?.filas || []).some(
      (fila) =>
        fila.id !== equipo.id &&
        normalizarComparacion(fila.club) === normalizarComparacion(club) &&
        normalizarComparacion(fila.nombre) === normalizarComparacion(nombreNuevo)
    );

    if (existeOtroEquipo) {
      setErrorEquipo('Ya existe otro equipo con ese nombre en este club.');
      return;
    }

    actualizarFilaLista('equipos', equipo.id, { nombre: nombreNuevo });
    cancelarEdicionEquipo();
  };

  const eliminar = (fila) => {
    const nombreFila = textoLimpio(fila?.nombre || fila?.valor || fila?.club || fila?.id);
    const relacionadoCount =
      lista.id === 'clubes'
        ? (listaEquipos?.filas || []).filter(
            (equipo) => normalizarComparacion(equipo?.club) === normalizarComparacion(nombreFila)
          ).length
        : 0;

    const mensaje =
      lista.id === 'clubes'
        ? `¿Quieres borrar el club "${nombreFila || 'sin nombre'}"?${relacionadoCount > 0 ? ` También se borrarán ${relacionadoCount} equipo${relacionadoCount === 1 ? '' : 's'} asociados.` : ''}`
        : `¿Quieres borrar el equipo "${nombreFila || 'sin nombre'}"?`;

    if (!window.confirm(mensaje)) return;

    if (lista.id === 'clubes') {
      (listaEquipos?.filas || [])
        .filter((equipo) => normalizarComparacion(equipo?.club) === normalizarComparacion(nombreFila))
        .forEach((equipo) => eliminarFilaLista('equipos', equipo.id));
    }

    eliminarFilaLista(lista.id, fila.id);

    if (editandoId === fila.id) {
      limpiarFormulario();
    }
  };

  const guardar = (evento) => {
    evento.preventDefault();

    const fila = construirFila(lista, formulario);
    const camposRequeridos = camposObligatorios(lista);
    if (camposRequeridos.some((columna) => !fila[columna.key])) {
      setError('Completa todos los campos.');
      return;
    }

    const filaDuplicada = lista.filas.some((actual) => {
      if (editandoId && actual.id === editandoId) return false;
      return camposUnicos.every((campo) => normalizarComparacion(actual?.[campo]) === normalizarComparacion(fila?.[campo]));
    });

    if (filaDuplicada) {
      setError('Este valor ya existe en la lista.');
      return;
    }

    if (editandoId) {
      actualizarFilaLista(lista.id, editandoId, fila);
      if (lista.id === 'clubes') {
        const clubAnterior = textoLimpio(filaOriginal?.nombre || filaOriginal?.valor);
        const clubNuevo = textoLimpio(fila.nombre || fila.valor);

        if (clubAnterior && clubNuevo && normalizarComparacion(clubAnterior) !== normalizarComparacion(clubNuevo)) {
          actualizarLista('equipos', (listaEquiposActual) => ({
            ...listaEquiposActual,
            filas: listaEquiposActual.filas.map((equipo) =>
              normalizarComparacion(equipo?.club) === normalizarComparacion(clubAnterior)
                ? { ...equipo, club: clubNuevo }
                : equipo
            ),
          }));
        }
      }
    } else {
      crearFilaLista(lista.id, fila);
    }

    limpiarFormulario();
  };

  useEffect(() => {
    if (lista.id !== 'equipos') return;
    if (!filaAutoEdicion || !autoEdicionKey) return;

    abrirEdicion(filaAutoEdicion);
  }, [autoEdicionKey, filaAutoEdicion, lista.id]);

  useEffect(() => {
    if (!formAbierto) return;

    const seccionFormulario = formSectionRef.current;
    if (!seccionFormulario) return;

    seccionFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const primerCampo = seccionFormulario.querySelector(
      'input:not([type="hidden"]):not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    if (primerCampo && typeof primerCampo.focus === 'function') {
      primerCampo.focus();
    }
  }, [formAbierto]);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-wide text-club-black">{lista.titulo}</h3>
            <p className="mt-1 text-sm text-club-black/60">{lista.descripcion}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (formAbierto) {
                  limpiarFormulario();
                } else {
                  abrirCrear();
                }
              }}
              className="rounded-md bg-club-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-club-redDark"
            >
              {formAbierto ? 'Cancelar' : '+ Crear'}
            </button>
            <span className="rounded-full bg-club-red/10 px-2.5 py-1 text-xs font-bold text-club-red">
              {filtroClub ? `${filasOrdenadas.length}/${lista.filas.length}` : lista.filas.length}
            </span>
          </div>
        </div>
      </div>

      {lista.id === 'equipos' && (
        <div className="border-b border-gray-200 bg-slate-50/70 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-club-black">Equipos por club</span>
            <span className="text-xs text-club-black/55">Cada club se puede desplegar para ver sus equipos.</span>
          </div>
          <div className="mt-3 space-y-2">
            {gruposEquipos.length === 0 ? (
              <p className="text-sm text-club-black/50">Aun no hay equipos creados.</p>
            ) : (
              gruposEquipos.map((grupo, indiceGrupo) => (
                <details
                  key={`${grupo.club}-${indiceGrupo}`}
                  className="group rounded-lg border border-gray-200 bg-white"
                  open={clubEnfocado
                    ? normalizarComparacion(grupo.club) === normalizarComparacion(clubEnfocado)
                    : undefined}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-club-black [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 truncate">{grupo.etiqueta}</span>
                    <span className="flex items-center gap-2 text-xs font-medium text-club-black/55">
                      <span>{grupo.equipos.length} equipo{grupo.equipos.length === 1 ? '' : 's'}</span>
                      <span className="text-club-red transition-transform group-open:rotate-180">▾</span>
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 px-3 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-club-black/55">
                        Pulsa editar en cualquier equipo para abrirlo directamente en la pantalla de equipos.
                      </p>
                      <Link
                        to={`/listas/equipos?club=${encodeURIComponent(grupo.club)}`}
                        className="shrink-0 rounded-full border border-club-red/20 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-club-red transition-colors hover:bg-red-50"
                      >
                        Gestionar equipos
                      </Link>
                    </div>
                    {grupo.equipos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {grupo.equipos.map((equipo) => (
                          <div
                            key={`${grupo.club}-${equipo.id || equipo.nombre}`}
                            className="inline-flex items-center gap-2 rounded-full bg-club-red/10 px-3 py-1 text-xs font-semibold text-club-red"
                          >
                            {equipoEnEdicion?.id === equipo.id ? (
                              <form
                                onSubmit={(evento) => guardarNombreEquipo(evento, grupo.club, equipo)}
                                className="flex min-w-[230px] flex-wrap items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={nombreEquipoEditado}
                                  onChange={(evento) => {
                                    setNombreEquipoEditado(evento.target.value);
                                    setErrorEquipo('');
                                  }}
                                  className="min-w-[150px] flex-1 rounded-md border border-club-red/30 bg-white px-2 py-1 text-xs font-medium text-club-black outline-none focus:border-club-red focus:ring-1 focus:ring-club-red"
                                  aria-label={`Nuevo nombre de ${equipo.nombre}`}
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  className="rounded-full bg-club-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-club-redDark"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelarEdicionEquipo}
                                  className="rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-white/40"
                                >
                                  Cancelar
                                </button>
                                {errorEquipo && (
                                  <span className="basis-full text-[10px] font-medium text-red-700">{errorEquipo}</span>
                                )}
                              </form>
                            ) : (
                              <>
                                <span className="min-w-0">
                                  <span className="block truncate">{equipo.nombre}</span>
                                  {equipo.nombreFederacion && (
                                    <span className="block max-w-[220px] truncate text-[10px] font-normal text-club-black/55">
                                      Fed: {equipo.nombreFederacion}
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => abrirEdicionEquipo(grupo.club, equipo)}
                                  className="rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-white/40"
                                  title={`Editar ${equipo.nombre}`}
                                >
                                  Editar
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-club-black/50">Este club no tiene equipos asociados.</p>
                    )}
                  </div>
                </details>
              ))
            )}
          </div>
        </div>
      )}

      {formAbierto && (
        <form
          ref={formSectionRef}
          onSubmit={guardar}
          className="border-b border-gray-200 bg-red-50/40 px-4 py-4 sm:px-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-club-black">{editandoId ? 'Editar fila' : 'Nueva fila'}</h4>
            <p className="text-xs text-club-black/55">
              {editandoId ? 'Ajusta los campos y guarda los cambios.' : 'Rellena los campos para crear una fila nueva.'}
            </p>
          </div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-md bg-club-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-club-black/80"
            >
              {editandoId ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
          {lista.id === 'equipos' && (
            <p className="mb-3 rounded-md border border-club-red/15 bg-white px-3 py-2 text-xs text-club-black/60">
              El nombre federación sirve para identificar el equipo en la competición. El equipo interno es el nombre que utiliza la aplicación.
            </p>
          )}
          {error ? <p className="mb-3 text-sm font-medium text-club-red">{error}</p> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(esAdministrador ? lista.columnas : lista.columnas.filter((columna) => columna.key !== 'id')).map((columna) => {
              if (lista.id === 'equipos' && columna.key === 'club') {
                return (
                  <label key={columna.key} className="text-xs font-semibold uppercase tracking-wide text-club-black/70">
                    {columna.label}
                    {opcionesClubFormulario.length > 0 ? (
                      <select
                        value={formulario[columna.key]}
                        onChange={(evento) => cambiarCampo(columna.key, evento.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      >
                        {opcionesClubFormulario.map((club) => (
                          <option key={club.value} value={club.value}>
                            {club.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formulario[columna.key]}
                        onChange={(evento) => cambiarCampo(columna.key, evento.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                        placeholder="Crea primero los clubes"
                      />
                    )}
                  </label>
                );
              }

              if (columna.tipo === 'imagen') {
                return (
                  <label key={columna.key} className="text-xs font-semibold uppercase tracking-wide text-club-black/70">
                    {columna.label}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={cambiarEscudo}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black file:mr-3 file:rounded file:border-0 file:bg-club-red file:px-3 file:py-1 file:font-semibold file:text-white"
                    />
                    {formulario[columna.key] && (
                      <img
                        src={formulario[columna.key]}
                        alt="Vista previa del escudo"
                        className="mt-2 h-12 w-12 rounded-full border border-gray-200 object-contain"
                      />
                    )}
                  </label>
                );
              }

              const esId = columna.key === 'id';
              const esOpcional = columna.obligatorio === false;
              const etiquetaColumna = columna.key === 'nombre_federacion' ? 'Nombre FED' : columna.label;
              return (
                <label key={columna.key} className="text-xs font-semibold uppercase tracking-wide text-club-black/70">
                  {etiquetaColumna}{esOpcional ? ' (opcional)' : ''}
                  <input
                    type="text"
                    value={formulario[columna.key]}
                    onChange={(evento) => cambiarCampo(columna.key, evento.target.value)}
                    readOnly={esId}
                    disabled={esId}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:outline-none focus:ring-2 focus:ring-club-red ${
                      esId ? 'border-gray-200 bg-gray-100 text-club-black/55' : 'border-gray-300 bg-white'
                    }`}
                    placeholder={columna.key === 'nombre_federacion' ? 'Ej. ROMO F.C. JUVENIL A' : ''}
                    autoFocus={!esId && columna === lista.columnas.find((campo) => campo.key !== 'id')}
                  />
                </label>
              );
            })}
          </div>

          {lista.id === 'clubes' && editandoId && (
            <div className="mt-4 border-t border-club-red/15 pt-4">
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-club-black/70">
                Equipos asociados
              </h5>
              {equiposClubEnEdicion.length === 0 ? (
                <p className="text-sm text-club-black/50">Este club no tiene equipos asociados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {equiposClubEnEdicion.map((equipo) => (
                    <div
                      key={`editar-club-equipo-${equipo.id || equipo.nombre}`}
                      className="inline-flex items-center gap-2 rounded-full bg-club-red/10 px-3 py-1 text-xs font-semibold text-club-red"
                    >
                      {equipoEnEdicion?.id === equipo.id ? (
                        <form
                          onSubmit={(evento) =>
                            guardarNombreEquipo(evento, textoLimpio(filaOriginal?.nombre || filaOriginal?.valor), equipo)
                          }
                          className="flex min-w-[230px] flex-wrap items-center gap-2"
                        >
                          <input
                            type="text"
                            value={nombreEquipoEditado}
                            onChange={(evento) => {
                              setNombreEquipoEditado(evento.target.value);
                              setErrorEquipo('');
                            }}
                            className="min-w-[150px] flex-1 rounded-md border border-club-red/30 bg-white px-2 py-1 text-xs font-medium text-club-black outline-none focus:border-club-red focus:ring-1 focus:ring-club-red"
                            aria-label={`Nuevo nombre de ${equipo.nombre}`}
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-club-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-club-redDark"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelarEdicionEquipo}
                            className="rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-white/40"
                          >
                            Cancelar
                          </button>
                          {errorEquipo && (
                            <span className="basis-full text-[10px] font-medium text-red-700">{errorEquipo}</span>
                          )}
                        </form>
                      ) : (
                        <>
                          <span className="min-w-0">
                            <span className="block truncate">{equipo.nombre}</span>
                            {equipo.nombreFederacion && (
                              <span className="block max-w-[220px] truncate text-[10px] font-normal text-club-black/55">
                                Fed: {equipo.nombreFederacion}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              abrirEdicionEquipo(textoLimpio(filaOriginal?.nombre || filaOriginal?.valor), equipo)
                            }
                            className="rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-white/40"
                            title={`Editar ${equipo.nombre}`}
                          >
                            Editar
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      )}

      <TableScroll className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-club-black text-white">
            <tr>
              <th className="w-16 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">#</th>
              {columnasVisibles.map((columna) => (
                <th key={columna.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {columna.key === 'nombre_federacion' ? 'Nombre FED' : columna.label}
                </th>
              ))}
              {lista.id === 'clubes' && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipos asociados</th>
              )}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filasOrdenadas.length > 0 ? filasOrdenadas.map((fila, indice) => (
              <tr
                key={`${lista.id}-${fila.id || fila.nombre || fila.club || 'fila'}-${indice}`}
                className={`transition-colors hover:bg-red-50/40 ${
                  lista.id === 'clubes' && esRomoClub(fila?.nombre || fila?.valor) ? 'bg-red-50/70 ring-1 ring-inset ring-club-red/15' : ''
                }`}
              >
                <td className="px-4 py-3 text-club-black/45">{indice + 1}</td>
                {columnasVisibles.map((columna) => (
                  <td key={columna.key} className="px-4 py-3 font-medium text-club-black/80">
                    {lista.id === 'clubes' && columna.key === 'nombre' ? (
                      <div className="inline-flex items-center gap-3">
                        {fila.escudo ? (
                          <img
                            src={fila.escudo}
                            alt={`Escudo de ${fila.nombre}`}
                            className="h-9 w-9 shrink-0 rounded-full border border-gray-200 bg-white object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[10px] font-bold uppercase text-club-black/40">
                            {String(fila.nombre || '?')
                              .trim()
                              .slice(0, 2)}
                          </span>
                        )}
                        <span className={esRomoClub(fila?.nombre || fila?.valor) ? 'font-bold text-club-red' : ''}>{fila[columna.key]}</span>
                        {esRomoClub(fila?.nombre || fila?.valor) && (
                          <span className="rounded-full bg-club-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                            Destacado
                          </span>
                        )}
                      </div>
                    ) : lista.id === 'equipos' && columna.key === 'club' ? (
                      <span className="inline-flex rounded-full bg-club-red/10 px-2.5 py-1 text-xs font-semibold text-club-red">
                        {obtenerEtiquetaClub(fila[columna.key], clubesDisponibles)}
                      </span>
                    ) : lista.id === 'equipos' && columna.key === 'nombre_federacion' ? (
                      fila[columna.key] || <span className="text-club-black/40">Sin asignar</span>
                    ) : columna.tipo === 'imagen' ? (
                      fila[columna.key] ? (
                        <img
                          src={fila[columna.key]}
                          alt={`Escudo de ${fila.nombre}`}
                          className="h-9 w-9 object-contain"
                        />
                      ) : (
                        <span className="text-club-black/40">Sin escudo</span>
                      )
                    ) : (
                      fila[columna.key]
                    )}
                  </td>
                ))}
                {lista.id === 'clubes' && (() => {
                  const equipos = equiposPorClub.get(normalizarComparacion(fila.nombre)) || [];
                  const esFilaRomo = esRomoClub(fila?.nombre || fila?.valor);

                  return (
                    <td className="px-4 py-3 text-club-black/80">
                      {equipos.length > 0 ? (
                        <details className="group max-w-xl">
                          <summary
                            className={`flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden ${
                              esFilaRomo ? 'text-club-red' : 'text-club-black'
                            }`}
                          >
                            <span>{equipos.length} equipo{equipos.length === 1 ? '' : 's'}</span>
                            <span className="text-club-red transition-transform group-open:rotate-180">⌄</span>
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {equipos.map((equipo) => (
                              <Link
                                key={`${fila.id}-${equipo.id || equipo.nombre}`}
                                to={`/listas/equipos?club=${encodeURIComponent(fila.nombre)}&equipo=${encodeURIComponent(equipo.nombre)}`}
                                title={`Editar ${equipo.nombre}`}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  esFilaRomo
                                    ? 'border border-club-red/20 bg-club-red text-white shadow-sm'
                                    : 'bg-club-red/10 text-club-red'
                                }`}
                              >
                                <span>
                                  <span className="block">{equipo.nombre}</span>
                                  {equipo.nombreFederacion && (
                                    <span className="block text-[10px] font-normal opacity-75">Fed: {equipo.nombreFederacion}</span>
                                  )}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <span className="text-sm text-club-black/45">Sin equipos asociados</span>
                      )}
                    </td>
                  );
                })()}
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(fila)}
                      className="rounded-md border border-club-red/20 px-3 py-1.5 text-xs font-semibold text-club-red transition-colors hover:bg-red-50"
                    >
                      Editar
                    </button>
                    {(lista.id === 'clubes' || lista.id === 'equipos') && (
                      <button
                        type="button"
                        onClick={() => eliminar(fila)}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={columnasVisibles.length + (lista.id === 'clubes' ? 3 : 2)} className="px-4 py-8 text-center text-sm text-club-black/55">
                  {lista.id === 'clubes'
                    ? filtroClub
                      ? 'No se encontraron clubes con esa búsqueda.'
                      : 'No hay clubes disponibles.'
                    : 'No hay registros disponibles.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </section>
  );
}
