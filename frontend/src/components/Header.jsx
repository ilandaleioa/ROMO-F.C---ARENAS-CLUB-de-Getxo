import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFiltroEquipos } from '../context/FiltroEquiposContext';
import ClubLogo from './ClubLogo';

const ROLE_LABELS = {
  administrador: 'Administrador',
  director: 'Director',
  responsable: 'Responsable',
  tecnico: 'Tecnico',
};

function FiltroEquiposSelector() {
  const { equiposDisponibles, equiposSeleccionados, toggleEquipo, limpiarSeleccion } = useFiltroEquipos();
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    const handleClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  if (equiposDisponibles.length === 0) return null;

  const etiqueta =
    equiposSeleccionados.length === 0
      ? 'Todos los equipos'
      : equiposSeleccionados.length === 1
      ? equiposSeleccionados[0]
      : `${equiposSeleccionados.length} equipos`;

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors max-w-[12rem]"
      >
        <span className="truncate">Equipos: {etiqueta}</span>
        <span className="text-white/60">▾</span>
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg z-50 text-club-black">
          <button
            type="button"
            onClick={limpiarSeleccion}
            className="w-full text-left px-4 py-2 text-sm font-semibold border-b border-gray-100 hover:bg-red-50/60"
          >
            Todos los equipos
          </button>
          {equiposDisponibles.map((eq) => (
            <label
              key={eq}
              className="flex items-center gap-2 px-4 py-2 text-sm border-b border-gray-100 last:border-b-0 hover:bg-red-50/60 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={equiposSeleccionados.includes(eq)}
                onChange={() => toggleEquipo(eq)}
                className="h-4 w-4 accent-club-red"
              />
              {eq}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function BotonPantallaCompleta() {
  const [esPantallaCompleta, setEsPantallaCompleta] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const handleChange = () => setEsPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <button
      type="button"
      onClick={alternarPantallaCompleta}
      title={esPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
      className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
    >
      {esPantallaCompleta ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  );
}

function BotonesHistorial() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(-1)}
        title="Página anterior"
        aria-label="Página anterior"
        className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        title="Página siguiente"
        aria-label="Página siguiente"
        className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M7.3 15.7a1 1 0 010-1.4L11.6 10 7.3 5.7a1 1 0 011.4-1.4l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4 0z" />
        </svg>
      </button>
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
      isActive ? 'bg-club-red text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  const linkClassMobile = ({ isActive }) =>
    `block px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
      isActive ? 'bg-club-red text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  return (
    <header className="sticky top-0 z-50 bg-club-black text-white shadow-md">
      <div className="w-full px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <ClubLogo />
          <div className="leading-tight min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-wide truncate">
              ROMO FC <span className="text-club-red">-</span> ARENAS CLUB
            </h1>
          </div>
        </div>

        {user && (
          <nav className="hidden md:flex items-center gap-2">
            <BotonesHistorial />
            <NavLink to="/plantillas" className={linkClass}>
              Plantillas
            </NavLink>
            <NavLink to="/campogramas" className={linkClass}>
              Campogramas
            </NavLink>
            {(user.rol === 'administrador' || user.rol === 'director') && (
              <NavLink to="/usuarios" className={linkClass}>
                Usuarios
              </NavLink>
            )}
            {(user.rol === 'administrador' || user.rol === 'director') && (
              <NavLink to="/municipios" className={linkClass}>
                Municipios
              </NavLink>
            )}
          </nav>
        )}

        {user && (
          <div className="hidden md:flex items-center gap-3 text-sm">
            {user.rol !== 'tecnico' && <FiltroEquiposSelector />}
            <BotonPantallaCompleta />
            <div className="text-right hidden lg:block">
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

        {user && (
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? 'Cerrar menu' : 'Abrir menu'}
            aria-expanded={menuAbierto}
            className="md:hidden shrink-0 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            {menuAbierto ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>

      {user && menuAbierto && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-3">
          <nav className="flex flex-col gap-1">
            <NavLink to="/plantillas" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
              Plantillas
            </NavLink>
            <NavLink to="/campogramas" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
              Campogramas
            </NavLink>
            {(user.rol === 'administrador' || user.rol === 'director') && (
              <NavLink to="/usuarios" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
                Usuarios
              </NavLink>
            )}
            {(user.rol === 'administrador' || user.rol === 'director') && (
              <NavLink to="/municipios" className={linkClassMobile} onClick={() => setMenuAbierto(false)}>
                Municipios
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <BotonesHistorial />
            <BotonPantallaCompleta />
          </div>

          {user.rol !== 'tecnico' && <FiltroEquiposSelector />}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div>
              <p className="font-semibold text-sm">{user.username}</p>
              <p className="text-white/60 text-xs">{ROLE_LABELS[user.rol] || user.rol}</p>
            </div>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-md bg-club-red hover:bg-club-redDark font-semibold text-sm transition-colors"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
