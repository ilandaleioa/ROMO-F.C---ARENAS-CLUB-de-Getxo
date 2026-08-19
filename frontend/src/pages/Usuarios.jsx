import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import TableScroll from '../components/TableScroll';
import { useAuth } from '../context/AuthContext';
import { useFiltroEquipos } from '../context/FiltroEquiposContext';
import { TODOS_EQUIPOS, equiposAsignadosLabel, parseEquiposAsignados } from '../lib/equiposAsignados';
import {
  APARTADOS_USUARIO,
  TODOS_APARTADOS,
  apartadosVisiblesLabel,
  parseApartadosVisibles,
} from '../lib/apartados';

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

const FORM_VACIO = {
  username: '',
  password: '',
  rol: 'tecnico',
  equipos_asignados: [TODOS_EQUIPOS],
  apartados_visibles: [TODOS_APARTADOS],
  club: 'TODOS',
  activo: true,
};

export default function Usuarios() {
  const { user, refreshMe } = useAuth();
  const { equiposDisponibles } = useFiltroEquipos();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [selectorEquiposAbierto, setSelectorEquiposAbierto] = useState(false);
  const [selectorApartadosAbierto, setSelectorApartadosAbierto] = useState(false);
  const [apartadosVisiblesDisponibles, setApartadosVisiblesDisponibles] = useState(true);
  const selectorEquiposRef = useRef(null);
  const selectorApartadosRef = useRef(null);

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

  useEffect(() => {
    const cerrarSelectorSiHaceFalta = (e) => {
      const fueraEquipos = selectorEquiposRef.current && !selectorEquiposRef.current.contains(e.target);
      const fueraApartados = selectorApartadosRef.current && !selectorApartadosRef.current.contains(e.target);

      if (fueraEquipos) {
        setSelectorEquiposAbierto(false);
      }
      if (fueraApartados) {
        setSelectorApartadosAbierto(false);
      }
    };

    const cerrarConEscape = (e) => {
      if (e.key === 'Escape') {
        setSelectorEquiposAbierto(false);
        setSelectorApartadosAbierto(false);
      }
    };

    document.addEventListener('mousedown', cerrarSelectorSiHaceFalta);
    document.addEventListener('keydown', cerrarConEscape);

    return () => {
      document.removeEventListener('mousedown', cerrarSelectorSiHaceFalta);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, []);

  const empezarEdicion = (usuario) => {
    setEditandoId(usuario.id);
    setApartadosVisiblesDisponibles(Object.prototype.hasOwnProperty.call(usuario, 'apartados_visibles'));
    setForm({
      username: usuario.username,
      password: '',
      rol: usuario.rol,
      equipos_asignados: parseEquiposAsignados(usuario.equipo_asignado),
      apartados_visibles: parseApartadosVisibles(usuario.apartados_visibles),
      club: usuario.club || 'TODOS',
      activo: usuario.activo !== false,
    });
    setFormError('');
    setMostrarFormulario(true);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setApartadosVisiblesDisponibles(true);
    setForm(FORM_VACIO);
    setFormError('');
    setMostrarFormulario(false);
    setSelectorEquiposAbierto(false);
    setSelectorApartadosAbierto(false);
  };

  const toggleEquipoAsignado = (equipo) => {
    setForm((prev) => {
      if (equipo === TODOS_EQUIPOS) {
        return { ...prev, equipos_asignados: [TODOS_EQUIPOS] };
      }

      const actuales = prev.equipos_asignados.includes(TODOS_EQUIPOS) ? [] : prev.equipos_asignados;
      const siguientes = actuales.includes(equipo)
        ? actuales.filter((eq) => eq !== equipo)
        : [...actuales, equipo];

      return { ...prev, equipos_asignados: siguientes.length > 0 ? siguientes : [TODOS_EQUIPOS] };
    });
  };

  const toggleApartadoVisible = (apartado) => {
    setForm((prev) => {
      if (apartado === TODOS_APARTADOS) {
        return { ...prev, apartados_visibles: [TODOS_APARTADOS] };
      }

      const actuales = prev.apartados_visibles.includes(TODOS_APARTADOS) ? [] : prev.apartados_visibles;
      const siguientes = actuales.includes(apartado)
        ? actuales.filter((item) => item !== apartado)
        : [...actuales, apartado];

      return { ...prev, apartados_visibles: siguientes.length > 0 ? siguientes : [TODOS_APARTADOS] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setGuardando(true);
    try {
      const payload = {
        username: form.username,
        rol: form.rol,
        equipo_asignado: form.equipos_asignados,
        apartados_visibles: form.apartados_visibles,
        club: form.club,
        activo: form.activo,
      };
      if (form.password) payload.password = form.password;

      if (editandoId) {
        await api.put(`/usuarios/${editandoId}`, payload);
      } else {
        await api.post('/usuarios', payload);
      }
      if (user && String(user.id) === String(editandoId)) {
        await refreshMe();
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Gestion de usuarios</h2>
        {!mostrarFormulario && (
          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="flex items-center justify-center gap-2 w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Añadir usuario
          </button>
        )}
      </div>

      {mostrarFormulario && (
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-8 shadow-sm space-y-4"
      >
        <h3 className="font-bold text-club-black">
          {editandoId ? 'Editar usuario' : 'Nuevo usuario'}
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <button
            type="submit"
            disabled={guardando}
            className="w-full sm:w-auto bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-md transition-colors"
          >
            {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button
            type="button"
            onClick={cancelarEdicion}
            className="w-full sm:w-auto px-5 py-2 rounded-md font-semibold text-club-black border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>

        {formError && (
          <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
            {formError}
          </p>
        )}

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

          <div className="relative" ref={selectorEquiposRef}>
            <label className="block text-sm font-semibold text-club-black mb-1">Equipo</label>
            <button
              type="button"
              aria-expanded={selectorEquiposAbierto}
              aria-haspopup="listbox"
              onClick={() => setSelectorEquiposAbierto((abierto) => !abierto)}
              className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <span className="truncate">{equiposAsignadosLabel(form.equipos_asignados, { compacto: true })}</span>
              <span
                className={`h-2.5 w-2.5 shrink-0 border-b-2 border-r-2 border-club-black/50 transition-transform ${
                  selectorEquiposAbierto ? 'rotate-[225deg]' : 'rotate-45'
                }`}
                aria-hidden="true"
              />
            </button>
            {selectorEquiposAbierto && (
              <div className="absolute z-30 mt-2 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg" role="listbox" aria-multiselectable="true">
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b border-gray-100 hover:bg-red-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.equipos_asignados.includes(TODOS_EQUIPOS)}
                    onChange={() => toggleEquipoAsignado(TODOS_EQUIPOS)}
                    className="h-4 w-4 accent-club-red"
                  />
                  Todos los equipos
                </label>
                {equiposDisponibles.map((eq) => (
                  <label
                    key={eq}
                    className="flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 text-club-black/80 hover:bg-red-50/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.equipos_asignados.includes(eq)}
                      onChange={() => toggleEquipoAsignado(eq)}
                      className="h-4 w-4 accent-club-red"
                    />
                    <span className="truncate">{eq}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={selectorApartadosRef}>
            <label className="block text-sm font-semibold text-club-black mb-1">Apartados visibles</label>
            {editandoId && !apartadosVisiblesDisponibles && (
              <p className="mb-1 text-xs text-amber-700">
                Falta la columna de apartados en la base de datos. Ejecuta la migracion para guardar estas selecciones.
              </p>
            )}
            <button
              type="button"
              aria-expanded={selectorApartadosAbierto}
              aria-haspopup="listbox"
              onClick={() => setSelectorApartadosAbierto((abierto) => !abierto)}
              className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <span className="truncate">{apartadosVisiblesLabel(form.apartados_visibles, { compacto: true })}</span>
              <span
                className={`h-2.5 w-2.5 shrink-0 border-b-2 border-r-2 border-club-black/50 transition-transform ${
                  selectorApartadosAbierto ? 'rotate-[225deg]' : 'rotate-45'
                }`}
                aria-hidden="true"
              />
            </button>
            {selectorApartadosAbierto && (
              <div className="absolute z-30 mt-2 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg" role="listbox" aria-multiselectable="true">
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b border-gray-100 hover:bg-red-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.apartados_visibles.includes(TODOS_APARTADOS)}
                    onChange={() => toggleApartadoVisible(TODOS_APARTADOS)}
                    className="h-4 w-4 accent-club-red"
                  />
                  Todos los apartados
                </label>
                {APARTADOS_USUARIO.map((apartado) => (
                  <label
                    key={apartado.value}
                    className="flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 text-club-black/80 hover:bg-red-50/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.apartados_visibles.includes(apartado.value)}
                      onChange={() => toggleApartadoVisible(apartado.value)}
                      className="h-4 w-4 accent-club-red"
                    />
                    <span className="truncate">{apartado.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

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
        <TableScroll className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-[540px] sm:min-w-full divide-y divide-gray-200 bg-white">
            <thead className="bg-club-black text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Rol</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Club</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Equipo</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Apartados</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-red-50/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-club-black">{u.username}</td>
                  <td className="px-4 py-3 text-club-black/80 capitalize">{u.rol}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-club-black/80">
                    {u.club === 'ROMO' ? 'ROMO' : u.club === 'ARENAS' ? 'ARENAS' : 'ROMO y ARENAS'}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-club-black/80" title={equiposAsignadosLabel(u.equipo_asignado)}>
                    {equiposAsignadosLabel(u.equipo_asignado, { compacto: true })}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-club-black/80" title={apartadosVisiblesLabel(u.apartados_visibles)}>
                    {apartadosVisiblesLabel(u.apartados_visibles, { compacto: true })}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        u.activo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {u.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
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
        </TableScroll>
      )}
    </div>
  );
}
