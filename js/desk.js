/* Desk intro: an iMac on a wooden desk, with one keyring of app charms hanging on the wall. The live home page is mapped onto the iMac display and a click flies the camera into it. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const root = document.documentElement;
const page = document.getElementById('desk-page');
const canvas = document.getElementById('desk-canvas');
const veil = document.getElementById('desk-veil');
const hint = document.getElementById('desk-hint');
const label = document.getElementById('desk-label');

/* ---- helpers ---- */
const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const damp = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));

function rectShape(w, h, r, rBottom = r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + rBottom, y);
  s.lineTo(x + w - rBottom, y);
  if (rBottom) s.quadraticCurveTo(x + w, y, x + w, y + rBottom);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + rBottom);
  if (rBottom) s.quadraticCurveTo(x, y, x + rBottom, y);
  return s;
}
const plate = (w, h, r, rBottom) => new THREE.ShapeGeometry(rectShape(w, h, r, rBottom), 8);

/* Value noise, used for the plaster wall. */
function noise2(seed) {
  const N = 256;
  const g = new Float32Array(N * N);
  let s = seed;
  for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
  const at = (x, y) => g[(y & (N - 1)) * N + (x & (N - 1))];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function plasterTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const n = noise2(3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = n(x / 9, y / 9) * 0.5 + n(x / 3.1, y / 3.1) * 0.3 + n(x / 40, y / 40) * 0.2;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 5);
  return tex;
}

function softShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ---- palette ---- */
const THEME = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
const PAL = {
  light: {
    bg: '#F7F7F7', wall: 0xd3cec7, alu: 0xdcdee1, bezel: 0xe9e8e4,
    wood: 'oak_veneer_01', woodTint: 0xf0ebe4, leg: 0x1b1b1d, metal: 0xd4d7db, hook: 0xb8b2a6,
    key: 6, window: 3.2, hemi: 0.45, env: 0.85, contact: 0.32, exposure: 1.0,
  },
  dark: {
    bg: '#08080A', wall: 0x18181b, alu: 0x4b4d52, bezel: 0x0a0a0b,
    wood: 'wood_table_001', woodTint: 0xd8d0c8, leg: 0x0c0c0d, metal: 0xa4a7ad, hook: 0x8a857c,
    key: 3, window: 1.4, hemi: 0.14, env: 0.45, contact: 0.6, exposure: 1.0,
  },
}[THEME];

/* ---- renderer + scene ---- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = PAL.exposure;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
/* Studio HDRI "Studio Small 09" by Poly Haven (CC0) for real-world reflections on the aluminium, glass and wood. */
new RGBELoader().load('style/hdr/studio_small_09_1k.hdr', (hdr) => {
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
});

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.01, 30);

scene.add(new THREE.HemisphereLight(0xffffff, 0x7d756c, PAL.hemi));
const keyLight = new THREE.SpotLight(0xfff4e8, PAL.key, 0, 0.5, 1, 0);
keyLight.position.set(-1.1, 2.1, 1.3);
keyLight.target.position.set(0.05, 0.1, -0.15);
scene.add(keyLight, keyLight.target);
/* A soft "window" to the left: a wide area light that grades the wall and lays a long highlight on the desk. */
RectAreaLightUniformsLib.init();
const windowLight = new THREE.RectAreaLight(0xfff8f0, PAL.window, 1.2, 1.6);
windowLight.position.set(-1.25, 0.75, 0.15);
windowLight.lookAt(0.2, 0.15, -0.2);
scene.add(windowLight);
const rim = new THREE.DirectionalLight(0xe8eeff, PAL.key * 0.12);
rim.position.set(1.4, 1.2, -0.6);
scene.add(rim);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, envMapIntensity: PAL.env, ...opts });
}
function phys(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, envMapIntensity: PAL.env, ...opts });
}
function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ---- room ---- */
const TABLE = { w: 1.7, d: 0.82, t: 0.03, h: 0.74 };
const wall = mesh(new THREE.PlaneGeometry(10, 5), mat(PAL.wall, { roughness: 0.92, bumpMap: plasterTexture(), bumpScale: 0.6 }), { cast: false });
wall.position.set(0, 1.5, -TABLE.d / 2 - 0.12);
scene.add(wall);
const floor = mesh(new THREE.PlaneGeometry(10, 10), mat(PAL.wall, { roughness: 0.9 }), { cast: false });
floor.rotation.x = -Math.PI / 2;
floor.position.y = -TABLE.h;
scene.add(floor);

/* ---- table: solid wood top on black steel legs ---- */
/* Wood scans by Poly Haven (CC0): "Oak Veneer 01" for the light theme, "Wood Table 001" (walnut) for the dark one. */
const texLoader = new THREE.TextureLoader();
function woodMap(kind, srgb) {
  const t = texLoader.load(`style/textures/${PAL.wood}_${kind}_1k.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
  t.repeat.set(0.9, 1.9);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const woodTop = phys(PAL.woodTint, {
  map: woodMap('diff', true), normalMap: woodMap('nor_gl'), roughnessMap: woodMap('rough'),
  roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 0.25, clearcoatRoughness: 0.35,
});
const top = mesh(new RoundedBoxGeometry(TABLE.w, TABLE.t, TABLE.d, 3, 0.004), woodTop);
top.position.y = -TABLE.t / 2;
scene.add(top);
const steel = mat(PAL.leg, { metalness: 0.7, roughness: 0.45 });
const legGeo = new THREE.BoxGeometry(0.028, TABLE.h - TABLE.t, 0.028);
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
  const leg = mesh(legGeo, steel);
  leg.position.set(sx * (TABLE.w / 2 - 0.05), -TABLE.t - (TABLE.h - TABLE.t) / 2, sz * (TABLE.d / 2 - 0.05));
  scene.add(leg);
});
const rail = mesh(new THREE.BoxGeometry(TABLE.w - 0.1, 0.03, 0.02), steel);
rail.position.set(0, -TABLE.t - 0.015, -(TABLE.d / 2 - 0.05));
scene.add(rail);

const shadowTex = softShadowTexture();
function contact(w, d, x, z, opacity = PAL.contact, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
    map: shadowTex, color: 0x000000, transparent: true, opacity, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.0006, z);
  parent.add(m);
  return m;
}

/* ---- iMac ---- */
const IMAC = { w: 0.547, h: 0.42, t: 0.0115, dw: 0.515, dh: 0.322, topBezel: 0.014, lift: 0.08, tilt: deg(-5), z: -0.16 };
const computer = new THREE.Group();
computer.userData.pick = 'computer';
computer.position.z = IMAC.z;
scene.add(computer);

const alu = mat(PAL.alu, { metalness: 0.85, roughness: 0.32 });

const panel = new THREE.Group();
panel.position.y = IMAC.lift;
panel.rotation.x = IMAC.tilt;
computer.add(panel);

const bevel = 0.0016;
const shellGeo = new THREE.ExtrudeGeometry(rectShape(IMAC.w - bevel * 2, IMAC.h - bevel * 2, 0.012), {
  depth: IMAC.t - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
});
shellGeo.translate(0, IMAC.h / 2, -IMAC.t / 2 + bevel);
panel.add(mesh(shellGeo, alu));

const chin = IMAC.h - IMAC.topBezel * 2 - IMAC.dh;
const glassH = IMAC.h - chin;
const glass = mesh(plate(IMAC.w - 0.002, glassH - 0.001, 0.0115, 0), phys(PAL.bezel, {
  roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05,
}), { cast: false });
glass.position.set(0, chin + glassH / 2, IMAC.t / 2 + 0.0002);
panel.add(glass);

const anchor = new THREE.Object3D();
anchor.position.set(0, IMAC.h - IMAC.topBezel - IMAC.dh / 2, IMAC.t / 2 + 0.0005);
panel.add(anchor);

/* The hole: writes alpha 0, so the real page (under the canvas) shows through exactly where the display is visible. */
const hole = new THREE.Mesh(
  plate(IMAC.dw, IMAC.dh, 0.002),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: THREE.NoBlending, toneMapped: false })
);
hole.position.copy(anchor.position);
hole.renderOrder = 1;
panel.add(hole);
/* Display "wakes": a black film over the hole that fades out during the intro. */
const film = new THREE.Mesh(plate(IMAC.dw, IMAC.dh, 0.002), new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 1, depthWrite: false, toneMapped: false,
}));
film.position.copy(anchor.position).add(new THREE.Vector3(0, 0, 0.0003));
film.renderOrder = 2;
panel.add(film);

const STAND = { w: 0.15, t: 0.006 };
const foot = mesh(new RoundedBoxGeometry(STAND.w, STAND.t, 0.15, 3, 0.0025), alu);
foot.position.set(0, STAND.t / 2, -0.035);
computer.add(foot);
const upright = mesh(new RoundedBoxGeometry(STAND.w, 0.23, STAND.t, 3, 0.0025), alu);
upright.rotation.x = 0.24;
upright.receiveShadow = false;
upright.position.set(0, 0.11, -0.05);
computer.add(upright);
contact(0.24, 0.22, 0, IMAC.z - 0.035, PAL.contact * 0.55);

/* ---- one keyring with all three app charms, hanging on a wall hook top-right ---- */
const CHARMS = [
  { app: 'sileo', name: 'Sileo', at: deg(-42), tilt: deg(-30), dz: 0.006, drop: 0, phase: 0.0 },
  { app: 'mono', name: 'Mono', at: deg(0), tilt: deg(2), dz: 0.024, drop: 0.016, phase: 2.1 },
  { app: 'intent', name: 'Intent', at: deg(40), tilt: deg(31), dz: 0.014, drop: 0, phase: 4.0 },
];
const WALL_Z = wall.position.z;
const HOOK = new THREE.Vector3(0.5, 0.53, WALL_Z);
const CHARM = 0.064;
const CHARM_REACH = (CHARM / 2) * Math.SQRT2 - 0.004;
const RING_R = 0.019;
const metal = mat(PAL.metal, { metalness: 1, roughness: 0.18 });
const brass = mat(PAL.hook, { metalness: 1, roughness: 0.3 });
const chains = [];

const hook = new THREE.Group();
hook.position.copy(HOOK);
scene.add(hook);
const rose = mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.004, 32), brass);
rose.rotation.x = Math.PI / 2;
rose.position.z = 0.002;
hook.add(rose);
const pegCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0.003), new THREE.Vector3(0, -0.001, 0.02), new THREE.Vector3(0, 0.002, 0.031), new THREE.Vector3(0, 0.009, 0.034),
]);
hook.add(mesh(new THREE.TubeGeometry(pegCurve, 32, 0.0024, 12, false), brass));
const pegTip = mesh(new THREE.SphereGeometry(0.0026, 16, 12), brass);
pegTip.position.set(0, 0.009, 0.034);
hook.add(pegTip);
contact(0.05, 0.05, 0, 0, PAL.contact * 0.25, hook).rotation.x = 0;

function splitRing(r) {
  const pts = [];
  const turns = 1.9;
  for (let i = 0; i <= 140; i++) {
    const a = (i / 140) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, (i / 140) * 0.0022));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.0011, 10, false);
}

/* The ring rests on the peg and swings as a whole; the charms hang from its lowest point and sway on their own. */
const keyring = new THREE.Group();
keyring.position.set(0, -0.0012, 0.026);
keyring.userData = { rz: 0, vz: 0 };
hook.add(keyring);
const ring = mesh(splitRing(RING_R), metal);
ring.position.y = -RING_R;
ring.rotation.y = 0.9;
keyring.add(ring);

const loader = new GLTFLoader();
CHARMS.forEach((k) => {
  const pivot = new THREE.Group();
  pivot.position.set(Math.sin(k.at) * RING_R, -RING_R - Math.cos(k.at) * RING_R + 0.001, k.dz - 0.012);
  pivot.userData = { pick: k.app, name: k.name, tilt: k.tilt, phase: k.phase, rz: k.tilt, vz: 0, rx: 0, vx: 0, hovered: false };
  keyring.add(pivot);
  chains.push(pivot);

  const jump = mesh(new THREE.TorusGeometry(0.0038, 0.0008, 8, 24), metal);
  jump.position.y = -0.0032;
  if (k.drop) {
    const extra = mesh(new THREE.TorusGeometry(0.005, 0.0008, 8, 24), metal);
    extra.position.y = -0.0062 - k.drop / 2;
    extra.scale.y = (k.drop + 0.004) / 0.01;
    pivot.add(extra);
  }
  jump.rotation.y = Math.PI / 2;
  pivot.add(jump);

  const holder = new THREE.Group();
  holder.position.y = -0.0062 - CHARM_REACH - k.drop;
  pivot.add(holder);
  pivot.userData.holder = holder;

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), new THREE.MeshBasicMaterial({ visible: false }));
  hit.rotation.z = Math.PI / 4;
  holder.add(hit);

  loader.load(`style/3d%20models/${k.app}/icon_${k.app}_3d_${THEME}.glb`, (gltf) => {
    const charm = gltf.scene;
    charm.scale.setScalar(CHARM / 0.1445);
    charm.rotation.z = Math.PI / 4;
    charm.traverse((o) => {
      if (o.isMesh && o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = PAL.env;
    });
    holder.add(charm);
  });
});

/* ---- page mapping ---- */
function quadSize() {
  const a = window.innerWidth / window.innerHeight;
  return a > IMAC.dw / IMAC.dh ? { qw: IMAC.dw, qh: IMAC.dw / a } : { qw: IMAC.dh * a, qh: IMAC.dh };
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
const IDLE = { target: new THREE.Vector3(0, 0.25, -0.1), dist: 1.16, el: deg(9) };
const pointer = { x: 0, y: 0, sx: 0, sy: 0, ndc: new THREE.Vector2(), inside: false };
const camTarget = new THREE.Vector3();
let push = 0;

function idlePose(k) {
  const dist = IDLE.dist * (1 + 0.3 * (1 - k)) * (1 - push * 0.04);
  const el = IDLE.el + deg(6) * (1 - k) + pointer.sy * deg(1.5);
  const az = deg(-12) * (1 - k) + pointer.sx * deg(3.5);
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
  film.material.opacity = 0;
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
const pickables = [computer, ...chains];
function pick() {
  raycaster.setFromCamera(pointer.ndc, camera);
  const hit = raycaster.intersectObjects(pickables, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.pick) o = o.parent;
  if (o && o.userData.pick === 'computer') return computer;
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
  enter(o === computer ? null : o.userData.pick);
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
let time = 0;
function frame() {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);

  pointer.sx = damp(pointer.sx, pointer.inside && mode !== 'zoom' ? pointer.x : 0, 2.5, dt);
  pointer.sy = damp(pointer.sy, pointer.inside && mode !== 'zoom' ? pointer.y : 0, 2.5, dt);

  if (mode === 'intro' || mode === 'idle') {
    if (mode === 'intro') {
      introT += dt;
      film.material.opacity = 1 - easeOut(clamp((introT - 0.7) / 1.3, 0, 1));
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
    push = damp(push, hover === computer ? 1 : 0, 4, dt);
    idlePose(easeOut(clamp(introT / INTRO, 0, 1)));
  } else if (mode === 'zoom') {
    zoom.t = Math.min(1, zoom.t + dt / ZOOM);
    zoomPose(easeInOut(zoom.t));
  }

  time += dt;
  const kr = keyring.userData;
  kr.vz += (-(kr.rz - Math.sin(time * 0.7) * deg(1.2)) * 9 - kr.vz * 1.4) * dt;
  kr.rz += kr.vz * dt;
  keyring.rotation.z = kr.rz;
  chains.forEach((p) => {
    const u = p.userData;
    const on = hover === p && mode !== 'zoom';
    if (on && !u.hovered && time - (u.kick ?? -9) > 1.6) {
      u.kick = time;
      u.vz += 0.5;
      kr.vz += 0.12;
    }
    u.hovered = on;
    const rest = u.tilt + Math.sin(time * 0.9 + u.phase) * deg(1.4);
    u.vz += (-(u.rz - rest) * 16 - u.vz * 1.8) * dt;
    u.rz += u.vz * dt;
    u.vx += (-(u.rx - Math.sin(time * 0.6 + u.phase) * deg(3)) * 10 - u.vx * 1.5) * dt;
    u.rx += u.vx * dt;
    p.rotation.set(u.rx * 0.3, Math.sin(time * 0.45 + u.phase) * 0.25, u.rz);
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
