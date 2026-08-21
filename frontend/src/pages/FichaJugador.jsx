import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ETIQUETAS_JUGADOR, SECCIONES_FICHA } from '../lib/campos';
import { CLUBES_MAESTROS } from '../data/clubes';
import CampoFutbolPosicion from '../components/CampoFutbolPosicion';

const ROLES_QUE_PUEDEN_SUBIR_FOTO = ['administrador', 'director', 'responsable', 'tecnico'];
const ROLES_QUE_PUEDEN_EDITAR = ['administrador', 'director', 'responsable', 'tecnico'];

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

function obtenerEscudoEquipo(equipo) {
  if (!equipo) return null;
  const equipoLower = equipo.toLowerCase().trim();

  let nombreBusqueda = equipo;
  if (equipoLower.includes('romo') || equipoLower.includes('itzu')) {
    nombreBusqueda = 'ROMO F.C.';
  } else if (equipoLower.includes('arenas')) {
    nombreBusqueda = 'ARENAS C.';
  }

  const club = CLUBES_MAESTROS.find((c) => c.nombre === nombreBusqueda);
  return club?.escudo || null;
}

export default function FichaJugador() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [jugador, setJugador] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const [generandoInforme, setGenerandoInforme] = useState(false);

  const puedeSubirFoto = user && ROLES_QUE_PUEDEN_SUBIR_FOTO.includes(user.rol);
  const puedeEditar = user && ROLES_QUE_PUEDEN_EDITAR.includes(user.rol);

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

      y = Math.max(y, fotoDataUrl ? fotoY + fotoTamano : y);

      y += 14;
      doc.setDrawColor(...rojoClub);
      doc.setLineWidth(0.5);
      doc.line(14, y, anchoPagina - 14, y);

      const filas = [
        ['Posición', formatearValor(jugador.demarcacion)],
        ['Lateralidad', formatearValor(jugador.lateralidad)],
        ['Dorsal', formatearValor(jugador.dorsal)],
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
            to="/plantillas"
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
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-4 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ficha completa</p>
                <h3 className="mt-1 text-2xl font-bold">{nombreCompleto(jugador) || 'Jugador sin nombre'}</h3>
                <p className="text-sm text-white/80">{jugador.equipo || 'Sin equipo asignado'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerarInforme}
                  disabled={generandoInforme}
                  title="Exportar PDF"
                  aria-label="Exportar PDF"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5" />
                    <path d="M13 12v5" />
                    <path d="M16.5 12H15v5h1.5" />
                  </svg>
                </button>
                {puedeEditar && (
                  <Link
                    to={`/plantillas/${id}`}
                    title="Editar jugador"
                    aria-label="Editar jugador"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
                <div className="w-full max-w-xs shrink-0 space-y-2.5 md:w-56">
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    {jugador.foto_url ? (
                      <img src={jugador.foto_url} alt={`Foto de ${nombreCompleto(jugador)}`} className="h-72 w-full object-cover" />
                    ) : (
                      <div className="flex h-72 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center text-sm font-semibold text-club-black/40">
                        Sin foto disponible
                      </div>
                    )}
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
                    {errorFoto ? <p className="text-xs text-club-red mt-2">{errorFoto}</p> : null}
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3 md:w-72 md:shrink-0">
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                    {obtenerEscudoEquipo(jugador.equipo) ? (
                      <img
                        src={obtenerEscudoEquipo(jugador.equipo)}
                        alt={`Escudo ${jugador.equipo}`}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-club-black">{jugador.equipo || 'Sin equipo asignado'}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Dorsal</p>
                        <p className="mt-0.5 text-base font-bold text-club-black">{formatearValor(obtenerValorCampoFicha(jugador, 'dorsal'), 'dorsal')}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Lateralidad</p>
                        <p className="mt-0.5 text-base font-bold text-club-black">{formatearValor(obtenerValorCampoFicha(jugador, 'lateralidad'), 'lateralidad')}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Fecha nac.</p>
                      <p className="mt-0.5 text-base font-bold text-club-black">{formatearValor(obtenerValorCampoFicha(jugador, 'fecha_nacimiento'), 'fecha_nacimiento')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Año nac.</p>
                        <p className="mt-0.5 text-base font-bold text-club-black">{calcularAnioNacimiento(jugador.fecha_nacimiento) ?? '-'}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-club-black/50">Edad</p>
                        <p className="mt-0.5 text-base font-bold text-club-black">{formatearValor(obtenerValorCampoFicha(jugador, 'edad'), 'edad')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-xs shrink-0 md:w-56">
                  <CampoFutbolPosicion demarcacion={obtenerValorCampoFicha(jugador, 'demarcacion')} />
                </div>
              </div>

              <main className="space-y-6">
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
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {camposDisponibles.map((campo) => {
                            const valorCampo = obtenerValorCampoFicha(jugador, campo);
                            const valor = formatearValor(valorCampo, campo);
                            const esLargo = campo === 'observaciones';

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
                                  {campo === 'telefono_jugador' && valor !== '-' ? (
                                    <a href={`tel:${String(valor).replace(/\s+/g, '')}`} className="font-semibold text-club-red hover:underline">
                                      {valor}
                                    </a>
                                  ) : campo === 'email_jugador' && valor !== '-' ? (
                                    <a href={`mailto:${valor}`} className="font-semibold text-club-red hover:underline">
                                      {valor}
                                    </a>
                                  ) : (
                                    valor
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
