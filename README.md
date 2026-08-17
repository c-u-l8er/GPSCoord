# gpscoord.com

**What can we actually know from a coordinate?**

A latitude and longitude is a *position*, and position rewrites exactly into every
grid system ever standardised. That part is arithmetic and it works here.
Everything else people want from a coordinate — the county, the elevation, the
timezone, the address — is not in the coordinate at all. It is in a dataset, and
this project does not have one. The site says so on the page.

- `/` — the question, the boundary, and the evidence. **Its content ships with
  zero JavaScript**: every figure, rung chip, status row and word is rendered at
  build time from a frozen record. One deferred script draws the globe in the
  hero and does nothing else — delete it and nothing is missing.
- `/convert/` — the converter: DD ⇄ DMS ⇄ DDM ⇄ UTM ⇄ MGRS, plus geodesic
  distance and bearing. Entirely client-side. No API, no account, no request
  leaves the browser.

## The pages are generated, and the build refuses to publish drift

Nothing here is hand-edited HTML. `build-site.mjs` reads the frozen records in
`records/`, **recomputes every published coordinate with the same code the
converter runs**, and exits non-zero if a recomputed value disagrees with its
record. `launch-gate.mjs` then reads the emitted artifact and refuses on the
other ways a page lies.

This exists because of a real defect. The previous revision published a
hand-typed UTM/MGRS pair for Seguin, Texas that was wrong by 2,471 m, and it
survived a claim audit that reported every number had a witness — because it sat
inside a code sample and a "response shape" does not look like a claim. A number
can no longer be typed onto this site by hand.

```
npm run build         # regenerate index.html and convert/index.html
npm run check         # re-prove the arithmetic against the frozen records
npm run test:launch   # build + check + publication gate. This is the deploy command.
```

No dependencies. No network. Node 18+.

## What the gates actually refuse

Each of these was tested by deliberately breaking it:

| Break | Result |
|---|---|
| Alter a frozen UTM/MGRS/DMS/DDM value | build refuses |
| Change the arithmetic without updating the records | build refuses |
| Reinstate a claim removed by the `07d67ef` audit | gate refuses |
| Add a `mailto:` anywhere | gate refuses |
| Offer "Use it" in a `spec`-rung call to action | build refuses |
| Mark a review gate `approved` with no evidence | gate refuses |
| Let `package.json` and `records/surface.json` disagree on the version | build refuses |
| Call a `GPS.*` function the arithmetic does not export | gate refuses |

## Layout

```
records/    frozen expectations — the only place a claim may originate
  surface.json            rungs, status, the review ledger, what is not built
  reference-points.json   8 points, confirmed by PROJ 9.5.1 and NGA GEOTRANS
  reference-pairs.json    3 pairs, confirmed by GeographicLib
  verification.json       the dated cross-check and its known limits
src/
  coord.mjs    the arithmetic. One source, imported by the build and by
               check.mjs, and inlined into /convert/ by mechanical transform
  app.js       the converter UI
  globe.js     the identifying animation. Decoration: no inputs, no outputs
  shell.css    the ComputeDriven page shell (see ProjectAmp2/agents/SHELL.md)
  landing.html · convert.html   templates
index.html · convert/index.html · globe.js   GENERATED — do not edit
```

## The globe renders no data and asserts nothing

The hero carries a rotating globe with a routing graph on it — the site's
identifying animation, required of every ComputeDriven surface by SHELL.md §8.
It is **decoration, and it is sealed off from the page**: it takes no input from
the document, writes nothing back into it, and exposes no global.

That is not fastidiousness. The previous version of this site drew twelve
vehicles with `for (let i = 0; i < 12; i++)` and printed **"12 Active
Pathfinders"** beside them for months — a canvas constant published as a live
user metric. The publication gate now refuses any page whose text equals a
constant read from `globe.js`. **When it fires, the animation changes, never the
page:** the page's figures are recomputed from frozen records and have
witnesses; the animation can pick any number it likes.

It honours `prefers-reduced-motion` (one frame, then stop), caps its frame rate,
stops when the tab is hidden and when it scrolls out of view, and starts from a
`setTimeout` rather than an `IntersectionObserver` — IO never fires in a
non-compositing renderer, and an animation that never starts reads as a broken
page.

## Accuracy

Compared on 2026-08-16 against three implementations written by other people,
over 4,000 pseudo-random points and 1,500 point pairs:

| | |
|---|---|
| UTM vs PROJ 9.5.1 | max 7 × 10⁻⁹ m |
| MGRS vs NGA GEOTRANS | 0 mismatches / 4,000 |
| Distance vs GeographicLib | max 7.5 × 10⁻⁵ m; bearings within 1 × 10⁻⁵ arcsec |

Those witnesses are Python packages and are **not** dependencies here, so the
comparison is recorded rather than re-run. What `check.mjs` re-proves on every
build is the residue: the frozen reference values, plus the property checks a
wrong-but-self-consistent implementation would still fail.

**Known limits.** Vincenty's method does not converge for very nearly antipodal
pairs; the converter refuses those rather than printing a wrong distance. UTM and
MGRS are undefined outside 80°S–84°N and the converter says so instead of
extrapolating. Plus Code is unimplemented; what3words is proprietary and will not
be implemented.

## Deploy

The build writes to the repository root because that is what the domain serves
today. `/convert/` has never been requested on the live domain — the domain
answers every path with the same homepage — so **confirm the route resolves
before claiming the converter is deployed.** Until then its rung is
`live_local`, which is what `records/surface.json` says and what the page prints.
