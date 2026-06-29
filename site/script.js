/* Curada — network field animation (vanilla canvas, no dependencies) */
(function () {
  "use strict";

  var canvas = document.getElementById("net-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  // ---- config ----
  var DENSITY = 1;     // 0.5 .. 1.6
  var CORE_GLOW = 1;   // 0.4 .. 1.6

  var mobileMQ = window.matchMedia ? window.matchMedia("(max-width: 768px)") : null;
  function motionOn() { return true; }
  function mobileLayout() { return mobileMQ ? mobileMQ.matches : window.innerWidth <= 768; }

  var nodes = [], links = [], W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0;
  var buildR = 1;                  // R at the moment geometry was built (for seamless rescale)
  var hot = 0, hotTarget = 0, mx = -1, my = -1, lastHot = -1;
  var raf = 0, resizeT = 0, idleH = 0;
  var frameCount = 0;
  var ignite = 0;                  // 0..1 one-shot ignition progress
  var igniteStart = 0;
  var IGNITE_MS = 1100;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.4; }
  function randDir() {
    var u = Math.random() * 2 - 1, th = Math.random() * 6.2832, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(th), s * Math.sin(th), u];
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // cheap canvas-pixel + geometry-frame resize (no node rebuild — runs every resize, seamless)
  function reflow() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (mobileLayout()) {
      cx = W * 0.50;
      cy = H * 0.50;
      R = Math.min(W * 0.67, H * 0.78);
    } else {
      cx = W * (W > 1100 ? 0.70 : (W > 760 ? 0.66 : 0.50));
      cy = H * (W > 760 ? 0.41 : 0.46);
      R = Math.min(W * 0.50, H * 0.74);
    }
  }

  // heavy geometry build (node distribution + 3D kNN links) — run once, then only on idle after a resize
  function build() {
    reflow();
    buildR = R;
    var area = W * H;
    var N = mobileLayout() ? 620 : Math.round(Math.min(1180, Math.max(620, area / 1300)) * DENSITY);

    var filaments = [];
    var NF = 6;
    for (var f = 0; f < NF; f++) filaments.push(randDir());

    var nn = [];
    for (var i = 0; i < N; i++) {
      var x, y, z;
      var u = Math.random();
      if (u < 0.60) {
        var d1 = randDir();
        var rr1 = Math.pow(Math.random(), 1.8) * R * 0.60;
        x = d1[0] * rr1; y = d1[1] * rr1 * 0.88; z = d1[2] * rr1;
      } else if (u < 0.84) {
        var d2 = randDir();
        var rr2 = Math.pow(Math.random(), 0.95) * R * 0.95;
        x = d2[0] * rr2; y = d2[1] * rr2 * 0.88; z = d2[2] * rr2;
      } else {
        var fil = filaments[(Math.random() * NF) | 0];
        var along = Math.pow(Math.random(), 0.65) * R * 1.08;
        var spread = R * 0.05 + R * 0.10 * (along / R);
        x = fil[0] * along + gauss() * spread;
        y = (fil[1] * along) * 0.88 + gauss() * spread;
        z = fil[2] * along + gauss() * spread;
      }
      var r3 = Math.sqrt(x * x + y * y + z * z);
      var core = Math.max(0, 1 - r3 / (R * 0.46));
      // ignition seed: each node starts displaced outward + scattered, converges to (x,y,z)
      var idir = randDir();
      var imag = rand(0.35, 1.15);
      nn.push({
        x: x, y: y, z: z, core: core,
        ix: idir[0] * R * imag, iy: idir[1] * R * imag, iz: idir[2] * R * imag,
        ph: rand(0, 6.283), fs: rand(0.5, 1.4),
        sz: rand(0.7, 1.5) + (core > 0.5 ? rand(0.5, 1.5) : 0),
        wx: rand(0, 6.28), wy: rand(0, 6.28),
        _px: 0, _py: 0, _s: 1, _dz: 0
      });
    }

    var ll = [];
    var maxD = R * 0.21, maxD2 = maxD * maxD;
    for (var a = 0; a < nn.length; a++) {
      var A = nn[a], cand = [];
      for (var b = 0; b < nn.length; b++) {
        if (a === b) continue;
        var B = nn[b];
        var dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
        var dd = dx * dx + dy * dy + dz * dz;
        if (dd < maxD2) cand.push([dd, b]);
      }
      cand.sort(function (p, q) { return p[0] - q[0]; });
      var k = Math.min(A.core > 0.4 ? 5 : 4, cand.length);
      for (var c = 0; c < k; c++) {
        var jj = cand[c][1];
        if (jj > a) ll.push([a, jj, (A.core + nn[jj].core) * 0.5]);
      }
    }

    // atomic swap — no half-built state is ever rendered
    nodes = nn;
    links = ll;
    updateInstrumentNodes();
  }

  function frame(t) {
    frameCount++;
    var time = t * 0.001;
    var isMobile = mobileLayout();
    var glow = CORE_GLOW * (isMobile ? 1.22 : 1);
    var m = motionOn();

    if (igniteStart === 0) igniteStart = t;
    ignite = m ? Math.min(1, (t - igniteStart) / IGNITE_MS) : 1;
    var igE = easeOutCubic(ignite);
    var igOffset = 1 - igE;

    hotTarget = (mx >= 0 && Math.hypot(mx - cx, my - cy) < R * 1.15) ? 1 : 0;
    hot += (hotTarget - hot) * (m ? 0.08 : 1);
    if (hotTarget !== lastHot) {
      lastHot = hotTarget;
      document.body.classList.toggle("field-hot", hotTarget === 1);
    }

    var breathe = m ? (0.5 + 0.5 * Math.sin(time * 0.5)) : 0.6;
    var pulse = m ? (0.5 + 0.5 * Math.sin(time * 0.9)) : 0.6;

    var ang = (m ? time * (isMobile ? 0.16 : 0.05) : 0.55) + 0.45;
    var angX = (isMobile ? 0.2 : 0.15) * Math.sin(m ? time * (isMobile ? 0.22 : 0.12) : 0.5) - 0.05;
    var cosY = Math.cos(ang), sinY = Math.sin(ang);
    var cosX = Math.cos(angX), sinX = Math.sin(angX);
    var focal = R * (isMobile ? 2.45 : 2.8);
    var scl = R / buildR;          // seamless rescale of pre-built geometry

    // the field stays structurally anchored — no translate on cursor move. only its
    // energy responds (node glow + edge opacity below). a rigid, solid object.
    var proxRad = R * (isMobile ? 0.38 : 0.28), proxRad2 = proxRad * proxRad;

    ctx.clearRect(0, 0, W, H);

    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      var x = (nd.x + nd.ix * igOffset) * scl;
      var y = (nd.y + nd.iy * igOffset) * scl;
      var z = (nd.z + nd.iz * igOffset) * scl;
      if (m) {
        var drift = isMobile ? 8 : 5;
        x += Math.sin(time * (isMobile ? 0.72 : 0.4) + nd.wx) * drift;
        y += Math.cos(time * (isMobile ? 0.62 : 0.35) + nd.wy) * drift;
      }
      var rx = x * cosY - z * sinY;
      var rz = x * sinY + z * cosY;
      var ry = y * cosX - rz * sinX;
      rz = y * sinX + rz * cosX;
      var sc = focal / (focal + rz);
      nd._px = cx + rx * sc;
      nd._py = cy + ry * sc;
      nd._s = sc; nd._dz = rz;
      // field-perturbation proximity factor — drives glow / edge opacity ONLY, never position
      var pr = 0;
      if (mx >= 0 && igOffset < 0.05) {
        var ddx = mx - nd._px, ddy = my - nd._py;
        var dd2 = ddx * ddx + ddy * ddy;
        if (dd2 < proxRad2) { var dn = Math.sqrt(dd2) / proxRad; pr = (1 - dn) * (1 - dn); }
      }
      nd._prox = pr;
    }

    var igGlow = 0.25 + 0.75 * igE;        // core energy ramps up during ignition

    ctx.globalCompositeOperation = "lighter";
    var cg = (0.14 + 0.10 * breathe + hot * 0.15) * glow * igGlow;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.98);
    g.addColorStop(0, "rgba(255,64,34," + cg + ")");
    g.addColorStop(0.2, "rgba(235,42,22," + (cg * 0.6) + ")");
    g.addColorStop(0.5, "rgba(140,20,11," + (cg * 0.24) + ")");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, 6.2832); ctx.fill();

    var ig = (0.15 + 0.12 * pulse + hot * 0.18) * glow * igGlow;
    var g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.32);
    g2.addColorStop(0, "rgba(255,62,34," + ig + ")");
    g2.addColorStop(0.45, "rgba(248,44,22," + (ig * 0.5) + ")");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.32, 0, 6.2832); ctx.fill();

    // links — graphite structure, flame near core. fade in during ignition.
    ctx.globalCompositeOperation = "source-over";
    var linkFade = easeOutCubic(Math.min(1, ignite * 1.2));
    for (var l = 0; l < links.length; l++) {
      var LA = nodes[links[l][0]], LB = nodes[links[l][1]], lcore = links[l][2];
      var depth = (LA._dz + LB._dz) * 0.5;
      var dtl = 1 - Math.min(1, Math.max(0, (depth + R) / (2 * R)));
      var ep = LA._prox > LB._prox ? LA._prox : LB._prox;   // nearer endpoint drives edge response
      if (lcore > 0.28) {
        var la = (0.10 + lcore * 0.42) * (0.55 + 0.45 * breathe) * (0.4 + 0.6 * dtl) * (1 + hot * 0.7) * (1 + ep * 0.7) * linkFade * (isMobile ? 1.18 : 1);
        ctx.strokeStyle = "rgba(255," + Math.round(58 + lcore * 38) + ",32," + Math.min(0.95, la) + ")";
        ctx.lineWidth = (lcore > 0.55 ? 1.0 : 0.7) * (0.7 + 0.5 * dtl);
      } else {
        var pa = (0.055 + 0.20 * dtl) * (1 + hot * 0.5) * (1 + ep * 1.1) * linkFade * (isMobile ? 1.28 : 1);
        ctx.strokeStyle = "rgba(" + Math.round(214 + ep * 41) + "," + Math.round(220 - ep * 150) + "," + Math.round(228 - ep * 180) + "," + Math.min(0.6, pa) + ")";
        ctx.lineWidth = 0.55 + 0.45 * dtl;
      }
      ctx.beginPath(); ctx.moveTo(LA._px, LA._py); ctx.lineTo(LB._px, LB._py); ctx.stroke();
    }

    // silver/graphite nodes
    ctx.globalCompositeOperation = "source-over";
    for (var s = 0; s < nodes.length; s++) {
      var sd = nodes[s];
      if (sd.core > 0.18) continue;
      var dts = 1 - Math.min(1, Math.max(0, (sd._dz + R) / (2 * R)));
      var flickS = m ? (0.7 + 0.3 * Math.sin(time * sd.fs * 1.2 + sd.ph)) : 0.85;
      var as = (0.11 + 0.4 * dts) * flickS * (1 + sd._prox * 0.6) * (isMobile ? 1.22 : 1);
      ctx.fillStyle = "rgba(218,223,230," + Math.min(0.95, as) + ")";
      ctx.beginPath(); ctx.arc(sd._px, sd._py, Math.max(0.4, sd.sz * 0.6 * sd._s), 0, 6.2832); ctx.fill();
    }
    // electromagnetic field perturbation: faint red glow on nodes near the cursor (additive, no displacement)
    ctx.globalCompositeOperation = "lighter";
    for (var p = 0; p < nodes.length; p++) {
      var pd = nodes[p];
      if (pd._prox <= 0.04 || pd.core > 0.18) continue;
      ctx.fillStyle = "rgba(255,56,30," + (pd._prox * 0.5) + ")";
      ctx.beginPath(); ctx.arc(pd._px, pd._py, (1.1 + pd.sz * 0.7) * pd._s, 0, 6.2832); ctx.fill();
    }
    // flame core nodes (additive bloom)
    ctx.globalCompositeOperation = "lighter";
    for (var f2 = 0; f2 < nodes.length; f2++) {
      var fd = nodes[f2];
      if (fd.core <= 0.18) continue;
      var dtf = 1 - Math.min(1, Math.max(0, (fd._dz + R) / (2 * R)));
      var flickF = m ? (0.66 + 0.34 * Math.sin(time * fd.fs * 1.3 + fd.ph)) : 0.82;
      var af = (0.22 + fd.core * 0.34) * flickF * (0.7 + 0.3 * dtf) * (1 + hot * 0.45) * (1 + fd._prox * 0.5) * igGlow * (isMobile ? 1.14 : 1);
      ctx.fillStyle = "rgba(255," + Math.round(38 + fd.core * 20) + ",24," + Math.min(0.82, af) + ")";
      ctx.beginPath(); ctx.arc(fd._px, fd._py, fd.sz * (0.85 + fd.core * 0.7) * fd._s, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    window.__curadaFieldState = {
      frames: frameCount,
      nodes: nodes.length,
      mobile: isMobile,
      motion: m,
      hot: Math.round(hot * 1000) / 1000,
      width: W,
      height: H,
      dpr: DPR
    };
    canvas.dataset.frames = String(frameCount);
    canvas.dataset.motion = m ? "on" : "off";

    if (motionOn()) raf = requestAnimationFrame(frame);
  }

  // ---- instrument-state line ----
  var elTime = document.getElementById("instr-time");
  var elNodes = document.getElementById("instr-nodes");
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function updateInstrumentTime() {
    if (!elTime) return;
    var d = new Date();
    elTime.textContent = d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) +
      " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + " UTC";
  }
  function updateInstrumentNodes() {
    if (elNodes) elNodes.textContent = nodes.length.toLocaleString("en-US");
  }

  function scheduleRebuild() {
    if (idleH) { (window.cancelIdleCallback || clearTimeout)(idleH); idleH = 0; }
    var run = function () { idleH = 0; build(); };
    if (window.requestIdleCallback) idleH = window.requestIdleCallback(run, { timeout: 500 });
    else idleH = setTimeout(run, 120);
  }

  function start() {
    build();
    updateInstrumentTime();
    setInterval(updateInstrumentTime, 1000);
    frame(typeof performance !== "undefined" ? performance.now() : 0);
  }

  function handleResize() {
    reflow();                       // immediate, seamless: canvas + frame rescale, no flash
    clearTimeout(resizeT);
    resizeT = setTimeout(scheduleRebuild, 220);  // refresh density off the critical path
  }

  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("orientationchange", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(handleResize, 180);
  }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize, { passive: true });
  }

  function updatePointer(e) {
    var r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
  }
  window.addEventListener("mousemove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", updatePointer, { passive: true });
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("touchstart", function (e) {
    if (!e.touches || !e.touches.length) return;
    updatePointer(e.touches[0]);
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (!e.touches || !e.touches.length) return;
    updatePointer(e.touches[0]);
  }, { passive: true });
  window.addEventListener("mouseout", function () { mx = -1; my = -1; });
  window.addEventListener("pointerleave", function () { mx = -1; my = -1; });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    } else if (motionOn() && !raf) {
      raf = requestAnimationFrame(frame);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
