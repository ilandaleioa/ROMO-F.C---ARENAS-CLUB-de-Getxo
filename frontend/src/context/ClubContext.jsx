import { createContext, useContext, useSyncExternalStore } from 'react';
import { getClub, setClub, subscribeClub } from '../lib/clubStore';

const ClubContext = createContext(null);

export const CLUBES = [
  { valor: 'ROMO', label: 'ROMO FC' },
  { valor: 'ARENAS', label: 'ARENAS CLUB' },
];

export function ClubProvider({ children }) {
  const club = useSyncExternalStore(subscribeClub, getClub);

  return <ClubContext.Provider value={{ club, setClub }}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub debe usarse dentro de ClubProvider');
  return ctx;
}
