import { useEffect, useState } from 'react';
import { api } from '../lib/api';

import { urlEstadisticas } from '../lib/urlEstadisticas';

// Secciones de la app de Datos accesibles por hash (clave = pestaña de Datos).
const SECCIONES = [
  ['dash-equipo', 'Dashboard'],
  ['listado', 'Clubes / Equipos'],
  ['partidos', 'Actas'],
  ['plantillas', 'Plantillas'],
  ['clasificacion', 'Clasificaciones'],
  ['calendario', 'Calendario'],
  ['jugadores', 'Jugadores'],
  ['equipos', 'Datos'],
  ['ranking', 'Ranking'],
];

const claseBoton = (activo) =>
  `rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
    activo
      ? 'bg-club-red text-white'
      : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

const CLUB_FILTRO = { ROMO: 'ROMO,ROMO F.C.', ARENAS: 'Arenas Club' };
const ETAPAS = ['JUVENIL', 'CADETE', 'INFANTIL', 'SENIOR'];

// Sin equipo se muestra el dashboard completo; con equipo se filtra por club y etapa
// (y por el id federativo del equipo propio cuando se conoce) mediante el hash de la URL.
export default function Estadisticas({ equipo = '', club = '' }) {
  const base = urlEstadisticas();
  const etapa = ETAPAS.find((e) => String(equipo).toUpperCase().includes(e)) || '';
  const [teamId, setTeamId] = useState(null);
  const [listo, setListo] = useState(!etapa);
  const [seccion, setSeccion] = useState('dash-equipo');

  useEffect(() => setSeccion('dash-equipo'), [equipo, club]);

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
    const hash = new URLSearchParams({ tab: seccion, etapa, clubnom: CLUB_FILTRO[club], embed: '1' });
    if (teamId) {
      // El filtro de equipo se aplica en todas las pestañas; el dashboard además abre directamente ese equipo.
      hash.set('team', String(teamId));
      if (seccion === 'dash-equipo') hash.set('tid', String(teamId));
    }
    url = `${base}#${hash}`;
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {etapa && CLUB_FILTRO[club] && (
        <div className="flex flex-wrap gap-2 px-2 py-2" aria-label="Secciones de datos">
          {SECCIONES.map(([clave, texto]) => (
            <button key={clave} type="button" onClick={() => setSeccion(clave)} className={claseBoton(seccion === clave)}>
              {texto}
            </button>
          ))}
        </div>
      )}
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
