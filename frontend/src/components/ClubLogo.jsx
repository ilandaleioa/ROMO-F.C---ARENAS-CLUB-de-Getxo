// Hueco reservado para el escudo real del club.
// Sube tu archivo a frontend/public/assets/escudo.png (no se genera por IA).
export default function ClubLogo({ className = 'h-12 w-12' }) {
  return (
    <img
      src="/assets/escudo.png"
      alt="Escudo ROMO FC - ARENAS Club de Getxo"
      className={`${className} object-contain`}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}
