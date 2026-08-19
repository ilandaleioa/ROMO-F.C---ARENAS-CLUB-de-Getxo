import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import TableScroll from '../components/TableScroll';
import { CLUBES } from '../context/ClubContext';
import { actualizarFilaLista, useListas } from '../lib/listas';
import { obtenerMsEquiposPorClub } from '../data/msEquipos';

function etiquetaAbreviatura(valor) {
  const texto = String(valor || '').trim();
  return texto || '-';
}

function nombreEquipoCompleto(equipo) {
  const nombre = String(equipo?.nombre || '').trim();
  if (!nombre) return '-';
  if (/^ITZU\b/i.test(nombre)) return nombre;
  return [equipo?.club, nombre].filter(Boolean).join(' ') || '-';
}

function claveEquipo(club, nombre) {
  return `${String(club || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase()}|${String(nombre || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase()}`;
}

function claveClub(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function esClubMostrado(valor) {
  const clave = claveClub(valor);
  return clave.includes('ROMO') || clave.includes('ARENAS');
}

export default function MisEquipos() {
  const { user } = useAuth();
  const listas = useListas();
  const listaEquipos = listas.find((lista) => lista.id === 'equipos') || null;
  const [equipoEnEdicion, setEquipoEnEdicion] = useState(null);
  const [formularioEdicion, setFormularioEdicion] = useState({ nombre: '', nombre_federacion: '', abreviatura: '' });
  const [errorEdicion, setErrorEdicion] = useState('');
  const [editorAbierto, setEditorAbierto] = useState(false);

  const equipos = useMemo(
    () => {
      const metadatos = new Map(
        CLUBES.flatMap((club) => obtenerMsEquiposPorClub(club.valor)).map((equipo) => [
          `${equipo.club}|${equipo.nombre}`,
          equipo,
        ])
      );
      const metadatosPorId = new Map(
        CLUBES.flatMap((club) => obtenerMsEquiposPorClub(club.valor)).map((equipo) => [
          `equipo-${claveEquipo(equipo.club, equipo.nombre).replace('|', '-')}`,
          equipo,
        ])
      );
      const clubesPorClave = new Map(CLUBES.map((club) => [claveClub(club.valor), club]));

      return (listaEquipos?.filas || []).filter((fila) => esClubMostrado(fila.club)).map((fila) => {
        const metadato =
          metadatosPorId.get(fila.id) || metadatos.get(`${fila.club}|${fila.nombre}`) || {};
        const club = clubesPorClave.get(claveClub(fila.club)) || { label: fila.club };

        return {
          ...metadato,
          ...fila,
          clubLabel: club.label,
        };
      });
    },
    [listaEquipos]
  );
  const puedeEditar = ['administrador', 'director'].includes(user?.rol);

  const abrirEdicion = (equipo) => {
    setEquipoEnEdicion(equipo.id);
    setFormularioEdicion({
      nombre: equipo.nombre || '',
      nombre_federacion: equipo.nombre_federacion || '',
      abreviatura: equipo.abreviatura || '',
    });
    setErrorEdicion('');
    setEditorAbierto(true);
  };

  const abrirEditorEquipos = () => {
    const primerEquipo = equipos[0];
    if (primerEquipo) abrirEdicion(primerEquipo);
  };

  const cancelarEdicion = () => {
    setEquipoEnEdicion(null);
    setFormularioEdicion({ nombre: '', nombre_federacion: '', abreviatura: '' });
    setErrorEdicion('');
    setEditorAbierto(false);
  };

  const guardarEdicion = (evento, equipo) => {
    evento.preventDefault();
    const nombre = String(formularioEdicion.nombre || '').trim();
    const nombreFederacion = String(formularioEdicion.nombre_federacion || '').trim();
    const abreviatura = String(formularioEdicion.abreviatura || '').trim();

    if (!nombre) {
      setErrorEdicion('El nombre del equipo es obligatorio.');
      return;
    }

    const duplicado = (listaEquipos?.filas || []).some(
      (fila) =>
        fila.id !== equipo.id &&
        String(fila.club || '').trim().toLowerCase() === String(equipo.club || '').trim().toLowerCase() &&
        String(fila.nombre || '').trim().toLowerCase() === nombre.toLowerCase()
    );

    if (duplicado) {
      setErrorEdicion('Ya existe otro equipo con ese nombre en este club.');
      return;
    }

    actualizarFilaLista('equipos', equipo.id, {
      nombre,
      nombre_federacion: nombreFederacion,
      abreviatura,
    });
    cancelarEdicion();
  };

  return (
    <div className="w-full px-4 py-6 sm:px-6 space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-end gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              {puedeEditar && (
                <button
                  type="button"
                  onClick={abrirEditorEquipos}
                  disabled={equipos.length === 0}
                  className="inline-flex items-center rounded-full border border-club-red/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-club-red transition-colors hover:bg-club-red/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar equipos
                </button>
              )}
              <span className="rounded-full bg-club-red/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-club-red">
                Todos
              </span>
            </div>
          </div>

          <TableScroll className="overflow-x-auto">
            <table className="min-w-[1050px] w-full divide-y divide-gray-100">
              <thead className="bg-club-black text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Club</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo completo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nombre FED</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Abreviatura</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Orden</th>
                  {puedeEditar && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {equipos.length === 0 ? (
                  <tr>
                    <td colSpan={puedeEditar ? 7 : 6} className="px-4 py-8 text-center text-sm text-club-black/60">
                      No hay equipos cargados.
                    </td>
                  </tr>
                ) : (
                  equipos.map((equipo) => {
                    return (
                      <tr key={`${equipo.club}-${equipo.id || equipo.nombre}`} className="hover:bg-red-50/40 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-club-black">{equipo.clubLabel}</td>
                        <td className="px-4 py-3 text-sm text-club-black/80">{equipo.nombre}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-club-black">{nombreEquipoCompleto(equipo)}</td>
                        <td className="px-4 py-3 text-sm text-club-black/80">
                          {String(equipo.nombre_federacion || '').trim() || <span className="text-club-black/40">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-club-red">{etiquetaAbreviatura(equipo.abreviatura)}</td>
                        <td className="px-4 py-3 text-sm text-club-black/70">{equipo.orden}</td>
                        {puedeEditar && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => abrirEdicion(equipo)}
                              className="inline-flex rounded-full border border-club-red/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-club-red transition-colors hover:bg-club-red/10"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableScroll>
      </section>

      {editorAbierto && equipoEnEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-club-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-editor-equipos">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-club-black/45">Mis equipos</p>
                <h2 id="titulo-editor-equipos" className="mt-1 text-xl font-black text-club-black">Editar equipo</h2>
              </div>
              <button
                type="button"
                onClick={cancelarEdicion}
                className="rounded-full px-3 py-1 text-xl leading-none text-club-black/45 transition-colors hover:bg-gray-100 hover:text-club-black"
                aria-label="Cerrar editor de equipos"
              >
                ×
              </button>
            </div>

            <form onSubmit={(evento) => guardarEdicion(evento, equipos.find((equipo) => equipo.id === equipoEnEdicion))} className="space-y-4 px-5 py-5 sm:px-6">
              <label className="block text-xs font-bold uppercase tracking-wide text-club-black/70">
                Equipo
                <select
                  value={equipoEnEdicion}
                  onChange={(evento) => {
                    const equipo = equipos.find((item) => item.id === evento.target.value);
                    if (equipo) abrirEdicion(equipo);
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:border-club-red focus:outline-none focus:ring-1 focus:ring-club-red"
                >
                  {equipos.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.clubLabel} · {equipo.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-club-black/70">
                  Nombre interno
                  <input
                    type="text"
                    value={formularioEdicion.nombre}
                    onChange={(evento) => {
                      setFormularioEdicion((actual) => ({ ...actual, nombre: evento.target.value }));
                      setErrorEdicion('');
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:border-club-red focus:outline-none focus:ring-1 focus:ring-club-red"
                    autoFocus
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-club-black/70">
                  Nombre FED
                  <input
                    type="text"
                    value={formularioEdicion.nombre_federacion}
                    onChange={(evento) => {
                      setFormularioEdicion((actual) => ({ ...actual, nombre_federacion: evento.target.value }));
                      setErrorEdicion('');
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:border-club-red focus:outline-none focus:ring-1 focus:ring-club-red"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-club-black/70">
                  Abreviatura
                  <input
                    type="text"
                    value={formularioEdicion.abreviatura}
                    onChange={(evento) => {
                      setFormularioEdicion((actual) => ({ ...actual, abreviatura: evento.target.value }));
                      setErrorEdicion('');
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-club-black focus:border-club-red focus:outline-none focus:ring-1 focus:ring-club-red"
                  />
                </label>
              </div>

              {errorEdicion && <p className="text-sm font-medium text-red-700">{errorEdicion}</p>}

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-club-black/70 transition-colors hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-club-red px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-club-redDark"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
