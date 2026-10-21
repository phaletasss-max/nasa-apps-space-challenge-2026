/**
 * Facts and appearance of each world. Physical values rounded from the NASA Planetary Fact Sheet
 * (nssdc.gsfc.nasa.gov/planetary/factsheet). Rotation: IAU WGCCRE prime-meridian models W = W0 + Ẇ·d
 * (d = days since J2000), good enough for visuals. Textures: Solar System Scope (CC BY 4.0), based on NASA data.
 */

export interface World {
  id: string;
  name: string;
  kind: string;
  texture: string;
  diameterKm: number;
  gravity: number; // m/s²
  dayHours: string; // human-readable length of day
  yearDays: number | null;
  tempC: string;
  atmosphere: string;
  moons: string;
  missions: string;
  fact: string;
  tiltDeg: number; // obliquity
  W0: number; // deg
  Wdot: number; // deg/day (negative = retrograde)
  landing: "mars" | "moon" | "venus" | null;
  noLanding?: string;
}

export const WORLDS: Record<string, World> = {
  sun: {
    id: "sun", name: "Sol", kind: "Estrella enana amarilla (G2V)", texture: "sun.jpg", diameterKm: 1392700, gravity: 274,
    dayHours: "~25 días (ecuador)", yearDays: null, tempC: "5 500 °C en la superficie", atmosphere: "Plasma de hidrógeno y helio",
    moons: "8 planetas", missions: "SOHO, Solar Dynamics Observatory, Parker Solar Probe, Solar Orbiter",
    fact: "Contiene el 99.8 % de la masa del sistema solar. La Parker Solar Probe es el objeto humano que más se le ha acercado.",
    tiltDeg: 7.25, W0: 84.176, Wdot: 14.1844, landing: null, noLanding: "No hay superficie sólida… y está a 5 500 °C.",
  },
  mercury: {
    id: "mercury", name: "Mercurio", kind: "Planeta rocoso", texture: "mercury.jpg", diameterKm: 4879, gravity: 3.7,
    dayHours: "176 días terrestres (día solar)", yearDays: 88, tempC: "−180 °C a 430 °C", atmosphere: "Exosfera casi inexistente",
    moons: "0", missions: "Mariner 10, MESSENGER, BepiColombo (en ruta)",
    fact: "Su día solar dura dos de sus años: en Mercurio el Sol sale, se detiene y retrocede en el cielo.",
    tiltDeg: 0.03, W0: 329.5469, Wdot: 6.1385025, landing: null, noLanding: "Ninguna misión ha aterrizado en Mercurio todavía.",
  },
  venus: {
    id: "venus", name: "Venus", kind: "Planeta rocoso", texture: "venus_atmosphere.jpg", diameterKm: 12104, gravity: 8.9,
    dayHours: "117 días terrestres (gira al revés)", yearDays: 224.7, tempC: "464 °C (media)", atmosphere: "96.5 % CO₂, presión 92 veces la de la Tierra",
    moons: "0", missions: "Venera, Pioneer Venus, Magellan, Akatsuki; próximas: VERITAS, DAVINCI",
    fact: "Es el planeta más caliente: su efecto invernadero desbocado funde el plomo. Las sondas Venera sobrevivieron hasta ~2 h.",
    tiltDeg: 177.4, W0: 160.2, Wdot: -1.4813688, landing: "venus",
  },
  earth: {
    id: "earth", name: "Tierra", kind: "Planeta rocoso", texture: "earth_daymap.jpg", diameterKm: 12756, gravity: 9.8,
    dayHours: "24 h", yearDays: 365.25, tempC: "15 °C (media)", atmosphere: "78 % N₂, 21 % O₂",
    moons: "1", missions: "Miles de satélites; Terra, Aqua, Suomi NPP observan el fuego que viste en FireCal",
    fact: "El único lugar conocido con vida. Desde la Luna se ve del tamaño de una moneda a un brazo de distancia.",
    tiltDeg: 23.44, W0: 190.147, Wdot: 360.9856235, landing: null, noLanding: "Es nuestro punto de partida: todas las misiones despegan desde aquí.",
  },
  moon: {
    id: "moon", name: "Luna", kind: "Satélite natural", texture: "moon.jpg", diameterKm: 3475, gravity: 1.62,
    dayHours: "29.5 días terrestres", yearDays: 27.3, tempC: "−173 °C a 127 °C", atmosphere: "Ninguna (exosfera)",
    moons: "—", missions: "Apollo (12 astronautas), Lunar Reconnaissance Orbiter, Chang'e, Chandrayaan-3, Artemis",
    fact: "Siempre nos muestra la misma cara. El Apollo 11 aterrizó con apenas ~25 s de combustible de margen.",
    tiltDeg: 6.68, W0: 38.3213, Wdot: 13.17635815, landing: "moon",
  },
  mars: {
    id: "mars", name: "Marte", kind: "Planeta rocoso", texture: "mars.jpg", diameterKm: 6792, gravity: 3.7,
    dayHours: "24 h 40 min (un sol)", yearDays: 687, tempC: "−65 °C (media)", atmosphere: "95 % CO₂, presión ~0.6 % de la terrestre",
    moons: "2 (Fobos y Deimos)", missions: "Viking, Spirit, Opportunity, Curiosity, Perseverance, Ingenuity",
    fact: "Tiene el volcán más alto del sistema solar (Olympus Mons, ~22 km) y un cañón de 4 000 km (Valles Marineris).",
    tiltDeg: 25.19, W0: 176.63, Wdot: 350.89198226, landing: "mars",
  },
  jupiter: {
    id: "jupiter", name: "Júpiter", kind: "Gigante gaseoso", texture: "jupiter.jpg", diameterKm: 142984, gravity: 24.8,
    dayHours: "9 h 56 min", yearDays: 4331, tempC: "−110 °C (cima de nubes)", atmosphere: "~90 % H₂, ~10 % He",
    moons: "95+", missions: "Pioneer, Voyager, Galileo, Juno; en ruta: Europa Clipper, JUICE",
    fact: "La Gran Mancha Roja es una tormenta más grande que la Tierra. Juno lo orbita desde 2016.",
    tiltDeg: 3.13, W0: 284.95, Wdot: 870.536, landing: null, noLanding: "Es un gigante gaseoso: no tiene superficie donde posarse.",
  },
  saturn: {
    id: "saturn", name: "Saturno", kind: "Gigante gaseoso", texture: "saturn.jpg", diameterKm: 120536, gravity: 10.4,
    dayHours: "10 h 33 min", yearDays: 10747, tempC: "−140 °C (cima de nubes)", atmosphere: "~96 % H₂, ~3 % He",
    moons: "146+", missions: "Pioneer 11, Voyager, Cassini–Huygens; próxima: Dragonfly a Titán",
    fact: "Es tan poco denso que flotaría en una bañera gigante. Sus anillos miden ~280 000 km pero solo ~10 m de espesor.",
    tiltDeg: 26.73, W0: 38.9, Wdot: 810.7939024, landing: null, noLanding: "Gigante gaseoso: sin superficie. (Huygens sí aterrizó en su luna Titán.)",
  },
};

export const daysSinceJ2000 = (ms: number) => (ms - Date.UTC(2000, 0, 1, 12)) / 86400000;

/** Prime-meridian angle (rad) at a date. */
export const spinAngle = (w: World, ms: number) => ((w.W0 + w.Wdot * daysSinceJ2000(ms)) * Math.PI) / 180;

/** Approximate geocentric ecliptic longitude of the Moon (deg, mean elements) and its distance (km). */
export function moonGeocentric(ms: number): { lonRad: number; latRad: number; km: number } {
  const d = daysSinceJ2000(ms);
  const L = 218.316 + 13.176396 * d; // mean longitude
  const M = 134.963 + 13.064993 * d; // mean anomaly
  const F = 93.272 + 13.22935 * d; // argument of latitude
  const rad = Math.PI / 180;
  const lon = L + 6.289 * Math.sin(M * rad);
  const lat = 5.128 * Math.sin(F * rad);
  const km = 385001 - 20905 * Math.cos(M * rad);
  return { lonRad: lon * rad, latRad: lat * rad, km };
}
