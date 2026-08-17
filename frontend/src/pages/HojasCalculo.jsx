import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';

const HOJAS = {
  ROMO: {
    nombre: 'ROMO',
    url: 'https://docs.google.com/spreadsheets/d/1lhE-0o1zz5VZ1vkqz-u903sMRGsH8czex4CFDhCLsEg/edit?usp=sharing',
  },
  ARENAS: {
    nombre: 'ARENAS CLUB',
    url: 'https://docs.google.com/spreadsheets/d/11iX5vQCNHG9mDunIHI_wc6-u-kuzEQMFx81l-ne_uv0/edit?usp=sharing',
  },
};

function boolLabel(value) {
  return value ? 'Si' : 'No';
}

function statusColor(value) {
  return value ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800';
}

export default function HojasCalculo() {
  const { club } = useClub();
  const { user } = useAuth();
  const hoja = HOJAS[club] || HOJAS.ROMO;
  const [estado, setEstado] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [errorEstado, setErrorEstado] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');

  const puedeSincronizar = user?.rol === 'administrador' || user?.rol === 'director';

  useEffect(() => {
    let activo = true;

    setCargandoEstado(true);
    setErrorEstado('');

    api
      .get('/config/google-sheets')
      .then(({ clubs }) => {
        if (!activo) return;
        setEstado(clubs?.[club] || null);
      })
      .catch((err) => {
        if (!activo) return;
        setErrorEstado(err.message);
      })
      .finally(() => {
        if (activo) setCargandoEstado(false);
      });

    return () => {
      activo = false;
    };
  }, [club]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setMensajeSync('');
    try {
      const resultado = await api.post('/jugadores/sync');
      const detalles = [];

      detalles.push(`${resultado.insertados || 0} nuevo(s) importado(s)`);
      detalles.push(`${resultado.actualizados || 0} registro(s) actualizados`);

      if (resultado.supabase_ganadores) {
        detalles.push(`${resultado.supabase_ganadores} cambio(s) de la app enviados a la hoja`);
      }
      if (resultado.conflictos) {
        detalles.push(`${resultado.conflictos} conflicto(s) resuelto(s) a favor de la hoja`);
      }
      if (resultado.hoja_actualizados || resultado.hoja_insertados || resultado.hoja_eliminados) {
        detalles.push(
          `Hoja actualizada: ${resultado.hoja_actualizados || 0} fila(s) revisada(s) y ${
            resultado.hoja_insertados || 0
          } fila(s) nuevas` +
            (resultado.hoja_eliminados ? `, ${resultado.hoja_eliminados} fila(s) eliminada(s)` : '')
        );
      }

      setMensajeSync(`Sincronizacion completada: ${detalles.join(', ')}.`);
    } catch (err) {
      setMensajeSync(err.message);
    } finally {
      setSincronizando(false);
    }
  };

  const etiquetaEstado =
    estado?.bidirectional
      ? 'Bidireccional activa'
      : estado?.canWrite
        ? 'Solo escritura'
        : estado?.canRead
          ? 'Solo lectura'
          : 'No configurada';

  const claseEstado = estado?.bidirectional
    ? 'bg-green-100 text-green-800'
    : estado?.canWrite
      ? 'bg-blue-100 text-blue-800'
      : estado?.canRead
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50 mb-2">Hoja activa</p>
        <h1 className="text-2xl font-bold text-club-black">Hojas de calculo</h1>
      </div>

      <div className="grid gap-4">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-club-black mb-1">{hoja.nombre}</h2>
              <p className="text-sm text-club-black/60">
                La sincronizacion entre la web y Google Sheets se realiza desde el backend con control de conflictos.
              </p>
            </div>
            <span className={`inline-flex self-start rounded-full px-3 py-1 text-sm font-semibold ${claseEstado}`}>
              {etiquetaEstado}
            </span>
          </div>

          {hoja.url ? (
            <div className="space-y-3">
              <a
                href={hoja.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full sm:w-auto items-center justify-center px-4 py-2 rounded-md bg-club-red hover:bg-club-redDark text-white font-semibold text-sm transition-colors"
              >
                Abrir hoja de calculo
              </a>
              {club === 'ARENAS' && (
                <p className="text-sm text-club-black/60">
                  Si la sincronizacion de ARENAS no apunta a la pestana correcta, revisa
                  `GOOGLE_SHEETS_GID_ARENAS` en `backend/.env`.
                </p>
              )}
            </div>
          ) : (
            <p className="text-club-black/60 text-sm">
              Todavia no se ha configurado el enlace de la hoja de calculo para {hoja.nombre}.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base font-semibold text-club-black mb-4">Estado de sincronizacion</h3>
          {cargandoEstado ? (
            <p className="text-sm text-club-black/60">Cargando estado...</p>
          ) : errorEstado ? (
            <p className="text-sm text-club-red font-medium">{errorEstado}</p>
          ) : estado ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-club-black/50 mb-1">Spreadsheet</p>
                <p className={`text-sm font-semibold ${statusColor(estado.spreadsheetConfigured)}`}>
                  {boolLabel(estado.spreadsheetConfigured)}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-club-black/50 mb-1">Pestana/GID</p>
                <p className={`text-sm font-semibold ${statusColor(estado.gidConfigured)}`}>
                  {boolLabel(estado.gidConfigured)}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-club-black/50 mb-1">Lectura</p>
                <p className={`text-sm font-semibold ${statusColor(estado.canRead)}`}>{boolLabel(estado.canRead)}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-club-black/50 mb-1">Escritura</p>
                <p className={`text-sm font-semibold ${statusColor(estado.canWrite)}`}>{boolLabel(estado.canWrite)}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-club-black/50 mb-1">Service account</p>
                <p className={`text-sm font-semibold ${statusColor(estado.serviceAccountConfigured)}`}>
                  {boolLabel(estado.serviceAccountConfigured)}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-club-black/50 mb-1">Bidireccional</p>
                <p className={`text-sm font-semibold ${statusColor(estado.bidirectional)}`}>
                  {boolLabel(estado.bidirectional)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-club-black/60">No hay datos de configuracion para este club.</p>
          )}

          {puedeSincronizar && (
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={handleSincronizar}
                disabled={sincronizando}
                className="inline-flex w-full sm:w-auto items-center justify-center px-4 py-2 rounded-md bg-club-black hover:bg-black disabled:opacity-60 text-white font-semibold text-sm transition-colors"
              >
                {sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
              <p className="text-sm text-club-black/60">
                Importa nuevas filas de la hoja, actualiza los registros enlazados y devuelve a Google Sheets los
                cambios hechos en la web.
              </p>
            </div>
          )}

          {mensajeSync && (
            <p className="mt-4 text-sm text-club-black bg-gray-100 border border-gray-200 rounded-md px-3 py-2">
              {mensajeSync}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
