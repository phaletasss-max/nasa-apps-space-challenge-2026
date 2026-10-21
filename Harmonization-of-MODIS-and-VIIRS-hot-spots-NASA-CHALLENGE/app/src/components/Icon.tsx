/** Inline SVG icons (crisp at any DPI, identical on every OS — no emoji glyphs). */
const PATHS = {
  rect: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
  poly: <path d="M12 3.5 20 9.5 17 19.5H7L4 9.5Z" />,
  cube: <><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" /><path d="M12 12 20 7.5M12 12 4 7.5M12 12v9" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5s1.3-6.1 3.9-8.5Z" /></>,
  download: <><path d="M12 4v11M7 10.5 12 15.5 17 10.5" /><path d="M5 19.5h14" /></>,
  image: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m20.5 16-5-5-8.5 8" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  sparkle: <path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2Z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  smooth: <><circle cx="9" cy="10" r="5" /><circle cx="15.5" cy="14.5" r="4.5" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
