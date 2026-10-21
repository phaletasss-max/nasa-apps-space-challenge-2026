/** Physical constants and body data (SI units). Sources: NASA planetary fact sheets, IAU/JPL GM values. */

export const AU = 1.495978707e11; // m
export const G0 = 9.80665; // m/s², standard gravity (rocket equation)
export const DAY = 86400; // s
export const SOLAR_CONSTANT = 1361; // W/m² at 1 AU

export interface Body {
  id: string;
  name: { en: string; es: string };
  gm: number; // m³/s²
  radius: number; // m (mean)
  color: string;
}

export const SUN: Body = { id: "sun", name: { en: "Sun", es: "Sol" }, gm: 1.32712440018e20, radius: 6.957e8, color: "#ffcc66" };

export const PLANETS: Record<string, Body> = {
  mercury: { id: "mercury", name: { en: "Mercury", es: "Mercurio" }, gm: 2.2032e13, radius: 2.4397e6, color: "#9c8f86" },
  venus: { id: "venus", name: { en: "Venus", es: "Venus" }, gm: 3.24859e14, radius: 6.0518e6, color: "#e8cf8f" },
  earth: { id: "earth", name: { en: "Earth", es: "Tierra" }, gm: 3.986004418e14, radius: 6.371e6, color: "#4f8cff" },
  mars: { id: "mars", name: { en: "Mars", es: "Marte" }, gm: 4.282837e13, radius: 3.3895e6, color: "#e0643c" },
  jupiter: { id: "jupiter", name: { en: "Jupiter", es: "Júpiter" }, gm: 1.26686534e17, radius: 6.9911e7, color: "#d8b38a" },
  saturn: { id: "saturn", name: { en: "Saturn", es: "Saturno" }, gm: 3.7931187e16, radius: 5.8232e7, color: "#e6d29a" },
};

/**
 * Keplerian elements and rates per Julian century (J2000), valid 1800–2050.
 * Standish, E. M., "Keplerian Elements for Approximate Positions of the Major Planets", JPL/SSD (Table 1).
 * [a (au), e, I (deg), L (deg), long. perihelion ϖ (deg), long. ascending node Ω (deg)]
 */
export const ELEMENTS: Record<string, { el: number[]; rate: number[] }> = {
  mercury: { el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  venus: { el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
  earth: { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  mars: { el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  jupiter: { el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  saturn: { el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
};
