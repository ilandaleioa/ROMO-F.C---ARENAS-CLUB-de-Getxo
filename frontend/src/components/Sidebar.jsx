import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CLUBES, useClub } from '../context/ClubContext';
import { APARTADOS_APP, usuarioPuedeVerItem } from '../lib/apartados';

const linkClass = ({ isActive }) =>
  `block px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
    isActive ? 'bg-club-red text-white' : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

export default function Sidebar({ isOpen, onClose, colapsado, onToggleColapsado }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { club, setClub } = useClub();
  const apartadosOcultosEnSidebar = ['actividades', 'equipos', 'usuarios', 'listas', 'clubes_maestros', 'hojas_calculo', 'competiciones'];

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
    (item) =>
      !['campogramas', 'graficas', ...apartadosOcultosEnSidebar].includes(item.key) && usuarioPuedeVerItem(user, item)
  );
  const actividadesItem = navItems.find((item) => item.key === 'actividades');
  const romoItem = puedeCambiarClub || user.club === 'ROMO' ? navItems.find((item) => item.key === 'inicio') : null;
  const arenasItem =
    puedeCambiarClub || user.club === 'ARENAS' ? navItems.find((item) => item.key === 'inicio_arenas') : null;
  const configuracionItem = navItems.find((item) => item.key === 'configuracion');
  const restoNavItems = navItems.filter(
    (item) => !['actividades', 'inicio', 'inicio_arenas', 'configuracion'].includes(item.key)
  );
  const seccionPlantillasActiva = ['/plantillas', '/graficas', '/campogramas'].includes(pathname);
  const [plantillasAbierto, setPlantillasAbierto] = useState(seccionPlantillasActiva);

  useEffect(() => {
    if (seccionPlantillasActiva) setPlantillasAbierto(true);
  }, [seccionPlantillasActiva]);

  const irAPlantillasDeClub = (valorClub) => {
    setClub(valorClub);
    navigate('/plantillas');
    onClose();
  };

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {puedeCambiarClub && (
        <div className="mb-2 inline-flex overflow-hidden rounded-md border border-gray-200 self-start lg:hidden">
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

      {(romoItem || arenasItem) && (
        <div>
          <button
            type="button"
            onClick={() => setPlantillasAbierto((abierto) => !abierto)}
            className={`flex w-full items-center justify-between px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
              seccionPlantillasActiva
                ? 'text-club-red'
                : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
            }`}
            aria-expanded={plantillasAbierto}
          >
            PLANTILLAS
            <span aria-hidden="true" className={`text-xs transition-transform ${plantillasAbierto ? 'rotate-90' : ''}`}>
              ›
            </span>
          </button>

          {plantillasAbierto && (
            <div className="ml-3 flex flex-col gap-1 border-l border-gray-200 pl-2">
              {romoItem && (
                <button
                  type="button"
                  onClick={() => irAPlantillasDeClub('ROMO')}
                  className={linkClass({ isActive: seccionPlantillasActiva && club === 'ROMO' })}
                >
                  {romoItem.label}
                </button>
              )}

              {arenasItem && (
                <button
                  type="button"
                  onClick={() => irAPlantillasDeClub('ARENAS')}
                  className={linkClass({ isActive: seccionPlantillasActiva && club === 'ARENAS' })}
                >
                  {arenasItem.label}
                </button>
              )}
            </div>
          )}
        </div>
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

      {configuracionItem && (
        <NavLink key={configuracionItem.path} to={configuracionItem.path} end className={linkClass} onClick={onClose}>
          {configuracionItem.label}
        </NavLink>
      )}
    </nav>
  );

  return (
    <>
      <div className="no-print relative hidden shrink-0 lg:block">
        <aside
          className={`overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ${
            colapsado ? 'w-0 border-r-0' : 'w-56'
          }`}
        >
          <div className="w-56">{nav}</div>
        </aside>
        <button
          type="button"
          onClick={onToggleColapsado}
          aria-label={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
          title={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
          className={`absolute top-4 z-10 flex h-9 w-9 max-w-none items-center justify-center rounded-full border-2 border-white bg-rose-400 text-white shadow-lg transition-[left,background-color,box-shadow] duration-200 hover:bg-rose-500 hover:shadow-xl ${
            colapsado ? '' : '-translate-x-1/2'
          }`}
          style={{ left: colapsado ? '0.25rem' : '14rem' }}
        >
          <span aria-hidden="true" className="text-lg font-bold">{colapsado ? '›' : '‹'}</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navegacion principal">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <aside className="relative h-full w-72 max-w-[86%] overflow-y-auto overscroll-contain bg-white pt-[env(safe-area-inset-top)] shadow-xl">
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
