import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TableScroll from '../components/TableScroll';
import { CLUBES } from '../context/ClubContext';
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

export default function MisEquipos() {
  const { user } = useAuth();

  const equipos = useMemo(
    () =>
      CLUBES.flatMap((club) =>
        obtenerMsEquiposPorClub(club.valor).map((equipo) => ({
          ...equipo,
          clubLabel: club.label,
        }))
      ),
    []
  );
  const puedeEditar = ['administrador', 'director'].includes(user?.rol);

  return (
    <div className="w-full px-4 py-6 sm:px-6 space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Catalogo maestro</p>
        <h2 className="text-2xl font-bold text-club-black">Mis equipos</h2>
        <p className="mt-1 text-sm text-club-black/60">
          Equipos internos de ROMO FC y ARENAS CLUB, con su abreviatura para sesiones, partidos y filtros.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
            <div>
              <h3 className="text-lg font-bold text-club-black">Todos los equipos</h3>
              <p className="text-sm text-club-black/60">
                {equipos.length} equipos cargados de {CLUBES.map((club) => club.label).join(' y ')}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {puedeEditar && (
                <Link
                  to="/listas/equipos"
                  className="inline-flex items-center rounded-full border border-club-red/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-club-red transition-colors hover:bg-club-red/10"
                >
                  Editar equipos
                </Link>
              )}
              <span className="rounded-full bg-club-red/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-club-red">
                Todos
              </span>
            </div>
          </div>
          {puedeEditar && (
            <div className="px-4 pb-4 pt-1 text-sm text-club-black/55 sm:px-6">
              Puedes ajustar el nombre, la abreviatura y el orden desde el editor maestro.
            </div>
          )}

          <TableScroll className="overflow-x-auto">
            <table className="min-w-[800px] w-full divide-y divide-gray-100">
              <thead className="bg-club-black text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Club</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo completo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Abreviatura</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Orden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {equipos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-club-black/60">
                      No hay equipos cargados.
                    </td>
                  </tr>
                ) : (
                  equipos.map((equipo) => (
                    <tr key={`${equipo.club}-${equipo.nombre}`} className="hover:bg-red-50/40 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-club-black">{equipo.clubLabel}</td>
                      <td className="px-4 py-3 text-sm text-club-black/80">{equipo.nombre}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-club-black">{nombreEquipoCompleto(equipo)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-club-red">{etiquetaAbreviatura(equipo.abreviatura)}</td>
                      <td className="px-4 py-3 text-sm text-club-black/70">{equipo.orden}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
      </section>
    </div>
  );
}
