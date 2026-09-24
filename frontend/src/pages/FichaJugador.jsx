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
  const telefonoJugador = jugador ? String(obtenerValorCampoFicha(jugador, 'telefono_jugador') || '').trim() : '';

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
      const grisEtiqueta = [130, 130, 130];
      const grisClaro = [249, 249, 249];
      const bordeGris = [222, 222, 222];
      const blanco = [255, 255, 255];
      const anchoPagina = doc.internal.pageSize.getWidth();
      const altoPagina = doc.internal.pageSize.getHeight();
      const margen = 14;
      const anchoContenido = anchoPagina - margen * 2;
      const margenInferior = 16;

      const nombreJugador = nombreCompleto(jugador);

      // --- Cabecera con degradado negro -> rojo, como en la web ---
      const alturaHeader = 26;
      const pasosDegradado = 60;
      for (let i = 0; i < pasosDegradado; i += 1) {
        const t = i / (pasosDegradado - 1);
        const r = Math.round(negro[0] + (rojoClub[0] - negro[0]) * t);
        const g = Math.round(negro[1] + (rojoClub[1] - negro[1]) * t);
        const b = Math.round(negro[2] + (rojoClub[2] - negro[2]) * t);
        doc.setFillColor(r, g, b);
        const franjaAncho = anchoPagina / pasosDegradado;
        doc.rect(i * franjaAncho, 0, franjaAncho + 0.6, alturaHeader, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(235, 205, 210);
      doc.text('FICHA COMPLETA', margen, 9.5);

      doc.setFontSize(16);
      doc.setTextColor(...blanco);
      doc.text(nombreJugador || 'Jugador sin nombre', margen, 17.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(225, 225, 225);
      doc.text(jugador.equipo || 'Sin equipo asignado', margen, 23);

      let y = alturaHeader + 5;

      function piePagina() {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...gris);
        doc.text('Athletic Club', margen, altoPagina - 10);
      }

      function asegurarEspacio(alturaNecesaria) {
        if (y + alturaNecesaria > altoPagina - margenInferior) {
          piePagina();
          doc.addPage();
          y = 20;
        }
      }

      // --- Fila superior: foto, datos deportivos rapidos y posicion en el campo ---
      const anchoFoto = 40;
      const altoFoto = 48;
      const anchoPitch = 32;
      const altoPitch = 48;
      const gapColumnas = 5;
      const anchoInfo = anchoContenido - anchoFoto - anchoPitch - gapColumnas * 2;

      const xFoto = margen;
      const xInfo = xFoto + anchoFoto + gapColumnas;
      const xPitch = xInfo + anchoInfo + gapColumnas;

      asegurarEspacio(altoFoto + 4);
      const yFilaSuperior = y;

      doc.setDrawColor(...bordeGris);
      doc.setFillColor(...grisClaro);
      doc.roundedRect(xFoto, yFilaSuperior, anchoFoto, altoFoto, 3, 3, 'FD');
      if (fotoDataUrl) {
        try {
          doc.saveGraphicsState();
          doc.roundedRect(xFoto + 1, yFilaSuperior + 1, anchoFoto - 2, altoFoto - 2, 2, 2, null);
          doc.clip();
          doc.discardPath();
          const formatoImagen = fotoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(fotoDataUrl, formatoImagen, xFoto + 1, yFilaSuperior + 1, anchoFoto - 2, altoFoto - 2);
          doc.restoreGraphicsState();
        } catch (_) {
          // Si la imagen no se puede procesar, se omite sin bloquear el informe.
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...grisEtiqueta);
        doc.text('Sin foto disponible', xFoto + anchoFoto / 2, yFilaSuperior + altoFoto / 2, { align: 'center', maxWidth: anchoFoto - 8 });
      }

      function tarjetaInfo(x, yTop, ancho, alto, etiqueta, valor) {
        doc.setDrawColor(...bordeGris);
        doc.setFillColor(...grisClaro);
        doc.roundedRect(x, yTop, ancho, alto, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...grisEtiqueta);
        doc.text(etiqueta.toUpperCase(), x + ancho / 2, yTop + alto / 2 - 1.5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...negro);
        doc.text(String(valor), x + ancho / 2, yTop + alto / 2 + 3.5, { align: 'center', maxWidth: ancho - 4 });
      }

      let yInfo = yFilaSuperior;
      doc.setDrawColor(...bordeGris);
      doc.setFillColor(...grisClaro);
      doc.roundedRect(xInfo, yInfo, anchoInfo, 9, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...negro);
      doc.text(String(jugador.equipo || 'Sin equipo asignado'), xInfo + anchoInfo / 2, yInfo + 6, {
        align: 'center',
        maxWidth: anchoInfo - 6,
      });
      yInfo += 9 + 2;

      const anchoMedio = (anchoInfo - 2) / 2;
      tarjetaInfo(xInfo, yInfo, anchoMedio, 11, 'Dorsal', formatearValor(obtenerValorCampoFicha(jugador, 'dorsal'), 'dorsal'));
      tarjetaInfo(
        xInfo + anchoMedio + 2,
        yInfo,
        anchoMedio,
        11,
        'Lateralidad',
        formatearValor(obtenerValorCampoFicha(jugador, 'lateralidad'), 'lateralidad'),
      );
      yInfo += 11 + 2;

      tarjetaInfo(
        xInfo,
        yInfo,
        anchoInfo,
        11,
        'Fecha nac.',
        formatearValor(obtenerValorCampoFicha(jugador, 'fecha_nacimiento'), 'fecha_nacimiento'),
      );
      yInfo += 11 + 2;

      tarjetaInfo(xInfo, yInfo, anchoMedio, 11, 'Año nac.', calcularAnioNacimiento(jugador.fecha_nacimiento) ?? '-');
      tarjetaInfo(
        xInfo + anchoMedio + 2,
        yInfo,
        anchoMedio,
        11,
        'Edad',
        formatearValor(obtenerValorCampoFicha(jugador, 'edad'), 'edad'),
      );

      // --- Mini-campo de futbol con la posicion, igual que CampoFutbolPosicion.jsx ---
      const POSICIONES_CAMPO_DEMARCACION = {
        Portero: { x: 50, y: 140 },
        'Lateral Dcho': { x: 80, y: 100 },
        'Lateral Izdo': { x: 20, y: 100 },
        'Central Dcho': { x: 60, y: 115 },
        'Central Izdo': { x: 40, y: 115 },
        Pivote: { x: 50, y: 85 },
        'Media punta': { x: 50, y: 40 },
        'Interior Dcho': { x: 70, y: 60 },
        'Interior Izdo': { x: 30, y: 60 },
        'Extremo Dcho': { x: 85, y: 24 },
        'Extremo Izdo': { x: 15, y: 24 },
        Delantero: { x: 50, y: 12 },
      };
      const demarcacion = obtenerValorCampoFicha(jugador, 'demarcacion');
      const posicionCampo = POSICIONES_CAMPO_DEMARCACION[demarcacion];
      const escala = anchoPitch / 100;
      const xEsc = (valor) => xPitch + valor * escala;
      const yEsc = (valor) => yFilaSuperior + valor * escala;

      doc.setDrawColor(...bordeGris);
      doc.setFillColor(...grisClaro);
      doc.roundedRect(xPitch, yFilaSuperior, anchoPitch, altoPitch - 8, 2, 2, 'FD');

      doc.setFillColor(63, 138, 75);
      doc.rect(xEsc(0), yEsc(0), anchoPitch, (altoPitch - 8) * (146 / 150), 'F');
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.rect(xEsc(2), yEsc(2), xEsc(98) - xEsc(2), yEsc(146) - yEsc(2));
      doc.line(xEsc(2), yEsc(75), xEsc(98), yEsc(75));
      doc.circle(xEsc(50), yEsc(75), xEsc(59) - xEsc(50));
      doc.rect(xEsc(26), yEsc(2), xEsc(74) - xEsc(26), yEsc(20) - yEsc(2));
      doc.rect(xEsc(26), yEsc(130), xEsc(74) - xEsc(26), yEsc(148) - yEsc(130));
      if (posicionCampo) {
        doc.setFillColor(...rojoClub);
        doc.setDrawColor(255, 255, 255);
        doc.circle(xEsc(posicionCampo.x), yEsc(posicionCampo.y), 1.6, 'FD');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...grisEtiqueta);
      doc.text((demarcacion || 'Sin posición').toUpperCase(), xPitch + anchoPitch / 2, yFilaSuperior + altoPitch - 3, {
        align: 'center',
      });

      y = yFilaSuperior + Math.max(altoFoto, yInfo + 11 - yFilaSuperior, altoPitch) + 5;

      // --- Secciones de datos, en tarjetas como en la web ---
      const SECCIONES_EXCLUIDAS_INFORME = ['Domicilio', 'Datos del padre', 'Datos de la madre', 'Nacimiento'];
      const CAMPOS_EXCLUIDOS_INFORME = ['nombre', 'primer_apellido', 'segundo_apellido', 'fecha_nacimiento'];
      const columnasSeccion = 3;
      const paddingSeccion = 4;
      const anchoInternoSeccion = anchoContenido - paddingSeccion * 2;
      const gapCard = 3;
      const anchoCard = (anchoInternoSeccion - gapCard * (columnasSeccion - 1)) / columnasSeccion;
      const altoCard = 13;
      const gapFila = 2;

      function dibujarSeccion(titulo, filas) {
        const numFilas = Math.ceil(filas.length / columnasSeccion);
        const alturaSeccion = paddingSeccion + 5 + 3 + numFilas * altoCard + (numFilas - 1) * gapFila + paddingSeccion;

        asegurarEspacio(alturaSeccion);
        const yInicio = y;

        doc.setDrawColor(...bordeGris);
        doc.setFillColor(...grisClaro);
        doc.roundedRect(margen, yInicio, anchoContenido, alturaSeccion, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...negro);
        doc.text(titulo.toUpperCase(), margen + paddingSeccion, yInicio + paddingSeccion + 3.5);

        const yCards = yInicio + paddingSeccion + 5 + 3;
        filas.forEach(([etiqueta, valor], indice) => {
          const col = indice % columnasSeccion;
          const fila = Math.floor(indice / columnasSeccion);
          const cardX = margen + paddingSeccion + col * (anchoCard + gapCard);
          const cardY = yCards + fila * (altoCard + gapFila);

          doc.setDrawColor(...bordeGris);
          doc.setFillColor(...blanco);
          doc.roundedRect(cardX, cardY, anchoCard, altoCard, 2, 2, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(...grisEtiqueta);
          doc.text(etiqueta.toUpperCase(), cardX + 2.5, cardY + 5, { maxWidth: anchoCard - 5 });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...negro);
          doc.text(String(valor), cardX + 2.5, cardY + 10.5, { maxWidth: anchoCard - 5 });
        });

        y = yInicio + alturaSeccion + 4;
      }

      SECCIONES_FICHA.filter((seccion) => !SECCIONES_EXCLUIDAS_INFORME.includes(seccion.titulo)).forEach((seccion) => {
        const filasSeccion = seccion.campos
          .filter((campo) => !CAMPOS_EXCLUIDOS_INFORME.includes(campo) && tieneDatoCampo(jugador, campo))
          .map((campo) => [
            ETIQUETAS_JUGADOR[campo] || campo,
            formatearValor(obtenerValorCampoFicha(jugador, campo), campo),
          ]);

        if (filasSeccion.length === 0) return;
        dibujarSeccion(seccion.titulo, filasSeccion);
      });

      if (jugador.observaciones) {
        const lineasObservaciones = doc.splitTextToSize(
          String(jugador.observaciones),
          anchoContenido - paddingSeccion * 2 - 6,
        );
        const alturaTexto = lineasObservaciones.length * 4.5;
        const alturaSeccion = paddingSeccion + 5 + 3 + alturaTexto + paddingSeccion;

        asegurarEspacio(alturaSeccion);
        const yInicio = y;

        doc.setDrawColor(...bordeGris);
        doc.setFillColor(...grisClaro);
        doc.roundedRect(margen, yInicio, anchoContenido, alturaSeccion, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...negro);
        doc.text('OBSERVACIONES', margen + paddingSeccion, yInicio + paddingSeccion + 3.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...negro);
        let yTexto = yInicio + paddingSeccion + 5 + 3 + 3.5;
        lineasObservaciones.forEach((linea) => {
          doc.text(linea, margen + paddingSeccion, yTexto);
          yTexto += 4.5;
        });

        y = yInicio + alturaSeccion + 4;
      }

      piePagina();

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
                {jugador.id_legible && (
                  <p className="mt-1 text-xs text-white/60">ID: {jugador.id_legible}</p>
                )}
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
                    {telefonoJugador && (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <a
                          href={`https://wa.me/${telefonoJugador.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 sm:w-auto"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.94L2 22l5.2-1.36A9.94 9.94 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm0 18.06c-1.6 0-3.12-.43-4.44-1.19l-.32-.19-3.09.81.83-3.01-.21-.31A8.05 8.05 0 014 12c0-4.43 3.6-8.03 8.04-8.03S20.08 7.57 20.08 12s-3.6 8.06-8.04 8.06zm4.4-6.03c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4-.14-.01-.3-.01-.46-.01s-.42.06-.64.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28z" />
                          </svg>
                          WhatsApp
                        </a>
                        <a
                          href={`tel:${telefonoJugador.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-club-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black sm:w-auto"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.02l-2.2 2.2z" />
                          </svg>
                          Llamar
                        </a>
                      </div>
                    )}
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
                                    <div className="space-y-2.5">
                                      <a href={`tel:${String(valor).replace(/\s+/g, '')}`} className="font-semibold text-club-red hover:underline">
                                        {valor}
                                      </a>
                                      <div className="flex flex-col gap-2 sm:flex-row">
                                        <a
                                          href={`https://wa.me/${String(valor).replace(/[^0-9]/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 sm:w-auto"
                                        >
                                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                            <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.94L2 22l5.2-1.36A9.94 9.94 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm0 18.06c-1.6 0-3.12-.43-4.44-1.19l-.32-.19-3.09.81.83-3.01-.21-.31A8.05 8.05 0 014 12c0-4.43 3.6-8.03 8.04-8.03S20.08 7.57 20.08 12s-3.6 8.06-8.04 8.06zm4.4-6.03c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4-.14-.01-.3-.01-.46-.01s-.42.06-.64.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28z" />
                                          </svg>
                                          WhatsApp
                                        </a>
                                        <a
                                          href={`tel:${String(valor).replace(/\s+/g, '')}`}
                                          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-club-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black sm:w-auto"
                                        >
                                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.02l-2.2 2.2z" />
                                          </svg>
                                          Llamar
                                        </a>
                                      </div>
                                    </div>
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
