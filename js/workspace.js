/* Desk intro: a path-traced desk scene (rendered in Blender, see style/workspace/) with the live home page mapped onto
   the iMac display. The room goes from dusk to the look that matches the site theme (daylight by day, lamps in the
   evening), the display wakes, the app charms swing on their hooks, and a click flies the view into the screen.
   Everything is flat layers moved with CSS transforms: no WebGL. */
import DATA from './workspace-data.js?v=73';

const root = document.documentElement;
const page = document.getElementById('desk-page');
const stage = document.getElementById('desk-stage');
const veil = document.getElementById('desk-veil');
const hint = document.getElementById('desk-hint');
const label = document.getElementById('desk-label');

/* ---- helpers ---- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const damp = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));
const deg = (d) => (d * Math.PI) / 180;
const el = (tag, cls, parent) => {
  const n = document.createElement(tag);
  n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
};

const theme = () => (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
const ASSETS = 'style/workspace/';
const ASPECT = DATA.width / DATA.height;

/* ---- layers ---- */
function shot(cls) {
  const img = el('img', `desk-shot ${cls}`, stage);
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  return img;
}
const shotOff = shot('is-off');
const shotLit = shot('is-on');
shotOff.src = `${ASSETS}desk_off.jpg`;
const displayBg = el('div', 'desk-display', stage);

/* Over the page: the black "sleeping" display and a faint glass sheen. */
const film = el('div', 'desk-film', document.body);
film.setAttribute('aria-hidden', 'true');
const filmBlack = el('div', 'desk-film-black', film);
const filmGloss = el('div', 'desk-film-gloss', film);

/* Charms: the ring swings on its peg, the tile swings from the bottom of the ring. */
const charms = DATA.charms.map((c, i) => {
  const anchor = el('div', 'desk-charm', stage);
  const ringPivot = el('div', 'desk-charm-pivot', anchor);
  const ringImg = el('img', 'desk-charm-ring', ringPivot);
  ringImg.alt = '';
  ringImg.draggable = false;
  const tilePivot = el('div', 'desk-charm-pivot desk-charm-tile', ringPivot);
  const tileImg = el('img', 'desk-charm-img', tilePivot);
  tileImg.alt = c.name;
  tileImg.draggable = false;
  const phase = i * 2.05;
  return {
    ...c, anchor, ringPivot, ringImg, tilePivot, tileImg, phase,
    ring: { rz: 0, vz: 0 },
    tile: { rz: (i - 1) * 0.12 + 0.2, vz: 0, hovered: false, kick: -9 },
  };
});

/* The lit render and the charm sprites follow the site theme: daylight for light, lamps for dark. */
const themeFiles = (t) => [`desk_${t}.jpg`, ...DATA.charms.flatMap((c) => [`ring_${c.app}_${t}.png`, `charm_${c.app}_${t}.png`])];
let shown = null;
function applyTheme() {
  const t = theme();
  if (t === shown) return;
  shown = t;
  shotLit.src = `${ASSETS}desk_${t}.jpg`;
  charms.forEach((c) => {
    c.ringImg.src = `${ASSETS}ring_${c.app}_${t}.png`;
    c.tileImg.src = `${ASSETS}charm_${c.app}_${t}.png`;
  });
}
applyTheme();
document.addEventListener('themechange', () => { if (root.classList.contains('desk-on')) applyTheme(); });

/* ---- layout: the image always covers the viewport ---- */
const K_IDLE = 1.045;
let W = 0, H = 0, sw = 0, sh = 0;
let disp = null, comp = null, quad = null;
const home = { x: 0, y: 0, ax: 0, ay: 0 };

function layout() {
  W = window.innerWidth;
  H = window.innerHeight;
  sw = Math.max(W, H * ASPECT);
  sh = sw / ASPECT;
  stage.style.width = `${sw}px`;
  stage.style.height = `${sh}px`;
  stage.style.setProperty('--u', `${sw / 1000}px`);

  const px = ([l, t, w, h]) => ({ x: l * sw, y: t * sh, w: w * sw, h: h * sh });
  disp = px(DATA.display);
  comp = px(DATA.computer);
  Object.assign(displayBg.style, { left: `${disp.x}px`, top: `${disp.y}px`, width: `${disp.w}px`, height: `${disp.h}px` });
  film.style.width = `${disp.w}px`;
  film.style.height = `${disp.h}px`;

  /* The page keeps the viewport's shape: it fills the display's width or height and sits against the top edge. */
  const a = W / H;
  const qw = a > disp.w / disp.h ? disp.w : disp.h * a;
  const qh = qw / a;
  quad = { x: disp.x + (disp.w - qw) / 2, y: disp.y, w: qw, h: qh };

  /* Resting view: centred on the iMac, with a little room left for the pointer parallax. */
  const hx = W / (2 * K_IDLE);
  const hy = H / (2 * K_IDLE);
  home.ax = Math.min(sw * 0.008, sw / 2 - hx);
  home.ay = Math.min(sw * 0.005, (sh - 2 * hy) / 2);
  home.x = sw / 2;
  home.y = clamp(sh * 0.555, hy + home.ay, sh - hy - home.ay);

  charms.forEach((c) => {
    const [px0, py0] = c.peg;
    const [vx, vy] = c.pivot;
    Object.assign(c.anchor.style, { left: `${px0 * sw}px`, top: `${py0 * sh}px` });
    Object.assign(c.ringImg.style, {
      left: `${(c.ring_rect[0] - px0) * sw}px`, top: `${(c.ring_rect[1] - py0) * sh}px`, width: `${c.ring_rect[2] * sw}px`,
    });
    Object.assign(c.tilePivot.style, { left: `${(vx - px0) * sw}px`, top: `${(vy - py0) * sh}px` });
    Object.assign(c.tileImg.style, {
      left: `${(c.tile_rect[0] - vx) * sw}px`, top: `${(c.tile_rect[1] - vy) * sh}px`, width: `${c.tile_rect[2] * sw}px`,
    });
  });
}
charms.forEach((c) => {
  const src = DATA.charms.find((d) => d.app === c.app);
  c.ring_rect = src.ring;
  c.tile_rect = src.charm;
});

/* ---- view: scale k around the stage point c, which lands in the middle of the viewport ---- */
const view = { k: K_IDLE, x: 0, y: 0, tx: 0, ty: 0 };
const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
let push = 0;

function applyView(k, cx, cy) {
  view.k = k;
  view.x = cx;
  view.y = cy;
  view.tx = W / 2 - k * cx;
  view.ty = H / 2 - k * cy;
  stage.style.transform = `matrix(${k},0,0,${k},${view.tx},${view.ty})`;
  film.style.transform = `matrix(${k},0,0,${k},${view.tx + k * disp.x},${view.ty + k * disp.y})`;
  const s = (k * quad.w) / W;
  page.style.transform = `matrix(${s},0,0,${s},${view.tx + k * quad.x},${view.ty + k * quad.y})`;
}

function idlePose(e) {
  const k = K_IDLE * (1 + 0.16 * (1 - e)) * (1 + push * 0.018);
  applyView(k, home.x + pointer.sx * home.ax, home.y + pointer.sy * home.ay);
}

/* Fly into the screen: zoom exponentially while the page centre slides to the middle, so it reads as one straight push. */
const zoom = { t: 0, from: null, app: null };
function zoomPose(e) {
  const f = zoom.from;
  const kEnd = W / quad.w;
  const k = f.k * Math.pow(kEnd / f.k, e);
  const w = Math.abs(kEnd - f.k) < 1e-6 ? e : (1 - f.k / k) / (1 - f.k / kEnd);
  applyView(k, f.x + (quad.x + quad.w / 2 - f.x) * w, f.y + (quad.y + quad.h / 2 - f.y) * w);
  filmGloss.style.opacity = String(1 - e);
}

/* ---- light: 0 = the room at dusk, 1 = lamps on ---- */
let lit = -1;
function setLit(v) {
  const q = Math.round(v * 200) / 200;
  if (q === lit) return;
  lit = q;
  stage.style.setProperty('--lit', String(q));
}

/* ---- state ---- */
const INTRO = 3.2;
const ZOOM = 2.0;
let mode = 'loading';
let introT = 0;
let hover = null;
let raf = 0;
let last = 0;
let time = 0;

function endIntro() {
  introT = INTRO;
  setLit(1);
  filmBlack.style.opacity = '0';
}

function enter(app) {
  if (mode !== 'idle' && mode !== 'intro') return;
  if (mode === 'intro') { endIntro(); idlePose(1); }
  mode = 'zoom';
  zoom.t = 0;
  zoom.app = app || null;
  zoom.from = { k: view.k, x: view.x, y: view.y };
  hint.classList.remove('is-shown');
  label.classList.remove('is-shown');
  stage.classList.remove('is-hover');
}

/* Inside the screen: the scene stops and hides, but stays ready to fly back out (back()). */
function finish() {
  mode = 'done';
  cancelAnimationFrame(raf);
  page.style.transform = '';
  root.classList.remove('desk-on');
  root.classList.add('desk-done');
  if (zoom.app) {
    const btn = document.querySelector(`.dock-app[data-app="${zoom.app}"]`);
    if (btn) setTimeout(() => btn.click(), 120);
  }
  document.dispatchEvent(new CustomEvent('deskdone'));
}

/* From the page back out to the desk: the same flight, reversed. It starts exactly at the page, so there is no jump. */
function back() {
  if (mode !== 'done') return;
  root.classList.remove('desk-done');
  root.classList.add('desk-on');
  applyTheme();
  layout();
  pointer.inside = false;
  pointer.sx = pointer.sy = 0;
  push = 0;
  hover = null;
  endIntro();
  zoom.from = { k: K_IDLE, x: home.x, y: home.y };
  zoom.app = null;
  zoom.t = 1;
  mode = 'unzoom';
  veil.classList.add('is-gone');
  last = 0;
  frame(performance.now());
}
window.invercaroDesk = { back };

/* ---- input ---- */
function overComputer(e) {
  const x = (e.clientX - view.tx) / view.k;
  const y = (e.clientY - view.ty) / view.k;
  return x >= comp.x && x <= comp.x + comp.w && y >= comp.y && y <= comp.y + comp.h;
}
function setHover(next, name) {
  if (next === hover) return;
  hover = next;
  stage.classList.toggle('is-hover', !!hover);
  if (name) label.textContent = name;
  label.classList.toggle('is-shown', !!name);
}

stage.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / W) * 2 - 1;
  pointer.y = (e.clientY / H) * 2 - 1;
  pointer.inside = true;
  label.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
  if (mode !== 'idle' && mode !== 'intro') return;
  const charm = charms.find((c) => c.tileImg === e.target);
  if (charm) {
    /* Brushing a charm pushes it the way the pointer travels. */
    charm.tile.vz -= clamp(e.movementX * 0.012, -0.5, 0.5);
    charm.ring.vz -= clamp(e.movementX * 0.003, -0.12, 0.12);
    setHover(charm, charm.name);
  } else {
    setHover(overComputer(e) ? 'computer' : null, null);
  }
});
stage.addEventListener('pointerleave', () => {
  pointer.inside = false;
  setHover(null, null);
});
stage.addEventListener('click', (e) => {
  if (mode !== 'idle' && mode !== 'intro') return;
  const charm = charms.find((c) => c.tileImg === e.target);
  if (charm) enter(charm.app);
  else if (overComputer(e)) enter(null);
});
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && (mode === 'idle' || mode === 'intro')) {
    e.preventDefault();
    enter(null);
  }
});
window.addEventListener('resize', () => {
  if (mode === 'done' || mode === 'loading') return;
  layout();
});

/* ---- loop ---- */
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  time += dt;

  const follow = pointer.inside && (mode === 'idle' || mode === 'intro');
  pointer.sx = damp(pointer.sx, follow ? pointer.x : 0, 2.5, dt);
  pointer.sy = damp(pointer.sy, follow ? pointer.y : 0, 2.5, dt);

  if (mode === 'intro' || mode === 'idle') {
    if (mode === 'intro') {
      introT += dt;
      setLit(easeInOut(clamp((introT - 0.55) / 1.5, 0, 1)));
      filmBlack.style.opacity = String(1 - easeOut(clamp((introT - 1.7) / 1.2, 0, 1)));
      if (introT > 2.3) hint.classList.add('is-shown');
      if (introT >= INTRO) { mode = 'idle'; endIntro(); }
    }
    push = damp(push, hover === 'computer' ? 1 : 0, 4, dt);
    idlePose(easeOut(clamp(introT / INTRO, 0, 1)));
  } else if (mode === 'zoom') {
    zoom.t = Math.min(1, zoom.t + dt / ZOOM);
    zoomPose(easeInOut(zoom.t));
  } else if (mode === 'unzoom') {
    zoom.t = Math.max(0, zoom.t - dt / ZOOM);
    zoomPose(easeInOut(zoom.t));
    if (zoom.t <= 0) {
      mode = 'idle';
      hint.classList.add('is-shown');
    }
  }

  /* Charms: damped springs around a slow idle sway; hovering gives a nudge. */
  charms.forEach((c) => {
    const r = c.ring;
    const u = c.tile;
    const on = hover === c;
    if (on && !u.hovered && time - u.kick > 1.6 && Math.abs(u.vz) < 0.2) {
      u.kick = time;
      u.vz += 0.5;
      r.vz += 0.15;
    }
    u.hovered = on;
    r.vz += (-(r.rz - Math.sin(time * 0.7 + c.phase) * deg(1)) * 9 - r.vz * 1.4) * dt;
    r.rz += r.vz * dt;
    u.vz += (-(u.rz - Math.sin(time * 0.9 + c.phase) * deg(1.4)) * 16 - u.vz * 1.8) * dt;
    u.rz += u.vz * dt;
    c.ringPivot.style.transform = `rotate(${r.rz}rad)`;
    c.tilePivot.style.transform = `rotate(${u.rz}rad)`;
  });

  if (mode === 'zoom' && zoom.t >= 1) finish();
}

/* ---- start once both renders are decoded, so nothing pops in ---- */
const ready = Promise.all([shotOff, shotLit].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
const returning = !!window.__deskBack;
if (returning) mode = 'done';
ready.then(() => {
  window.__deskReady = true;
  if (returning) { back(); return; }
  if (!root.classList.contains('desk-on')) return;
  layout();
  setLit(0);
  mode = 'intro';
  idlePose(0);
  veil.classList.add('is-gone');
  frame(performance.now());
  /* Warm the other theme's images, so flying back out after a theme switch does not flash. */
  setTimeout(() => themeFiles(theme() === 'dark' ? 'light' : 'dark').forEach((f) => { new Image().src = `${ASSETS}${f}`; }), 4000);
});
