const crypto = require('crypto');
const { google } = require('googleapis');
const env = require('./env');

// Map normalized sheet headers to Supabase columns.
const HEADER_TO_COLUMN = {
  'MARCA TEMPORAL': 'marca_temporal',
  NOMBRE: 'nombre',
  'PRIMER APELLIDO': 'primer_apellido',
  'SEGUNDO APELLIDO': 'segundo_apellido',
  EQUIPO: 'equipo',
  EDICION: 'edicion',
  FECHA: 'fecha_nacimiento',
  'LUGAR NACIMIENTO': 'lugar_nacimiento',
  'DNI': 'dni_jugador',
  ALTURA: 'altura_cm',
  PESO: 'peso_kg',
  DORSAL: 'dorsal',
  LATERALIDAD: 'lateralidad',
  DEMARCACION: 'demarcacion',
  'DEMARCACIÓN': 'demarcacion',
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
const WEBAPP_SHEET_HEADERS = [
  { header: 'DORSAL', column: 'dorsal' },
  { header: 'LATERALIDAD', column: 'lateralidad' },
  { header: 'DEMARCACION', column: 'demarcacion' },
];
const CAMPOS_NUMERICOS = new Set(['altura_cm', 'peso_kg']);
const CAMPOS_FECHA = new Set(['marca_temporal', 'fecha_nacimiento']);
const CAMPOS_BOOLEANOS = new Set(['tiene_hermanos_club', 'acepta_condiciones']);
const CAMPOS_OBLIGATORIOS = ['nombre', 'equipo'];
const CAMPOS_NOMBRE = ['nombre', 'primer_apellido', 'segundo_apellido'];
// El hash representa toda la fila sincronizable. El hash anterior solo usaba
// nombre/equipo/fecha/DNI, por lo que editar teléfono, domicilio, colegio,
// etc. en la hoja nunca llegaba a Supabase.
const CAMPOS_HASH_FILA = [...new Set(Object.values(HEADER_TO_COLUMN))];
const TAB_TITLE_HINTS = ['Form Responses 1', 'Respuestas de formulario 1', 'Respuestas del formulario 1', 'PLANTILLAS 2627'];
const CAMPOS_MAPA_PISTA = ['nombre', 'primer_apellido', 'segundo_apellido', 'equipo', 'edicion', 'fecha_nacimiento', 'dni_jugador'];

function configDelClub(club) {
  return env.googleSheetsPorClub[club] || {};
}

function tieneCredencialesDeEscritura() {
  const { email, privateKey } = env.googleServiceAccount;
  return Boolean(email && privateKey);
}

function estaConfigurado(club) {
  const { spreadsheetId, gid } = configDelClub(club);
  return Boolean(spreadsheetId && (gid || tieneCredencialesDeEscritura() || env.googleApiKey));
}

function getSheetsClient() {
  if (tieneCredencialesDeEscritura()) {
    const auth = new google.auth.JWT({
      email: env.googleServiceAccount.email,
      key: env.googleServiceAccount.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }

  if (env.googleApiKey) {
    const auth = google.auth.fromAPIKey(env.googleApiKey);
    return google.sheets({ version: 'v4', auth });
  }

  return null;
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

function valorCanonicoParaHash(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  // En el formulario, una aceptacion falsa se representa como celda vacia.
  // False y NULL son el mismo contenido visible en Google Sheets.
  if (campo === 'acepta_condiciones' && valor === false) return '';
  if (typeof valor === 'boolean') return valor ? 'TRUE' : 'FALSE';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  return normalizarTexto(valor);
}

function hashFila(datos) {
  const base = CAMPOS_HASH_FILA.map((campo) => `${campo}=${valorCanonicoParaHash(campo, datos[campo])}`).join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function calcularSheetRowHash(datos) {
  return hashFila(datos || {});
}

function escaparTituloHoja(tabTitle) {
  return String(tabTitle || '').replace(/'/g, "''");
}

async function resolverPestana(sheets, club) {
  const { spreadsheetId, gid } = configDelClub(club);
  const gidObjetivo = gid ? Number(gid) : null;

  if (!sheets) {
    if (gidObjetivo !== null) {
      return 'PUBLIC_SHEET';
    }
    throw new Error('No hay cliente de Google Sheets disponible para resolver la pestana.');
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = meta.data.sheets.map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));

  const tabPorGid = gidObjetivo !== null ? tabs.find((t) => t.gid === gidObjetivo) : null;
  if (tabPorGid) return tabPorGid.title;

  const normalizados = tabs.map((t) => ({ ...t, tituloNormalizado: normalizarTexto(t.title) }));
  const tabPorNombre = normalizados.find((t) => TAB_TITLE_HINTS.some((hint) => t.tituloNormalizado === normalizarTexto(hint)));
  const tabPorClave = normalizados.find((t) =>
    t.tituloNormalizado.includes('RESPUESTA') ||
    t.tituloNormalizado.includes('RESPONSE') ||
    t.tituloNormalizado.includes('PLANTILLA')
  );

  const tab = tabPorNombre || tabPorClave || tabs[0];
  if (!tab) throw new Error('La hoja de calculo no tiene ninguna pestana.');

  if (!gidObjetivo && (tabPorNombre || tabPorClave)) {
    console.warn(`Google Sheets ${club}: usando pestana "${tab.title}" al no tener gid configurado.`);
  }

  // Si no hemos encontrado una pestaña por nombre, intentamos detectar la que
  // realmente contiene el formulario mirando las cabeceras. Esto evita que una
  // hoja auxiliar o una pestaña antigua deje la sincronización en 0 filas.
  const candidatos = await Promise.all(
    tabs.map(async (tabInfo) => {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tabInfo.title}'!A1:BZ1`,
        });
        const headers = res.data.values?.[0] || [];
        return {
          ...tabInfo,
          score: puntuarPestana(headers, tabInfo.title),
          headers,
        };
      } catch (err) {
        return { ...tabInfo, score: 0, headers: [] };
      }
    })
  );

  candidatos.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  if (candidatos[0] && candidatos[0].score > 0) {
    if (candidatos[0].title !== tab.title) {
      console.warn(
        `Google Sheets ${club}: la pestaña "${tab.title}" no parece ser la principal; usando "${candidatos[0].title}" por cabeceras.`
      );
    }
    return candidatos[0].title;
  }

  return tab.title;
}

function puntuarPestana(headers, title) {
  if (!Array.isArray(headers) || headers.length === 0) return 0;

  const columnasDetectadas = new Set();
  let score = 0;

  for (const header of headers) {
    const columna = HEADER_TO_COLUMN[normalizarCabecera(header)];
    if (!columna) continue;
    columnasDetectadas.add(columna);
    score += CAMPOS_MAPA_PISTA.includes(columna) ? 4 : 1;
  }

  for (const campo of CAMPOS_OBLIGATORIOS) {
    if (columnasDetectadas.has(campo)) score += 12;
  }

  if (columnasDetectadas.has('nombre') && columnasDetectadas.has('primer_apellido') && columnasDetectadas.has('equipo')) {
    score += 20;
  }

  const tituloNormalizado = normalizarTexto(title);
  if (TAB_TITLE_HINTS.some((hint) => tituloNormalizado === normalizarTexto(hint))) {
    score += 6;
  }
  if (tituloNormalizado.includes('RESPUESTA') || tituloNormalizado.includes('RESPONSE') || tituloNormalizado.includes('PLANTILLA')) {
    score += 3;
  }

  return score;
}

// dd/mm/aaaa o dd/mm/aaaa hh:mm:ss -> 'aaaa-mm-dd' / ISO. Devuelve null si no
// se puede interpretar, en vez de lanzar (una fila con fecha rara no debe
// tumbar todo el proceso de importacion).
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
    } else if (columna === 'dorsal') {
      datos[columna] = parsearNumero(valorCrudo);
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
  const tieneNombreVisible = CAMPOS_NOMBRE.some((campo) => datos[campo]);
  if (!tieneNombreVisible) {
    return { valido: false, motivo: 'falta "nombre"' };
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
      // gviz entrega las fechas como Date(...), pero también incluye el valor
      // formateado en `f`, que es el que puede interpretar el importador.
      return cell.f !== undefined ? String(cell.f) : String(cell.v);
    })
  );

  return { headers, filas };
}

async function leerFilasPendientesPublic(spreadsheetId, gid, tabTitle) {
  const params = new URLSearchParams({ tqx: 'out:json' });
  if (gid) params.set('gid', String(gid));
  if (tabTitle && tabTitle !== 'PUBLIC_SHEET') params.set('sheet', tabTitle);

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo leer la hoja pública. HTTP ${res.status}`);
  }

  const texto = await res.text();
  const { headers, filas } = parsearRespuestaPublicaGviz(texto);
  if (filas.length === 0) return { headers: [], pendientes: [], actualizables: [], omitidas: [] };

  let idxIdSync = headers.indexOf(ID_SYNC_HEADER);
  if (idxIdSync === -1) idxIdSync = headers.length;

  const pendientes = [];
  const actualizables = [];
  const omitidas = [];

  for (let i = 0; i < filas.length; i += 1) {
    const filaValores = filas[i];
    const idSync = filaValores[idxIdSync] ? String(filaValores[idxIdSync]).trim() : '';
    if (filaValores.every((v) => !v)) continue;

    const resultado = mapearFila(headers, filaValores);
    const numeroFila = i + 2;
    if (resultado.valido) {
      if (idSync) {
        actualizables.push({ numeroFila, id: idSync, datos: resultado.datos });
      } else {
        pendientes.push({ numeroFila, datos: resultado.datos });
      }
    } else {
      omitidas.push({ numeroFila, motivo: resultado.motivo });
    }
  }

  return { headers, idxIdSync, pendientes, actualizables, omitidas };
}

// Lee la hoja y separa las filas nuevas (ID_SYNC vacio) de las ya enlazadas
// con Supabase. Devuelve el numero de fila real en el Sheet (base 1) para
// poder escribir despues el ID_SYNC de las altas nuevas.
async function leerFilasPendientes(sheets, tabTitle, club) {
  const { spreadsheetId, gid } = configDelClub(club);

  if (!sheets) {
    return leerFilasPendientesPublic(spreadsheetId, gid, tabTitle);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    // A:BZ deja margen amplio de columnas: el Form tiene 38 preguntas + ID_SYNC.
    range: `'${tabTitle}'!A:BZ`,
  });
  const filas = res.data.values || [];
  if (filas.length === 0) return { headers: [], pendientes: [], actualizables: [], omitidas: [] };

  const headers = filas[0];
  let idxIdSync = headers.indexOf(ID_SYNC_HEADER);
  if (idxIdSync === -1) idxIdSync = headers.length; // se creara al escribir

  const pendientes = [];
  const actualizables = [];
  const omitidas = [];

  for (let i = 1; i < filas.length; i += 1) {
    const filaValores = filas[i];
    const idSync = filaValores[idxIdSync] ? String(filaValores[idxIdSync]).trim() : '';
    if (filaValores.every((v) => !v)) continue; // fila vacia

    const resultado = mapearFila(headers, filaValores);
    const numeroFila = i + 1; // 1-based, incluyendo la fila de cabecera
    if (resultado.valido) {
      if (idSync) {
        actualizables.push({ numeroFila, id: idSync, datos: resultado.datos });
      } else {
        pendientes.push({ numeroFila, datos: resultado.datos });
      }
    } else {
      omitidas.push({ numeroFila, motivo: resultado.motivo });
    }
  }

  return { headers, idxIdSync, pendientes, actualizables, omitidas };
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

function valorParaHoja(columna, valor) {
  if (valor === null || valor === undefined) return '';
  if (columna === 'marca_temporal') return formatearFechaParaHoja(valor, true);
  if (columna === 'fecha_nacimiento') return formatearFechaParaHoja(valor, false);
  if (columna === 'tiene_hermanos_club') return valor ? 'SI' : 'NO';
  if (columna === 'acepta_condiciones') return valor ? 'He leído y acepto las condiciones del club' : '';
  return valor;
}

function filaDesdeJugador(headers, jugador, idxIdSync, filaActual = []) {
  const ancho = Math.max(headers.length, idxIdSync + 1);
  const valores = Array.from({ length: ancho }, (_, i) => filaActual[i] ?? '');

  headers.forEach((header, i) => {
    if (normalizarCabecera(header) === ID_SYNC_HEADER) {
      valores[i] = jugador.id;
      return;
    }

    const columna = HEADER_TO_COLUMN[normalizarCabecera(header)];
    if (!columna) return;
    valores[i] = valorParaHoja(columna, jugador[columna]);
  });

  valores[idxIdSync] = jugador.id;
  return valores;
}

function asegurarCabecerasWebapp(headers) {
  let huboCambios = false;

  for (const { header, column } of WEBAPP_SHEET_HEADERS) {
    const existe = headers.some((h) => HEADER_TO_COLUMN[normalizarCabecera(h)] === column);
    if (!existe) {
      headers.push(header);
      huboCambios = true;
    }
  }

  return huboCambios;
}

async function sincronizarSupabaseHaciaSheet(
  sheets,
  tabTitle,
  club,
  jugadores,
  { eliminarFilasNoVinculadas = false } = {}
) {
  if (!tieneCredencialesDeEscritura()) {
    return {
      omitida: true,
      motivo: 'Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY para escribir en Google Sheets.',
      actualizados: 0,
      insertados: 0,
      hashesAplicados: [],
    };
  }

  if (!sheets) {
    throw new Error('No hay cliente de Google Sheets disponible para escribir.');
  }

  const { spreadsheetId } = configDelClub(club);
  const titulo = escaparTituloHoja(tabTitle);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${titulo}'!A:BZ`,
  });
  const filas = res.data.values || [];
  const headers = [...(filas[0] || [])];
  if (headers.length === 0) throw new Error('La hoja no tiene cabeceras.');

  let cabecerasCambiadas = asegurarCabecerasWebapp(headers);
  let idxIdSync = headers.indexOf(ID_SYNC_HEADER);
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

  const filasPorId = new Map();
  const filasPorHash = new Map();
  for (let i = 1; i < filas.length; i += 1) {
    const fila = filas[i] || [];
    const idSync = fila[idxIdSync] ? String(fila[idxIdSync]).trim() : '';
    const numeroFila = i + 1;
    if (idSync) filasPorId.set(idSync, { numeroFila, fila });

    const resultado = mapearFila(headers, fila);
    if (resultado.valido && resultado.datos.sheet_row_hash && !filasPorHash.has(resultado.datos.sheet_row_hash)) {
      filasPorHash.set(resultado.datos.sheet_row_hash, { numeroFila, fila });
    }
  }

  const data = [];
  const appendValues = [];
  const hashesAplicados = [];
  let actualizados = 0;
  let eliminados = 0;

  for (const jugador of jugadores || []) {
    const sheetRowHash = hashFila(jugador);
    const filaExistente = filasPorId.get(jugador.id) || filasPorHash.get(sheetRowHash);
    const valores = filaDesdeJugador(headers, jugador, idxIdSync, filaExistente?.fila || []);
    const ultimaColumna = columnaAIndice(valores.length - 1);

    if (filaExistente) {
      data.push({
        range: `'${titulo}'!A${filaExistente.numeroFila}:${ultimaColumna}${filaExistente.numeroFila}`,
        values: [valores],
      });
      actualizados += 1;
    } else {
      appendValues.push(valores);
    }

    hashesAplicados.push({ id: jugador.id, sheet_row_hash: sheetRowHash });
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }

  if (appendValues.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${titulo}'!A:${columnaAIndice(headers.length - 1)}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: appendValues },
    });
  }

  if (eliminarFilasNoVinculadas) {
    const idsJugadores = new Set((jugadores || []).map((jugador) => String(jugador.id)));
    const hashesJugadores = new Set((jugadores || []).map((jugador) => hashFila(jugador)));
    const filasHuerfanas = [];

    for (let i = 1; i < filas.length; i += 1) {
      const fila = filas[i] || [];
      const idSync = fila[idxIdSync] ? String(fila[idxIdSync]).trim() : '';
      if (fila.every((valor) => !valor)) continue;

      const resultado = mapearFila(headers, fila);
      const filaVinculada = idSync
        ? idsJugadores.has(idSync)
        : resultado.valido && hashesJugadores.has(hashFila(resultado.datos));

      if (!filaVinculada) {
        filasHuerfanas.push({ startIndex: i, endIndex: i + 1 });
      }
    }

    if (filasHuerfanas.length > 0) {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title))',
      });
      const pestana = (meta.data.sheets || []).find((sheet) => sheet.properties?.title === tabTitle);
      const sheetId = pestana?.properties?.sheetId;

      if (sheetId === undefined || sheetId === null) {
        throw new Error(`No se encontro la pestana "${tabTitle}" para eliminar filas huerfanas.`);
      }

      // Se borran de abajo arriba para que los indices de las filas restantes
      // no cambien mientras se procesa la peticion por lotes.
      filasHuerfanas.sort((a, b) => b.startIndex - a.startIndex);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: filasHuerfanas.map((rango) => ({
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rango.startIndex,
                endIndex: rango.endIndex,
              },
            },
          })),
        },
      });
      eliminados = filasHuerfanas.length;
    }
  }

  return {
    omitida: false,
    actualizados,
    insertados: appendValues.length,
    eliminados,
    hashesAplicados,
  };
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
  tieneCredencialesDeEscritura,
  getSheetsClient,
  resolverPestana,
  leerFilasPendientes,
  marcarComoSincronizadas,
  calcularSheetRowHash,
  sincronizarSupabaseHaciaSheet,
};
