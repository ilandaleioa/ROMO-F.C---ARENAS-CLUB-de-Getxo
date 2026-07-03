import { useEffect, useState, useCallback } from 'react';
import { useClub } from '../context/ClubContext';
import { api } from '../lib/api';

const COLORES_CIRCULAR = [
  '#2a78d6', // azul
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
  '#e87ba4', // magenta
  '#eb6834', // naranja
];

const TOP_MUNICIPIOS_CIRCULAR = 7;

// El Form ha usado a lo largo del tiempo tanto opcion multiple
// ("Getxo (Algorta, Romo, Las Arenas..)") como texto libre ("Berango") para
// "Localidad". Se normaliza para que no aparezcan como municipios distintos.
function normalizarLocalidad(valor) {
  let v = valor.trim();
  v = v.replace(/\(.*$/, '').trim();
  v = v.replace(/[.,]+$/, '').trim();
  v = v.replace(/\s+/g, ' ');
  v = v.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return v;
}

function polarToCartesian(cx, cy, radio, anguloGrados) {
  const anguloRad = ((anguloGrados - 90) * Math.PI) / 180;
  return { x: cx + radio * Math.cos(anguloRad), y: cy + radio * Math.sin(anguloRad) };
}

function arcoSvg(cx, cy, radio, anguloInicio, anguloFin) {
  const inicio = polarToCartesian(cx, cy, radio, anguloFin);
  const fin = polarToCartesian(cx, cy, radio, anguloInicio);
  const arcoGrande = anguloFin - anguloInicio > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${inicio.x} ${inicio.y} A ${radio} ${radio} 0 ${arcoGrande} 0 ${fin.x} ${fin.y} Z`;
}

export default function Municipios() {
  const { club } = useClub();
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [municipioExpandido, setMunicipioExpandido] = useState(null);

  const cargarJugadores = useCallback(async () => {
    setError('');
    try {
      const { jugadores } = await api.get('/jugadores');
      setJugadores(jugadores);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    cargarJugadores().finally(() => setLoading(false));
  }, [cargarJugadores, club]);

  const conLocalidad = jugadores.filter((j) => j.localidad && j.localidad.trim() !== '');

  const conteoPorMunicipio = conLocalidad.reduce((acc, j) => {
    const municipio = normalizarLocalidad(j.localidad);
    (acc[municipio] ||= []).push(j);
    return acc;
  }, {});

  const filas = Object.entries(conteoPorMunicipio)
    .map(([municipio, lista]) => ({ municipio, total: lista.length, jugadores: lista }))
    .sort((a, b) => b.total - a.total || a.municipio.localeCompare(b.municipio));

  const maxTotal = filas.reduce((max, f) => Math.max(max, f.total), 0);
  const totalGeneral = filas.reduce((sum, f) => sum + f.total, 0);

  const filasCircular =
    filas.length <= TOP_MUNICIPIOS_CIRCULAR
      ? filas
      : [
          ...filas.slice(0, TOP_MUNICIPIOS_CIRCULAR),
          {
            municipio: 'Otros',
            total: filas.slice(TOP_MUNICIPIOS_CIRCULAR).reduce((sum, f) => sum + f.total, 0),
          },
        ];

  let anguloAcumulado = 0;
  const sectores = filasCircular.map((f, i) => {
    const porcentaje = totalGeneral > 0 ? (f.total / totalGeneral) * 100 : 0;
    const anguloInicio = anguloAcumulado;
    const anguloFin = anguloAcumulado + (porcentaje / 100) * 360;
    anguloAcumulado = anguloFin;
    const anguloMedio = (anguloInicio + anguloFin) / 2;
    const puntoEtiqueta = polarToCartesian(100, 100, 65, anguloMedio);
    return {
      ...f,
      porcentaje,
      color: COLORES_CIRCULAR[i % COLORES_CIRCULAR.length],
      path: arcoSvg(100, 100, 100, anguloInicio, anguloFin),
      etiquetaX: puntoEtiqueta.x,
      etiquetaY: puntoEtiqueta.y,
    };
  });

  const toggleMunicipio = (municipio) => {
    setMunicipioExpandido((actual) => (actual === municipio ? null : municipio));
  };

  const renderTablaEmbebida = (f) => (
    <div className="mt-2 mb-1 overflow-x-auto rounded-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-club-black/70">Nombre</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-club-black/70">Equipo</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-club-black/70">Municipio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {f.jugadores.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-2 text-club-black">
                {`${j.nombre} ${j.primer_apellido} ${j.segundo_apellido || ''}`.trim()}
              </td>
              <td className="px-4 py-2 text-club-black/80">{j.equipo || '-'}</td>
              <td className="px-4 py-2 text-club-black/80">{f.municipio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderGraficaCircular = () => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-club-black/70 mb-4">
        Distribución por municipio
      </h3>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-44 h-44 sm:w-56 sm:h-56 shrink-0" role="img" aria-label="Gráfica circular de jugadores por municipio">
          {sectores.map((s) => (
            <path key={s.municipio} d={s.path} fill={s.color} stroke="#fcfcfb" strokeWidth="2" />
          ))}
          {sectores
            .filter((s) => s.porcentaje >= 8)
            .map((s) => (
              <text
                key={`etq-${s.municipio}`}
                x={s.etiquetaX}
                y={s.etiquetaY}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="600"
              >
                <tspan x={s.etiquetaX} dy="-2">{`${Math.round(s.porcentaje)}%`}</tspan>
                <tspan x={s.etiquetaX} dy="12">{`(${s.total})`}</tspan>
              </text>
            ))}
        </svg>
        <ul className="w-full max-w-full md:max-w-xs flex flex-col gap-1.5">
          {sectores.map((s) => (
            <li key={s.municipio} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span className="text-club-black flex-1 truncate" title={s.municipio}>
                {s.municipio}
              </span>
              <span className="text-club-black/70 tabular-nums">{s.total}</span>
              <span className="text-club-black/50 tabular-nums w-14 text-right">
                {s.porcentaje.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const renderGrafica = () => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        {filas.map((f) => {
          const anchoPct = maxTotal > 0 ? (f.total / maxTotal) * 100 : 0;
          const expandido = municipioExpandido === f.municipio;
          return (
            <div key={f.municipio}>
              <button
                type="button"
                onClick={() => toggleMunicipio(f.municipio)}
                className={`w-full flex items-center gap-3 py-1.5 rounded-md transition-colors ${
                  expandido ? 'bg-red-50/60' : 'hover:bg-gray-50'
                }`}
                aria-expanded={expandido}
              >
                <span className="w-full flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-sm font-medium text-club-black text-left leading-tight"
                      title={f.municipio}
                    >
                      {f.municipio}
                    </span>
                    <span className="text-sm font-semibold text-club-black shrink-0">{f.total}</span>
                  </span>
                  <span className="block w-full h-5 rounded-sm bg-gray-100 overflow-hidden">
                    <span
                      className="block h-full rounded-sm bg-club-red transition-all"
                      style={{ width: `${anchoPct}%` }}
                    />
                  </span>
                </span>
              </button>
              {expandido && renderTablaEmbebida(f)}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-club-black">Municipios</h2>
      </div>

      {error && (
        <p className="text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-club-black/60">Cargando datos...</p>
      ) : error ? null : filas.length === 0 ? (
        <p className="text-club-black/60">No hay datos de localidad disponibles.</p>
      ) : (
        <>
          {renderGraficaCircular()}
          {renderGrafica()}
        </>
      )}
    </div>
  );
}
