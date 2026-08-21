import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usuarioPuedeVerApartado } from '../lib/apartados';
import { useVistaPlantillas } from '../context/VistaPlantillasContext';

export default function BotonesVistaPlantillas({ vistaActual = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setVista } = useVistaPlantillas();

  const handleVistaTabla = () => {
    if (vistaActual === 'tabla' || vistaActual === 'tarjetas') {
      setVista('tabla');
    } else {
      navigate('/plantillas');
      setTimeout(() => setVista('tabla'), 0);
    }
  };

  const handleVistaTarjetas = () => {
    if (vistaActual === 'tabla' || vistaActual === 'tarjetas') {
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
