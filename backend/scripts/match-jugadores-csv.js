// Cruza los jugadores de Romo/Arenas (tabla "jugadores" de Supabase) con los
// jugadores de los CSV federativos (dim_player + agg_team_player_stats).
// Uso:
//   node scripts/match-jugadores-csv.js [carpeta_csv] [--aplicar]
// Con --aplicar guarda jugadores.federacion_player_id (antes hay que ejecutar
// scripts/agregar-federacion-id-jugadores.sql) para las coincidencias exactas
// y probables unicas. Los ambiguos y sin coincidencia no se tocan.
// Genera backend/exports/match_jugadores.csv (contiene datos personales: no
// se versiona, esta en .gitignore) y solo imprime recuentos por consola.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabaseAdmin = require('../src/config/supabaseClient');

const APLICAR = process.argv.includes('--aplicar');
const CSV_DIR = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'G:/Mi unidad/DATOS FEDERACIONES/Export BD/csv';
const OUT_DIR = path.resolve(__dirname, '../exports');

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function tokens(...parts) {
  return parts
    .join(' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !['de', 'del', 'la', 'las', 'los', 'el', 'da', 'do'].includes(t));
}
const key = (t) => [...new Set(t)].sort().join(' ');

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchJugadores() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('jugadores')
      .select('id, club, nombre, primer_apellido, segundo_apellido, equipo')
      .range(from, from + 999);
    if (error) throw new Error(`Supabase: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  const jugadores = await fetchJugadores();
  const dim = parseCsv(path.join(CSV_DIR, 'dim_player.csv'));
  const stats = parseCsv(path.join(CSV_DIR, 'agg_team_player_stats.csv'));

  // Equipos del club por jugador del CSV (para priorizar a quien ha jugado en Romo/Arenas).
  const clubTeams = new Map();
  const allTeams = new Map();
  for (const s of stats) {
    if (!allTeams.has(s.player_id)) allTeams.set(s.player_id, new Set());
    allTeams.get(s.player_id).add(s.team_name);
    if (/romo|arenas/i.test(s.team_name)) {
      if (!clubTeams.has(s.player_id)) clubTeams.set(s.player_id, new Set());
      clubTeams.get(s.player_id).add(`${s.team_name} (${s.competition_key})`);
    }
  }

  const pool = dim.map((p) => ({ ...p, t: tokens(p.player_name), k: key(tokens(p.player_name)), club: clubTeams.has(p.player_id) }));
  const byKey = new Map();
  for (const p of pool) {
    if (!byKey.has(p.k)) byKey.set(p.k, []);
    byKey.get(p.k).push(p);
  }

  const subset = (a, b) => a.every((t) => b.includes(t));
  const filas = [];
  const resumen = { exacto: 0, probable: 0, ambiguo: 0, sin_match: 0 };
  const vinculos = [];

  for (const j of jugadores) {
    const jt = tokens(j.nombre, j.primer_apellido, j.segundo_apellido);
    let cands = (byKey.get(key(jt)) || []);
    let tipo = 'exacto';
    if (cands.length === 0 && jt.length >= 2) {
      tipo = 'probable';
      cands = pool.filter((p) => p.club && p.t.length >= 2 && (subset(p.t, jt) || subset(jt, p.t)));
    }
    // Entre varios candidatos, priorizar los que han jugado en Romo/Arenas.
    if (cands.length > 1) {
      const delClub = cands.filter((c) => c.club);
      if (delClub.length >= 1) cands = delClub;
    }
    const estado = cands.length === 0 ? 'sin_match' : cands.length === 1 ? tipo : 'ambiguo';
    resumen[estado] += 1;
    const c = cands[0];
    if (cands.length === 1) vinculos.push({ id: j.id, player_id: Number(c.player_id) });
    filas.push([
      j.id, j.club, [j.nombre, j.primer_apellido, j.segundo_apellido].filter(Boolean).join(' '), j.equipo,
      estado, cands.length === 1 ? c.player_id : '', cands.length === 1 ? c.player_name : '',
      cands.length === 1 ? [...(clubTeams.get(c.player_id) || [])].join(' | ') : '',
      cands.length > 1 ? cands.map((x) => x.player_id).join(' | ') : '',
    ]);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = ['jugador_id', 'club', 'jugador', 'equipo', 'estado', 'csv_player_id', 'csv_player_name', 'csv_equipos_club', 'csv_candidatos'];
  fs.writeFileSync(
    path.join(OUT_DIR, 'match_jugadores.csv'),
    '\uFEFF' + [header, ...filas].map((r) => r.map(csvEscape).join(',')).join('\n')
  );
  console.log(`Jugadores en app: ${jugadores.length} | jugadores CSV: ${dim.length}`);
  console.log(resumen);

  if (APLICAR) {
    let ok = 0;
    for (const v of vinculos) {
      const { error } = await supabaseAdmin.from('jugadores').update({ federacion_player_id: v.player_id }).eq('id', v.id);
      if (error) throw new Error(`Supabase: ${error.message}`);
      ok += 1;
    }
    console.log(`Vinculados: ${ok}`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
