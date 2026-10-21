/** Shared UI primitives: line icons, panels, key/value stats, bars and number formatting. */
import { useEffect, useReducer, type ReactNode } from "react";
import { engine } from "../engine";

const PATHS: Record<string, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6",
  rocket: "M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10zM9 16l-3 3v-4l1.5-1.5M15 16l3 3v-4l-1.5-1.5M12 9.5a1.5 1.5 0 1 0 0 .01M10.5 20l1.5 2 1.5-2",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  launch: "M12 3v12M8 7l4-4 4 4M5 21h14M7 17h10",
  orbit: "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M3 12c0-3 4-5 9-5s9 2 9 5-4 5-9 5-9-2-9-5z",
  radar: "M12 12L19 5M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0",
  play: "M7 4l13 8-13 8z",
  pause: "M7 4h4v16H7zM13 4h4v16h-4z",
  ff: "M4 5l8 7-8 7zM12 5l8 7-8 7z",
  alert: "M12 3l10 18H2zM12 10v5M12 18v.01",
  check: "M4 12l5 5L20 6",
  x: "M5 5l14 14M19 5L5 19",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  coins: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  flask: "M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10",
  clock: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7v5l3 2",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  globe: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  menu: "M4 6h16M4 12h16M4 18h16",
  habitat: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 12h18M9 5v14M15 12v7",
  target: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0",
  land: "M12 3v10M8 9l4 4 4-4M4 21l3-4h10l3 4M3 21h18",
  info: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 11v6M12 7.5v.01",
  save: "M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 3v5h7V3M8 21v-7h8v7",
};

export function Icon({ name, size = 16, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

export function Panel({ title, eyebrow, actions, children, className }: { title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`gp ${className ?? ""}`}>
      {(title || eyebrow || actions) && (
        <header className="gp-head">
          <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}{title && <h2>{title}</h2>}</div>
          {actions && <div className="gp-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function KV({ k, v, tone, sub }: { k: ReactNode; v: ReactNode; tone?: "ok" | "bad" | "warn" | "accent"; sub?: ReactNode }) {
  return <div className={`kv ${tone ?? ""}`}><span>{k}</span><b>{v}</b>{sub && <small>{sub}</small>}</div>;
}

export function Bar({ value, max = 1, tone, label, right }: { value: number; max?: number; tone?: "ok" | "bad" | "warn" | "accent"; label?: ReactNode; right?: ReactNode }) {
  const p = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className={`gbar ${tone ?? ""}`}>
      {(label || right) && <div className="gbar-l"><span>{label}</span><span>{right}</span></div>}
      <div className="gbar-t"><i style={{ width: `${p}%` }} /></div>
    </div>
  );
}

export function Chip({ tone, children }: { tone?: "ok" | "bad" | "warn" | "accent" | "muted"; children: ReactNode }) {
  return <span className={`chip ${tone ?? ""}`}>{children}</span>;
}

export const num = (v: number, d = 0) => v.toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: d });
export const musd = (v: number) => `${num(v, Math.abs(v) < 10 ? 1 : 0)} M USD`;
export const kms = (ms: number) => `${num(ms / 1000, 2)} km/s`;
export const tons = (kg: number) => `${num(kg / 1000, kg < 1e5 ? 1 : 0)} t`;

/** Re-render periodically (for state that lives in the 3D engine, not in React). */
export function useTicker(ms = 100) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let acc = 0;
    return engine.onFrame((dt) => { acc += dt * 1000; if (acc >= ms) { acc = 0; force(); } });
  }, [ms]);
}
