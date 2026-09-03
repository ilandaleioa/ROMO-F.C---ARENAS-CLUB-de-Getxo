import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { CLUBES, useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';

const APARTADOS = [
  { key: 'resultados', label: 'Resultados', urlKey: 'url_resultados' },
  { key: 'clasificacion', label: 'Clasificación', urlKey: 'url' },
  { key: 'calendario', label: 'Calendario', urlKey: 'url_calendario' },
  { key: 'tabla_cruzada', label: 'Tabla cruzada', urlKey: 'url_tabla_cruzada' },
  { key: 'goleadores', label: 'Goleadores', urlKey: 'url_goleadores' },
  { key: 'porteros', label: 'Porteros', urlKey: 'url_porteros' },
  { key: 'estadisticas', label: 'Estadísticas', urlKey: 'url_estadisticas' },
];

function texto(valor) {
  return String(valor ?? '').trim();
}

function nombreClub(club) {
  return club === 'ARENAS' ? 'ARENAS CLUB' : 'ROMO FC';
}

function tituloCompeticion(competicion) {
  return texto(competicion.nombre) || texto(competicion.equipo_fed) || 'Competición sin nombre';
}

function EnlaceExterno({ apartado, url }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-red text-white shadow">
          <span aria-hidden="true" className="text-lg">◷</span>
        </div>
        <div>
          <p className="text-sm font-black text-slate-800">{apartado.label} oficial</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">Consulta el dato en la web de la federación.</p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-club-red px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow hover:bg-club-redDark"
      >
        Abrir en nueva pestaña ↗
      </a>
    </div>
  );
}

function ApartadosCompeticion({ competicion }) {
  const apartadosDisponibles = APARTADOS.filter((apartado) => texto(competicion[apartado.urlKey]));
  const [activo, setActivo] = useState(apartadosDisponibles[0]?.key || null);

  useEffect(() => {
    setActivo(apartadosDisponibles[0]?.key || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competicion.id]);

  if (apartadosDisponibles.length === 0) {
    return (
      <p className="mt-4 text-sm font-medium text-slate-400">
        Esta competición todavía no tiene enlaces federativos configurados.
      </p>
    );
  }

  const apartado = apartadosDisponibles.find((item) => item.key === activo) || apartadosDisponibles[0];

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {apartadosDisponibles.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActivo(item.key)}
            className={`rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-wide transition ${
              item.key === apartado.key
                ? 'bg-club-red text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <EnlaceExterno apartado={apartado} url={texto(competicion[apartado.urlKey])} />
    </div>
  );
}

export default function CompeticionInfo() {
  const { user } = useAuth();
  const { club, setClub } = useClub();
  const [competiciones, setCompeticiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [equipoActivo, setEquipoActivo] = useState(null);

  const puedeCambiarClub = !user?.club || user.club === 'TODOS';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const respuesta = await api.get('/competiciones/publicas');
      setCompeticiones(respuesta.competiciones || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [club, cargar]);

  const grupos = useMemo(() => {
    const mapa = new Map();
    competiciones.forEach((competicion) => {
      const clave = texto(competicion.equipo_interno) || 'Sin equipo asignado';
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(competicion);
    });
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [competiciones]);

  useEffect(() => {
    if (grupos.length === 0) {
      setEquipoActivo(null);
      return;
    }
    if (!grupos.some(([equipo]) => equipo === equipoActivo)) {
      setEquipoActivo(grupos[0][0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos]);

  const grupoActivo = grupos.find(([equipo]) => equipo === equipoActivo) || grupos[0];

  return (
    <div className="min-h-full bg-white px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-10">
          <h1 className="text-4xl font-black uppercase tracking-[-0.05em] text-slate-950 sm:text-5xl">Competición</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{nombreClub(club)}</p>
        </header>

        {error ? (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-club-red">
            {error}
          </p>
        ) : null}

        <div className="mb-8 flex flex-wrap items-end gap-5">
          {puedeCambiarClub && (
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Club</p>
              <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
                {CLUBES.map((c) => (
                  <button
                    key={c.valor}
                    type="button"
                    onClick={() => setClub(c.valor)}
                    className={`px-5 py-2.5 text-sm font-black uppercase tracking-wide transition-colors ${
                      club === c.valor
                        ? 'bg-club-red text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {grupos.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-black uppercase tracking-wide text-slate-400">Equipo:</span>
            {grupos.map(([equipo]) => (
              <button
                key={equipo}
                type="button"
                onClick={() => setEquipoActivo(equipo)}
                className={`h-9 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                  equipo === equipoActivo
                    ? 'bg-slate-800 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {equipo}
              </button>
            ))}
          </div>
        )}

        {cargando ? (
          <p className="px-2 py-16 text-center text-sm font-semibold text-slate-400">Cargando competiciones...</p>
        ) : grupos.length === 0 ? (
          <p className="px-2 py-16 text-center text-sm font-semibold text-slate-400">
            Todavía no hay competiciones registradas para {nombreClub(club)}.
          </p>
        ) : grupoActivo ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
            <div className="border-b border-slate-200 bg-slate-50/90 px-8 py-5">
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">{grupoActivo[0]}</h2>
            </div>

            <div className="flex flex-col divide-y divide-slate-200">
              {grupoActivo[1].map((competicion) => (
                <div key={competicion.id} className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-800">{tituloCompeticion(competicion)}</h3>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
                      {texto(competicion.tipo) || 'liga'}
                    </span>
                    {texto(competicion.categoria) ? (
                      <span className="inline-flex items-center rounded-full bg-club-red/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-club-red">
                        {competicion.categoria}
                      </span>
                    ) : null}
                    {texto(competicion.etapa) ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-600">
                        {competicion.etapa}
                      </span>
                    ) : null}
                  </div>

                  {texto(competicion.equipo_fed) ? (
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Equipo federativo: <span className="text-slate-700">{competicion.equipo_fed}</span>
                    </p>
                  ) : null}

                  <ApartadosCompeticion competicion={competicion} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
