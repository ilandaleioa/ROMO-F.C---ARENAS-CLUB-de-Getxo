import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ETIQUETAS_JUGADOR,
  SECCIONES_FICHA,
  LATERALIDAD_OPCIONES,
  DEMARCACION_OPCIONES,
} from '../lib/campos';

const ROLES_QUE_PUEDEN_SUBIR_FOTO = ['administrador', 'director', 'responsable', 'tecnico'];
const ROLES_QUE_PUEDEN_EDITAR_DEPORTIVO = ['administrador', 'responsable', 'director'];
const OPCIONES_POR_CAMPO = {
  lateralidad: LATERALIDAD_OPCIONES,
  demarcacion: DEMARCACION_OPCIONES,
};

function formatearValor(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (typeof valor === 'boolean') return valor ? 'Si' : 'No';
  if (campo === 'fecha_nacimiento') {
    const [anio, mes, dia] = String(valor).split('-');
    if (anio && mes && dia) return `${dia}-${mes}-${anio}`;
  }
  return String(valor);
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

export default function FichaJugador() {
  const { id } = useParams();
  const { user } = useAuth();
  const [jugador, setJugador] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const [datosDeportivos, setDatosDeportivos] = useState({ dorsal: '', lateralidad: '', demarcacion: '' });
  const [guardandoDeportivo, setGuardandoDeportivo] = useState(false);
  const [errorDeportivo, setErrorDeportivo] = useState('');
  const [guardadoOkDeportivo, setGuardadoOkDeportivo] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);

  const puedeSubirFoto = user && ROLES_QUE_PUEDEN_SUBIR_FOTO.includes(user.rol);
  const puedeEditarDeportivo = user && ROLES_QUE_PUEDEN_EDITAR_DEPORTIVO.includes(user.rol);

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

      const nombreCompleto = [jugador.nombre, jugador.primer_apellido, jugador.segundo_apellido]
        .filter(Boolean)
        .join(' ');

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
      doc.text(nombreCompleto, textoX, y);

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
        ['Fecha de nacimiento', formatearValor(jugador.fecha_nacimiento, 'fecha_nacimiento')],
        ['Edad', jugador.edad !== undefined && jugador.edad !== null ? `${jugador.edad} años` : '-'],
        ['Demarcación', formatearValor(jugador.demarcacion)],
        ['Lateralidad', formatearValor(jugador.lateralidad)],
        ['Dorsal', formatearValor(jugador.dorsal)],
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

      const nombreArchivo = `informe_${nombreCompleto.replace(/\s+/g, '_').toLowerCase()}.pdf`;
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
    try {
      const { jugador: actualizado } = await api.patch(`/jugadores/${id}/datos-deportivos`, {
        dorsal: datosDeportivos.dorsal !== '' ? Number(datosDeportivos.dorsal) : null,
        lateralidad: datosDeportivos.lateralidad || null,
        demarcacion: datosDeportivos.demarcacion || null,
      });
      setJugador((prev) => (prev ? { ...prev, ...actualizado } : actualizado));
      setGuardadoOkDeportivo(true);
      setTimeout(() => setGuardadoOkDeportivo(false), 3000);
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
          setDatosDeportivos({
            dorsal: jugador.dorsal ?? '',
            lateralidad: jugador.lateralidad || '',
            demarcacion: jugador.demarcacion || '',
          });
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/" className="text-club-red font-semibold hover:underline text-sm">
          &larr; Volver a plantillas
        </Link>
        <Link to="/campogramas" className="text-club-red font-semibold hover:underline text-sm">
          &larr; Volver a campograma
        </Link>
      </div>

      {loading && <p className="mt-6 text-club-black/60">Cargando ficha...</p>}

      {error && (
        <p className="mt-6 text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {jugador && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="sticky top-[72px] z-40 bg-club-black text-white px-4 sm:px-6 py-4 flex items-center gap-4 rounded-t-xl">
            {jugador.foto_url ? (
              <img
                src={jugador.foto_url}
                alt={`Foto de ${jugador.nombre}`}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white/30 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40 shrink-0 text-center">
                Sin foto
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">
                {jugador.nombre} {jugador.primer_apellido} {jugador.segundo_apellido || ''}
              </h2>
              <p className="text-white/60 text-sm truncate">Equipo: {jugador.equipo}</p>
            </div>
          </div>

          <div className="px-4 sm:px-6 pt-4 flex flex-wrap items-center gap-4">
            {puedeSubirFoto && (
              <label className="inline-block text-sm font-medium text-club-red cursor-pointer hover:underline">
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
              className="text-sm font-semibold bg-club-black text-white px-3 py-1.5 rounded-md hover:bg-club-black/80 disabled:opacity-60"
            >
              {generandoInforme ? 'Generando informe...' : 'Informe jugador'}
            </button>
          </div>
          {errorFoto && <p className="px-4 sm:px-6 text-sm text-club-red mt-1">{errorFoto}</p>}

          <div className="p-4 sm:p-6 space-y-6">
            {SECCIONES_FICHA.map((seccion) => {
              const camposDisponibles = seccion.campos.filter((c) => c in jugador);
              if (camposDisponibles.length === 0) return null;
              const esDeportivo = seccion.titulo === 'Datos deportivos';
              const editable = esDeportivo && puedeEditarDeportivo;
              return (
                <div key={seccion.titulo}>
                  <h3 className="text-club-red font-bold text-sm uppercase tracking-wide mb-2">
                    {seccion.titulo}
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {camposDisponibles.map((campo) => (
                      <div key={campo}>
                        <dt className="text-xs text-club-black/50 font-semibold">
                          {ETIQUETAS_JUGADOR[campo] || campo}
                        </dt>
                        {editable && campo === 'dorsal' ? (
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={datosDeportivos.dorsal}
                            onChange={(e) =>
                              setDatosDeportivos((prev) => ({ ...prev, dorsal: e.target.value }))
                            }
                            className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                          />
                        ) : editable ? (
                          <select
                            value={datosDeportivos[campo] || ''}
                            onChange={(e) =>
                              setDatosDeportivos((prev) => ({ ...prev, [campo]: e.target.value }))
                            }
                            className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                          >
                            <option value="">-</option>
                            {OPCIONES_POR_CAMPO[campo].map((opcion) => (
                              <option key={opcion} value={opcion}>
                                {opcion}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <dd className="text-club-black">{formatearValor(jugador[campo], campo)}</dd>
                        )}
                      </div>
                    ))}
                  </dl>
                  {editable && (
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={handleGuardarDatosDeportivos}
                        disabled={guardandoDeportivo}
                        className="text-sm font-semibold bg-club-red text-white px-3 py-1.5 rounded-md hover:bg-club-red/90 disabled:opacity-60"
                      >
                        {guardandoDeportivo ? 'Guardando...' : 'Guardar'}
                      </button>
                      {guardadoOkDeportivo && (
                        <p className="text-sm text-green-600 font-medium">Guardado</p>
                      )}
                      {errorDeportivo && <p className="text-sm text-club-red">{errorDeportivo}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
