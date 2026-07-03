import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';

const linkClass = ({ isActive }) =>
  `block px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
    isActive ? 'bg-club-red text-white' : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/campogramas', label: 'Campogramas' },
  { to: '/hojas-calculo', label: 'Hojas de calculo' },
];

const ADMIN_NAV_ITEMS = [
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/municipios', label: 'Municipios' },
];

const VISTA_OPCIONES = [
  { valor: 'tabla', label: 'Tabla' },
  { valor: 'tarjeta', label: 'Tarjetas' },
  { valor: 'graficas', label: 'Gráficas' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { vista, setVista } = useVistaPlantillas();

  if (!user) return null;

  const isAdminOrDirector = user.rol === 'administrador' || user.rol === 'director';
  const enPlantillas = pathname === '/';

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onClose}>
          {item.label}
        </NavLink>
      ))}
      {isAdminOrDirector &&
        ADMIN_NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose}>
            {item.label}
          </NavLink>
        ))}

      {enPlantillas && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-club-black/50">Vista</p>
          {VISTA_OPCIONES.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => {
                setVista(opcion.valor);
                onClose?.();
              }}
              className={`block w-full text-left px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                vista === opcion.valor
                  ? 'bg-club-red text-white'
                  : 'text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
              }`}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      )}
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
