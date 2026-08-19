import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CLUBES, useClub } from '../context/ClubContext';
import { APARTADOS_APP, usuarioPuedeVerItem } from '../lib/apartados';

const linkClass = ({ isActive }) =>
  `block px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
    isActive ? 'bg-club-red text-white' : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { club, setClub } = useClub();

  useEffect(() => {
    if (!isOpen) return undefined;
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, [isOpen]);

  if (!user) return null;

  const puedeCambiarClub = !user.club || user.club === 'TODOS';
  const navItems = APARTADOS_APP.filter(
    (item) => !['campogramas', 'graficas'].includes(item.key) && usuarioPuedeVerItem(user, item)
  );
  const actividadesItem = navItems.find((item) => item.key === 'actividades');
  const plantillasItem = navItems.find((item) => item.key === 'inicio');
  const restoNavItems = navItems.filter((item) => !['actividades', 'inicio'].includes(item.key));

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {puedeCambiarClub && (
        <div className="lg:hidden mb-2 inline-flex rounded-md border border-gray-200 overflow-hidden self-start">
          {CLUBES.map((c) => (
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

      {actividadesItem && (
        <NavLink key={actividadesItem.path} to={actividadesItem.path} end className={linkClass} onClick={onClose}>
          {actividadesItem.label}
        </NavLink>
      )}

      {plantillasItem && (
        <NavLink
          to={plantillasItem.path}
          end
          className={() =>
            linkClass({
              isActive: ['/plantillas', '/graficas', '/campogramas'].includes(pathname),
            })
          }
          onClick={onClose}
        >
          {plantillasItem.label}
        </NavLink>
      )}

      {restoNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/' || item.path === '/listas'}
          className={linkClass}
          onClick={onClose}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="no-print hidden lg:block w-56 shrink-0 border-r border-gray-200 bg-white">{nav}</aside>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Navegación principal">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <aside className="relative w-72 max-w-[86%] h-full bg-white shadow-xl overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)]">{nav}</aside>
        </div>
      )}
    </>
  );
}
