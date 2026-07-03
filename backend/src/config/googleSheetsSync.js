const { google } = require('googleapis');
const env = require('./env');

// Mapeo exacto encabezado de columna (hoja "PLANTILLAS 2627") -> columna en
// la tabla "jugadores" de Supabase. Si cambian los titulos de las preguntas
// del Form hay que actualizar este mapa.
const HEADER_TO_COLUMN = {
  'Marca temporal': 'marca_temporal',
  NOMBRE: 'nombre',
  'PRIMER APELLIDO': 'primer_apellido',
  'SEGUNDO APELLIDO': 'segundo_apellido',
  EQUIPO: 'equipo',
  FECHA: 'fecha_nacimiento',
  'LUGAR NACIMIENTO': 'lugar_nacimiento',
  'DNI ': 'dni_jugador',
  ALTURA: 'altura_cm',
  PESO: 'peso_kg',
  'HERMANOS EN EL CLUB': 'tiene_hermanos_club',
  Domicilio: 'domicilio',
  Numero: 'numero',
  'Piso y / o letra ': 'piso_letra',
  Localidad: 'localidad',
  COLEGIO: 'colegio_instituto',
  'HORA SALIDA': 'hora_salida_colegio',
  'CLUB PROCEDENCIA': 'club_procedencia',
  'TEMPORADA INGRESO': 'temporada_ingreso',
  TELÉFONO: 'telefono_jugador',
  MAIL: 'email_jugador',
  'Nombre de aita ': 'nombre_aita',
  'Primer apellido de aita ': 'primer_apellido_aita',
  'Segundo apellido de aita ': 'segundo_apellido_aita',
  'DNI de aita ': 'dni_aita',
  'Telefono de aita ': 'telefono_aita',
  'E - mail de aita ': 'email_aita',
  'Nombre de ama': 'nombre_ama',
  'Primer apellido de ama': 'primer_apellido_ama',
  'Segundo apellido de ama ': 'segundo_apellido_ama',
  'DNI de ama': 'dni_ama',
  'Teléfono de ama': 'telefono_ama',
  'E - mail de ama': 'email_ama',
  ACEPTACIÓN: 'acepta_condiciones',
  'NOMBRE ACEPTA': 'nombre_aceptante',
  'DNI ACEPTA': 'dni_aceptante',
  Observaciones: 'observaciones',
};

const ID_SYNC_HEADER = 'ID_SYNC';
const CAMPOS_NUMERICOS = new Set(['altura_cm', 'peso_kg']);
const CAMPOS_FECHA = new Set(['marca_temporal', 'fecha_nacimiento']);
const CAMPOS_BOOLEANOS = new Set(['tiene_hermanos_club', 'acepta_condiciones']);
const CAMPOS_OBLIGATORIOS = ['nombre', 'primer_apellido', 'equipo'];

function estaConfigurado() {
  const { spreadsheetId, serviceAccountEmail, privateKey } = env.googleSheets;
  return Boolean(spreadsheetId && serviceAccountEmail && privateKey);
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: env.googleSheets.serviceAccountEmail,
    key: env.googleSheets.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function resolverPestana(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: env.googleSheets.spreadsheetId });
  const tabs = meta.data.sheets.map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));
  const gidObjetivo = env.googleSheets.gid ? Number(env.googleSheets.gid) : null;
  const tab = (gidObjetivo !== null && tabs.find((t) => t.gid === gidObjetivo)) || tabs[0];
  if (!tab) throw new Error('La hoja de calculo no tiene ninguna pestana.');
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
  const normalizado = String(valor).trim().toLowerCase();
  return ['si', 'sí', 'true', 'x', 'acepto'].some((v) => normalizado.startsWith(v));
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
    const columna = HEADER_TO_COLUMN[header];
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
async function leerFilasPendientes(sheets, tabTitle) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheets.spreadsheetId,
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

async function marcarComoSincronizadas(sheets, tabTitle, idxIdSync, filasConId) {
  if (filasConId.length === 0) return;
  const columnaLetra = columnaAIndice(idxIdSync);
  const data = filasConId.map(({ numeroFila, id }) => ({
    range: `'${tabTitle}'!${columnaLetra}${numeroFila}`,
    values: [[id]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: env.googleSheets.spreadsheetId,
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
