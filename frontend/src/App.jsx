import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubProvider } from './context/ClubContext';
import { useClub } from './context/ClubContext';
import { FiltroEquiposProvider } from './context/FiltroEquiposContext';
import { VistaPlantillasProvider } from './context/VistaPlantillasContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Plantillas from './pages/Plantillas';
import FichaJugador from './pages/FichaJugador';
import Usuarios from './pages/Usuarios';
import Campogramas from './pages/Campogramas';
import HojasCalculo from './pages/HojasCalculo';
import Captacion from './pages/Captacion';
import CaptacionDetalle from './pages/CaptacionDetalle';
import Clubes from './pages/Clubes';
import ClubesMaestros from './pages/ClubesMaestros';
import Listas from './pages/Listas';
import Personal from './pages/Personal';
import { ROLES_GESTION_USUARIOS } from './lib/roles';

function ClubThemeSync() {
  const { club } = useClub();

  useEffect(() => {
    document.documentElement.dataset.club = club;
    document.body.dataset.club = club;
  }, [club]);

  return null;
}

function Layout({ children }) {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        onToggleSidebar={() => {
          setSidebarAbierto((v) => !v);
          setMenuUsuarioAbierto(false);
        }}
        menuAbierto={menuUsuarioAbierto}
        onToggleMenu={() => {
          setMenuUsuarioAbierto((v) => !v);
          setSidebarAbierto(false);
        }}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar isOpen={sidebarAbierto} onClose={() => setSidebarAbierto(false)} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
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
        path="/"
        element={
          <ProtectedRoute requiredApartado="inicio">
            <Layout>
              <Plantillas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/plantillas/:id"
        element={
          <ProtectedRoute requiredApartado="inicio">
            <Layout>
              <FichaJugador />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/campogramas"
        element={
          <ProtectedRoute requiredApartado="campogramas">
            <Layout>
              <Campogramas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/captacion"
        element={
          <ProtectedRoute requiredApartado="captacion">
            <Layout>
              <Captacion />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/captacion/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <CaptacionDetalle />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/personal"
        element={
          <ProtectedRoute requiredApartado="personal">
            <Layout>
              <Personal />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clubes"
        element={
          <ProtectedRoute>
            <Layout>
              <Clubes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/listas/clubes"
        element={
          <ProtectedRoute allowedRoles={['administrador', 'director']} requiredApartado="clubes_maestros">
            <Layout>
              <ClubesMaestros />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipos"
        element={<Navigate to="/listas/clubes" replace />}
      />
      <Route
        path="/listas/equipos"
        element={<Navigate to="/listas/clubes" replace />}
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute allowedRoles={ROLES_GESTION_USUARIOS} requiredApartado="usuarios">
            <Layout>
              <Usuarios />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/listas"
        element={
          <ProtectedRoute allowedRoles={['administrador', 'director']} requiredApartado="listas">
            <Layout>
              <Listas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hojas-calculo"
        element={
          <ProtectedRoute requiredApartado="hojas_calculo">
            <Layout>
              <HojasCalculo />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
          <ClubThemeSync />
          <FiltroEquiposProvider>
            <VistaPlantillasProvider>
              <AppRoutes />
            </VistaPlantillasProvider>
          </FiltroEquiposProvider>
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
