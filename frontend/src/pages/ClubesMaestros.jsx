import { useMemo, useState } from 'react';
import ListaEditable, { obtenerClubesDisponibles } from '../components/ListaEditable';
import { useListas } from '../lib/listas';

function normalizarBusqueda(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

export default function ClubesMaestros() {
  const listas = useListas();
  const listaClubes = listas.find((lista) => lista.id === 'clubes') || null;
  const clubesDisponibles = useMemo(() => obtenerClubesDisponibles(listaClubes), [listaClubes]);
  const [busqueda, setBusqueda] = useState('');

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <label htmlFor="buscar-clubes" className="sr-only">Buscar club</label>
        <div className="relative max-w-xl">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-club-black/45" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id="buscar-clubes"
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar club"
            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-10 text-sm text-club-black shadow-sm outline-none transition focus:border-club-red focus:ring-2 focus:ring-club-red/15"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute inset-y-0 right-2 flex items-center rounded-full px-2 text-lg leading-none text-club-black/45 transition hover:bg-gray-100 hover:text-club-black"
              aria-label="Borrar búsqueda"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {listaClubes ? (
        <ListaEditable lista={listaClubes} clubesDisponibles={clubesDisponibles} filtroClub={normalizarBusqueda(busqueda)} />
      ) : (
        <p className="text-sm text-club-black/60">No hay clubes disponibles.</p>
      )}
    </div>
  );
}
