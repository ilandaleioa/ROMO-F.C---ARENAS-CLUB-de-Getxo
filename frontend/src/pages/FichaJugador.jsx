import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ETIQUETAS_JUGADOR, SECCIONES_FICHA } from '../lib/campos';

const ROLES_QUE_PUEDEN_SUBIR_FOTO = ['administrador', 'responsable', 'tecnico'];

function formatearValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (typeof valor === 'boolean') return valor ? 'Si' : 'No';
  return String(valor);
}

export default function FichaJugador() {
  const { id } = useParams();
  const { user } = useAuth();
  const [jugador, setJugador] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');

  const puedeSubirFoto = user && ROLES_QUE_PUEDEN_SUBIR_FOTO.includes(user.rol);

  async function handleFotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSubiendoFoto(true);
    setErrorFoto('');
    try {
      const formData = new FormData();
      formData.append('foto', file);
      const { foto_url } = await api.postFile(`/jugadores/${id}/foto`, formData);
      setJugador((prev) => (prev ? { ...prev, foto_url } : prev));
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setSubiendoFoto(false);
    }
  }

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError('');
    api
      .get(`/jugadores/${id}`)
      .then(({ jugador }) => {
        if (activo) setJugador(jugador);
      })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [id]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link to="/plantillas" className="text-club-red font-semibold hover:underline text-sm">
        &larr; Volver a plantillas
      </Link>

      {loading && <p className="mt-6 text-club-black/60">Cargando ficha...</p>}

      {error && (
        <p className="mt-6 text-sm text-club-red font-medium bg-red-50 border border-club-red/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {jugador && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-club-black text-white px-6 py-4 flex items-center gap-4">
            {jugador.foto_url ? (
              <img
                src={jugador.foto_url}
                alt={`Foto de ${jugador.nombre}`}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/30 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40 shrink-0 text-center">
                Sin foto
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">
                {jugador.nombre} {jugador.primer_apellido} {jugador.segundo_apellido || ''}
              </h2>
              <p className="text-white/60 text-sm">Equipo: {jugador.equipo}</p>
            </div>
          </div>

          {puedeSubirFoto && (
            <div className="px-6 pt-4">
              <label className="inline-block text-sm font-medium text-club-red cursor-pointer hover:underline">
                {subiendoFoto ? 'Subiendo foto...' : 'Cambiar foto'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFotoChange}
                  disabled={subiendoFoto}
                />
              </label>
              {errorFoto && <p className="text-sm text-club-red mt-1">{errorFoto}</p>}
            </div>
          )}

          <div className="p-6 space-y-6">
            {SECCIONES_FICHA.map((seccion) => {
              const camposDisponibles = seccion.campos.filter((c) => c in jugador);
              if (camposDisponibles.length === 0) return null;
              return (
                <div key={seccion.titulo}>
                  <h3 className="text-club-red font-bold text-sm uppercase tracking-wide mb-2">
                    {seccion.titulo}
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {camposDisponibles.map((campo) => (
                      <div key={campo}>
                        <dt className="text-xs text-club-black/50 font-semibold">
                          {ETIQUETAS_JUGADOR[campo] || campo}
                        </dt>
                        <dd className="text-club-black">{formatearValor(jugador[campo])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
