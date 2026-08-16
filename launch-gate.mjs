/* ==========================================================================
   GPSCoord publication gate. No dependencies.

       node launch-gate.mjs        (run it via: npm run test:launch)

   It reads the ARTIFACT — the generated index.html and convert/index.html —
   and refuses when the artifact says something the records do not support.
   The build already refuses on numeric drift; this refuses on the other ways
   a page lies: a stale claim coming back, a rung invented, a call to action
   the rung has not earned, an unrendered token, a dead mailbox.
   ========================================================================== */
import { readFileSync, existsSync } from "fs";

const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p));

const surface = J("./records/surface.json");
const refPoints = J("./records/reference-points.json");
const pkg = J("./package.json");
const APP = "/convert/";

let pass = 0, fail = 0;
function T(name, ok, detail = "") {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
    ok ? pass++ : fail++;
}

for (const f of ["./index.html", "./convert/index.html"]) {
    if (!existsSync(f)) { console.error(`FAIL  missing artifact ${f} — run the build first`); process.exit(1); }
}
const landing = read("./index.html");
const app = read("./convert/index.html");
const pages = { "/": landing, [APP]: app };

/* ---------- 1. release identity ---------- */
T("release identity: package.json == records/surface.json",
    pkg.version === surface.version, `${pkg.version} / ${surface.version}`);
const STAMP = `GPSCOORD v${surface.version} · RECORDS ${surface.verified_at}`;
for (const [path, body] of Object.entries(pages)) {
    T(`${path} carries the canonical stamp`, body.includes(STAMP));
}

/* ---------- 2. the artifact is fully rendered ---------- */
for (const [path, body] of Object.entries(pages)) {
    T(`${path} has no unrendered build token`, !/\{\{\w+\}\}/.test(body));
    T(`${path} declares its canonical URL`,
        body.includes(`<link rel="canonical" href="${surface.origin}${path === "/" ? "/" : APP}">`));
    T(`${path} declares the surface's falsifiable question`,
        body.includes(`<meta name="falsifiable-question" content="${surface.question}">`));
}

/* ---------- 3. the routes are what they claim ---------- */
T("the landing page is not the application", !landing.includes("id=\"coord-math\""));
T("the application carries the arithmetic", app.includes("id=\"coord-math\"") && app.includes("function toUTM"));
T("the landing page links the application", landing.includes(`href="${APP}"`));
T("the application links back to the question", app.includes('href="/"'));
T("the landing page ships zero JavaScript", !/<script/i.test(landing));

/* ---------- 3b. the UI may only call arithmetic that exists ----------
   The converter reached the browser once calling GPS.parseInput, which the
   module does not export: every output box rendered empty and nothing in the
   HTML looked wrong. A page whose script throws is indistinguishable from a
   page that is merely quiet, so this is checked rather than eyeballed. */
{
    const exported = [...read("./src/coord.mjs").matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    const called = [...new Set([...read("./src/app.js").matchAll(/\bGPS\.(\w+)/g)].map((m) => m[1]))];
    const missing = called.filter((n) => !exported.includes(n) && n !== "BANDS");
    T("every GPS.* the UI calls is exported by the arithmetic", missing.length === 0,
        missing.length ? "missing: " + missing.join(", ") : `${called.length} calls, all resolved`);
}

/* ---------- 4. claims that were retracted may not come back ----------
   Every string here was removed by commit 07d67ef because it had no witness.
   This is the retraction made structural: it cannot be undone by an edit. */
const RETRACTED = [
    "200K+", "Active Pathfinders", "Pathfinders",
    "<50ms", "195 Countries", "195 countries",
    "enterprise-grade", "Enterprise-grade",
    "Launching 2026", "Get Early Access",
    "14RPU9784270738", "597842 3270738",
];
for (const [path, body] of Object.entries(pages)) {
    for (const s of RETRACTED) {
        // The retraction paragraph is the one place the wrong values may appear,
        // because naming them is what a retraction is.
        const inRetraction = body.includes("Retraction —") &&
            body.split("Retraction —")[1].split("</div>")[0].includes(s);
        T(`${path} does not reinstate "${s}"`, !body.includes(s) || inRetraction);
    }
}

/* ---------- 5. no dead mailbox anywhere ---------- */
for (const [path, body] of Object.entries(pages)) {
    T(`${path} advertises no mailto:`, !body.includes("mailto:"));
}
T("the correction channel is a live URL, not a mailbox",
    /^https:\/\//.test(surface.contact.url) && surface.contact.kind !== "mailto");

/* ---------- 6. every rung on the artifact is a real rung ---------- */
const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external", "?"];
for (const [path, body] of Object.entries(pages)) {
    const chips = [...body.matchAll(/<span class="rung" data-rung="([^"]*)"[^>]*>([^<]*)<\/span>/g)];
    T(`${path} renders at least one rung chip`, chips.length > 0, `${chips.length} chips`);
    T(`${path} renders only real rungs`, chips.every((c) => RUNGS.includes(c[1])),
        chips.map((c) => c[1]).filter((r) => !RUNGS.includes(r)).join(", ") || "all valid");
    T(`${path} chip text always equals its stored rung`, chips.every((c) => c[1] === c[2]));
    T(`${path} never defaults an unknown rung to spec`,
        !/data-rung=""/.test(body) && !/data-rung="undefined"/.test(body) && !/data-rung="null"/.test(body));
}
T("the placement band states the layer and the parent",
    landing.includes(`<b>${surface.layer}</b> layer of ${surface.parent}`) &&
    app.includes(`<b>${surface.layer}</b> layer of ${surface.parent}`));
T("the placement band bounds what its rung covers",
    landing.includes(surface.surface_rung_covers));

/* ---------- 7. §0.7 — the rung gates the call to action ---------- */
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};
for (const [path, body] of Object.entries(pages)) {
    const groups = [...body.matchAll(/<div class="ctagroup"><div class="tag[^"]*">(\w+) &mdash;[\s\S]*?<\/div><\/div>/g)];
    T(`${path} has at least one call to action`, groups.length > 0);
    let bad = [];
    for (const g of groups) {
        const allowed = VERBS[g[1]] || [];
        for (const v of [...g[0].matchAll(/<span class="verb">([^<]*)<\/span>/g)]) {
            const verb = v[1].replace(/&mdash;/g, "—");
            if (!allowed.includes(verb)) bad.push(`${verb} @ ${g[1]}`);
        }
    }
    T(`${path} asks only what its rung has earned`, bad.length === 0, bad.join("; ") || "ok");
}
T("no page invites running something at the spec rung",
    !Object.values(pages).some((b) =>
        /<div class="tag">spec[\s\S]*?<span class="verb">(Use it|Run|Reproduce)/.test(b)));

/* ---------- 8. the status block is complete ---------- */
for (const label of ["Status", "Last verified", "Source", "Limit", "Next rung"]) {
    T(`the status block states ${label}`, landing.includes(`<dt>${label}</dt>`));
}
T("the LIMIT names something the evidence does NOT establish",
    surface.status.limit.toLowerCase().includes("does not") || surface.status.limit.includes("not establish"));

/* ---------- 9. the review ledger cannot lie ---------- */
const NEED = ["evidence", "reviewer", "date"];
const gates = Object.entries(surface.gates).filter(([k]) => k !== "_comment");
T("review ledger: every gate has a valid status",
    gates.every(([, g]) => ["pending", "approved"].includes(g.status)));
T("review ledger: no approval without its evidence",
    gates.every(([, g]) => g.status !== "approved" || NEED.every((f) => g[f])));
const pending = gates.filter(([, g]) => g.status === "pending");
T("review ledger: a pending gate keeps the surface below live_deployed",
    pending.length === 0 || surface.surface_rung !== "live_deployed",
    `${pending.length} pending`);
T("review ledger: the external rung is not self-awarded",
    surface.surface_rung !== "external" || surface.gates.independent_use.status === "approved");

/* ---------- 10. the published tables are the ones that were checked ---------- */
for (const p of refPoints.points) {
    T(`reference row published: ${p.name}`,
        landing.includes(p.mgrs) && app.includes(p.mgrs), p.mgrs);
}
T("proposed pricing carries its label wherever the numbers appear",
    !landing.includes("$19") || landing.includes(surface.pricing.label));

/* ---------- 11. density ---------- */
T("the landing page stays small", landing.length < 32000, `${landing.length.toLocaleString()} bytes`);

console.log(`\n${pass} passed, ${fail} failed (publication gate)`);
if (fail) process.exit(1);
