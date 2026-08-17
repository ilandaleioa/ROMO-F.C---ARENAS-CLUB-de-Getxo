import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRutaPorDefecto, usuarioPuedeVerApartado } from '../lib/apartados';

export default function ProtectedRoute({ children, allowedRoles, requiredApartado }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-club-black/60">Cargando...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to={getRutaPorDefecto(user)} replace />;
  }
  if (requiredApartado && !usuarioPuedeVerApartado(user, requiredApartado)) {
    return <Navigate to={getRutaPorDefecto(user)} replace />;
  }
  return children;
}
