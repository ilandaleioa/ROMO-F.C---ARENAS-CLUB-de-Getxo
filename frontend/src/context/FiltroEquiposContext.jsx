import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useClub } from './ClubContext';
import { api } from '../lib/api';
import { ordenarEquipos } from '../lib/equiposOrden';

const FiltroEquiposContext = createContext(null);

export function FiltroEquiposProvider({ children }) {
  const { user } = useAuth();
  const { club } = useClub();
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [equiposSeleccionados, setEquiposSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargarEquipos = useCallback(async () => {
    setLoading(true);
    try {
      const { equipos } = await api.get('/jugadores/equipos');
      setEquiposDisponibles(ordenarEquipos(equipos));
    } catch (_) {
      setEquiposDisponibles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setEquiposSeleccionados((actuales) => (actuales.length === 0 ? actuales : []));
      cargarEquipos();
    } else {
      setEquiposDisponibles([]);
      setEquiposSeleccionados((actuales) => (actuales.length === 0 ? actuales : []));
    }
  }, [user, club, cargarEquipos]);

  const toggleEquipo = useCallback((equipo) => {
    setEquiposSeleccionados((prev) =>
      prev.includes(equipo) ? prev.filter((e) => e !== equipo) : [...prev, equipo]
    );
  }, []);

  const seleccionarEquipoUnico = useCallback((equipo) => {
    setEquiposSeleccionados((prev) => (prev.length === 1 && prev[0] === equipo ? [] : [equipo]));
  }, []);

  const limpiarSeleccion = useCallback(() => setEquiposSeleccionados([]), []);

  const value = useMemo(
    () => ({
      equiposDisponibles,
      equiposSeleccionados,
      toggleEquipo,
      seleccionarEquipoUnico,
      limpiarSeleccion,
      loading,
      recargarEquipos: cargarEquipos,
    }),
    [
      equiposDisponibles,
      equiposSeleccionados,
      loading,
      cargarEquipos,
      toggleEquipo,
      seleccionarEquipoUnico,
      limpiarSeleccion,
    ]
  );

  return <FiltroEquiposContext.Provider value={value}>{children}</FiltroEquiposContext.Provider>;
}

export function useFiltroEquipos() {
  const ctx = useContext(FiltroEquiposContext);
  if (!ctx) throw new Error('useFiltroEquipos debe usarse dentro de FiltroEquiposProvider');
  return ctx;
}
