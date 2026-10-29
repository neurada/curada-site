/* Curada - clustered network threshold instrument (vanilla canvas) */
(function () {
  "use strict";

  var canvas = document.getElementById("net-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var mobileMQ = window.matchMedia ? window.matchMedia("(max-width: 768px)") : null;
  var darkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  var W = 0, H = 0, DPR = 1, cx = 0, cy = 0, S = 1;
  var nodes = [], edges = [], clusters = [];
  var raf = 0, resizeTimer = 0, frameCount = 0;
  var mx = -1000, my = -1000, nearest = -1;
  var startTime = 0;

  function mobileLayout() {
    return mobileMQ ? mobileMQ.matches : window.innerWidth <= 768;
  }

  function darkMode() {
    return darkMQ ? darkMQ.matches : false;
  }

  function tone(light, dark) {
    return darkMode() ? dark : light;
  }

  function seeded(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function reflow() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (mobileLayout()) {
      cx = W * 0.50;
      cy = H * 0.50;
      S = Math.min(W * 0.92, H * 1.16);
    } else {
      cx = W * 0.735;
      cy = H * 0.42;
      S = Math.min(W * 0.49, H * 0.76);
    }
  }

  function build() {
    reflow();
    nodes = [];
    edges = [];
    clusters = [];

    var rnd = seeded(20260811);
    var isMobile = mobileLayout();
    var centers = [
      [-0.43, -0.08],
      [-0.15,  0.15],
      [ 0.16, -0.13],
      [ 0.43,  0.10]
    ];
    var counts = isMobile ? [16, 19, 22, 17] : [23, 28, 32, 25];
    var radii = [0.155, 0.178, 0.196, 0.164];
    var golden = 2.3999632297;

    for (var c = 0; c < centers.length; c++) {
      var members = [];
      var count = counts[c];
      for (var i = 0; i < count; i++) {
        var angle = i * golden + c * 0.71 + (rnd() - 0.5) * 0.18;
        var radius = Math.sqrt((i + 0.45) / count) * radii[c] * S;
        var x = centers[c][0] * S + Math.cos(angle) * radius;
        var y = centers[c][1] * S + Math.sin(angle) * radius * 0.76;
        var id = nodes.length;
        nodes.push({
          x: x,
          y: y,
          cluster: c,
          order: i,
          phase: c * 0.205 + (i / count) * 0.12 + rnd() * 0.025,
          size: i === 0 ? 3.4 : 1.25 + rnd() * 1.25,
          drift: rnd() * Math.PI * 2,
          px: 0,
          py: 0
        });
        members.push(id);
      }
      clusters.push({
        x: centers[c][0] * S,
        y: centers[c][1] * S,
        rx: radii[c] * S * 1.13,
        ry: radii[c] * S * 0.88,
        members: members
      });
    }

    /* Each cluster gets a legible local topology: a ring plus nearest neighbors. */
    for (var q = 0; q < clusters.length; q++) {
      var ids = clusters[q].members;
      for (var n = 0; n < ids.length; n++) {
        var a = ids[n];
        var candidates = [];
        for (var m = 0; m < ids.length; m++) {
          if (m === n) continue;
          var b = ids[m];
          var dx = nodes[a].x - nodes[b].x;
          var dy = nodes[a].y - nodes[b].y;
          candidates.push([dx * dx + dy * dy, b]);
        }
        candidates.sort(function (u, v) { return u[0] - v[0]; });
        for (var k = 0; k < Math.min(3, candidates.length); k++) {
          addEdge(a, candidates[k][1], false);
        }
      }
    }

    /* Adjacent clusters are joined only through a handful of explicit bridges. */
    for (var bc = 0; bc < clusters.length - 1; bc++) {
      var bridgeCandidates = [];
      var left = clusters[bc].members;
      var right = clusters[bc + 1].members;
      for (var li = 0; li < left.length; li++) {
        for (var ri = 0; ri < right.length; ri++) {
          var L = nodes[left[li]], R = nodes[right[ri]];
          var bx = L.x - R.x, by = L.y - R.y;
          bridgeCandidates.push([bx * bx + by * by, left[li], right[ri]]);
        }
      }
      bridgeCandidates.sort(function (u, v) { return u[0] - v[0]; });
      for (var p = 0; p < 5; p++) addEdge(bridgeCandidates[p][1], bridgeCandidates[p][2], true);
    }

    updateInstrumentNodes();
  }

  function addEdge(a, b, bridge) {
    if (a === b) return;
    if (a > b) { var swap = a; a = b; b = swap; }
    for (var i = 0; i < edges.length; i++) {
      if (edges[i].a === a && edges[i].b === b) {
        if (bridge) edges[i].bridge = true;
        return;
      }
    }
    edges.push({ a: a, b: b, bridge: bridge });
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawArrow(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size, y - size * 0.62);
    ctx.lineTo(x - size, y + size * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  function drawInstrument(wave) {
    var left = cx - S * 0.61;
    var right = cx + S * 0.61;
    var top = cy - S * 0.38;
    var bottom = cy + S * 0.38;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    /* A measured frame makes the object read as an instrument, not wallpaper. */
    ctx.strokeStyle = tone("rgba(24,33,29,0.25)", "rgba(224,235,228,0.24)");
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 5]);
    line(left, cy, right, cy);
    ctx.setLineDash([]);
    ctx.fillStyle = tone("rgba(24,33,29,0.48)", "rgba(224,235,228,0.50)");
    drawArrow(right, cy, 6);

    ctx.strokeStyle = tone("rgba(24,33,29,0.16)", "rgba(224,235,228,0.15)");
    line(left, top, left, bottom);
    line(left, top, left + 34, top);
    line(left, bottom, left + 34, bottom);
    line(right - 34, top, right, top);
    line(right - 34, bottom, right, bottom);

    ctx.font = "500 9px 'IBM Plex Mono', monospace";
    ctx.letterSpacing = "1px";
    ctx.fillStyle = tone("rgba(31,80,63,0.70)", "rgba(168,180,173,0.80)");
    ctx.fillText("CLUSTERED NETWORK THRESHOLDS", left, top - 12);
    ctx.fillStyle = tone("rgba(24,33,29,0.44)", "rgba(168,180,173,0.66)");
    ctx.fillText("DIFFUSION FRONT", right - 97, bottom + 20);

    for (var c = 0; c < clusters.length; c++) {
      var cl = clusters[c];
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = tone("rgba(45,107,85,0.25)", "rgba(72,142,108,0.34)");
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.ellipse(cx + cl.x, cy + cl.y, cl.rx, cl.ry, -0.08 + c * 0.055, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = tone("rgba(24,33,29,0.46)", "rgba(168,180,173,0.62)");
      ctx.font = "500 8px 'IBM Plex Mono', monospace";
      ctx.fillText("0" + (c + 1), cx + cl.x - cl.rx, cy + cl.y + cl.ry + 14);
    }

    /* A copper scan line marks the current state. */
    var scanX = left + (right - left) * wave;
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = "rgba(255,93,58,0.50)";
    ctx.lineWidth = 1;
    line(scanX, top + 8, scanX, bottom - 8);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,93,58,0.82)";
    ctx.fillRect(scanX - 2, cy - 2, 4, 4);
    ctx.restore();
  }

  function frame(t) {
    frameCount++;
    if (!startTime) startTime = t;
    var elapsed = (t - startTime) * 0.001;
    var wave = (elapsed % 15) / 15;
    var fadeReset = wave > 0.94 ? (1 - wave) / 0.06 : 1;
    var driftScale = mobileLayout() ? 0.7 : 1;

    ctx.clearRect(0, 0, W, H);

    nearest = -1;
    var nearestD = 76 * 76;
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      nd.px = cx + nd.x + Math.sin(elapsed * 0.38 + nd.drift) * driftScale;
      nd.py = cy + nd.y + Math.cos(elapsed * 0.31 + nd.drift) * driftScale;
      var dx = nd.px - mx, dy = nd.py - my;
      var d2 = dx * dx + dy * dy;
      if (d2 < nearestD) { nearestD = d2; nearest = n; }
    }

    drawInstrument(wave);

    /* Base topology. */
    ctx.globalCompositeOperation = "source-over";
    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e];
      var A = nodes[edge.a], B = nodes[edge.b];
      var active = A.phase <= wave && B.phase <= wave;
      var near = edge.a === nearest || edge.b === nearest;

      if (near) {
        ctx.strokeStyle = "rgba(255,93,58,0.82)";
        ctx.lineWidth = 1.4;
      } else if (active) {
        ctx.strokeStyle = darkMode()
          ? "rgba(52,146,101," + (0.72 * fadeReset) + ")"
          : "rgba(45,107,85," + (0.58 * fadeReset) + ")";
        ctx.lineWidth = edge.bridge ? 1.5 : 1.05;
      } else {
        ctx.strokeStyle = darkMode()
          ? (edge.bridge ? "rgba(168,180,173,0.30)" : "rgba(168,180,173,0.17)")
          : (edge.bridge ? "rgba(24,33,29,0.34)" : "rgba(24,33,29,0.19)");
        ctx.lineWidth = edge.bridge ? 1.1 : 0.75;
      }
      line(A.px, A.py, B.px, B.py);
    }

    /* Nodes are crisp and countable; activation travels left to right. */
    for (var q = 0; q < nodes.length; q++) {
      var node = nodes[q];
      var nodeActive = node.phase <= wave;
      var nodeNear = q === nearest;
      var radius = node.size;

      if (nodeNear) {
        ctx.strokeStyle = "rgba(255,93,58,0.92)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(node.px, node.py, radius + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,93,58,0.92)";
      } else if (nodeActive) {
        ctx.fillStyle = "rgba(214,239,82," + (0.92 * fadeReset) + ")";
        ctx.strokeStyle = tone("rgba(45,107,85,0.84)", "rgba(69,151,107,0.94)");
      } else {
        ctx.fillStyle = tone("rgba(244,246,241,0.96)", "rgba(9,18,14,0.96)");
        ctx.strokeStyle = tone("rgba(24,33,29,0.58)", "rgba(168,180,173,0.58)");
      }

      ctx.lineWidth = node.order === 0 ? 1.35 : 0.8;
      ctx.beginPath();
      ctx.arc(node.px, node.py, radius + (nodeActive ? 0.45 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    canvas.dataset.frames = String(frameCount);
    window.__curadaFieldState = {
      frames: frameCount,
      nodes: nodes.length,
      edges: edges.length,
      mobile: mobileLayout(),
      width: W,
      height: H,
      activeFront: Math.round(wave * 1000) / 1000,
      dark: darkMode()
    };
    raf = requestAnimationFrame(frame);
  }

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

  function start() {
    build();
    updateInstrumentTime();
    setInterval(updateInstrumentTime, 1000);
    raf = requestAnimationFrame(frame);
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 120);
  }

  function updatePointer(e) {
    var r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  }

  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("orientationchange", handleResize, { passive: true });
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", updatePointer, { passive: true });
  window.addEventListener("pointerleave", function () { mx = -1000; my = -1000; });
  window.addEventListener("mouseout", function () { mx = -1000; my = -1000; });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && !raf) {
      raf = requestAnimationFrame(frame);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
