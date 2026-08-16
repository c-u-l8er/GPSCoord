/* GPSCoord converter UI. Depends only on GPS (from src/coord.mjs, inlined
   above by build-site.mjs). No network, no storage, no third-party code. */
(function () {
    "use strict";
    var $ = function (id) { return document.getElementById(id); };
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------------- output rows ---------------- */
    var ROWS = window.__ROWS__;
    var outs = $("outs");
    ROWS.forEach(function (r) {
        var el = document.createElement("div");
        el.className = "out";
        el.id = "o-" + r.id;
        el.innerHTML = '<div class="n"><b></b><span></span></div><div class="v"></div>';
        el.querySelector("b").textContent = r.name;
        el.querySelector("span").textContent = r.note;
        var b = document.createElement("button");
        b.type = "button"; b.className = "cp"; b.textContent = "copy";
        b.addEventListener("click", function () {
            if (!el.classList.contains("na")) copy(el.querySelector(".v").textContent, b);
        });
        el.appendChild(b);
        outs.appendChild(el);
    });

    function copy(text, btn) {
        function ok() {
            btn.textContent = "copied"; btn.classList.add("done");
            setTimeout(function () { btn.textContent = "copy"; btn.classList.remove("done"); }, 1400);
        }
        function legacy() {
            var ta = document.createElement("textarea");
            ta.value = text; ta.setAttribute("readonly", "");
            ta.style.position = "fixed"; ta.style.top = "-1000px";
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); ok(); }
            catch (e) { btn.textContent = "select it"; }
            document.body.removeChild(ta);
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(ok, legacy);
        } else { legacy(); }
    }

    function value(r, p) {
        if (r.id === "dd") return p.lat.toFixed(6) + ", " + p.lon.toFixed(6);
        if (r.id === "dms") return GPS.toDMS(p.lat, true).text + " " + GPS.toDMS(p.lon, false).text;
        if (r.id === "ddm") return GPS.toDDM(p.lat, true).text + " " + GPS.toDDM(p.lon, false).text;
        if (r.id === "utm") {
            var u = GPS.toUTM(p.lat, p.lon);
            return u.ok ? u.zone + u.band + " " + u.easting.toFixed(2) + " " + u.northing.toFixed(2)
                        : { na: u.reason };
        }
        if (r.id === "mgrs") {
            var m = GPS.toMGRS(p.lat, p.lon, 5);
            return m.ok ? m.spaced : { na: m.reason };
        }
        return { na: r.reason };
    }

    function fact(k, v, n) {
        return '<div><div class="k">' + k + '</div><div class="v">' + v + "</div>" +
            (n ? '<div class="n">' + n + "</div>" : "") + "</div>";
    }

    function render(p) {
        ROWS.forEach(function (r) {
            var el = $("o-" + r.id), out = value(r, p), btn = el.querySelector(".cp");
            if (out && typeof out === "object") {
                el.classList.add("na");
                el.querySelector(".v").textContent = out.na;
                btn.style.visibility = "hidden";
            } else {
                el.classList.remove("na");
                el.querySelector(".v").textContent = out;
                btn.style.visibility = "visible";
            }
        });

        var u = GPS.toUTM(p.lat, p.lon), m = GPS.toMGRS(p.lat, p.lon, 5), g = GPS.gridInfo(p.lat, p.lon);
        var h = "";
        if (u.ok) {
            h += fact("UTM zone", u.zone + u.band, "6° of longitude wide, central meridian " + g.lon0 + "°.");
            h += fact("100 km square", m.ok ? m.square : "—", "The MGRS cell containing this point.");
            h += fact("Grid convergence", (g.convergence >= 0 ? "+" : "") + g.convergence.toFixed(4) + "°",
                "Angle from grid north to true north here.");
            h += fact("Point scale", g.scale.toFixed(7),
                "Grid distances are off by " + ((g.scale - 1) * 1e6).toFixed(0) + " parts per million.");
        } else {
            h += fact("UTM zone", "n/a", u.reason);
        }
        h += fact("Hemispheres", (p.lat >= 0 ? "North" : "South") + " / " + (p.lon >= 0 ? "East" : "West"), "");
        h += fact("Antipode", (-p.lat).toFixed(4) + ", " + (p.lon > 0 ? p.lon - 180 : p.lon + 180).toFixed(4),
            "The point directly opposite, through the centre.");
        $("facts").innerHTML = h;
        drawZones(u, m);
    }

    function readout(el, res, extra) {
        el.innerHTML = "";
        if (!res.ok) {
            if (!res.reason) return;
            el.innerHTML = '<span class="pill warn">unreadable</span>';
            el.appendChild(document.createTextNode(" " + res.reason));
            return;
        }
        el.innerHTML = '<span class="pill">read as ' + res.kind + "</span>";
        el.appendChild(document.createTextNode(" " + (extra || (res.lat.toFixed(6) + ", " + res.lon.toFixed(6)))));
    }

    function update() {
        var input = $("in"), res = GPS.parseCoordinateInput(input.value), extra = null;
        if (res.ok && res.kind === "MGRS" && res.detail) {
            extra = res.lat.toFixed(6) + ", " + res.lon.toFixed(6) +
                " — the southwest corner of a " + res.detail.precisionM + " m cell";
        }
        readout($("readout"), res, extra);
        input.classList.toggle("bad", !res.ok && input.value.trim() !== "");
        if (res.ok) render({ lat: res.lat, lon: res.lon });
    }
    $("in").addEventListener("input", update);
    Array.prototype.forEach.call(document.querySelectorAll(".egs button"), function (b) {
        b.addEventListener("click", function () {
            $("in").value = b.getAttribute("data-c"); update(); $("in").focus();
        });
    });

    /* ---------------- the zone diagram ---------------- */
    function drawZones(u, m) {
        var svg = $("zones"), P = 26, GW = 560, GH = 250 - P * 2;
        var cw = GW / 60, ch = GH / 20, s = [], i;
        var MUTE = 'fill="rgba(233,236,241,.34)" font-family="JetBrains Mono, monospace" font-size="10"';
        s.push('<rect x="' + P + '" y="' + P + '" width="' + GW + '" height="' + GH + '" fill="#0b0f16" stroke="rgba(255,255,255,.09)"/>');
        for (i = 1; i < 60; i++) {
            s.push('<line x1="' + (P + i * cw).toFixed(1) + '" y1="' + P + '" x2="' + (P + i * cw).toFixed(1) +
                '" y2="' + (P + GH) + '" stroke="rgba(255,255,255,' + (i % 5 ? ".035" : ".1") + ')"/>');
        }
        for (i = 1; i < 20; i++) {
            s.push('<line x1="' + P + '" y1="' + (P + i * ch).toFixed(1) + '" x2="' + (P + GW) +
                '" y2="' + (P + i * ch).toFixed(1) + '" stroke="rgba(255,255,255,' + (i % 5 ? ".035" : ".1") + ')"/>');
        }
        if (u.ok) {
            var zi = u.zone - 1, bi = GPS.BANDS.indexOf(u.band);
            var cx = P + zi * cw, cy = P + (19 - bi) * ch;
            s.push('<rect x="' + cx.toFixed(1) + '" y="' + P + '" width="' + cw.toFixed(1) + '" height="' + GH + '" fill="rgba(255,138,61,.10)"/>');
            s.push('<rect x="' + P + '" y="' + cy.toFixed(1) + '" width="' + GW + '" height="' + ch.toFixed(1) + '" fill="rgba(255,138,61,.10)"/>');
            s.push('<rect x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="#ff8a3d"/>');
            s.push('<text x="' + (P + GW + 14) + '" y="' + (cy + ch / 2 + 4).toFixed(1) +
                '" fill="#ff8a3d" font-family="JetBrains Mono, monospace" font-size="13">' + u.zone + u.band + "</text>");
        }
        s.push('<text x="' + P + '" y="' + (P - 9) + '" ' + MUTE + ">180°W</text>");
        s.push('<text x="' + (P + GW) + '" y="' + (P - 9) + '" text-anchor="end" ' + MUTE + ">180°E</text>");
        s.push('<text x="' + (P - 6) + '" y="' + (P + 8) + '" text-anchor="end" ' + MUTE + ">84N</text>");
        s.push('<text x="' + (P - 6) + '" y="' + (P + GH) + '" text-anchor="end" ' + MUTE + ">80S</text>");

        var IX = P + GW + 74, IY = P + 6, IS = GH - 26, k;
        s.push('<rect x="' + IX + '" y="' + IY + '" width="' + IS + '" height="' + IS + '" fill="#0b0f16" stroke="rgba(255,255,255,.09)"/>');
        for (k = 1; k < 8; k++) {
            s.push('<line x1="' + (IX + (k * IS) / 8).toFixed(1) + '" y1="' + IY + '" x2="' + (IX + (k * IS) / 8).toFixed(1) + '" y2="' + (IY + IS) + '" stroke="rgba(255,255,255,.05)"/>');
            s.push('<line x1="' + IX + '" y1="' + (IY + (k * IS) / 8).toFixed(1) + '" x2="' + (IX + IS) + '" y2="' + (IY + (k * IS) / 8).toFixed(1) + '" stroke="rgba(255,255,255,.05)"/>');
        }
        if (u.ok) {
            var fx = (u.easting % 100000) / 100000, fy = (u.northing % 100000) / 100000;
            var col = Math.min(7, Math.max(0, Math.floor(u.easting / 100000) - 1));
            s.push('<rect x="' + (IX + (col * IS) / 8).toFixed(1) + '" y="' + (IY + IS - (4.5 * IS) / 8).toFixed(1) +
                '" width="' + (IS / 8).toFixed(1) + '" height="' + (IS / 8).toFixed(1) + '" fill="rgba(90,209,200,.14)" stroke="#5ad1c8"/>');
            s.push('<circle cx="' + (IX + ((col + fx) * IS) / 8).toFixed(1) + '" cy="' + (IY + IS - ((3.5 + fy) * IS) / 8).toFixed(1) + '" r="3.5" fill="#ff8a3d"/>');
            if (m.ok) {
                s.push('<text x="' + (IX + IS / 2) + '" y="' + (IY + IS + 16) +
                    '" text-anchor="middle" fill="#5ad1c8" font-family="JetBrains Mono, monospace" font-size="12">' + m.square + "</text>");
            }
        }
        s.push('<text x="' + (IX + IS / 2) + '" y="' + (IY - 8) + '" text-anchor="middle" ' + MUTE + ">100 km squares</text>");
        svg.innerHTML = s.join("");
    }

    /* ---------------- distance ---------------- */
    function km(v) {
        return v < 1000 ? v.toFixed(2) + " m"
            : (v / 1000).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " km";
    }

    function updatePair() {
        var a = GPS.parseCoordinateInput($("pa").value), b = GPS.parseCoordinateInput($("pb").value);
        $("pa").classList.toggle("bad", !a.ok && $("pa").value.trim() !== "");
        $("pb").classList.toggle("bad", !b.ok && $("pb").value.trim() !== "");
        var line = $("preadout");
        if (!a.ok || !b.ok) {
            line.innerHTML = '<span class="pill warn">unreadable</span> ' +
                (!a.ok ? "From: " + (a.reason || "empty") + " " : "") +
                (!b.ok ? "To: " + (b.reason || "empty") : "");
            $("pfacts").innerHTML = "";
            return;
        }
        line.innerHTML = '<span class="pill">read as ' + a.kind + " &rarr; " + b.kind + "</span> " +
            a.lat.toFixed(6) + ", " + a.lon.toFixed(6) + " &rarr; " + b.lat.toFixed(6) + ", " + b.lon.toFixed(6);

        var v = GPS.vincentyInverse(a.lat, a.lon, b.lat, b.lon);
        var hv = GPS.haversine(a.lat, a.lon, b.lat, b.lon), h = "";
        if (!v.ok) {
            h += fact("Geodesic distance", "refused", v.reason);
        } else {
            var d = Math.abs(hv - v.distanceM);
            h += fact("Geodesic distance", km(v.distanceM), "Vincenty's inverse method on the WGS84 ellipsoid.");
            h += fact("Initial bearing", v.initialBearing.toFixed(4) + "°", "Degrees from true north, leaving the first point.");
            h += fact("Final bearing", v.finalBearing.toFixed(4) + "°",
                "It differs from the initial bearing because the path is a geodesic, not a straight line on a map.");
            h += fact("Spherical estimate", km(hv),
                "Haversine on a sphere of 6 371 008.8 m. Off by " +
                (d < 1000 ? d.toFixed(1) + " m" : (d / 1000).toFixed(2) + " km") +
                ", or " + ((d / v.distanceM) * 100).toFixed(3) + "%.");
        }
        $("pfacts").innerHTML = h;
    }
    $("pa").addEventListener("input", updatePair);
    $("pb").addEventListener("input", updatePair);

    update();
    updatePair();
    if (reduce) { /* nothing here animates; the note is for the next editor */ }
})();
