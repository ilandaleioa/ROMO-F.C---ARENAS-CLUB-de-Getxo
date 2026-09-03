import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import ClubLogo from './ClubLogo';

const ROLE_LABELS = {
  administrador: 'Administrador',
  director: 'Director',
  responsable: 'Responsable',
  tecnico: 'Tecnico',
};

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
      className="shrink-0 p-2.5 rounded-md bg-white/20 hover:bg-white/30 ring-1 ring-white/40 text-white transition-colors"
    >
      {esPantallaCompleta ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  );
}

function PwaInstallButton() {
  const promptRef = useRef(null);
  const [instalable, setInstalable] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) return undefined;

    const guardarPrompt = (event) => {
      event.preventDefault();
      promptRef.current = event;
      setInstalable(true);
    };

    window.addEventListener('beforeinstallprompt', guardarPrompt);
    return () => window.removeEventListener('beforeinstallprompt', guardarPrompt);
  }, []);

  const instalar = async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    await promptRef.current.userChoice;
    promptRef.current = null;
    setInstalable(false);
  };

  if (!instalable) return null;

  return (
    <button
      type="button"
      onClick={instalar}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-club-black transition-colors hover:bg-white/90"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M10 2a1 1 0 011 1v8.59l2.3-2.3a1 1 0 111.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.42l2.3 2.3V3a1 1 0 011-1z" />
        <path d="M3 16a1 1 0 011 1v1h12v-1a1 1 0 112 0v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
      </svg>
      Instalar app
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

export default function Header({ onToggleSidebar, menuAbierto, onToggleMenu }) {
  const { user, logout } = useAuth();
  const { club } = useClub();
  const headerBgClass = club === 'ARENAS' ? 'bg-club-red' : 'bg-club-black';
  const nombreClub = club === 'ARENAS' ? 'ARENAS CLUB' : 'ROMO FC. - ARENAS CLUB';


  return (
    <header className={`app-header no-print sticky top-0 z-50 text-white shadow-md ${headerBgClass}`}>
      <div className="app-header-content w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {user && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Abrir menu de navegacion"
              className="lg:hidden shrink-0 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <ClubLogo className="h-10 w-10 sm:h-12 sm:w-12 shrink-0" />
          <div className="leading-tight min-w-0">
            <h1 className={`text-base sm:text-xl font-bold tracking-wide truncate ${club === 'ARENAS' ? 'text-black' : 'text-white'}`}>
              {nombreClub}
            </h1>
          </div>
          {user && (
            <div className="hidden lg:block">
              <BotonPantallaCompleta />
            </div>
          )}
        </div>

        {user && (
          <div className="hidden lg:flex items-center gap-3 text-sm">
            <PwaInstallButton />
            <div className="text-right hidden xl:block">
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
          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={onToggleMenu}
              aria-label={menuAbierto ? 'Cerrar opciones de usuario' : 'Abrir opciones de usuario'}
              aria-expanded={menuAbierto}
              className="shrink-0 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {menuAbierto ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M20 21a8 8 0 00-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {user && menuAbierto && (
        <div className="lg:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 items-center gap-2">
            <BotonesHistorial />
            <PwaInstallButton />
            <BotonPantallaCompleta />
          </div>

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
