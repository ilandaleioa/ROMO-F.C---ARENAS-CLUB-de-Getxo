import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { urlEstadisticas } from '../lib/urlEstadisticas';

const COLORES_RESULTADO = { W: 'bg-emerald-500', D: 'bg-amber-400', L: 'bg-club-red' };
const LETRAS_RESULTADO = { W: 'G', D: 'E', L: 'P' };

function fechaCorta(iso) {
  const [anio, mes, dia] = String(iso ?? '').split('-');
  return anio && mes && dia ? `${dia}-${mes}-${anio}` : String(iso ?? '');
}

// Solo escudos https: evita cargar esquemas inesperados desde datos externos.
function escudoSeguro(url) {
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">{etiqueta}</p>
      <p className="mt-0.5 text-base font-bold text-club-black">{valor ?? 0}</p>
    </div>
  );
}

const TRAMOS = ["1-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90'+"];

function TramosBarras({ titulo, valores = [], color }) {
  const max = Math.max(1, ...valores);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">{titulo}</p>
      <div className="mt-2 flex h-20 items-end gap-1.5">
        {TRAMOS.map((tramo, i) => {
          const v = valores[i] ?? 0;
          return (
            <div key={tramo} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${tramo}: ${v}`}>
              <span className="text-[10px] font-bold text-club-black/70">{v}</span>
              <div className={`w-full rounded-t ${color}`} style={{ height: `${(v / max) * 100}%`, minHeight: v ? 3 : 1 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {TRAMOS.map((tramo) => (
          <span key={tramo} className="flex-1 text-center text-[9px] text-slate-400">{tramo.replace("'", '')}</span>
        ))}
      </div>
    </div>
  );
}

function minutos(lista) {
  return (lista || []).map((x) => (x.minute != null ? `${x.minute}'` : '?')).join(' ');
}

function Mensaje({ children, error = false }) {
  return (
    <p className={`px-2 py-6 text-center text-sm font-semibold ${error ? 'text-club-red' : 'text-slate-400'}`}>{children}</p>
  );
}

// Dashboard completo del jugador de la app de Datos (evolución, rankings, comparativas), cargado a petición.
function DashboardFederativo({ id }) {
  const [abierto, setAbierto] = useState(false);
  if (!/^\d{1,12}$/.test(String(id ?? ''))) return null;
  const hash = new URLSearchParams({ tab: 'dash-jugador', pid: String(id), embed: '1' });
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-club-black/70"
      >
        Dashboard federativo completo
        <span aria-hidden="true">{abierto ? '▴' : '▾'}</span>
      </button>
      {abierto && (
        <iframe
          title="Dashboard federativo del jugador"
          src={`${urlEstadisticas()}#${hash}`}
          className="h-[80vh] w-full border-0 border-t border-gray-200 bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
          referrerPolicy="no-referrer"
          allow="fullscreen"
        />
      )}
    </div>
  );
}

// Historial federativo del jugador: totales, temporadas y partidos con minutos, goles y tarjetas.
export default function PartidosJugador({ jugadorId }) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: '' });
  const [temporada, setTemporada] = useState('');

  useEffect(() => {
    let cancelado = false;
    setEstado({ datos: null, cargando: true, error: '' });
    api
      .get(`/federacion/jugador/${encodeURIComponent(jugadorId)}`)
      .then((datos) => !cancelado && setEstado({ datos, cargando: false, error: '' }))
      .catch((err) => !cancelado && setEstado({ datos: null, cargando: false, error: err.message }));
    return () => {
      cancelado = true;
    };
  }, [jugadorId]);

  const { datos } = estado;
  const temporadas = useMemo(() => [...new Set((datos?.partidos || []).map((p) => p.season))], [datos]);
  const partidos = useMemo(
    () => (datos?.partidos || []).filter((p) => !temporada || p.season === temporada),
    [datos, temporada]
  );

  let contenido;
  if (estado.cargando) contenido = <Mensaje>Cargando partidos...</Mensaje>;
  else if (estado.error) contenido = <Mensaje error>{estado.error}</Mensaje>;
  else if (!datos?.vinculado) contenido = <Mensaje>Este jugador aún no está vinculado con la base de datos federativa.</Mensaje>;
  else {
    const t = datos.totales || {};
    contenido = (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          <Dato etiqueta="Partidos" valor={t.pj} />
          <Dato etiqueta="Titular" valor={t.titular} />
          <Dato etiqueta="Minutos" valor={t.minutos} />
          <Dato etiqueta="Goles" valor={t.goles} />
          <Dato etiqueta="Penaltis" valor={t.penaltis} />
          <Dato etiqueta="Propia puerta" valor={t.pp} />
          <Dato etiqueta="Amarillas" valor={t.amarillas} />
          <Dato etiqueta="Doble amarilla" valor={t.doble} />
          <Dato etiqueta="Rojas" valor={t.rojas} />
          <Dato etiqueta="Ganados" valor={t.g} />
          <Dato etiqueta="Empatados" valor={t.e} />
          <Dato etiqueta="Perdidos" valor={t.p} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <TramosBarras titulo="Goles por tramo" valores={datos.golesPorTramo} color="bg-emerald-500" />
          <TramosBarras titulo="Tarjetas por tramo" valores={datos.tarjetasPorTramo} color="bg-club-red" />
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Local / Visitante</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
              {[['Local', datos.localVisitante?.home], ['Visitante', datos.localVisitante?.away]].map(([nombre, v]) => (
                <div key={nombre} className="rounded-lg bg-gray-50 p-2">
                  <p className="text-xs font-semibold text-slate-500">{nombre}</p>
                  <p className="font-bold text-club-black">{v?.pj ?? 0} PJ · {v?.goles ?? 0} goles</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {datos.temporadas.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-100 text-[11px] font-bold uppercase tracking-wide text-club-black/50">
                <tr>
                  <th className="px-3 py-2">Temporada</th>
                  <th className="px-3 py-2">Competición</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2 text-right">PJ</th>
                  <th className="px-3 py-2 text-right">Tit.</th>
                  <th className="px-3 py-2 text-right">Min.</th>
                  <th className="px-3 py-2 text-right">Goles</th>
                  <th className="px-3 py-2 text-right">TA</th>
                  <th className="px-3 py-2 text-right">TR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datos.temporadas.map((s, i) => (
                  <tr key={`${s.season}-${s.competition}-${s.team_id}-${i}`}>
                    <td className="px-3 py-2 font-semibold">{s.season}</td>
                    <td className="px-3 py-2">{s.competition}</td>
                    <td className="px-3 py-2">{s.team}</td>
                    <td className="px-3 py-2 text-right">{s.pj}</td>
                    <td className="px-3 py-2 text-right">{s.titular}</td>
                    <td className="px-3 py-2 text-right">{s.minutos}</td>
                    <td className="px-3 py-2 text-right">{s.goles}</td>
                    <td className="px-3 py-2 text-right">{s.amarillas}</td>
                    <td className="px-3 py-2 text-right">{s.rojas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DashboardFederativo id={datos.federacionPlayerId} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-xs font-bold uppercase tracking-wide text-club-black/60">Partidos ({partidos.length})</h5>
          {temporadas.length > 1 && (
            <select
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              aria-label="Filtrar por temporada"
            >
              <option value="">Todas las temporadas</option>
              {temporadas.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {partidos.length === 0 ? (
          <Mensaje>No hay partidos registrados.</Mensaje>
        ) : (
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {partidos.map((p) => {
              const escudo = escudoSeguro(p.crest);
              const goles = (p.goals || []).length;
              const amarillas = (p.cards || []).filter((c) => c.type === 'yellow').length;
              const rojas = (p.cards || []).filter((c) => c.type !== 'yellow').length;
              const local = p.side === 'home';
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{fechaCorta(p.date)}</span>
                  <span className="w-8 shrink-0 text-xs font-black text-slate-400">J{p.week}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black text-white ${COLORES_RESULTADO[p.result] || 'bg-slate-300'}`}
                  >
                    {LETRAS_RESULTADO[p.result] || '-'}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
                    {escudo ? <img src={escudo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-5 w-5 object-contain" /> : null}
                    <span className="truncate">
                      {local ? `${p.team} ${p.gf}-${p.gc} ${p.rival}` : `${p.rival} ${p.gc}-${p.gf} ${p.team}`}
                    </span>
                  </span>
                  <span className="text-xs text-club-black/60">
                    {p.titular ? 'Titular' : 'Suplente'} · {p.minutos ?? 0} min{p.dorsal ? ` · #${p.dorsal}` : ''}
                    {p.entra != null && p.entra > 0 ? ` · entra ${p.entra}'` : ''}
                    {p.sale != null && p.sale < 80 && p.sale !== p.entra ? ` · sale ${p.sale}'` : ''}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-bold">
                    {goles > 0 && <span title={`Goles: ${minutos(p.goals)}`}>⚽ {goles} <span className="font-normal text-slate-500">{minutos(p.goals)}</span></span>}
                    {amarillas > 0 && <span className="rounded bg-yellow-300 px-1.5" title={`Amarillas: ${minutos((p.cards || []).filter((c) => c.type === 'yellow'))}`}>{amarillas}</span>}
                    {rojas > 0 && <span className="rounded bg-club-red px-1.5 text-white" title="Rojas / doble amarilla">{rojas}</span>}
                  </span>
                  <span className="w-full pl-[7.5rem] text-[11px] text-slate-400">
                    {[p.competition, p.stadium, local ? 'Local' : 'Visitante'].filter(Boolean).join(' · ')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section id="partidos" className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">Partidos</h4>
      <div className="mt-4">{contenido}</div>
    </section>
  );
}
