/* Sileo page 2 — the design frame: two of our iPhones (js/phone3d.js) showing the Sileo designs, with the 3D Sileo icon floating
   beside them. Each time the page arrives the phones rise and turn in one after the other and the icon pops in; then everything
   breathes slowly and leans a little towards the cursor. Rendering runs only while the page is on screen. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPhone, DISPLAY, ISLAND } from './phone3d.js?v=70';

const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const damp = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));

/* Resting pose of each phone (model units: phone height 1); `delay` staggers the entrance. */
const PHONES = [
  { key: 'dark', x: -0.34, y: 0.07, z: -0.5, yaw: 20, pitch: -2, roll: 3, delay: 0.12, phase: 1.4 },
  { key: 'light', x: 0.2, y: -0.03, z: 0.1, yaw: -15, pitch: -3, roll: -2, delay: 0, phase: 0 },
];
const ICON = { x: -0.42, y: -0.34, z: 0.42, size: 0.24, delay: 0.45 };

export async function createSileoScene(el) {
  const canvas = el.querySelector('.ap-sileo-canvas');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 50);
  const world = new THREE.Group();
  scene.add(world);

  /* ---- a screen texture from a design image, with the Dynamic Island painted on ---- */
  function screenMaterial(src) {
    const paint = document.createElement('canvas');
    paint.width = 1000;
    paint.height = Math.round((1000 * DISPLAY[1]) / DISPLAY[0]);
    const ctx = paint.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, paint.width, paint.height);
    const texture = new THREE.CanvasTexture(paint);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const img = new Image();
    img.onload = () => {
      const W = paint.width;
      const H = paint.height;
      ctx.drawImage(img, 0, 0, W, H);
      const w = ISLAND.w * W;
      const h = ISLAND.h * H;
      ctx.beginPath();
      ctx.roundRect((W - w) / 2, ISLAND.top * H, w, h, h / 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      texture.needsUpdate = true;
      dirty = true;
    };
    img.src = src;
    return new THREE.MeshPhysicalMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: texture, roughness: 0.06, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.3, toneMapped: false,
    });
  }

  const phones = PHONES.map((p) => {
    const phone = buildPhone(screenMaterial(el.dataset[p.key]));
    phone.rotation.order = 'YXZ';
    world.add(phone);
    return { ...p, phone };
  });

  /* ---- the 3D Sileo icon (native materials, swapped with the theme) ---- */
  const iconHolder = new THREE.Group();
  iconHolder.position.set(ICON.x, ICON.y, ICON.z);
  world.add(iconHolder);
  const loader = new GLTFLoader();
  let iconTheme = null;
  function loadIcon() {
    const t = theme();
    if (t === iconTheme) return;
    iconTheme = t;
    loader.load(`style/3d%20models/sileo/icon_sileo_3d_${t}.glb`, (gltf) => {
      if (iconTheme !== t) return;
      iconHolder.clear();
      gltf.scene.scale.setScalar(ICON.size / 0.1445);
      iconHolder.add(gltf.scene);
      dirty = true;
    });
  }
  loadIcon();
  document.addEventListener('themechange', loadIcon);

  /* ---- layout ---- */
  function layout() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, 1.5 / (2 * Math.tan(deg(camera.fov / 2))));
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(layout).observe(el);

  /* ---- pointer lean ---- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---- loop ---- */
  let active = false;
  let raf = 0;
  let dirty = true;
  let enterT = 0;
  let time = 0;
  let last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    enterT += dt;

    pointer.sx = damp(pointer.sx, pointer.x, 2.5, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 2.5, dt);
    world.rotation.y = pointer.sx * deg(7);
    world.rotation.x = pointer.sy * deg(4);

    phones.forEach((p) => {
      const k = reduceMotion ? 1 : easeOut(clamp((enterT - p.delay) / 1.5, 0, 1));
      const breathe = reduceMotion ? 0 : Math.sin(time * 0.8 + p.phase) * 0.014;
      p.phone.position.set(p.x, p.y + breathe - (1 - k) * 1.1, p.z);
      p.phone.rotation.set(deg(p.pitch), deg(p.yaw + (1 - k) * 38), deg(p.roll + (1 - k) * -8));
    });

    const ki = reduceMotion ? 1 : easeBack(clamp((enterT - ICON.delay) / 0.9, 0, 1));
    iconHolder.scale.setScalar(Math.max(0.0001, ki));
    iconHolder.position.y = ICON.y + (reduceMotion ? 0 : Math.sin(time * 1.1) * 0.025);
    iconHolder.rotation.set(deg(6) + Math.sin(time * 0.7) * deg(5), deg(18) + Math.sin(time * 0.5) * deg(16), deg(-6));

    renderer.render(scene, camera);
    dirty = false;
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) {
      enterT = 0;
      last = 0;
      layout();
      el.classList.add('is-ready');
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  }

  layout();
  return { setActive };
}
