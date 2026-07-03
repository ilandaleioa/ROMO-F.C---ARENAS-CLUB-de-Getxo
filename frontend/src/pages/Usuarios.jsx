import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useFiltroEquipos } from '../context/FiltroEquiposContext';

const ROLES = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'director', label: 'Director' },
  { value: 'responsable', label: 'Responsable' },
  { value: 'tecnico', label: 'Tecnico' },
];

const CLUBES = [
  { value: 'TODOS', label: 'ROMO y ARENAS' },
  { value: 'ROMO', label: 'ROMO' },
  { value: 'ARENAS', label: 'ARENAS' },
];

const FORM_VACIO = { username: '', password: '', rol: 'tecnico', equipo_asignado: 'Todos', club: 'TODOS', activo: true };

export default function Usuarios() {
  const { equiposDisponibles } = useFiltroEquipos();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setError('');
    try {
      const { usuarios } = await api.get('/usuarios');
      setUsuarios(usuarios);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    cargarUsuarios().finally(() => setLoading(false));
  }, [cargarUsuarios]);

  const empezarEdicion = (usuario) => {
    setEditandoId(usuario.id);
    setForm({
      username: usuario.username,
      password: '',
      rol: usuario.rol,
      equipo_asignado: usuario.equipo_asignado || 'Todos',
      club: usuario.club || 'TODOS',
      activo: usuario.activo !== false,
    });
    setFormError('');
    setMostrarFormulario(true);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormError('');
    setMostrarFormulario(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setGuardando(true);
    try {
      const payload = {
        username: form.username,
        rol: form.rol,
        equipo_asignado: form.rol === 'tecnico' ? form.equipo_asignado : null,
        club: form.club,
        activo: form.activo,
      };
      if (form.password) payload.password = form.password;

      if (editandoId) {
        await api.put(`/usuarios/${editandoId}`, payload);
      } else {
        await api.post('/usuarios', payload);
      }
      cancelarEdicion();
      await cargarUsuarios();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (usuario) => {
    if (!window.confirm(`Eliminar al usuario "${usuario.username}"?`)) return;
    try {
      await api.delete(`/usuarios/${usuario.id}`);
      await cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-club-black">Gestion de usuarios</h2>
        {!mostrarFormulario && (
          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="flex items-center gap-2 bg-club-red hover:bg-club-redDark text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Añadir usuario
          </button>
        )}
      </div>

      {mostrarFormulario && (
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm space-y-4"
      >
        <h3 className="font-bold text-club-black">
          {editandoId ? 'Editar usuario' : 'Nuevo usuario'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-club-black mb-1">Usuario</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-club-black mb-1">
              Contrasena {editandoId && <span className="font-normal text-club-black/50">(dejar en blanco para no cambiar)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-club-black mb-1">Rol</label>
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-club-black mb-1">Club</label>
            <select
              value={form.club}
              onChange={(e) => setForm({ ...form, club: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              {CLUBES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {form.rol === 'tecnico' && (
            <div>
              <label className="block text-sm font-semibold text-club-black mb-1">Equipo asignado</label>
              <select
                required
                value={form.equipo_asignado}
                onChange={(e) => setForm({ ...form, equipo_asignado: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
              >
                <option value="Todos">Todos</option>
                {equiposDisponibles.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 pt-6">
            <input
              id="activo"
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="h-4 w-4 accent-club-red"
            />
            <label htmlFor="activo" className="text-sm font-semibold text-club-black">
              Usuario activo
            </label>
          </div>
        </div>

        {formError && (
          <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={guardando}
            className="bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-md transition-colors"
          >
            {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button
            type="button"
            onClick={cancelarEdicion}
            className="px-5 py-2 rounded-md font-semibold text-club-black border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </form>
      )}

      {error && (
        <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-club-black/60">Cargando usuarios...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 bg-white">
            <thead className="bg-club-black text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Club</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-red-50/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-club-black">{u.username}</td>
                  <td className="px-4 py-3 text-club-black/80 capitalize">{u.rol}</td>
                  <td className="px-4 py-3 text-club-black/80">
                    {u.club === 'ROMO' ? 'ROMO' : u.club === 'ARENAS' ? 'ARENAS' : 'ROMO y ARENAS'}
                  </td>
                  <td className="px-4 py-3 text-club-black/80">{u.equipo_asignado || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        u.activo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {u.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => empezarEdicion(u)}
                      className="text-club-red font-semibold hover:underline text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleEliminar(u)}
                      className="text-club-black/60 font-semibold hover:underline text-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
