import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { actualizarFilaLista, crearFilaLista, useListas } from '../lib/listas';

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formularioInicial(lista, fila = null) {
  return lista.columnas.reduce(
    (formulario, columna) => ({
      ...formulario,
      [columna.key]:
        fila && Object.prototype.hasOwnProperty.call(fila, columna.key)
          ? fila[columna.key] || ''
          : columna.key === 'id'
            ? generarId()
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

function TablaLista({ lista }) {
  const { user } = useAuth();
  const esAdministrador = user?.rol === 'administrador';
  const columnasVisibles = esAdministrador ? lista.columnas : lista.columnas.filter((columna) => columna.key !== 'id');
  const [formulario, setFormulario] = useState(() => formularioInicial(lista));
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');

  const limpiarFormulario = () => {
    setFormulario(formularioInicial(lista));
    setEditandoId(null);
    setFormAbierto(false);
    setError('');
  };

  const abrirCrear = () => {
    setFormulario(formularioInicial(lista));
    setEditandoId(null);
    setFormAbierto(true);
    setError('');
  };

  const abrirEdicion = (fila) => {
    setFormulario(formularioInicial(lista, fila));
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
      return camposRequeridos.every(
        (columna) => String(actual[columna.key] || '').toLowerCase() === String(fila[columna.key] || '').toLowerCase()
      );
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
            {lista.filas.map((fila, indice) => (
              <tr key={`${lista.id}-${fila.id || fila.nombre}`} className="transition-colors hover:bg-red-50/40">
                <td className="px-4 py-3 text-club-black/45">{indice + 1}</td>
                {columnasVisibles.map((columna) => (
                  <td key={columna.key} className="px-4 py-3 font-medium text-club-black/80">
                    {columna.tipo === 'imagen' ? (
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

export default function Listas() {
  const listas = useListas();

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Configuracion</p>
        <h2 className="text-2xl font-bold text-club-black">Listas</h2>
        <p className="mt-1 text-sm text-club-black/60">Consulta las opciones maestras disponibles en la aplicacion.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {listas.map((lista) => (
          <TablaLista key={lista.id} lista={lista} />
        ))}
      </div>
    </div>
  );
}
