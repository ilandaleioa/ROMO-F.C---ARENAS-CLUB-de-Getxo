import { createContext, useContext, useState } from 'react';

const VistaPlantillasContext = createContext(null);

export function VistaPlantillasProvider({ children }) {
  const [vista, setVista] = useState('tarjeta');

  return (
    <VistaPlantillasContext.Provider value={{ vista, setVista }}>{children}</VistaPlantillasContext.Provider>
  );
}

export function useVistaPlantillas() {
  const context = useContext(VistaPlantillasContext);
  if (!context) {
    throw new Error('useVistaPlantillas debe usarse dentro de VistaPlantillasProvider');
  }
  return context;
}
