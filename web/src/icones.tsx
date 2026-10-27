import { type ReactNode, useId } from 'react';

// Strokes on a 24 × 24 grid, round caps, 2 px (Design System, Iconografia).
const TRACOS = {
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  carteira: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 15h1" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
    </>
  ),
  recibo: <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6" />,
  etiqueta: (
    <>
      <path d="M3 12V3h9l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  enviar: <path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />,
  voltar: <path d="M19 12H5M12 19l-7-7 7-7" />,
  trocar: <path d="M4 8h15l-4-4M20 16H5l4 4" />,
  sair: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  direita: <path d="M9 6l6 6-6 6" />,
  esquerda: <path d="M15 6l-6 6 6 6" />,
  arquivo: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  alerta: <path d="M12 3L2 20h20zM12 10v4M12 17h.01" />,
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  cadeado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  cafe: (
    <path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 11h1a3 3 0 0 1 0 6h-1M8 3v3M12 3v3" />
  ),
  reembolso: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
} as const satisfies Record<string, ReactNode>;

/** Name of an icon. */
export type NomeDoIcone = keyof typeof TRACOS;

/**
 * The logo in one line (prototype): the grão de café, cut by the `S`, and the name in text, which
 * screen readers read as FACOFFEE.
 */
export const Marca = () => {
  const corte = useId();
  return (
    <span className="marca">
      <svg viewBox="128 14 50 70" aria-hidden="true">
        <mask id={corte}>
          <rect x="128" y="14" width="50" height="70" fill="white" />
          <path
            d="M132 76c16 0 20-16 21-29s7-25 21-25"
            fill="none"
            stroke="black"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </mask>
        <ellipse
          cx="153"
          cy="49"
          rx="22"
          ry="32"
          transform="rotate(32 153 49)"
          fill="currentColor"
          mask={`url(#${corte})`}
        />
      </svg>
      <span>
        FA<span>COFFEE</span>
      </span>
    </span>
  );
};

/** A decorative icon, hidden from screen readers: the text next to it says what it means. */
export const Icone = ({ nome }: { nome: NomeDoIcone }) => (
  <svg
    className="icone"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {TRACOS[nome]}
  </svg>
);
