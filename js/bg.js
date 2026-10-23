/* Static background dot field (canvas): one-time radial reveal, edge fade. */
(function () {
  const canvas = document.getElementById('dots-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Tunables ---------------- */
  const GAP = 32;
  const BASE_RADIUS = 1.5;
  const ALPHA = 0.4;
  const EDGE_MARGIN = 0.18;
  const REVEAL_DUR = 1300;

  /* ---------------- State ---------------- */
  let dots = [];
  let w = 0, h = 0, maxDist = 1;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const theme = { dot: [199, 199, 204] };

  let reveal = reduceMotion ? 1 : 0;
  let revealStart = 0;

  /* ---------------- Helpers ---------------- */
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    theme.dot = parseColor(cs.getPropertyValue('--dot-color')) || theme.dot;
  }

  function parseColor(str) {
    str = (str || '').trim();
    if (!str) return null;
    const m = str.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    const hex = str.replace('#', '');
    if (hex.length === 6) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    return null;
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /* ---------------- Build grid ---------------- */
  function build() {
    w = window.innerWidth;
    h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    maxDist = Math.hypot(cx, cy) + GAP;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots = [];
    const cols = Math.ceil(w / GAP) + 2;
    const rows = Math.ceil(h / GAP) + 2;
    const offX = (w - (cols - 1) * GAP) / 2;
    const offY = (h - (rows - 1) * GAP) / 2;
    const margin = Math.min(w, h) * EDGE_MARGIN;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offX + c * GAP;
        const y = offY + r * GAP;
        dots.push({
          x, y,
          dist: Math.hypot(x - cx, y - cy),
          edgeFade: smoothstep(0, margin, Math.min(x, w - x, y, h - y)),
        });
      }
    }
  }

  /* ---------------- Draw ---------------- */
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const revealFront = reveal * maxDist;
    const [r, g, b] = theme.dot;

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      let revealAlpha = 1;
      if (reveal < 1) {
        const edge = revealFront - d.dist;
        if (edge <= 0) continue;
        revealAlpha = Math.min(1, edge / 120);
      }
      const fade = d.edgeFade * revealAlpha;
      if (fade <= 0.002) continue;

      ctx.fillStyle = `rgba(${r},${g},${b},${ALPHA * fade})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, BASE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function revealFrame(now) {
    if (!revealStart) revealStart = now;
    reveal = Math.min(1, (now - revealStart) / REVEAL_DUR);
    draw();
    if (reveal < 1) requestAnimationFrame(revealFrame);
  }

  /* ---------------- Init ---------------- */
  readTheme();
  build();

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { build(); draw(); }, 150);
  });
  document.addEventListener('themechange', () => { readTheme(); draw(); });

  if (reduceMotion) draw();
  else requestAnimationFrame(revealFrame);
})();
