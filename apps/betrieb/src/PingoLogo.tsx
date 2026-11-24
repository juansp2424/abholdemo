/** Pingo logo (icon, wordmark, dot). The wordmark is a transparent PNG from public/, turned white in dark mode via CSS. */
export function PingoLogo() {
  return (
    <svg className="pingo" viewBox="0 0 1030 353" role="img" aria-label="Pingo" xmlns="http://www.w3.org/2000/svg">
      <rect width="353" height="353" rx="84" fill="#3b82f6" />
      <path d="M106 101A146 146 0 0 1 252 247" fill="none" stroke="#b3cffd" strokeWidth="28" strokeLinecap="round" />
      <path d="M106 161A86 86 0 0 1 192 247" fill="none" stroke="#fff" strokeWidth="28" strokeLinecap="round" />
      <circle cx="106" cy="247" r="31" fill="#fff" />
      <image className="pingo-word" href="/pingo-wordmark.png" x="460" y="89" width="532" height="208" />
      <circle cx="1012" cy="235" r="15.5" fill="#3b82f6" />
    </svg>
  );
}
