const crypto = require('crypto');
const { google } = require('googleapis');
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
  'OTRAS TITULACIONES': 'titulacion_otras',
  EUSKERA: 'euskera',
  'CUENTA BANCARIA': 'cuenta_bancaria',
  OBSERVACIONES: 'observaciones',
};

const ID_SYNC_HEADER = 'ID_SYNC';
const FOTO_WEB_HEADER = 'FOTO_WEB';
const CAMPOS_FECHA = new Set(['marca_temporal', 'fecha_nacimiento']);
const CAMPOS_OBLIGATORIOS = ['nombre', 'primer_apellido'];
const CAMPOS_HASH_FILA = [...new Set(Object.values(HEADER_TO_COLUMN))];
const COLUMNAS_EDITABLES = [...CAMPOS_HASH_FILA];

function configDelClub(club) {
  return env.googleSheetsTecnicosPorClub?.[club] || {};
}

function tieneCredencialesDeEscritura() {
  const { email, privateKey } = env.googleServiceAccount;
  return Boolean(email && privateKey);
}

function estaConfigurado(club) {
  const { spreadsheetId, gid } = configDelClub(club);
  return Boolean(spreadsheetId && gid);
}

function puedeEscribir(club) {
  return estaConfigurado(club) && tieneCredencialesDeEscritura();
}

function getSheetsClient() {
  if (!tieneCredencialesDeEscritura()) return null;
  const auth = new google.auth.JWT({
    email: env.googleServiceAccount.email,
    key: env.googleServiceAccount.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
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

function formatearFechaParaHoja(valor, conHora = false) {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);

  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  if (!conHora) return `${dia}/${mes}/${anio}`;

  const hh = String(fecha.getHours()).padStart(2, '0');
  const mm = String(fecha.getMinutes()).padStart(2, '0');
  const ss = String(fecha.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${hh}:${mm}:${ss}`;
}

function enlaceFotoWeb(tecnico) {
  if (!tecnico.foto_path) return '';
  return `${env.frontendOrigin}/tecnicos?tecnico=${tecnico.id}`;
}

function valorParaHoja(columna, valor) {
  if (valor === null || valor === undefined) return '';
  if (columna === 'marca_temporal') return formatearFechaParaHoja(valor, true);
  if (columna === 'fecha_nacimiento') return formatearFechaParaHoja(valor, false);
  return valor;
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

async function leerFilasPublicoGviz(club) {
  const { spreadsheetId, gid } = configDelClub(club);
  const params = new URLSearchParams({ tqx: 'out:json' });
  if (gid) params.set('gid', String(gid));

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo leer la hoja publica de tecnicos. HTTP ${res.status}`);
  }

  const texto = await res.text();
  return parsearRespuestaPublicaGviz(texto);
}

async function resolverPestana(sheets, club) {
  const { spreadsheetId, gid } = configDelClub(club);
  const gidObjetivo = gid ? Number(gid) : null;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = meta.data.sheets.map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));
  const tab = tabs.find((t) => t.gid === gidObjetivo) || tabs[0];
  if (!tab) throw new Error('La hoja de calculo de tecnicos no tiene ninguna pestana.');
  return tab.title;
}

function escaparTituloHoja(tabTitle) {
  return String(tabTitle || '').replace(/'/g, "''");
}

function columnaAIndice(idx) {
  let n = idx;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

// Lee todas las filas validas de la hoja (via lectura publica gviz, sin
// necesitar credenciales). Se usa para el import inicial hacia Supabase.
async function leerFilasDesdeHoja(club) {
  const { headers, filas } = await leerFilasPublicoGviz(club);
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

// Escribe (crea o actualiza) la fila de un tecnico en la hoja de Google
// Sheets, usando la Service Account. Enlaza por ID_SYNC: si el tecnico no
// tiene fila conocida, se anade una nueva y se etiqueta con su id.
async function escribirTecnicoEnHoja(club, tecnico) {
  if (!puedeEscribir(club)) {
    return {
      omitida: true,
      motivo: 'Faltan credenciales de Google (service account) para escribir en la hoja de tecnicos.',
    };
  }

  const sheets = getSheetsClient();
  const tabTitle = await resolverPestana(sheets, club);
  const titulo = escaparTituloHoja(tabTitle);
  const { spreadsheetId } = configDelClub(club);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${titulo}'!A:BZ`,
  });
  const filas = res.data.values || [];
  const headers = [...(filas[0] || [])];
  if (headers.length === 0) throw new Error('La hoja de tecnicos no tiene cabeceras.');

  let idxIdSync = headers.indexOf(ID_SYNC_HEADER);
  let cabecerasCambiadas = false;
  if (idxIdSync === -1) {
    idxIdSync = headers.length;
    headers.push(ID_SYNC_HEADER);
    cabecerasCambiadas = true;
  }

  let idxFotoWeb = headers.indexOf(FOTO_WEB_HEADER);
  if (idxFotoWeb === -1) {
    idxFotoWeb = headers.length;
    headers.push(FOTO_WEB_HEADER);
    cabecerasCambiadas = true;
  }

  if (cabecerasCambiadas) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${titulo}'!A1:${columnaAIndice(headers.length - 1)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  let filaExistente = null;
  for (let i = 1; i < filas.length; i += 1) {
    const idSync = filas[i]?.[idxIdSync] ? String(filas[i][idxIdSync]).trim() : '';
    if (idSync && idSync === String(tecnico.id)) {
      filaExistente = { numeroFila: i + 1, fila: filas[i] };
      break;
    }
  }

  const ancho = Math.max(headers.length, idxIdSync + 1, idxFotoWeb + 1);
  const valores = Array.from({ length: ancho }, (_, i) => filaExistente?.fila?.[i] ?? '');
  headers.forEach((header, i) => {
    const cabecera = normalizarCabecera(header);
    if (cabecera === ID_SYNC_HEADER || cabecera === FOTO_WEB_HEADER) return;
    const columna = HEADER_TO_COLUMN[cabecera];
    if (!columna || !COLUMNAS_EDITABLES.includes(columna)) return;
    valores[i] = valorParaHoja(columna, tecnico[columna]);
  });
  valores[idxIdSync] = tecnico.id;
  valores[idxFotoWeb] = enlaceFotoWeb(tecnico);

  const ultimaColumna = columnaAIndice(valores.length - 1);

  if (filaExistente) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${titulo}'!A${filaExistente.numeroFila}:${ultimaColumna}${filaExistente.numeroFila}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [valores] },
    });
    return { omitida: false, accion: 'actualizado' };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${titulo}'!A:${ultimaColumna}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [valores] },
  });
  return { omitida: false, accion: 'insertado' };
}

// Borra (deja en blanco, conservando la fila) la fila enlazada a un tecnico
// concreto por ID_SYNC. No reordena ni elimina filas de otros tecnicos.
async function borrarTecnicoDeHoja(club, tecnicoId) {
  if (!puedeEscribir(club)) {
    return { omitida: true, motivo: 'Faltan credenciales de Google (service account) para escribir en la hoja de tecnicos.' };
  }

  const sheets = getSheetsClient();
  const tabTitle = await resolverPestana(sheets, club);
  const titulo = escaparTituloHoja(tabTitle);
  const { spreadsheetId } = configDelClub(club);

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' });
  const pestana = (meta.data.sheets || []).find((s) => s.properties?.title === tabTitle);
  const sheetId = pestana?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`No se encontro la pestana "${tabTitle}" para borrar el tecnico.`);
  }

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${titulo}'!A:BZ` });
  const filas = res.data.values || [];
  const headers = filas[0] || [];
  const idxIdSync = headers.indexOf(ID_SYNC_HEADER);
  if (idxIdSync === -1) return { omitida: true, motivo: 'La hoja no tiene columna ID_SYNC.' };

  const indiceFila = filas.findIndex((fila, i) => i > 0 && fila?.[idxIdSync] === String(tecnicoId));
  if (indiceFila === -1) return { omitida: true, motivo: 'No se encontro la fila enlazada en la hoja.' };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: indiceFila, endIndex: indiceFila + 1 },
          },
        },
      ],
    },
  });

  return { omitida: false };
}

// Tras un import inicial, enlaza cada fila de la hoja con el id de Supabase
// que le corresponde (por sheet_row_hash), escribiendo ID_SYNC. Sin esto, la
// primera edicion desde la web crearia una fila duplicada en vez de
// actualizar la fila original del formulario.
async function marcarIdSyncEnHoja(club, hashesConId) {
  if (!puedeEscribir(club) || hashesConId.length === 0) {
    return { omitida: true, motivo: 'Faltan credenciales de Google (service account) o no hay filas que enlazar.' };
  }

  const sheets = getSheetsClient();
  const tabTitle = await resolverPestana(sheets, club);
  const titulo = escaparTituloHoja(tabTitle);
  const { spreadsheetId } = configDelClub(club);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${titulo}'!A:BZ` });
  const filas = res.data.values || [];
  const headers = [...(filas[0] || [])];
  if (headers.length === 0) return { omitida: true, motivo: 'La hoja no tiene cabeceras.' };

  let idxIdSync = headers.indexOf(ID_SYNC_HEADER);
  let cabecerasCambiadas = false;
  if (idxIdSync === -1) {
    idxIdSync = headers.length;
    headers.push(ID_SYNC_HEADER);
    cabecerasCambiadas = true;
  }

  if (cabecerasCambiadas) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${titulo}'!A1:${columnaAIndice(headers.length - 1)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  const hashPorFila = new Map();
  const idxPorHash = new Map(hashesConId.map((item) => [item.sheet_row_hash, item.id]));

  const data = [];
  for (let i = 1; i < filas.length; i += 1) {
    const fila = filas[i] || [];
    const idSyncActual = fila[idxIdSync] ? String(fila[idxIdSync]).trim() : '';
    if (idSyncActual) continue;

    const resultado = mapearFila(headers, fila);
    if (!resultado.valido) continue;

    const id = idxPorHash.get(resultado.datos.sheet_row_hash);
    if (!id || hashPorFila.has(resultado.datos.sheet_row_hash)) continue;

    hashPorFila.set(resultado.datos.sheet_row_hash, id);
    data.push({
      range: `'${titulo}'!${columnaAIndice(idxIdSync)}${i + 1}`,
      values: [[id]],
    });
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  return { omitida: false, enlazados: data.length };
}

module.exports = {
  estaConfigurado,
  puedeEscribir,
  leerFilasDesdeHoja,
  escribirTecnicoEnHoja,
  borrarTecnicoDeHoja,
  marcarIdSyncEnHoja,
};
