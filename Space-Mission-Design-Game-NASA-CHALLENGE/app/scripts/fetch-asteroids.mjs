// Downloads real orbital elements from the NASA/JPL Small-Body Database (SBDB) Query API
// and writes a compact catalogue for the route-hazard predictor.
//   node scripts/fetch-asteroids.mjs
// Sets: (1) inner-solar-system asteroids (a < 6 au: main belt, Hildas, Jupiter Trojans) with H < 12.5 (~10–20 km and up)
//       (2) near-Earth asteroids with H < 19 (roughly > 0.5–1 km)
import { writeFileSync } from "node:fs";

const API = "https://ssd-api.jpl.nasa.gov/sbdb_query.api";
const FIELDS = "full_name,a,e,i,om,w,ma,epoch,H,diameter,neo,pha,class";

async function query(cdata, extra = {}) {
  const p = new URLSearchParams({ fields: FIELDS, "sb-kind": "a", "full-prec": "true", "sb-cdata": JSON.stringify(cdata), ...extra });
  const r = await fetch(`${API}?${p}`);
  if (!r.ok) throw new Error(`SBDB HTTP ${r.status}`);
  const j = await r.json();
  console.log(`${j.count} objects for ${JSON.stringify(cdata)} ${JSON.stringify(extra)}`);
  return j.data;
}

const big = await query({ AND: ["H|LT|12.5", "a|LT|6"] });
const neo = await query({ AND: ["H|LT|19"] }, { "sb-group": "neo" });

const seen = new Set();
const rows = [];
for (const r of [...big, ...neo]) {
  const name = r[0].trim();
  if (seen.has(name)) continue;
  seen.add(name);
  const num = (v, d = 6) => (v === null || v === "" ? null : Number(Number(v).toFixed(d)));
  rows.push([name.replace(/\s+/g, " "), num(r[1], 7), num(r[2], 7), num(r[3], 5), num(r[4], 5), num(r[5], 5), num(r[6], 5),
    num(r[7], 1), num(r[8], 2), num(r[9], 3), r[10] === "Y" ? 1 : 0, r[11] === "Y" ? 1 : 0, r[12]]);
}
const out = {
  source: "NASA/JPL Small-Body Database Query API (ssd-api.jpl.nasa.gov)",
  fetched: new Date().toISOString().slice(0, 10),
  fields: ["name", "a_au", "e", "i_deg", "node_deg", "peri_deg", "M_deg", "epoch_jd", "H", "diameter_km", "neo", "pha", "class"],
  data: rows,
};
writeFileSync(new URL("../src/data/asteroids.json", import.meta.url), JSON.stringify(out));
console.log(`wrote ${rows.length} asteroids`);
