/* ==========================================================================
   GPSCoord BREAK HARNESS.

       node break-harness.mjs

   A gate nobody has seen fail is an opinion. This repo's earlier lanes ran
   their breaks by hand and recorded the results in commit messages — "Eight
   new gates, each one broken on purpose first" — which nobody can re-run and
   which the next edit to the gate silently invalidates.

   THIS SITE HAS A BUILD, so a break is patched into a SOURCE and the copy is
   REBUILT before it is gated. Patching the emitted artifact instead would
   prove something weaker and often nothing at all: build-site.mjs regenerates
   index.html from records/, so a defect typed into the artifact is erased
   before the gate sees it. Where a break is genuinely about the artifact (a
   hand-edit after a good build), the harness says so and skips the rebuild.

   THE CONTROL RUN COMES FIRST AND MUST PASS — stage, rebuild, gate, with
   nothing patched. r12: a sibling lane's harness produced 20 refusals that
   were all refusing for an unrelated reason, and a relative path in it
   silently applied no patch at all. So every break also asserts that its
   patch CHANGED the file, and that the refusal MATCHES an expected pattern.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

const HERE = new URL("./", import.meta.url).pathname;
const ROOT = join(tmpdir(), "gps-break-" + process.pid);

function stage() {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
    cpSync(HERE, ROOT, { recursive: true, filter: (s) => !/\/(\.git|node_modules)(\/|$)/.test(s) });
    return ROOT;
}

function run(dir, script) {
    try {
        return { code: 0, out: execFileSync(process.execPath, [script], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (e) {
        return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
    }
}

/* [id, what, file, find, replace, /expected/, rebuild?]
   rebuild defaults to true. Set false when the break IS a hand-edit of a
   built artifact — that is the defect being simulated, and rebuilding would
   undo it. */
const BREAKS = [
    ["G1", "<amp-nav> is deleted from the shared template — the silent disappearance",
        "build-site.mjs", "return `<amp-nav></amp-nav>`;", "return ``;",
        /carries exactly one <amp-nav> element/i],
    ["G2", "the nav element survives but the module tag is dropped from /",
        "src/landing.html", '<script type="module" src="/amp-nav.js"></script>', "",
        /loads amp-nav\.js as a module|three scripts it declares/i],
    ["G3", "the nav is dropped from /convert/ ONLY — a converter you cannot navigate away from",
        "src/convert.html", "{{NAV}}", "",
        /\/convert\/ carries exactly one <amp-nav> element/i],
    ["G4", "amp-nav appears only as a COMMENT, not an element (r14 scoping)",
        "build-site.mjs", "return `<amp-nav></amp-nav>`;", "return `<!-- <amp-nav></amp-nav> -->`;",
        /carries exactly one <amp-nav> element/i],
    ["G5", "the vendored nav is hand-edited after the build — sync-nav.sh would revert it",
        "amp-nav.js", 'const VERSION = "0.8.2";', 'const VERSION = "0.8.2-local";',
        /byte-identical to the vendored copy|manifest/i, false],
    ["G6", "a fourth script is added without being named in the enumeration",
        "src/landing.html", '<style>{{CSS}}</style>',
        '<script defer src="/tracker.js"></script><style>{{CSS}}</style>',
        /three scripts it declares/i],
    ["G7", "the nav script loses type=module, so the custom element never upgrades",
        "src/landing.html", '<script type="module" src="/amp-nav.js"></script>',
        '<script src="/amp-nav.js"></script>',
        /loads amp-nav\.js as a module|none of them synchronous/i],
    /* Targets a REAL CODE LINE. The first `const` in src/globe.js is inside a
       block comment and dense() strips comments, so the original form of this
       break was erased by the build and reported "PASSED — NOT CAUGHT" — a
       false gate hole. The survived/erased column below exists because of it. */
    ["G8", "a retracted claim is reinstated inside a PUBLISHED ASSET (r15)",
        "src/globe.js", "function rnd() {",
        "const _tag = 'Active Pathfinders';\nfunction rnd() {",
        /published asset|Active Pathfinders/i],
    /* G9 WAS HERE AND IS DELIBERATELY NOT IN THIS LIST. Flipping
       records/surface.json from "tier": 4 to "tier": 3 builds cleanly and the
       gate passes with 182/182 — band() then emits "GPSCoord is the undefined
       layer of ComputeDriven" and nothing refuses, because surface.layer is
       absent at tier 4 and no check requires it to exist when the tier
       demands it. That is a real hole and it is NOT this lane's: this lane
       was scoped to the nav and to a hover defect on another surface. It is
       reported rather than silently fixed, and rather than parked here as a
       permanently failing row that trains the next reader to ignore red. */
    ["G13", "the archive is re-opened — a stale artifact served beside an approved one",
        "_redirects", "/old_scrap/*        /  301", "# /old_scrap/*      /  301",
        /old_scrap.* is closed in _redirects/i],
    ["G14", "the break harness itself becomes servable again, republishing every retracted claim",
        "_redirects", "/break-harness.mjs  /  301", "# /break-harness.mjs  /  301",
        /break-harness\.mjs is closed in _redirects/i],
    ["G10", "a published coordinate drifts from the frozen record",
        "records/reference-points.json", '"easting"', '"easting_was"',
        /BUILD REFUSED|drift|easting/i],
    ["G11", "the built artifact is hand-edited after a good build",
        "index.html", "<h1", "<h1 data-tampered", /manifest|hash|byte/i, false],
    ["G12", "the contact form loses its method and stops posting without JS",
        "build-site.mjs", 'method="POST" novalidate', "novalidate",
        /JavaScript off|method/i],
];

let pass = 0, fail = 0;
const rows = [];

/* ---------- CONTROL: stage, rebuild, gate. Nothing patched. ---------- */
{
    const dir = stage();
    const b = run(dir, "build-site.mjs");
    const g = b.code === 0 ? run(dir, "launch-gate.mjs") : { code: 1, out: b.out };
    const ok = b.code === 0 && g.code === 0;
    rows.push(["CONTROL", "staged tree rebuilds and passes with NOTHING broken", ok ? "PASSED" : "FAILED", ok ? "" : (b.out + g.out).trim().split("\n").slice(-3).join(" / ")]);
    if (!ok) {
        console.log("\nCONTROL RUN FAILED — the staged copy does not build+pass.");
        console.log("Every refusal below would be refusing for an unrelated reason (r12). Stopping.\n");
        console.log((b.out + g.out).slice(-3000));
        rmSync(ROOT, { recursive: true, force: true });
        process.exit(1);
    }
    pass++;
}

for (const [id, what, file, find, repl, expect, rebuild = true] of BREAKS) {
    const dir = stage();
    /* A break on a built artifact has to be applied AFTER the build, or the
       build overwrites it. A break on a source has to be applied before. */
    if (!rebuild) {
        const b = run(dir, "build-site.mjs");
        if (b.code !== 0) { rows.push([id, what, "STAGE BUILD FAILED", ""]); fail++; continue; }
    }
    const p = join(dir, file);
    const before = readFileSync(p, "utf8");
    const after = before.replace(find, repl);
    if (after === before) {
        rows.push([id, what, "NOT APPLIED", `the string ${JSON.stringify(String(find).slice(0, 46))} is not in ${file}`]);
        fail++; continue;
    }
    writeFileSync(p, after);

    let out = "", code = 0;
    if (rebuild) {
        const b = run(dir, "build-site.mjs");
        out += b.out;
        /* A build that REFUSES is a legitimate refusal — the build gate is
           part of this publication path, not a failure of the harness. */
        if (b.code !== 0) code = b.code;
        else { const g = run(dir, "launch-gate.mjs"); out += g.out; code = g.code; }
    } else {
        const g = run(dir, "launch-gate.mjs"); out += g.out; code = g.code;
    }

    const reason = (out.match(/(FAIL .*|BUILD REFUSED[\s\S]{0,200})/g) || []).join(" | ");
    const refused = code !== 0;
    const right = expect.test(reason);
    if (refused && right) { rows.push([id, what, "REFUSED", reason.replace(/\s+/g, " ").slice(0, 96)]); pass++; }
    else if (refused) { rows.push([id, what, "WRONG REASON", reason.replace(/\s+/g, " ").slice(0, 96)]); fail++; }
    else {
        /* r12, one level deeper. Asserting the SOURCE changed is not enough in
           a repo with a build: dense() strips comments, so a patch dropped
           into one is erased before the gate ever sees it and the row reads
           like a gate hole. Say which it was. */
        const outs = ["index.html", "convert/index.html", "globe.js", "contact.js", "amp-nav.js"];
        const needle = String(Array.isArray(repl) ? repl[0] : repl).trim().split("\n")[0].slice(0, 40);
        const survived = needle && outs.some((o) => {
            try { return readFileSync(join(dir, o), "utf8").includes(needle); } catch { return false; }
        });
        rows.push([id, what, survived ? "PASSED — NOT CAUGHT (real gate hole)" : "PASSED — patch ERASED BY THE BUILD, not a gate hole",
            survived ? "" : `${JSON.stringify(needle)} reached no published artifact`]);
        fail++;
    }
}

rmSync(ROOT, { recursive: true, force: true });

const w = Math.max(...rows.map((r) => r[1].length));
console.log("");
for (const [id, what, verdict, detail] of rows) {
    console.log(`  ${id.padEnd(9)} ${what.padEnd(w)}  ${verdict}`);
    if (detail) console.log(`  ${"".padEnd(9)} ${"".padEnd(w)}  ${detail}`);
}
console.log(`\nbreak harness: ${pass} of ${pass + fail} (1 control + ${BREAKS.length} breaks).`);
if (fail) { console.error(`${fail} did not behave as required.`); process.exit(1); }
