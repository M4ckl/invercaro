/* Animated 2D figures on the flip-card fronts: "wave" (About), "bloom" (What's next). */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Palettes ---------------- */
  const PALETTE_DARK = [
    [236, 234, 246],
    [206, 200, 238],
    [176, 168, 230],
    [150, 140, 226],
    [200, 195, 255],
  ];
  const PALETTE_LIGHT = [
    [22, 22, 25],
    [66, 66, 74],
    [110, 110, 120],
    [80, 80, 90],
    [38, 38, 44],
  ];

  let palette = PALETTE_DARK;
  let coreRGB = [142, 124, 255];

  function refreshPalette() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
    coreRGB = dark ? [142, 124, 255] : [60, 60, 68];
  }

  /* ---------------- Setup ---------------- */
  const figures = [];

  function setup(canvas) {
    const fig = { canvas, ctx: canvas.getContext('2d'), type: canvas.dataset.figure || 'wave', w: 0, h: 0 };
    resize(fig);
    figures.push(fig);
  }

  function resize(fig) {
    const rect = fig.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fig.w = rect.width;
    fig.h = rect.height;
    fig.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    fig.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    fig.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function gradient(ctx, x0, y0, x1, y1, alpha) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    const n = palette.length - 1;
    for (let i = 0; i < palette.length; i++) {
      const c = palette[i];
      g.addColorStop(i / n, `rgba(${c[0]},${c[1]},${c[2]},${alpha})`);
    }
    return g;
  }

  /* ---------------- Figures ---------------- */
  function drawWave(fig, t) {
    const { ctx, w, h } = fig;
    ctx.clearRect(0, 0, w, h);

    const LINES = 26;
    const midY = h * 0.5;
    const spread = h * 0.34;
    const amp = h * 0.16;

    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';

    for (let li = 0; li < LINES; li++) {
      const lp = li / (LINES - 1);
      const yBase = midY + (lp - 0.5) * spread;
      const phase = t * 0.6 + li * 0.28;

      ctx.beginPath();
      const step = 6;
      for (let x = -step; x <= w + step; x += step) {
        const nx = x / w;
        const env = Math.exp(-Math.pow((nx - 0.5) * 2.1, 2));
        const y = yBase
          + Math.sin(nx * 6.2 + phase) * amp * env
          + Math.sin(nx * 3.1 - phase * 0.7) * amp * 0.35 * env;
        if (x <= -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const a = 0.10 + 0.5 * Math.exp(-Math.pow((lp - 0.5) * 2.0, 2));
      ctx.strokeStyle = gradient(ctx, 0, 0, w, 0, a);
      ctx.stroke();
    }
  }

  function drawBloom(fig, t) {
    const { ctx, w, h } = fig;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.5;
    const RINGS = 7;
    const maxR = Math.min(w, h) * 0.42;

    ctx.lineWidth = 1.2;

    for (let ri = 0; ri < RINGS; ri++) {
      const rp = (ri + 1) / RINGS;
      const baseR = maxR * rp;
      const petals = 5 + ri;
      const wob = baseR * (0.10 + 0.05 * Math.sin(t * 0.5 + ri));
      const rot = t * 0.18 * (ri % 2 ? 1 : -1);
      const breathe = 1 + 0.05 * Math.sin(t * 0.7 - ri * 0.4);

      ctx.beginPath();
      const N = 90;
      for (let a = 0; a <= N; a++) {
        const ang = (a / N) * Math.PI * 2;
        const rr = (baseR + Math.sin(ang * petals + rot) * wob) * breathe;
        const x = cx + Math.cos(ang) * rr;
        const y = cy + Math.sin(ang) * rr * 0.92;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const alpha = 0.14 + 0.4 * (1 - rp);
      ctx.strokeStyle = gradient(ctx, cx - baseR, cy - baseR, cx + baseR, cy + baseR, alpha);
      ctx.stroke();
    }

    const coreR = maxR * 0.14;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    g.addColorStop(0, `rgba(${coreRGB[0]},${coreRGB[1]},${coreRGB[2]},0.55)`);
    g.addColorStop(1, `rgba(${coreRGB[0]},${coreRGB[1]},${coreRGB[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(fig, t) {
    if (fig.type === 'bloom') drawBloom(fig, t);
    else drawWave(fig, t);
  }

  /* ---------------- Loop + init ---------------- */
  function loop(now) {
    const t = now / 1000;
    for (let i = 0; i < figures.length; i++) render(figures[i], t);
    requestAnimationFrame(loop);
  }

  function init() {
    const canvases = document.querySelectorAll('.card-figure');
    if (!canvases.length) return;
    refreshPalette();
    canvases.forEach(setup);

    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => figures.forEach(resize), 150);
    });

    document.addEventListener('themechange', () => {
      refreshPalette();
      if (reduceMotion) figures.forEach((f) => render(f, 0));
    });

    figures.forEach((f) => render(f, 0));
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
