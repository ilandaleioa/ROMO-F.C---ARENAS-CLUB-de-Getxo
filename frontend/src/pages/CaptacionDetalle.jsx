import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

function normalizarFecha(valor) {
  const limpia = String(valor || '').trim();
  if (!limpia) return '';

  const iso = limpia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const es = limpia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (es) {
    const [, dia, mes, anio] = es;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return limpia;
}

function formatearFecha(valor) {
  const fecha = normalizarFecha(valor);
  if (!fecha) return '-';

  const [anio, mes, dia] = fecha.split('-');
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function formatearValor(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (typeof valor === 'boolean') return valor ? 'Si' : 'No';
  if (campo === 'fecha_alta' || campo === 'fecha_nacimiento') return formatearFecha(valor);
  if (campo === 'enlace' || campo === 'foto_jugador' || campo === 'foto_jugador_url') return String(valor);
  return String(valor);
}

function nombreCompleto(registro) {
  if (!registro) return '';
  return [registro.nombre, registro.primer_apellido].filter(Boolean).join(' ');
}

function obtenerFotoJugadorUrl(registro) {
  const firmada = String(registro?.foto_jugador_url || '').trim();
  if (firmada) return firmada;

  const valor = String(registro?.foto_jugador || '').trim();
  return /^https?:\/\//i.test(valor) || /^data:/i.test(valor) ? valor : '';
}

function calcularEdad(fechaNacimiento) {
  const fecha = normalizarFecha(fechaNacimiento);
  if (!fecha) return '-';

  const nacimiento = new Date(fecha);
  if (Number.isNaN(nacimiento.getTime())) return '-';

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplida =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());

  if (aunNoCumplida) edad -= 1;
  return `${edad}`;
}

const BLOQUES = [
  {
    title: 'Datos de alta',
    fields: ['fecha_alta', 'quien_da_alta'],
  },
  {
    title: 'Contexto deportivo',
    fields: ['club', 'equipo', 'etapa', 'categoria', 'grupo', 'enlace'],
  },
  {
    title: 'Perfil del jugador',
    fields: ['nombre', 'primer_apellido', 'nombre_completo', 'segundo_apellido', 'dorsal', 'altura', 'lateralidad', 'fecha_nacimiento', 'anio_nacimiento', 'edad', 'demarcacion', 'demarcacion_concreta', 'otra_demarcacion', 'valoracion_general'],
  },
  {
    title: 'Observaciones',
    fields: ['descripcion_jugador', 'observaciones'],
  },
];

const CAMPOS_INFORME = ['club', 'equipo', 'etapa', 'categoria', 'local', 'visitante', 'partido', 'dorsal', 'lateralidad', 'titularidad', 'minutos_jugados', 'goles', 'goles_encajados'];
const ETIQUETAS_INFORME = {
  club: 'Club',
  equipo: 'Equipo',
  etapa: 'Etapa',
  categoria: 'Categoria',
  local: 'Local',
  visitante: 'Visitante',
  partido: 'Partido',
  dorsal: 'Dorsal',
  lateralidad: 'Lateralidad',
  titularidad: 'Titularidad',
  minutos_jugados: 'Minutos jugados',
  goles: 'Goles',
  goles_encajados: 'Goles encajados',
};

const ETIQUETAS = {
  fecha_alta: 'Fecha alta',
  quien_da_alta: 'Quien da alta',
  club: 'Club',
  equipo: 'Equipo',
  etapa: 'Etapa',
  categoria: 'Categoria',
  grupo: 'Grupo',
  enlace: 'Enlace federacion',
  nombre: 'Nombre',
  primer_apellido: 'Primer apellido',
  nombre_completo: 'Nombre completo',
  segundo_apellido: 'Segundo apellido',
  dorsal: 'Dorsal',
  altura: 'Altura (cm)',
  lateralidad: 'Lateralidad',
  foto_jugador: 'Foto jugador',
  fecha_nacimiento: 'Fecha nacimiento',
  anio_nacimiento: 'Anio nacimiento',
  edad: 'Edad',
  demarcacion: 'Demarcacion',
  demarcacion_concreta: 'Demarcacion concreta',
  otra_demarcacion: 'Otra demarcacion -',
  valoracion_general: 'Valoracion general',
  descripcion_jugador: 'Descripcion del jugador',
  observaciones: 'Observaciones',
};

function renderValor(registro, campo) {
  if (!registro) return '-';
  if (campo === 'edad') return calcularEdad(registro.fecha_nacimiento);
  if (campo === 'anio_nacimiento') {
    const fecha = normalizarFecha(registro.fecha_nacimiento);
    if (!fecha) return '-';
    const nacimiento = new Date(fecha);
    if (Number.isNaN(nacimiento.getTime())) return '-';
    return String(nacimiento.getFullYear());
  }
  if (campo === 'nombre_completo') return nombreCompleto(registro) || '-';

  const valor = registro[campo];
  if (campo === 'foto_jugador') {
    const fotoUrl = obtenerFotoJugadorUrl(registro);
    if (!fotoUrl) return '-';
    return fotoUrl;
  }

  return formatearValor(valor, campo);
}

function calcularPartidoInforme(informe) {
  const local = String(informe?.local || '').trim();
  const visitante = String(informe?.visitante || '').trim();
  if (local && visitante) return `${local} Vs ${visitante}`;
  return '';
}

function formatearValorInforme(valor) {
  const texto = String(valor ?? '').trim();
  return texto || '-';
}

function formatearFechaHora(valor) {
  if (!valor) return '-';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return formatearFecha(valor);
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()} ${String(
    fecha.getHours()
  ).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

export default function CaptacionDetalle() {
  const { id } = useParams();
  const [registro, setRegistro] = useState(null);
  const [informes, setInformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInformes, setLoadingInformes] = useState(true);
  const [error, setError] = useState('');
  const [errorInformes, setErrorInformes] = useState('');

  const fotoUrl = useMemo(() => obtenerFotoJugadorUrl(registro), [registro]);
  const nombre = useMemo(() => nombreCompleto(registro) || 'Detalle de captacion', [registro]);

  useEffect(() => {
    let cancelado = false;

    async function cargarDetalle() {
      setLoading(true);
      setError('');

      try {
        const detalle = await api.get(`/captacion/${id}`);

        if (cancelado) return;

        setRegistro(detalle?.registro || null);
      } catch (err) {
        if (!cancelado) {
          setRegistro(null);
          setError(err.message);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    }

    async function cargarInformes() {
      setLoadingInformes(true);
      setErrorInformes('');

      try {
        const respuestaInformes = await api.get('/captacion/informes');
        if (cancelado) return;

        const todosLosInformes = Array.isArray(respuestaInformes?.informes) ? respuestaInformes.informes : [];
        setInformes(todosLosInformes.filter((informe) => String(informe?.jugador_id || '') === String(id || '')));
      } catch (err) {
        if (!cancelado) {
          setInformes([]);
          setErrorInformes(err.message);
        }
      } finally {
        if (!cancelado) {
          setLoadingInformes(false);
        }
      }
    }

    cargarDetalle();
    cargarInformes();
    return () => {
      cancelado = true;
    };
  }, [id]);

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/captacion"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50"
          >
            Volver al listado
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50">Seguimiento</p>
            <h2 className="text-2xl font-bold text-club-black">Detalle de jugador de captacion</h2>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-club-black/60">
          Cargando detalle...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-club-red/20 bg-red-50 px-4 py-6 text-club-red">
          <p className="font-semibold">No se pudo cargar el registro.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : registro ? (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ficha completa</p>
              <h3 className="mt-1 text-2xl font-bold">{nombre}</h3>
              <p className="text-sm text-white/80">{registro.club || 'Sin club asignado'}</p>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[240px_1fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt={nombre} className="h-72 w-full object-cover" />
                  ) : (
                    <div className="flex h-72 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center text-sm font-semibold text-club-black/40">
                      Sin foto disponible
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Edad</p>
                    <p className="mt-1 text-xl font-bold text-club-black">{renderValor(registro, 'edad')}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-club-black/50">Dorsal</p>
                    <p className="mt-1 text-xl font-bold text-club-black">{renderValor(registro, 'dorsal')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {['club', 'equipo', 'etapa', 'categoria', 'grupo', 'demarcacion', 'lateralidad'].map((campo) => {
                    const valor = renderValor(registro, campo);
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

                <div className="space-y-4">
                  {BLOQUES.map((bloque) => (
                    <section key={bloque.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{bloque.title}</h4>
                        {bloque.title === 'Perfil del jugador' && fotoUrl ? (
                          <a href={fotoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-club-red hover:underline">
                            Abrir foto
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {bloque.fields.map((campo) => {
                          const valor = renderValor(registro, campo);
                          const isLongText = campo === 'descripcion_jugador' || campo === 'observaciones';
                          return (
                            <div
                              key={campo}
                              className={`rounded-xl border border-gray-200 bg-white p-4 ${
                                isLongText ? 'sm:col-span-2 xl:col-span-3' : ''
                              }`}
                            >
                              <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">
                                {ETIQUETAS[campo]}
                              </p>
                              <div
                                className={`mt-2 text-sm text-club-black/80 ${
                                  isLongText ? 'whitespace-pre-line leading-6' : 'break-words'
                                }`}
                              >
                                {campo === 'enlace' && valor !== '-' ? (
                                  <a
                                    href={valor}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-club-red hover:underline"
                                  >
                                    Abrir enlace
                                  </a>
                                ) : campo === 'foto_jugador' && fotoUrl ? (
                                  <a
                                    href={fotoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-club-red hover:underline"
                                  >
                                    Abrir foto
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
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50">Actividad relacionada</p>
                <h3 className="text-xl font-bold text-club-black">Informes vinculados</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-lg font-bold text-club-red tabular-nums">{informes.length}</span>
                <span className="text-sm text-club-black/70">{informes.length === 1 ? 'informe' : 'informes'}</span>
              </div>
            </div>

            <div className="mt-4">
              {loadingInformes ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-club-black/60">
                  Cargando informes...
                </div>
              ) : errorInformes ? (
                <div className="rounded-lg border border-club-red/20 bg-red-50 px-4 py-4 text-sm text-club-red">
                  {errorInformes}
                </div>
              ) : informes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-club-black/55">
                  No hay informes asociados a este registro.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {informes.map((informe) => (
                    <article key={informe.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-club-black">{formatearFecha(informe.fecha)}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{informe.observador || 'Sin observador'}</p>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {CAMPOS_INFORME.map((campo) => {
                          const valor = campo === 'partido'
                            ? formatearValorInforme(calcularPartidoInforme(informe) || informe.partido)
                            : formatearValorInforme(informe[campo]);

                          return (
                            <div key={campo} className="rounded-lg border border-gray-200 bg-white p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                {ETIQUETAS_INFORME[campo]}
                              </p>
                              <p className="mt-1 text-sm font-medium text-club-black">{valor}</p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-club-black/55">Creado: {formatearFechaHora(informe.created_at)}</p>
                    </article>
                  ))}
                </div>
              )}
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
