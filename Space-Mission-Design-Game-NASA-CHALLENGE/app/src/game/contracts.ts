/**
 * Mission contracts. Δv requirements come from the physics modules: Hohmann + Oberth departure from a
 * 200 km parking orbit for interplanetary targets; lunar values follow Apollo/Artemis practice
 * (TLI ≈ 3.15 km/s, lunar orbit insertion ≈ 0.85 km/s, powered descent ≈ 1.9 km/s).
 */
import { PLANETS } from "../physics/constants";
import { dvFromParking, hohmann, nextWindow, semiMajorAxis } from "../physics/orbits";
import type { LandingBody } from "../physics/landing";

export type Target = "moon" | "mars" | "venus" | "jupiter";

export interface Contract {
  id: string; title: string; client: string; target: Target;
  payloads: string[]; // allowed payload ids
  crew: number;
  reward: number; // M USD on success
  advance: number; // M USD paid on signature
  science: number; // science points on success
  dvDeparture: number; dvArrival: number; // m/s
  cruiseDays: number; // outbound leg
  /** Crewed missions only: days on the surface (or in lunar orbit) and the return leg to Earth. */
  surfaceDays?: number; returnDays?: number;
  landing: LandingBody | null;
  summary: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

const LEO = PLANETS.earth.radius + 200e3;
function interplanetary(target: "mars" | "venus" | "jupiter") {
  const h = hohmann(semiMajorAxis("earth"), semiMajorAxis(target));
  return { dvDeparture: dvFromParking(h.dv1, PLANETS.earth.gm, LEO), vInfArrival: h.dv2, cruiseDays: h.tof / 86400 };
}
const MARS = interplanetary("mars"), VENUS = interplanetary("venus"), JUP = interplanetary("jupiter");

export const CONTRACTS: Contract[] = [
  { id: "lunar-orbiter", title: "Orbitador de cartografía lunar", client: "Consorcio de Universidades Andinas", target: "moon",
    payloads: ["orbiter"], crew: 0, reward: 650, advance: 250, science: 300, dvDeparture: 3150, dvArrival: 850, cruiseDays: 4.5, landing: null, difficulty: 1,
    summary: "Poner un orbitador en órbita lunar para cartografiar los cráteres en sombra permanente del polo sur, candidatos a contener hielo." },
  { id: "lunar-lander", title: "Aterrizador científico en el polo sur lunar", client: "Agencia Espacial Latinoamericana", target: "moon",
    payloads: ["lunar-lander"], crew: 0, reward: 900, advance: 300, science: 500, dvDeparture: 3150, dvArrival: 2500, cruiseDays: 4.5, landing: "moon", difficulty: 2,
    summary: "Entregar un aterrizador con instrumentos de prospección de hielo en el borde de un cráter del polo sur." },
  { id: "mars-orbiter", title: "Orbitador climático de Marte", client: "Programa de Exploración de Marte", target: "mars",
    payloads: ["orbiter"], crew: 0, reward: 1300, advance: 400, science: 800, dvDeparture: MARS.dvDeparture, dvArrival: 1100, cruiseDays: MARS.cruiseDays, landing: null, difficulty: 2,
    summary: "Estudiar la atmósfera y las tormentas de polvo de Marte desde una órbita elíptica." },
  { id: "mars-rover", title: "Rover astrobiológico en un delta marciano", client: "Programa de Exploración de Marte", target: "mars",
    payloads: ["rover"], crew: 0, reward: 2600, advance: 700, science: 1500, dvDeparture: MARS.dvDeparture, dvArrival: 300, cruiseDays: MARS.cruiseDays, landing: "mars", difficulty: 3,
    summary: "Aterrizar un rover en un antiguo delta para buscar biofirmas y cachear muestras para su retorno." },
  { id: "venus-probe", title: "Sonda de descenso a Venus", client: "Consorcio Europeo de Ciencias Planetarias", target: "venus",
    payloads: ["orbiter"], crew: 0, reward: 1100, advance: 350, science: 700, dvDeparture: VENUS.dvDeparture, dvArrival: 300, cruiseDays: VENUS.cruiseDays, landing: "venus", difficulty: 2,
    summary: "Liberar una sonda que mida la atmósfera durante el descenso y sobreviva unos minutos en la superficie." },
  { id: "jupiter-flyby", title: "Sobrevuelo de Júpiter y sus lunas", client: "Instituto de Ciencias del Sistema Solar Exterior", target: "jupiter",
    payloads: ["orbiter"], crew: 0, reward: 2200, advance: 600, science: 1200, dvDeparture: JUP.dvDeparture, dvArrival: 0, cruiseDays: JUP.cruiseDays, landing: null, difficulty: 4,
    summary: "Cruzar el cinturón de asteroides y sobrevolar Júpiter para estudiar su magnetosfera y sus lunas heladas." },
  { id: "crew-flyby", title: "Sobrevuelo lunar tripulado", client: "Programa de Vuelos Tripulados", target: "moon",
    payloads: ["capsule", "crew-lander"], crew: 4, reward: 2400, advance: 900, science: 600, dvDeparture: 3150, dvArrival: 0, cruiseDays: 4.5, returnDays: 5.5, landing: null, difficulty: 3,
    summary: "Cuatro astronautas rodean la Luna en una trayectoria de retorno libre y vuelven a la Tierra (como Artemis II)." },
  { id: "crew-landing", title: "Alunizaje tripulado", client: "Programa de Vuelos Tripulados", target: "moon",
    payloads: ["crew-lander"], crew: 4, reward: 5200, advance: 1800, science: 2000, dvDeparture: 3150, dvArrival: 4300, cruiseDays: 4.5, surfaceDays: 3, returnDays: 4.5, landing: "moon", difficulty: 5,
    summary: "Llevar una tripulación a la superficie lunar y traerla de vuelta: el gran salto del programa." },
];

export const TARGET_LABEL: Record<Target, string> = { moon: "Luna", mars: "Marte", venus: "Venus", jupiter: "Júpiter" };

/** Next launch opportunity: interplanetary targets use the Hohmann phase-angle window; the Moon is available every day. */
export function launchWindow(c: Contract, fromMs: number): number | null {
  if (c.target === "moon") return fromMs;
  return nextWindow("earth", c.target, fromMs);
}
