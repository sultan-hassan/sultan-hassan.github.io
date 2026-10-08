// Hero figure: contours of a toy loss landscape and two optimization runs
// that start together and settle in different basins.
(function () {
  const canvas = document.getElementById("landscape");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const replay = document.getElementById("replay");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const X0 = -3.2, X1 = 3.2, Y0 = -2.7, Y1 = 2.7;

  function f(x, y) {
    const u = x - 0.45 * Math.sin(0.9 * y - 0.4);
    return 0.05 * (x * x + 0.85 * y * y)
      - 1.25 * Math.exp(-((x + 1.6) ** 2 + (y + 1.1) ** 2) / 1.0)
      - 1.1 * Math.exp(-((x - 1.6) ** 2 + (y + 1.0) ** 2) / 0.9)
      + 0.6 * Math.exp(-(u * u + (y - 2.2) ** 2) / 1.4)
      + 0.4 * Math.exp(-(u * u) / 0.35) / (1 + Math.exp((y + 0.6) * 3))
      + 0.025 * Math.cos(2.4 * x) * Math.cos(1.9 * y - 0.3);
  }
  function grad(x, y) {
    const h = 1e-3;
    return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  }
  function run(x, y) {
    const pts = [[x, y]];
    let vx = 0, vy = 0;
    for (let i = 0; i < 900; i++) {
      const [gx, gy] = grad(x, y);
      vx = 0.78 * vx - 0.05 * gx;
      vy = 0.78 * vy - 0.05 * gy;
      x += vx; y += vy;
      pts.push([x, y]);
      if (i > 200 && Math.hypot(vx, vy) < 2e-4) break;
    }
    return pts;
  }
  const Y_START = 2.45;
  const endSide = (x) => { const p = run(x, Y_START); return p[p.length - 1][0] > 0; };
  let lo = -0.4, hi = 1.4;
  const loSide = endSide(lo);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (endSide(mid) === loSide) lo = mid; else hi = mid;
  }
  const xs = (lo + hi) / 2, eps = 1e-7;
  let runA = run(xs - eps, Y_START), runB = run(xs + eps, Y_START);
  if (runA[runA.length - 1][0] > runB[runB.length - 1][0]) { const t = runA; runA = runB; runB = t; }
  let split = 0;
  for (let i = 0; i < Math.min(runA.length, runB.length); i++) {
    const d = Math.hypot(runA[i][0] - runB[i][0], runA[i][1] - runB[i][1]);
    if (d > 0.12) { split = i; break; }
  }

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  let W = 0, H = 0, dpr = 1, base = null, start = null, raf = 0;

  function toPx(x, y) {
    return [((x - X0) / (X1 - X0)) * W, (1 - (y - Y0) / (Y1 - Y0)) * H];
  }

  function drawContours() {
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const octx = off.getContext("2d");
    const img = octx.createImageData(w, h);
    const rgb = css("--contour").split(",").map(Number);
    const vals = new Float32Array((w + 2) * (h + 2));
    for (let j = -1; j <= h; j++) {
      const y = Y1 - ((j + 0.5) / h) * (Y1 - Y0);
      for (let i = -1; i <= w; i++) {
        const x = X0 + ((i + 0.5) / w) * (X1 - X0);
        vals[(j + 1) * (w + 2) + (i + 1)] = f(x, y);
      }
    }
    const step = 0.075;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = (j + 1) * (w + 2) + (i + 1);
        const v = vals[k];
        const gx = (vals[k + 1] - vals[k - 1]) / 2;
        const gy = (vals[k + w + 2] - vals[k - w - 2]) / 2;
        const g = Math.hypot(gx, gy) + 1e-9;
        const t = v / step;
        const n = Math.round(t);
        const dist = Math.abs(t - n) * step / g;
        const width = 0.55 * dpr;
        let a = Math.max(0, 1 - dist / width);
        if (a <= 0) continue;
        const major = n % 4 === 0;
        const depth = Math.min(1, Math.max(0, (-v + 0.4) / 1.6));
        const nx = (i / w) * 2 - 1, ny = (j / h) * 2 - 1;
        const vignette = Math.max(0, 1 - Math.pow(Math.hypot(nx * 0.92, ny * 0.95), 4));
        a *= (major ? 0.5 : 0.26) * (0.6 + 0.4 * depth) * vignette;
        const p = (j * w + i) * 4;
        img.data[p] = rgb[0]; img.data[p + 1] = rgb[1]; img.data[p + 2] = rgb[2];
        img.data[p + 3] = Math.round(a * 255);
      }
    }
    octx.putImageData(img, 0, 0);
    return off;
  }

  function path(pts, from, upto, color, width) {
    ctx.beginPath();
    for (let i = from; i <= upto && i < pts.length; i++) {
      const [px, py] = toPx(pts[i][0], pts[i][1]);
      i === from ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }
  function dot(x, y, r, fill, stroke) {
    const [px, py] = toPx(x, y);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  function label(text, x, y, color, align) {
    const [px, py] = toPx(x, y);
    ctx.font = "500 12.5px 'Schibsted Grotesk', Arial, sans-serif";
    ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
    ctx.fillText(text, px, py);
  }

  function frame(progress) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    const accent = css("--accent"), warm = css("--warm"), ink = css("--ink"), muted = css("--muted");
    const n = Math.max(runA.length, runB.length);
    const upto = Math.floor(progress * (n - 1));

    dot(runA[0][0], runA[0][1], 4, ink);
    label("start", runA[0][0] + 0.18, runA[0][1] + 0.02, muted);

    const shared = Math.max(0, split - 1);
    path(runA, 0, Math.min(upto, shared), ink, 2.2);
    if (upto > shared) {
      path(runA, shared, upto, accent, 2.2);
      path(runB, shared, upto, warm, 2.2);
    }

    if (upto >= split && split > 0) {
      const sx = (runA[split][0] + runB[split][0]) / 2, sy = (runA[split][1] + runB[split][1]) / 2;
      dot(sx, sy, 9, null, muted);
      label("paths start to split", sx + 0.28, sy + 0.02, muted);
    }
    if (progress >= 1) {
      const ea = runA[runA.length - 1], eb = runB[runB.length - 1];
      dot(ea[0], ea[1], 4.5, accent);
      dot(eb[0], eb[1], 4.5, warm);
      label("intended behavior", ea[0], ea[1] - 0.5, accent, "center");
      label("misaligned behavior", eb[0], eb[1] - 0.5, warm, "center");
    }
  }

  function animate(ts) {
    if (start === null) start = ts;
    const t = Math.min(1, (ts - start) / 3400);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    frame(e);
    if (t < 1) raf = requestAnimationFrame(animate);
  }

  function play() {
    cancelAnimationFrame(raf);
    start = null;
    if (reduce.matches) frame(1); else raf = requestAnimationFrame(animate);
  }

  function setup(animateIn) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    base = drawContours();
    if (animateIn) play(); else frame(1);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { cancelAnimationFrame(raf); setup(false); }, 150);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setup(false));
  if (replay) replay.addEventListener("click", play);

  const go = () => setup(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
})();
