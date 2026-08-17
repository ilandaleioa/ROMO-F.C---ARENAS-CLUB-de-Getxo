import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';
import { useClub } from '../context/ClubContext';
import { useLista } from '../lib/listas';

const linkClass = ({ isActive }) =>
  `block px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
    isActive ? 'bg-club-red text-white' : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

const NAV_ITEMS = [{ to: '/', label: 'Inicio', end: true }];

const SECONDARY_NAV_ITEMS = [
  { to: '/campogramas', label: 'Campogramas' },
  { to: '/captacion', label: 'CAPTACION' },
];

const FINAL_NAV_ITEMS = [
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/listas', label: 'Listas' },
  { to: '/hojas-calculo', label: 'Hojas de calculo' },
];

const VISTA_OPCIONES = [
  { valor: 'tabla', label: 'Vista tabla' },
  { valor: 'tarjetas', label: 'Vista tarjetas' },
  { valor: 'graficas', label: 'Vista graficas' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { vista, setVista } = useVistaPlantillas();
  const { club, setClub } = useClub();
  const listaClubes = useLista('clubes');
  const secondaryNavItems =
    club === 'ARENAS' ? SECONDARY_NAV_ITEMS.filter((item) => item.to !== '/captacion') : SECONDARY_NAV_ITEMS;
  const clubesSeleccionables = (listaClubes?.filas || [])
    .map((fila) => ({
      valor: String(fila.valor || fila.id?.replace(/^club-/, '').toUpperCase() || '').trim(),
      label: String(fila.nombre || '').trim(),
    }))
    .filter((clubItem) => ['ROMO', 'ARENAS'].includes(clubItem.valor));

  if (!user) return null;

  const puedeCambiarClub = !user.club || user.club === 'TODOS';

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

      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onClose}>
          {item.label}
        </NavLink>
      ))}

      <div className="mt-2">
        {VISTA_OPCIONES.map((opcion) => (
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
        ))}
      </div>

      {secondaryNavItems.map((item) => (
        <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose}>
          {item.label}
        </NavLink>
      ))}

      {(user.rol === 'administrador' || user.rol === 'director') &&
        FINAL_NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose}>
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
