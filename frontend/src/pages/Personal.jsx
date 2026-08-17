import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';
import { CARGOS_PERSONAL } from '../lib/personal';

function nombreCompleto(personal) {
  return [personal.nombre, personal.primer_apellido, personal.segundo_apellido].filter(Boolean).join(' ');
}

function crearPersonalVacio() {
  return {
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    cargo: CARGOS_PERSONAL[0],
    equipo: '',
  };
}

function avatarIniciales(personal) {
  return [personal.nombre?.[0], personal.primer_apellido?.[0]].filter(Boolean).join('').toUpperCase() || 'P';
}

export default function Personal() {
  const { user } = useAuth();
  const { club } = useClub();
  const puedeGestionar = user?.rol === 'administrador' || user?.rol === 'director';

  const [personal, setPersonal] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEquipo, setFiltroEquipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(crearPersonalVacio);
  const [fotoFile, setFotoFile] = useState(null);

  const cargarEquipos = useCallback(async () => {
    try {
      const { equipos: lista } = await api.get('/personal/equipos');
      setEquipos(lista || []);
    } catch (err) {
      setEquipos([]);
      throw err;
    }
  }, []);

  const cargarPersonal = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (filtroEquipo) params.set('equipo', filtroEquipo);
      const query = params.toString();
      const { personal: lista } = await api.get(query ? `/personal?${query}` : '/personal');
      setPersonal(lista || []);
    } catch (err) {
      setError(err.message);
    }
  }, [busqueda, filtroEquipo]);

  useEffect(() => {
    let vivo = true;
    const ejecutar = async () => {
      setLoading(true);
      try {
        await Promise.allSettled([cargarEquipos(), cargarPersonal()]);
      } finally {
        if (vivo) setLoading(false);
      }
    };

    ejecutar();
    return () => {
      vivo = false;
    };
  }, [club, cargarEquipos, cargarPersonal]);

  const equiposOrdenados = useMemo(
    () => [...new Set(equipos)].sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })),
    [equipos]
  );

  const resetForm = () => {
    setForm(crearPersonalVacio());
    setFotoFile(null);
    setEditandoId(null);
  };

  const iniciarEdicion = (item) => {
    setEditandoId(item.id);
    setForm({
      nombre: item.nombre || '',
      primer_apellido: item.primer_apellido || '',
      segundo_apellido: item.segundo_apellido || '',
      cargo: CARGOS_PERSONAL.includes(item.cargo) ? item.cargo : CARGOS_PERSONAL[0],
      equipo: item.equipo || '',
    });
    setFotoFile(null);
    setMensaje('');
  };

  const subirFotoSiHaceFalta = async (id) => {
    if (!fotoFile) return null;
    const formData = new FormData();
    formData.append('foto', fotoFile);
    const respuesta = await api.postFile(`/personal/${id}/foto`, formData);
    return respuesta?.foto_url || null;
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!puedeGestionar || guardando) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const payload = {
        nombre: form.nombre.trim(),
        primer_apellido: form.primer_apellido.trim(),
        segundo_apellido: form.segundo_apellido.trim(),
        cargo: form.cargo.trim(),
        equipo: form.equipo.trim(),
      };

      const respuesta = editandoId
        ? await api.put(`/personal/${editandoId}`, payload)
        : await api.post('/personal', payload);

      const registrado = respuesta.personal;
      if (fotoFile && registrado?.id) {
        await subirFotoSiHaceFalta(registrado.id);
      }

      setMensaje(editandoId ? 'Personal actualizado correctamente.' : 'Personal creado correctamente.');
      resetForm();
      await Promise.allSettled([cargarEquipos(), cargarPersonal()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (item) => {
    if (!puedeGestionar || borrandoId) return;

    const confirmado = window.confirm(`Borrar a ${nombreCompleto(item)}? Esta accion no se puede deshacer.`);
    if (!confirmado) return;

    setBorrandoId(item.id);
    setError('');
    setMensaje('');

    try {
      await api.delete(`/personal/${item.id}`);
      if (editandoId === item.id) resetForm();
      setMensaje(`${nombreCompleto(item)} borrado correctamente.`);
      await Promise.allSettled([cargarEquipos(), cargarPersonal()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrandoId(null);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-club-black">PERSONAL</h2>
          <p className="text-sm text-club-black/60 mt-1">
            Gestiona nombre, apellidos, foto, cargo y equipo del personal del club.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cargo o equipo..."
            className="w-full sm:w-72 rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
          />
          <select
            value={filtroEquipo}
            onChange={(e) => setFiltroEquipo(e.target.value)}
            className="w-full sm:w-56 rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
          >
            <option value="">Todos los equipos</option>
            {equiposOrdenados.map((equipo) => (
              <option key={equipo} value={equipo}>
                {equipo}
              </option>
            ))}
          </select>
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

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-club-black">
                {editandoId ? 'Editar personal' : 'Nuevo personal'}
              </h3>
              <p className="text-sm text-club-black/60">
                {puedeGestionar
                  ? 'Rellena los campos y guarda el registro.'
                  : 'Solo lectura: tu rol no puede crear o editar personal.'}
              </p>
            </div>
            {editandoId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-semibold text-club-black/60 hover:text-club-black"
              >
                Cancelar
              </button>
            )}
          </div>

          {puedeGestionar ? (
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                  Nombre
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Primer apellido
                  </label>
                  <input
                    type="text"
                    value={form.primer_apellido}
                    onChange={(e) => setForm((prev) => ({ ...prev, primer_apellido: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Segundo apellido
                  </label>
                  <input
                    type="text"
                    value={form.segundo_apellido}
                    onChange={(e) => setForm((prev) => ({ ...prev, segundo_apellido: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                  Cargo
                </label>
                <select
                  value={form.cargo}
                  onChange={(e) => setForm((prev) => ({ ...prev, cargo: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  required
                >
                  {CARGOS_PERSONAL.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                  Equipo
                </label>
                <input
                  list="equipos-personal"
                  type="text"
                  value={form.equipo}
                  onChange={(e) => setForm((prev) => ({ ...prev, equipo: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  required
                />
                <datalist id="equipos-personal">
                  {equiposOrdenados.map((equipo) => (
                    <option key={equipo} value={equipo} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                  Foto
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-club-black/70 file:mr-3 file:rounded-md file:border-0 file:bg-club-black file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black"
                />
                <p className="mt-1 text-xs text-club-black/50">JPG, PNG o WEBP. Tamaño máximo: 5 MB.</p>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center justify-center rounded-md bg-club-red px-4 py-2 font-semibold text-white transition-colors hover:bg-club-redDark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Crear personal'}
                </button>
                {editandoId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-club-black transition-colors hover:bg-gray-50"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-club-black/70">
              Esta vista es solo de consulta para tu rol.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-club-black">Listado</h3>
            <span className="rounded-full bg-club-black px-3 py-1 text-sm font-semibold text-white">
              {personal.length} {personal.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {loading ? (
            <p className="py-8 text-club-black/60">Cargando personal...</p>
          ) : personal.length === 0 ? (
            <p className="py-8 text-club-black/60">No se han encontrado registros de personal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-club-black/50">
                    <th className="px-3 py-2">Foto</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2">Equipo</th>
                    {puedeGestionar && <th className="px-3 py-2 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {personal.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-red-50/40">
                      <td className="px-3 py-3">
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt={nombreCompleto(item)}
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-club-black text-sm font-bold text-white">
                            {avatarIniciales(item)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-club-black">{nombreCompleto(item)}</div>
                        {item.segundo_apellido ? (
                          <div className="text-xs text-club-black/50">ID {item.id}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-club-black/80">{item.cargo}</td>
                      <td className="px-3 py-3 text-club-black/80">{item.equipo}</td>
                      {puedeGestionar && (
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => iniciarEdicion(item)}
                              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-club-black transition-colors hover:bg-gray-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => borrar(item)}
                              disabled={borrandoId === item.id}
                              className="rounded-md bg-club-red px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-club-redDark disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {borrandoId === item.id ? 'Borrando...' : 'Borrar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
