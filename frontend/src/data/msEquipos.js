const EQUIPOS_MS = [
  { club: 'ROMO', nombre: 'JUVENIL', abreviatura: 'RJ', orden: 1 },
  { club: 'ROMO', nombre: 'ITZU JUVENIL', abreviatura: 'IJ', orden: 2 },
  { club: 'ROMO', nombre: 'CADETE', abreviatura: 'RC', orden: 3 },
  { club: 'ROMO', nombre: 'ITZU CADETE', abreviatura: 'IC', orden: 4 },
  { club: 'ROMO', nombre: 'INFANTIL 2013', abreviatura: 'R13', orden: 5 },
  { club: 'ROMO', nombre: 'INFANTIL 2014', abreviatura: 'R14', orden: 6 },
  { club: 'ROMO', nombre: 'ALEVÍN 2015 Gobela', abreviatura: 'R15G', orden: 7 },
  { club: 'ROMO', nombre: 'ALEVÍN 2015 Ibaiondo', abreviatura: 'R15I', orden: 8 },
  { club: 'ROMO', nombre: 'ALEVÍN 2016', abreviatura: 'R16', orden: 9 },
  { club: 'ROMO', nombre: 'BENJAMÍN 2017 Gobela', abreviatura: 'R17G', orden: 10 },
  { club: 'ROMO', nombre: 'BENJAMÍN 2017 Ibaiondo', abreviatura: 'R17I', orden: 11 },
  { club: 'ROMO', nombre: 'BENJAMÍN 2018', abreviatura: 'R18', orden: 12 },
  { club: 'ROMO', nombre: 'PREBENJAMÍN 2019', abreviatura: 'R19', orden: 13 },
  { club: 'ROMO', nombre: 'PREBENJAMÍN 2020', abreviatura: 'R20', orden: 14 },
  { club: 'ARENAS', nombre: 'Juvenil A', abreviatura: 'AJA', orden: 1 },
  { club: 'ARENAS', nombre: 'Juvenil B', abreviatura: 'AJB', orden: 2 },
  { club: 'ARENAS', nombre: 'Cadete A', abreviatura: 'ACA', orden: 3 },
  { club: 'ARENAS', nombre: 'Cadete B', abreviatura: 'ACB', orden: 4 },
  { club: 'ARENAS', nombre: 'Infantil 13', abreviatura: 'A13', orden: 5 },
  { club: 'ARENAS', nombre: 'Infantil 14', abreviatura: 'A14', orden: 6 },
  { club: 'ARENAS', nombre: 'Alevín 15A', abreviatura: 'A15A', orden: 7 },
  { club: 'ARENAS', nombre: 'Alevín 15B', abreviatura: 'A15B', orden: 8 },
  { club: 'ARENAS', nombre: 'Alevín 16A', abreviatura: 'A16A', orden: 9 },
  { club: 'ARENAS', nombre: 'Alevín 16B', abreviatura: 'A16B', orden: 10 },
  { club: 'ARENAS', nombre: 'Benjamín 17', abreviatura: 'A17', orden: 11 },
  { club: 'ARENAS', nombre: 'Benjamín 18', abreviatura: 'A18', orden: 12 },
];

export function obtenerMsEquiposPorClub(club) {
  const clave = String(club || '').trim().toUpperCase();
  return EQUIPOS_MS.filter((equipo) => equipo.club === clave).sort((a, b) => a.orden - b.orden);
}

export { EQUIPOS_MS };
