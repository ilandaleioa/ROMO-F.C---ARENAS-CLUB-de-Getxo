import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usuarioPuedeVerApartado } from '../lib/apartados';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';

const claseBoton = (activo) =>
  `rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
    activo
      ? 'bg-club-red text-white'
      : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
  }`;

// Accesos rápidos del equipo seleccionado: actas, clasificación, gráficas y dashboard.
export function BotonesSeccionesEquipo({ vistaActual = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setVista } = useVistaPlantillas();

  return (
    <div className="flex flex-wrap gap-2" aria-label="Secciones del equipo">
      <button type="button" onClick={() => setVista('actas')} className={claseBoton(vistaActual === 'actas')}>
        Actas
      </button>
      <button type="button" onClick={() => setVista('clasificacion')} className={claseBoton(vistaActual === 'clasificacion')}>
        Clasificación
      </button>
      {usuarioPuedeVerApartado(user, 'graficas') && (
        <button type="button" onClick={() => setVista('graficas_competicion')} className={claseBoton(vistaActual === 'graficas_competicion')}>
          Gráficas competición
        </button>
      )}
      {usuarioPuedeVerApartado(user, 'estadisticas') && (
        <button type="button" onClick={() => setVista('dashboard')} className={claseBoton(vistaActual === 'dashboard')}>
          Dashboard
        </button>
      )}
    </div>
  );
}

const VISTAS_PLANTILLAS = ['tabla', 'tarjetas', 'competicion', 'actas', 'clasificacion', 'graficas_competicion', 'dashboard'];

export default function BotonesVistaPlantillas({ vistaActual = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setVista } = useVistaPlantillas();

  const handleVistaTabla = () => {
    if (VISTAS_PLANTILLAS.includes(vistaActual)) {
      setVista('tabla');
    } else {
      navigate('/plantillas');
      setTimeout(() => setVista('tabla'), 0);
    }
  };

  const handleVistaCompeticion = () => {
    if (VISTAS_PLANTILLAS.includes(vistaActual)) {
      setVista('competicion');
    } else {
      navigate('/plantillas');
      setTimeout(() => setVista('competicion'), 0);
    }
  };

  const handleVistaTarjetas = () => {
    if (VISTAS_PLANTILLAS.includes(vistaActual)) {
      setVista('tarjetas');
    } else {
      navigate('/plantillas');
      setTimeout(() => setVista('tarjetas'), 0);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" aria-label="Vistas de plantillas">
      <button
        type="button"
        onClick={handleVistaTabla}
        className={`rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
          vistaActual === 'tabla'
            ? 'bg-club-red text-white'
            : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
        }`}
      >
        Vista tabla
      </button>
      <button
        type="button"
        onClick={handleVistaTarjetas}
        className={`rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
          vistaActual === 'tarjetas'
            ? 'bg-club-red text-white'
            : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
        }`}
      >
        Vista tarjetas
      </button>
      {usuarioPuedeVerApartado(user, 'campogramas') && (
        <button
          type="button"
          onClick={() => navigate('/campogramas')}
          className={`rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
            vistaActual === 'campogramas'
              ? 'bg-club-red text-white'
              : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
          }`}
        >
          Campogramas
        </button>
      )}
      <button
        type="button"
        onClick={handleVistaCompeticion}
        className={`rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
          vistaActual === 'competicion'
            ? 'bg-club-red text-white'
            : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
        }`}
      >
        Competición
      </button>
      {usuarioPuedeVerApartado(user, 'graficas') && (
        <button
          type="button"
          onClick={() => navigate('/graficas')}
          className={`rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
            vistaActual === 'graficas'
              ? 'bg-club-red text-white'
              : 'border border-gray-300 bg-white text-club-black/80 hover:bg-club-red/10 hover:text-club-black'
          }`}
        >
          GRÁFICAS
        </button>
      )}
    </div>
  );
}
