import { useMemo } from 'react';
import { useListas } from '../lib/listas';
import ListaEditable, { obtenerClubesDisponibles } from '../components/ListaEditable';

export default function EquiposMaestros() {
  const listas = useListas();
  const listaClubes = listas.find((lista) => lista.id === 'clubes') || null;
  const listaEquipos = listas.find((lista) => lista.id === 'equipos') || null;
  const clubesDisponibles = useMemo(() => obtenerClubesDisponibles(listaClubes), [listaClubes]);

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Configuracion</p>
        <h2 className="text-2xl font-bold text-club-black">EQUIPOS</h2>
        <p className="mt-1 text-sm text-club-black/60">Gestiona los equipos por separado del resto de listas maestras.</p>
      </div>

      {listaEquipos ? (
        <ListaEditable lista={listaEquipos} clubesDisponibles={clubesDisponibles} />
      ) : (
        <p className="text-sm text-club-black/60">No hay equipos disponibles.</p>
      )}
    </div>
  );
}
