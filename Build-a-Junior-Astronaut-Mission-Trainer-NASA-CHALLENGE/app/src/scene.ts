import { SITES, type Build, type SimState } from "./sim";

/** Procedural 2D outpost scene. Pure drawing: reads the build + state, never mutates them. */

interface Star { x: number; y: number; r: number; a: number }
let stars: Star[] = [];
let dust: { x: number; y: number; v: number }[] = [];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function mix(c1: number[], c2: number[], t: number) { return `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(",")})`; }

/** Deterministic ridge line so the horizon does not flicker. */
function ridge(x: number, seed: number, amp: number) {
  return Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.011 + seed * 2.3) * amp * 0.45 + Math.sin(x * 0.027 + seed * 5.1) * amp * 0.18;
}

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, b: Build, s: SimState, time: number, inset = { l: 0, r: 0 }) {
  const L = inset.l, W = w - inset.l - inset.r; // visible strip between the side panels
  const site = SITES[b.site];
  const mars = site.body === "mars";
  const sun = s.sunElev; // sine of elevation
  const day = Math.max(0, Math.min(1, (sun + 0.08) / 0.35)); // 0 night .. 1 full day
  const storm = mars && s.tau > 1;
  const ground = h * 0.7;

  if (stars.length === 0 || stars.length !== Math.round((w * h) / 2600)) {
    stars = Array.from({ length: Math.round((w * h) / 2600) }, () => ({ x: Math.random() * w, y: Math.random() * ground, r: Math.random() * 1.3 + 0.2, a: Math.random() }));
  }

  // ---------------- sky
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  if (mars) {
    const top = storm ? [92, 62, 40] : [196, 150, 110], bottom = storm ? [140, 95, 60] : [228, 190, 150];
    sky.addColorStop(0, mix([8, 10, 22], top, day));
    sky.addColorStop(1, mix([20, 18, 30], bottom, day));
  } else {
    sky.addColorStop(0, "#020309");
    sky.addColorStop(1, "#05070f");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, ground + 2);
  const starAlpha = mars ? 1 - day : 1;
  for (const st of stars) {
    ctx.globalAlpha = starAlpha * (0.4 + 0.6 * Math.abs(Math.sin(time * 0.6 + st.a * 10)));
    ctx.fillStyle = "#fff";
    ctx.fillRect(st.x, st.y, st.r, st.r);
  }
  ctx.globalAlpha = 1;

  // Earth in the lunar sky (near side: high; pole: low on the horizon)
  if (!mars) {
    const ex = L + W * 0.82, ey = site.id === "moon-pole" ? ground - h * 0.12 : h * 0.18, er = Math.min(w, h) * 0.035;
    const g = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, er * 0.2, ex, ey, er);
    g.addColorStop(0, "#9cc9ff"); g.addColorStop(0.6, "#2f6fd6"); g.addColorStop(1, "#0b2a66");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath(); ctx.ellipse(ex - er * 0.2, ey + er * 0.1, er * 0.5, er * 0.18, 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Sun: moves along an arc during the local day (skims the horizon at the pole)
  const phase = (s.hour % site.dayHours) / site.dayHours;
  if (sun > -0.05) {
    const sx = site.id === "moon-pole" ? L + W * (0.1 + 0.8 * ((phase / site.sunlitFraction) % 1)) : L + W * (0.08 + 0.84 * (phase * 2));
    const sy = site.id === "moon-pole" ? ground - h * 0.05 : ground - Math.max(0, sun) * h * 0.55;
    const sr = mars ? 14 : 20;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * (mars ? 9 : 6));
    halo.addColorStop(0, mars ? "rgba(220,235,255,0.95)" : "rgba(255,255,240,1)");
    halo.addColorStop(0.15, mars ? "rgba(150,190,255,0.45)" : "rgba(255,245,210,0.35)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - sr * 10, sy - sr * 10, sr * 20, sr * 20);
    ctx.fillStyle = "#fffdf2";
    ctx.beginPath(); ctx.arc(sx, sy, sr * (storm ? 0.6 : 1) * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------- terrain (two ridges + foreground)
  const light = 0.25 + 0.75 * day;
  const far = mars ? [150, 80, 50] : [95, 95, 100], near = mars ? [176, 98, 58] : [130, 130, 136];
  for (const [k, col, amp, seed] of [[0, far, 40, 1.7], [1, near, 22, 4.2]] as const) {
    ctx.fillStyle = mix([10, 10, 14], col as unknown as number[], light * (k ? 1 : 0.75));
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, ground - 30 + k * 26 + ridge(x, seed, amp));
    ctx.lineTo(w, h); ctx.fill();
  }
  ctx.fillStyle = mix([12, 12, 16], mars ? [150, 82, 48] : [112, 112, 118], light);
  ctx.fillRect(0, ground + 18, w, h - ground);

  // ---------------- base layout (left → right)
  const baseY = ground + 30;
  let x = L + W * 0.04;
  const unit = Math.max(0.6, Math.min(1.5, W / 680));

  // solar array
  const panels = Math.min(14, Math.ceil(b.solarM2 / 30));
  for (let i = 0; i < panels; i++) {
    const px = x + i * 22 * unit, tilt = site.id === "moon-pole" ? 0 : 0.35;
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 8 * unit, baseY); ctx.lineTo(px + 8 * unit, baseY - 26 * unit); ctx.stroke();
    ctx.save();
    ctx.translate(px + 8 * unit, baseY - 30 * unit);
    ctx.rotate(tilt);
    const pg = ctx.createLinearGradient(0, -12 * unit, 0, 12 * unit);
    const glint = 0.2 + 0.6 * day;
    pg.addColorStop(0, `rgba(${40 + 60 * glint},${70 + 80 * glint},${150 + 90 * glint},1)`);
    pg.addColorStop(1, "#0d1a3a");
    ctx.fillStyle = pg;
    ctx.fillRect(-4 * unit, -14 * unit, 8 * unit, 28 * unit);
    if (s.dust > 0.05) { ctx.fillStyle = `rgba(170,110,70,${Math.min(0.7, s.dust)})`; ctx.fillRect(-4 * unit, -14 * unit, 8 * unit, 28 * unit); }
    ctx.restore();
  }
  x += panels * 22 * unit + 30 * unit;

  // habitats under regolith shielding
  const habs = Math.ceil(b.crew / 2);
  for (let i = 0; i < habs; i++) {
    const hx = x + i * 92 * unit, r = 38 * unit;
    const shield = Math.min(1, b.shieldingCm / 100);
    if (shield > 0) {
      ctx.fillStyle = mix([20, 20, 24], mars ? [140, 76, 44] : [105, 105, 110], light);
      ctx.beginPath(); ctx.ellipse(hx + r, baseY, r * (1.15 + 0.35 * shield), r * (0.75 + 0.45 * shield), 0, Math.PI, 0); ctx.fill();
    }
    const dome = ctx.createLinearGradient(hx, baseY - r, hx, baseY);
    dome.addColorStop(0, mix([40, 40, 48], [235, 238, 245], light)); dome.addColorStop(1, mix([20, 20, 26], [160, 165, 175], light));
    ctx.fillStyle = dome;
    ctx.beginPath(); ctx.ellipse(hx + r, baseY, r, r * 0.72, 0, Math.PI, 0); ctx.fill();
    const lit = s.shed.includes("soporte vital") ? 0 : 1;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = lit ? `rgba(255,214,120,${0.45 + 0.55 * (1 - day)})` : "#222";
      ctx.beginPath(); ctx.arc(hx + r * (0.55 + k * 0.45), baseY - r * 0.35, 3.2 * unit, 0, Math.PI * 2); ctx.fill();
    }
  }
  x += habs * 92 * unit + 20 * unit;

  // greenhouse
  if (b.greenhouseM2 > 0) {
    const gr = Math.min(70, 20 + Math.sqrt(b.greenhouseM2) * 4) * unit;
    const on = !s.shed.includes("invernadero");
    const gg = ctx.createRadialGradient(x + gr, baseY - gr * 0.3, 2, x + gr, baseY - gr * 0.3, gr * 1.4);
    gg.addColorStop(0, on ? "rgba(140,255,170,0.75)" : "rgba(60,80,60,0.4)"); gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg; ctx.fillRect(x - gr, baseY - gr * 2, gr * 4, gr * 2.4);
    ctx.strokeStyle = "rgba(200,255,220,0.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x + gr, baseY, gr, gr * 0.7, 0, Math.PI, 0); ctx.stroke();
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + (gr * 2 * k) / 4, baseY); ctx.lineTo(x + (gr * 2 * k) / 4, baseY - gr * 0.62 * Math.sin((Math.PI * k) / 4)); ctx.stroke(); }
    x += gr * 2 + 30 * unit;
  }

  // batteries with charge LEDs
  const charge = b.batteryKwh > 0 ? s.battery / b.batteryKwh : 0;
  for (let i = 0; i < Math.min(4, Math.ceil(b.batteryKwh / 150)); i++) {
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(x + i * 16 * unit, baseY - 22 * unit, 12 * unit, 22 * unit);
    ctx.fillStyle = charge > 0.5 ? "#3ecf8e" : charge > 0.2 ? "#ffb347" : "#ff5d6c";
    ctx.fillRect(x + i * 16 * unit + 3 * unit, baseY - 22 * unit + 22 * unit * (1 - charge), 6 * unit, 22 * unit * charge);
  }
  x += 80 * unit;

  // ISRU / ice miner
  if ((site.isruCo2 && b.isruKgDay > 0) || (site.ice && b.iceKgDay > 0)) {
    ctx.fillStyle = mix([30, 30, 36], [190, 195, 205], light);
    ctx.fillRect(x, baseY - 26 * unit, 34 * unit, 26 * unit);
    ctx.fillStyle = site.ice ? "#7fd8ff" : "#ff9c6b";
    ctx.beginPath(); ctx.arc(x + 17 * unit, baseY - 34 * unit, (4 + 2 * Math.sin(time * 3)) * unit, 0, Math.PI * 2); ctx.fill();
    x += 70 * unit;
  }

  // fission reactors far from the habitats, glowing radiators
  for (let i = 0; i < b.reactors; i++) {
    const rx = L + W * 0.93 - i * 70 * unit;
    ctx.fillStyle = "#3a3f4a"; ctx.fillRect(rx, baseY - 40 * unit, 18 * unit, 40 * unit);
    for (let f = -1; f <= 1; f += 2) {
      const rg = ctx.createLinearGradient(rx + 9 * unit, 0, rx + 9 * unit + f * 34 * unit, 0);
      rg.addColorStop(0, "rgba(255,120,60,0.85)"); rg.addColorStop(1, "rgba(255,120,60,0.15)");
      ctx.fillStyle = rg;
      ctx.fillRect(f > 0 ? rx + 18 * unit : rx - 34 * unit, baseY - 36 * unit, 34 * unit, 24 * unit);
    }
  }

  // astronauts doing science
  if (s.status === "running" && !s.shed.length) {
    for (let i = 0; i < Math.min(b.crew, 4); i++) {
      const ax = L + W * 0.2 + ((time * 12 + i * 160) % (W * 0.6)), ay = baseY + 22 + (i % 2) * 10;
      ctx.fillStyle = "#f2f4f8";
      ctx.beginPath(); ctx.arc(ax, ay - 14, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(ax - 3, ay - 10, 6, 10);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(ax - 2, ay - 15, 4, 2);
    }
  }

  // ---------------- weather & alerts
  if (storm) {
    if (dust.length < 260) dust = Array.from({ length: 260 }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 60 + Math.random() * 140 }));
    ctx.fillStyle = "rgba(150,95,55,0.35)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(210,150,100,0.5)";
    for (const p of dust) { p.x = (p.x + p.v * 0.016) % w; ctx.fillRect(p.x, p.y, 2.5, 1.2); }
  }
  if (s.speHoursLeft > 0) {
    ctx.fillStyle = `rgba(160,90,255,${0.12 + 0.08 * Math.sin(time * 8)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (!day && !mars) { ctx.fillStyle = "rgba(0,0,10,0.25)"; ctx.fillRect(0, ground, w, h - ground); }
}
