/**
 * Parts catalogue. Generic names with specifications rounded from public data of real engine classes
 * (cited in `ref`). Costs are order-of-magnitude game values in millions of USD.
 */

export type Propellant = "kerolox" | "hydrolox" | "methalox" | "hypergolic" | "solid";

export interface Engine {
  id: string; name: string; ref: string; propellant: Propellant;
  thrustSL: number; thrustVac: number; // kN
  ispSL: number; ispVac: number; // s
  mass: number; // kg
  cost: number; // M USD
  buildDays: number; // per engine (parallel production line)
  reliability: number; // per-flight success probability
  upperOnly?: boolean;
}

export const ENGINES: Engine[] = [
  { id: "k1", name: "K-1 (queroseno/LOX)", ref: "clase Merlin 1D", propellant: "kerolox", thrustSL: 845, thrustVac: 914, ispSL: 282, ispVac: 311, mass: 470, cost: 1.5, buildDays: 30, reliability: 0.998 },
  { id: "k1v", name: "K-1V (vacío)", ref: "clase Merlin Vacuum", propellant: "kerolox", thrustSL: 0, thrustVac: 981, ispSL: 0, ispVac: 348, mass: 490, cost: 2.5, buildDays: 35, reliability: 0.997, upperOnly: true },
  { id: "h2", name: "H-2 (hidrógeno/LOX)", ref: "clase RS-25", propellant: "hydrolox", thrustSL: 1860, thrustVac: 2279, ispSL: 366, ispVac: 452, mass: 3527, cost: 100, buildDays: 120, reliability: 0.997 },
  { id: "rl", name: "RL-H (hidrógeno, vacío)", ref: "clase RL10", propellant: "hydrolox", thrustSL: 0, thrustVac: 110, ispSL: 0, ispVac: 465, mass: 301, cost: 17, buildDays: 60, reliability: 0.999, upperOnly: true },
  { id: "m2", name: "M-2 (metano/LOX)", ref: "clase Raptor 2", propellant: "methalox", thrustSL: 2256, thrustVac: 2400, ispSL: 327, ispVac: 347, mass: 1630, cost: 1.0, buildDays: 25, reliability: 0.99 },
  { id: "aj", name: "AJ-H (hipergólico)", ref: "clase AJ10", propellant: "hypergolic", thrustSL: 0, thrustVac: 27, ispSL: 0, ispVac: 316, mass: 118, cost: 8, buildDays: 45, reliability: 0.999, upperOnly: true },
];

/** Tank + structure dry mass as a fraction of the propellant load. */
export const TANK_FRACTION: Record<Propellant, number> = { kerolox: 0.055, hydrolox: 0.075, methalox: 0.06, hypergolic: 0.08, solid: 0.12 };
/** Upper stages carry no landing legs or heavy thrust structure: lighter tanks. */
export const UPPER_STAGE_FACTOR = 0.7;
/** Bulk density (kg/m³) used to size the stage diameter/height in the 3D view. */
export const DENSITY: Record<Propellant, number> = { kerolox: 1030, hydrolox: 360, methalox: 830, hypergolic: 1150, solid: 1800 };
export const TANK_COST_PER_T = 0.012; // M USD per tonne of propellant capacity
export const TANK_DAYS_PER_T = 0.12;

export interface Booster { id: string; name: string; ref: string; thrustSL: number; thrustVac: number; ispSL: number; ispVac: number; prop: number; dry: number; cost: number; buildDays: number; reliability: number }
export const BOOSTERS: Booster[] = [
  { id: "srb-s", name: "Booster sólido S", ref: "clase GEM 63", thrustSL: 1663, thrustVac: 1800, ispSL: 250, ispVac: 279, prop: 44000, dry: 5000, cost: 12, buildDays: 60, reliability: 0.998 },
  { id: "srb-l", name: "Booster sólido L", ref: "clase SRB de 5 segmentos", thrustSL: 14000, thrustVac: 15000, ispSL: 242, ispVac: 268, prop: 630000, dry: 100000, cost: 120, buildDays: 150, reliability: 0.997 },
];

export type PayloadKind = "probe" | "lander" | "rover" | "crew" | "crew-lander";

export interface Payload {
  id: string; name: string; kind: PayloadKind; mass: number; cost: number; buildDays: number; crew: number;
  ownDv: number; // m/s from its own propulsion (capture / landing / return)
  desc: string; reliability: number;
}
export const PAYLOADS: Payload[] = [
  { id: "orbiter", name: "Orbitador científico", kind: "probe", mass: 2800, cost: 350, buildDays: 420, crew: 0, ownDv: 1500, reliability: 0.97,
    desc: "Nave robótica con cámaras y espectrómetros; frena sola en el destino." },
  { id: "rover", name: "Rover con sistema de aterrizaje", kind: "rover", mass: 4000, cost: 900, buildDays: 600, crew: 0, ownDv: 400, reliability: 0.95,
    desc: "Rover de 1 t con escudo térmico, paracaídas y grúa aérea (tipo Perseverance)." },
  { id: "lunar-lander", name: "Módulo de aterrizaje lunar robótico", kind: "lander", mass: 2200, cost: 180, buildDays: 300, crew: 0, ownDv: 2600, reliability: 0.93,
    desc: "Aterrizador comercial para cargas científicas en la Luna." },
  { id: "capsule", name: "Cápsula tripulada + módulo de servicio", kind: "crew", mass: 26500, cost: 1200, buildDays: 540, crew: 4, ownDv: 1300, reliability: 0.985,
    desc: "Cápsula para 4 astronautas con escudo térmico de retorno (tipo Orión)." },
  { id: "crew-lander", name: "Cápsula + módulo lunar tripulado", kind: "crew-lander", mass: 42000, cost: 2600, buildDays: 720, crew: 4, ownDv: 4500, reliability: 0.975,
    desc: "Llega a órbita lunar, desciende con 2 astronautas y regresa a la cápsula." },
];

export interface StageSpec { engine: string; count: number; propT: number }
export interface Vehicle { name: string; boosters: { id: string; count: number } | null; stages: StageSpec[]; payload: string }

export const DEFAULT_VEHICLE: Vehicle = {
  name: "Cóndor I",
  boosters: null,
  stages: [{ engine: "k1", count: 9, propT: 410 }, { engine: "k1v", count: 1, propT: 108 }],
  payload: "orbiter",
};

export const engineById = (id: string) => ENGINES.find((e) => e.id === id)!;
export const boosterById = (id: string) => BOOSTERS.find((b) => b.id === id)!;
export const payloadById = (id: string) => PAYLOADS.find((p) => p.id === id)!;
