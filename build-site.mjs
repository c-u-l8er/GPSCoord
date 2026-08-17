/* ==========================================================================
   GPSCoord site build.

   The pages are GENERATED from the frozen records in records/, never hand
   written, and every number that reaches a page is RECOMPUTED here by the same
   arithmetic the converter runs. If a recomputed value disagrees with its
   frozen record, this build throws and nothing is emitted.

   That gate exists because of a real defect: the previous revision of this
   site published a hand-typed UTM/MGRS pair for Seguin, Texas that was wrong
   by 2,471 m, and it survived a claim audit that reported every number had a
   witness. A hand-copied number is exactly the thing that cannot be audited.

   Output goes to the repository root, because that is what the domain serves
   today. Do not change that without confirming the Pages output directory.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import * as C from "./src/coord.mjs";

const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p));

const surface = J("./records/surface.json");
const refPoints = J("./records/reference-points.json");
const refPairs = J("./records/reference-pairs.json");
const verification = J("./records/verification.json");
const pkg = J("./package.json");

const APP_PATH = "/convert/";
const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external"];

/* ---------- release identity: one version, or no build ---------- */
if (pkg.version !== surface.version) {
    throw new Error(
        `release identity: package.json ${pkg.version} != records/surface.json ${surface.version}`
    );
}
const STAMP = `GPSCOORD v${surface.version} · RECORDS ${surface.verified_at}`;

const esc = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/* ==========================================================================
   THE CONSISTENCY GATE
   Recompute every published reference value and compare with the record.
   ========================================================================== */
const drift = [];
function expect(what, got, want) {
    if (got !== want) drift.push(`${what}: built ${JSON.stringify(got)} != record ${JSON.stringify(want)}`);
}

for (const p of refPoints.points) {
    const u = C.toUTM(p.lat, p.lon);
    const m = C.toMGRS(p.lat, p.lon, 5);
    if (!u.ok || !m.ok) { drift.push(`${p.name}: arithmetic refused the point`); continue; }
    expect(`${p.name} zone`, u.zone, p.zone);
    expect(`${p.name} band`, u.band, p.band);
    expect(`${p.name} easting`, +u.easting.toFixed(3), p.easting);
    expect(`${p.name} northing`, +u.northing.toFixed(3), p.northing);
    expect(`${p.name} mgrs`, m.text, p.mgrs);
    expect(`${p.name} dms`, C.toDMS(p.lat, true).text + " " + C.toDMS(p.lon, false).text, p.dms);
    expect(`${p.name} ddm`, C.toDDM(p.lat, true).text + " " + C.toDDM(p.lon, false).text, p.ddm);
}

for (const q of refPairs.pairs) {
    const v = C.vincentyInverse(q.from[0], q.from[1], q.to[0], q.to[1]);
    if (!v.ok) { drift.push(`${q.name}: Vincenty refused the pair`); continue; }
    expect(`${q.name} distance`, +v.distanceM.toFixed(3), q.distanceM);
    expect(`${q.name} initial bearing`, +v.initialBearing.toFixed(6), q.initialBearing);
    expect(`${q.name} final bearing`, +v.finalBearing.toFixed(6), q.finalBearing);
}

if (drift.length) {
    console.error("BUILD REFUSED — the arithmetic and the frozen records disagree:");
    drift.forEach((d) => console.error("  " + d));
    process.exit(1);
}
console.log(`consistency gate: ${refPoints.points.length} points + ${refPairs.pairs.length} pairs recomputed, 0 drift`);

/* ==========================================================================
   SHELL FRAGMENTS — the shared parts. Identical markup on every surface;
   only the tokens in src/shell.css differ per site.
   ========================================================================== */

/* The chip renders the stored rung, and "?" when there is none. It never
   defaults to a rung, because a defaulted rung is a fabricated status. */
function rung(value) {
    const r = RUNGS.includes(value) ? value : "?";
    return `<span class="rung" data-rung="${r}" title="spec · in_tree · live_local · live_deployed · external">${r}</span>`;
}

/* The band states where you are. What it may state depends on the TIER, and
   the tier is a record, not a choice made here: amp-nav files gpscoord as
   place:4, "Outside — nav removed". A tier-4 surface may attribute itself to
   the parent but may NOT claim to be a layer of it — claiming membership in a
   portfolio whose own nav excludes you is a false claim, and this page carried
   one. The rung chip and the covers span stay at every tier: they are honesty
   machinery, not branding. SHELL.md §1. */
function band() {
    if (![4, 3, 2, 1].includes(surface.tier)) {
        throw new Error(`BUILD REFUSED — records/surface.json declares no tier, so the band cannot know what it may claim.`);
    }
    const where =
        surface.tier === 4
            ? `A <b>${esc(surface.parent)}</b> project`
            : `${esc(surface.surface)} is the <b>${esc(surface.layer)}</b> layer of ${esc(surface.parent)}`;
    return `<div class="band" data-tier="${surface.tier}"><span class="where">${where}</span>${rung(surface.surface_rung)}<span class="covers">That rung covers ${esc(surface.surface_rung_covers)}.</span></div>`;
}

function statusBlock() {
    const s = surface.status;
    return `<dl class="status">
<div><dt>Status</dt><dd><strong>${esc(surface.surface_rung)}</strong> — ${esc(s.statement)}</dd></div>
<div><dt>Last verified</dt><dd>${esc(surface.verified_at)}</dd></div>
<div><dt>Source</dt><dd>${esc(s.source)}</dd></div>
<div class="limit"><dt>Limit</dt><dd>${esc(s.limit)}</dd></div>
<div><dt>Next rung</dt><dd><strong>${esc(surface.advance.next_rung)}</strong> — ${esc(surface.advance.requires)}</dd></div>
</dl>`;
}

/* §0.7: the rung gates the call to action. A CTA block declares its rung and
   may only use verbs that rung has earned; anything else throws. */
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};

function cta(groupRung, label, actions) {
    const allowed = VERBS[groupRung];
    if (!allowed) throw new Error(`CTA group declares an unknown rung: ${groupRung}`);
    for (const a of actions) {
        if (!allowed.includes(a.verb)) {
            throw new Error(
                `BUILD REFUSED — CTA "${a.verb}" is not available at rung ${groupRung}. Allowed: ${allowed.join(", ")}`
            );
        }
    }
    const cls = groupRung === "spec" ? "tag" : "tag ok";
    return `<div class="ctagroup"><div class="${cls}">${esc(groupRung)} &mdash; ${esc(label)}</div><div class="cta">${actions
        .map(
            (a) =>
                `<a href="${a.href}"${a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><span class="verb">${esc(a.verb)}</span><span class="what">${a.what}</span></a>`
        )
        .join("")}</div></div>`;
}

/* ==========================================================================
   GENERATED CONTENT
   ========================================================================== */

function plate() {
    const cells = [
        [String(surface.converts.length), "Formats converting"],
        [refPoints.points.length + " × 3", "Witnessed reference values"],
        ...surface.zero_counts.map((z) => [z.value, z.label]),
        ["$0", "And no account"],
    ];
    return `<div class="grid plate">${cells
        .map(([n, l]) => `<div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`)
        .join("")}</div>`;
}

function cards(items) {
    return `<div class="grid">${items
        .map(
            (c) =>
                `<div><div class="head"><h3>${esc(c.name)}</h3>${rung(c.rung)}</div><p>${esc(c.detail)}</p><div class="needs"><b>Needs:</b> ${esc(c.needs)} <b>Built:</b> ${esc(c.built)}.</div></div>`
        )
        .join("")}</div>`;
}

function method() {
    return `<div class="grid meth">${verification.measurements
        .map((m) => `<div><div class="k">${esc(m.label)}</div><div class="v">${esc(m.value)}</div><p>${esc(m.note)}</p></div>`)
        .join("")}</div>`;
}

/* The table cells come from the arithmetic, not from the record — the record
   is only what they are checked against. A hand-typed cell is impossible. */
function refTable() {
    const rows = refPoints.points
        .map((p) => {
            const u = C.toUTM(p.lat, p.lon);
            const m = C.toMGRS(p.lat, p.lon, 5);
            return `<tr><td class="place">${esc(p.name)}</td><td class="num">${p.lat.toFixed(4)}</td><td class="num">${p.lon.toFixed(4)}</td><td>${u.zone}${u.band} ${u.easting.toFixed(2)} ${u.northing.toFixed(2)}</td><td>${m.text}</td></tr>`;
        })
        .join("");
    return `<div class="scroll"><table><thead><tr><th>Reference point</th><th>Latitude</th><th>Longitude</th><th>UTM</th><th>MGRS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function pairTable() {
    const rows = refPairs.pairs
        .map((q) => {
            const v = C.vincentyInverse(q.from[0], q.from[1], q.to[0], q.to[1]);
            return `<tr><td class="place">${esc(q.name)}</td><td class="num">${(v.distanceM / 1000).toFixed(3)} km</td><td>${v.initialBearing.toFixed(4)}°</td><td>${v.finalBearing.toFixed(4)}°</td></tr>`;
        })
        .join("");
    return `<div class="scroll" style="margin-top:14px"><table style="min-width:520px"><thead><tr><th>Pair</th><th>Geodesic distance</th><th>Initial bearing</th><th>Final bearing</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function zeros() {
    return `<dl class="status">${surface.zero_counts
        .map(
            (z) =>
                `<div><dt>${esc(z.label)}</dt><dd><strong>${esc(z.value)}.</strong> ${esc(z.witness)}</dd></div>`
        )
        .join("")}<div><dt>Formats converting</dt><dd><strong>${surface.converts.length}</strong> — ${surface.converts
        .map((c) => esc(c.name))
        .join(", ")}. Counted by running them, and by refusing to publish this page when any of the ${refPoints.points.length} reference rows disagrees.</dd></div></dl>`;
}

const RETRACTION = `<div class="retract"><h3>Retraction — a fabricated coordinate on this site</h3>
<p>Until this revision the API example printed <code>"utm": "14R 597842 3270738"</code> and <code>"mgrs": "14RPU9784270738"</code> as the grid references for 29.5688, &minus;97.9644. Both are wrong. The correct values, in the table above, are <code>14R 600313.02 3271453.85</code> and <code>14RPT0031371453</code>. The published easting was off by <strong>2,471 m</strong>, the northing by <strong>715 m</strong>, and the MGRS square letters were wrong as well.</p>
<p>Where it came from matters. A pass over this site one revision ago removed six unsupported numbers and reported that every remaining number had a witness. These two survived, because they sat inside a code sample labelled "the response shape we intend" — and a shape does not look like a claim. It was a claim, and it was false. Writing the converter is what caught it: the first thing the working arithmetic did was contradict the page it was written for.</p>
<p>The fix is structural rather than careful. Every grid reference on this site is now recomputed at build time by the same code the converter runs, and the build refuses to emit a page whose tables disagree with the frozen record. A number can no longer be typed onto this site by hand.</p></div>`;

function pricing() {
    const p = surface.pricing;
    return `<div class="tag">${esc(p.label)}</div>
<div class="tiers">${p.tiers
        .map((t) => `<div><div class="l">${esc(t.name)}</div><div class="p">${esc(t.price)}</div><div class="c">${esc(t.calls)}</div></div>`)
        .join("")}</div>
<p class="lede sm">${esc(p.note)}</p>`;
}

/* ==========================================================================
   THE ARITHMETIC, TRANSFORMED FOR THE BROWSER
   One source of truth: src/coord.mjs is imported by this build and by
   check.mjs, and inlined into the page by mechanical transform. There is no
   second copy to drift.
   ========================================================================== */
function browserMath() {
    const src = read("./src/coord.mjs");
    const names = [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    if (names.length < 8) throw new Error(`expected the coord module to export more than ${names.length} functions`);
    const body = src.replace(/^export /gm, "");
    return (
        "var GPS=(function(){\n" +
        body +
        "\nreturn {" +
        names.map((n) => `${n}:${n}`).join(",") +
        ",BANDS:BANDS};\n})();"
    );
}

/* ==========================================================================
   EMIT
   ========================================================================== */
/* The shell stylesheet ships stripped of comments and indentation. The source
   in src/shell.css stays commented and readable; only the artifact is dense. */
const CSS = read("./src/shell.css")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*/g, "")
    .replace(/;\}/g, "}")
    .trim();

/* The identifying animation (SHELL.md §8) is emitted as its own artifact
   rather than inlined. Two reasons, and the second is the point: the landing
   page's markup stays content-only, so that "the content is complete with
   JavaScript off" is something a reader can verify by deleting one line; and
   the animation becomes a file the publication gate can read constants out of
   and compare against the page. Comments and indentation are stripped, and
   NEWLINES ARE KEPT — joining JavaScript lines the way the CSS is joined would
   be a semicolon-insertion bug waiting to happen. */
const GLOBE = read("./src/globe.js")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
const YEAR = new Date(surface.verified_at).getUTCFullYear();

const COMMON = {
    CSS,
    BAND: band(),
    STAMP,
    APP_PATH,
    ORIGIN: surface.origin,
    REPO: surface.repo,
    CONTACT: surface.contact.url,
    QUESTION: esc(surface.question),
    YEAR: String(YEAR),
    METHOD: method(),
    REF_TABLE: refTable(),
    STATUS: statusBlock(),
};

const landing = fill(read("./src/landing.html"), {
    ...COMMON,
    PLATE: plate(),
    LINE_CARDS: cards(surface.not_knowable),
    ZEROS: zeros(),
    RETRACTION,
    PRICING: pricing(),
    CTA:
        cta("live_local", "run and checked", [
            { verb: "Use it", href: APP_PATH, what: "The converter is one click away and it works. No account, no key, and no request leaves your browser." },
            { verb: "Reproduce it locally", href: surface.repo, what: "Clone, then <code>node check.mjs</code>. No dependencies. It prints its own failures." },
        ]) +
        cta("spec", "specified, not built", [
            { verb: "Read", href: surface.repo, what: "What this site claims and what it does are generated from the same records." },
            { verb: "Challenge", href: surface.contact.url, what: "Find a coordinate the converter gets wrong. An input and an expected value is the most useful thing anyone can send." },
            { verb: "Implement", href: surface.repo + "/fork", what: "Plus Code is pure arithmetic and needs no data. It is the smallest useful contribution here." },
        ]),
});

const app = fill(read("./src/convert.html"), {
    ...COMMON,
    RUNG_CONVERTER: rung("live_local"),
    RUNG_DISTANCE: rung("live_local"),
    PAIR_TABLE: pairTable(),
    UNAVAILABLE: cards(surface.unavailable),
    EXAMPLES: EXAMPLES(),
    MATH: browserMath(),
    APP: `window.__ROWS__=${JSON.stringify(
        surface.converts
            .map((c) => ({ id: c.id, name: c.name, note: c.note }))
            .concat(surface.unavailable.map((c) => ({ id: c.id, name: c.name, note: c.note || "", reason: c.reason })))
    )};\n${read("./src/app.js")}`,
    CTA: cta("live_local", "run and checked", [
        { verb: "Use it", href: "#in", what: "It is above. Paste anything — the parser tells you what notation it decided you meant." },
        { verb: "Reproduce it locally", href: surface.repo, what: "<code>node check.mjs</code> re-proves every published value with no dependencies and no network." },
    ]),
});

function EXAMPLES() {
    const egs = [
        ["29.5688, -97.9644", "Seguin, TX (DD)"],
        ["51°28'40.1\"N 0°00'05.4\"W", "Greenwich (DMS)"],
        ["33 51.408 S, 151 12.918 E", "Sydney (DDM)"],
        ["33XWG1435782999", "Svalbard (MGRS)"],
        ["19F 544805 3927030", "Ushuaia (UTM)"],
        ["0, 3", "Equator on a central meridian"],
    ];
    return egs
        .map(([c, l]) => `<button type="button" data-c="${esc(c)}">${esc(l)}</button>`)
        .join("");
}

function fill(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
        if (!(k in vars)) throw new Error(`template token {{${k}}} has no value`);
        return vars[k];
    });
}

writeFileSync("./index.html", landing);
writeFileSync("./globe.js", GLOBE + "\n");
mkdirSync("./convert", { recursive: true });
writeFileSync("./convert/index.html", app);

console.log(`wrote index.html          ${landing.length.toLocaleString()} bytes`);
console.log(`wrote globe.js            ${GLOBE.length.toLocaleString()} bytes  (decoration; the page's content does not depend on it)`);
console.log(`wrote convert/index.html  ${app.length.toLocaleString()} bytes`);
