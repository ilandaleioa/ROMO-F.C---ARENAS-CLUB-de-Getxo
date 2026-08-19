import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useClub } from '../context/ClubContext';

const FORM_VACIO = {
  nombre: '',
  tipo: 'liga',
  partes: '2',
  minutos_por_parte: '45',
  equipo_interno: '',
  equipos_anadidos: '0',
  equipo_fed: '',
  etapa: '',
  categoria: '',
  url: '',
};

const CAMPOS_FEDERATIVOS = [
  { key: 'equipo_fed', label: 'Equipo Fed' },
  { key: 'etapa', label: 'Etapa' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'url', label: 'URL', type: 'url' },
];

function texto(valor) {
  return String(valor ?? '').trim();
}

function numero(valor, fallback = 0) {
  const resultado = Number.parseInt(valor, 10);
  return Number.isFinite(resultado) ? resultado : fallback;
}

function nombreClub(club) {
  return club === 'ARENAS' ? 'ARENAS CLUB' : 'ROMO FC';
}

function formDesdeFila(fila) {
  return {
    nombre: texto(fila.nombre || fila.equipo_fed || fila.equipo_interno),
    tipo: texto(fila.tipo).toLowerCase() || 'liga',
    partes: String(fila.partes ?? 2),
    minutos_por_parte: String(fila.minutos_por_parte ?? 45),
    equipo_interno: texto(fila.equipo_interno),
    equipos_anadidos: String(fila.equipos_anadidos ?? 0),
    equipo_fed: texto(fila.equipo_fed),
    etapa: texto(fila.etapa),
    categoria: texto(fila.categoria),
    url: texto(fila.url),
  };
}

function Icono({ tipo }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-4 w-4',
    'aria-hidden': 'true',
  };

  if (tipo === 'equipos') {
    return <svg {...props}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 18c.4-3 2.2-4.5 5.5-4.5s5.1 1.5 5.5 4.5" /><path d="M14.5 14.3c2.9-.7 5.2.7 5.7 3.7" /></svg>;
  }
  if (tipo === 'calendario') {
    return <svg {...props}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3.5v3M16 3.5v3M3.5 9h17M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" /></svg>;
  }
  if (tipo === 'editar') {
    return <svg {...props}><path d="M4 20h4l10.8-10.8a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 2 2" /></svg>;
  }
  return <svg {...props}><path d="M5 7h14M10 11v5M14 11v5M6.5 7l.7 13h9.6l.7-13M9 7V4h6v3" /></svg>;
}

function BotonAccion({ tipo, etiqueta, onClick, disabled = false, peligro = false }) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        peligro ? 'hover:bg-red-50 hover:text-club-red' : 'hover:bg-slate-200 hover:text-slate-800'
      }`}
    >
      <Icono tipo={tipo} />
    </button>
  );
}

export default function Competiciones() {
  const { club } = useClub();
  const [competiciones, setCompeticiones] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const totalMinutos = numero(form.partes) * numero(form.minutos_por_parte);

  const cargarCompeticiones = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const respuesta = await api.get('/competiciones');
      setCompeticiones(respuesta.competiciones || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarEquipos = useCallback(async () => {
    try {
      const respuesta = await api.get('/competiciones/equipos');
      setEquipos(respuesta.equipos || []);
    } catch (_) {
      setEquipos([]);
    }
  }, []);

  useEffect(() => {
    setMostrarFormulario(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormError('');
    cargarCompeticiones();
    cargarEquipos();
  }, [club, cargarCompeticiones, cargarEquipos]);

  const cambiarCampo = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setFormError('');
  };

  const abrirCrear = () => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, equipo_interno: equipos[0] || '' });
    setFormError('');
    setMostrarFormulario(true);
  };

  const abrirEditar = (competicion) => {
    setEditandoId(competicion.id);
    setForm(formDesdeFila(competicion));
    setFormError('');
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelar = () => {
    setMostrarFormulario(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormError('');
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setFormError('');
    const partes = numero(form.partes);
    const minutosPorParte = numero(form.minutos_por_parte);
    if (!texto(form.nombre) || !texto(form.tipo) || partes < 1 || minutosPorParte < 1) {
      setFormError('Completa los campos obligatorios con valores válidos.');
      return;
    }

    const datos = {
      nombre: texto(form.nombre),
      tipo: texto(form.tipo).toLowerCase(),
      partes,
      minutos_por_parte: minutosPorParte,
      total_minutos: partes * minutosPorParte,
      equipo_interno: texto(form.equipo_interno),
      equipos_anadidos: Math.max(0, numero(form.equipos_anadidos)),
      ...Object.fromEntries(CAMPOS_FEDERATIVOS.map((campo) => [campo.key, texto(form[campo.key])])),
    };

    setGuardando(true);
    try {
      const respuesta = editandoId
        ? await api.put(`/competiciones/${editandoId}`, datos)
        : await api.post('/competiciones', datos);
      const competicion = respuesta.competicion;
      setCompeticiones((actuales) => {
        const siguientes = editandoId
          ? actuales.map((fila) => (fila.id === editandoId ? competicion : fila))
          : [...actuales, competicion];
        return siguientes.sort((a, b) => texto(a.nombre).localeCompare(texto(b.nombre), 'es'));
      });
      cancelar();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (competicion) => {
    if (!window.confirm(`¿Quieres borrar la competición "${competicion.nombre}"?`)) return;
    setError('');
    try {
      await api.delete(`/competiciones/${competicion.id}`);
      setCompeticiones((actuales) => actuales.filter((fila) => fila.id !== competicion.id));
      if (editandoId === competicion.id) cancelar();
    } catch (err) {
      setError(err.message);
    }
  };

  const equiposParaSelector = equipos.length > 0 ? equipos : ['Sin equipos disponibles'];

  return (
    <div className="min-h-full bg-white px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-[-0.05em] text-slate-950 sm:text-5xl">Competiciones</h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{nombreClub(club)}</p>
          </div>
          <button type="button" onClick={mostrarFormulario ? cancelar : abrirCrear} className="inline-flex items-center justify-center gap-3 rounded-full bg-club-red px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-club-red/20 transition hover:bg-club-redDark">
            <span className="text-2xl font-light leading-none">+</span>
            {mostrarFormulario ? 'Cancelar' : 'Nueva competición'}
          </button>
        </header>

        {error ? <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-club-red">{error}</p> : null}

        {mostrarFormulario && (
          <form onSubmit={guardar} className="mb-10 rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-10">
            <div className="mb-8 flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-3xl font-black uppercase tracking-[-0.04em] text-slate-950">{editandoId ? 'Editar competición' : 'Nueva competición'}</h2>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={cancelar} className="rounded-2xl border border-slate-200 bg-white px-7 py-3 text-sm font-black uppercase tracking-wide text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={guardando} className="rounded-2xl bg-club-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-club-red/20 hover:bg-club-redDark disabled:opacity-60">{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>

            {formError ? <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-club-red">{formError}</p> : null}
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
              <label className="text-sm font-black uppercase tracking-wide text-slate-600">Nombre de la competición *<input value={form.nombre} onChange={(evento) => cambiarCampo('nombre', evento.target.value)} required className="mt-2 h-16 w-full rounded-2xl border border-slate-200 bg-white px-6 text-lg font-normal normal-case tracking-normal text-slate-800 shadow-sm focus:border-club-red focus:outline-none focus:ring-2 focus:ring-club-red/20" /></label>
              <label className="text-sm font-black uppercase tracking-wide text-slate-600">Tipo *<select value={form.tipo} onChange={(evento) => cambiarCampo('tipo', evento.target.value)} required className="mt-2 h-16 w-full rounded-2xl border border-slate-200 bg-white px-6 text-lg font-normal normal-case tracking-normal text-slate-800 shadow-sm focus:border-club-red focus:outline-none focus:ring-2 focus:ring-club-red/20"><option value="liga">Liga</option><option value="amistoso">Amistoso</option></select></label>
              <label className="text-sm font-black uppercase tracking-wide text-slate-600">Número de partes *<input type="number" min="1" value={form.partes} onChange={(evento) => cambiarCampo('partes', evento.target.value)} required className="mt-2 h-16 w-full rounded-2xl border border-slate-200 bg-white px-6 text-lg font-normal normal-case tracking-normal text-slate-800 shadow-sm focus:border-club-red focus:outline-none focus:ring-2 focus:ring-club-red/20" /></label>
              <label className="text-sm font-black uppercase tracking-wide text-slate-600">Equipo interno<select value={form.equipo_interno} onChange={(evento) => cambiarCampo('equipo_interno', evento.target.value)} className="mt-2 h-16 w-full rounded-2xl border border-slate-200 bg-white px-6 text-lg font-normal normal-case tracking-normal text-slate-800 shadow-sm focus:border-club-red focus:outline-none focus:ring-2 focus:ring-club-red/20"><option value="">-- Seleccionar equipo --</option>{equiposParaSelector.map((equipo) => <option key={equipo} value={equipo} disabled={equipo === 'Sin equipos disponibles'}>{equipo}</option>)}</select></label>
              <label className="text-sm font-black uppercase tracking-wide text-slate-600">Minutos por parte *<input type="number" min="1" value={form.minutos_por_parte} onChange={(evento) => cambiarCampo('minutos_por_parte', evento.target.value)} required className="mt-2 h-16 w-full rounded-2xl border border-slate-200 bg-white px-6 text-lg font-normal normal-case tracking-normal text-slate-800 shadow-sm focus:border-club-red focus:outline-none focus:ring-2 focus:ring-club-red/20" /></label>
              <div className="text-sm font-black uppercase tracking-wide text-slate-600">Total de minutos<div className="mt-2 flex h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 text-xl font-black normal-case tracking-normal text-club-red shadow-sm"><span aria-hidden="true">◷</span> {totalMinutos > 0 ? `${totalMinutos} min` : '—'}</div></div>
            </div>

            <details className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-4"><summary className="cursor-pointer text-sm font-black uppercase tracking-wide text-slate-600">Datos federativos y enlace</summary><div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">{CAMPOS_FEDERATIVOS.map((campo) => <label key={campo.key} className="text-sm font-black uppercase tracking-wide text-slate-600">{campo.label}<input type={campo.type || 'text'} value={form[campo.key]} onChange={(evento) => cambiarCampo(campo.key, evento.target.value)} placeholder={campo.type === 'url' ? 'https://...' : ''} className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-normal normal-case tracking-normal text-slate-800 focus:border-club-red focus:outline-none focus:ring-2 focus:ring-club-red/20" /></label>)}</div></details>
          </form>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50/90"><tr><th className="w-[29%] px-10 py-7 text-xs font-black uppercase tracking-wider text-slate-400">Competición</th><th className="px-5 py-7 text-xs font-black uppercase tracking-wider text-slate-400">Tipo</th><th className="px-5 py-7 text-xs font-black uppercase tracking-wider text-slate-400">Partes</th><th className="px-5 py-7 text-xs font-black uppercase tracking-wider text-slate-400">Min/parte</th><th className="px-5 py-7 text-xs font-black uppercase tracking-wider text-slate-400">Total minutos</th><th className="px-5 py-7 text-xs font-black uppercase tracking-wider text-slate-400">Equipos añadidos</th><th className="px-8 py-7 text-right text-xs font-black uppercase tracking-wider text-slate-400">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {cargando ? <tr><td colSpan="7" className="px-6 py-16 text-center text-sm font-semibold text-slate-400">Cargando competiciones...</td></tr> : competiciones.length === 0 ? <tr><td colSpan="7" className="px-6 py-16 text-center text-sm font-semibold text-slate-400">Todavía no hay competiciones creadas.</td></tr> : competiciones.map((competicion) => (
                  <tr key={competicion.id} className="h-32 transition-colors hover:bg-slate-50/80"><td className="px-10 py-6 text-lg font-bold text-slate-800">{competicion.nombre || competicion.equipo_fed || competicion.equipo_interno || 'Sin nombre'}</td><td className="px-5 py-6"><span className="inline-flex min-w-[108px] justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-black uppercase text-slate-600">{texto(competicion.tipo || 'liga')}</span></td><td className="px-5 py-6"><span className="inline-flex h-11 min-w-[54px] items-center justify-center rounded-full bg-club-red/10 px-4 text-xl font-black text-club-red">{competicion.partes ?? 2}</span></td><td className="px-5 py-6 text-xl font-black text-slate-800">{competicion.minutos_por_parte ?? 0}'</td><td className="px-5 py-6"><span className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-base font-black text-emerald-600"><span aria-hidden="true">◷</span> {competicion.total_minutos ?? 0} min</span></td><td className="px-5 py-6"><span className="inline-flex min-w-[108px] items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2.5 text-base font-black text-club-red"><Icono tipo="equipos" /> {competicion.equipos_anadidos ?? 0}</span></td><td className="px-8 py-6"><div className="flex justify-end gap-3"><BotonAccion tipo="equipos" etiqueta="Gestionar equipos" disabled /><BotonAccion tipo="calendario" etiqueta="Ver calendario" disabled /><BotonAccion tipo="editar" etiqueta="Editar competición" onClick={() => abrirEditar(competicion)} /><BotonAccion tipo="borrar" etiqueta="Borrar competición" peligro onClick={() => borrar(competicion)} /></div></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
