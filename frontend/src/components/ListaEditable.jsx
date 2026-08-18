import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { actualizarFilaLista, crearFilaLista } from '../lib/listas';
import { EQUIPOS_POR_CLUB } from '../data/equipos';

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
  return textoLimpio(valor).toLocaleLowerCase('es');
}

function ordenarEquiposPersonalizado(a, b) {
  const indiceA = EQUIPOS_POR_CLUB.findIndex((nombre) => normalizarComparacion(nombre) === normalizarComparacion(a));
  const indiceB = EQUIPOS_POR_CLUB.findIndex((nombre) => normalizarComparacion(nombre) === normalizarComparacion(b));

  if (indiceA === -1 && indiceB === -1) {
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  }
  if (indiceA === -1) return 1;
  if (indiceB === -1) return -1;
  return indiceA - indiceB;
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
  return lista.columnas.filter((columna) => columna.key !== 'id' && columna.tipo !== 'imagen');
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

  return opciones;
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

    grupos.get(club).push(equipo);
  });

  return Array.from(grupos.entries())
    .map(([club, equipos]) => ({
      club,
      etiqueta: obtenerEtiquetaClub(club, clubesDisponibles),
      equipos: [...new Set(equipos)].sort(ordenarEquiposPersonalizado),
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { sensitivity: 'base' }));
}

export default function ListaEditable({ lista, clubesDisponibles = [] }) {
  const { user } = useAuth();
  const esAdministrador = user?.rol === 'administrador';
  const columnasVisibles = (esAdministrador ? lista.columnas : lista.columnas.filter((columna) => columna.key !== 'id')).filter(
    (columna) => !(lista.id === 'clubes' && columna.key === 'escudo')
  );
  const clubPorDefecto = clubesDisponibles[0]?.value || '';
  const [formulario, setFormulario] = useState(() => formularioInicial(lista, null, { clubPorDefecto }));
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');

  const filasOrdenadas = useMemo(() => {
    if (lista.id !== 'equipos') return lista.filas;

    return [...lista.filas].sort((a, b) => {
      const clubA = obtenerEtiquetaClub(a?.club, clubesDisponibles);
      const clubB = obtenerEtiquetaClub(b?.club, clubesDisponibles);
      const comparacionClub = clubA.localeCompare(clubB, 'es', { sensitivity: 'base' });
      if (comparacionClub !== 0) return comparacionClub;

      const equipoA = textoLimpio(a?.nombre);
      const equipoB = textoLimpio(b?.nombre);
      return ordenarEquiposPersonalizado(equipoA, equipoB);
    });
  }, [clubesDisponibles, lista.filas, lista.id]);

  const gruposEquipos = useMemo(
    () => (lista.id === 'equipos' ? agruparEquiposPorClub(filasOrdenadas, clubesDisponibles) : []),
    [clubesDisponibles, filasOrdenadas, lista.id]
  );

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
    setFormAbierto(false);
    setError('');
  };

  const abrirCrear = () => {
    setFormulario(formularioInicial(lista, null, { clubPorDefecto }));
    setEditandoId(null);
    setFormAbierto(true);
    setError('');
  };

  const abrirEdicion = (fila) => {
    setFormulario(formularioInicial(lista, fila, { clubPorDefecto }));
    setEditandoId(fila.id);
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
    } else {
      crearFilaLista(lista.id, fila);
    }

    limpiarFormulario();
  };

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
              {lista.filas.length}
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
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-club-black [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 truncate">{grupo.etiqueta}</span>
                    <span className="flex items-center gap-2 text-xs font-medium text-club-black/55">
                      <span>{grupo.equipos.length} equipo{grupo.equipos.length === 1 ? '' : 's'}</span>
                      <span className="text-club-red transition-transform group-open:rotate-180">▾</span>
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 px-3 py-3">
                    {grupo.equipos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {grupo.equipos.map((equipo) => (
                          <span
                            key={`${grupo.club}-${equipo}`}
                            className="inline-flex items-center rounded-full bg-club-red/10 px-3 py-1 text-xs font-semibold text-club-red"
                          >
                            {equipo}
                          </span>
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
        <form onSubmit={guardar} className="border-b border-gray-200 bg-red-50/40 px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-club-black">{editandoId ? 'Editar fila' : 'Nueva fila'}</h4>
            <p className="text-xs text-club-black/55">
              {editandoId ? 'Ajusta los campos y guarda los cambios.' : 'Rellena los campos para crear una fila nueva.'}
            </p>
          </div>
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
              return (
                <label key={columna.key} className="text-xs font-semibold uppercase tracking-wide text-club-black/70">
                  {columna.label}
                  <input
                    type="text"
                    value={formulario[columna.key]}
                    onChange={(evento) => cambiarCampo(columna.key, evento.target.value)}
                    readOnly={esId}
                    disabled={esId}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:outline-none focus:ring-2 focus:ring-club-red ${
                      esId ? 'border-gray-200 bg-gray-100 text-club-black/55' : 'border-gray-300 bg-white'
                    }`}
                    autoFocus={!esId && columna === lista.columnas.find((campo) => campo.key !== 'id')}
                  />
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {error ? <p className="text-sm font-medium text-club-red">{error}</p> : <span />}
            <button
              type="submit"
              className="rounded-md bg-club-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-club-black/80"
            >
              {editandoId ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-club-black text-white">
            <tr>
              <th className="w-16 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">#</th>
              {columnasVisibles.map((columna) => (
                <th key={columna.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {columna.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filasOrdenadas.map((fila, indice) => (
              <tr key={`${lista.id}-${fila.id || fila.nombre || fila.club || 'fila'}-${indice}`} className="transition-colors hover:bg-red-50/40">
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
                        <span>{fila[columna.key]}</span>
                      </div>
                    ) : lista.id === 'equipos' && columna.key === 'club' ? (
                      <span className="inline-flex rounded-full bg-club-red/10 px-2.5 py-1 text-xs font-semibold text-club-red">
                        {obtenerEtiquetaClub(fila[columna.key], clubesDisponibles)}
                      </span>
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
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => abrirEdicion(fila)}
                    className="rounded-md border border-club-red/20 px-3 py-1.5 text-xs font-semibold text-club-red transition-colors hover:bg-red-50"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
