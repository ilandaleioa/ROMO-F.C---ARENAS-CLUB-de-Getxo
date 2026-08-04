import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useClub } from '../context/ClubContext';

const CLUBES_INFO = {
  ROMO: { nombre: 'ROMO F.C.' },
  ARENAS: { nombre: 'ARENAS CLUB' },
};

function limpiarTexto(valor) {
  return String(valor || '').trim();
}

function textoBusqueda(valor) {
  return limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function inferirCategoria(equipo) {
  const texto = textoBusqueda(equipo);

  if (texto.includes('PREBENJAMIN')) return 'Prebenjamin';
  if (texto.includes('BENJAMIN')) return 'Benjamin';
  if (texto.includes('ALEV')) return 'Alevin';
  if (texto.includes('INFANTIL')) return 'Infantil';
  if (texto.includes('CADETE')) return 'Cadete';
  if (texto.includes('JUVENIL')) return 'Juvenil';

  return 'Sin categoria';
}

function anioNacimiento(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const fecha = new Date(fechaNacimiento);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.getFullYear();
}

function formatearAnios(anios) {
  const ordenados = Array.from(anios).sort((a, b) => a - b);
  if (ordenados.length === 0) return '-';
  if (ordenados.length === 1) return String(ordenados[0]);
  return `${ordenados[0]} - ${ordenados[ordenados.length - 1]}`;
}

function ordenarPorNombre(a, b) {
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

function Tabla({ titulo, descripcion, columnas, filas, emptyText }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-club-black">{titulo}</h3>
        {descripcion && <p className="text-sm text-club-black/60 mt-1">{descripcion}</p>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[640px] w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-club-black text-white">
            <tr>
              {columnas.map((columna) => (
                <th key={columna.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {columna.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="px-4 py-6 text-center text-club-black/60">
                  {emptyText}
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.id} className="hover:bg-red-50/40 transition-colors">
                  {columnas.map((columna) => (
                    <td key={columna.key} className="px-4 py-3 text-club-black/80">
                      {fila[columna.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Clubes() {
  const { club } = useClub();
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;

    async function cargarDatos() {
      setLoading(true);
      setError('');
      try {
        const { jugadores: data } = await api.get('/jugadores');
        if (!cancelado) setJugadores(data || []);
      } catch (err) {
        if (!cancelado) {
          setJugadores([]);
          setError(err.message);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    cargarDatos();
    return () => {
      cancelado = true;
    };
  }, [club]);

  const { tablaClub, tablaEquipos, tablaCategorias } = useMemo(() => {
    const equiposMap = new Map();

    jugadores.forEach((jugador) => {
      const nombreEquipo = limpiarTexto(jugador.equipo) || 'Sin equipo';
      const categoria = inferirCategoria(nombreEquipo);
      const anio = anioNacimiento(jugador.fecha_nacimiento);

      if (!equiposMap.has(nombreEquipo)) {
        equiposMap.set(nombreEquipo, {
          id: nombreEquipo,
          nombre: nombreEquipo,
          club,
          categoria,
          jugadores: 0,
          anios: new Set(),
        });
      }

      const equipo = equiposMap.get(nombreEquipo);
      equipo.jugadores += 1;
      if (anio) equipo.anios.add(anio);
    });

    const equipos = Array.from(equiposMap.values())
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es', { sensitivity: 'base' }) || ordenarPorNombre(a, b))
      .map((equipo) => ({
        ...equipo,
        aniosNacimiento: formatearAnios(equipo.anios),
      }));

    const categoriasMap = new Map();
    equipos.forEach((equipo) => {
      if (!categoriasMap.has(equipo.categoria)) {
        categoriasMap.set(equipo.categoria, {
          id: equipo.categoria,
          nombre: equipo.categoria,
          equipos: 0,
          jugadores: 0,
          anios: new Set(),
        });
      }

      const categoria = categoriasMap.get(equipo.categoria);
      categoria.equipos += 1;
      categoria.jugadores += equipo.jugadores;
      equipo.anios.forEach((anio) => categoria.anios.add(anio));
    });

    const categorias = Array.from(categoriasMap.values())
      .sort(ordenarPorNombre)
      .map((categoria) => ({
        ...categoria,
        aniosNacimiento: formatearAnios(categoria.anios),
      }));

    return {
      tablaClub: [
        {
          id: club,
          codigo: club,
          nombre: CLUBES_INFO[club]?.nombre || club,
          equipos: equipos.length,
          categorias: categorias.length,
          jugadores: jugadores.length,
        },
      ],
      tablaEquipos: equipos,
      tablaCategorias: categorias,
    };
  }, [club, jugadores]);

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50 mb-2">Organizacion</p>
          <h2 className="text-2xl font-bold text-club-black">Club, equipo y categoria</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 self-start sm:self-auto">
          <span className="text-2xl font-bold text-club-red tabular-nums">{jugadores.length}</span>
          <span className="text-sm font-medium text-club-black/70">
            {jugadores.length === 1 ? 'jugador' : 'jugadores'}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-club-black/60">Cargando estructura...</p>
      ) : (
        <>
          <Tabla
            titulo="Tabla de club"
            descripcion="Resumen del club activo seleccionado en la cabecera."
            columnas={[
              { key: 'codigo', label: 'Codigo' },
              { key: 'nombre', label: 'Club' },
              { key: 'equipos', label: 'Equipos' },
              { key: 'categorias', label: 'Categorias' },
              { key: 'jugadores', label: 'Jugadores' },
            ]}
            filas={tablaClub}
            emptyText="No hay datos del club."
          />

          <Tabla
            titulo="Tabla de equipos"
            descripcion="Equipos detectados desde los jugadores del club activo."
            columnas={[
              { key: 'nombre', label: 'Equipo' },
              { key: 'categoria', label: 'Categoria' },
              { key: 'aniosNacimiento', label: 'Anos nacimiento' },
              { key: 'jugadores', label: 'Jugadores' },
            ]}
            filas={tablaEquipos}
            emptyText="No hay equipos disponibles."
          />

          <Tabla
            titulo="Tabla de categorias"
            descripcion="Agrupacion de equipos por categoria deportiva."
            columnas={[
              { key: 'nombre', label: 'Categoria' },
              { key: 'equipos', label: 'Equipos' },
              { key: 'aniosNacimiento', label: 'Anos nacimiento' },
              { key: 'jugadores', label: 'Jugadores' },
            ]}
            filas={tablaCategorias}
            emptyText="No hay categorias disponibles."
          />
        </>
      )}
    </div>
  );
}
