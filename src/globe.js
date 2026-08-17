/* ==========================================================================
   GPSCoord — the identifying animation.  ProjectAmp2/agents/SHELL.md §8.

   A rotating globe with a routing graph laid over it: nodes on a lattice of
   parallels and meridians, edges between neighbours, and vehicles walking
   Dijkstra paths across the sphere.  Restored from the original gpscoord.com
   hero — `class SphereRouter`, at HEAD~2:index.html — and repainted in the
   shell tokens.  It is the same object: same lattice, same routing, same
   little lit vehicles.

   IT RENDERS NO DATA AND ASSERTS NOTHING.

   That is the one fixed rule of §8 and it is written in blood.  The original
   drew its vehicles with `for (let i = 0; i < 12; i++)`, and the page beside
   it published

       12   Active Pathfinders

   for months.  A canvas animation's internal constant was shipped as a live
   user metric.  So this file takes NO INPUT and produces NO OUTPUT: it reads
   nothing from the document but the canvas it draws on, it writes nothing
   anywhere, and it exposes no global.  Deleting the one <script> tag that
   loads it removes a decoration and nothing else — every figure, chip, status
   row and word on the landing page is rendered at build time from a frozen
   record and is still there with JavaScript off.

   launch-gate.mjs §12 refuses to publish if any text on the page equals a
   constant in this file.  WHEN THAT FIRES, THIS FILE CHANGES.  The animation
   is decoration and the page's numbers have witnesses; decoration yields.

   §8.4, and each of these is checked by the gate:
     · prefers-reduced-motion: reduce → one frame, then stop.
     · IntersectionObserver is an optimisation, NEVER the trigger.  It does not
       fire in a non-compositing renderer (SHELL.md §6), so a setTimeout with a
       `booted` guard is what actually starts the thing.
     · stops on document.hidden and when it scrolls out of view.
     · frame rate capped, draw calls bucketed by depth — it runs on a phone.
     · absolutely positioned behind the text, so it cannot delay or move the h1.
   ========================================================================== */
(function () {
"use strict";

var cv = document.querySelector("canvas[data-identity-animation]");
if (!cv || !cv.getContext) return;
var ctx = cv.getContext("2d");
if (!ctx) return;

/* --- tuning.  Decoration only.  None of these may appear as text on the
   page; the publication gate refuses the build if one does. --- */
var RINGS = 11;                 /* parallels carrying nodes */
var PER_RING = 20;              /* meridian steps */
var CARS = 12;                  /* routing vehicles */
var FPS = 30;                   /* frame cap */
var SPIN = 0.00017;             /* radians per millisecond */
var PERSP = 1000;               /* perspective distance */
var DEPTHS = 6;                 /* depth buckets — 6 strokes instead of ~600 */
var TAU = Math.PI + Math.PI;
var TINTS = [
    [255, 138, 61], [255, 176, 102], [255, 107, 44],
    [255, 207, 154], [232, 117, 46], [255, 160, 79]
];

/* Deterministic, so two loads draw the same graph and a screenshot means
   something.  Nothing here is derived from anything on the page. */
var seed = 76543;
function rnd() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
}

var W = 0, H = 0, R = 0, rot = 0;
var N = 0, ax, ay, az, sx, sy, sz, ss;
var E = 0, ea, eb, ew, ebucket, adj;
var cars = [];

/* ---------- geometry ---------- */
function build() {
    var i, j, k, c;
    N = RINGS * PER_RING;
    R = Math.min(W, H) * 0.36;
    ax = new Float32Array(N); ay = new Float32Array(N); az = new Float32Array(N);
    sx = new Float32Array(N); sy = new Float32Array(N);
    sz = new Float32Array(N); ss = new Float32Array(N);

    k = 0;
    for (i = 0; i < RINGS; i++) {
        var phi = Math.PI * (i + 1) / (RINGS + 1);
        var sp = Math.sin(phi), cp = Math.cos(phi);
        for (j = 0; j < PER_RING; j++) {
            var th = TAU * j / PER_RING;
            ax[k] = R * sp * Math.cos(th);
            ay[k] = R * cp;
            az[k] = R * sp * Math.sin(th);
            k++;
        }
    }

    /* edges: along each parallel, down to the next, and a scatter of
       diagonals so the routes are not all rectilinear */
    var A = [], B = [], Wt = [];
    for (i = 0; i < RINGS; i++) {
        for (j = 0; j < PER_RING; j++) {
            c = i * PER_RING + j;
            A.push(c); B.push(i * PER_RING + (j + 1) % PER_RING); Wt.push(1 + rnd() * 3);
            if (i < RINGS - 1) {
                A.push(c); B.push((i + 1) * PER_RING + j); Wt.push(1 + rnd() * 3);
                if (rnd() > 0.5) {
                    A.push(c);
                    B.push((i + 1) * PER_RING + (j + 1) % PER_RING);
                    Wt.push(1.5 + rnd() * 3);
                }
            }
        }
    }
    E = A.length;
    ea = new Int32Array(A); eb = new Int32Array(B); ew = new Float32Array(Wt);
    ebucket = new Int32Array(E);

    /* adjacency, so a route costs a scan rather than a scan per edge */
    adj = new Array(N);
    for (i = 0; i < N; i++) adj[i] = [];
    for (i = 0; i < E; i++) {
        adj[ea[i]].push(eb[i], ew[i]);
        adj[eb[i]].push(ea[i], ew[i]);
    }

    cars = [];
    for (i = 0; i < CARS; i++) {
        var a = (rnd() * N) | 0, b = (rnd() * N) | 0;
        while (b === a) b = (rnd() * N) | 0;
        cars.push({
            path: route(a, b), leg: 0, p: 0,
            v: 0.0006 + rnd() * 0.0011,
            t: TINTS[i % TINTS.length]
        });
    }
}

/* ---------- Dijkstra, over the adjacency list ---------- */
function route(from, to) {
    var dist = new Float64Array(N), prev = new Int32Array(N), seen = new Uint8Array(N);
    var i, u, best, a, v, d;
    for (i = 0; i < N; i++) { dist[i] = Infinity; prev[i] = -1; }
    dist[from] = 0;
    for (;;) {
        u = -1; best = Infinity;
        for (i = 0; i < N; i++) if (!seen[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0 || u === to) break;
        seen[u] = 1;
        a = adj[u];
        for (i = 0; i < a.length; i += 2) {
            v = a[i]; d = best + a[i + 1];
            if (d < dist[v]) { dist[v] = d; prev[v] = u; }
        }
    }
    var path = [], c = to, guard = N;
    while (c !== -1 && guard-- > 0) { path.unshift(c); c = prev[c]; }
    return path[0] === from ? path : [from];
}

/* ---------- motion ---------- */
function step(dt) {
    rot += SPIN * dt;
    for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        if (c.path.length < 2) continue;
        c.p += c.v * dt;
        while (c.p >= 1) {
            c.p -= 1;
            c.leg++;
            if (c.leg >= c.path.length - 1) {
                var s = c.path[c.path.length - 1];
                var e = (rnd() * N) | 0;
                while (e === s) e = (rnd() * N) | 0;
                c.path = route(s, e); c.leg = 0; c.p = 0;
                break;
            }
        }
    }
}

/* ---------- drawing.  Bucketed by depth: DEPTHS strokes for the whole
   graticule and DEPTHS fills for every node, rather than one style change
   per primitive.  This is the difference between cheap and not. ---------- */
function draw() {
    var i, q, cos = Math.cos(rot), sin = Math.sin(rot);
    var cx = W / 2, cy = H / 2, span = R + R;

    ctx.clearRect(0, 0, W, H);
    if (!N) return;

    for (i = 0; i < N; i++) {
        var xr = ax[i] * cos - az[i] * sin;
        var zr = ax[i] * sin + az[i] * cos;
        var sc = PERSP / (PERSP + zr);
        sx[i] = cx + xr * sc; sy[i] = cy + ay[i] * sc; sz[i] = zr; ss[i] = sc;
    }

    /* the limb, so it reads as a globe and not a ball of wire */
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,138,61,0.13)";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    for (i = 0; i < E; i++) {
        var nz = ((sz[ea[i]] + sz[eb[i]]) / span + 1) / 2;
        q = (nz * DEPTHS) | 0;
        ebucket[i] = q < 0 ? 0 : q >= DEPTHS ? DEPTHS - 1 : q;
    }
    for (q = DEPTHS - 1; q >= 0; q--) {
        ctx.beginPath();
        for (i = 0; i < E; i++) {
            if (ebucket[i] !== q) continue;
            ctx.moveTo(sx[ea[i]], sy[ea[i]]);
            ctx.lineTo(sx[eb[i]], sy[eb[i]]);
        }
        ctx.strokeStyle = "rgba(233,236,241," + (0.035 + (DEPTHS - 1 - q) * 0.021) + ")";
        ctx.stroke();
    }

    /* the routes the vehicles are on, behind the vehicles themselves */
    for (i = 0; i < cars.length; i++) drawPath(cars[i]);

    for (q = DEPTHS - 1; q >= 0; q--) {
        ctx.beginPath();
        for (i = 0; i < N; i++) {
            var d = ((sz[i] / span + 1) / 2 * DEPTHS) | 0;
            if (d >= DEPTHS) d = DEPTHS - 1; else if (d < 0) d = 0;
            if (d !== q) continue;
            var rad = 1.1 + ss[i] * 1.1;
            ctx.moveTo(sx[i] + rad, sy[i]);
            ctx.arc(sx[i], sy[i], rad, 0, TAU);
        }
        ctx.fillStyle = "rgba(233,236,241," + (0.09 + (DEPTHS - 1 - q) * 0.055) + ")";
        ctx.fill();
    }

    for (i = 0; i < cars.length; i++) drawCar(cars[i]);
}

function drawPath(c) {
    if (c.path.length < 2) return;
    var t = c.t;
    ctx.lineWidth = 1.4;
    for (var i = 0; i < c.path.length - 1; i++) {
        var f = c.path[i], g = c.path[i + 1];
        var nz = ((sz[f] + sz[g]) / span2() + 1) / 2;
        ctx.strokeStyle = "rgba(" + t[0] + "," + t[1] + "," + t[2] + "," + (0.06 + (1 - nz) * 0.3) + ")";
        ctx.beginPath();
        ctx.moveTo(sx[f], sy[f]);
        ctx.lineTo(sx[g], sy[g]);
        ctx.stroke();
    }
}
function span2() { return R + R; }

function drawCar(c) {
    if (c.path.length < 2 || c.leg >= c.path.length - 1) return;
    var f = c.path[c.leg], g = c.path[c.leg + 1], t = c.t;
    var x = sx[f] + (sx[g] - sx[f]) * c.p;
    var y = sy[f] + (sy[g] - sy[f]) * c.p;
    var z = sz[f] + (sz[g] - sz[f]) * c.p;
    var nz = (z / span2() + 1) / 2;
    var op = 0.3 + (1 - nz) * 0.7;
    var sc = 0.55 + ss[f] * 0.45;
    var rgb = t[0] + "," + t[1] + "," + t[2];

    var glow = ctx.createRadialGradient(x, y, 0, x, y, 17 * sc);
    glow.addColorStop(0, "rgba(" + rgb + "," + (op * 0.45) + ")");
    glow.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 17 * sc, 0, TAU); ctx.fill();

    ctx.fillStyle = "rgba(" + rgb + "," + op + ")";
    ctx.beginPath(); ctx.arc(x, y, 3.4 * sc, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(7,9,14,0.75)";
    ctx.stroke();
}

/* ---------- size.  Reads its own canvas box and nothing else. ---------- */
function size() {
    var box = cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(box.width));
    H = Math.max(1, Math.round(box.height));
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------- lifecycle ---------- */
var still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
var booted = false, raf = 0, last = 0, acc = 0, onScreen = true;

function frame(now) {
    raf = window.requestAnimationFrame(frame);
    if (!last) last = now;
    var dt = now - last;
    last = now;
    if (dt > 200) dt = 200;      /* a tab coming back must not fast-forward */
    acc += dt;
    if (acc < 1000 / FPS) return;
    step(acc); draw(); acc = 0;
}

function play() {
    if (raf || still) return;
    last = 0; acc = 0;
    raf = window.requestAnimationFrame(frame);
}
function pause() {
    if (!raf) return;
    window.cancelAnimationFrame(raf);
    raf = 0;
}
function sync() {
    if (!booted || still) return;
    if (onScreen && !document.hidden) play(); else pause();
}

function boot() {
    if (booted) return;
    booted = true;
    size(); build(); draw();     /* one frame at once — reduced motion ends here */
    sync();
}

/* The timeout is the trigger.  IntersectionObserver only tells us when to
   stop and start again; on its own it would never fire in a non-compositing
   renderer and the page would look broken. */
window.setTimeout(boot, 200);

if (window.IntersectionObserver) {
    new window.IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) boot();
        sync();
    }, { rootMargin: "120px" }).observe(cv);
}

document.addEventListener("visibilitychange", sync);

var resizeTimer = 0;
window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
        if (!booted) return;
        size(); build(); draw();
    }, 160);
});
})();
