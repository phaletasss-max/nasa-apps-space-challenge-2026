import type { Aoi, LayerId } from "./types";

export interface Story {
  id: string;
  aoi: Aoi;
  year: number;
  layer: LayerId;
  title: { en: string; es: string };
  text: { en: string; es: string };
}

/** Curated entry points. Numbers are never hard-coded here: the panel computes them live from the data. */
export const STORIES: Story[] = [
  {
    id: "savanna", aoi: { kind: "biome", key: "B7" }, year: 2024, layer: "peak",
    title: { en: "The planet's fire engine", es: "El motor de fuego del planeta" },
    text: {
      en: "Tropical savannas burn more than any other biome. Switch to Peak fire month: the season flips between the northern and southern hemispheres.",
      es: "Las sabanas tropicales arden más que cualquier otro bioma. Mira el mes pico: la temporada se invierte entre el hemisferio norte y el sur.",
    },
  },
  {
    id: "canada", aoi: { kind: "country", a3: "CAN" }, year: 2023, layer: "activity",
    title: { en: "Canada 2023: an off-the-charts season", es: "Canadá 2023: una temporada fuera de escala" },
    text: {
      en: "Canada's 2023 wildfire season was the most extensive on record. See how far 2023 sits above 25 years of harmonized history.",
      es: "La temporada 2023 de Canadá fue la más extensa registrada. Mira cuán por encima de 25 años de historia armonizada queda 2023.",
    },
  },
  {
    id: "australia", aoi: { kind: "bbox", bounds: [145, -38.5, 154, -27.5], label: "SE Australia · Black Summer" }, year: 2019, layer: "activity",
    title: { en: "Australia's Black Summer", es: "El Verano Negro de Australia" },
    text: {
      en: "The 2019–20 fires in south-eastern Australia appear as a block of extreme months from late 2019 into January 2020.",
      es: "Los incendios de 2019–20 en el sureste de Australia aparecen como un bloque de meses extremos entre fines de 2019 y enero de 2020.",
    },
  },
  {
    id: "yakutia", aoi: { kind: "bbox", bounds: [105, 56, 150, 72], label: "Siberia · Sakha (Yakutia)" }, year: 2021, layer: "trend",
    title: { en: "Fire moves north: Siberia", es: "El fuego avanza al norte: Siberia" },
    text: {
      en: "Boreal forests in Sakha (Yakutia) saw record fires in 2021. Check the 25-year trend layer across the high latitudes.",
      es: "Los bosques boreales de Sakha (Yakutia) tuvieron incendios récord en 2021. Revisa la capa de tendencia en las latitudes altas.",
    },
  },
  {
    id: "indonesia", aoi: { kind: "country", a3: "IDN" }, year: 2015, layer: "activity",
    title: { en: "Indonesia 2015: El Niño and peat", es: "Indonesia 2015: El Niño y turberas" },
    text: {
      en: "During the 2015 El Niño drought, peatland fires in Sumatra and Kalimantan exploded. September and October 2015 stand out as critical months, near 3× normal.",
      es: "Con la sequía de El Niño 2015 se dispararon los incendios en turberas de Sumatra y Kalimantan. Setiembre y octubre de 2015 resaltan como meses críticos, cerca de 3× lo normal.",
    },
  },
  {
    id: "pantanal", aoi: { kind: "bbox", bounds: [-58.5, -22, -54.5, -15.5], label: "Pantanal wetlands" }, year: 2020, layer: "activity",
    title: { en: "Pantanal: a wetland on fire", es: "Pantanal: un humedal en llamas" },
    text: {
      en: "The world's largest tropical wetland burned on an unprecedented scale in 2020, and again in 2024.",
      es: "El mayor humedal tropical del mundo ardió a una escala sin precedentes en 2020, y otra vez en 2024.",
    },
  },
  {
    id: "bolivia", aoi: { kind: "country", a3: "BOL" }, year: 2024, layer: "activity",
    title: { en: "Bolivia 2024", es: "Bolivia 2024" },
    text: {
      en: "Severe drought in 2024 drove one of Bolivia's worst fire years. Compare the season with its 25-year range.",
      es: "Una sequía severa en 2024 provocó uno de los peores años de fuego de Bolivia. Compara la temporada con su rango de 25 años.",
    },
  },
  {
    id: "peru", aoi: { kind: "bbox", bounds: [-79.6, -10.4, -76.9, -3.4], label: "Northern Andes of Peru" }, year: 2024, layer: "week",
    title: { en: "Where we started: the Peruvian Andes", es: "Donde empezamos: los Andes del Perú" },
    text: {
      en: "September 2024 brought an emergency wave of fires to the northern Andes of Peru. Then check what the satellites see this week.",
      es: "Setiembre de 2024 trajo una ola de incendios de emergencia a los Andes del norte del Perú. Luego mira lo que ven los satélites esta semana.",
    },
  },
];
