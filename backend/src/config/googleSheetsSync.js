const { google } = require('googleapis');
const env = require('./env');

// Map normalized sheet headers to Supabase columns.
const HEADER_TO_COLUMN = {
  'MARCA TEMPORAL': 'marca_temporal',
  NOMBRE: 'nombre',
  'PRIMER APELLIDO': 'primer_apellido',
  'SEGUNDO APELLIDO': 'segundo_apellido',
  EQUIPO: 'equipo',
  FECHA: 'fecha_nacimiento',
  'LUGAR NACIMIENTO': 'lugar_nacimiento',
  'DNI': 'dni_jugador',
  ALTURA: 'altura_cm',
  PESO: 'peso_kg',
  'HERMANOS EN EL CLUB': 'tiene_hermanos_club',
  DOMICILIO: 'domicilio',
  NUMERO: 'numero',
  'PISO Y / O LETRA': 'piso_letra',
  LOCALIDAD: 'localidad',
  COLEGIO: 'colegio_instituto',
  'HORA SALIDA': 'hora_salida_colegio',
  'CLUB PROCEDENCIA': 'club_procedencia',
  'TEMPORADA INGRESO': 'temporada_ingreso',
  TELEFONO: 'telefono_jugador',
  MAIL: 'email_jugador',
  'NOMBRE DE AITA': 'nombre_aita',
  'PRIMER APELLIDO DE AITA': 'primer_apellido_aita',
  'SEGUNDO APELLIDO DE AITA': 'segundo_apellido_aita',
  'DNI DE AITA': 'dni_aita',
  'TELEFONO DE AITA': 'telefono_aita',
  'E - MAIL DE AITA': 'email_aita',
  'NOMBRE DE AMA': 'nombre_ama',
  'PRIMER APELLIDO DE AMA': 'primer_apellido_ama',
  'SEGUNDO APELLIDO DE AMA': 'segundo_apellido_ama',
  'DNI DE AMA': 'dni_ama',
  'TELEFONO DE AMA': 'telefono_ama',
  'E - MAIL DE AMA': 'email_ama',
  ACEPTACION: 'acepta_condiciones',
  'NOMBRE ACEPTA': 'nombre_aceptante',
  'DNI ACEPTA': 'dni_aceptante',
  OBSERVACIONES: 'observaciones',
};

const ID_SYNC_HEADER = 'ID_SYNC';
const CAMPOS_NUMERICOS = new Set(['altura_cm', 'peso_kg']);
const CAMPOS_FECHA = new Set(['marca_temporal', 'fecha_nacimiento']);
const CAMPOS_BOOLEANOS = new Set(['tiene_hermanos_club', 'acepta_condiciones']);
const CAMPOS_OBLIGATORIOS = ['nombre', 'primer_apellido', 'equipo'];
const TAB_TITLE_HINTS = ['Form Responses 1', 'Respuestas de formulario 1', 'Respuestas del formulario 1', 'PLANTILLAS 2627'];

function configDelClub(club) {
  return env.googleSheetsPorClub[club] || {};
}

function estaConfigurado(club) {
  const { spreadsheetId } = configDelClub(club);
  const { email, privateKey } = env.googleServiceAccount;
  return Boolean(spreadsheetId && email && privateKey);
}

function getSheetsClient() {
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

async function resolverPestana(sheets, club) {
  const { spreadsheetId, gid } = configDelClub(club);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = meta.data.sheets.map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));
  const gidObjetivo = gid ? Number(gid) : null;

  const tabPorGid = gidObjetivo !== null ? tabs.find((t) => t.gid === gidObjetivo) : null;
  if (tabPorGid) return tabPorGid.title;

  const normalizados = tabs.map((t) => ({ ...t, tituloNormalizado: normalizarTexto(t.title) }));
  const tabPorNombre = normalizados.find((t) => TAB_TITLE_HINTS.some((hint) => t.tituloNormalizado === normalizarTexto(hint)));
  if (tabPorNombre) return tabPorNombre.title;

  const tabPorClave = normalizados.find((t) =>
    t.tituloNormalizado.includes('RESPUESTA') ||
    t.tituloNormalizado.includes('RESPONSE') ||
    t.tituloNormalizado.includes('PLANTILLA')
  );

  const tab = tabPorClave || tabs[0];
  if (!tab) throw new Error('La hoja de calculo no tiene ninguna pestana.');

  if (!gidObjetivo && tabPorClave) {
    console.warn(`Google Sheets ${club}: usando pestana "${tab.title}" al no tener gid configurado.`);
  }

  return tab.title;
}

// dd/mm/aaaa o dd/mm/aaaa hh:mm:ss -> 'aaaa-mm-dd' / ISO. Devuelve null si no
// se puede interpretar, en vez de lanzar (una fila con fecha rara no debe
// tumbar todo el proceso de importacion).
function parsearFecha(valor) {
  if (!valor) return null;
  const match = String(valor)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const [, dia, mes, anio, hh = '00', mm = '00', ss = '00'] = match;
  const iso = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  const tieneHora = match[4] !== undefined;
  return tieneHora ? `${iso}T${hh.padStart(2, '0')}:${mm}:${ss}` : iso;
}

function parsearBooleano(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const normalizado = normalizarTexto(valor);
  return ['SI', 'TRUE', 'X', 'ACEPTO', '1', 'YES'].some((v) => normalizado.startsWith(v));
}

function parsearNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const normalizado = String(valor).trim().replace(',', '.');
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

// El Form ha usado a lo largo del tiempo tanto una pregunta de opcion multiple
// ("Getxo (Algorta, Romo, Las Arenas..)") como texto libre ("Berango") para
// "Localidad". Se normaliza a un nombre de municipio limpio para que no
// aparezcan como localidades distintas en los listados y graficas.
function normalizarLocalidad(valor) {
  if (!valor) return valor;
  let v = String(valor).trim();
  v = v.replace(/\(.*$/, '').trim(); // quita aclaraciones entre parentesis
  v = v.replace(/[.,]+$/, '').trim(); // quita puntuacion suelta al final
  v = v.replace(/\s+/g, ' ');
  v = v.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return v;
}

// Convierte una fila cruda del Sheet (array alineado con `headers`) en un
// objeto para insertar en "jugadores". Devuelve { valido, motivo, datos }.
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
    } else if (CAMPOS_NUMERICOS.has(columna)) {
      datos[columna] = parsearNumero(valorCrudo);
    } else if (CAMPOS_BOOLEANOS.has(columna)) {
      datos[columna] = parsearBooleano(valorCrudo);
    } else if (columna === 'localidad') {
      datos[columna] = normalizarLocalidad(valorCrudo);
    } else {
      datos[columna] = valorCrudo;
    }
  });

  const faltante = CAMPOS_OBLIGATORIOS.find((campo) => !datos[campo]);
  if (faltante) {
    return { valido: false, motivo: `falta "${faltante}"` };
  }
  return { valido: true, datos };
}

// Lee la hoja, devuelve las filas SIN sincronizar todavia (columna ID_SYNC
// vacia) ya mapeadas, junto con el numero de fila real en el Sheet (base 1)
// para poder escribir despues el ID_SYNC en la fila correcta.
async function leerFilasPendientes(sheets, tabTitle, club) {
  const { spreadsheetId } = configDelClub(club);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    // A:BZ deja margen amplio de columnas: el Form tiene 38 preguntas + ID_SYNC.
    range: `'${tabTitle}'!A:BZ`,
  });
  const filas = res.data.values || [];
  if (filas.length === 0) return { headers: [], pendientes: [], omitidas: [] };

  const headers = filas[0];
  let idxIdSync = headers.indexOf(ID_SYNC_HEADER);
  if (idxIdSync === -1) idxIdSync = headers.length; // se creara al escribir

  const pendientes = [];
  const omitidas = [];

  for (let i = 1; i < filas.length; i += 1) {
    const filaValores = filas[i];
    const yaSincronizada = Boolean(filaValores[idxIdSync]);
    if (yaSincronizada) continue;
    if (filaValores.every((v) => !v)) continue; // fila vacia

    const resultado = mapearFila(headers, filaValores);
    const numeroFila = i + 1; // 1-based, incluyendo la fila de cabecera
    if (resultado.valido) {
      pendientes.push({ numeroFila, datos: resultado.datos });
    } else {
      omitidas.push({ numeroFila, motivo: resultado.motivo });
    }
  }

  return { headers, idxIdSync, pendientes, omitidas };
}

async function marcarComoSincronizadas(sheets, tabTitle, idxIdSync, filasConId, club) {
  if (filasConId.length === 0) return;
  const { spreadsheetId } = configDelClub(club);
  const columnaLetra = columnaAIndice(idxIdSync);
  const data = filasConId.map(({ numeroFila, id }) => ({
    range: `'${tabTitle}'!${columnaLetra}${numeroFila}`,
    values: [[id]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
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

module.exports = {
  estaConfigurado,
  getSheetsClient,
  resolverPestana,
  leerFilasPendientes,
  marcarComoSincronizadas,
};
