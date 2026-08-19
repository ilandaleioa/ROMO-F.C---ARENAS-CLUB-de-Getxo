import { useMemo } from 'react';
import { useListas } from '../lib/listas';
import ListaEditable, { obtenerClubesDisponibles } from '../components/ListaEditable';

export default function Listas() {
  const listas = useListas();
  const listaClubes = listas.find((lista) => lista.id === 'clubes') || null;
  const clubesDisponibles = useMemo(() => obtenerClubesDisponibles(listaClubes), [listaClubes]);
  const listasVisibles = listas.filter(
    (lista) => lista.id !== 'clubes' && lista.id !== 'equipos' && lista.id !== 'lateralidad' && lista.id !== 'demarcacion'
  );

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Configuracion</p>
        <h2 className="text-2xl font-bold text-club-black">Listas</h2>
        <p className="mt-1 text-sm text-club-black/60">Consulta las opciones maestras disponibles en la aplicacion.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {listasVisibles.map((lista, indice) => (
          <ListaEditable key={`${lista.id}-${indice}`} lista={lista} clubesDisponibles={clubesDisponibles} />
        ))}
      </div>
    </div>
  );
}
