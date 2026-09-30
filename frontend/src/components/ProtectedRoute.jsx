import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRutaPorDefecto, usuarioPuedeVerApartado } from '../lib/apartados';

export default function ProtectedRoute({ children, allowedRoles, requiredApartado }) {
  const { user, loading, logout } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <div className="p-8 text-center text-club-black/60">Cargando...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const apartadosRequeridos = [].concat(requiredApartado || []);
  const sinPermiso =
    (allowedRoles && !allowedRoles.includes(user.rol)) ||
    (apartadosRequeridos.length > 0 &&
      !apartadosRequeridos.some((apartado) => usuarioPuedeVerApartado(user, apartado)));

  if (sinPermiso) {
    const destino = getRutaPorDefecto(user);
    // Evita bucles de redireccion (pantalla en blanco) si el destino tampoco es accesible.
    if (destino === pathname || destino === '/login') {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-8 text-center text-club-black/70">
          <p>Tu usuario no tiene apartados disponibles. Contacta con un administrador.</p>
          {logout && (
            <button type="button" className="underline" onClick={logout}>
              Cerrar sesión
            </button>
          )}
        </div>
      );
    }
    return <Navigate to={destino} replace />;
  }
  return children;
}
