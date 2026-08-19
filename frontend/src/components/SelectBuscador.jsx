import { useEffect, useMemo, useRef, useState } from 'react';

function normalizarComparacion(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es');
}

function normalizarOpciones(options) {
  return (options || []).map((opcion) => {
    if (opcion && typeof opcion === 'object') {
      return { value: opcion.value, label: String(opcion.label ?? opcion.value ?? '') };
    }
    return { value: opcion, label: String(opcion ?? '') };
  });
}

/**
 * Select buscable reutilizable: botón que abre un panel con un input de
 * búsqueda y una lista filtrable de opciones. Acepta `options` como array de
 * strings o de objetos { value, label }.
 */
export default function SelectBuscador({
  label,
  value,
  options,
  emptyLabel = 'Seleccionar...',
  onChange,
  disabled = false,
  required = false,
  destacarOpcion,
  etiquetaDestacado = '',
  className = '',
}) {
  const [abierto, setAbierto] = useState(false);
  const [busquedaInterna, setBusquedaInterna] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const opcionesNormalizadas = useMemo(() => normalizarOpciones(options), [options]);
  const opcionActual = opcionesNormalizadas.find(
    (opcion) => normalizarComparacion(opcion.value) === normalizarComparacion(value)
  );
  const valorDestacado = typeof destacarOpcion === 'function' && destacarOpcion(value);

  useEffect(() => {
    if (!abierto) {
      setBusquedaInterna('');
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [abierto]);

  useEffect(() => {
    if (disabled) setAbierto(false);
  }, [disabled]);

  useEffect(() => {
    const manejarClickFuera = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setAbierto(false);
      }
    };

    const manejarEscape = (event) => {
      if (event.key === 'Escape') {
        setAbierto(false);
      }
    };

    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarEscape);

    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, []);

  const opcionesFiltradas = useMemo(() => {
    const texto = normalizarComparacion(busquedaInterna);
    if (!texto) return opcionesNormalizadas;

    return opcionesNormalizadas.filter((opcion) => normalizarComparacion(opcion.label).includes(texto));
  }, [busquedaInterna, opcionesNormalizadas]);

  const valorVisible = opcionActual?.label || emptyLabel;

  const seleccionarOpcion = (opcionValue) => {
    onChange(opcionValue);
    setAbierto(false);
    setBusquedaInterna('');
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {label ? (
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-club-black/50">
          {label}
          {required ? <span className="text-club-red"> *</span> : null}
        </span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm text-club-black shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-club-red ${
          disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''
        } ${
          valorDestacado
            ? 'border-club-red/40 bg-gradient-to-r from-red-50 to-white hover:border-club-red'
            : 'border-gray-300 bg-white hover:border-club-red/40'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${opcionActual ? 'font-medium' : 'text-club-black/60'}`}>{valorVisible}</span>
          {valorDestacado ? (
            <span className="mt-1 inline-flex items-center rounded-full bg-club-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
              {etiquetaDestacado}
            </span>
          ) : null}
        </span>
        <span className={`ml-3 text-xs text-club-black/50 transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {abierto && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
          <input
            ref={inputRef}
            type="text"
            value={busquedaInterna}
            onChange={(event) => setBusquedaInterna(event.target.value)}
            placeholder={`Buscar${label ? ` ${label.toLowerCase()}` : ''}...`}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-club-black focus:outline-none focus:ring-2 focus:ring-club-red"
          />

          <div className="mt-3 max-h-64 overflow-auto pr-1">
            {!required ? (
              <button
                type="button"
                onClick={() => seleccionarOpcion('')}
                className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  !opcionActual ? 'bg-club-red text-white' : 'text-club-black hover:bg-red-50'
                }`}
              >
                <span>{emptyLabel}</span>
              </button>
            ) : null}

            {opcionesFiltradas.length === 0 ? (
              <p className="px-3 py-3 text-sm text-club-black/50">No hay opciones que coincidan.</p>
            ) : (
              opcionesFiltradas.map((opcion) => {
                const seleccionado = normalizarComparacion(opcion.value) === normalizarComparacion(value);
                const destacada = typeof destacarOpcion === 'function' && destacarOpcion(opcion.value);
                return (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => seleccionarOpcion(opcion.value)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      seleccionado
                        ? 'bg-club-red text-white shadow-sm'
                        : destacada
                          ? 'border border-club-red/20 bg-red-50/80 text-club-black hover:bg-red-100'
                          : 'text-club-black hover:bg-red-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opcion.label}</span>
                      {destacada ? (
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                            seleccionado ? 'bg-white/15 text-white' : 'bg-club-red text-white'
                          }`}
                        >
                          {etiquetaDestacado}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
