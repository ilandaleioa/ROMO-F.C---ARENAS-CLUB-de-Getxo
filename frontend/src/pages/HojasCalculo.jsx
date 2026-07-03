import { useState } from 'react';

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
  const [equipo, setEquipo] = useState('ROMO');
  const hoja = HOJAS[equipo];

  const tabClass = (key) =>
    `px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
      equipo === key ? 'bg-club-red text-white' : 'bg-white text-club-black/70 hover:bg-red-50'
    }`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-club-black mb-6">Hojas de calculo</h1>

      <div className="flex gap-2 mb-6">
        <button type="button" className={tabClass('ROMO')} onClick={() => setEquipo('ROMO')}>
          ROMO
        </button>
        <button type="button" className={tabClass('ARENAS')} onClick={() => setEquipo('ARENAS')}>
          ARENAS CLUB
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-club-black mb-3">{hoja.nombre}</h2>
        {hoja.url ? (
          <a
            href={hoja.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-md bg-club-red hover:bg-club-redDark text-white font-semibold text-sm transition-colors"
          >
            Abrir hoja de calculo
          </a>
        ) : (
          <p className="text-club-black/60 text-sm">
            Todavia no se ha configurado el enlace de la hoja de calculo para {hoja.nombre}.
          </p>
        )}
      </div>
    </div>
  );
}
