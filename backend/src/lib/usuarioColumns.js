function esColumnaInexistente(error, columna) {
  const texto = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
  const columnaNormalizada = String(columna || '').toLowerCase();

  return (
    error?.code === '42703' ||
    texto.includes(`column usuarios.${columnaNormalizada} does not exist`) ||
    texto.includes(`column "${columnaNormalizada}" of relation "usuarios" does not exist`) ||
    texto.includes(`column "${columnaNormalizada}" does not exist`) ||
    texto.includes(`column '${columnaNormalizada}' of relation 'usuarios' does not exist`) ||
    texto.includes(`column '${columnaNormalizada}' does not exist`) ||
    texto.includes(`could not find column ${columnaNormalizada}`) ||
    texto.includes(`column ${columnaNormalizada} does not exist`)
  );
}

function construirSelect(baseFields, optionalFields, omitidas) {
  return [...baseFields, ...optionalFields.filter((campo) => !omitidas.has(campo))].join(', ');
}

function omitirCampos(basePayload, optionalFields, omitidas) {
  const payload = { ...basePayload };
  optionalFields.forEach((campo) => {
    if (omitidas.has(campo)) {
      delete payload[campo];
    }
  });
  return payload;
}

async function ejecutarConFallback(optionalFields, ejecutar) {
  const omitidas = new Set();

  while (true) {
    const respuesta = await ejecutar(omitidas);
    if (!respuesta?.error) {
      return respuesta;
    }

    const faltante = optionalFields.find((campo) => !omitidas.has(campo) && esColumnaInexistente(respuesta.error, campo));
    if (!faltante) {
      return respuesta;
    }

    omitidas.add(faltante);
  }
}

module.exports = {
  construirSelect,
  omitirCampos,
  ejecutarConFallback,
  esColumnaInexistente,
};
