/** Fingernote-Wortmarke: eigene Zeichnung, ein Fingerabdruck-Bogen, der in eine Schreiblinie übergeht. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo-mark">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M10 22c0-6 2.7-11 6-11s6 3.4 6 8" fill="none" stroke="var(--on-accent)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13.5 22c0-4 1.1-7 2.5-7s2.5 2 2.5 5" fill="none" stroke="var(--on-accent)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 25.5c4-1.6 8 1.6 12 0s4-1.4 6 0" fill="none" stroke="var(--on-accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label="Fingernote – zur Bibliothek">
      <LogoMark />
      <span className="logo-word">Fingernote</span>
    </a>
  );
}
