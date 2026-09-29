// SF-Symbols-style 1.5px line icons (original drawings).
const svg = (body: string) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICON = {
  library: svg('<path d="M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.5 1-3.4 13-3.6-1z"/>'),
  eye: svg('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  camera: svg('<path d="M3 17l9 4 9-4M3 12l9 4 9-4M12 3l9 4-9 4-9-4z"/>'),
  top: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>'),
  grid: svg('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>'),
  hex: svg('<path d="M12 3l7.5 4.3v8.6L12 20.3l-7.5-4.4V7.3z"/>'),
  gridOff: svg('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 20L20 4"/>'),
  walls: svg('<path d="M3 20h18M5 20V9h5v11M14 20v-6h5v6"/>'),
  reveal: svg('<path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.4 5.6l-2.1 2.1M21 12h-3"/><circle cx="12" cy="14" r="4"/>'),
  brush: svg('<path d="M14.5 4.5l5 5-8 8-5-5zM6.5 12.5l-2 7 7-2"/>'),
  fog: svg('<path d="M4 10h11M7 14h13M4 18h10M9 6h8"/>'),
  undo: svg('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 010 12" transform="translate(0 -6)"/>'),
  display: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  unlock: svg('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 017.5-2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  token: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
};
