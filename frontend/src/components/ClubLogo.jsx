import { useClub } from '../context/ClubContext';

const ESCUDOS = {
  ROMO: { src: '/assets/escudo-romo.png', alt: 'Escudo Romo F.C.' },
  ARENAS: { src: '/assets/escudo-arenas.png', alt: 'Escudo Arenas Club de Getxo' },
};

// Sube los archivos a frontend/public/assets/escudo-romo.png y escudo-arenas.png.
export default function ClubLogo({ className = 'h-12 w-12' }) {
  const { club } = useClub();
  const escudo = ESCUDOS[club] || { src: '/assets/escudo.png', alt: 'Escudo del club' };

  return (
    <img
      src={escudo.src}
      alt={escudo.alt}
      className={`${className} object-contain`}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}
