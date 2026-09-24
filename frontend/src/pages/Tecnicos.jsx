import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';
import TableScroll from '../components/TableScroll';

function nombreCompleto(tecnico) {
  return [tecnico.nombre, tecnico.primer_apellido, tecnico.segundo_apellido].filter(Boolean).join(' ');
}

function avatarIniciales(tecnico) {
  return [tecnico.nombre?.[0], tecnico.primer_apellido?.[0]].filter(Boolean).join('').toUpperCase() || 'T';
}

function equipoLabel(tecnico) {
  return [tecnico.equipo_primer_entrenador, tecnico.equipo_segundo_entrenador].filter(Boolean).join(' / ') || '—';
}

export default function Tecnicos() {
  const { user } = useAuth();
  const { club } = useClub();
  const puedeSincronizar = user?.rol === 'administrador' || user?.rol === 'director';

  const [tecnicos, setTecnicos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const cargarTecnicos = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      const query = params.toString();
      const { tecnicos: lista } = await api.get(query ? `/tecnicos?${query}` : '/tecnicos');
      setTecnicos(lista || []);
    } catch (err) {
      setError(err.message);
    }
  }, [busqueda]);

  useEffect(() => {
    let vivo = true;
    const ejecutar = async () => {
      setLoading(true);
      try {
        await cargarTecnicos();
      } finally {
        if (vivo) setLoading(false);
      }
    };

    ejecutar();
    return () => {
      vivo = false;
    };
  }, [club, cargarTecnicos]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setMensaje('');
    setError('');
    try {
      const resultado = await api.post('/tecnicos/sync');
      setMensaje(
        `Sincronizacion completada: ${resultado.insertados || 0} nuevo(s), ${resultado.actualizados || 0} actualizado(s)` +
          (resultado.eliminados ? `, ${resultado.eliminados} eliminado(s)` : '') +
          (resultado.omitidos ? `. ${resultado.omitidos} fila(s) de la hoja omitida(s) por datos incompletos.` : '.')
      );
      await cargarTecnicos();
    } catch (err) {
      setError(err.message);
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-club-black">TECNICOS</h2>
          <p className="text-sm text-club-black/60 mt-1">
            Datos importados desde el formulario de Google Sheets de tecnicos del club.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, contacto, funcion o equipo..."
            className="w-full sm:w-72 rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
          />
          {puedeSincronizar && (
            <button
              type="button"
              onClick={handleSincronizar}
              disabled={sincronizando}
              className="inline-flex items-center justify-center rounded-md bg-club-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sincronizando ? 'Sincronizando...' : 'Sincronizar con Google Sheets'}
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{mensaje}</p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-club-red/30 bg-red-50 px-3 py-2 text-sm font-medium text-club-red">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-club-black">Listado</h3>
          <span className="rounded-full bg-club-black px-3 py-1 text-sm font-semibold text-white">
            {tecnicos.length} {tecnicos.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {loading ? (
          <p className="py-8 text-club-black/60">Cargando tecnicos...</p>
        ) : tecnicos.length === 0 ? (
          <p className="py-8 text-club-black/60">
            No se han encontrado tecnicos. {puedeSincronizar ? 'Pulsa "Sincronizar con Google Sheets" para importarlos.' : ''}
          </p>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-club-black/50">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Funcion</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2">Localidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tecnicos.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-red-50/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-club-black text-sm font-bold text-white">
                          {avatarIniciales(item)}
                        </div>
                        <span className="font-semibold text-club-black">{nombreCompleto(item)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-club-black/80">
                      {item.telefono ? (
                        <a href={`tel:${item.telefono}`} className="block hover:text-club-red hover:underline">
                          {item.telefono}
                        </a>
                      ) : null}
                      {item.email ? (
                        <a href={`mailto:${item.email}`} className="block hover:text-club-red hover:underline">
                          {item.email}
                        </a>
                      ) : null}
                      {!item.telefono && !item.email ? <span className="text-club-black/40">—</span> : null}
                    </td>
                    <td className="px-3 py-3 text-club-black/80">
                      {item.funcion_principal || <span className="text-club-black/40">—</span>}
                      {item.otra_funcion ? (
                        <div className="text-xs text-club-black/50">{item.otra_funcion}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-club-black/80">{equipoLabel(item)}</td>
                    <td className="px-3 py-3 text-club-black/80">
                      {item.localidad || <span className="text-club-black/40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </div>
  );
}
