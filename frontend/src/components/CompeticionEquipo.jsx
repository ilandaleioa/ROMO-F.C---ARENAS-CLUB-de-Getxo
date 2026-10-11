import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import ApartadosCompeticion from './ApartadosCompeticion';

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase();
}

function fechaCorta(iso) {
  const [anio, mes, dia] = texto(iso).split('-');
  return anio && mes && dia ? `${dia}-${mes}-${anio}` : texto(iso);
}

function useCarga(ruta, activo) {
  const [estado, setEstado] = useState({ datos: null, cargando: false, error: '' });

  useEffect(() => {
    if (!activo || !ruta) {
      setEstado({ datos: null, cargando: false, error: '' });
      return undefined;
    }
    let cancelado = false;
    setEstado({ datos: null, cargando: true, error: '' });
    api
      .get(ruta)
      .then((datos) => !cancelado && setEstado({ datos, cargando: false, error: '' }))
      .catch((err) => !cancelado && setEstado({ datos: null, cargando: false, error: err.message }));
    return () => {
      cancelado = true;
    };
  }, [ruta, activo]);

  return estado;
}

function Estado({ cargando, error, vacio, mensajeVacio }) {
  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-club-red">{error}</p>;
  }
  if (cargando) return <p className="px-2 py-10 text-center text-sm font-semibold text-slate-400">Cargando...</p>;
  if (vacio) return <p className="px-2 py-10 text-center text-sm font-semibold text-slate-400">{mensajeVacio}</p>;
  return null;
}

function Escudo({ src }) {
  if (!src) return <span className="inline-block h-6 w-6 shrink-0" />;
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 object-contain" />;
}

function Forma({ valor }) {
  const colores = { W: 'bg-emerald-500', D: 'bg-amber-400', L: 'bg-club-red' };
  const letras = { W: 'G', D: 'E', L: 'P' };
  return (
    <span className="inline-flex gap-1">
      {texto(valor).split('').map((c, i) => (
        <span key={i} className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-black text-white ${colores[c] || 'bg-slate-300'}`}>
          {letras[c] || '-'}
        </span>
      ))}
    </span>
  );
}

function Clasificacion({ comp, nombreEquipo }) {
  const { datos, cargando, error } = useCarga(`/federacion/clasificacion?comp=${encodeURIComponent(comp)}`, Boolean(comp));
  const filas = datos?.clasificacion || [];
  const resaltar = normalizar(nombreEquipo);

  if (error || cargando || filas.length === 0) {
    return <Estado cargando={cargando} error={error} vacio mensajeVacio="Todavía no hay clasificación." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-club-black text-xs font-black uppercase tracking-wide text-white">
          <tr>
            <th className="px-3 py-3 text-center">#</th>
            <th className="px-3 py-3 text-left">Equipo</th>
            {['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'Pts'].map((c) => (
              <th key={c} className="px-3 py-3 text-center">{c}</th>
            ))}
            <th className="px-3 py-3 text-left">Forma</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((fila) => {
            const mio = resaltar && normalizar(fila.name).startsWith(resaltar);
            return (
              <tr key={`${fila.id}-${fila.rank}`} className={mio ? 'bg-club-red/10 font-bold' : 'hover:bg-slate-50'}>
                <td className="px-3 py-2 text-center font-black text-slate-500">{fila.rank}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2"><Escudo src={fila.crest} />{fila.name}</span>
                </td>
                <td className="px-3 py-2 text-center">{fila.pj}</td>
                <td className="px-3 py-2 text-center">{fila.g}</td>
                <td className="px-3 py-2 text-center">{fila.e}</td>
                <td className="px-3 py-2 text-center">{fila.p}</td>
                <td className="px-3 py-2 text-center">{fila.gf}</td>
                <td className="px-3 py-2 text-center">{fila.gc}</td>
                <td className="px-3 py-2 text-center">{fila.dg}</td>
                <td className="px-3 py-2 text-center font-black">{fila.pts}</td>
                <td className="px-3 py-2"><Forma valor={fila.form} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Acta({ id }) {
  const { datos, cargando, error } = useCarga(`/federacion/acta?id=${encodeURIComponent(id)}`, true);
  const acta = datos?.acta;

  if (error || cargando || !acta) return <Estado cargando={cargando} error={error} vacio mensajeVacio="Acta no disponible." />;

  const { match, goals = [], cards = [], lineups = [] } = acta;
  const equipos = [
    { id: match.home_team_id, nombre: match.home },
    { id: match.away_team_id, nombre: match.away },
  ];
  const nombreEquipo = (teamId) => equipos.find((e) => e.id === teamId)?.nombre || '';

  return (
    <div className="space-y-5 bg-slate-50/70 p-4 sm:p-6">
      <p className="text-xs font-semibold text-slate-500">
        {[fechaCorta(match.match_date), match.kick_off?.slice(0, 5), match.stadium, match.city, match.referee && `Árbitro: ${match.referee}`]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Goles</h5>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-400">Sin goles.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {goals.map((g, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="w-8 font-black text-slate-500">{g.minute}'</span>
                  <span className="font-bold">{g.sh}-{g.sa}</span>
                  <span>{g.player}</span>
                  <span className="text-slate-400">({nombreEquipo(g.team_id)}{g.type && g.type !== 'normal' ? ` · ${g.type}` : ''})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Tarjetas</h5>
          {cards.length === 0 ? (
            <p className="text-sm text-slate-400">Sin tarjetas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {cards.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2">
                  <span className="w-8 font-black text-slate-500">{c.minute}'</span>
                  <span className={`inline-block h-4 w-3 rounded-sm ${/red|roja/i.test(c.type) ? 'bg-club-red' : 'bg-amber-400'}`} />
                  <span>{c.player}</span>
                  <span className="text-slate-400">({nombreEquipo(c.team_id)})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {equipos.map((equipo) => {
          const jugadores = lineups.filter((l) => l.team_id === equipo.id);
          return (
            <div key={equipo.id}>
              <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Alineación · {equipo.nombre}</h5>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100 font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-center">#</th>
                      <th className="px-2 py-2 text-left">Jugador</th>
                      <th className="px-2 py-2 text-center">Min</th>
                      <th className="px-2 py-2 text-center">G</th>
                      <th className="px-2 py-2 text-center">TA</th>
                      <th className="px-2 py-2 text-center">TR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jugadores.map((j) => (
                      <tr key={`${j.team_id}-${j.id}`} className={j.titular ? 'font-semibold' : 'text-slate-500'}>
                        <td className="px-2 py-1.5 text-center">{j.dorsal ?? '-'}</td>
                        <td className="px-2 py-1.5">{j.name}{j.titular ? '' : ' (supl.)'}</td>
                        <td className="px-2 py-1.5 text-center">{j.minutos ?? '-'}</td>
                        <td className="px-2 py-1.5 text-center">{j.goles || ''}</td>
                        <td className="px-2 py-1.5 text-center">{j.amarillas || ''}</td>
                        <td className="px-2 py-1.5 text-center">{j.rojas || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Actas({ comp, nombreEquipo }) {
  const { datos, cargando, error } = useCarga(`/federacion/partidos?comp=${encodeURIComponent(comp)}`, Boolean(comp));
  const [abierto, setAbierto] = useState(null);
  const [soloEquipo, setSoloEquipo] = useState(true);
  const resaltar = normalizar(nombreEquipo);

  const partidos = useMemo(() => {
    const lista = datos?.partidos || [];
    if (!soloEquipo || !resaltar) return lista;
    return lista.filter((p) => normalizar(p.home).startsWith(resaltar) || normalizar(p.away).startsWith(resaltar));
  }, [datos, soloEquipo, resaltar]);

  useEffect(() => setAbierto(null), [comp]);

  if (error || cargando) return <Estado cargando={cargando} error={error} />;

  return (
    <div className="space-y-3">
      {resaltar ? (
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <input type="checkbox" checked={soloEquipo} onChange={(e) => setSoloEquipo(e.target.checked)} />
          Solo partidos de {nombreEquipo}
        </label>
      ) : null}

      {partidos.length === 0 ? (
        <Estado vacio mensajeVacio="No hay partidos." />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
          {partidos.map((p) => {
            const expandido = abierto === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!p.played}
                  onClick={() => setAbierto(expandido ? null : p.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-white"
                >
                  <span className="w-14 shrink-0 text-xs font-black text-slate-400">J{p.week}</span>
                  <span className="hidden w-24 shrink-0 text-xs font-semibold text-slate-500 sm:inline">{fechaCorta(p.date)}</span>
                  <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right font-semibold">
                    <span className="truncate">{p.home}</span>
                    <Escudo src={p.home_crest} />
                  </span>
                  <span className="w-16 shrink-0 rounded bg-club-black px-2 py-1 text-center text-xs font-black text-white">
                    {p.played ? `${p.hs} - ${p.aws}` : 'vs'}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
                    <Escudo src={p.away_crest} />
                    <span className="truncate">{p.away}</span>
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs font-black uppercase text-club-red">
                    {p.played ? (expandido ? 'Cerrar' : 'Acta') : 'Pend.'}
                  </span>
                </button>
                {expandido ? <Acta id={p.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-2xl font-black text-slate-800">{valor}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</p>
    </div>
  );
}

function GraficasPartidos({ comp, nombreEquipo }) {
  const { datos, cargando, error } = useCarga(`/federacion/partidos?comp=${encodeURIComponent(comp)}`, Boolean(comp));
  const resaltar = normalizar(nombreEquipo);

  const jugados = useMemo(() => {
    const lista = (datos?.partidos || []).filter((p) => p.played);
    const propios = resaltar
      ? lista.filter((p) => normalizar(p.home).startsWith(resaltar) || normalizar(p.away).startsWith(resaltar))
      : lista;
    return propios
      .map((p) => {
        const local = resaltar && normalizar(p.home).startsWith(resaltar);
        const gf = Number(local ? p.hs : p.aws) || 0;
        const gc = Number(local ? p.aws : p.hs) || 0;
        return { id: p.id, week: p.week, local, rival: local ? p.away : p.home, gf, gc, res: gf > gc ? 'W' : gf < gc ? 'L' : 'D' };
      })
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [datos, resaltar]);

  if (error || cargando || jugados.length === 0) {
    return <Estado cargando={cargando} error={error} vacio mensajeVacio="Todavía no hay partidos jugados." />;
  }

  const suma = (lista, campo) => lista.reduce((total, p) => total + p[campo], 0);
  const cuenta = (lista, r) => lista.filter((p) => p.res === r).length;
  const locales = jugados.filter((p) => p.local);
  const visitantes = jugados.filter((p) => !p.local);
  const maxGoles = Math.max(1, ...jugados.map((p) => Math.max(p.gf, p.gc)));
  const colores = { W: 'bg-emerald-500', D: 'bg-amber-400', L: 'bg-club-red' };

  const bloque = (titulo, lista) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h5 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{titulo}</h5>
      <p className="text-sm font-semibold text-slate-700">
        {lista.length} PJ · {cuenta(lista, 'W')}G {cuenta(lista, 'D')}E {cuenta(lista, 'L')}P · {suma(lista, 'gf')} GF / {suma(lista, 'gc')} GC
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Dato etiqueta="Partidos" valor={jugados.length} />
        <Dato etiqueta="Ganados" valor={cuenta(jugados, 'W')} />
        <Dato etiqueta="Empatados" valor={cuenta(jugados, 'D')} />
        <Dato etiqueta="Perdidos" valor={cuenta(jugados, 'L')} />
        <Dato etiqueta="Goles a favor" valor={suma(jugados, 'gf')} />
        <Dato etiqueta="Goles en contra" valor={suma(jugados, 'gc')} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {bloque('Como local', locales)}
        {bloque('Como visitante', visitantes)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h5 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Goles por jornada</h5>
        <ul className="space-y-2">
          {jugados.map((p) => (
            <li key={p.id} className="flex items-center gap-3 text-xs">
              <span className="w-8 shrink-0 font-black text-slate-400">J{p.week}</span>
              <span className={`h-5 w-5 shrink-0 rounded text-center text-[10px] font-black leading-5 text-white ${colores[p.res]}`}>
                {p.res === 'W' ? 'G' : p.res === 'D' ? 'E' : 'P'}
              </span>
              <div className="flex-1 space-y-1">
                <div className="h-2 rounded bg-emerald-500" style={{ width: `${(p.gf / maxGoles) * 100}%`, minWidth: p.gf ? undefined : 2 }} />
                <div className="h-2 rounded bg-club-red/70" style={{ width: `${(p.gc / maxGoles) * 100}%`, minWidth: p.gc ? undefined : 2 }} />
              </div>
              <span className="w-12 shrink-0 text-right font-black">{p.gf} - {p.gc}</span>
              <span className="hidden w-40 shrink-0 truncate text-slate-500 sm:inline">{p.local ? 'vs' : '@'} {p.rival}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex gap-4 text-[11px] font-semibold text-slate-500">
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-emerald-500" />A favor</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-club-red/70" />En contra</span>
        </p>
      </div>
    </div>
  );
}

const PESTANAS = [
  { key: 'clasificacion', label: 'Clasificación' },
  { key: 'actas', label: 'Actas' },
  { key: 'graficas', label: 'Gráficas competición' },
  { key: 'enlaces', label: 'Enlaces federación' },
];

// Muestra la competición del equipo: clasificación, actas y enlaces federativos.
export default function CompeticionEquipo({ equipo, club, pestanaInicial = 'clasificacion' }) {
  const [pestana, setPestana] = useState(pestanaInicial);

  useEffect(() => {
    setPestana(pestanaInicial);
  }, [pestanaInicial]);
  const [compSeleccionada, setCompSeleccionada] = useState('');

  const fed = useCarga(`/federacion/competiciones?equipo=${encodeURIComponent(equipo || '')}`, Boolean(equipo));
  const enlaces = useCarga('/competiciones/publicas', Boolean(equipo));

  const competicionesFed = fed.datos?.competiciones || [];
  const sugerida = fed.datos?.sugerida || '';

  useEffect(() => {
    setCompSeleccionada(sugerida);
  }, [sugerida, equipo, club]);

  if (!equipo) {
    return (
      <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm font-semibold text-club-black/60">
        Selecciona un equipo en el listado para ver su competición.
      </p>
    );
  }

  const competicionesEnlaces = (enlaces.datos?.competiciones || []).filter(
    (c) => normalizar(c.equipo_interno) === normalizar(equipo)
  );
  const nombreFed = club === 'ARENAS' ? 'Arenas' : 'ROMO F.C.';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-6 py-4">
        <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Competición · {equipo}</h3>
        {competicionesFed.length > 1 ? (
          <select
            value={compSeleccionada}
            onChange={(e) => setCompSeleccionada(e.target.value)}
            className="h-10 max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold"
            aria-label="Competición"
          >
            {competicionesFed.map((c) => (
              <option key={c.key} value={c.key}>{c.name} · {c.season}</option>
            ))}
          </select>
        ) : competicionesFed[0] ? (
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {competicionesFed[0].name} · {competicionesFed[0].season}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 px-6 pt-5">
        {PESTANAS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPestana(p.key)}
            className={`rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-wide transition ${
              pestana === p.key ? 'bg-club-red text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {pestana === 'enlaces' ? (
          <Estado
            cargando={enlaces.cargando}
            error={enlaces.error}
            vacio={!enlaces.cargando && !enlaces.error && competicionesEnlaces.length === 0}
            mensajeVacio={`${equipo} todavía no tiene enlaces federativos registrados.`}
          />
        ) : fed.error || fed.cargando || !compSeleccionada ? (
          <Estado
            cargando={fed.cargando}
            error={fed.error}
            vacio
            mensajeVacio={`No hay competición federativa para ${equipo}.`}
          />
        ) : pestana === 'clasificacion' ? (
          <Clasificacion comp={compSeleccionada} nombreEquipo={nombreFed} />
        ) : pestana === 'graficas' ? (
          <GraficasPartidos comp={compSeleccionada} nombreEquipo={nombreFed} />
        ) : (
          <Actas comp={compSeleccionada} nombreEquipo={nombreFed} />
        )}

        {pestana === 'enlaces'
          ? competicionesEnlaces.map((competicion) => (
              <div key={competicion.id} className="border-t border-slate-200 pt-4 first:border-0 first:pt-0">
                <h4 className="text-base font-bold text-slate-800">
                  {texto(competicion.nombre) || texto(competicion.equipo_fed) || 'Competición sin nombre'}
                </h4>
                <ApartadosCompeticion competicion={competicion} />
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
