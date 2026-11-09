/* Desk intro: an iMac standing in a grey stucco studio under hard side light, with the app charms hanging on wall hooks. The live home page is mapped onto the display and a click flies the camera into it. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

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

/* ---- palette ---- */
const THEME = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
const PAL = {
  light: {
    bg: '#5a5a5a', stucco: 0x9a9a9a, alu: 0xc6c7c9, bezel: 0x0b0b0c, metal: 0xd4d7db, hook: 0x8c8a86,
    sun: 4.2, hemi: 0.16, env: 0.3, exposure: 1.0,
  },
  dark: {
    bg: '#161618', stucco: 0x4a4a4c, alu: 0x47494d, bezel: 0x070708, metal: 0xa4a7ad, hook: 0x5e5c58,
    sun: 2.6, hemi: 0.08, env: 0.2, exposure: 1.0,
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
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
/* Studio HDRI "Studio Small 09" by Poly Haven (CC0) for real-world reflections on the aluminium and glass. */
new RGBELoader().load('style/hdr/studio_small_09_1k.hdr', (hdr) => {
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
});

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.01, 30);

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

/* ---- room: swirled stucco wall and floor ---- */
const WALL_Z = -0.32;
const texLoader = new THREE.TextureLoader();
function stucco(repeatX, repeatY) {
  const load = (kind, srgb) => {
    const t = texLoader.load(`style/textures/stucco_${kind}_1k.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return mat(PAL.stucco, { map: load('diff', true), normalMap: load('nor'), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.93 });
}
const wall = mesh(new THREE.PlaneGeometry(6, 3), stucco(11, 5.5), { cast: false });
wall.position.set(0, 1.5, WALL_Z);
scene.add(wall);
const floor = mesh(new THREE.PlaneGeometry(6, 4), stucco(11, 7.3), { cast: false });
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, WALL_Z + 2);
scene.add(floor);

/* ---- light: hard sun from the right, grazing the wall; an unseen overhang shades its upper left ---- */
scene.add(new THREE.HemisphereLight(0xffffff, 0x6e6e6e, PAL.hemi));
const SUN_DIR = new THREE.Vector3(1, 0.55, 0.6).normalize();
const sun = new THREE.DirectionalLight(0xfffaf2, PAL.sun);
sun.target.position.set(0, 0.3, -0.1);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.5, far: 8 });
sun.shadow.bias = -0.0004;
sun.shadow.radius = 9;
sun.shadow.blurSamples = 20;
scene.add(sun, sun.target);

const overhang = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
overhang.rotation.y = Math.PI / 2;
overhang.position.set(0.95, 1.18 + 2, 0.5);
overhang.castShadow = true;
scene.add(overhang);

/* ---- iMac ---- */
const IMAC = { w: 0.547, h: 0.42, t: 0.0115, dw: 0.515, dh: 0.322, topBezel: 0.014, lift: 0.085, tilt: deg(-4), z: 0 };
const computer = new THREE.Group();
computer.userData.pick = 'computer';
computer.position.z = IMAC.z;
scene.add(computer);

/* Bead-blasted aluminium: soft satin sheen, no mirror reflections. */
const alu = phys(PAL.alu, {
  metalness: 0.55, roughness: 0.42, envMapIntensity: 1.1, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff),
});

const panel = new THREE.Group();
panel.position.y = IMAC.lift;
panel.rotation.x = IMAC.tilt;
computer.add(panel);

const bevel = 0.0018;
const shellGeo = new THREE.ExtrudeGeometry(rectShape(IMAC.w - bevel * 2, IMAC.h - bevel * 2, 0.011), {
  depth: IMAC.t - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 12,
});
shellGeo.translate(0, IMAC.h / 2, -IMAC.t / 2 + bevel);
panel.add(mesh(shellGeo, alu));

/* Front glass: black borders, a faint gloss; the chin below it stays aluminium. */
const chin = IMAC.h - IMAC.topBezel * 2 - IMAC.dh;
const glassH = IMAC.h - chin;
const glass = mesh(plate(IMAC.w - 0.0024, glassH - 0.0012, 0.0105, 0), phys(PAL.bezel, {
  metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.7,
}), { cast: false });
glass.position.set(0, chin + glassH / 2, IMAC.t / 2 + 0.0002);
panel.add(glass);
const seam = new THREE.Mesh(new THREE.PlaneGeometry(IMAC.w - 0.003, 0.0006), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
seam.position.set(0, chin, IMAC.t / 2 + 0.0003);
panel.add(seam);

const cam = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 20), new THREE.MeshBasicMaterial({ color: 0x1c1c1f }));
cam.position.set(0, IMAC.h - IMAC.topBezel / 2, IMAC.t / 2 + 0.0004);
panel.add(cam);

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

/* Stand: one bent aluminium sheet. A flat foot on the floor curls up at the back into an arm that leans forward
   and meets the back of the display, like the real thing. Built as a side profile (z, y) extruded across the width. */
(function stand() {
  const W = 0.15, T = 0.0065, R = 0.026, LEAN = deg(19);
  const hingeH = 0.17;
  const hinge = { z: -IMAC.t / 2 - hingeH * Math.sin(-IMAC.tilt) - T / 2, y: IMAC.lift + hingeH * Math.cos(IMAC.tilt) };
  const endY = T / 2 + R + R * Math.sin(LEAN);
  const L = (hinge.y - endY) / Math.cos(LEAN);
  const zb = hinge.z - L * Math.sin(LEAN) + R * Math.cos(LEAN);
  const footFront = 0.07;

  const line = [[footFront, T / 2]];
  for (let i = 0; i <= 24; i++) {
    const phi = -Math.PI / 2 - (i / 24) * (Math.PI / 2 + LEAN);
    line.push([zb + R * Math.cos(phi), T / 2 + R + R * Math.sin(phi)]);
  }
  line.push([hinge.z, hinge.y]);

  const normals = line.map((p, i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const hz = b[0] - a[0], hy = b[1] - a[1], l = Math.hypot(hz, hy);
    return [-hy / l, hz / l];
  });
  const s = new THREE.Shape();
  line.forEach((p, i) => {
    const q = [p[0] + normals[i][0] * T / 2, p[1] + normals[i][1] * T / 2];
    if (i === 0) s.moveTo(q[0], q[1]); else s.lineTo(q[0], q[1]);
  });
  for (let i = line.length - 1; i >= 0; i--) s.lineTo(line[i][0] - normals[i][0] * T / 2, line[i][1] - normals[i][1] * T / 2);
  s.closePath();

  const e = 0.0012;
  const geo = new THREE.ExtrudeGeometry(s, { depth: W - e * 2, bevelEnabled: true, bevelThickness: e, bevelSize: e * 0.8, bevelSegments: 3, curveSegments: 4 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(W / 2 - e, 0, 0);
  computer.add(mesh(geo, alu));
})();

/* ---- keychains: each app charm on its own split ring, on its own wall hook, in a row top-right ---- */
const CHARMS = [
  { app: 'sileo', name: 'Sileo', x: 0.4, phase: 0.0 },
  { app: 'mono', name: 'Mono', x: 0.52, phase: 2.1 },
  { app: 'intent', name: 'Intent', x: 0.64, phase: 4.0 },
];
const HOOK_Y = 0.6;
const CHARM = 0.058;
const CHARM_REACH = (CHARM / 2) * Math.SQRT2 - 0.004;
const RING_R = 0.014;
const metal = mat(PAL.metal, { metalness: 1, roughness: 0.2 });
const steel = mat(PAL.hook, { metalness: 1, roughness: 0.35 });
const chains = [];
const rings = [];

function splitRing(r) {
  const pts = [];
  const turns = 1.9;
  for (let i = 0; i <= 140; i++) {
    const a = (i / 140) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, (i / 140) * 0.0022));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.001, 10, false);
}
const ringGeo = splitRing(RING_R);
const roseGeo = new THREE.CylinderGeometry(0.008, 0.009, 0.004, 32);
const pegGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0.003), new THREE.Vector3(0, -0.001, 0.018), new THREE.Vector3(0, 0.002, 0.027), new THREE.Vector3(0, 0.008, 0.03),
]), 32, 0.0022, 12, false);
const tipGeo = new THREE.SphereGeometry(0.0024, 16, 12);
const jumpGeo = new THREE.TorusGeometry(0.0036, 0.0008, 8, 24);

const loader = new GLTFLoader();
CHARMS.forEach((k) => {
  const hook = new THREE.Group();
  hook.position.set(k.x, HOOK_Y, WALL_Z);
  scene.add(hook);
  const rose = mesh(roseGeo, steel);
  rose.rotation.x = Math.PI / 2;
  rose.position.z = 0.002;
  hook.add(rose, mesh(pegGeo, steel));
  const tip = mesh(tipGeo, steel);
  tip.position.set(0, 0.008, 0.03);
  hook.add(tip);

  /* The ring rests on the peg and swings; the charm hangs from its lowest point and sways on its own. */
  const keyring = new THREE.Group();
  keyring.position.set(0, -0.0011, 0.023);
  keyring.userData = { rz: 0, vz: 0, phase: k.phase };
  hook.add(keyring);
  rings.push(keyring);
  const ring = mesh(ringGeo, metal);
  ring.position.y = -RING_R;
  ring.rotation.y = 0.9;
  keyring.add(ring);

  const pivot = new THREE.Group();
  pivot.position.set(0, -RING_R * 2 + 0.001, 0.002);
  pivot.userData = { pick: k.app, name: k.name, phase: k.phase, ring: keyring, rz: 0, vz: 0, rx: 0, vx: 0, hovered: false };
  keyring.add(pivot);
  chains.push(pivot);

  const jump = mesh(jumpGeo, metal);
  jump.position.y = -0.0031;
  jump.rotation.y = Math.PI / 2;
  pivot.add(jump);

  const holder = new THREE.Group();
  holder.position.y = -0.006 - CHARM_REACH;
  pivot.add(holder);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.085, 0.02), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.008;
  holder.add(hit);

  loader.load(`style/3d%20models/${k.app}/icon_${k.app}_3d_${THEME}.glb`, (gltf) => {
    const charm = gltf.scene;
    charm.scale.setScalar(CHARM / 0.1445);
    charm.rotation.z = Math.PI / 4;
    charm.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = PAL.env;
    });
    holder.add(charm);
  });
});

/* ---- page mapping ---- */
/* The page fits inside the display and sits against its top edge (menu bar under the bezel); any spare height is at the bottom. */
function quadSize() {
  const a = window.innerWidth / window.innerHeight;
  const q = a > IMAC.dw / IMAC.dh ? { qw: IMAC.dw, qh: IMAC.dw / a } : { qw: IMAC.dh * a, qh: IMAC.dh };
  q.oy = (IMAC.dh - q.qh) / 2;
  return q;
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
  const { qw, qh, oy } = quadSize();
  anchor.getWorldPosition(_c);
  _n.set(0, 0, 1).transformDirection(anchor.matrixWorld);
  const facing = _n.dot(_v.copy(camera.position).sub(_c)) > 0.002;
  page.style.visibility = facing ? '' : 'hidden';
  if (!facing) return;
  const pts = [];
  [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
    _v.set((sx * qw) / 2, (sy * qh) / 2 + oy, 0).applyMatrix4(anchor.matrixWorld).project(camera);
    pts.push(((_v.x + 1) / 2) * W, ((1 - _v.y) / 2) * H);
  });
  page.style.transform = homography(W, H, pts);
}

/* ---- camera: straight on, at display height ---- */
const IDLE = { target: new THREE.Vector3(0, 0.3, -0.02), dist: 1.42, el: deg(3) };
const pointer = { x: 0, y: 0, sx: 0, sy: 0, ndc: new THREE.Vector2(), inside: false };
const camTarget = new THREE.Vector3();
let push = 0;

function idlePose(k) {
  const dist = IDLE.dist * (1 + 0.22 * (1 - k)) * (1 - push * 0.035);
  const el = IDLE.el + deg(4) * (1 - k) + pointer.sy * deg(1.2);
  const az = deg(-8) * (1 - k) + pointer.sx * deg(2.5);
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
  const q = quadSize();
  _c.set(0, q.oy, 0).applyMatrix4(anchor.matrixWorld);
  _n.set(0, 0, 1).transformDirection(anchor.matrixWorld);
  _up.set(0, 1, 0).transformDirection(anchor.matrixWorld);
  const d1 = q.qh / 2 / Math.tan(deg(camera.fov / 2));
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

/* Inside the screen: the scene stops and hides, but stays ready to fly back out (back()). */
function finish() {
  mode = 'done';
  cancelAnimationFrame(raf);
  page.style.transform = '';
  page.style.visibility = '';
  root.classList.remove('desk-on');
  root.classList.add('desk-done');
  if (zoom.app) {
    const btn = document.querySelector(`.dock-app[data-app="${zoom.app}"]`);
    if (btn) setTimeout(() => btn.click(), 120);
  }
  document.dispatchEvent(new CustomEvent('deskdone'));
}

/* From the page back out to the desk: the same flight, reversed. It starts exactly at the page (identity), so there is no jump. */
function back() {
  if (mode !== 'done') return;
  pointer.inside = false;
  pointer.sx = pointer.sy = 0;
  push = 0;
  hover = null;
  idlePose(1);
  zoom.from = { target: camTarget.clone(), q: camera.quaternion.clone(), dist: camera.position.distanceTo(camTarget) };
  zoom.app = null;
  zoom.t = 1;
  mode = 'unzoom';
  film.material.opacity = 0;
  veil.classList.add('is-gone');
  root.classList.remove('desk-done');
  root.classList.add('desk-on');
  clock.getDelta();
  frame();
}
window.invercaroDesk = { back };

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
  if (mode === 'done') return;
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
  time += dt;

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
  } else if (mode === 'unzoom') {
    zoom.t = Math.max(0, zoom.t - dt / ZOOM);
    zoomPose(easeInOut(zoom.t));
    if (zoom.t <= 0) {
      mode = 'idle';
      introT = INTRO;
      hint.classList.add('is-shown');
    }
  }

  rings.forEach((r) => {
    const u = r.userData;
    u.vz += (-(u.rz - Math.sin(time * 0.7 + u.phase) * deg(1)) * 9 - u.vz * 1.4) * dt;
    u.rz += u.vz * dt;
    r.rotation.z = u.rz;
  });
  chains.forEach((p) => {
    const u = p.userData;
    const on = hover === p && mode !== 'zoom';
    if (on && !u.hovered && time - (u.kick ?? -9) > 1.6) {
      u.kick = time;
      u.vz += 0.5;
      u.ring.userData.vz += 0.15;
    }
    u.hovered = on;
    const rest = Math.sin(time * 0.9 + u.phase) * deg(1.4);
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

if (window.__deskBack) {
  mode = 'done';
  THREE.DefaultLoadingManager.onLoad = () => { THREE.DefaultLoadingManager.onLoad = () => {}; back(); };
  setTimeout(back, 2500);
} else {
  idlePose(0);
  frame();
}
