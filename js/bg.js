/* Interactive background dot field (canvas): cursor repel, edge fade. */
(function () {
  const canvas = document.getElementById('dots-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Tunables ---------------- */
  const GAP = 32;
  const BASE_RADIUS = 1.5;
  const CURSOR_R = 140;
  const REPEL_R = 116;
  const REPEL_FORCE = 1.7;
  const SPRING = 0.055;
  const DAMP = 0.86;
  const EDGE_MARGIN = 0.18;
  const REVEAL_DUR = 1300;

  /* ---------------- State ---------------- */
  let dots = [];
  let w = 0, h = 0, cx = 0, cy = 0, maxDist = 1;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const pointer = { x: -9999, y: -9999, active: false };
  const theme = { dot: [199, 199, 204] };

  let reveal = reduceMotion ? 1 : 0;
  let revealStart = 0;

  /* Dots inside the 3D model area ignore the cursor (avoids flicker behind it). */
  const modelZone = { left: 0, top: 0, right: 0, bottom: 0, active: false };
  function updateModelZone() {
    const el = document.querySelector('.model-stage');
    if (!el) { modelZone.active = false; return; }
    const r = el.getBoundingClientRect();
    const pad = 24;
    modelZone.left = r.left - pad;
    modelZone.top = r.top - pad;
    modelZone.right = r.right + pad;
    modelZone.bottom = r.bottom + pad;
    modelZone.active = true;
  }

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
    cx = w / 2;
    cy = h / 2;
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
        const bx = offX + c * GAP;
        const by = offY + r * GAP;
        const distEdge = Math.min(bx, w - bx, by, h - by);
        dots.push({
          bx, by,
          x: bx, y: by,
          vx: 0, vy: 0,
          dist: Math.hypot(bx - cx, by - cy),
          edgeFade: smoothstep(0, margin, distEdge),
        });
      }
    }

    updateModelZone();
  }

  /* ---------------- Pointer ---------------- */
  function onPointer(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    pointer.x = t.clientX;
    pointer.y = t.clientY;
    pointer.active = !(modelZone.active &&
      t.clientX >= modelZone.left && t.clientX <= modelZone.right &&
      t.clientY >= modelZone.top && t.clientY <= modelZone.bottom);
  }
  function clearPointer() { pointer.active = false; pointer.x = pointer.y = -9999; }

  /* ---------------- Render loop ---------------- */
  function frame(now) {
    if (!revealStart) revealStart = now;
    if (!reduceMotion) reveal = Math.min(1, (now - revealStart) / REVEAL_DUR);

    ctx.clearRect(0, 0, w, h);

    const revealFront = reveal * maxDist;
    const dotRGB = theme.dot;

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];

      let revealAlpha = 1;
      if (reveal < 1) {
        const edge = revealFront - d.dist;
        if (edge <= 0) continue;
        revealAlpha = Math.min(1, edge / 120);
      }

      if (!reduceMotion) {
        if (pointer.active) {
          const rx = d.x - pointer.x;
          const ry = d.y - pointer.y;
          const r2 = rx * rx + ry * ry;
          if (r2 < REPEL_R * REPEL_R) {
            const r = Math.sqrt(r2) || 0.001;
            const push = (1 - r / REPEL_R);
            d.vx += (rx / r) * push * REPEL_FORCE;
            d.vy += (ry / r) * push * REPEL_FORCE;
          }
        }
        d.vx += (d.bx - d.x) * SPRING;
        d.vy += (d.by - d.y) * SPRING;
        d.vx *= DAMP;
        d.vy *= DAMP;
        d.x += d.vx;
        d.y += d.vy;
      }

      let cursorFactor = 1;
      if (pointer.active) {
        const dx = d.x - pointer.x;
        const dy = d.y - pointer.y;
        cursorFactor = smoothstep(CURSOR_R * 0.35, CURSOR_R, Math.sqrt(dx * dx + dy * dy));
      }

      const fade = d.edgeFade * revealAlpha;
      if (fade <= 0.002) continue;

      const baseAlpha = 0.42 * fade * (0.6 + 0.4 * cursorFactor);

      ctx.fillStyle = `rgba(${dotRGB[0]},${dotRGB[1]},${dotRGB[2]},${baseAlpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, BASE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduceMotion) requestAnimationFrame(frame);
  }

  /* ---------------- Init ---------------- */
  readTheme();
  build();

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(build, 150);
  });
  window.addEventListener('mousemove', onPointer, { passive: true });
  window.addEventListener('touchmove', onPointer, { passive: true });
  window.addEventListener('mouseleave', clearPointer);
  window.addEventListener('touchend', clearPointer);
  window.addEventListener('scroll', updateModelZone, { passive: true });
  window.addEventListener('load', updateModelZone);
  document.addEventListener('themechange', readTheme);

  requestAnimationFrame(frame);
})();
