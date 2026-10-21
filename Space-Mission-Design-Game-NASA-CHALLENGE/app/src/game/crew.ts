/** Astronaut candidates: deterministic generation from a seed (names, roles, skills, traits). */
import { rngFrom } from "./rng";

export type Role = "commander" | "pilot" | "engineer" | "scientist" | "doctor";
export const ROLE_LABEL: Record<Role, string> = {
  commander: "Comandante", pilot: "Piloto", engineer: "Ingeniería de vuelo", scientist: "Especialista científico", doctor: "Oficial médico",
};
export const ROLE_COLOR: Record<Role, string> = { commander: "#e8c55a", pilot: "#5aa8e8", engineer: "#e8875a", scientist: "#7ad18a", doctor: "#e86a7e" };

export interface Skills { piloting: number; engineering: number; science: number; medicine: number; leadership: number }

export interface Astronaut {
  id: string; name: string; role: Role; age: number; country: string; skills: Skills;
  trait: string; salary: number; // M USD per year
  hired: boolean; training: number; // 0..1
  flights: number;
  lost?: boolean; // died in a mission accident
}

const FIRST = ["Valeria", "Mateo", "Camila", "Diego", "Lucía", "Andrés", "Sofía", "Tomás", "Ana", "Rafael", "Isabel", "Kenji", "Amara", "Lars", "Priya", "Omar", "Elena", "Jonas", "Nia", "Hugo", "Yara", "Chen", "Maya", "Iván"];
const LAST = ["Quispe", "Ramírez", "Mamani", "Torres", "Vargas", "Rojas", "Huamán", "Castillo", "Tanaka", "Okafor", "Lindqvist", "Sharma", "Haddad", "Novak", "Moreau", "Silva", "Mendoza", "Kaur", "Ferreira", "Nakamura", "Adeyemi", "Correa", "Ibarra", "Wójcik"];
const COUNTRY = ["Perú", "Chile", "México", "Argentina", "Colombia", "Brasil", "Japón", "Nigeria", "Suecia", "India", "Marruecos", "Francia", "Canadá", "España", "Kenia", "Corea del Sur"];
const TRAITS = [
  "Calma bajo presión", "Meticulosa con los procedimientos", "Sociable: sube la moral", "Resistente al aislamiento",
  "Duerme poco y rinde igual", "Creativa resolviendo averías", "Perfeccionista", "Excelente comunicadora con la Tierra",
];

const PRIMARY: Record<Role, keyof Skills> = { commander: "leadership", pilot: "piloting", engineer: "engineering", scientist: "science", doctor: "medicine" };

export function generateCandidates(seed: number, n = 14): Astronaut[] {
  const r = rngFrom(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const roles: Role[] = ["commander", "pilot", "engineer", "scientist", "doctor"];
  const used = new Set<string>();
  return Array.from({ length: n }, (_, k) => {
    const role = roles[k % roles.length];
    let name = "";
    do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (used.has(name));
    used.add(name);
    const base = () => Math.round(3 + r() * 4);
    const skills: Skills = { piloting: base(), engineering: base(), science: base(), medicine: base(), leadership: base() };
    skills[PRIMARY[role]] = Math.round(7 + r() * 3);
    if (role === "commander") skills.piloting = Math.max(skills.piloting, 7);
    const total = Object.values(skills).reduce((a, b) => a + b, 0);
    return {
      id: `a${k}`, name, role, age: 31 + Math.floor(r() * 18), country: pick(COUNTRY), skills, trait: pick(TRAITS),
      salary: Math.round((0.12 + total * 0.004) * 100) / 100, hired: false, training: 0, flights: Math.floor(r() * 3),
    };
  });
}

/** Days of mission-specific training needed (shorter for veterans). */
export const trainingDays = (a: Astronaut) => Math.max(90, 240 - a.flights * 50);
