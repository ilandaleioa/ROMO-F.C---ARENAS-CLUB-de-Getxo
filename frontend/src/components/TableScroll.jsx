import { useEffect, useRef, useState } from 'react';

function sincronizarScroll(origen, destino) {
  if (!origen || !destino) return;

  const maxOrigen = origen.scrollWidth - origen.clientWidth;
  const maxDestino = destino.scrollWidth - destino.clientWidth;

  if (maxOrigen <= 0 || maxDestino <= 0) {
    destino.scrollLeft = origen.scrollLeft;
    return;
  }

  destino.scrollLeft = (origen.scrollLeft / maxOrigen) * maxDestino;
}

export default function TableScroll({ children, className = '', ...props }) {
  const barraSuperiorRef = useRef(null);
  const contenidoRef = useRef(null);
  const separadorRef = useRef(null);
  const [tieneScrollHorizontal, setTieneScrollHorizontal] = useState(false);

  useEffect(() => {
    const barraSuperior = barraSuperiorRef.current;
    const contenido = contenidoRef.current;
    const separador = separadorRef.current;
    if (!barraSuperior || !contenido || !separador) return undefined;

    const actualizar = () => {
      separador.style.width = `${contenido.scrollWidth}px`;
      setTieneScrollHorizontal(contenido.scrollWidth > contenido.clientWidth + 1);
      sincronizarScroll(contenido, barraSuperior);
    };

    const alDesplazarArriba = () => sincronizarScroll(barraSuperior, contenido);
    const alDesplazarAbajo = () => sincronizarScroll(contenido, barraSuperior);

    barraSuperior.addEventListener('scroll', alDesplazarArriba, { passive: true });
    contenido.addEventListener('scroll', alDesplazarAbajo, { passive: true });
    actualizar();

    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(actualizar) : null;
    observador?.observe(contenido);
    if (contenido.firstElementChild) observador?.observe(contenido.firstElementChild);
    window.addEventListener('resize', actualizar);

    return () => {
      barraSuperior.removeEventListener('scroll', alDesplazarArriba);
      contenido.removeEventListener('scroll', alDesplazarAbajo);
      observador?.disconnect();
      window.removeEventListener('resize', actualizar);
    };
  }, [children]);

  return (
    <div className="table-scroll-wrapper">
      <div
        ref={barraSuperiorRef}
        className="table-scrollbar-top"
        aria-hidden="true"
        style={{ display: tieneScrollHorizontal ? 'block' : 'none' }}
      >
        <div ref={separadorRef} className="table-scrollbar-spacer" />
      </div>
      <div ref={contenidoRef} className={className} {...props}>
        {children}
      </div>
    </div>
  );
}
