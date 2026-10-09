import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const DEFAULT_URL = 'https://deployvercel-alpha-nine.vercel.app/';

// Solo se admite una URL https: evita que una variable mal configurada cargue
// esquemas peligrosos (javascript:, data:) dentro del iframe.
function urlEstadisticas() {
  const configurada = import.meta.env.VITE_ESTADISTICAS_URL?.trim();
  try {
    const url = new URL(configurada || DEFAULT_URL);
    return url.protocol === 'https:' ? url.href : DEFAULT_URL;
  } catch (_) {
    return DEFAULT_URL;
  }
}

const CLUB_FILTRO = { ROMO: 'ROMO,ROMO F.C.', ARENAS: 'Arenas Club' };
const ETAPAS = ['JUVENIL', 'CADETE', 'INFANTIL', 'SENIOR'];

// Sin equipo se muestra el dashboard completo; con equipo se filtra por club y etapa
// (y por el id federativo del equipo propio cuando se conoce) mediante el hash de la URL.
export default function Estadisticas({ equipo = '', club = '' }) {
  const base = urlEstadisticas();
  const etapa = ETAPAS.find((e) => String(equipo).toUpperCase().includes(e)) || '';
  const [teamId, setTeamId] = useState(null);
  const [listo, setListo] = useState(!etapa);

  useEffect(() => {
    if (!etapa) {
      setTeamId(null);
      setListo(true);
      return undefined;
    }
    let cancelado = false;
    setListo(false);
    api
      .get(`/federacion/equipo-dashboard?equipo=${encodeURIComponent(equipo)}`)
      .then((r) => !cancelado && setTeamId(r.id || null))
      .catch(() => !cancelado && setTeamId(null))
      .finally(() => !cancelado && setListo(true));
    return () => {
      cancelado = true;
    };
  }, [equipo, etapa, club]);

  if (!listo) return <p className="px-2 py-10 text-center text-sm font-semibold text-slate-400">Cargando...</p>;

  let url = base;
  if (etapa && CLUB_FILTRO[club]) {
    const hash = new URLSearchParams({ tab: 'dash-equipo', etapa, clubnom: CLUB_FILTRO[club] });
    if (teamId) hash.set('tid', String(teamId));
    url = `${base}#${hash}`;
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <iframe
        key={url}
        title="Datos Federaciones"
        src={url}
        className="w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        referrerPolicy="no-referrer"
        allow="fullscreen"
      />
    </div>
  );
}
