import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ETIQUETAS_JUGADOR, SECCIONES_FICHA } from '../lib/campos';
import { useListaValores } from '../lib/listas';

const ROLES_QUE_PUEDEN_SUBIR_FOTO = ['administrador', 'director', 'responsable', 'tecnico'];
const ROLES_QUE_PUEDEN_EDITAR_DEPORTIVO = ['administrador', 'responsable', 'director'];

// Campos calculados que nunca se editan directamente (se derivan de otros).
const CAMPOS_NO_EDITABLES = new Set(['edad', 'anio_nacimiento']);
// Tipo de input a usar por campo (el resto se edita como texto libre).
const TIPO_CAMPO = {
  fecha_nacimiento: 'fecha',
  altura_cm: 'numero',
  peso_kg: 'numero',
  dorsal: 'numero',
  tiene_hermanos_club: 'booleano',
  lateralidad: 'seleccion',
  demarcacion: 'seleccion',
  observaciones: 'area',
};

function formatearValor(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (typeof valor === 'boolean') return valor ? 'Si' : 'No';
  if (campo === 'fecha_nacimiento') {
    const [anio, mes, dia] = String(valor).split('-');
    if (anio && mes && dia) return `${dia}/${mes}/${anio}`;
  }
  return String(valor);
}

function calcularAnioNacimiento(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  return nacimiento.getFullYear();
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplida =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumplida) edad -= 1;
  return edad;
}

function tieneDatoCampo(jugador, campo) {
  if (!jugador) return false;
  if (campo === 'anio_nacimiento' || campo === 'edad') {
    return Boolean(jugador.fecha_nacimiento);
  }
  return Object.prototype.hasOwnProperty.call(jugador, campo);
}

function obtenerValorCampoFicha(jugador, campo) {
  if (!jugador) return null;
  if (campo === 'fecha_nacimiento') return jugador.fecha_nacimiento;
  if (campo === 'anio_nacimiento') return calcularAnioNacimiento(jugador.fecha_nacimiento);
  if (campo === 'edad') return jugador.edad ?? calcularEdad(jugador.fecha_nacimiento);
  return jugador[campo];
}

function nombreCompleto(jugador) {
  return [jugador.nombre, jugador.primer_apellido, jugador.segundo_apellido].filter(Boolean).join(' ');
}

// Posicion aproximada en el campo para cada demarcacion general (sin lado
// izquierda/derecha, ya que la lista de demarcaciones de jugadores no lo distingue).
const POSICIONES_CAMPO_DEMARCACION = {
  Portero: { x: 50, y: 140 },
  Lateral: { x: 80, y: 100 },
  Central: { x: 50, y: 115 },
  Medio: { x: 50, y: 72 },
  'Media punta': { x: 50, y: 40 },
  Extremo: { x: 80, y: 24 },
  Delantero: { x: 50, y: 12 },
};

function CampoFutbolDemarcacion({ demarcacion }) {
  const posicion = POSICIONES_CAMPO_DEMARCACION[demarcacion];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-2">
      <svg viewBox="0 0 100 150" className="w-full" role="img" aria-label={`Posicion en el campo: ${demarcacion || 'sin asignar'}`}>
        <rect x="0" y="0" width="100" height="150" fill="#3f8a4b" />
        <rect x="2" y="2" width="96" height="146" fill="none" stroke="white" strokeWidth="0.6" />
        <line x1="2" y1="75" x2="98" y2="75" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="75" r="9" fill="none" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="75" r="0.8" fill="white" />
        <rect x="26" y="2" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="38" y="2" width="24" height="8" fill="none" stroke="white" strokeWidth="0.6" />
        <path d="M 38 20 A 9 9 0 0 0 62 20" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="26" y="130" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="38" y="140" width="24" height="8" fill="none" stroke="white" strokeWidth="0.6" />
        <path d="M 38 130 A 9 9 0 0 1 62 130" fill="none" stroke="white" strokeWidth="0.6" />
        {posicion ? <circle cx={posicion.x} cy={posicion.y} r="4.5" fill="#e2001a" stroke="white" strokeWidth="0.8" /> : null}
      </svg>
      <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-club-black/60">
        {demarcacion || 'Sin demarcacion'}
      </p>
    </div>
  );
}

export default function FichaJugador() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const lateralidades = useListaValores('lateralidad');
  const demarcaciones = useListaValores('demarcacion');
  const [jugador, setJugador] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const [datosDeportivos, setDatosDeportivos] = useState({});
  const [guardandoDeportivo, setGuardandoDeportivo] = useState(false);
  const [errorDeportivo, setErrorDeportivo] = useState('');
  const [guardadoOkDeportivo, setGuardadoOkDeportivo] = useState(false);
  const [syncHojaDeportivo, setSyncHojaDeportivo] = useState(null);
  const [generandoInforme, setGenerandoInforme] = useState(false);

  const puedeSubirFoto = user && ROLES_QUE_PUEDEN_SUBIR_FOTO.includes(user.rol);
  const puedeEditarDeportivo = user && ROLES_QUE_PUEDEN_EDITAR_DEPORTIVO.includes(user.rol);
  const OPCIONES_POR_CAMPO = {
    lateralidad: lateralidades,
    demarcacion: demarcaciones,
  };

  async function cargarImagenComoDataUrl(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return null;
    }
  }

  async function handleGenerarInforme() {
    if (!jugador || generandoInforme) return;

    setGenerandoInforme(true);
    try {
      const fotoDataUrl = jugador.foto_url ? await cargarImagenComoDataUrl(jugador.foto_url) : null;

      const doc = new jsPDF();
      const rojoClub = [200, 16, 46];
      const negro = [17, 17, 17];
      const gris = [110, 110, 110];
      const anchoPagina = doc.internal.pageSize.getWidth();

      doc.setFillColor(...negro);
      doc.rect(0, 0, anchoPagina, 32, 'F');
      doc.setFillColor(...rojoClub);
      doc.rect(0, 32, anchoPagina, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Informe del jugador', 14, 20);

      const nombreJugador = nombreCompleto(jugador);

      const fotoTamano = 28;
      const fotoX = 14;
      const fotoY = 42;
      const textoX = fotoDataUrl ? fotoX + fotoTamano + 8 : 14;

      if (fotoDataUrl) {
        try {
          doc.saveGraphicsState();
          doc.roundedRect(fotoX, fotoY, fotoTamano, fotoTamano, fotoTamano / 2, fotoTamano / 2, null);
          doc.clip();
          doc.discardPath();
          const formatoImagen = fotoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(fotoDataUrl, formatoImagen, fotoX, fotoY, fotoTamano, fotoTamano);
          doc.restoreGraphicsState();
        } catch (_) {
          // Si la imagen no se puede procesar, se omite sin bloquear el informe.
        }
      }

      let y = fotoDataUrl ? fotoY + 10 : 50;
      doc.setTextColor(...negro);
      doc.setFontSize(22);
      doc.text(nombreJugador, textoX, y);

      if (jugador.equipo) {
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(...gris);
        doc.text(`Equipo: ${jugador.equipo}`, textoX, y);
      }

      if (jugador.edicion) {
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(...gris);
        doc.text(`Edicion: ${jugador.edicion}`, textoX, y);
      }

      y = Math.max(y, fotoDataUrl ? fotoY + fotoTamano : y);

      y += 14;
      doc.setDrawColor(...rojoClub);
      doc.setLineWidth(0.5);
      doc.line(14, y, anchoPagina - 14, y);

      const filas = [
        ['Demarcación', formatearValor(jugador.demarcacion)],
        ['Lateralidad', formatearValor(jugador.lateralidad)],
        ['Dorsal', formatearValor(jugador.dorsal)],
        ['Edicion', formatearValor(jugador.edicion)],
        ['Telefono', formatearValor(jugador.telefono_jugador)],
        ['Email', formatearValor(jugador.email_jugador)],
        ['Fecha de nacimiento', formatearValor(jugador.fecha_nacimiento, 'fecha_nacimiento')],
        ['Año de nacimiento', calcularAnioNacimiento(jugador.fecha_nacimiento) ?? '-'],
        ['Edad', jugador.edad !== undefined && jugador.edad !== null ? `${jugador.edad} años` : '-'],
      ];

      y += 14;
      filas.forEach(([etiqueta, valor]) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...gris);
        doc.text(etiqueta, 14, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(13);
        doc.setTextColor(...negro);
        doc.text(String(valor), 90, y);

        y += 12;
      });

      doc.setFontSize(9);
      doc.setTextColor(...gris);
      doc.text('Athletic Club', 14, doc.internal.pageSize.getHeight() - 10);

      const nombreArchivo = `informe_${nombreJugador.replace(/\s+/g, '_').toLowerCase()}.pdf`;
      doc.setProperties({ title: nombreArchivo });

      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } finally {
      setGenerandoInforme(false);
    }
  }

  async function handleGuardarDatosDeportivos() {
    setGuardandoDeportivo(true);
    setErrorDeportivo('');
    setGuardadoOkDeportivo(false);
    setSyncHojaDeportivo(null);
    try {
      const payload = {};
      Object.entries(datosDeportivos).forEach(([campo, valor]) => {
        if (TIPO_CAMPO[campo] === 'numero') {
          payload[campo] = valor !== '' && valor !== null && valor !== undefined ? Number(valor) : null;
        } else if (TIPO_CAMPO[campo] === 'booleano') {
          payload[campo] = valor === '' || valor === null || valor === undefined ? null : Boolean(valor);
        } else {
          payload[campo] = valor === '' || valor === null || valor === undefined ? null : valor;
        }
      });

      const { jugador: actualizado, sheet_sync } = await api.patch(`/jugadores/${id}/datos`, payload);
      setJugador((prev) => (prev ? { ...prev, ...actualizado } : actualizado));
      setSyncHojaDeportivo(sheet_sync || null);
      setGuardadoOkDeportivo(true);
      setTimeout(() => {
        setGuardadoOkDeportivo(false);
        setSyncHojaDeportivo(null);
      }, 5000);
    } catch (err) {
      setErrorDeportivo(err.message);
    } finally {
      setGuardandoDeportivo(false);
    }
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSubiendoFoto(true);
    setErrorFoto('');
    try {
      const formData = new FormData();
      formData.append('foto', file);
      const { foto_url } = await api.postFile(`/jugadores/${id}/foto`, formData);
      setJugador((prev) => (prev ? { ...prev, foto_url } : prev));
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setSubiendoFoto(false);
    }
  }

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError('');
    api
      .get(`/jugadores/${id}`)
      .then(({ jugador }) => {
        if (activo) {
          const edad = calcularEdad(jugador.fecha_nacimiento);
          setJugador(edad !== null ? { ...jugador, edad } : jugador);

          const camposEditables = SECCIONES_FICHA.flatMap((seccion) => seccion.campos).filter(
            (campo) => !CAMPOS_NO_EDITABLES.has(campo)
          );
          const valoresIniciales = {};
          camposEditables.forEach((campo) => {
            const valor = jugador[campo];
            if (TIPO_CAMPO[campo] === 'booleano') {
              valoresIniciales[campo] = Boolean(valor);
            } else {
              valoresIniciales[campo] = valor ?? '';
            }
          });
          setDatosDeportivos(valoresIniciales);
        }
      })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!jugador || location.hash !== '#datos-deportivos') return;

    const elemento = document.getElementById('datos-deportivos');
    if (elemento) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [jugador, location.hash]);

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50"
          >
            Volver al listado
          </Link>
          <Link
            to="/campogramas"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50"
          >
            Volver a campograma
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50">Plantillas</p>
            <h2 className="text-2xl font-bold text-club-black">Ficha de jugador</h2>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-club-black/60">
          Cargando ficha...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-club-red/20 bg-red-50 px-4 py-6 text-club-red">
          <p className="font-semibold">No se pudo cargar la ficha.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : jugador ? (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ficha completa</p>
              <h3 className="mt-1 text-2xl font-bold">{nombreCompleto(jugador) || 'Jugador sin nombre'}</h3>
              <p className="text-sm text-white/80">{jugador.equipo || 'Sin equipo asignado'}</p>
            </div>

            <div className="grid gap-8 p-6 lg:grid-cols-[280px_1fr]">
              <aside className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  {jugador.foto_url ? (
                    <img src={jugador.foto_url} alt={`Foto de ${nombreCompleto(jugador)}`} className="h-80 w-full object-cover" />
                  ) : (
                    <div className="flex h-80 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center text-sm font-semibold text-club-black/40">
                      Sin foto disponible
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Dorsal</p>
                    <p className="mt-2 text-2xl font-bold text-club-black">{formatearValor(obtenerValorCampoFicha(jugador, 'dorsal'), 'dorsal')}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Edad</p>
                    <p className="mt-2 text-2xl font-bold text-club-black">{formatearValor(obtenerValorCampoFicha(jugador, 'edad'), 'edad')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {puedeSubirFoto && (
                    <label className="inline-flex w-full items-center justify-center rounded-md border border-club-red/20 bg-club-red/5 px-4 py-2.5 text-sm font-semibold text-club-red cursor-pointer hover:bg-club-red/10 transition-colors">
                      {subiendoFoto ? 'Subiendo foto...' : 'Cambiar foto'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleFotoChange}
                        disabled={subiendoFoto}
                      />
                    </label>
                  )}
                  <button
                    onClick={handleGenerarInforme}
                    disabled={generandoInforme}
                    className="w-full rounded-md bg-club-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-club-black/80 disabled:opacity-60 transition-colors"
                  >
                    {generandoInforme ? 'Generando informe...' : 'Informe jugador'}
                  </button>
                  {errorFoto ? <p className="text-xs text-club-red mt-2">{errorFoto}</p> : null}
                </div>
              </aside>

              <main className="space-y-6">
                {puedeEditarDeportivo ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <button
                      onClick={handleGuardarDatosDeportivos}
                      disabled={guardandoDeportivo}
                      className="rounded-md bg-club-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-club-red/90 disabled:opacity-60 transition-colors sm:ml-auto"
                    >
                      {guardandoDeportivo ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                ) : null}

                {guardadoOkDeportivo || errorDeportivo ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="space-y-2 text-sm">
                      {guardadoOkDeportivo ? (
                        <p className="font-medium text-green-600">
                          {syncHojaDeportivo?.ok ? '✓ Guardado y hoja actualizada' : '✓ Guardado'}
                        </p>
                      ) : null}
                      {guardadoOkDeportivo && syncHojaDeportivo && !syncHojaDeportivo.ok ? (
                        <p className="text-amber-700">
                          Guardado en la app. Hoja no actualizada: {syncHojaDeportivo.motivo}
                        </p>
                      ) : null}
                      {errorDeportivo ? <p className="text-club-red font-medium">{errorDeportivo}</p> : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {['equipo', 'edicion', 'lateralidad', 'demarcacion', 'colegio_instituto', 'club_procedencia'].map((campo) => {
                    const valor = formatearValor(obtenerValorCampoFicha(jugador, campo), campo);
                    if (!valor || valor === '-') return null;
                    return (
                      <span
                        key={campo}
                        className="inline-flex items-center rounded-full border border-club-red/20 bg-club-red/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-club-red"
                      >
                        {valor}
                      </span>
                    );
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {SECCIONES_FICHA.filter((seccion) => !['Contacto', 'Otros datos'].includes(seccion.titulo)).map((seccion) => {
                    const camposDisponibles = seccion.campos.filter((campo) => tieneDatoCampo(jugador, campo));
                    if (camposDisponibles.length === 0) return null;
                    const esDeportivo = seccion.titulo === 'Datos deportivos';
                    const esSeccionAncha = seccion.titulo === 'Datos del jugador';

                    return (
                      <section
                        key={seccion.titulo}
                        id={esDeportivo ? 'datos-deportivos' : undefined}
                        className={`rounded-2xl border border-gray-200 bg-gray-50 p-4 ${esSeccionAncha ? 'lg:col-span-2' : ''}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{seccion.titulo}</h4>
                          {puedeEditarDeportivo ? (
                            <span className="text-xs font-semibold uppercase tracking-wide text-club-red">Editable</span>
                          ) : null}
                        </div>

                        {esDeportivo ? (
                          <div className="mt-4 max-w-[220px]">
                            <CampoFutbolDemarcacion
                              demarcacion={
                                puedeEditarDeportivo
                                  ? datosDeportivos.demarcacion
                                  : obtenerValorCampoFicha(jugador, 'demarcacion')
                              }
                            />
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {camposDisponibles.map((campo) => {
                            const valorCampo = obtenerValorCampoFicha(jugador, campo);
                            const valor = formatearValor(valorCampo, campo);
                            const esLargo = campo === 'observaciones';
                            const editable = puedeEditarDeportivo && !CAMPOS_NO_EDITABLES.has(campo);
                            const tipo = TIPO_CAMPO[campo] || 'texto';

                            return (
                              <div
                                key={campo}
                                className={`rounded-xl border border-gray-200 bg-white p-4 ${
                                  esLargo ? 'sm:col-span-2 xl:col-span-3' : ''
                                }`}
                              >
                                <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">
                                  {ETIQUETAS_JUGADOR[campo] || campo}
                                </p>
                                <div className={`mt-2 text-sm text-club-black/80 ${esLargo ? 'whitespace-pre-line leading-6' : 'break-words'}`}>
                                  {!editable ? (
                                    campo === 'telefono_jugador' && valor !== '-' ? (
                                      <a href={`tel:${String(valor).replace(/\s+/g, '')}`} className="font-semibold text-club-red hover:underline">
                                        {valor}
                                      </a>
                                    ) : campo === 'email_jugador' && valor !== '-' ? (
                                      <a href={`mailto:${valor}`} className="font-semibold text-club-red hover:underline">
                                        {valor}
                                      </a>
                                    ) : (
                                      valor
                                    )
                                  ) : tipo === 'seleccion' ? (
                                    <select
                                      value={datosDeportivos[campo] || ''}
                                      onChange={(e) => setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value }))}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                                    >
                                      <option value="">-</option>
                                      {(OPCIONES_POR_CAMPO[campo] || []).map((opcion) => (
                                        <option key={opcion} value={opcion}>
                                          {opcion}
                                        </option>
                                      ))}
                                    </select>
                                  ) : tipo === 'booleano' ? (
                                    <select
                                      value={datosDeportivos[campo] ? 'si' : 'no'}
                                      onChange={(e) =>
                                        setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value === 'si' }))
                                      }
                                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                                    >
                                      <option value="no">No</option>
                                      <option value="si">Si</option>
                                    </select>
                                  ) : tipo === 'fecha' ? (
                                    <input
                                      type="date"
                                      value={datosDeportivos[campo] || ''}
                                      onChange={(e) => setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value }))}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                                    />
                                  ) : tipo === 'numero' ? (
                                    <input
                                      type="number"
                                      min={campo === 'dorsal' ? 1 : 0}
                                      max={campo === 'dorsal' ? 99 : undefined}
                                      value={datosDeportivos[campo]}
                                      onChange={(e) => setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value }))}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                                    />
                                  ) : tipo === 'area' ? (
                                    <textarea
                                      value={datosDeportivos[campo]}
                                      onChange={(e) => setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value }))}
                                      rows={3}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={datosDeportivos[campo]}
                                      onChange={(e) => setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value }))}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </main>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-club-black/60">
          El registro solicitado no existe.
        </div>
      )}
    </div>
  );
}
