/**
 * Mission designer: pure budget logic (no rendering), so it can be unit-tested.
 * All numbers are simplified, order-of-magnitude-correct teaching values.
 */
import { AU, PLANETS } from "./physics/constants";
import { dataRate, dvFromParking, hohmann, rocketDv, semiMajorAxis, solarPower } from "./physics/orbits";

export interface Instrument { id: string; name: string; mass: number; power: number; dataMbDay: number; science: number }

export const INSTRUMENTS: Instrument[] = [
  { id: "camera", name: "Cámara de alta resolución", mass: 25, power: 30, dataMbDay: 4000, science: 3 },
  { id: "spectro", name: "Espectrómetro infrarrojo", mass: 18, power: 22, dataMbDay: 1500, science: 3 },
  { id: "mag", name: "Magnetómetro", mass: 5, power: 4, dataMbDay: 50, science: 1 },
  { id: "radar", name: "Radar de penetración", mass: 45, power: 110, dataMbDay: 2500, science: 4 },
  { id: "dust", name: "Detector de polvo y partículas", mass: 8, power: 6, dataMbDay: 80, science: 1 },
  { id: "probe", name: "Sonda atmosférica (se suelta al llegar)", mass: 340, power: 0, dataMbDay: 0, science: 5 },
];

/** Generic launch vehicles (capacity to low Earth orbit, 200 km). */
export const LAUNCHERS = [
  { id: "light", name: "Ligero", leo: 8000 },
  { id: "medium", name: "Mediano", leo: 22000 },
  { id: "heavy", name: "Pesado", leo: 60000 },
] as const;

export type Capture = "flyby" | "elliptical" | "circular";

export interface Design {
  target: string;
  instruments: string[];
  busMass: number; // structure, avionics, thermal… (kg)
  propellant: number; // kg
  isp: number; // s
  solarArea: number; // m²
  solarEff: number; // 0..1
  rtg: number; // number of RTGs (≈110 W, 45 kg each, MMRTG-class)
  capture: Capture;
  launcher: (typeof LAUNCHERS)[number]["id"];
}

export const DEFAULT_DESIGN: Design = {
  target: "mars", instruments: ["camera", "spectro", "mag"], busMass: 600, propellant: 3200, isp: 320,
  solarArea: 12, solarEff: 0.3, rtg: 0, capture: "elliptical", launcher: "medium",
};

const LEO = PLANETS.earth.radius + 200e3;
const RTG_W = 110, RTG_KG = 45;
const BUS_POWER = 150; // W for computer, heaters, radio
const RATE_1AU = 4; // Mbps downlink at 1 AU (medium high-gain antenna)

/** Insertion Δv at the target for a given capture strategy (periapsis 1.1 R; ellipse apoapsis 20 R). */
export function captureDv(target: string, vInf: number, capture: Capture): number {
  if (capture === "flyby") return 0;
  const { gm, radius } = PLANETS[target];
  const rp = 1.1 * radius;
  const vHyp = Math.sqrt(vInf * vInf + (2 * gm) / rp);
  const a = capture === "circular" ? rp : (rp + 20 * radius) / 2;
  return vHyp - Math.sqrt(gm * (2 / rp - 1 / a));
}

export interface Budget {
  dryMass: number;
  wetMass: number;
  dvAvailable: number;
  dvDeparture: number;
  dvCapture: number;
  dvRequired: number; // incl. 5% margin
  tofDays: number;
  powerAvailable: number;
  powerNeeded: number;
  distanceSun: number; // AU
  maxEarthDistance: number; // AU (superior conjunction)
  downlinkMbps: number;
  dataNeededMbDay: number;
  dataCapacityMbDay: number;
  science: number;
  checks: { id: string; ok: boolean; label: string; detail: string }[];
  feasible: boolean;
}

export function evaluate(d: Design): Budget {
  const inst = INSTRUMENTS.filter((i) => d.instruments.includes(i.id));
  const solarKg = d.solarArea * 3.5; // ~3.5 kg/m² array
  const dryMass = d.busMass + inst.reduce((s, i) => s + i.mass, 0) + solarKg + d.rtg * RTG_KG;
  const wetMass = dryMass + d.propellant;
  const dvAvailable = rocketDv(d.isp, wetMass, dryMass);

  const rE = semiMajorAxis("earth"), rT = semiMajorAxis(d.target);
  const h = hohmann(rE, rT);
  const dvDeparture = dvFromParking(h.dv1, PLANETS.earth.gm, LEO);
  const dvCap = captureDv(d.target, h.dv2, d.capture);
  const dvRequired = (dvDeparture + dvCap) * 1.05;

  const distanceSun = rT / AU;
  const powerAvailable = solarPower(rT, d.solarArea, d.solarEff) + d.rtg * RTG_W;
  const powerNeeded = BUS_POWER + inst.reduce((s, i) => s + i.power, 0);

  const maxEarthDistance = (rT + rE) / AU;
  const downlinkMbps = dataRate(RATE_1AU, AU, maxEarthDistance * AU);
  const dataCapacityMbDay = downlinkMbps * 8 * 3600 / 8 * 1; // 8 h DSN pass per day, Mb→MB (/8)
  const dataNeededMbDay = inst.reduce((s, i) => s + i.dataMbDay, 0) / 8;
  const launcher = LAUNCHERS.find((l) => l.id === d.launcher)!;

  const checks = [
    { id: "launch", ok: wetMass <= launcher.leo, label: "Masa al despegue",
      detail: `${fmt(wetMass)} kg / capacidad ${fmt(launcher.leo)} kg (cohete ${launcher.name})` },
    { id: "dv", ok: dvAvailable >= dvRequired, label: "Δv (combustible)",
      detail: `${(dvAvailable / 1000).toFixed(2)} km/s disponibles / ${(dvRequired / 1000).toFixed(2)} km/s necesarios` },
    { id: "power", ok: powerAvailable >= powerNeeded, label: "Energía en destino",
      detail: `${fmt(powerAvailable)} W / ${fmt(powerNeeded)} W necesarios a ${distanceSun.toFixed(2)} UA del Sol` },
    { id: "data", ok: dataCapacityMbDay >= dataNeededMbDay, label: "Enlace de datos",
      detail: `${fmt(dataCapacityMbDay)} MB/día posibles / ${fmt(dataNeededMbDay)} MB/día que generan los instrumentos` },
    { id: "science", ok: inst.length > 0, label: "Ciencia a bordo", detail: inst.length ? `${inst.length} instrumentos` : "sin instrumentos: no hay misión" },
  ];
  return {
    dryMass, wetMass, dvAvailable, dvDeparture, dvCapture: dvCap, dvRequired, tofDays: h.tof / 86400,
    powerAvailable, powerNeeded, distanceSun, maxEarthDistance, downlinkMbps, dataNeededMbDay, dataCapacityMbDay,
    science: inst.reduce((s, i) => s + i.science, 0), checks, feasible: checks.every((c) => c.ok),
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-PE");
