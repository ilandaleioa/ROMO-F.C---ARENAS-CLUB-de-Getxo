import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ClubLogo from './ClubLogo';

const ROLE_LABELS = {
  administrador: 'Administrador',
  responsable: 'Responsable',
  tecnico: 'Tecnico',
};

export default function Header() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
      isActive ? 'bg-club-red text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  return (
    <header className="bg-club-black text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClubLogo />
          <div className="leading-tight">
            <h1 className="text-lg sm:text-xl font-bold tracking-wide">
              ROMO FC <span className="text-club-red">-</span> ARENAS
            </h1>
            <p className="text-xs text-white/60">Club de Getxo</p>
          </div>
        </div>

        {user && (
          <nav className="flex items-center gap-2">
            <NavLink to="/plantillas" className={linkClass}>
              Plantillas
            </NavLink>
            {user.rol === 'administrador' && (
              <NavLink to="/usuarios" className={linkClass}>
                Usuarios
              </NavLink>
            )}
          </nav>
        )}

        {user && (
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right hidden sm:block">
              <p className="font-semibold">{user.username}</p>
              <p className="text-white/60 text-xs">{ROLE_LABELS[user.rol] || user.rol}</p>
            </div>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-md bg-club-red hover:bg-club-redDark font-semibold text-sm transition-colors"
            >
              Cerrar sesion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
