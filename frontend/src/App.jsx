import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FiltroEquiposProvider } from './context/FiltroEquiposContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Login from './pages/Login';
import Plantillas from './pages/Plantillas';
import FichaJugador from './pages/FichaJugador';
import Usuarios from './pages/Usuarios';
import Campogramas from './pages/Campogramas';
import Municipios from './pages/Municipios';

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-club-black/60">Cargando...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/plantillas"
        element={
          <ProtectedRoute>
            <Layout>
              <Plantillas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/plantillas/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <FichaJugador />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/campogramas"
        element={
          <ProtectedRoute>
            <Layout>
              <Campogramas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute allowedRoles={['administrador', 'director']}>
            <Layout>
              <Usuarios />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/municipios"
        element={
          <ProtectedRoute allowedRoles={['administrador', 'director']}>
            <Layout>
              <Municipios />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? '/plantillas' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FiltroEquiposProvider>
          <AppRoutes />
        </FiltroEquiposProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
