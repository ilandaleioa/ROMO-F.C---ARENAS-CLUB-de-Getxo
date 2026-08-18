import { useMemo } from 'react';
import ListaEditable, { obtenerClubesDisponibles } from '../components/ListaEditable';
import { useListas } from '../lib/listas';

export default function ClubesMaestros() {
  const listas = useListas();
  const listaClubes = listas.find((lista) => lista.id === 'clubes') || null;
  const clubesDisponibles = useMemo(() => obtenerClubesDisponibles(listaClubes), [listaClubes]);

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Configuracion</p>
        <h2 className="text-2xl font-bold text-club-black">CLUBES</h2>
        <p className="mt-1 text-sm text-club-black/60">
          Gestiona los clubes disponibles y revisa debajo sus equipos asociados desde el mismo apartado.
        </p>
      </div>

      {listaClubes ? (
        <ListaEditable lista={listaClubes} clubesDisponibles={clubesDisponibles} />
      ) : (
        <p className="text-sm text-club-black/60">No hay clubes disponibles.</p>
      )}
    </div>
  );
}
