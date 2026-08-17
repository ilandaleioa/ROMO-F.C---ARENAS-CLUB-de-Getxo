import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';
import { useClub } from '../context/ClubContext';
import { useLista } from '../lib/listas';
import { APARTADOS_APP, usuarioPuedeVerItem, usuarioPuedeVerApartado } from '../lib/apartados';

const linkClass = ({ isActive }) =>
  `block px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
    isActive ? 'bg-club-red text-white' : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

const PLANTILLAS_OPCIONES = [
  { valor: 'tabla', label: 'Vista tabla' },
  { valor: 'tarjetas', label: 'Vista tarjetas' },
  { valor: 'graficas', label: 'Vista graficas' },
  { key: 'campogramas', label: 'Campogramas', path: '/campogramas' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { vista, setVista } = useVistaPlantillas();
  const { club, setClub } = useClub();
  const listaClubes = useLista('clubes');
  const clubesSeleccionables = (listaClubes?.filas || [])
    .map((fila) => ({
      valor: String(fila.valor || fila.id?.replace(/^club-/, '').toUpperCase() || '').trim(),
      label: String(fila.nombre || '').trim(),
    }))
    .filter((clubItem) => ['ROMO', 'ARENAS'].includes(clubItem.valor));

  if (!user) return null;

  const puedeCambiarClub = !user.club || user.club === 'TODOS';
  const navItems = APARTADOS_APP.filter((item) => item.key !== 'campogramas' && usuarioPuedeVerItem(user, item));
  const inicioItem = navItems.find((item) => item.key === 'inicio');
  const restoNavItems = navItems.filter((item) => item.key !== 'inicio');
  const mostrarPlantillas = usuarioPuedeVerApartado(user, 'inicio') || usuarioPuedeVerApartado(user, 'campogramas');

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {puedeCambiarClub && (
        <div className="md:hidden mb-2 inline-flex rounded-md border border-gray-200 overflow-hidden self-start">
          {clubesSeleccionables.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setClub(c.valor)}
              className={`px-3 py-2 text-xs font-bold tracking-wide transition-colors ${
                club === c.valor
                  ? 'bg-club-red text-white'
                  : 'bg-white text-club-black/60 hover:bg-club-red/10 hover:text-club-black'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {inicioItem && (
        <NavLink key={inicioItem.path} to={inicioItem.path} end={inicioItem.path === '/'} className={linkClass} onClick={onClose}>
          {inicioItem.label}
        </NavLink>
      )}

      {mostrarPlantillas && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50/80 p-2">
          <div className="mb-2 rounded-md bg-club-black px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.18em] text-white">
            PLANTILLAS
          </div>
          <div className="space-y-1 pl-2">
            {PLANTILLAS_OPCIONES.map((opcion) =>
              opcion.path ? (
                <NavLink
                  key={opcion.key}
                  to={opcion.path}
                  className={`block w-full rounded-md px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                    pathname === opcion.path
                      ? 'bg-club-red text-white'
                      : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
                  }`}
                  onClick={onClose}
                >
                  {opcion.label}
                </NavLink>
              ) : (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => {
                    setVista(opcion.valor);
                    navigate('/');
                    onClose?.();
                  }}
                  className={`block w-full text-left px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                    pathname === '/' && vista === opcion.valor
                      ? 'bg-club-red text-white'
                      : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
                  }`}
                >
                  {opcion.label}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {restoNavItems.map((item) => (
        <NavLink key={item.path} to={item.path} end={item.path === '/'} className={linkClass} onClick={onClose}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="hidden md:block w-56 shrink-0 border-r border-gray-200 bg-white">{nav}</aside>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <aside className="relative w-64 max-w-[80%] h-full bg-white shadow-xl overflow-y-auto">{nav}</aside>
        </div>
      )}
    </>
  );
}
