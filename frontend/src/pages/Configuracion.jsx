import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { APARTADOS_APP, usuarioPuedeVerItem } from '../lib/apartados';
import MisEquipos from './MisEquipos';
import Usuarios from './Usuarios';
import Listas from './Listas';
import ClubesMaestros from './ClubesMaestros';
import HojasCalculo from './HojasCalculo';
import Competiciones from './Competiciones';

const SECCIONES = [
  {
    key: 'equipos',
    label: 'Mis equipos',
    descripcion: 'Consulta el catalogo maestro de equipos internos.',
    componente: MisEquipos,
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    descripcion: 'Gestiona cuentas, roles y accesos.',
    componente: Usuarios,
  },
  {
    key: 'listas',
    label: 'Listas',
    descripcion: 'Edita las listas maestras que alimentan la app.',
    componente: Listas,
  },
  {
    key: 'clubes_maestros',
    label: 'Clubes',
    descripcion: 'Gestiona los clubes disponibles y sus equipos asociados.',
    componente: ClubesMaestros,
  },
  {
    key: 'hojas_calculo',
    label: 'Hojas de calculo',
    descripcion: 'Consulta el estado de sincronizacion con Sheets.',
    componente: HojasCalculo,
  },
  {
    key: 'competiciones',
    label: 'Competiciones',
    descripcion: 'Administra las competiciones y su informacion tecnica.',
    componente: Competiciones,
  },
];

export default function Configuracion() {
  const { user } = useAuth();
  const seccionesVisibles = useMemo(
    () => SECCIONES.filter((item) => {
      const apartado = APARTADOS_APP.find((entry) => entry.key === item.key);
      return apartado ? usuarioPuedeVerItem(user, apartado) : false;
    }),
    [user]
  );
  const [seccionActiva, setSeccionActiva] = useState('equipos');

  const seccionActual =
    seccionesVisibles.find((item) => item.key === seccionActiva) || seccionesVisibles[0] || null;
  const SeccionComponente = seccionActual?.componente || null;

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-club-black/50">Configuracion</p>
        <h1 className="text-3xl font-black uppercase tracking-[-0.04em] text-club-black sm:text-4xl">
          Configuracion
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-club-black/60">
          Entra en cada apartado desde estos botones sin salir de la pantalla.
        </p>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {seccionesVisibles.map((seccion) => {
          const activa = seccion.key === seccionActual?.key;

          return (
            <button
              key={seccion.key}
              type="button"
              onClick={() => setSeccionActiva(seccion.key)}
              className={`group min-h-24 rounded-2xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                activa
                  ? 'border-club-red bg-club-red text-white'
                  : 'border-gray-200 bg-white text-club-black hover:border-club-red/30 hover:bg-red-50/40'
              }`}
              aria-pressed={activa}
            >
              <p
                className={`text-xs font-black uppercase tracking-[0.18em] ${
                  activa ? 'text-white/75' : 'text-club-black/40'
                }`}
              >
                Acceso interno
              </p>
              <h2 className="mt-2 text-base font-black uppercase tracking-[-0.03em]">{seccion.label}</h2>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-gray-200 bg-white shadow-sm">
        {seccionActual?.key !== 'clubes_maestros' && (
          <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-club-black/40">Seccion activa</p>
              <h2 className="mt-1 text-xl font-black uppercase tracking-[-0.03em] text-club-black">
                {seccionActual?.label || 'Sin seccion'}
              </h2>
            </div>
            <p className="text-sm text-club-black/60">
              {seccionActual?.descripcion || 'No hay contenido disponible para este apartado.'}
            </p>
          </div>
        )}

        <div className="bg-slate-50/40">
          {SeccionComponente ? (
            <SeccionComponente />
          ) : (
            <div className="px-5 py-10 text-sm text-club-black/60 sm:px-6">
              No hay secciones visibles para tu usuario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
