// Iguala el nombre de los jugadores de un equipo (p. ej. ROMO JUVENIL) al que figura en la federación.
// Requiere que el jugador esté vinculado (jugadores.federacion_player_id): ver scripts/match-jugadores-csv.js.
// Uso:
//   node scripts/sincronizar-nombres-federacion.js [--equipo "ROMO JUVENIL"] [--club ROMO] [--titulo] [--aplicar] [carpeta_csv]
// Sin --aplicar solo genera backend/exports/sincronizar_nombres.csv (contiene datos personales: no se
// versiona, esta en .gitignore) y muestra recuentos por consola. Con --aplicar actualiza nombre,
// primer_apellido y segundo_apellido; el informe conserva los valores anteriores para poder revertir.
// La federacion escribe «APELLIDOS, NOMBRE» en mayusculas; por defecto se respeta tal cual.
// Con --titulo se convierte a «Nombre Apellido Apellido».

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabaseAdmin = require('../src/config/supabaseClient');

const args = process.argv.slice(2);
const valorDe = (flag, defecto) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defecto;
};
const APLICAR = args.includes('--aplicar');
const TITULO = args.includes('--titulo');
const EQUIPO = valorDe('--equipo', 'ROMO JUVENIL');
const CLUB = valorDe('--club', 'ROMO');
const posicionales = args.filter((a, i) => !a.startsWith('--') && !['--equipo', '--club'].includes(args[i - 1]));
const CSV_DIR = posicionales[0] || 'G:/Mi unidad/DATOS FEDERACIONES/Export BD/csv';
const OUT_DIR = path.resolve(__dirname, '../exports');

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'da', 'do', 'van', 'von', 'san', 'santa']);

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

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const aTitulo = (texto) =>
  texto.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|El|Y|Da|Do)\b(?!$)/g, (p, _g, i) => (i === 0 ? p : p.toLowerCase()));

// «MUÑOZ FERNANDEZ, IÑIGO» -> { nombre: 'IÑIGO', primer: 'MUÑOZ', segundo: 'FERNANDEZ' }.
// Las particulas (de, del, la…) se pegan al apellido que acompañan: «DEL CASTILLO» es un solo apellido.
function separarNombre(nombreFederacion) {
  const [apellidos, ...resto] = String(nombreFederacion || '').split(',');
  const nombre = resto.join(',').trim();
  if (!nombre || !apellidos.trim()) return null;
  const grupos = [];
  let acumulado = [];
  for (const palabra of apellidos.trim().split(/\s+/)) {
    acumulado.push(palabra);
    if (!PARTICULAS.has(palabra.toLowerCase())) { grupos.push(acumulado.join(' ')); acumulado = []; }
  }
  if (acumulado.length) grupos.push(acumulado.join(' '));
  const fmt = (t) => (TITULO ? aTitulo(t) : t);
  return { nombre: fmt(nombre), primer: fmt(grupos[0] || ''), segundo: fmt(grupos.slice(1).join(' ')) };
}

async function fetchJugadores() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('jugadores')
      .select('id, nombre, primer_apellido, segundo_apellido, federacion_player_id')
      .eq('club', CLUB)
      .eq('equipo', EQUIPO)
      .range(from, from + 999);
    if (error) throw new Error(`Supabase: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  const jugadores = await fetchJugadores();
  const nombres = new Map(parseCsv(path.join(CSV_DIR, 'dim_player.csv')).map((p) => [String(p.player_id), p.player_name]));

  const resumen = { igual: 0, cambia: 0, sin_vinculo: 0, no_encontrado_en_csv: 0, formato_raro: 0 };
  const cambios = [];
  const filas = [];

  for (const j of jugadores) {
    const antes = [j.nombre, j.primer_apellido, j.segundo_apellido];
    let estado;
    let despues = ['', '', ''];
    if (!j.federacion_player_id) estado = 'sin_vinculo';
    else if (!nombres.has(String(j.federacion_player_id))) estado = 'no_encontrado_en_csv';
    else {
      const sep = separarNombre(nombres.get(String(j.federacion_player_id)));
      if (!sep) estado = 'formato_raro';
      else {
        despues = [sep.nombre, sep.primer, sep.segundo];
        estado = antes.map((x) => x || '').join('|') === despues.join('|') ? 'igual' : 'cambia';
        if (estado === 'cambia') cambios.push({ id: j.id, nombre: sep.nombre, primer_apellido: sep.primer, segundo_apellido: sep.segundo });
      }
    }
    resumen[estado] += 1;
    filas.push([j.id, j.federacion_player_id ?? '', estado, ...antes.map((x) => x ?? ''), ...despues]);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = ['jugador_id', 'federacion_player_id', 'estado', 'nombre_antes', 'ap1_antes', 'ap2_antes', 'nombre_nuevo', 'ap1_nuevo', 'ap2_nuevo'];
  fs.writeFileSync(path.join(OUT_DIR, 'sincronizar_nombres.csv'), '\uFEFF' + [header, ...filas].map((r) => r.map(csvEscape).join(',')).join('\n'));
  console.log(`Equipo ${CLUB} / ${EQUIPO}: ${jugadores.length} jugadores`);
  console.log(resumen);

  if (!APLICAR) return console.log('Simulacion: revisa exports/sincronizar_nombres.csv y repite con --aplicar.');
  let ok = 0;
  for (const c of cambios) {
    const { id, ...campos } = c;
    const { error } = await supabaseAdmin.from('jugadores').update(campos).eq('id', id);
    if (error) throw new Error(`Supabase: ${error.message}`);
    ok += 1;
  }
  console.log(`Actualizados: ${ok}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
