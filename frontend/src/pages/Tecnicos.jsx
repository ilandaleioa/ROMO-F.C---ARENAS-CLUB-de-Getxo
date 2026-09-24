import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';
import TableScroll from '../components/TableScroll';

function nombreCompleto(tecnico) {
  return [tecnico.nombre, tecnico.primer_apellido, tecnico.segundo_apellido].filter(Boolean).join(' ');
}

function avatarIniciales(tecnico) {
  return [tecnico.nombre?.[0], tecnico.primer_apellido?.[0]].filter(Boolean).join('').toUpperCase() || 'T';
}

const CAMPOS_TITULACION = [
  { campo: 'titulacion_ninguna', label: 'Ninguna' },
  { campo: 'titulacion_monitor', label: 'Monitor' },
  { campo: 'titulacion_nivel_1', label: 'Nivel 1' },
  { campo: 'titulacion_nivel_2', label: 'Nivel 2' },
  { campo: 'titulacion_nivel_3', label: 'Nivel 3' },
];

const CAMPOS_OTRAS_TITULACIONES = [
  { campo: 'titulacion_sin_formacion', label: 'Sin formacion reglada especifica en deporte' },
  { campo: 'titulacion_magisterio', label: 'Magisterio' },
  { campo: 'titulacion_tafad', label: 'TAFAD' },
  { campo: 'titulacion_ivef', label: 'IVEF' },
  { campo: 'titulacion_cafyd', label: 'CAFYD' },
];

function titulacionLabel(tecnico) {
  const seleccionadas = [...CAMPOS_TITULACION, ...CAMPOS_OTRAS_TITULACIONES]
    .filter(({ campo }) => tecnico[campo])
    .map(({ label }) => label);
  if (tecnico.titulacion_otras) seleccionadas.push(tecnico.titulacion_otras);
  return seleccionadas.join(', ') || '—';
}

function contarDistribucion(lista, obtenerValor) {
  const conteo = new Map();

  lista.forEach((item) => {
    const valor = String(obtenerValor(item) || '').trim();
    if (!valor) return;
    conteo.set(valor, (conteo.get(valor) || 0) + 1);
  });

  return [...conteo.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
}

function GraficoBarras({ titulo, datos }) {
  const total = datos.reduce((suma, item) => suma + item.count, 0);
  const maximo = datos.reduce((max, item) => Math.max(max, item.count), 0) || 1;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-bold uppercase tracking-wide text-club-black">{titulo}</h4>
      {datos.length === 0 ? (
        <p className="mt-4 text-sm text-club-black/50">Sin datos suficientes.</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {datos.map((item) => {
            const porcentaje = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const anchoBarra = Math.max((item.count / maximo) * 100, 4);
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs font-medium text-club-black/70" title={item.label}>
                  {item.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-club-red transition-all"
                    style={{ width: `${anchoBarra}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-club-black/80">
                  {item.count} ({porcentaje}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function crearTecnicoVacio() {
  return {
    nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    telefono: '',
    email: '',
    funcion_principal: '',
    otra_funcion: '',
    equipo_primer_entrenador: '',
    equipo_segundo_entrenador: '',
    localidad: '',
    titulacion_ninguna: '',
    titulacion_monitor: '',
    titulacion_nivel_1: '',
    titulacion_nivel_2: '',
    titulacion_nivel_3: '',
    titulacion_sin_formacion: '',
    titulacion_magisterio: '',
    titulacion_tafad: '',
    titulacion_ivef: '',
    titulacion_cafyd: '',
    titulacion_otras: '',
    euskera: '',
    cuenta_bancaria: '',
  };
}

function IconoVer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconoEditar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="m4 20 4.5-1 10-10a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0l-10 10L4 20Z" strokeLinejoin="round" />
      <path d="m13 6 5 5" strokeLinecap="round" />
    </svg>
  );
}

function IconoBorrar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" strokeLinejoin="round" />
      <path d="M7 7l1 13h8l1-13" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" strokeLinecap="round" />
    </svg>
  );
}

export default function Tecnicos() {
  const { user } = useAuth();
  const { club } = useClub();
  const [searchParams, setSearchParams] = useSearchParams();
  const puedeSincronizar = user?.rol === 'administrador' || user?.rol === 'director';
  const puedeGestionar = user?.rol === 'administrador' || user?.rol === 'director';

  const [tecnicos, setTecnicos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFuncion, setFiltroFuncion] = useState('');
  const [filtroTitulacion, setFiltroTitulacion] = useState('');
  const [filtroEuskera, setFiltroEuskera] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(crearTecnicoVacio);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [graficasAbiertas, setGraficasAbiertas] = useState(false);
  const [soloLectura, setSoloLectura] = useState(false);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoUrlActual, setFotoUrlActual] = useState(null);

  const cargarTecnicos = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      const query = params.toString();
      const { tecnicos: lista } = await api.get(query ? `/tecnicos?${query}` : '/tecnicos');
      setTecnicos(lista || []);
    } catch (err) {
      setError(err.message);
    }
  }, [busqueda]);

  useEffect(() => {
    let vivo = true;
    const ejecutar = async () => {
      setLoading(true);
      try {
        await cargarTecnicos();
      } finally {
        if (vivo) setLoading(false);
      }
    };

    ejecutar();
    return () => {
      vivo = false;
    };
  }, [club, cargarTecnicos]);

  const opcionesFuncion = useMemo(() => {
    const valores = new Set(tecnicos.map((t) => t.funcion_principal).filter(Boolean));
    return Array.from(valores).sort((a, b) => a.localeCompare(b));
  }, [tecnicos]);

  const opcionesTitulacion = useMemo(() => {
    const valores = new Set();
    tecnicos.forEach((t) => {
      [...CAMPOS_TITULACION, ...CAMPOS_OTRAS_TITULACIONES].forEach(({ campo, label }) => {
        if (t[campo]) valores.add(label);
      });
    });
    return Array.from(valores).sort((a, b) => a.localeCompare(b));
  }, [tecnicos]);

  const opcionesEuskera = useMemo(() => {
    const valores = new Set(tecnicos.map((t) => t.euskera).filter(Boolean));
    return Array.from(valores).sort((a, b) => a.localeCompare(b));
  }, [tecnicos]);

  const tecnicosFiltrados = useMemo(() => {
    return tecnicos.filter((item) => {
      if (filtroFuncion && item.funcion_principal !== filtroFuncion) return false;
      if (filtroTitulacion && !titulacionLabel(item).split(', ').includes(filtroTitulacion)) return false;
      if (filtroEuskera && item.euskera !== filtroEuskera) return false;
      return true;
    });
  }, [tecnicos, filtroFuncion, filtroTitulacion, filtroEuskera]);

  const hayFiltrosActivos = Boolean(filtroFuncion || filtroTitulacion || filtroEuskera);

  const distribucionTitulaciones = useMemo(
    () =>
      contarDistribucion(
        tecnicos.flatMap((t) =>
          [...CAMPOS_TITULACION, ...CAMPOS_OTRAS_TITULACIONES].filter(({ campo }) => t[campo]).map(({ label }) => ({ label }))
        ),
        (item) => item.label
      ),
    [tecnicos]
  );

  const distribucionEuskera = useMemo(() => contarDistribucion(tecnicos, (t) => t.euskera), [tecnicos]);

  const limpiarFiltros = () => {
    setFiltroFuncion('');
    setFiltroTitulacion('');
    setFiltroEuskera('');
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    setMensaje('');
    setError('');
    try {
      const resultado = await api.post('/tecnicos/sync');
      setMensaje(
        `Sincronizacion completada: ${resultado.insertados || 0} nuevo(s), ${resultado.actualizados || 0} actualizado(s)` +
          (resultado.protegidos ? `, ${resultado.protegidos} protegido(s) por edicion reciente en la web` : '') +
          (resultado.eliminados ? `, ${resultado.eliminados} eliminado(s)` : '') +
          (resultado.omitidos ? `. ${resultado.omitidos} fila(s) de la hoja omitida(s) por datos incompletos.` : '.')
      );
      await cargarTecnicos();
    } catch (err) {
      setError(err.message);
    } finally {
      setSincronizando(false);
    }
  };

  const resetForm = () => {
    setForm(crearTecnicoVacio());
    setEditandoId(null);
    setFotoFile(null);
    setFotoUrlActual(null);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setSoloLectura(false);
    resetForm();
  };

  const cargarFormDesde = (item) => {
    setEditandoId(item.id);
    setFotoFile(null);
    setFotoUrlActual(item.foto_url || null);
    setForm({
      nombre: item.nombre || '',
      primer_apellido: item.primer_apellido || '',
      segundo_apellido: item.segundo_apellido || '',
      telefono: item.telefono || '',
      email: item.email || '',
      funcion_principal: item.funcion_principal || '',
      otra_funcion: item.otra_funcion || '',
      equipo_primer_entrenador: item.equipo_primer_entrenador || '',
      equipo_segundo_entrenador: item.equipo_segundo_entrenador || '',
      localidad: item.localidad || '',
      titulacion_ninguna: item.titulacion_ninguna || '',
      titulacion_monitor: item.titulacion_monitor || '',
      titulacion_nivel_1: item.titulacion_nivel_1 || '',
      titulacion_nivel_2: item.titulacion_nivel_2 || '',
      titulacion_nivel_3: item.titulacion_nivel_3 || '',
      titulacion_sin_formacion: item.titulacion_sin_formacion || '',
      titulacion_magisterio: item.titulacion_magisterio || '',
      titulacion_tafad: item.titulacion_tafad || '',
      titulacion_ivef: item.titulacion_ivef || '',
      titulacion_cafyd: item.titulacion_cafyd || '',
      titulacion_otras: item.titulacion_otras || '',
      euskera: item.euskera || '',
      cuenta_bancaria: item.cuenta_bancaria || '',
    });
    setMensaje('');
  };

  const verTecnico = (item) => {
    cargarFormDesde(item);
    setSoloLectura(true);
    setModalAbierto(true);
  };

  const iniciarEdicion = (item) => {
    cargarFormDesde(item);
    setSoloLectura(false);
    setModalAbierto(true);
  };

  useEffect(() => {
    const tecnicoId = searchParams.get('tecnico');
    if (!tecnicoId || loading || modalAbierto) return;

    const item = tecnicos.find((t) => t.id === tecnicoId);
    if (item) {
      verTecnico(item);
    }

    const siguientes = new URLSearchParams(searchParams);
    siguientes.delete('tecnico');
    setSearchParams(siguientes, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, tecnicos]);

  const subirFotoSiHaceFalta = async (id) => {
    if (!fotoFile) return null;
    const formData = new FormData();
    formData.append('foto', fotoFile);
    const respuesta = await api.postFile(`/tecnicos/${id}/foto`, formData);
    return respuesta?.foto_url || null;
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!puedeGestionar || guardando) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const payload = { ...form };

      const respuesta = editandoId
        ? await api.put(`/tecnicos/${editandoId}`, payload)
        : await api.post('/tecnicos', payload);

      const registrado = respuesta?.tecnico;
      if (fotoFile && registrado?.id) {
        await subirFotoSiHaceFalta(registrado.id);
      }

      const sheetSync = respuesta?.sheet_sync;
      const avisoHoja = sheetSync?.omitida
        ? ` Aviso: no se pudo reflejar en Google Sheets (${sheetSync.motivo}).`
        : ' Cambio reflejado en Google Sheets.';

      setMensaje((editandoId ? 'Tecnico actualizado correctamente.' : 'Tecnico creado correctamente.') + avisoHoja);
      setModalAbierto(false);
      resetForm();
      await cargarTecnicos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (item) => {
    if (!puedeGestionar || borrandoId) return;

    const confirmado = window.confirm(
      `Borrar a ${nombreCompleto(item)}? Esta accion tambien borrara su fila en Google Sheets y no se puede deshacer.`
    );
    if (!confirmado) return;

    setBorrandoId(item.id);
    setError('');
    setMensaje('');

    try {
      await api.delete(`/tecnicos/${item.id}`);
      if (editandoId === item.id) {
        setModalAbierto(false);
        resetForm();
      }
      setMensaje(`${nombreCompleto(item)} borrado correctamente.`);
      await cargarTecnicos();
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrandoId(null);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-club-black">TECNICOS</h2>
          <p className="text-sm text-club-black/60 mt-1">
            Datos sincronizados con el formulario de Google Sheets de tecnicos del club. Los cambios que hagas aqui se
            reflejan tambien en la hoja.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, contacto, funcion o equipo..."
            className="w-full sm:w-72 rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
          />
          <button
            type="button"
            onClick={() => setGraficasAbiertas((prev) => !prev)}
            className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
              graficasAbiertas
                ? 'border-club-red bg-club-red text-white hover:bg-club-redDark'
                : 'border-gray-300 bg-white text-club-black hover:border-club-red/40 hover:text-club-red'
            }`}
          >
            {graficasAbiertas ? 'Ocultar graficas' : 'Ver graficas'}
          </button>
          {puedeSincronizar && (
            <button
              type="button"
              onClick={handleSincronizar}
              disabled={sincronizando}
              className="inline-flex items-center justify-center rounded-md bg-club-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sincronizando ? 'Sincronizando...' : 'Sincronizar con Google Sheets'}
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{mensaje}</p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-club-red/30 bg-red-50 px-3 py-2 text-sm font-medium text-club-red">
          {error}
        </p>
      )}

      {!loading && tecnicos.length > 0 && graficasAbiertas && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-club-black mb-4">Graficas</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <GraficoBarras titulo="Tecnicos por titulacion" datos={distribucionTitulaciones} />
            <GraficoBarras titulo="Tecnicos por idioma (Euskera)" datos={distribucionEuskera} />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-club-black">Listado</h3>
          <span className="rounded-full bg-club-black px-3 py-1 text-sm font-semibold text-white">
            {tecnicosFiltrados.length} {tecnicosFiltrados.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {!loading && tecnicos.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center mb-4">
            <select
              value={filtroFuncion}
              onChange={(e) => setFiltroFuncion(e.target.value)}
              className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Todas las funciones</option>
              {opcionesFuncion.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
            <select
              value={filtroTitulacion}
              onChange={(e) => setFiltroTitulacion(e.target.value)}
              className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Todas las titulaciones</option>
              {opcionesTitulacion.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
            <select
              value={filtroEuskera}
              onChange={(e) => setFiltroEuskera(e.target.value)}
              className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-club-red"
            >
              <option value="">Todo Euskera</option>
              {opcionesEuskera.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-sm font-semibold text-club-red hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-club-black/60">Cargando tecnicos...</p>
        ) : tecnicos.length === 0 ? (
          <p className="py-8 text-club-black/60">
            No se han encontrado tecnicos. {puedeSincronizar ? 'Pulsa "Sincronizar con Google Sheets" para empezar.' : ''}
          </p>
        ) : tecnicosFiltrados.length === 0 ? (
          <p className="py-8 text-club-black/60">Ningun tecnico coincide con los filtros seleccionados.</p>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-club-black/50">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Funcion</th>
                  <th className="px-3 py-2">Localidad</th>
                  <th className="px-3 py-2">Titulacion</th>
                  <th className="px-3 py-2">Euskera</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tecnicosFiltrados.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-red-50/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt={nombreCompleto(item)}
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-club-black text-sm font-bold text-white">
                            {avatarIniciales(item)}
                          </div>
                        )}
                        <span className="font-semibold text-club-black">{nombreCompleto(item)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-club-black/80">
                      {item.telefono ? (
                        <a href={`tel:${item.telefono}`} className="block hover:text-club-red hover:underline">
                          {item.telefono}
                        </a>
                      ) : null}
                      {item.email ? (
                        <a href={`mailto:${item.email}`} className="block hover:text-club-red hover:underline">
                          {item.email}
                        </a>
                      ) : null}
                      {!item.telefono && !item.email ? <span className="text-club-black/40">—</span> : null}
                    </td>
                    <td className="px-3 py-3 text-club-black/80">
                      {item.funcion_principal || <span className="text-club-black/40">—</span>}
                      {item.otra_funcion ? (
                        <div className="text-xs text-club-black/50">{item.otra_funcion}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-club-black/80">
                      {item.localidad || <span className="text-club-black/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-club-black/80 max-w-[220px]">{titulacionLabel(item)}</td>
                    <td className="px-3 py-3 text-club-black/80">
                      {item.euskera || <span className="text-club-black/40">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => verTecnico(item)}
                          title="Ver"
                          aria-label={`Ver a ${nombreCompleto(item)}`}
                          className="rounded-md p-1.5 text-club-black/60 transition-colors hover:bg-gray-100 hover:text-club-black"
                        >
                          <IconoVer />
                        </button>
                        {puedeGestionar && (
                          <>
                            <button
                              type="button"
                              onClick={() => iniciarEdicion(item)}
                              title="Editar"
                              aria-label={`Editar a ${nombreCompleto(item)}`}
                              className="rounded-md p-1.5 text-club-black/60 transition-colors hover:bg-gray-100 hover:text-club-black"
                            >
                              <IconoEditar />
                            </button>
                            <button
                              type="button"
                              onClick={() => borrar(item)}
                              disabled={borrandoId === item.id}
                              title="Borrar"
                              aria-label={`Borrar a ${nombreCompleto(item)}`}
                              className="rounded-md p-1.5 text-club-black/60 transition-colors hover:bg-red-50 hover:text-club-red disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <IconoBorrar />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      {modalAbierto && (puedeGestionar || soloLectura) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tecnico-modal-titulo"
          onClick={cerrarModal}
        >
          <div
            className="my-auto w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 id="tecnico-modal-titulo" className="text-lg font-bold text-club-black">
                    {soloLectura ? 'Detalle de tecnico' : editandoId ? 'Editar tecnico' : 'Nuevo tecnico'}
                  </h3>
                  <p className="text-sm text-club-black/60">
                    {soloLectura ? 'Vista de solo lectura.' : 'Rellena los campos y guarda el registro.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="text-sm font-semibold text-club-black/60 hover:text-club-black"
                >
                  Cerrar
                </button>
              </div>

              <form onSubmit={guardar} className="space-y-4">
                {!soloLectura && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                    <button
                      type="submit"
                      disabled={guardando}
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-club-red px-4 py-2 font-semibold text-white transition-colors hover:bg-club-redDark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {guardando ? 'Guardando...' : editandoId ? 'GUARDAR' : 'Crear tecnico'}
                    </button>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Foto
                  </label>
                  {fotoUrlActual ? (
                    <img
                      src={fotoUrlActual}
                      alt="Foto de tecnico"
                      className="mb-2 h-20 w-20 rounded-full object-cover"
                    />
                  ) : soloLectura ? (
                    <p className="mb-2 text-sm text-club-black/40">Sin foto</p>
                  ) : null}
                  {!soloLectura && (
                    <>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-club-black/70 file:mr-3 file:rounded-md file:border-0 file:bg-club-black file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black"
                      />
                      <p className="mt-1 text-xs text-club-black/50">JPG, PNG o WEBP. Tamaño máximo: 5 MB.</p>
                    </>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                    disabled={soloLectura}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                      Primer apellido
                    </label>
                    <input
                      type="text"
                      value={form.primer_apellido}
                      onChange={(e) => setForm((prev) => ({ ...prev, primer_apellido: e.target.value }))}
                      disabled={soloLectura}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                      Segundo apellido
                    </label>
                    <input
                      type="text"
                      value={form.segundo_apellido}
                      onChange={(e) => setForm((prev) => ({ ...prev, segundo_apellido: e.target.value }))}
                      disabled={soloLectura}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                    placeholder="Ej. 600 000 000"
                    disabled={soloLectura}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                  />
                  {soloLectura && form.telefono && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <a
                        href={`https://wa.me/${form.telefono.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 sm:w-auto"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.94L2 22l5.2-1.36A9.94 9.94 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm0 18.06c-1.6 0-3.12-.43-4.44-1.19l-.32-.19-3.09.81.83-3.01-.21-.31A8.05 8.05 0 014 12c0-4.43 3.6-8.03 8.04-8.03S20.08 7.57 20.08 12s-3.6 8.06-8.04 8.06zm4.4-6.03c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4-.14-.01-.3-.01-.46-.01s-.42.06-.64.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28z" />
                        </svg>
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${form.telefono.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-club-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black sm:w-auto"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.02l-2.2 2.2z" />
                        </svg>
                        Llamar
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Ej. nombre@club.com"
                    disabled={soloLectura}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                      Funcion principal
                    </label>
                    <input
                      type="text"
                      value={form.funcion_principal}
                      onChange={(e) => setForm((prev) => ({ ...prev, funcion_principal: e.target.value }))}
                      disabled={soloLectura}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                      Otra funcion
                    </label>
                    <input
                      type="text"
                      value={form.otra_funcion}
                      onChange={(e) => setForm((prev) => ({ ...prev, otra_funcion: e.target.value }))}
                      disabled={soloLectura}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Localidad
                  </label>
                  <input
                    type="text"
                    value={form.localidad}
                    onChange={(e) => setForm((prev) => ({ ...prev, localidad: e.target.value }))}
                    disabled={soloLectura}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Titulacion futbolistica
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CAMPOS_TITULACION.map(({ campo, label }) => (
                      <label key={campo} className="flex items-center gap-2 text-sm text-club-black/80">
                        <input
                          type="checkbox"
                          checked={Boolean(form[campo])}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [campo]: e.target.checked ? label : '' }))
                          }
                          disabled={soloLectura}
                          className="h-4 w-4 rounded border-gray-300 text-club-red focus:ring-club-red"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Otras titulaciones
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CAMPOS_OTRAS_TITULACIONES.map(({ campo, label }) => (
                      <label key={campo} className="flex items-center gap-2 text-sm text-club-black/80">
                        <input
                          type="checkbox"
                          checked={Boolean(form[campo])}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [campo]: e.target.checked ? label : '' }))
                          }
                          disabled={soloLectura}
                          className="h-4 w-4 rounded border-gray-300 text-club-red focus:ring-club-red"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={form.titulacion_otras}
                    onChange={(e) => setForm((prev) => ({ ...prev, titulacion_otras: e.target.value }))}
                    placeholder="Otras titulaciones no listadas arriba..."
                    disabled={soloLectura}
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Euskera / Idiomas
                  </label>
                  <input
                    type="text"
                    value={form.euskera}
                    onChange={(e) => setForm((prev) => ({ ...prev, euskera: e.target.value }))}
                    placeholder="Ej. Entiende, Domina, No lo entiende..."
                    disabled={soloLectura}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/60">
                    Cuenta bancaria
                  </label>
                  <input
                    type="text"
                    value={form.cuenta_bancaria}
                    onChange={(e) => setForm((prev) => ({ ...prev, cuenta_bancaria: e.target.value }))}
                    placeholder="Ej. ESXX XXXX XXXX XXXX XXXX XXXX"
                    disabled={soloLectura}
                    autoComplete="off"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red disabled:bg-gray-50 disabled:text-club-black/70"
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
