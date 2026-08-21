// Posicion aproximada en el campo para cada demarcacion.
const POSICIONES_CAMPO_DEMARCACION = {
  Portero: { x: 50, y: 140 },
  'Lateral Dcho': { x: 80, y: 100 },
  'Lateral Izdo': { x: 20, y: 100 },
  'Central Dcho': { x: 60, y: 115 },
  'Central Izdo': { x: 40, y: 115 },
  Pivote: { x: 50, y: 85 },
  'Media punta': { x: 50, y: 40 },
  'Interior Dcho': { x: 70, y: 60 },
  'Interior Izdo': { x: 30, y: 60 },
  'Extremo Dcho': { x: 85, y: 24 },
  'Extremo Izdo': { x: 15, y: 24 },
  Delantero: { x: 50, y: 12 },
};

export default function CampoFutbolPosicion({ demarcacion }) {
  const posicion = POSICIONES_CAMPO_DEMARCACION[demarcacion];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-2">
      <svg viewBox="0 0 100 150" className="w-full" role="img" aria-label={`Posicion en el campo: ${demarcacion || 'sin asignar'}`}>
        <rect x="0" y="0" width="100" height="150" fill="#3f8a4b" />
        <rect x="2" y="2" width="96" height="146" fill="none" stroke="white" strokeWidth="0.6" />
        <line x1="2" y1="75" x2="98" y2="75" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="75" r="9" fill="none" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="75" r="0.8" fill="white" />
        <rect x="26" y="2" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="38" y="2" width="24" height="8" fill="none" stroke="white" strokeWidth="0.6" />
        <path d="M 38 20 A 9 9 0 0 0 62 20" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="26" y="130" width="48" height="18" fill="none" stroke="white" strokeWidth="0.6" />
        <rect x="38" y="140" width="24" height="8" fill="none" stroke="white" strokeWidth="0.6" />
        <path d="M 38 130 A 9 9 0 0 1 62 130" fill="none" stroke="white" strokeWidth="0.6" />
        {posicion ? <circle cx={posicion.x} cy={posicion.y} r="4.5" fill="#e2001a" stroke="white" strokeWidth="0.8" /> : null}
      </svg>
      <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-club-black/60">
        {demarcacion || 'Sin posición'}
      </p>
    </div>
  );
}
