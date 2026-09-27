// Friendly line illustrations for empty screens. Colours come from the theme.

export function NoHomesArt() {
  return (
    <svg className="art" viewBox="0 0 200 140" aria-hidden="true">
      <ellipse cx="100" cy="124" rx="78" ry="8" fill="var(--art-shadow)" />
      <path d="M48 70 100 30l52 40v52H48z" fill="var(--art-fill)" stroke="var(--art-line)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M38 76 100 26l62 50" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="88" y="90" width="24" height="32" rx="3" fill="var(--surface)" stroke="var(--art-line)" strokeWidth="3" />
      <rect x="62" y="80" width="18" height="16" rx="2" fill="var(--surface)" stroke="var(--art-line)" strokeWidth="3" />
      <rect x="120" y="80" width="18" height="16" rx="2" fill="var(--surface)" stroke="var(--art-line)" strokeWidth="3" />
      <circle cx="160" cy="36" r="15" fill="var(--tag)" />
      <path d="M160 29v14M153 36h14" stroke="var(--tag-ink)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function NoRoomsArt() {
  return (
    <svg className="art" viewBox="0 0 200 140" aria-hidden="true">
      <ellipse cx="100" cy="126" rx="80" ry="7" fill="var(--art-shadow)" />
      <rect x="30" y="22" width="140" height="100" rx="8" fill="var(--art-fill)" stroke="var(--art-line)" strokeWidth="3" />
      <path d="M100 22v44M30 72h44M126 72h44M100 94v28" stroke="var(--art-line)" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 72a26 26 0 0 1 26-26" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="5 5" />
      <rect x="44" y="36" width="36" height="22" rx="4" fill="var(--surface)" stroke="var(--art-line)" strokeWidth="2.5" />
      <rect x="124" y="92" width="32" height="18" rx="4" fill="var(--surface)" stroke="var(--art-line)" strokeWidth="2.5" />
      <circle cx="146" cy="44" r="13" fill="var(--tag)" />
      <path d="M146 38v12M140 44h12" stroke="var(--tag-ink)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function NoItemsArt() {
  return (
    <svg className="art" viewBox="0 0 200 140" aria-hidden="true">
      <ellipse cx="96" cy="126" rx="70" ry="7" fill="var(--art-shadow)" />
      <path d="M50 62 94 46l44 16v48l-44 16-44-16z" fill="var(--art-fill)" stroke="var(--art-line)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 62l44 16 44-16M94 78v48" fill="none" stroke="var(--art-line)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="136" cy="50" r="22" fill="var(--surface)" stroke="var(--accent)" strokeWidth="5" />
      <path d="m152 66 16 16" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
      <path d="M128 50h16" stroke="var(--tag)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function ReportArt() {
  return (
    <svg className="art small" viewBox="0 0 200 140" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="60" ry="6" fill="var(--art-shadow)" />
      <rect x="62" y="14" width="76" height="106" rx="6" fill="var(--surface)" stroke="var(--art-line)" strokeWidth="3" />
      <rect x="74" y="28" width="30" height="8" rx="2" fill="var(--accent)" />
      <path d="M74 50h52M74 62h52M74 74h40M74 86h46" stroke="var(--art-line)" strokeWidth="3" strokeLinecap="round" />
      <rect x="74" y="98" width="52" height="10" rx="2" fill="var(--art-fill)" />
      <circle cx="138" cy="112" r="16" fill="var(--tag)" />
      <path d="m131 112 5 5 9-9" fill="none" stroke="var(--tag-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
