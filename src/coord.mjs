/* ============================================================
   GPSCoord coordinate math — pure functions, no dependencies.
   WGS84 only. Every function here is exercised by test/check.mjs.
   ============================================================ */

const A_AXIS = 6378137.0;
const F_FLAT = 1 / 298.257223563;
const K0 = 0.9996;
const E_SQ = F_FLAT * (2 - F_FLAT);
const B_AXIS = A_AXIS * (1 - F_FLAT);

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/* ---------- Krüger series constants (order 6) ---------- */
const N_THIRD = F_FLAT / (2 - F_FLAT);
const n = N_THIRD;
const n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;

const A_RECT =
    (A_AXIS / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);

const ALPHA = [
    n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4 - (127 / 288) * n5 + (7891 / 37800) * n6,
    (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4 + (281 / 630) * n5 - (1983433 / 1935360) * n6,
    (61 / 240) * n3 - (103 / 140) * n4 + (15061 / 26880) * n5 + (167603 / 181440) * n6,
    (49561 / 161280) * n4 - (179 / 168) * n5 + (6601661 / 7257600) * n6,
    (34729 / 80640) * n5 - (3418889 / 1995840) * n6,
    (212378941 / 319334400) * n6,
];

const BETA = [
    n / 2 - (2 / 3) * n2 + (37 / 96) * n3 - (1 / 360) * n4 - (81 / 512) * n5 + (96199 / 604800) * n6,
    (1 / 48) * n2 + (1 / 15) * n3 - (437 / 1440) * n4 + (46 / 105) * n5 - (1118711 / 3870720) * n6,
    (17 / 480) * n3 - (37 / 840) * n4 - (209 / 4480) * n5 + (5569 / 90720) * n6,
    (4397 / 161280) * n4 - (11 / 504) * n5 - (830251 / 7257600) * n6,
    (4583 / 161280) * n5 - (108847 / 3991680) * n6,
    (20648693 / 638668800) * n6,
];

const DELTA = [
    2 * n - (2 / 3) * n2 - 2 * n3 + (116 / 45) * n4 + (26 / 45) * n5 - (2854 / 675) * n6,
    (7 / 3) * n2 - (8 / 5) * n3 - (227 / 45) * n4 + (2704 / 315) * n5 + (2323 / 945) * n6,
    (56 / 15) * n3 - (136 / 35) * n4 - (1262 / 105) * n5 + (73814 / 2835) * n6,
    (4279 / 630) * n4 - (332 / 35) * n5 - (399572 / 14175) * n6,
    (4174 / 315) * n5 - (144838 / 6237) * n6,
    (601676 / 22275) * n6,
];

/* ---------- UTM zone selection, including the two documented exceptions ---------- */
export function utmZone(lat, lon) {
    let z = Math.floor((lon + 180) / 6) + 1;
    if (z > 60) z = 60;
    if (z < 1) z = 1;
    // Southwest Norway: zone 32 is widened westward.
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
    // Svalbard: zones 32, 34 and 36 are absorbed by their neighbours.
    if (lat >= 72 && lat < 84) {
        if (lon >= 0 && lon < 9) z = 31;
        else if (lon >= 9 && lon < 21) z = 33;
        else if (lon >= 21 && lon < 33) z = 35;
        else if (lon >= 33 && lon < 42) z = 37;
    }
    return z;
}

const BANDS = "CDEFGHJKLMNPQRSTUVWX";

export function latBand(lat) {
    if (lat < -80 || lat > 84) return null;
    if (lat >= 72) return "X";
    return BANDS[Math.floor((lat + 80) / 8)];
}

/* ---------- DD -> UTM ---------- */
export function toUTM(lat, lon, forceZone) {
    if (lat < -80 || lat > 84) {
        return { ok: false, reason: "UTM is undefined outside 80°S–84°N." };
    }
    const zone = forceZone || utmZone(lat, lon);
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const phi = rad(lat);
    const dl = rad(lon - lon0);

    const sinPhi = Math.sin(phi);
    const sq = 2 * Math.sqrt(n) / (1 + n);
    const t = Math.sinh(Math.atanh(sinPhi) - sq * Math.atanh(sq * sinPhi));

    const xiP = Math.atan2(t, Math.cos(dl));
    const etaP = Math.asinh(Math.sin(dl) / Math.hypot(t, Math.cos(dl)));

    let xi = xiP, eta = etaP;
    for (let j = 1; j <= 6; j++) {
        xi += ALPHA[j - 1] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
        eta += ALPHA[j - 1] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
    }

    let x = K0 * A_RECT * eta + 500000;
    let y = K0 * A_RECT * xi;
    const north = lat >= 0;
    if (!north) y += 10000000;

    return {
        ok: true, zone, band: latBand(lat), hemisphere: north ? "N" : "S",
        easting: x, northing: y,
    };
}

/* ---------- UTM -> DD ---------- */
export function fromUTM(zone, hemisphere, easting, northing) {
    const north = String(hemisphere).toUpperCase() !== "S";
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const y = north ? northing : northing - 10000000;

    const xi = y / (K0 * A_RECT);
    const eta = (easting - 500000) / (K0 * A_RECT);

    let xiP = xi, etaP = eta;
    for (let j = 1; j <= 6; j++) {
        xiP -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
        etaP -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }

    const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
    let phi = chi;
    for (let j = 1; j <= 6; j++) phi += DELTA[j - 1] * Math.sin(2 * j * chi);

    const lam = Math.atan2(Math.sinh(etaP), Math.cos(xiP));
    return { lat: deg(phi), lon: lon0 + deg(lam) };
}

/* ---------- MGRS ---------- */
const COL_SETS = ["ABCDEFGH", "JKLMNPQR", "STUVWXYZ"];
const ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUV";

export function toMGRS(lat, lon, digits = 5) {
    const u = toUTM(lat, lon);
    if (!u.ok) return { ok: false, reason: u.reason };
    const band = latBand(lat);
    if (!band) return { ok: false, reason: "MGRS is undefined outside 80°S–84°N." };

    // MGRS is defined by TRUNCATION, so a value that should be exactly
    // 8 682 999 but arrives as 8 682 998.999999996 loses a whole metre.
    // Round to the nearest micrometre first — finer than any coordinate is
    // ever specified — and truncate that. Without this, MGRS -> lat/lon ->
    // MGRS is not idempotent, which is checked in check.mjs.
    const E = Math.round(u.easting * 1e6) / 1e6;
    const N = Math.round(u.northing * 1e6) / 1e6;

    const e100k = Math.floor(E / 100000);
    const n100k = Math.floor(N / 100000);
    const colLetter = COL_SETS[(u.zone - 1) % 3][e100k - 1];
    let rowIdx = n100k % 20;
    if (u.zone % 2 === 0) rowIdx = (rowIdx + 5) % 20;
    const rowLetter = ROW_LETTERS[rowIdx];

    const div = Math.pow(10, 5 - digits);
    const e = Math.floor((E % 100000) / div);
    const nn = Math.floor((N % 100000) / div);
    const pad = (v) => String(v).padStart(digits, "0");

    // NGA / GEOTRANS write the zone with two digits. Match them.
    const z2 = String(u.zone).padStart(2, "0");
    return {
        ok: true,
        zone: u.zone, band, square: colLetter + rowLetter,
        easting: pad(e), northing: pad(nn),
        text: `${z2}${band}${colLetter}${rowLetter}${pad(e)}${pad(nn)}`,
        spaced: `${z2}${band} ${colLetter}${rowLetter} ${pad(e)} ${pad(nn)}`,
    };
}

/* Minimum UTM northing anywhere in a latitude band, used to resolve the
   2 000 000 m ambiguity in the row letter. Northing is minimised at the
   central meridian, so that is where we evaluate the band's south edge. */
function bandFloorNorthing(zone, band) {
    const i = BANDS.indexOf(band);
    const southLat = -80 + 8 * i;
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const u = toUTM(southLat, lon0, zone);
    return Math.floor(u.northing / 100000) * 100000;
}

export function parseMGRS(text) {
    const s = String(text).toUpperCase().replace(/[\s,]/g, "");
    const m = s.match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/);
    if (!m) return { ok: false, reason: "Not a well-formed MGRS reference." };
    const zone = parseInt(m[1], 10);
    if (zone < 1 || zone > 60) return { ok: false, reason: "MGRS zone must be 1–60." };
    const band = m[2], col = m[3], row = m[4], nums = m[5];
    if (nums.length % 2 !== 0 || nums.length > 10) {
        return { ok: false, reason: "MGRS numeric part must be an even number of digits, 0–10." };
    }
    const digits = nums.length / 2;
    const colIdx = COL_SETS[(zone - 1) % 3].indexOf(col);
    if (colIdx < 0) return { ok: false, reason: `Column letter ${col} is not valid in zone ${zone}.` };
    let rowIdx = ROW_LETTERS.indexOf(row);
    if (zone % 2 === 0) rowIdx = (rowIdx - 5 + 20) % 20;

    const mult = digits ? Math.pow(10, 5 - digits) : 100000;
    const eRest = digits ? parseInt(nums.slice(0, digits), 10) * mult : 0;
    const nRest = digits ? parseInt(nums.slice(digits), 10) * mult : 0;

    const easting = (colIdx + 1) * 100000 + eRest;
    let northing = rowIdx * 100000 + nRest;
    const floorN = bandFloorNorthing(zone, band);
    while (northing < floorN) northing += 2000000;

    const hemisphere = band >= "N" ? "N" : "S";
    const ll = fromUTM(zone, hemisphere, easting, northing);
    return {
        ok: true, zone, band, square: col + row, easting, northing,
        hemisphere, precisionM: digits ? mult : 100000,
        lat: ll.lat, lon: ll.lon,
    };
}

/* ---------- DMS / DDM formatting ---------- */
export function toDMS(v, isLat, decimals = 2) {
    const hemi = isLat ? (v < 0 ? "S" : "N") : (v < 0 ? "W" : "E");
    let a = Math.abs(v);
    let d = Math.floor(a);
    let mFloat = (a - d) * 60;
    let mi = Math.floor(mFloat);
    let sec = (mFloat - mi) * 60;
    // carry, so 59'59.999" never prints as 60
    if (Number(sec.toFixed(decimals)) >= 60) { sec = 0; mi += 1; }
    if (mi >= 60) { mi = 0; d += 1; }
    return { d, m: mi, s: sec, hemi,
        text: `${d}°${String(mi).padStart(2, "0")}'${sec.toFixed(decimals).padStart(decimals ? decimals + 3 : 2, "0")}"${hemi}` };
}

export function toDDM(v, isLat, decimals = 4) {
    const hemi = isLat ? (v < 0 ? "S" : "N") : (v < 0 ? "W" : "E");
    let a = Math.abs(v);
    let d = Math.floor(a);
    let mi = (a - d) * 60;
    if (Number(mi.toFixed(decimals)) >= 60) { mi = 0; d += 1; }
    return { d, m: mi, hemi,
        text: `${d}°${mi.toFixed(decimals).padStart(decimals + 3, "0")}'${hemi}` };
}

/* ---------- Vincenty inverse: distance + bearings on the ellipsoid ---------- */
export function vincentyInverse(lat1, lon1, lat2, lon2) {
    const L = rad(lon2 - lon1);
    const U1 = Math.atan((1 - F_FLAT) * Math.tan(rad(lat1)));
    const U2 = Math.atan((1 - F_FLAT) * Math.tan(rad(lat2)));
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

    let lambda = L, lambdaP, iter = 0;
    let sinLambda, cosLambda, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM, C;

    do {
        sinLambda = Math.sin(lambda); cosLambda = Math.cos(lambda);
        sinSigma = Math.sqrt(
            (cosU2 * sinLambda) ** 2 +
            (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2
        );
        if (sinSigma === 0) {
            return { ok: true, coincident: true, distanceM: 0, initialBearing: 0, finalBearing: 0, iterations: iter };
        }
        cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
        sigma = Math.atan2(sinSigma, cosSigma);
        sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
        cosSqAlpha = 1 - sinAlpha * sinAlpha;
        cos2SigmaM = cosSqAlpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;
        C = (F_FLAT / 16) * cosSqAlpha * (4 + F_FLAT * (4 - 3 * cosSqAlpha));
        lambdaP = lambda;
        lambda = L + (1 - C) * F_FLAT * sinAlpha *
            (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    } while (Math.abs(lambda - lambdaP) > 1e-12 && ++iter < 200);

    if (iter >= 200) {
        return { ok: false, reason: "Vincenty did not converge — the two points are very nearly antipodal. No distance is reported rather than a wrong one." };
    }

    const uSq = (cosSqAlpha * (A_AXIS * A_AXIS - B_AXIS * B_AXIS)) / (B_AXIS * B_AXIS);
    const Ac = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const Bc = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const deltaSigma = Bc * sinSigma * (cos2SigmaM + (Bc / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            (Bc / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

    const s = B_AXIS * Ac * (sigma - deltaSigma);
    const a1 = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    const a2 = Math.atan2(cosU1 * sinLambda, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda);

    return {
        ok: true, distanceM: s,
        initialBearing: (deg(a1) + 360) % 360,
        finalBearing: (deg(a2) + 360) % 360,
        iterations: iter,
    };
}

export function haversine(lat1, lon1, lat2, lon2, R = 6371008.8) {
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* ---------- Grid convergence and point scale, straight from the series ---------- */
export function gridInfo(lat, lon) {
    const zone = utmZone(lat, lon);
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const phi = rad(lat), dl = rad(lon - lon0);
    // Convergence: closed form on the ellipsoid.
    const convergence = deg(Math.atan(Math.tan(dl) * Math.sin(phi)));
    // Point scale factor, second-order.
    const eps2 = (E_SQ / (1 - E_SQ)) * Math.cos(phi) ** 2;
    const T = Math.tan(phi) ** 2;
    const Acoef = Math.cos(phi) * dl;
    const k = K0 * (1 + ((1 + eps2) * Acoef ** 2) / 2 +
        ((5 - 4 * T + 42 * eps2 + 13 * eps2 * eps2 - 28 * E_SQ / (1 - E_SQ)) * Acoef ** 4) / 24);
    return { zone, lon0, convergence, scale: k };
}

/* ---------- Input parsing: one box, many notations ---------- */
export function parseCoordinateInput(raw) {
    const s = String(raw).trim();
    if (!s) return { ok: false, reason: "" };

    // MGRS
    if (/^\s*\d{1,2}\s*[C-HJ-NP-Xc-hj-np-x]\s*[A-Za-z]{2}\s*[\d\s]*$/.test(s)) {
        const r = parseMGRS(s);
        if (r.ok) return { ok: true, kind: "MGRS", lat: r.lat, lon: r.lon, detail: r };
        return { ok: false, reason: r.reason };
    }

    // UTM: "14 N 600313 3271453" or "14R 600313 3271453"
    const utm = s.match(/^\s*(\d{1,2})\s*([C-HJ-NP-XNSc-hj-np-xns])\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*$/);
    if (utm) {
        const zone = parseInt(utm[1], 10);
        const letter = utm[2].toUpperCase();
        const hemi = letter === "N" || letter === "S" ? letter : (letter >= "N" ? "N" : "S");
        const e = parseFloat(utm[3]), nn = parseFloat(utm[4]);
        if (zone >= 1 && zone <= 60) {
            const ll = fromUTM(zone, hemi, e, nn);
            return { ok: true, kind: "UTM", lat: ll.lat, lon: ll.lon };
        }
    }

    // DMS / DDM / DD, with or without hemisphere letters
    const parts = splitPair(s);
    if (!parts) return { ok: false, reason: "Could not read that as a coordinate pair." };
    const a = parseAngle(parts[0]);
    const b = parseAngle(parts[1]);
    if (a === null || b === null) return { ok: false, reason: "Could not read that as a coordinate pair." };

    let lat = a.value, lon = b.value;
    // If the user wrote "97W 29N", swap into lat/lon order.
    if (a.axis === "lon" || b.axis === "lat") { const t = lat; lat = lon; lon = t; }
    if (Math.abs(lat) > 90) return { ok: false, reason: `Latitude ${lat.toFixed(4)} is outside −90…90.` };
    if (Math.abs(lon) > 180) return { ok: false, reason: `Longitude ${lon.toFixed(4)} is outside −180…180.` };
    return { ok: true, kind: a.kind, lat, lon };
}

/* Split "one string the user typed" into its latitude half and its longitude
   half. Three cases, tried in order, because the ambiguity is real:
   "29 34.128" is one DDM angle, "29 -97" is two DD angles, and nothing but
   context tells them apart. */
function splitPair(s) {
    // 1. An explicit comma is the user telling us where the boundary is.
    if (s.includes(",")) {
        const p = s.split(",");
        if (p.length === 2) return [p[0], p[1]];
    }

    // 2. Exactly one N/S and one E/W: the letters mark the halves.
    const letters = [...s.matchAll(/[NSEWnsew]/g)];
    const ns = letters.filter((m) => /[NSns]/.test(m[0]));
    const ew = letters.filter((m) => /[EWew]/.test(m[0]));
    if (ns.length === 1 && ew.length === 1) {
        const first = Math.min(ns[0].index, ew[0].index);
        const second = Math.max(ns[0].index, ew[0].index);
        // Suffix style ("29.5N 97.9W") if a digit precedes the first letter.
        const before = s.slice(0, first).replace(/[\s°'"′″]+$/, "");
        if (/\d$/.test(before)) return [s.slice(0, first + 1), s.slice(first + 1)];
        // Prefix style ("N29.5 W97.9"): cut immediately before the second letter.
        return [s.slice(0, second), s.slice(second)];
    }

    // 3. No letters at all: an even number of numeric tokens splits down
    //    the middle. 2 -> DD pair, 4 -> DDM pair, 6 -> DMS pair.
    const nums = s.match(/-?\d+(?:\.\d+)?/g);
    if (nums && (nums.length === 2 || nums.length === 4 || nums.length === 6)) {
        const half = nums.length / 2;
        // Find where the (half+1)th number starts and cut there.
        let idx = 0, count = 0;
        const re = /-?\d+(?:\.\d+)?/g;
        let m;
        while ((m = re.exec(s)) !== null) {
            count++;
            if (count === half + 1) { idx = m.index; break; }
        }
        if (idx > 0) return [s.slice(0, idx), s.slice(idx)];
    }
    return null;
}

function parseAngle(str) {
    let t = String(str).trim();
    if (!t) return null;
    let axis = null, sign = 1;
    const hemi = t.match(/[NSEWnsew]/);
    if (hemi) {
        const h = hemi[0].toUpperCase();
        axis = h === "N" || h === "S" ? "lat" : "lon";
        if (h === "S" || h === "W") sign = -1;
        t = t.replace(/[NSEWnsew]/g, " ");
    }
    if (/^\s*-/.test(t)) { sign *= -1; t = t.replace("-", " "); }
    const nums = t.match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    let value, kind;
    if (nums.length >= 3) { value = +nums[0] + +nums[1] / 60 + +nums[2] / 3600; kind = "DMS"; }
    else if (nums.length === 2) { value = +nums[0] + +nums[1] / 60; kind = "DDM"; }
    else { value = +nums[0]; kind = "DD"; }
    return { value: sign * value, axis, kind };
}
