import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useClub } from '../context/ClubContext';
import { db, firebaseConfigMissing, firebaseReady } from '../lib/firebase';

const CAMPOS = [
  { key: 'id_jugador', label: 'ID JUGADOR', type: 'text' },
  { key: 'fecha_alta', label: 'FECHA ALTA', type: 'date' },
  { key: 'quien_da_alta', label: 'QUIEN DA ALTA', type: 'selectWithAdd' },
  { key: 'club', label: 'CLUB', type: 'text' },
  { key: 'equipo', label: 'EQUIPO', type: 'text' },
  { key: 'categoria', label: 'CATEGORIA', type: 'text' },
  { key: 'grupo', label: 'GRUPO', type: 'text' },
  { key: 'enlace', label: 'ENLACE', type: 'url' },
  { key: 'nombre', label: 'NOMBRE', type: 'text', required: true },
  { key: 'primer_apellido', label: 'PRIMER APELLIDO', type: 'text', required: true },
  { key: 'segundo_apellido', label: 'SEGUNDO APELLIDO', type: 'text' },
  { key: 'dorsal', label: 'DORSAL', type: 'number' },
  { key: 'tipologia', label: 'TIPOLOGIA', type: 'text' },
  { key: 'altura', label: 'ALTURA', type: 'text' },
  { key: 'lateralidad', label: 'LATERALIDAD', type: 'select', options: ['DIESTRO', 'ZURDO', 'AMBAS'] },
  { key: 'foto_jugador', label: 'FOTO JUGADOR', type: 'url' },
  { key: 'fecha_nacimiento', label: 'FECHA DE NACIMIENTO', type: 'text' },
  { key: 'anio_nacimiento', label: 'ANO DE NACIMIENTO', type: 'number' },
  { key: 'edad', label: 'EDAD', type: 'number' },
  { key: 'demarcacion', label: 'DEMARCACION', type: 'select', options: ['PORTERO', 'LATERAL', 'CENTRAL', 'MEDIO', 'MEDIA PUNTA', 'EXTREMO', 'DELANTERO'] },
  { key: 'otra_demarcacion', label: 'OTRA DEMARCACION', type: 'text' },
  { key: 'valoracion_general', label: 'VALORACION GENERAL', type: 'number' },
  { key: 'descripcion_jugador', label: 'DESCRIPCION DEL JUGADOR', type: 'textarea' },
  { key: 'observaciones', label: 'OBSERVACIONES', type: 'textarea' },
];

const RESPONSABLES_ALTA_INICIALES = ['ADRIAN', 'ALEX', 'MIKEL'];

function obtenerFechaHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function normalizarFechaInput(valor) {
  const limpia = String(valor || '').trim();
  if (!limpia) return '';

  const iso = limpia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const fechaEs = limpia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fechaEs) {
    const [, dia, mes, anio] = fechaEs;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return limpia;
}

function crearFormVacio() {
  return CAMPOS.reduce(
    (acc, campo) => ({ ...acc, [campo.key]: campo.key === 'fecha_alta' ? obtenerFechaHoyISO() : '' }),
    {}
  );
}

const REGISTRO_INICIAL = {
  id: 'captacion-1',
  id_jugador: '',
  fecha_alta: '17/10/2022',
  quien_da_alta: 'ADRIAN ALVITE',
  club: 'SD DEUSTO',
  equipo: 'INFANTIL A',
  categoria: 'INFANTIL LIGA R',
  grupo: '2',
  enlace: '',
  nombre: 'PEIO',
  primer_apellido: 'CUESTA',
  segundo_apellido: 'ALONSO',
  dorsal: '4',
  tipologia: 'NORMAL',
  altura: '1.89',
  lateralidad: 'ZURDO',
  foto_jugador: '',
  fecha_nacimiento: '02/02/2002',
  anio_nacimiento: '2002',
  edad: '24',
  demarcacion: 'LATERAL',
  otra_demarcacion: 'CENTRAL',
  valoracion_general: '4',
  descripcion_jugador: 'Jugador muy completo',
  observaciones: 'Termina contrato en junio',
};

function captacionRef(club) {
  return collection(db, 'captacion', club, 'registros');
}

function ordenarRegistros(registros) {
  return [...registros].sort((a, b) => {
    const fechaA = a.created_at?.seconds || 0;
    const fechaB = b.created_at?.seconds || 0;
    return fechaB - fechaA || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es', { sensitivity: 'base' });
  });
}

function parseFechaNacimiento(valor) {
  const limpia = String(valor || '').trim();
  const match = limpia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, dia, mes, anio] = match;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }

  const iso = limpia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }

  return null;
}

function calcularDatosNacimiento(fechaNacimiento) {
  const fecha = parseFechaNacimiento(fechaNacimiento);
  if (!fecha || Number.isNaN(fecha.getTime())) return {};

  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const cumplePendiente =
    hoy.getMonth() < fecha.getMonth() ||
    (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate());

  if (cumplePendiente) edad -= 1;

  return {
    anio_nacimiento: String(fecha.getFullYear()),
    edad: String(edad),
  };
}

function nombreCompleto(registro) {
  return [registro.nombre, registro.primer_apellido, registro.segundo_apellido].filter(Boolean).join(' ');
}

export default function Captacion() {
  const { club } = useClub();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(() => crearFormVacio());
  const [responsablesAlta, setResponsablesAlta] = useState(RESPONSABLES_ALTA_INICIALES);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!firebaseReady) {
      setRegistros([REGISTRO_INICIAL]);
      setLoading(false);
      setError(`Falta configurar Firebase: ${firebaseConfigMissing.join(', ')}`);
      return undefined;
    }

    setLoading(true);
    setError('');

    const unsubscribe = onSnapshot(
      captacionRef(club),
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setRegistros(docs.length > 0 ? ordenarRegistros(docs) : [REGISTRO_INICIAL]);
        setLoading(false);
      },
      (err) => {
        setError(`No se pudieron cargar los registros de Firebase: ${err.message}`);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [club]);

  const registrosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return registros;

    return registros.filter((registro) =>
      CAMPOS.some((campo) => String(registro[campo.key] || '').toLowerCase().includes(texto))
    );
  }, [busqueda, registros]);

  const actualizarCampo = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'fecha_nacimiento' ? calcularDatosNacimiento(value) : {}),
    }));
  };

  const asegurarResponsableAlta = (valor) => {
    const responsable = String(valor || '').trim().toUpperCase();
    if (!responsable) return;

    setResponsablesAlta((prev) => (prev.includes(responsable) ? prev : [...prev, responsable]));
  };

  const anadirResponsableAlta = () => {
    const responsable = window.prompt('Nombre de quien da alta');
    const limpio = String(responsable || '').trim().toUpperCase();
    if (!limpio) return;

    setResponsablesAlta((prev) => (prev.includes(limpio) ? prev : [...prev, limpio]));
    actualizarCampo('quien_da_alta', limpio);
  };

  const cancelarFormulario = () => {
    setForm(crearFormVacio());
    setEditandoId(null);
    setMostrarFormulario(false);
  };

  const nuevoRegistro = () => {
    setForm(crearFormVacio());
    setEditandoId(null);
    setMostrarFormulario(true);
  };

  const editarRegistro = (registro) => {
    asegurarResponsableAlta(registro.quien_da_alta);
    setForm(
      CAMPOS.reduce(
        (acc, campo) => ({
          ...acc,
          [campo.key]: campo.type === 'date' ? normalizarFechaInput(registro[campo.key]) : registro[campo.key] || '',
        }),
        {}
      )
    );
    setEditandoId(registro.id);
    setMostrarFormulario(true);
  };

  const eliminarRegistro = async (registro) => {
    if (!window.confirm(`Eliminar el registro de ${nombreCompleto(registro) || 'captacion'}?`)) return;

    if (!firebaseReady) {
      setError('Firebase no esta configurado. Revisa las variables VITE_FIREBASE_*.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'captacion', club, 'registros', registro.id));
      if (editandoId === registro.id) cancelarFormulario();
    } catch (err) {
      setError(`No se pudo eliminar el registro: ${err.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!firebaseReady) {
      setError('Firebase no esta configurado. Revisa las variables VITE_FIREBASE_*.');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      const payload = CAMPOS.reduce(
        (acc, campo) => ({
          ...acc,
          [campo.key]: String(form[campo.key] || '').trim(),
        }),
        { updated_at: serverTimestamp() }
      );

      if (editandoId) {
        await setDoc(doc(db, 'captacion', club, 'registros', editandoId), payload, { merge: true });
      } else {
        await addDoc(captacionRef(club), { ...payload, created_at: serverTimestamp() });
      }

      cancelarFormulario();
    } catch (err) {
      setError(`No se pudo guardar el registro: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50 mb-2">Seguimiento</p>
          <h2 className="text-2xl font-bold text-club-black">Captacion</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Buscar jugador, club, equipo..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="w-full sm:w-72 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
          />
          {!mostrarFormulario && (
            <button
              type="button"
              onClick={nuevoRegistro}
              className="w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-4 py-2 rounded-md transition-colors"
            >
              + Nuevo registro
            </button>
          )}
        </div>
      </div>

      {mostrarFormulario && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-club-black">{editandoId ? 'Editar registro' : 'Nuevo registro'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CAMPOS.map((campo) => (
              <div key={campo.key} className={campo.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-club-black/70 mb-1">{campo.label}</label>
                {campo.type === 'textarea' ? (
                  <textarea
                    value={form[campo.key]}
                    onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  />
                ) : campo.type === 'selectWithAdd' ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={form[campo.key]}
                      onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                    >
                      <option value="">Seleccionar</option>
                      {responsablesAlta.map((responsable) => (
                        <option key={responsable} value={responsable}>
                          {responsable}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={anadirResponsableAlta}
                      className="w-full sm:w-auto whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-club-black hover:bg-gray-50"
                    >
                      Anadir otro
                    </button>
                  </div>
                ) : campo.type === 'select' ? (
                  <select
                    value={form[campo.key]}
                    onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  >
                    <option value="">Seleccionar</option>
                    {campo.options.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {opcion}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={campo.type}
                    required={campo.required}
                    value={form[campo.key]}
                    onChange={(event) => actualizarCampo(campo.key, event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-club-red"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="w-full sm:w-auto bg-club-red hover:bg-club-redDark text-white font-semibold px-5 py-2 rounded-md transition-colors"
            >
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear registro'}
            </button>
            <button
              type="button"
              onClick={cancelarFormulario}
              className="w-full sm:w-auto px-5 py-2 rounded-md font-semibold text-club-black border border-gray-300 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
        <span className="text-2xl font-bold text-club-red tabular-nums">{registrosFiltrados.length}</span>
        <span className="text-sm font-medium text-club-black/70">
          {registrosFiltrados.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-200">
        <table className="min-w-[2600px] divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-club-black text-white sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide sticky left-0 z-20 bg-club-black">
                Acciones
              </th>
              {CAMPOS.map((campo) => (
                <th key={campo.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {campo.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={CAMPOS.length + 1} className="px-4 py-6 text-center text-club-black/60">
                  Cargando registros de captacion...
                </td>
              </tr>
            ) : registrosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={CAMPOS.length + 1} className="px-4 py-6 text-center text-club-black/60">
                  No se han encontrado registros de captacion.
                </td>
              </tr>
            ) : (
              registrosFiltrados.map((registro) => (
                <tr key={registro.id} className="hover:bg-red-50/40 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => editarRegistro(registro)}
                      className="text-club-red font-semibold hover:underline text-sm mr-3"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarRegistro(registro)}
                      className="text-club-black/60 font-semibold hover:underline text-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                  {CAMPOS.map((campo) => (
                    <td
                      key={campo.key}
                      className="px-4 py-3 text-club-black/80 max-w-[220px] truncate"
                      title={registro[campo.key] || ''}
                    >
                      {campo.key === 'enlace' || campo.key === 'foto_jugador' ? (
                        registro[campo.key] ? (
                          <a
                            href={registro[campo.key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-club-red font-semibold hover:underline"
                          >
                            Abrir
                          </a>
                        ) : (
                          '-'
                        )
                      ) : (
                        registro[campo.key] || '-'
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
