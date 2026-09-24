const crypto = require('crypto');
const env = require('./env');

// Mapa de cabeceras del formulario de tecnicos a columnas de Supabase.
const HEADER_TO_COLUMN = {
  'MARCA TEMPORAL': 'marca_temporal',
  NOMBRE: 'nombre',
  'PRIMER APELLIDO': 'primer_apellido',
  'SEGUNDO APELLIDO': 'segundo_apellido',
  TECNICO: 'tecnico',
  FOTO: 'foto_url_sheet',
  'FECHA DE NACIMIENTO': 'fecha_nacimiento',
  DNI: 'dni',
  TELEFONO: 'telefono',
  'E MAIL': 'email',
  LOCALIDAD: 'localidad',
  'TEMPORADA DE INCORPORACION AL CLUB': 'temporada_incorporacion',
  'FUNCION PRINCIPAL EN EL CLUB': 'funcion_principal',
  'OTRA FUNCION EN EL CLUB': 'otra_funcion',
  'EQUIPO EN EL VAS A SER PRIMER ENTRENADOR/A': 'equipo_primer_entrenador',
  'EQUIPO EN EL VAS A SER SEGUNDO ENTRENADOR/A': 'equipo_segundo_entrenador',
  'TITULACION FUTBOLISTICA [NINGUNA]': 'titulacion_ninguna',
  'TITULACION FUTBOLISTICA [MONITOR]': 'titulacion_monitor',
  'TITULACION FUTBOLISTICA [NIVEL 1]': 'titulacion_nivel_1',
  'TITULACION FUTBOLISTICA [NIVEL 2]': 'titulacion_nivel_2',
  'TITULACION FUTBOLISTICA [NIVEL 3]': 'titulacion_nivel_3',
  'OTRAS TITULACIONES [NO CUENTO CON FORMACION REGLADA EXPECIFICA EN DEPORTE]': 'titulacion_sin_formacion',
  'OTRAS TITULACIONES [MAGISTERIO]': 'titulacion_magisterio',
  'OTRAS TITULACIONES [TAFAD]': 'titulacion_tafad',
  'OTRAS TITULACIONES [IVEF]': 'titulacion_ivef',
  'OTRAS TITULACIONES [CAFYD]': 'titulacion_cafyd',
  EUSKERA: 'euskera',
  'CUENTA BANCARIA': 'cuenta_bancaria',
  OBSERVACIONES: 'observaciones',
};

const CAMPOS_FECHA = new Set(['marca_temporal', 'fecha_nacimiento']);
const CAMPOS_OBLIGATORIOS = ['nombre', 'primer_apellido'];
const CAMPOS_HASH_FILA = [...new Set(Object.values(HEADER_TO_COLUMN))];

function configDelClub(club) {
  return env.googleSheetsTecnicosPorClub?.[club] || {};
}

function estaConfigurado(club) {
  const { spreadsheetId, gid } = configDelClub(club);
  return Boolean(spreadsheetId && gid);
}

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizarCabecera(header) {
  return normalizarTexto(header).replace(/[:]+$/g, '').replace(/\s+/g, ' ').trim();
}

function valorCanonicoParaHash(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return normalizarTexto(valor);
}

function hashFila(datos) {
  const base = CAMPOS_HASH_FILA.map((campo) => `${campo}=${valorCanonicoParaHash(datos[campo])}`).join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

// dd/mm/aaaa o dd/mm/aaaa hh:mm:ss -> ISO. Devuelve null si no se puede
// interpretar, en vez de lanzar (una fila con fecha rara no debe tumbar la
// importacion completa).
function parsearFecha(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const [, anio, mes, dia, hh = '00', mm = '00', ss = '00'] = isoMatch;
    return isoMatch[4] ? `${anio}-${mes}-${dia}T${hh}:${mm}:${ss}` : `${anio}-${mes}-${dia}`;
  }

  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const [, dia, mes, anio, hh = '00', mm = '00', ss = '00'] = match;
  const iso = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  const tieneHora = match[4] !== undefined;
  return tieneHora ? `${iso}T${hh.padStart(2, '0')}:${mm}:${ss}` : iso;
}

function mapearFila(headers, filaValores) {
  const datos = {};
  headers.forEach((header, i) => {
    const columna = HEADER_TO_COLUMN[normalizarCabecera(header)];
    if (!columna) return;
    const valorCrudo = filaValores[i] !== undefined ? String(filaValores[i]).trim() : '';
    if (valorCrudo === '') {
      datos[columna] = null;
    } else if (CAMPOS_FECHA.has(columna)) {
      datos[columna] = parsearFecha(valorCrudo);
    } else {
      datos[columna] = valorCrudo;
    }
  });

  const faltante = CAMPOS_OBLIGATORIOS.find((campo) => !datos[campo]);
  if (faltante) {
    return { valido: false, motivo: `falta "${faltante}"` };
  }

  datos.sheet_row_hash = hashFila(datos);
  return { valido: true, datos };
}

function parsearRespuestaPublicaGviz(texto) {
  const contenido = String(texto || '')
    .replace(/^\/\*O_o\*\/\s*/, '')
    .replace(/^google\.visualization\.Query\.setResponse\(/, '')
    .replace(/\);?$/, '')
    .trim();

  const payload = JSON.parse(contenido);
  const headers = (payload?.table?.cols || []).map((col) => String(col?.label || ''));
  const filas = (payload?.table?.rows || []).map((row) =>
    (row?.c || []).map((cell) => {
      if (!cell || cell.v === undefined) return '';
      return cell.f !== undefined ? String(cell.f) : String(cell.v);
    })
  );

  return { headers, filas };
}

async function leerFilasDesdeHoja(club) {
  const { spreadsheetId, gid } = configDelClub(club);
  const params = new URLSearchParams({ tqx: 'out:json' });
  if (gid) params.set('gid', String(gid));

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo leer la hoja publica de tecnicos. HTTP ${res.status}`);
  }

  const texto = await res.text();
  const { headers, filas } = parsearRespuestaPublicaGviz(texto);
  if (filas.length === 0) return { headers: [], validas: [], omitidas: [] };

  const validas = [];
  const omitidas = [];

  filas.forEach((filaValores, i) => {
    if (filaValores.every((v) => !v)) return;

    const resultado = mapearFila(headers, filaValores);
    const numeroFila = i + 2;
    if (resultado.valido) {
      validas.push(resultado.datos);
    } else {
      omitidas.push({ numeroFila, motivo: resultado.motivo });
    }
  });

  return { headers, validas, omitidas };
}

module.exports = {
  estaConfigurado,
  leerFilasDesdeHoja,
};
