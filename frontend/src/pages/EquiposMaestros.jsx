import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useListas } from '../lib/listas';
import ListaEditable, { obtenerClubesDisponibles } from '../components/ListaEditable';

export default function EquiposMaestros() {
  const listas = useListas();
  const [searchParams] = useSearchParams();
  const listaClubes = listas.find((lista) => lista.id === 'clubes') || null;
  const listaEquipos = listas.find((lista) => lista.id === 'equipos') || null;
  const clubesDisponibles = useMemo(() => obtenerClubesDisponibles(listaClubes), [listaClubes]);
  const clubSeleccionado = String(searchParams.get('club') || '').trim();
  const equipoSeleccionado = String(searchParams.get('equipo') || '').trim();
  const clubEnfocado = clubSeleccionado;

  const filaAutoEdicion = useMemo(() => {
    if (!listaEquipos || !clubSeleccionado || !equipoSeleccionado) return null;
    return (
      listaEquipos.filas.find(
        (fila) => String(fila?.club || '').trim() === clubSeleccionado && String(fila?.nombre || '').trim() === equipoSeleccionado
      ) || null
    );
  }, [clubSeleccionado, equipoSeleccionado, listaEquipos]);

  const autoEdicionKey = filaAutoEdicion ? `${filaAutoEdicion.id}-${clubSeleccionado}-${equipoSeleccionado}` : '';

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Configuracion</p>
        <h2 className="text-2xl font-bold text-club-black">EQUIPOS</h2>
        <p className="mt-1 text-sm text-club-black/60">Gestiona los equipos por separado del resto de listas maestras.</p>
      </div>

      {listaEquipos ? (
        <ListaEditable
          lista={listaEquipos}
          clubesDisponibles={clubesDisponibles}
          filaAutoEdicion={filaAutoEdicion}
          autoEdicionKey={autoEdicionKey}
          clubEnfocado={clubEnfocado}
        />
      ) : (
        <p className="text-sm text-club-black/60">No hay equipos disponibles.</p>
      )}
    </div>
  );
}
