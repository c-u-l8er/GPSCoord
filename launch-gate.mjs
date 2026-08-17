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

/* The landing page's CONTENT ships without JavaScript. SHELL.md §8 requires an
   identifying animation and the animation may cost JS; the page's meaning may
   not. So: nothing inline, exactly one external script, and that script is the
   animation — which §12 below then proves writes nothing into the document. */
{
    const tags = [...landing.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    T("the landing page ships no inline JavaScript", tags.every((t) => t[2].trim() === ""));
    T("the landing page loads exactly one script, and it is the identity animation",
        tags.length === 1 && /\bsrc="\/globe\.js"/.test(tags[0][1]) && /\bdefer\b/.test(tags[0][1]),
        `${tags.length} script tag(s)`);
}

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
/* The band may only claim what the tier permits. amp-nav files gpscoord as
   place:4 — "Outside, nav removed" — so this surface attributes itself to the
   parent and does NOT claim to be a layer of it. It shipped the layer sentence
   for one revision, which asserted membership in a portfolio whose own nav
   deliberately excludes it. SHELL.md §1. */
T("the surface declares its tier", [1, 2, 3, 4].includes(surface.tier), `tier ${surface.tier}`);
for (const [path, body] of Object.entries(pages)) {
    T(`${path} band carries the declared tier`, body.includes(`<div class="band" data-tier="${surface.tier}">`));
    if (surface.tier === 4) {
        T(`${path} band attributes rather than claims membership`,
            body.includes(`A <b>${surface.parent}</b> project`));
        T(`${path} band makes no layer claim at tier 4`,
            !body.includes(`layer of ${surface.parent}`));
        T(`${path} links no sibling domain in the portfolio`,
            !/href="https?:\/\/(?!github\.com|ampersandboxdesign\.com)[^"]*(computedriven|toolboxhvac|wrand|specprompt|fleetprompt|opensentience)/i.test(body));
    }
}
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

/* ==========================================================================
   12. SHELL.md §8.5 — THE IDENTIFYING ANIMATION ASSERTS NOTHING

   gpscoord.com shipped a canvas globe whose vehicles were created by
   `for (let i = 0; i < 12; i++)`, and printed beside it, for months:

       12   Active Pathfinders

   A decoration's internal constant was published as a live user metric. These
   three checks are that defect mechanised. The middle one is the defect
   itself: it costs one pass over two files, and it makes the whole class
   unshippable rather than merely known about.

   WHEN THE MIDDLE CHECK FIRES, THE ANIMATION CHANGES — never the page. The
   page's figures are recomputed from frozen records and have witnesses; the
   animation is decoration and can pick any number it likes. Decoration yields.
   ========================================================================== */
const ANIM_FILE = "./globe.js";
if (!existsSync(ANIM_FILE)) {
    console.error(`FAIL  missing artifact ${ANIM_FILE} — run the build first`);
    process.exit(1);
}
const anim = read(ANIM_FILE);

/* (a) REFUSE if the landing page has no element marked data-identity-animation */
{
    const marked = [...landing.matchAll(/<[a-z]+\b[^>]*\bdata-identity-animation\b[^>]*>/gi)];
    T("the landing page marks an element data-identity-animation", marked.length >= 1,
        `${marked.length} marked`);
    const firstSection = (landing.split("<section")[1] || "").split("</section>")[0];
    T("the identity animation is above the fold — inside the first section",
        firstSection.includes("data-identity-animation"));
    T("the h1 comes before the identity animation — the question comes first",
        landing.indexOf("<h1") > -1 && landing.indexOf("<h1") < landing.indexOf("data-identity-animation"));
}

/* Constants of the animation. Numeric literals below 2 are excluded: 0 and 1
   are structural in any drawing code and identify nothing. 12 is not. */
const ANIM_NUMS = new Set();
const ANIM_STRS = new Set();
for (const m of anim.matchAll(/(?<![\w.$])\d+(?:\.\d+)?/g)) {
    const v = Number(m[0]);
    if (Math.abs(v) >= 2) ANIM_NUMS.add(String(v));
}
for (const m of anim.matchAll(/"([^"\\\n]{3,})"|'([^'\\\n]{3,})'/g)) ANIM_STRS.add(m[1] ?? m[2]);

/* (b) REFUSE if any text node on the page equals a constant read from the
       animation source. This is the "12 Active Pathfinders" check. */
{
    const ENT = { "&nbsp;": " ", "&ensp;": " ", "&mdash;": "—", "&minus;": "−",
        "&amp;": "&", "&copy;": "©", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&times;": "×" };
    const texts = landing
        .replace(/<script[\s\S]*?<\/script>/gi, "<>")
        .replace(/<style[\s\S]*?<\/style>/gi, "<>")
        .replace(/<!--[\s\S]*?-->/g, "<>")
        .split(/<[^>]*>/)
        .map((s) => s.replace(/&\w+;/g, (e) => (e in ENT ? ENT[e] : e)).trim())
        .filter(Boolean);
    const shown = new Set();
    for (const t of texts) {
        shown.add(t);
        // "1,000" and "1000" are the same published figure. That is the ONLY
        // normalisation: a figure is compared as it is published. Rounding
        // "3.0000" to "3" collided Null Island's longitude with an edge weight
        // in the animation and refused a page that was telling the truth.
        if (/^-?[\d,]*\d(?:\.\d+)?$/.test(t) && t.includes(",")) shown.add(t.replace(/,/g, ""));
    }
    const leaked = [...shown].filter((t) => ANIM_NUMS.has(t) || ANIM_STRS.has(t));
    T("no text on the landing page is a constant read from the animation",
        leaked.length === 0,
        leaked.length
            ? `LEAKED: ${leaked.map((l) => JSON.stringify(l)).join(", ")} — change globe.js, not the page`
            : `${ANIM_NUMS.size + ANIM_STRS.size} constants vs ${texts.length} text nodes, disjoint`);
}

/* (c) REFUSE if the animation source contains a string that also appears in a
       frozen record. A decoration that quotes a record is depicting data. */
{
    const recordText = ["surface", "reference-points", "reference-pairs", "verification"]
        .map((f) => read(`./records/${f}.json`))
        .join("\n");
    const shared = [...ANIM_STRS].filter((s) => recordText.includes(s));
    T("the animation shares no string with a frozen record", shared.length === 0,
        shared.length ? `SHARED: ${shared.map((s) => JSON.stringify(s)).join(", ")}` : `${ANIM_STRS.size} strings, none in records`);
}

/* (d) no inputs and no outputs — the cheapest guarantee of (b), §8.2 */
{
    const FORBIDDEN = ["innerHTML", "outerHTML", "textContent", "innerText",
        "insertAdjacentHTML", "document.write", "createElement", "createTextNode",
        "appendChild", "setAttribute", "getElementById", "getElementsBy",
        "localStorage", "sessionStorage", "XMLHttpRequest", "fetch("];
    const found = FORBIDDEN.filter((k) => anim.includes(k));
    T("the animation neither reads nor writes page content", found.length === 0,
        found.join(", ") || "no DOM content API used");
    const queries = [...anim.matchAll(/querySelector(?:All)?\(\s*([^)]*)\)/g)].map((m) => m[1]);
    T("the animation queries nothing but its own canvas",
        queries.length === 1 && queries[0].includes("data-identity-animation"),
        queries.join(" | ") || "none");
}

/* (e) §8.4 — the constraints that keep it from being a broken page */
T("the animation honours prefers-reduced-motion", anim.includes("prefers-reduced-motion"));
T("the animation does not use IntersectionObserver as its only trigger",
    !anim.includes("IntersectionObserver") || /setTimeout\(\s*boot\b/.test(anim));
T("the animation stops when the tab is hidden", anim.includes("document.hidden"));
T("the animation caps its frame rate", /1000\s*\/\s*FPS/.test(anim));
T("the animation stays cheap enough for a phone", anim.length < 9000,
    `${anim.length.toLocaleString()} bytes`);

/* ==========================================================================
   13. CONTRAST — every declared text token, on the surface it sits on

   --fg3 shipped at .34, which is 2.78:1 against the band. It colours the
   .covers span and every .status dt — the two elements whose whole job is
   keeping this page honest. A caveat nobody can read is not a caveat. This is
   a dozen lines of colour maths against WCAG 2.1 SC 1.4.3, and it turns that
   class of defect from reported into unshippable.
   ========================================================================== */
const sheet = read("./src/shell.css");
const TOKENS = {};
/* The marker COMMENTS, not the words — the file's own header explains what
   TOKENS-START means, and matching the prose slices an empty range. */
for (const m of sheet
    .slice(sheet.indexOf("/* TOKENS-START"), sheet.indexOf("/* TOKENS-END"))
    .matchAll(/--([\w-]+)\s*:\s*([^;\n}]+)/g)) TOKENS[m[1]] = m[2].trim();
if (!TOKENS.ink) throw new Error("launch-gate found no token block in src/shell.css");

function colour(v) {
    const raw = (TOKENS[String(v).replace(/^--/, "")] || String(v)).trim();
    let m = /^#([0-9a-f]{6})$/i.exec(raw);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = /^rgba?\(([^)]+)\)$/i.exec(raw);
    if (m) { const p = m[1].split(",").map((x) => Number(x.trim())); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    throw new Error(`launch-gate cannot read the colour ${JSON.stringify(v)} -> ${raw}`);
}
const composite = (f, b) => [f[3] * f[0] + (1 - f[3]) * b[0], f[3] * f[1] + (1 - f[3]) * b[1], f[3] * f[2] + (1 - f[3]) * b[2], 1];
function solid(spec) {
    const layers = Array.isArray(spec) ? spec : [spec];
    let base = colour(layers[0]); base = [base[0], base[1], base[2], 1];
    for (let i = 1; i < layers.length; i++) base = composite(colour(layers[i]), base);
    return base;
}
const chan = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
function contrast(fgSpec, bgSpec) {
    const bg = solid(bgSpec);
    const fg = composite(colour(fgSpec), bg);
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* Each row is a pairing that actually occurs in the stylesheet. The pairing is
   asserted here; the RATIO is computed, and the ratio is the thing that drifts. */
const CONTRAST_PAIRS = [
    ["--fg", "--ink", "body copy"],
    ["--fg", "--ink2", "card headings, the band's bold word"],
    ["--fg", "--ink3", "converter input text on a raised surface"],
    ["--fg2", "--ink", "lede and prose"],
    ["--fg2", "--ink2", "status values, the band's .covers span, rung chip text"],
    ["--fg2", "--ink3", "the tool header label"],
    ["--fg3", "--ink", "figcaption, .out sub-labels, the copy button"],
    ["--fg3", "--ink2", "every .status dt, .plate labels, .needs, the footer"],
    ["--fg3", "--ink3", "table headers"],
    ["--acc", "--ink", "links in prose"],
    ["--acc", "--ink2", "CTA verbs, eyebrows, the logo on hover"],
    ["--acc", ["--ink2", "--acc-soft"], "a CTA card while hovered"],
    ["--data", "--ink2", "measured values, the live_local rung chip"],
    ["--data", ["--ink2", "--data-soft"], "the live_local chip on its own tint"],
    ["--warn", "--ink2", "the LIMIT row, the claim tag, the ? rung"],
    ["--warn", ["--ink2", "rgba(245,196,81,.06)"], "the claim tag on its own tint"],
    ["#180d04", "--acc", "the label inside a primary button"],
    ["#9aa4b2", "--ink2", "the spec rung chip"],
    ["#7aa2f7", "--ink2", "the in_tree rung chip"],
    ["#4ade80", "--ink2", "the live_deployed rung chip"],
    ["#c4a1ff", "--ink2", "the external rung chip"],
];
const MIN_RATIO = 4.5;
let worst = Infinity, worstName = "";
for (const [fg, bg, where] of CONTRAST_PAIRS) {
    const r = contrast(fg, bg);
    const name = `${fg} on ${Array.isArray(bg) ? bg.join(" + ") : bg}`;
    if (r < worst) { worst = r; worstName = name; }
    T(`contrast ${name} — ${where}`, r >= MIN_RATIO, `${r.toFixed(2)}:1`);
}
T(`the least legible declared pair clears the 4.5:1 floor`, worst >= MIN_RATIO,
    `${worstName} at ${worst.toFixed(2)}:1`);

/* ==========================================================================
   14. EVERY INTERACTIVE ELEMENT CAN BE SEEN TO BE INTERACTIVE

   .logo had no :hover rule at all, so hovering the top-left of the page
   changed nothing and there was no way to tell it was a link. :focus-visible
   was global and fine; hover was per-selector, and one selector was missed.

   Limit of this check: it matches an element's FIRST class, or its tag name
   when it has none, against the selector text of every :hover rule in the
   artifact. It cannot prove a bare <a> deep in a container is covered by that
   container's rule — that was confirmed in a browser instead.
   ========================================================================== */
for (const [path, body] of Object.entries(pages)) {
    const styles = [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const hoverSel = [...styles.matchAll(/([^{}]*?):hover/g)].map((m) => m[1]).join(" , ");
    const handles = new Set();
    for (const el of body.matchAll(/<(a|button)\b([^>]*)>/gi)) {
        const cls = /class="([^"]*)"/.exec(el[2]);
        handles.add(cls ? "." + cls[1].trim().split(/\s+/)[0] : el[1].toLowerCase());
    }
    const naked = [...handles].filter((h) =>
        h.startsWith(".")
            ? !new RegExp(`\\${h}(?![\\w-])`).test(hoverSel)
            : !new RegExp(`(^|[\\s>+~,(])${h}(?=[\\s.:>+~,)]|$)`, "m").test(hoverSel));
    T(`${path} every interactive element has a visible :hover`, naked.length === 0,
        naked.length ? `no hover for: ${naked.join(", ")}` : `${handles.size} kinds, all covered`);
    T(`${path} declares a focus-visible ring`, /:focus-visible\s*\{/.test(styles));
}

console.log(`\n${pass} passed, ${fail} failed (publication gate)`);
if (fail) process.exit(1);
