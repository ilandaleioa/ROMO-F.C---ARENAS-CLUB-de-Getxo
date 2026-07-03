const STORAGE_KEY = 'club_activo';
const CLUBES_VALIDOS = ['ROMO', 'ARENAS'];

function leerClubGuardado() {
  const guardado = localStorage.getItem(STORAGE_KEY);
  return CLUBES_VALIDOS.includes(guardado) ? guardado : 'ROMO';
}

let club = leerClubGuardado();
const listeners = new Set();

export function getClub() {
  return club;
}

export function setClub(nuevoClub) {
  if (!CLUBES_VALIDOS.includes(nuevoClub) || nuevoClub === club) return;
  club = nuevoClub;
  localStorage.setItem(STORAGE_KEY, club);
  listeners.forEach((fn) => fn(club));
}

export function subscribeClub(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
