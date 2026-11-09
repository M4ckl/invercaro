/* Intent page — one 3D scene per frame (Plan, Details, Map, Memories): our iPhone (js/phone3d.js) in front shows the current
   part of the rail (its screen recording of the app when it has one, else the screenshot), a second one stands behind with
   a related screen. On a new part the front phone swings towards the direction of travel and settles back on springs while
   the new screen slides up into place; each time a frame arrives the phones rise
   and turn in. Between changes they breathe slowly and lean towards the cursor. Only the frame on screen renders. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPhone, DISPLAY, ISLAND } from './phone3d.js?v=70';

const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));

/* A spring in Apple's terms: response (s) and damping ratio (1 = no overshoot). */
function spring(response, damping) {
  const k = (2 * Math.PI / response) ** 2;
  const c = (4 * Math.PI * damping) / response;
  return {
    x: 0,
    v: 0,
    step(target, dt) {
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        this.v += (k * (target - this.x) - c * this.v) * h;
        this.x += this.v * h;
      }
      return this.x;
    },
  };
}

const images = new Map();
function loadImage(src) {
  if (!images.has(src)) {
    images.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return images.get(src);
}

/* A recorded clip of the app, ready to draw: muted, inline, looping; resolves once its first frame can be drawn. */
const videos = new Map();
function loadVideo(src) {
  if (!videos.has(src)) {
    videos.set(src, new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.addEventListener('loadeddata', () => resolve(v), { once: true });
      v.addEventListener('error', () => resolve(null), { once: true });
      v.src = src;
    }));
  }
  return videos.get(src);
}
const isVideo = (el) => el instanceof HTMLVideoElement;

function makeScene(frame, reduceMotion) {
  const canvas = frame.querySelector('.ip-canvas');
  const sceneEl = frame.querySelector('.ip-scene');
  const side = frame.classList.contains('ip-frame--flip') ? -1 : 1; // which way the copy is: phones turn towards it
  const parts = Array.from(frame.querySelectorAll('.ip-part'));

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

  /* ---- screens: a canvas per phone, the Dynamic Island painted on top ---- */
  function screen() {
    const paint = document.createElement('canvas');
    paint.width = 900;
    paint.height = Math.round((900 * DISPLAY[1]) / DISPLAY[0]);
    const ctx = paint.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, paint.width, paint.height);
    const texture = new THREE.CanvasTexture(paint);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: texture, roughness: 0.06, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.3, toneMapped: false,
    });
    const island = () => {
      const W = paint.width;
      const H = paint.height;
      const w = ISLAND.w * W;
      const h = ISLAND.h * H;
      ctx.beginPath();
      ctx.roundRect((W - w) / 2, ISLAND.top * H, w, h, h / 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      texture.needsUpdate = true;
    };
    return { paint, ctx, texture, material, island };
  }

  const front = screen();
  const back = screen();
  const frontPhone = buildPhone(front.material);
  const backPhone = buildPhone(back.material);
  frontPhone.rotation.order = backPhone.rotation.order = 'YXZ';
  world.add(backPhone, frontPhone);

  loadImage(sceneEl.dataset.back).then((img) => {
    if (!img) return;
    back.ctx.drawImage(img, 0, 0, back.paint.width, back.paint.height);
    back.island();
  });

  /* Screen change: the new screen slides up a little and fades in over the old one. */
  let shown = null;
  let incoming = null;
  let swapT = 1;
  function drawFront() {
    const { ctx, paint } = front;
    const W = paint.width;
    const H = paint.height;
    const t = easeInOut(clamp(swapT, 0, 1));
    if (shown) ctx.drawImage(shown, 0, 0, W, H);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    if (incoming) {
      ctx.globalAlpha = t;
      ctx.drawImage(incoming, 0, (1 - t) * H * 0.06, W, H);
      ctx.globalAlpha = 1;
    }
    front.island();
  }

  let active = false;
  let raf = 0;

  /* ---- motion ---- */
  const swing = spring(0.9, 0.55);
  const pull = spring(0.8, 0.8);
  let swingKick = 0;
  let partIndex = 0;

  /* A part's recording plays on the screen from its start; without one (or if it fails) the screenshot shows. */
  let request = 0;
  function onPart(e) {
    const { index, dir, screen: src, video } = e.detail;
    partIndex = index;
    const ticket = ++request;
    const media = video ? loadVideo(video).then((v) => v || loadImage(src)) : loadImage(src);
    media.then((el) => {
      if (!el || ticket !== request) return;
      if (incoming) shown = incoming;
      [shown].forEach((old) => { if (isVideo(old) && old !== el) setTimeout(() => old.pause(), 600); });
      incoming = el;
      if (isVideo(el)) {
        el.currentTime = 0;
        if (active) el.play().catch(() => {});
      }
      swapT = reduceMotion ? 1 : 0;
      drawFront();
    });
    if (!reduceMotion && dir) {
      swing.v += dir * 3.2;
      pull.v -= 1.1;
    }
  }
  frame.addEventListener('intentpart', onPart);
  if (parts[0]) onPart({ detail: { index: 0, dir: 0, screen: parts[0].dataset.screen, video: parts[0].dataset.video || null } });

  const POSE = {
    front: { x: 0.12 * side, y: -0.01, z: 0.1, yaw: -16 * side, pitch: -3, roll: -1.5 * side },
    back: { x: -0.3 * side, y: 0.06, z: -0.55, yaw: -8 * side, pitch: -2, roll: 2 * side },
  };

  function layout() {
    const w = sceneEl.clientWidth;
    const h = sceneEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, 1.45 / (2 * Math.tan(deg(camera.fov / 2))));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(layout).observe(sceneEl);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let last = 0;
  let enterT = 0;
  let time = 0;

  function place(phone, p, k, extraYaw, extraZ, phase) {
    const breathe = reduceMotion ? 0 : Math.sin(time * 0.8 + phase) * 0.012;
    phone.position.set(p.x, p.y + breathe - (1 - k) * 1.1, p.z + extraZ);
    phone.rotation.set(deg(p.pitch), deg(p.yaw + extraYaw + (1 - k) * 36 * side), deg(p.roll + (1 - k) * -7 * side));
  }

  function frameLoop(now) {
    raf = requestAnimationFrame(frameLoop);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    enterT += dt;

    pointer.sx = damp(pointer.sx, pointer.x, 2.5, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 2.5, dt);
    world.rotation.y = pointer.sx * deg(6);
    world.rotation.x = pointer.sy * deg(3.5);

    swingKick = swing.step(0, dt);
    const z = pull.step(0, dt);
    const drift = (partIndex % 2 ? 4 : -2) * side;
    const kf = reduceMotion ? 1 : easeOut(clamp(enterT / 1.4, 0, 1));
    const kb = reduceMotion ? 1 : easeOut(clamp((enterT - 0.15) / 1.4, 0, 1));
    place(frontPhone, POSE.front, kf, drift + swingKick * 9, z * 0.08, 0);
    place(backPhone, POSE.back, kb, -swingKick * 2, 0, 1.6);

    if (swapT < 1) {
      swapT = Math.min(1, swapT + dt / 0.55);
      drawFront();
      if (swapT >= 1 && incoming) { shown = incoming; incoming = null; drawFront(); }
    } else if (isVideo(shown) && !shown.paused) {
      drawFront();
    }

    renderer.render(scene, camera);
  }

  function set(on) {
    if (on === active) return;
    active = on;
    if (on) {
      enterT = 0;
      last = 0;
      layout();
      sceneEl.classList.add('is-ready');
      [shown, incoming].forEach((m) => { if (isVideo(m)) m.play().catch(() => {}); });
      raf = requestAnimationFrame(frameLoop);
    } else {
      cancelAnimationFrame(raf);
      [shown, incoming].forEach((m) => { if (isVideo(m)) m.pause(); });
    }
  }

  layout();
  return { frame, set };
}

export async function createIntentScenes(section) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scenes = Array.from(section.querySelectorAll('[data-ip]')).map((frame) => makeScene(frame, reduceMotion));

  /* A frame renders while its stage (or the page under the stages) is current and it is in view. */
  const inView = new Map(scenes.map((s) => [s.frame, true]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => inView.set(e.target, e.isIntersecting));
    sync();
  });
  scenes.forEach((s) => io.observe(s.frame));

  let on = false;
  function sync() {
    scenes.forEach((s) => {
      const holder = s.frame.dataset.state ? s.frame : s.frame.closest('[data-state]');
      s.set(on && (!holder || holder.dataset.state === 'current') && inView.get(s.frame));
    });
  }

  return {
    setActive(next) {
      on = next;
      sync();
    },
  };
}
