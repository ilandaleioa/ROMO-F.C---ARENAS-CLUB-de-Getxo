import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useLista, useListaValores } from '../lib/listas';
import SelectBuscador from '../components/SelectBuscador';
import { obtenerEquiposPorClub } from '../data/equipos';

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

const ITEMS_VALORACION_POR_DEMARCACION = {
  'Portero': [
    { key: 'asociacion_linea_defensiva', label: 'Asociacion con linea defensiva' },
    { key: 'conduccion_fijaciones', label: 'Conduccion fijaciones' },
    { key: 'pases_en_corto', label: 'Pases en corto' },
    { key: 'desplazamientos_medios', label: 'Desplazamientos medios' },
    { key: 'desplazamientos_largos', label: 'Desplazamientos largos' },
    { key: 'inicio_transicion_ofensiva_pies', label: 'Inicio de transicion ofensiva con pies' },
  ],
  'Lateral Dcho': [
    { key: 'salida_de_balon', label: 'Salida de balon' },
    { key: 'manejo_espacio_reducido', label: 'Manejo espacio reducido' },
    { key: 'desplazamiento_largo', label: 'Desplazamiento largo' },
    { key: 'incorporaciones', label: 'Incorporaciones' },
    { key: 'asociaciones_campo_rival', label: 'Asociaciones en campo rival' },
    { key: 'desmarque_ruptura', label: 'Desmarque ruptura' },
  ],
  'Lateral Izdo': [
    { key: 'salida_de_balon', label: 'Salida de balon' },
    { key: 'manejo_espacio_reducido', label: 'Manejo espacio reducido' },
    { key: 'desplazamiento_largo', label: 'Desplazamiento largo' },
    { key: 'incorporaciones', label: 'Incorporaciones' },
    { key: 'asociaciones_campo_rival', label: 'Asociaciones en campo rival' },
    { key: 'desmarque_ruptura', label: 'Desmarque ruptura' },
  ],
};
const OPCIONES_VALORACION_ITEM = [1, 2, 3, 4, 5];
const TITULARIDAD_OPCIONES = ['TITULAR', 'SUPLENTE', 'NO CONVOCA'];
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
  tipologia: 'Tipologia',
  descripcion: 'Descripcion',
  demarcacion_concreta: 'Demarcacion concreta',
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

function extraerEquiposDesdePartido(partido) {
  const texto = String(partido || '').trim();
  if (!texto) return { local: '', visitante: '' };

  const porVs = texto.match(/^(.*?)\s+vs\s+(.*?)$/i);
  if (porVs) {
    return {
      local: String(porVs[1] || '').trim(),
      visitante: String(porVs[2] || '').trim(),
    };
  }

  const porGuion = texto.match(/^(.*?)\s*-\s*(.*?)$/);
  if (porGuion) {
    return {
      local: String(porGuion[1] || '').trim(),
      visitante: String(porGuion[2] || '').trim(),
    };
  }

  return { local: '', visitante: '' };
}

function obtenerValorInforme(informe, campo) {
  const valor = String(informe?.[campo] || '').trim();
  if (valor) return valor;

  const { local, visitante } = extraerEquiposDesdePartido(informe?.partido);
  if (campo === 'local') return local || '-';
  if (campo === 'visitante') return visitante || '-';
  return '-';
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
  const [editandoInformeId, setEditandoInformeId] = useState(null);
  const [informeEditando, setInformeEditando] = useState(null);
  const [guardandoInforme, setGuardandoInforme] = useState(false);
  const [errorGuardarInforme, setErrorGuardarInforme] = useState('');

  const fotoUrl = useMemo(() => obtenerFotoJugadorUrl(registro), [registro]);
  const nombre = useMemo(() => nombreCompleto(registro) || 'Detalle de captacion', [registro]);

  const abrirEdicionInforme = (informe) => {
    setEditandoInformeId(informe.id);
    setInformeEditando({ ...informe });
    setErrorGuardarInforme('');
  };

  const cancelarEdicionInforme = () => {
    setEditandoInformeId(null);
    setInformeEditando(null);
    setErrorGuardarInforme('');
  };

  const actualizarCampoInforme = (campo, valor) => {
    setInformeEditando((prev) => (prev ? { ...prev, [campo]: valor } : null));
  };

  const actualizarValoracionItemInforme = (itemKey, valor) => {
    setInformeEditando((prev) =>
      prev ? { ...prev, valoracion_items: { ...prev.valoracion_items, [itemKey]: valor } } : null
    );
  };

  const guardarInformeEditado = async () => {
    if (!informeEditando || !editandoInformeId) return;

    setGuardandoInforme(true);
    setErrorGuardarInforme('');
    try {
      const payload = {
        fecha: informeEditando.fecha || '',
        observador: informeEditando.observador || '',
        club: informeEditando.club || '',
        equipo: informeEditando.equipo || '',
        etapa: informeEditando.etapa || '',
        categoria: informeEditando.categoria || '',
        local: informeEditando.local || '',
        visitante: informeEditando.visitante || '',
        partido: informeEditando.partido || '',
        dorsal: informeEditando.dorsal || '',
        tipologia: informeEditando.tipologia || '',
        lateralidad: informeEditando.lateralidad || '',
        descripcion: informeEditando.descripcion || '',
        demarcacion_concreta: informeEditando.demarcacion_concreta || '',
        titularidad: informeEditando.titularidad || '',
        minutos_jugados: informeEditando.minutos_jugados || '',
        goles: informeEditando.goles || '',
        goles_encajados: informeEditando.goles_encajados || '',
        jugador_id: informeEditando.jugador_id || '',
        valoracion_items: informeEditando.valoracion_items || {},
      };

      const respuesta = await api.put(`/captacion/informes/${editandoInformeId}`, payload);

      setInformes((prev) =>
        prev.map((inf) => (inf.id === editandoInformeId ? respuesta.informe : inf))
      );

      setEditandoInformeId(null);
      setInformeEditando(null);
    } catch (err) {
      setErrorGuardarInforme(err.message);
    } finally {
      setGuardandoInforme(false);
    }
  };

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
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-club-black to-club-red px-5 py-4 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ficha completa</p>
                <h3 className="mt-1 text-2xl font-bold">{nombre}</h3>
                <p className="text-sm text-white/80">{registro.club || 'Sin club asignado'}</p>
              </div>
              <a
                href="#informes-vinculados"
                onClick={(evento) => {
                  evento.preventDefault();
                  document.getElementById('informes-vinculados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <span className="rounded-full bg-white px-2 py-0.5 text-sm font-bold text-club-red tabular-nums">
                  {loadingInformes ? '...' : informes.length}
                </span>
                <span>{informes.length === 1 ? 'Informe' : 'Informes'}</span>
              </a>
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

                <div className="grid gap-4 lg:grid-cols-2">
                  {BLOQUES.map((bloque) => (
                    <section
                      key={bloque.title}
                      className={`rounded-2xl border border-gray-200 bg-gray-50 p-4 ${
                        bloque.title === 'Perfil del jugador' || bloque.title === 'Observaciones' ? 'lg:col-span-2' : ''
                      }`}
                    >
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

          <section id="informes-vinculados" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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

            {editandoInformeId && informeEditando ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h4 className="text-sm font-bold text-club-black">Editando informe del {formatearFecha(informeEditando.fecha)}</h4>
                  {errorGuardarInforme ? (
                    <p className="text-xs text-club-red font-semibold">{errorGuardarInforme}</p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {['fecha', 'observador', 'dorsal', 'lateralidad', 'demarcacion_concreta', 'titularidad', 'minutos_jugados', 'goles', 'goles_encajados'].map((campo) => (
                    <div key={campo}>
                      <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">
                        {ETIQUETAS_INFORME[campo] || campo}
                      </label>
                      <input
                        type={campo === 'fecha' ? 'date' : 'text'}
                        value={informeEditando[campo] || ''}
                        onChange={(e) => actualizarCampoInforme(campo, e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold uppercase text-club-black/60 mb-1">
                      {ETIQUETAS_INFORME['descripcion'] || 'Descripcion'}
                    </label>
                    <textarea
                      value={informeEditando.descripcion || ''}
                      onChange={(e) => actualizarCampoInforme('descripcion', e.target.value)}
                      rows="3"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
                    />
                  </div>
                </div>
                {(() => {
                  const items = ITEMS_VALORACION_POR_DEMARCACION[informeEditando.demarcacion_concreta] || [];
                  if (!items.length) return null;

                  return (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-club-black/60 mb-2">
                        Valoracion en posicion ({informeEditando.demarcacion_concreta})
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => {
                          const valorSeleccionado = informeEditando.valoracion_items?.[item.key] || '';
                          return (
                            <div key={item.key} className="rounded-md border border-gray-300 bg-white p-2">
                              <p className="text-[11px] font-semibold uppercase text-club-black/60 mb-1">{item.label}</p>
                              <div className="grid grid-cols-5 gap-1">
                                {OPCIONES_VALORACION_ITEM.map((opcion) => {
                                  const seleccionado = String(valorSeleccionado) === String(opcion);
                                  return (
                                    <button
                                      key={opcion}
                                      type="button"
                                      onClick={() => actualizarValoracionItemInforme(item.key, opcion)}
                                      aria-pressed={seleccionado}
                                      className={`rounded px-1.5 py-1 text-xs font-bold transition-colors ${
                                        seleccionado
                                          ? 'bg-club-red text-white'
                                          : 'bg-gray-100 text-club-black hover:bg-club-red/10'
                                      }`}
                                    >
                                      {opcion}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={guardarInformeEditado}
                    disabled={guardandoInforme}
                    className="rounded-md bg-club-red px-4 py-2 text-sm font-semibold text-white hover:bg-club-red/90 disabled:opacity-60"
                  >
                    {guardandoInforme ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarEdicionInforme}
                    disabled={guardandoInforme}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-club-black hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

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
                    <article key={informe.id} className={`rounded-xl border bg-gray-50 p-4 ${editandoInformeId === informe.id ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-club-black">{formatearFecha(informe.fecha)}</p>
                          <p className="text-xs font-semibold uppercase tracking-wide text-club-black/45">{informe.observador || 'Sin observador'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirEdicionInforme(informe)}
                          disabled={editandoInformeId !== null}
                          className="rounded-md border border-club-red/20 bg-club-red/5 px-3 py-1.5 text-xs font-semibold text-club-red hover:bg-club-red/10 disabled:opacity-50"
                        >
                          Editar
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {CAMPOS_INFORME.map((campo) => {
                          const valor = campo === 'partido'
                            ? formatearValorInforme(calcularPartidoInforme(informe) || informe.partido)
                            : formatearValorInforme(obtenerValorInforme(informe, campo));

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
                      {(() => {
                        const items = ITEMS_VALORACION_POR_DEMARCACION[informe.demarcacion_concreta] || [];
                        const valoraciones = informe.valoracion_items || {};
                        const itemsConValor = items.filter((item) => valoraciones[item.key]);
                        if (!itemsConValor.length) return null;

                        return (
                          <div className="mt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                              Valoracion en posicion ({informe.demarcacion_concreta})
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {itemsConValor.map((item) => (
                                <div key={item.key} className="rounded-lg border border-gray-200 bg-white p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-club-black/45">
                                    {item.label}
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-club-black">{valoraciones[item.key]} / 5</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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
