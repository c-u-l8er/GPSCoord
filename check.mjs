/* ==========================================================================
   GPSCoord arithmetic check. No dependencies, no network.

       node check.mjs

   It re-proves src/coord.mjs against the frozen records in records/ — the
   residue of a one-time comparison against PROJ 9.5.1, NGA GEOTRANS and
   GeographicLib (see records/verification.json) — and then runs the property
   checks that a wrong-but-self-consistent implementation would still fail.
   Round-tripping alone proves nothing: a converter can be wrong and round-trip
   perfectly. That is why the frozen external values are here.
   ========================================================================== */
import { readFileSync } from "fs";
import * as C from "./src/coord.mjs";

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const points = J("./records/reference-points.json").points;
const pairs = J("./records/reference-pairs.json").pairs;

let pass = 0, fail = 0;
function T(name, ok, detail = "") {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
    ok ? pass++ : fail++;
}

/* ---------- 1. the frozen external reference values ---------- */
for (const p of points) {
    const u = C.toUTM(p.lat, p.lon);
    const m = C.toMGRS(p.lat, p.lon, 5);
    T(`UTM   ${p.name}`,
        u.ok && u.zone === p.zone && u.band === p.band &&
        +u.easting.toFixed(3) === p.easting && +u.northing.toFixed(3) === p.northing,
        u.ok ? `${u.zone}${u.band} ${u.easting.toFixed(3)} ${u.northing.toFixed(3)}` : u.reason);
    T(`MGRS  ${p.name}`, m.ok && m.text === p.mgrs, m.ok ? m.text : m.reason);
    // The formatted notations are checked as STRINGS, not as numbers. A helper
    // that returns the right value in the wrong shape reads as "[object Object]"
    // on the page and as a passing numeric test everywhere else.
    const dms = C.toDMS(p.lat, true).text + " " + C.toDMS(p.lon, false).text;
    const ddm = C.toDDM(p.lat, true).text + " " + C.toDDM(p.lon, false).text;
    T(`DMS   ${p.name}`, dms === p.dms, dms);
    T(`DDM   ${p.name}`, ddm === p.ddm, ddm);
}

for (const q of pairs) {
    const v = C.vincentyInverse(q.from[0], q.from[1], q.to[0], q.to[1]);
    T(`GEO   ${q.name}`,
        v.ok &&
        +v.distanceM.toFixed(3) === q.distanceM &&
        +v.initialBearing.toFixed(6) === q.initialBearing &&
        +v.finalBearing.toFixed(6) === q.finalBearing,
        v.ok ? `${(v.distanceM / 1000).toFixed(3)} km, ${v.initialBearing.toFixed(4)}° → ${v.finalBearing.toFixed(4)}°` : v.reason);
}

/* ---------- 2. properties, over a deterministic sample ---------- */
let seed = 20260816;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const sample = [];
for (let i = 0; i < 3000; i++) sample.push([-80 + rnd() * 164, -180 + rnd() * 360]);

let worstRT = 0, mgrsBad = 0, bandBad = 0;
for (const [lat, lon] of sample) {
    const u = C.toUTM(lat, lon);
    const back = C.fromUTM(u.zone, u.hemisphere, u.easting, u.northing);
    // Degrees of latitude are ~111 km; this converts the error to metres.
    const err = Math.hypot(
        (back.lat - lat) * 111320,
        (back.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180)
    );
    if (err > worstRT) worstRT = err;

    const m = C.toMGRS(lat, lon, 5);
    const rt = C.parseMGRS(m.text);
    // A 5-digit MGRS names a 1 m cell by its southwest corner, so ~1.5 m is the
    // most the round trip can be expected to preserve.
    if (!rt.ok || Math.hypot((rt.lat - lat) * 111320, (rt.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180)) > 1.5) mgrsBad++;
    if (m.band !== C.latBand(lat)) bandBad++;
}
T("UTM round trip closes", worstRT < 1e-6, `worst ${(worstRT * 1000).toExponential(2)} mm over ${sample.length} points`);
T("MGRS round trip lands in its own cell", mgrsBad === 0, `${mgrsBad} outside 1.5 m`);
T("MGRS band always matches the latitude band", bandBad === 0);

// MGRS -> lat/lon -> MGRS must return the SAME STRING. It did not: a northing
// that should have been exactly 8 682 999 arrived as 8 682 998.999999996 and
// truncation ate a whole metre. Round-trip closure in metres would not have
// caught it, because 1 m is inside every tolerance in this file.
let notIdempotent = 0, example = "";
for (const [lat, lon] of sample) {
    const first = C.toMGRS(lat, lon, 5).text;
    const back = C.parseMGRS(first);
    const again = C.toMGRS(back.lat, back.lon, 5).text;
    if (first !== again) { notIdempotent++; if (!example) example = `${first} -> ${again}`; }
}
T("MGRS re-encoding is idempotent", notIdempotent === 0, notIdempotent ? example : `${sample.length} strings stable`);

/* ---------- 3. things that must be refused, not guessed ---------- */
T("UTM refuses north of 84°N", C.toUTM(85, 0).ok === false);
T("UTM refuses south of 80°S", C.toUTM(-81, 0).ok === false);
T("MGRS refuses outside its band", C.toMGRS(88, 0).ok === false);
T("Vincenty refuses a near-antipodal pair rather than guessing",
    C.vincentyInverse(0, 0, 0, 179.99999).ok === false);
T("MGRS rejects an odd-length numeric part", C.parseMGRS("14RPT003137145").ok === false);
T("MGRS rejects the letters I and O", C.parseMGRS("14RIT0031371453").ok === false);
T("parser rejects an out-of-range latitude", C.parseCoordinateInput("91, 0").ok === false);
T("parser rejects an out-of-range longitude", C.parseCoordinateInput("0, 181").ok === false);
T("parser rejects prose", C.parseCoordinateInput("somewhere near the docks").ok === false);

/* ---------- 4. the input parser reads every notation the page advertises ---------- */
const SEGUIN = [29.5688, -97.9644];
const NOTATIONS = [
    ["29.5688, -97.9644", 1e-9],
    ["29.5688 -97.9644", 1e-9],
    ["N29.5688 W97.9644", 1e-9],
    ["W97.9644 N29.5688", 1e-9],
    ["29°34'7.68\"N 97°57'51.84\"W", 1e-9],
    ["29 34 7.68 -97 57 51.84", 1e-9],
    ["29 34.128 N, 97 57.864 W", 1e-9],
    ["14N 600313 3271453", 2e-4],
    ["14RPT0031371453", 2e-4],
    ["14R PT 00313 71453", 2e-4],
];
for (const [text, tol] of NOTATIONS) {
    const r = C.parseCoordinateInput(text);
    T(`parse  ${text}`,
        r.ok && Math.abs(r.lat - SEGUIN[0]) < tol && Math.abs(r.lon - SEGUIN[1]) < tol,
        r.ok ? `${r.kind} ${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}` : r.reason);
}

/* ---------- 5. the documented zone irregularities ---------- */
T("zone 32 is widened over southwest Norway", C.utmZone(60.39, 5.32) === 32);
T("Svalbard 0–9°E is zone 31", C.utmZone(78, 5) === 31);
T("Svalbard 9–21°E is zone 33", C.utmZone(78, 15.63) === 33);
T("Svalbard 21–33°E is zone 35", C.utmZone(78, 25) === 35);
T("Svalbard 33–42°E is zone 37", C.utmZone(78, 38) === 37);
T("zone 32 does not swallow the same longitudes below 56°N", C.utmZone(50, 5.32) === 31);

/* ---------- 6. the origin, which has a known exact answer ---------- */
const origin = C.toUTM(0, 3);
T("the equator on zone 31's central meridian is exactly the false origin",
    origin.easting === 500000 && origin.northing === 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
