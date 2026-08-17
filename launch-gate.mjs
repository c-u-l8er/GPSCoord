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
import { createHash } from "crypto";

const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p));
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

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

/* ==========================================================================
   0. THE ARTIFACT CAME FROM THIS BUILD — SHELL.md r6, hole 2

   This is first because everything below it reads the artifact, and reading a
   stale artifact carefully is worse than not reading it: it produces a page of
   PASS lines about a file nobody just built. If build-site.mjs threw — and
   throwing on a record that disagrees with the arithmetic is its JOB — the
   previous index.html survived on disk and every check here passed on it.

   The build now invalidates records/build-manifest.json before it reads a
   single record and rewrites it, with hashes of both sides, only on success:

     outputs  the artifact is byte-for-byte what that run emitted
              → catches a hand-edit made after a good build
     inputs   no source has moved since that run
              → catches a build that threw, and a record edited without one

   Outputs alone are not enough, and this is the subtle half: a build that
   throws BEFORE its first write leaves old artifacts matching an old manifest
   perfectly. Only the inputs say that the world has moved on.
   ========================================================================== */
{
    const MANIFEST = "./records/build-manifest.json";
    T("the build left a manifest", existsSync(MANIFEST));
    let man = null;
    if (existsSync(MANIFEST)) {
        try { man = J(MANIFEST); } catch (e) { T("the build manifest parses", false, e.message); }
    }
    T("the build that wrote the manifest finished",
        !!man && man.status === "complete",
        man ? `status ${JSON.stringify(man.status)}` : "no manifest");
    if (man && man.status === "complete") {
        T("the manifest carries the release under test", man.version === pkg.version,
            `${man.version} / ${pkg.version}`);
        /* Every artifact this gate then reads must be one the manifest owns.
           A page that is served but was never emitted is the same defect
           wearing a different hat. */
        for (const f of ["./index.html", "./convert/index.html", "./globe.js", "./contact.js"])
            T(`the manifest owns the artifact ${f}`, f in (man.outputs || {}));
        const drift = [];
        for (const [side, list] of [["output", man.outputs], ["input", man.inputs]])
            for (const [p, want] of Object.entries(list || {})) {
                if (!existsSync(p)) { drift.push(`${side} ${p} is gone`); continue; }
                const got = sha256(p);
                if (got !== want) drift.push(`${side} ${p} ${got.slice(0, 12)} != ${want.slice(0, 12)}`);
            }
        T("every artifact is byte-for-byte the one this build emitted, and no source has moved since",
            drift.length === 0,
            drift.length ? drift.join(" ; ")
                : `${Object.keys(man.outputs).length} outputs + ${Object.keys(man.inputs).length} inputs, all hashes match`);
    }
}

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
   not.

   NARROWED 2026-08-17, DELIBERATELY, AND NOT DELETED. This check used to name
   two scripts and require a literal `defer` on both. Travis then ruled the
   shared <amp-nav> onto every website including the tier-4 surfaces, and the
   nav is a third script that carries `type="module"` rather than `defer`.

   The rule was never "zero JS" — this page has shipped two scripts all along.
   It is "NO JS THE CONTENT DEPENDS ON", and that is what stays enforced: the
   text floor and the rung/status/evidence checks below all read the page with
   script stripped, so anything load-bearing that hides in a script fails
   there before it reaches here. What this check enforces is the narrower
   promise that the SET is enumerated and each member is accounted for.

   Widening it by one is how a check like this dies, so each addition is named
   with the reason it is allowed to exist:
     /amp-nav.js   chrome. Ruled onto every site. Removing it costs a way to
                   reach sibling domains and no content whatsoever.
     /globe.js     decoration. §12 below proves it writes nothing into the doc.
     /contact.js   an upgrade. The form carries action and method, so it posts
                   without it; the check next door is what proves that. */
{
    const tags = [...landing.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    T("the landing page ships no inline JavaScript", tags.every((t) => t[2].trim() === ""));
    const WANT_SCRIPTS = ["/amp-nav.js", "/globe.js", "/contact.js"];
    const srcs = tags.map((t) => (t[1].match(/\bsrc="([^"]*)"/) || [])[1]);
    /* `type="module"` IS deferred — the spec defers module scripts by
       definition — so requiring the literal attribute would reject a script
       that is already doing the thing the attribute asks for. Either is
       accepted; a bare synchronous script still is not. */
    const deferred = (attrs) => /\bdefer\b/.test(attrs) || /\btype="module"/.test(attrs);
    T("the landing page loads exactly the three scripts it declares, none of them synchronous",
        srcs.length === WANT_SCRIPTS.length &&
        WANT_SCRIPTS.every((w, i) => srcs[i] === w) &&
        tags.every((t) => deferred(t[1])),
        srcs.join(", ") || "none");
}

/* ---------- 3a. the shared nav is on BOTH routes, as an element ----------
   Travis, 2026-08-17: "the ampersand-nav needs to be on each website!" and,
   asked about the tier-4 surfaces specifically, "yes add the nav to those
   too."

   GATED BECAUSE IT VANISHED SILENTLY FROM SEVEN SURFACES. That is the failure
   mode worth checking for: nothing breaks, no page errors, the site just
   quietly stops being part of the portfolio.

   SCOPED TO THE ELEMENT (r14). A <script src> naming the file is not the nav —
   it is a file that might define one — and neither is the word "amp-nav" in a
   comment, of which both templates carry one. Comments and script/style
   bodies come out before this counts, and it counts ELEMENTS. A naive
   grep -c '<amp-nav' over the emitted landing page returns 3; exactly one of
   those is an element, and that difference is the whole point of the rule.

   BOTH ROUTES, because "/ has the nav" was never the claim — a converter you
   can reach and then cannot navigate away from is the same defect on the page
   people actually use. */
{
    const elements = (h) =>
        [...h.replace(/<!--[\s\S]*?-->/g, " ")
             .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
             .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
             .matchAll(/<amp-nav\b[^>]*>/gi)].map((m) => m[0]);
    for (const [name, h] of [["/", landing], [APP, app]]) {
        const els = elements(h);
        T(`${name} carries exactly one <amp-nav> element`, els.length === 1,
            `${els.length} element(s), ${(h.match(/<amp-nav\b/gi) || []).length} raw text occurrence(s)`);
        T(`${name} loads amp-nav.js as a module`,
            /<script\b[^>]*\btype="module"[^>]*\bsrc="\/amp-nav\.js"/.test(h));
    }
    /* The vendored file is not ours to edit, and "please don't" is not a
       check. The build COPIES vendor/amp-nav.js to ./amp-nav.js, so the two
       must be byte-identical; if they are not, somebody hand-edited the
       served copy and the next sync-nav.sh run will silently revert it. */
    const vend = readFileSync("./vendor/amp-nav.js");
    const served = readFileSync("./amp-nav.js");
    T("the served amp-nav.js is byte-identical to the vendored copy",
        vend.equals(served), `vendor ${vend.length} B / served ${served.length} B`);
    /* Buffer.byteLength, not String.length: r15. The two differ on any
       non-ASCII byte, and a §0.1 deploy check compares against curl. */
    T("the vendored nav is the deployed 51,428-byte revision",
        Buffer.byteLength(vend) === 51428, `${Buffer.byteLength(vend)} bytes`);
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
   This is the retraction made structural: it cannot be undone by an edit.

   SHELL.md r6, hole 1 — THIS CHECK DETECTED WHERE IT HAD TO COUNT, and it
   made a real deliberate break pass. It used to ask:

       is this string present?  and is it also somewhere in the retraction?

   Both true, so both fine — for ANY number of occurrences, ANYWHERE on the
   page. A page could keep its retraction word for word and reinstate the
   fabricated coordinate in the hero, and this file called it clean. The
   retraction became a licence to say the thing it retracts.

   So: COUNT, and BOUND. Every occurrence of a blocklisted string must be
   inside the retraction block, and there may be at most ALLOWED (default 1)
   of them there. Naming a wrong value once is what a retraction is; naming it
   twice is prose, and prose is where a claim hides. A second legitimate
   mention is then a deliberate edit to the number below, reviewed, rather
   than an accident nothing notices.

   SHELL.md r10 — AND THE BOUND IS A NUMBER, NOT AN EQUALITY. The obvious
   repair for the above is `onPage === inRetraction`, and it is still
   defective: the retraction is authored content, so writing the retracted
   sentence three more times INSIDE it keeps both sides equal and puts the
   claim on the artifact four times. A sibling lane made exactly that print
   `114 passed, 0 refused`. A check whose two sides are both under the
   author's control is not a check. Hence `outside === 0 && inside <= cap`,
   two numbers, neither of them the other.

   And a HIDDEN occurrence is refused outright: a blocklisted string in the
   file but not in the visible text — an attribute, a comment, a meta tag —
   is a claim a crawler reads and a person cannot see, which is worse than
   one printed honestly. */
const RETRACTED = [
    "200K+", "Active Pathfinders", "Pathfinders",
    "<50ms", "195 Countries", "195 countries",
    "enterprise-grade", "Enterprise-grade",
    "Launching 2026", "Get Early Access",
    "14RPU9784270738", "597842 3270738",
];
const ALLOWED = { "14RPU9784270738": 1, "597842 3270738": 1 };
const occurrences = (h, s) => h.split(s).length - 1;
{
    /* The block is delimited structurally, not by a sentence: splitting on the
       words "Retraction —" would hand the whole rest of the page to any future
       revision that mentions them in a heading somewhere else. */
    const RETRACT_RE = /<div class="retract">[\s\S]*?<\/div>/g;
    for (const [path, body] of Object.entries(pages)) {
        const blocks = body.match(RETRACT_RE) || [];
        const zone = blocks.join("\n");
        for (const b of blocks)
            T(`${path} the retraction block is flat (a nested <div> would truncate the zone)`,
                !/<div\b/.test(b.slice(b.indexOf(">") + 1)));
        /* r8 order: comments first, then script/style, then tags. `<[^>]+>`
           stops at the first `>`, so a comment containing one survives it.

           r12: and SPLIT on tags rather than replacing them with a space.
           Flattening the document into one blob breaks a multi-word rule in
           both directions — a phrase spanning a tag boundary can never be
           found, and two unrelated text nodes joined by a space manufacture a
           phrase nobody wrote. Two of the strings blocked here have a space
           in them, so this is not hypothetical for this file. */
        const nodesOf = (h) => h
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
            .split(/<[^>]+>/)
            .map((t) => t.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const textNodes = nodesOf(body);
        const inText = (needle) =>
            textNodes.reduce((n, t) => n + (t.split(needle).length - 1), 0);
        for (const s of RETRACTED) {
            const total = occurrences(body, s);
            const inside = occurrences(zone, s);
            const outside = total - inside;
            const seen = inText(s);
            const cap = ALLOWED[s] ?? 1;
            T(`${path} does not reinstate "${s}"`,
                outside === 0 && inside <= cap,
                total === 0 ? "absent"
                    : `${total} occurrence(s), ${outside} outside the retraction (bound 0), ${inside} inside it (bound ${cap})`);
            T(`${path} hides no occurrence of "${s}"`, total <= seen,
                total === 0 ? "absent" : `${total} in the file, ${seen} in the visible text`);
        }
    }
    /* A retraction that is deleted un-retracts everything, silently. The
       landing page carries this one and must keep carrying it. */
    T("the landing page still carries its retraction",
        (landing.match(RETRACT_RE) || []).length === 1 && /Retraction (&mdash;|—)/.test(landing),
        `${(landing.match(RETRACT_RE) || []).length} retraction block(s)`);

    /* ---- r15: THE BLOCKLIST RUNS OVER EVERY FILE THE BUILD PUBLISHES ----
       Everything above reads the two HTML pages. This deploy also serves
       three JavaScript files, and a sibling surface shipped a retracted claim
       inside exactly that — a published script its gate never opened, with
       three of its four downloadable files exempt. "200K+" or "Enterprise-
       grade" sitting in a string literal is served, indexed and quotable; it
       does not become acceptable by being in a .js.

       The list is the manifest's OUTPUTS, not a list typed here, so a file
       this build starts emitting tomorrow is covered the day it appears —
       the same reason build-site.mjs enumerates its inputs from the
       directory rather than naming them. No occurrence is allowed at all:
       the retraction block lives in the HTML, so an asset has no zone in
       which naming a retracted claim would be honest. */
    const outs = (() => { try { return J("./records/build-manifest.json").outputs || {}; }
                          catch { return {}; } })();
    const assets = Object.keys(outs).filter((p) => !/\.html?$/i.test(p));
    /* If the manifest has no assets the scan would pass by having nothing to
       do, which is the vacuous pass r12 warns about. */
    T("the manifest names the published assets this scan reads", assets.length > 0,
        `${assets.length} asset(s)`);
    let assetHits = 0;
    for (const p of assets) {
        const body = read(p);
        for (const s of RETRACTED) {
            const n = occurrences(body, s);
            if (!n) continue;
            assetHits++;
            T(`${p} does not reinstate "${s}"`, false, `${n} occurrence(s) in a published asset`);
        }
    }
    T(`every published non-HTML asset is clear of all ${RETRACTED.length} retracted claims (r15)`,
        assetHits === 0, assets.join(", ") || "no assets");

    /* ---- and the deploy tree is bigger than the build's outputs ----
       The scan above covers what the build EMITS. Cloudflare Pages serves the
       repository root, which also contains the archive and the tools — and
       launch-gate.mjs and break-harness.mjs both name every string in
       RETRACTED, because that is what they are made of. Until 2026-08-17 this
       repo had no _redirects at all and every one of them was reachable.

       This does not re-scan them; it requires them to be CLOSED, which is the
       only exemption r10 permits — the file the host obeys rather than a list
       written for the gate. */
    const redirects = (() => { try { return read("./_redirects"); } catch { return ""; } })();
    /* Match the redirect LINE, not the substring: "/check.mjs" appears inside
       other paths and a bare .includes() would pass on a rule about something
       else. The only metacharacter a Pages path uses is *, so escape the rest
       and let * mean "anything". */
    const closed = (p) => {
        const rx = p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^\\s]*");
        return new RegExp("^" + rx + "\\s+\\S+\\s+30[12]\\s*$", "m").test(redirects);
    };
    for (const p of ["/old_scrap/*", "/build-site.mjs", "/launch-gate.mjs", "/check.mjs", "/break-harness.mjs"])
        T(`${p} is closed in _redirects, so the host does not serve it`, closed(p));
}

/* ---------- 5. no dead mailbox anywhere ---------- */
for (const [path, body] of Object.entries(pages)) {
    T(`${path} advertises no mailto:`, !body.includes("mailto:"));
}
T("the correction channel is a live URL, not a mailbox",
    /^https:\/\//.test(surface.contact.url) && surface.contact.kind !== "mailto");

/* ---------- 5b. the correction channel is a form that works — SHELL.md r9 ----------
   Ruled by Travis 2026-08-17. The [TRAVIS] blocker this surface carried since
   2026-08-16 — no endpoint of its own — is answered with the ComputeDriven one.

   Everything here is checked on the ARTIFACT rather than the source, because
   what matters is the form a visitor is handed. The endpoint is declared ONCE
   in the frozen record and the page is compared against it, so a page cannot
   invent an endpoint of its own; and the honeypot is checked by name, because
   a honeypot dropped in a refactor fails silently and invisibly — no error, no
   visual change, just more spam six weeks later. */
{
    const c = surface.contact;
    /* PINNED, not merely well-formed. Comparing the page against the record
       only proves the two agree — move the record and they agree on a wrong
       endpoint, which is exactly what happened the first time this check was
       broken on purpose. r9 RULED one endpoint; this is that ruling, written
       where a build can enforce it. */
    const RULED_ENDPOINT = "https://formspree.io/f/xaewoadr";
    T("the record declares the endpoint SHELL.md r9 ruled",
        c.kind === "form" && c.form_endpoint === RULED_ENDPOINT,
        c.form_endpoint || `kind ${c.kind}`);
    const form = (landing.match(/<form\b[^>]*class="say"[^>]*>[\s\S]*?<\/form>/) || [])[0] || "";
    T("the landing page carries the contact form", !!form);
    const open = (form.match(/<form\b[^>]*>/) || [""])[0];
    T("the form posts to the endpoint the record declares",
        new RegExp(`action="${(c.form_endpoint || "x").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(open),
        (open.match(/action="([^"]*)"/) || [])[1] || "no action");
    /* Without action AND method it is not a form, it is a div waiting for
       JavaScript — and this page's whole contract is that it works without. */
    T("the form works with JavaScript off: it has a real method",
        /\bmethod="POST"/i.test(open), (open.match(/method="[^"]*"/) || ["no method"])[0]);
    T("the form defers validation messages to the page, not the browser",
        /\bnovalidate\b/i.test(open));
    T("the form carries the _gotcha honeypot",
        /<input[^>]*\bname="_gotcha"[^>]*>/.test(form) &&
        /name="_gotcha"[^>]*tabindex="-1"/.test(form.replace(/\n/g, " ")) &&
        /name="_gotcha"[^>]*aria-hidden="true"/.test(form.replace(/\n/g, " ")),
        (form.match(/<input[^>]*_gotcha[^>]*>/) || ["MISSING"])[0]);
    T("the reply paragraph is announced to a screen reader",
        /<p class="say-msg" role="status" aria-live="polite">/.test(form));
    T("the form asks for the message this portfolio most needs",
        /a number of ours you think is wrong/.test(form));
    /* The honeypot must be off-screen, not display:none: some bots skip
       anything a stylesheet has explicitly hidden, which defeats it. */
    T("the honeypot is hidden by position, not by display",
        /\.say input\[name=_gotcha\]\{[^}]*position:absolute/.test(landing) &&
        !/\.say input\[name=_gotcha\]\{[^}]*display:none/.test(landing));
    T("the form's own script is an upgrade, not the mechanism",
        read("./src/contact.js").includes("preventDefault") &&
        /res\.ok|r\.ok/.test(read("./src/contact.js")),
        "success printed only on a 2xx from the endpoint");
}

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
    /* SHELL.md r8 — COMMENTS COME OFF FIRST, as their own pass. `<[^>]+>`
       stops at the first `>`, so a comment containing one (this repo's are
       full of them: `-->`, `a > b`) is only partly removed and its remainder
       counts as visible page text. Stripping <script> first is also wrong in
       the same way: a comment mentioning a script tag swallows everything up
       to the real closing tag. Order is the fix, and it is free. */
    const texts = landing
        .replace(/<!--[\s\S]*?-->/g, "<>")
        .replace(/<script[\s\S]*?<\/script>/gi, "<>")
        .replace(/<style[\s\S]*?<\/style>/gi, "<>")
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
    ["--data", "--ink", "the contact form's reply on success"],
    ["--warn", "--ink", "the contact form's reply on failure"],
    ["--fg", "--ink2", "what you type into the contact form"],
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

/* ==========================================================================
   15. THE CTA PAINTS THE COLOUR ITS OWN RULE DECLARES — SHELL.md r7

   Check 13 above reads DECLARED tokens: it proves --acc on --ink is legible.
   It cannot see a button that never receives its declared colour at all, and
   this page shipped exactly that:

       .top nav a{color:var(--fg2)}       specificity 0,2,1   WINS
       .btn{background:var(--acc);color:#180d04}   0,1,0       loses

   so the header CTA painted rgba(233,236,241,.62) on rgb(255,138,61) —
   measured in a browser 2026-08-17, before the fix — while the SAME button
   in the hero painted rgb(24,13,4). Every contrast check passed, because
   every contrast check was reading the token the rule declares rather than
   the colour the element ends up with.

   So this resolves the cascade over the artifact: the whole stylesheet, in
   source order, with specificity, !important, @media, :not() and inline
   style, against a real ancestor tree parsed out of the emitted HTML. For
   every .btn it asks WHICH RULE WINS `color`, and refuses unless that rule
   is itself about buttons — .btn, .btn.ghost, .btn:hover. A colour handed
   to a button by a rule that knows nothing about buttons is the defect,
   whatever value it happens to land on.

   Both states are checked. At rest the pre-fix nav CTA was washed-out light
   ink on saturated orange; at :hover `.top nav a:hover` repainted it
   rgb(255,138,61) — --acc ON --acc, the button vanishing under the pointer.
   That second half was not in the r7 report and is the reason :hover is not
   optional here.

   VALIDATED AGAINST A BROWSER, both before and after the fix: the resolver's
   answer equals getComputedStyle().color for all 3 .btn elements on / and
   all 5 on wrand.cc, at rest and hovered. A resolver that disagreed with a
   browser would be worse than no check at all.
   ========================================================================== */
{
    const VOIDEL = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"]);
    const STATEP = new Set(["hover", "focus", "focus-visible", "focus-within",
        "active", "visited", "link", "any-link", "target"]);
    const splitTop = (s, ch) => {
        const out = []; let buf = "", d = 0;
        for (const c of s) {
            if (c === "(") d++; else if (c === ")") d--;
            if (c === ch && d === 0) { out.push(buf); buf = ""; continue; }
            buf += c;
        }
        out.push(buf); return out;
    };
    const declsOf = (body) => splitTop(body, ";").map((part) => {
        const k = part.indexOf(":");
        if (k < 0) return null;
        const prop = part.slice(0, k).trim().toLowerCase();
        let val = part.slice(k + 1).trim();
        const imp = /!important\s*$/i.test(val);
        if (imp) val = val.replace(/!important\s*$/i, "").trim();
        return prop ? { prop, val, imp } : null;
    }).filter(Boolean);

    /* every <style> in the artifact, flattened, @media preserved as context */
    function sheetOf(html) {
        const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
            .map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
        const rules = []; let order = 0;
        (function walk(src, media) {
            let i = 0;
            for (;;) {
                const open = src.indexOf("{", i);
                if (open < 0) break;
                const prelude = src.slice(i, open).trim();
                let depth = 1, j = open + 1;
                while (j < src.length && depth) {
                    if (src[j] === "{") depth++; else if (src[j] === "}") depth--;
                    j++;
                }
                const body = src.slice(open + 1, j - 1);
                if (prelude.startsWith("@")) {
                    /* rules inside a @media are candidates too: a colour that
                       only breaks at 430px is still a colour that breaks. */
                    if (/^@(media|supports|layer|scope)\b/i.test(prelude))
                        walk(body, media ? media + " / " + prelude : prelude);
                } else if (prelude) {
                    for (const sel of splitTop(prelude, ",")) {
                        const s = sel.trim();
                        if (s) rules.push({ sel: s, body, order: order++, media: media || "" });
                    }
                }
                i = j;
            }
        })(css, "");
        return rules;
    }

    /* the artifact as an ancestor tree — `.top nav a` needs real ancestry */
    function domOf(html) {
        const root = { tag: "#root", attrs: {}, cls: new Set(), children: [], parent: null };
        const stack = [root]; const all = [];
        const re = /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<!doctype[^>]*>|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
        let m;
        while ((m = re.exec(html))) {
            if (m[1]) continue;
            if (m[2]) {
                const tag = m[2].toLowerCase();
                for (let i = stack.length - 1; i > 0; i--)
                    if (stack[i].tag === tag) { stack.length = i; break; }
                continue;
            }
            if (!m[3]) continue;
            const attrs = {};
            for (const a of (m[4] || "").matchAll(/([\w:.-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))
                attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? a[5] ?? "";
            const el = {
                tag: m[3].toLowerCase(), attrs,
                cls: new Set((attrs.class || "").trim().split(/\s+/).filter(Boolean)),
                children: [], parent: stack[stack.length - 1],
            };
            el.parent.children.push(el);
            all.push(el);
            if (!VOIDEL.has(el.tag) && !/\/\s*$/.test(m[4] || "")) stack.push(el);
        }
        return all;
    }

    function parseCompound(s) {
        const c = { tag: "", id: "", classes: [], attrs: [], pseudos: [], nots: [], pseudoEl: false, unknown: [] };
        let i = 0;
        const name = () => { let n = ""; while (i < s.length && /[\w-]/.test(s[i])) n += s[i++]; return n; };
        while (i < s.length) {
            const ch = s[i];
            if (ch === "*") { c.tag = "*"; i++; }
            else if (ch === ".") { i++; c.classes.push(name()); }
            else if (ch === "#") { i++; c.id = name(); }
            else if (ch === "[") {
                const end = s.indexOf("]", i);
                const mm = s.slice(i + 1, end).match(/^([\w:-]+)\s*(?:([~|^$*]?=)\s*"?([^"\]]*)"?)?$/);
                if (mm) c.attrs.push({ name: mm[1].toLowerCase(), op: mm[2] || "", val: mm[3] ?? "" });
                i = end + 1;
            } else if (ch === ":") {
                if (s[i + 1] === ":") { c.pseudoEl = true; i += 2; name(); continue; }
                i++;
                const n = name();
                if (s[i] === "(") {
                    let d = 1, j = i + 1;
                    while (j < s.length && d) { if (s[j] === "(") d++; else if (s[j] === ")") d--; j++; }
                    const arg = s.slice(i + 1, j - 1); i = j;
                    if (n === "not") for (const p of splitTop(arg, ",")) c.nots.push(parseCompound(p.trim()));
                    else c.unknown.push(n + "()");
                } else if (STATEP.has(n) || n === "root") c.pseudos.push(n);
                else c.unknown.push(n);
            } else if (/[\w-]/.test(ch)) c.tag = name().toLowerCase();
            else i++;
        }
        return c;
    }
    function parseSelector(sel) {
        const parts = []; let buf = "", d = 0, comb = null;
        for (let i = 0; i < sel.length; i++) {
            const ch = sel[i];
            if (ch === "(") d++; else if (ch === ")") d--;
            if (d === 0 && /[\s>+~]/.test(ch)) {
                let k = " ", j = i;
                while (j < sel.length && /[\s>+~]/.test(sel[j])) { if (sel[j] !== " ") k = sel[j]; j++; }
                if (buf) { parts.push({ comb, c: parseCompound(buf) }); buf = ""; comb = k; }
                i = j - 1; continue;
            }
            buf += ch;
        }
        if (buf) parts.push({ comb, c: parseCompound(buf) });
        return parts;
    }
    function specificity(parts) {
        const s = [0, 0, 0];
        (function add(list) {
            for (const p of list) {
                const c = p.c || p;
                if (c.id) s[0]++;
                s[1] += c.classes.length + c.attrs.length + c.pseudos.length + c.unknown.length;
                if (c.tag && c.tag !== "*") s[2]++;
                if (c.pseudoEl) s[2]++;
                add(c.nots);
            }
        })(parts);
        return s;
    }
    const prevSib = (el) => {
        const k = el.parent ? el.parent.children.indexOf(el) : -1;
        return k > 0 ? el.parent.children[k - 1] : null;
    };
    /* true / false / null — and null means THE RESOLVER CANNOT DECIDE, which
       is refused rather than waved through. A check that cannot decide and
       reports a pass is the thing this whole file exists to prevent. */
    function matchCompound(el, c, state) {
        if (c.pseudoEl) return false;
        if (c.unknown.length) return null;
        if (c.tag && c.tag !== "*" && el.tag !== c.tag) return false;
        if (c.id && el.attrs.id !== c.id) return false;
        for (const cl of c.classes) if (!el.cls.has(cl)) return false;
        for (const a of c.attrs) {
            const v = el.attrs[a.name];
            if (v === undefined) return false;
            if (a.op === "=" && v !== a.val) return false;
            if (a.op === "~=" && !v.split(/\s+/).includes(a.val)) return false;
            if (a.op === "^=" && !v.startsWith(a.val)) return false;
            if (a.op === "$=" && !v.endsWith(a.val)) return false;
            if (a.op === "*=" && !v.includes(a.val)) return false;
        }
        for (const p of c.pseudos) {
            if (p === "root") { if (el.tag !== "html") return false; continue; }
            if (!state.has(p)) return false;
        }
        for (const n of c.nots) {
            const r = matchCompound(el, n, state);
            if (r === null) return null;
            if (r) return false;
        }
        return true;
    }
    function matchFrom(el, parts, idx, state) {
        const r = matchCompound(el, parts[idx].c, state);
        if (r !== true) return r;
        if (idx === 0) return true;
        const comb = parts[idx].comb;
        let undec = false;
        if (comb === " " || comb === "~") {
            const next = comb === " " ? (e) => e.parent : prevSib;
            for (let p = next(el); p && p.tag !== "#root"; p = next(p)) {
                const q = matchFrom(p, parts, idx - 1, state);
                if (q === null) undec = true; else if (q) return true;
            }
            return undec ? null : false;
        }
        if (comb === ">")
            return el.parent && el.parent.tag !== "#root" ? matchFrom(el.parent, parts, idx - 1, state) : false;
        if (comb === "+") {
            const s = prevSib(el);
            return s ? matchFrom(s, parts, idx - 1, state) : false;
        }
        return false;
    }
    const expand = (v, vars, n = 0) => (n > 8 || !/var\(/.test(v) ? v : expand(
        v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g,
            (m, k, fb) => (vars[k] !== undefined ? vars[k] : (fb || "").trim())), vars, n + 1));
    function normColour(v) {
        const s = String(v).trim().toLowerCase();
        let m = /^#([0-9a-f]{3,8})$/.exec(s);
        if (m) {
            let h = m[1];
            if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
            const p = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
            if (h.length === 8) return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${+(parseInt(h.slice(6, 8), 16) / 255).toFixed(2)})`;
            return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
        }
        m = /^rgba?\(([^)]*)\)$/.exec(s);
        if (m) {
            const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
            return p.length > 3 && p[3] !== 1
                ? `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]})`
                : `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
        }
        return { white: "rgb(255, 255, 255)", black: "rgb(0, 0, 0)", transparent: "rgba(0, 0, 0, 0)" }[s] || s;
    }

    /* Resolve `color` on one element: the winning declaration, and the rule
       it came from. Inheritance is walked because a .btn need not declare
       one at all. */
    function resolveColour(el, rules, cache, vars, state) {
        let best = null; const undecidable = [];
        for (const r of rules) {
            if (!cache.has(r)) {
                const parts = parseSelector(r.sel);
                cache.set(r, { parts, spec: specificity(parts), decls: declsOf(r.body) });
            }
            const p = cache.get(r);
            const m = matchFrom(el, p.parts, p.parts.length - 1, state);
            if (m === null) {
                /* only rules that could have changed the answer are worth naming */
                if (p.decls.some((d) => d.prop === "color")) undecidable.push(r.sel);
                continue;
            }
            if (!m) continue;
            for (const d of p.decls) {
                if (d.prop !== "color") continue;
                const cand = { sel: r.sel, media: r.media, spec: p.spec, imp: d.imp, val: d.val, order: r.order };
                if (!best) { best = cand; continue; }
                if (cand.imp !== best.imp) { if (cand.imp) best = cand; continue; }
                let decided = false;
                for (let i = 0; i < 3 && !decided; i++)
                    if (cand.spec[i] !== best.spec[i]) { if (cand.spec[i] > best.spec[i]) best = cand; decided = true; }
                if (!decided && cand.order >= best.order) best = cand;
            }
        }
        const inline = el.attrs.style && declsOf(el.attrs.style).filter((d) => d.prop === "color").pop();
        if (inline) best = { sel: "style= attribute", media: "", spec: [1, 0, 0], imp: inline.imp, val: inline.val, order: 1e9 };
        if (!best) {
            if (el.parent && el.parent.tag !== "#root") return resolveColour(el.parent, rules, cache, vars, state);
            return { sel: null, value: null, undecidable };
        }
        return { sel: best.sel, media: best.media, value: normColour(expand(best.val, vars)), undecidable };
    }

    for (const [path, body] of Object.entries(pages)) {
        const rules = sheetOf(body);
        const vars = {};
        for (const r of rules)
            if (/^(:root|html)$/.test(r.sel))
                for (const d of declsOf(r.body)) if (d.prop.startsWith("--")) vars[d.prop] = d.val;
        const cache = new Map();
        const btns = domOf(body).filter((e) => e.cls.has("btn"));
        const bad = [], undecided = new Set(), seen = [];
        for (const state of [new Set(), new Set(["hover"])]) {
            const label = state.size ? ":hover" : "at rest";
            for (const b of btns) {
                const r = resolveColour(b, rules, cache, vars, state);
                r.undecidable.forEach((s) => undecided.add(s));
                /* THE RULE: a button's colour is decided by a rule about
                   buttons. `.top nav a` is not one, at any specificity. */
                const subject = parseSelector(r.sel || "")[parseSelector(r.sel || "").length - 1];
                const owned = !!subject && subject.c.classes.includes("btn");
                seen.push(`${label} ${b.attrs.class} = ${r.value}`);
                if (!owned)
                    bad.push(`<${b.tag} class="${b.attrs.class}"> ${label} paints ${r.value}, handed to it by ` +
                        `${JSON.stringify(r.sel)}${r.media ? " in " + r.media : ""} — not a .btn rule`);
            }
        }
        T(`${path} every .btn is coloured by a .btn rule, resting and hovered`,
            bad.length === 0 && undecided.size === 0,
            bad.length ? bad.join(" ; ")
                : undecided.size ? `the resolver cannot decide: ${[...undecided].join(", ")}`
                    : `${btns.length} .btn × 2 states — ${[...new Set(seen.map((s) => s.split(" = ")[1]))].join(", ")}`);
    }
    /* A landing page that has stopped issuing a CTA would pass the loop above
       vacuously, and vacuous is how a check dies quietly. */
    T("the landing page still has a .btn for that check to be about",
        domOf(landing).filter((e) => e.cls.has("btn")).length > 0);
}

console.log(`\n${pass} passed, ${fail} failed (publication gate)`);
if (fail) process.exit(1);
