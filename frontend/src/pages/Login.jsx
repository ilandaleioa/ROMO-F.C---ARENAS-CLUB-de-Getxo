import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRutaPorDefecto } from '../lib/apartados';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const dest = location.state?.from?.pathname || getRutaPorDefecto(user);
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(location.state?.from?.pathname || '/actividades', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-club-black px-4 py-6">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-club-black py-8 sm:py-10 px-4 flex flex-col items-center gap-2">
          <h1 className="text-white text-lg sm:text-xl font-bold text-center leading-tight">
            ROMO FC <span className="text-club-red">-</span> ARENAS
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-club-black mb-1" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-club-black mb-1" htmlFor="password">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
            />
          </div>

          {error && (
            <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-club-red hover:bg-club-redDark disabled:opacity-60 text-white font-bold py-2.5 rounded-md transition-colors"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
