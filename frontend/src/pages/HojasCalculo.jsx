import { useClub } from '../context/ClubContext';

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

export default function HojasCalculo() {
  const { club } = useClub();
  const hoja = HOJAS[club] || HOJAS.ROMO;
  const faltaGid = club === 'ARENAS';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-club-black/50 mb-2">
          Hoja activa
        </p>
        <h1 className="text-2xl font-bold text-club-black">Hojas de calculo</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-club-black mb-3">{hoja.nombre}</h2>
        {hoja.url ? (
          <div className="space-y-3">
            <a
              href={hoja.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-md bg-club-red hover:bg-club-redDark text-white font-semibold text-sm transition-colors"
            >
              Abrir hoja de calculo
            </a>
            {faltaGid && (
              <p className="text-sm text-club-black/60">
                Si la sincronizacion de ARENAS no apunta a la pestaña correcta, revisa que
                `GOOGLE_SHEETS_GID_ARENAS` este rellenado en `backend/.env`.
              </p>
            )}
          </div>
        ) : (
          <p className="text-club-black/60 text-sm">
            Todavia no se ha configurado el enlace de la hoja de calculo para {hoja.nombre}.
          </p>
        )}
      </div>
    </div>
  );
}
