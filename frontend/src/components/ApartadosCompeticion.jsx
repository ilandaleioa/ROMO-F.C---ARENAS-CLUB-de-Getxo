import { useEffect, useState } from 'react';

export const APARTADOS_COMPETICION = [
  { key: 'clasificacion', label: 'Clasificación', urlKey: 'url' },
  { key: 'actas', label: 'Actas', urlKey: 'url_actas' },
  { key: 'resultados', label: 'Resultados', urlKey: 'url_resultados' },
  { key: 'calendario', label: 'Calendario', urlKey: 'url_calendario' },
  { key: 'tabla_cruzada', label: 'Tabla cruzada', urlKey: 'url_tabla_cruzada' },
  { key: 'goleadores', label: 'Goleadores', urlKey: 'url_goleadores' },
  { key: 'porteros', label: 'Porteros', urlKey: 'url_porteros' },
  { key: 'estadisticas', label: 'Estadísticas', urlKey: 'url_estadisticas' },
];

function texto(valor) {
  return String(valor ?? '').trim();
}

function EnlaceExterno({ apartado, url }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-red text-white shadow">
          <span aria-hidden="true" className="text-lg">◷</span>
        </div>
        <div>
          <p className="text-sm font-black text-slate-800">{apartado.label} oficial</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-400">Consulta el dato en la web de la federación.</p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-club-red px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow hover:bg-club-redDark"
      >
        Abrir en nueva pestaña ↗
      </a>
    </div>
  );
}

export default function ApartadosCompeticion({ competicion }) {
  const apartadosDisponibles = APARTADOS_COMPETICION.filter((apartado) => texto(competicion[apartado.urlKey]));
  const [activo, setActivo] = useState(apartadosDisponibles[0]?.key || null);

  useEffect(() => {
    setActivo(apartadosDisponibles[0]?.key || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competicion.id]);

  if (apartadosDisponibles.length === 0) {
    return (
      <p className="mt-4 text-sm font-medium text-slate-400">
        Esta competición todavía no tiene enlaces federativos configurados.
      </p>
    );
  }

  const apartado = apartadosDisponibles.find((item) => item.key === activo) || apartadosDisponibles[0];

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {apartadosDisponibles.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActivo(item.key)}
            className={`rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-wide transition ${
              item.key === apartado.key
                ? 'bg-club-red text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <EnlaceExterno apartado={apartado} url={texto(competicion[apartado.urlKey])} />
    </div>
  );
}
