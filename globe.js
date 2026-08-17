(function () {
"use strict";
var cv = document.querySelector("canvas[data-identity-animation]");
if (!cv || !cv.getContext) return;
var ctx = cv.getContext("2d");
if (!ctx) return;
var RINGS = 11;
var PER_RING = 20;
var CARS = 12;
var FPS = 30;
var SPIN = 0.00017;
var PERSP = 1000;
var DEPTHS = 6;
var TAU = Math.PI + Math.PI;
var TINTS = [
[255, 138, 61], [255, 176, 102], [255, 107, 44],
[255, 207, 154], [232, 117, 46], [255, 160, 79]
];
var seed = 76543;
function rnd() {
seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
return seed / 4294967296;
}
var W = 0, H = 0, R = 0, rot = 0;
var N = 0, ax, ay, az, sx, sy, sz, ss;
var E = 0, ea, eb, ew, ebucket, adj;
var cars = [];
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
function size() {
var box = cv.getBoundingClientRect();
var dpr = Math.min(window.devicePixelRatio || 1, 2);
W = Math.max(1, Math.round(box.width));
H = Math.max(1, Math.round(box.height));
cv.width = Math.round(W * dpr);
cv.height = Math.round(H * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
var still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
var booted = false, raf = 0, last = 0, acc = 0, onScreen = true;
function frame(now) {
raf = window.requestAnimationFrame(frame);
if (!last) last = now;
var dt = now - last;
last = now;
if (dt > 200) dt = 200;
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
size(); build(); draw();
sync();
}
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
