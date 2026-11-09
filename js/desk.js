/* Desk intro: a 3D table with a laptop and the app keychains. The live home page is mapped onto the laptop display and a click flies the camera into it. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const root = document.documentElement;
const page = document.getElementById('desk-page');
const canvas = document.getElementById('desk-canvas');
const veil = document.getElementById('desk-veil');
const hint = document.getElementById('desk-hint');
const label = document.getElementById('desk-label');

/* ---- helpers ---- */
const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const damp = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 6);
}

function woodTexture(colors) {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = colors[0];
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 340; i++) {
    const y = Math.random() * c.height;
    const amp = 3 + Math.random() * 12;
    const f = 0.0015 + Math.random() * 0.003;
    const ph = Math.random() * 10;
    g.strokeStyle = colors[1 + (i % 2)];
    g.globalAlpha = 0.06 + Math.random() * 0.22;
    g.lineWidth = 0.6 + Math.random() * 2.6;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 12) {
      const yy = y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.7 + ph * 2) * amp * 0.25;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---- palette ---- */
const THEME = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
const PAL = {
  light: {
    bg: '#F7F7F7', alu: 0xd6d8db, pad: 0xcdcfd2, keys: 0x1d1d1f, well: 0xbfc1c4, bezel: 0x0a0a0b, hinge: 0x8e9095,
    wood: ['#cfb08c', '#b8936c', '#a98159'], leg: 0xb08a63, metal: 0xd4d7db,
    sun: 2.8, hemi: 0.7, env: 0.9, floorShadow: 0.07, exposure: 1.0,
  },
  dark: {
    bg: '#08080A', alu: 0x46484c, pad: 0x3e4044, keys: 0x0c0c0e, well: 0x2c2d30, bezel: 0x050506, hinge: 0x26272a,
    wood: ['#58402f', '#45311f', '#3a2918'], leg: 0x3f2d1f, metal: 0xa4a7ad,
    sun: 1.7, hemi: 0.22, env: 0.5, floorShadow: 0.35, exposure: 1.0,
  },
}[THEME];

/* ---- renderer + scene ---- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = PAL.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.01, 30);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8075, PAL.hemi));
const sun = new THREE.DirectionalLight(0xfff6ec, PAL.sun);
sun.position.set(-0.9, 2.2, 1.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.5, far: 5 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.0015;
scene.add(sun);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, envMapIntensity: PAL.env, ...opts });
}
function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ---- table ---- */
const TABLE = { w: 1.25, d: 0.72, t: 0.036, h: 0.74 };
const woodMat = mat(0xffffff, { map: woodTexture(PAL.wood), roughness: 0.62, metalness: 0 });
const top = mesh(new RoundedBoxGeometry(TABLE.w, TABLE.t, TABLE.d, 4, 0.012), woodMat);
top.position.y = -TABLE.t / 2;
scene.add(top);
const legMat = mat(PAL.leg, { roughness: 0.6 });
const legGeo = new RoundedBoxGeometry(0.042, TABLE.h - TABLE.t, 0.042, 2, 0.008);
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
  const leg = mesh(legGeo, legMat);
  leg.position.set(sx * (TABLE.w / 2 - 0.07), -TABLE.t - (TABLE.h - TABLE.t) / 2, sz * (TABLE.d / 2 - 0.06));
  scene.add(leg);
});
const floor = mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: PAL.floorShadow }), { cast: false });
floor.rotation.x = -Math.PI / 2;
floor.position.y = -TABLE.h;
scene.add(floor);

/* ---- laptop ---- */
const LAP = { w: 0.312, d: 0.218, h: 0.0105, lidT: 0.005, lidL: 0.214, dw: 0.296, dh: 0.185, topBezel: 0.006, open: deg(-18) };
const laptop = new THREE.Group();
laptop.userData.pick = 'laptop';
scene.add(laptop);

const alu = mat(PAL.alu, { metalness: 0.9, roughness: 0.34 });
const base = mesh(new RoundedBoxGeometry(LAP.w, LAP.h, LAP.d, 4, 0.004), alu);
base.position.y = LAP.h / 2;
laptop.add(base);

const flat = (geo, material, x, z, y = LAP.h + 0.0002) => {
  const m = mesh(geo, material, { cast: false });
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  laptop.add(m);
  return m;
};
flat(roundedRect(0.282, 0.116, 0.004), mat(PAL.well, { metalness: 0.6, roughness: 0.5 }), 0, -0.036);
flat(roundedRect(0.12, 0.074, 0.006), mat(PAL.pad, { metalness: 0.85, roughness: 0.26 }), 0, 0.062);

(function keyboard() {
  const rows = [
    { h: 0.6, keys: Array(14).fill(14.5 / 14) },
    { h: 1, keys: [...Array(13).fill(1), 1.5] },
    { h: 1, keys: [1.5, ...Array(12).fill(1), 1] },
    { h: 1, keys: [1.75, ...Array(11).fill(1), 1.75] },
    { h: 1, keys: [2.25, ...Array(10).fill(1), 2.25] },
    { h: 1, keys: [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1] },
  ];
  const u = 0.272 / 14.5;
  const gap = 0.0024;
  const count = rows.reduce((n, r) => n + r.keys.length, 0);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.18), mat(PAL.keys, { roughness: 0.55 }), count);
  keys.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  let i = 0;
  let z = -0.036 - 0.054;
  rows.forEach((row) => {
    const depth = row.h * u;
    let x = -0.136;
    row.keys.forEach((w) => {
      m4.makeScale(w * u - gap, 0.0012, depth - gap);
      m4.setPosition(x + (w * u) / 2, LAP.h + 0.0008, z + depth / 2);
      keys.setMatrixAt(i++, m4);
      x += w * u;
    });
    z += depth;
  });
  laptop.add(keys);
})();

const hinge = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, LAP.w - 0.07, 20), mat(PAL.hinge, { metalness: 0.8, roughness: 0.4 }));
hinge.rotation.z = Math.PI / 2;
hinge.position.set(0, LAP.h, -LAP.d / 2 + 0.006);
laptop.add(hinge);

const lid = new THREE.Group();
lid.position.set(0, LAP.h, -LAP.d / 2 + 0.004);
lid.rotation.x = deg(89);
laptop.add(lid);

const shell = mesh(new RoundedBoxGeometry(LAP.w, LAP.lidL, LAP.lidT, 4, 0.0022), alu);
shell.position.set(0, LAP.lidL / 2, -LAP.lidT / 2);
lid.add(shell);
const bezel = mesh(roundedRect(LAP.w - 0.004, LAP.lidL - 0.004, 0.009), mat(PAL.bezel, { roughness: 0.25, metalness: 0.2 }), { cast: false });
bezel.position.set(0, LAP.lidL / 2, 0.0001);
lid.add(bezel);

const displayY = LAP.lidL - LAP.topBezel - LAP.dh / 2;
const anchor = new THREE.Object3D();
anchor.position.set(0, displayY, 0.0003);
lid.add(anchor);

/* The hole: writes alpha 0, so the real page (under the canvas) shows through exactly where the display is visible. */
const hole = new THREE.Mesh(
  roundedRect(LAP.dw, LAP.dh, 0.004),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: THREE.NoBlending, toneMapped: false })
);
hole.position.copy(anchor.position);
lid.add(hole);

/* ---- keychains ---- */
const KEYCHAINS = [
  { app: 'mono', name: 'Mono', x: 0.3, z: 0.17, rot: -0.45 },
  { app: 'intent', name: 'Intent', x: 0.4, z: 0.02, rot: 0.5 },
  { app: 'sileo', name: 'Sileo', x: -0.33, z: 0.14, rot: 0.75 },
];
const CHARM = 0.06;
const metal = mat(PAL.metal, { metalness: 1, roughness: 0.22 });
const chains = [];

function splitRing(r) {
  const pts = [];
  const turns = 1.85;
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, (i / 120) * 0.0026, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0011, 8, false);
}

const loader = new GLTFLoader();
KEYCHAINS.forEach((k) => {
  const g = new THREE.Group();
  g.position.set(k.x, 0, k.z);
  g.rotation.y = k.rot;
  g.userData.pick = k.app;
  g.userData.name = k.name;
  g.userData.lift = 0;
  scene.add(g);
  chains.push(g);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(-0.012, 0.02, -0.008);
  g.add(hit);

  const corner = new THREE.Vector3(-CHARM / 2 + 0.004, 0, -CHARM / 2 + 0.004);
  const dir = new THREE.Vector3(-1, 0, -1).normalize();
  const link = mesh(new THREE.TorusGeometry(0.0042, 0.0009, 8, 24), metal);
  link.position.copy(corner).addScaledVector(dir, 0.002).setY(0.006);
  link.rotation.set(Math.PI / 2 - 0.5, 0, Math.PI / 4);
  g.add(link);
  const ring = mesh(splitRing(0.013), metal);
  ring.position.copy(corner).addScaledVector(dir, 0.0175).setY(0.0011);
  g.add(ring);

  loader.load(`style/3d%20models/${k.app}/icon_${k.app}_3d_${THEME}.glb`, (gltf) => {
    const charm = gltf.scene;
    charm.rotation.x = -Math.PI / 2;
    charm.scale.setScalar(CHARM / 0.1445);
    charm.position.y = 0.0048 + 0.0003;
    charm.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = PAL.env;
    });
    g.add(charm);
  });
});

/* ---- page mapping ---- */
function quadSize() {
  const a = window.innerWidth / window.innerHeight;
  return a > LAP.dw / LAP.dh ? { qw: LAP.dw, qh: LAP.dw / a } : { qw: LAP.dh * a, qh: LAP.dh };
}

/* Projective map of the page rect (0,0)-(W,H) onto four screen points (TL, TR, BR, BL), as a CSS matrix3d. */
function homography(W, H, p) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = (x1 - x0 + g * x1) / W, b = (x3 - x0 + h * x3) / H;
  const d = (y1 - y0 + g * y1) / W, e = (y3 - y0 + h * y3) / H;
  g /= W;
  h /= H;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${x0},${y0},0,1)`;
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Vector3();
function syncPage() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const { qw, qh } = quadSize();
  anchor.getWorldPosition(_c);
  _n.set(0, 0, 1).transformDirection(anchor.matrixWorld);
  const facing = _n.dot(_v.copy(camera.position).sub(_c)) > 0.002;
  page.style.visibility = facing ? '' : 'hidden';
  if (!facing) return;
  const pts = [];
  [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
    _v.set((sx * qw) / 2, (sy * qh) / 2, 0).applyMatrix4(anchor.matrixWorld).project(camera);
    pts.push(((_v.x + 1) / 2) * W, ((1 - _v.y) / 2) * H);
  });
  page.style.transform = homography(W, H, pts);
}

/* ---- camera ---- */
const IDLE = { target: new THREE.Vector3(0, -0.05, 0.05), dist: 1.62, el: deg(24) };
const pointer = { x: 0, y: 0, sx: 0, sy: 0, ndc: new THREE.Vector2(), inside: false };
const camTarget = new THREE.Vector3();
let push = 0;

function idlePose(k) {
  const dist = IDLE.dist * (1 + 0.32 * (1 - k)) * (1 - push * 0.035);
  const el = IDLE.el + deg(10) * (1 - k) + pointer.sy * deg(2.4);
  const az = deg(-16) * (1 - k) + pointer.sx * deg(4.5);
  camTarget.copy(IDLE.target);
  camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(camTarget);
  camera.up.set(0, 1, 0);
  camera.lookAt(camTarget);
}

const zoom = { t: 0, from: null, app: null };
const _q1 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _f = new THREE.Vector3();
function zoomPose(e) {
  anchor.getWorldPosition(_c);
  _n.set(0, 0, 1).transformDirection(anchor.matrixWorld);
  _up.set(0, 1, 0).transformDirection(anchor.matrixWorld);
  const d1 = quadSize().qh / 2 / Math.tan(deg(camera.fov / 2));
  _p1.copy(_c).addScaledVector(_n, d1);
  _q1.setFromRotationMatrix(_m.lookAt(_p1, _c, _up));
  camTarget.lerpVectors(zoom.from.target, _c, e);
  camera.quaternion.slerpQuaternions(zoom.from.q, _q1, e);
  const dist = zoom.from.dist * Math.pow(d1 / zoom.from.dist, e);
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
  camera.position.copy(camTarget).addScaledVector(_f, -dist);
}

/* ---- state ---- */
const INTRO = 2.6;
const ZOOM = 2.0;
let mode = 'intro';
let introT = 0;
let hover = null;
let raf = 0;

function enter(app) {
  if (mode === 'zoom' || mode === 'done') return;
  mode = 'zoom';
  zoom.t = 0;
  zoom.app = app || null;
  zoom.from = { target: camTarget.clone(), q: camera.quaternion.clone(), dist: camera.position.distanceTo(camTarget) };
  lid.rotation.x = LAP.open;
  hint.classList.remove('is-shown');
  label.classList.remove('is-shown');
  canvas.classList.remove('is-hover');
}

function finish() {
  mode = 'done';
  cancelAnimationFrame(raf);
  page.style.transform = '';
  page.style.visibility = '';
  root.classList.remove('desk-on');
  root.classList.add('desk-done');
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKey);
  [canvas, veil, hint, label].forEach((el) => el.remove());
  renderer.dispose();
  if (zoom.app) {
    const btn = document.querySelector(`.dock-app[data-app="${zoom.app}"]`);
    if (btn) setTimeout(() => btn.click(), 120);
  }
  document.dispatchEvent(new CustomEvent('deskdone'));
}

/* ---- input ---- */
const raycaster = new THREE.Raycaster();
function pick() {
  raycaster.setFromCamera(pointer.ndc, camera);
  const hit = raycaster.intersectObjects([laptop, ...chains], true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.pick) o = o.parent;
  return o || null;
}

canvas.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  pointer.ndc.set(pointer.x, -pointer.y);
  pointer.inside = true;
  label.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
});
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
canvas.addEventListener('click', (e) => {
  if (mode !== 'idle' && mode !== 'intro') return;
  pointer.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  const o = pick();
  if (!o) return;
  if (mode === 'intro') { introT = INTRO; idlePose(1); }
  enter(o.userData.pick === 'laptop' ? null : o.userData.pick);
});
function onKey(e) {
  if ((e.key === 'Enter' || e.key === ' ') && (mode === 'idle' || mode === 'intro')) {
    e.preventDefault();
    if (mode === 'intro') { introT = INTRO; idlePose(1); }
    enter(null);
  }
}
window.addEventListener('keydown', onKey);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

/* ---- loop ---- */
const clock = new THREE.Clock();
let first = true;
function frame() {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);

  pointer.sx = damp(pointer.sx, pointer.inside && mode !== 'zoom' ? pointer.x : 0, 2.5, dt);
  pointer.sy = damp(pointer.sy, pointer.inside && mode !== 'zoom' ? pointer.y : 0, 2.5, dt);

  if (mode === 'intro' || mode === 'idle') {
    if (mode === 'intro') {
      introT += dt;
      lid.rotation.x = lerp(deg(89), LAP.open, easeOut(clamp((introT - 0.5) / 1.7, 0, 1)));
      if (introT > 1.4) hint.classList.add('is-shown');
      if (introT >= INTRO) mode = 'idle';
    }
    const next = pointer.inside ? pick() : null;
    if (next !== hover) {
      hover = next;
      canvas.classList.toggle('is-hover', !!hover);
      if (hover && hover.userData.name) label.textContent = hover.userData.name;
      label.classList.toggle('is-shown', !!(hover && hover.userData.name));
    }
    push = damp(push, hover === laptop ? 1 : 0, 4, dt);
    idlePose(easeOut(clamp(introT / INTRO, 0, 1)));
  } else if (mode === 'zoom') {
    zoom.t = Math.min(1, zoom.t + dt / ZOOM);
    zoomPose(easeInOut(zoom.t));
  }

  chains.forEach((g) => {
    g.userData.lift = damp(g.userData.lift, hover === g && mode !== 'zoom' ? 1 : 0, 9, dt);
    const l = g.userData.lift;
    g.position.y = l * 0.016;
    g.rotation.x = l * deg(-8);
  });

  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  syncPage();
  renderer.render(scene, camera);

  if (first) {
    first = false;
    window.__deskReady = true;
    veil.classList.add('is-gone');
  }
  if (mode === 'zoom' && zoom.t >= 1) finish();
}

idlePose(0);
frame();
