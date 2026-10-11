import { useEffect, useState } from 'react';
import { api } from '../lib/api';

import { urlEstadisticas } from '../lib/urlEstadisticas';

const CLUB_FILTRO = { ROMO: 'ROMO,ROMO F.C.', ARENAS: 'ARENAS C.' };
const ETAPAS = ['JUVENIL', 'CADETE', 'INFANTIL', 'SENIOR'];
// Factor de reducción del dashboard embebido (1 = tamaño original).
const ESCALA = 0.75;

// Sin equipo se muestra el dashboard completo; con equipo se filtra por club y etapa
// (y por el id federativo del equipo propio cuando se conoce) mediante el hash de la URL.
export default function Estadisticas({ equipo = '', club = '' }) {
  const base = urlEstadisticas();
  const etapa = ETAPAS.find((e) => String(equipo).toUpperCase().includes(e)) || '';
  const [teamId, setTeamId] = useState(null);
  const [season, setSeason] = useState('');
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
      .then((r) => {
        if (cancelado) return;
        setTeamId(r.id || null);
        setSeason(r.season || '');
      })
      .catch(() => !cancelado && setTeamId(null))
      .finally(() => !cancelado && setListo(true));
    return () => {
      cancelado = true;
    };
  }, [equipo, etapa, club]);

  if (!listo) return <p className="px-2 py-10 text-center text-sm font-semibold text-slate-400">Cargando...</p>;

  let url = base;
  if (etapa && CLUB_FILTRO[club]) {
    const hash = new URLSearchParams({ tab: 'dash-equipo', etapa, clubnom: CLUB_FILTRO[club], embed: '1' });
    if (teamId) {
      // El filtro de equipo se aplica en todas las pestañas; el dashboard además abre directamente ese equipo.
      hash.set('team', String(teamId));
      hash.set('tid', String(teamId));
    }
    if (season) hash.set('season', season);
    url = `${base}#${hash}`;
  }

  // El iframe se renderiza a mayor tamaño y se reduce con transform: así todo el contenido
  // (textos, tarjetas, gráficas) se ve más compacto y cabe más información en pantalla.
  return (
    <div className="h-[calc(100dvh-4rem)] overflow-hidden bg-white">
      <iframe
        key={url}
        title="Datos Federaciones"
        src={url}
        style={{
          width: `${100 / ESCALA}%`,
          height: `${100 / ESCALA}%`,
          transform: `scale(${ESCALA})`,
          transformOrigin: 'top left',
        }}
        className="block border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        referrerPolicy="no-referrer"
        allow="fullscreen"
      />
    </div>
  );
}
