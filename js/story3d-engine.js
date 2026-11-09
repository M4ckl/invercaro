/* Mono page 3 — the live story. The view stays pinned while its scroll track passes; scroll position drives everything:
   which chapter and step is shown (text fades in and out, it never scrolls), where the silver 3D iPhone stands, and
   which moment of ONE continuous recording of the app plays on its display — between chapters the real navigation
   plays, so it reads as one app on one screen. Each <li data-from data-to> is a time range in that recording.

   Motion (after Apple's "Designing Fluid Interfaces"): every axis is a critically damped spring chasing a pose that is a
   pure function of scroll — same path forwards and back, interruptible, no velocity jumps. Each chapter has its own
   pose (side, distance, angle); crossing to the other side the phone pulls back, rises a little and leans into the
   direction of travel, then comes forward again. While a chapter is read it drifts slowly closer.

   Model: our own silver iPhone (Pro Max proportions), built from code in buildPhone(): aluminium frame, black front glass,
   the display (planar UVs, unlit emissive screen), side buttons and the camera plateau on the back.
   The Dynamic Island is painted into the screen texture. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DISPLAY = [1320, 2868];
const ISLAND = { w: 125 / 402, h: 37.3 / 874, top: 11 / 874 };
/* Phone size in model units (height 1): 163.4 × 78 × 8.75 mm. */
const PHONE = { w: 78 / 163.4, h: 1, t: 8.75 / 163.4, r: 0.078, rim: 0.008, bezel: 0.017 };
const UNIT = 0.6; // window heights of scrolling per step
/* Settled pose per chapter: x overrides the side from data-side, z is the distance (+ closer), angles in degrees,
   drift/push = how much it turns and comes closer while the chapter is read.
   Quick entry: straight ahead, facing the reader and close; the others turn towards their text. */
const POSES = [
  { x: -0.55, y: 0, z: 0.45, yaw: 0, pitch: 0, roll: 0, drift: 0, push: 0.04 },
  { y: -0.01, z: 0.35, yaw: -24, pitch: -6, roll: -2.5 },
  { y: 0.01, z: -0.25, yaw: 22, pitch: -2, roll: 2 },
  { y: 0, z: 0.15, yaw: -14, pitch: -7, roll: -1.5 },
];
const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/* A spring in Apple's terms: response (s) and damping ratio (1 = no overshoot). */
function spring(response, damping = 1) {
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
  return s;
}

function buildPhone(screenMaterial) {
  const { w: W, h: H, t: T, r: R, rim: B, bezel } = PHONE;
  const phone = new THREE.Group();
  const frame = new THREE.MeshPhysicalMaterial({ color: 0xdfe1e5, metalness: 0.85, roughness: 0.26, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x050506, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, metalness: 0.2, roughness: 0.08, clearcoat: 1 });

  /* Body: one rounded slab, its bevel is the polished rim around the front glass. */
  const depth = T - B * 2;
  const body = new THREE.ExtrudeGeometry(roundedRect(W - B * 2, H - B * 2, R - B), {
    depth, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 6, curveSegments: 24,
  });
  body.translate(0, 0, -depth / 2);
  phone.add(new THREE.Mesh(body, frame));

  const front = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - B * 2 - 0.002, H - B * 2 - 0.002, R - B - 0.001), 24), glass);
  front.position.z = T / 2 + 0.0002;
  phone.add(front);

  /* Display: Pro Max aspect, rounded corners; UVs map the recording across it. */
  const SW = W - bezel * 2;
  const SH = (SW * DISPLAY[1]) / DISPLAY[0];
  const screenGeo = new THREE.ShapeGeometry(roundedRect(SW, SH, R - bezel + 0.004), 24);
  const pos = screenGeo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / SW + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / SH + 0.5;
  }
  screenGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const screen = new THREE.Mesh(screenGeo, screenMaterial);
  screen.position.z = T / 2 + 0.0005;
  screen.renderOrder = 1;
  phone.add(screen);

  /* Side buttons: action + volume on the left, side button + Camera Control on the right. */
  [[-1, 0.3, 0.04], [-1, 0.2, 0.065], [-1, 0.115, 0.065], [1, 0.18, 0.1], [1, -0.12, 0.075]].forEach(([side, y, len]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.008, len, T * 0.42, 2, 0.003), frame);
    b.position.set(side * (W / 2 + 0.0012), y, 0);
    phone.add(b);
  });

  /* Back: the full-width camera plateau with three lenses and the flash. */
  const plateau = new THREE.Mesh(new RoundedBoxGeometry(W - 0.03, 0.2, 0.012, 4, 0.006), frame);
  plateau.position.set(0, H / 2 - 0.13, -T / 2 - 0.002);
  phone.add(plateau);
  [[-0.13, 0.04], [-0.13, -0.045], [-0.055, 0]].forEach(([x, y]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 40), frame);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, plateau.position.y + y, -T / 2 - 0.012);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 40), lensGlass);
    lens.rotation.y = Math.PI;
    lens.position.set(x, plateau.position.y + y, -T / 2 - 0.0181);
    phone.add(ring, lens);
  });
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.4 }));
  flash.rotation.y = Math.PI;
  flash.position.set(0.12, plateau.position.y + 0.04, -T / 2 - 0.0081);
  phone.add(flash);

  return phone;
}

export async function createLiveStory(live) {
  const section = live.closest('.sp-content-section');
  const canvas = live.querySelector('.ap-live-canvas');
  const pin = live.querySelector('.ap-live-pin');
  const scroller = document.getElementById('sp-window-scroll');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- chapters and steps ---- */
  const chapters = Array.from(live.querySelectorAll('.ap-live-ch')).map((el, i) => {
    const steps = Array.from(el.querySelectorAll('li')).map((li) => ({
      li, from: parseFloat(li.dataset.from), to: parseFloat(li.dataset.to),
    }));
    return {
      el,
      steps,
      side: el.dataset.side === 'right' ? 1 : -1,
      pose: POSES[i % POSES.length],
      // The first chapter gets a longer lead-in, so its first step is never skipped on arrival.
      intro: i === 0 ? 1 : 0.5,
      units: steps.length + (i === 0 ? 1.5 : 1),
      state: '',
      active: -2,
    };
  });
  let start = 0;
  chapters.forEach((c) => { c.start = start; start += c.units; });
  const total = start;

  /* ---- the recording: one video, played from memory so seeking works on any server ---- */
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  fetch(live.dataset.video)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then((blob) => { video.src = URL.createObjectURL(blob); })
    .catch(() => { video.src = live.dataset.video; });

  /* ---- renderer (WebGL failure → caller falls back to the regular sections) ---- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 50);
  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  scene.add(pivot);

  /* ---- screen texture: the current video frame + the Dynamic Island. Never cleared between frames, so it can't flash. ---- */
  const scale = Math.min(1, 1600 / DISPLAY[1]);
  const paint = document.createElement('canvas');
  paint.width = Math.round(DISPLAY[0] * scale);
  paint.height = Math.round(DISPLAY[1] * scale);
  const ctx = paint.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, paint.width, paint.height);
  const texture = new THREE.CanvasTexture(paint);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  let screenDirty = true;
  function paintFrame() {
    if (video.readyState < 2 || video.seeking) return;
    const W = paint.width;
    const H = paint.height;
    ctx.drawImage(video, 0, 0, W, H);
    const w = ISLAND.w * W;
    const h = ISLAND.h * H;
    ctx.beginPath();
    ctx.roundRect((W - w) / 2, ISLAND.top * H, w, h, h / 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    texture.needsUpdate = true;
    screenDirty = true;
  }
  video.addEventListener('seeked', paintFrame);
  video.addEventListener('loadeddata', paintFrame);

  /* ---- model: our own iPhone, built here (height 1, screen facing +Z) ---- */
  const screenMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: texture,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.3,
    toneMapped: false,
  });
  pivot.add(buildPhone(screenMaterial));
  const modelReady = true;
  live.classList.add('is-ready');

  /* ---- layout: scroll track height and camera ---- */
  let viewH = 1;
  let halfW = 1;
  function layout() {
    viewH = scroller.clientHeight || window.innerHeight;
    live.style.height = `${Math.round(viewH + total * UNIT * viewH)}px`;
    const w = pin.clientWidth;
    const h = pin.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    screenDirty = true; // a resize clears the canvas
    camera.aspect = w / h;
    const tan = Math.tan(deg(camera.fov / 2));
    camera.position.set(0, 0, 1.3 / (2 * tan)); // settled phone ≈ 77% of the window height
    camera.updateProjectionMatrix();
    halfW = camera.position.z * tan * camera.aspect;
  }
  new ResizeObserver(layout).observe(pin);
  layout();

  /* ---- scroll → chapter, step, recording time and the target pose ---- */
  const settled = (ch, f) => ({
    x: ch.pose.x ?? ch.side,
    y: ch.pose.y,
    z: ch.pose.z + f * (ch.pose.push ?? 0.12),
    yaw: ch.pose.yaw - ch.side * (f - 0.5) * (ch.pose.drift ?? 6),
    pitch: ch.pose.pitch,
    roll: ch.pose.roll,
  });

  function readScroll() {
    const range = Math.max(1, live.offsetHeight - viewH);
    const y = scroller.getBoundingClientRect().top - live.getBoundingClientRect().top;
    const g = clamp(y / range, 0, 1) * total;
    let i = chapters.findIndex((c) => g < c.start + c.units);
    if (i < 0) i = chapters.length - 1;
    const c = chapters[i];
    const u = clamp(g - c.start, 0, c.units);
    const n = c.steps.length;
    const prev = chapters[i - 1];
    const next = chapters[i + 1];

    // Step and recording time. Between chapters the recording keeps playing: the real navigation in the app.
    let step = -1;
    let time;
    const lead = c.intro;
    if (u < lead) {
      time = prev
        ? lerp(prev.steps[prev.steps.length - 1].to, c.steps[0].from, 0.5 + u)
        : lerp(Math.max(0, c.steps[0].from - 1.5), c.steps[0].from, u / lead);
    } else if (u > lead + n) {
      step = n - 1;
      time = next ? lerp(c.steps[n - 1].to, next.steps[0].from, u - (lead + n)) : c.steps[n - 1].to;
    } else {
      step = Math.min(n - 1, Math.floor(u - lead));
      const s = c.steps[step];
      time = lerp(s.from, s.to, clamp(u - lead - step, 0, 1));
    }

    // Pose: settled on the chapter's side; crossing (last half unit → next chapter's first half) follows an arc.
    let from = null;
    let to = null;
    let s = 0;
    if (u < 0.5 && prev) { from = settled(prev, 1); to = settled(c, 0); s = 0.5 + u; }
    else if (u > c.units - 0.5 && next) { from = settled(c, 1); to = settled(next, 0); s = u - (c.units - 0.5); }
    let pose;
    if (from) {
      const e = smooth(s);
      const arc = Math.sin(Math.PI * s);
      const dir = Math.sign(to.x - from.x) || 1;
      pose = {
        x: lerp(from.x, to.x, e),
        y: lerp(from.y, to.y, e) + 0.035 * arc,
        z: lerp(from.z, to.z, e) - 0.75 * arc,
        yaw: lerp(from.yaw, to.yaw, e) + dir * 34 * arc,
        pitch: lerp(from.pitch, to.pitch, e) - 4 * arc,
        roll: lerp(from.roll, to.roll, e) - dir * 6 * arc,
      };
    } else {
      pose = settled(c, clamp((u - lead) / n, 0, 1));
    }
    return { i, step, time, u, pose };
  }

  function applyText(cur) {
    // The text waits until the phone has (nearly) reached its side, and leaves as the phone sets off again.
    const units = chapters[cur.i].units;
    const enter = cur.i === 0 ? 0.15 : 0.35;
    const showing = cur.u >= enter && cur.u <= units - 0.35;
    const here = showing ? 'is-current' : cur.u < enter ? 'is-future' : 'is-past';
    chapters.forEach((c, i) => {
      const state = i === cur.i ? here : i < cur.i ? 'is-past' : 'is-future';
      if (c.state !== state) {
        c.el.classList.remove('is-current', 'is-past', 'is-future');
        c.el.classList.add(state);
        c.state = state;
      }
      const active = i === cur.i && showing ? cur.step : -2;
      if (c.active !== active) {
        c.steps.forEach((st, k) => {
          st.li.classList.toggle('is-on', active >= 0 && k <= active);
          st.li.classList.toggle('is-active', k === active);
        });
        c.active = active;
      }
    });
  }

  /* ---- springs: position/depth critically damped, rotation with a touch of give; the video time eases too ---- */
  const S = {
    x: spring(0.55), y: spring(0.55), z: spring(0.6),
    yaw: spring(0.5, 0.85), pitch: spring(0.5, 0.85), roll: spring(0.5, 0.85),
    time: spring(0.3),
  };
  let first = true;
  let drawnModel = false;
  let active = false;
  let raf = 0;
  let last = performance.now();

  function frame(now) {
    raf = 0;
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const cur = readScroll();
    applyText(cur);

    if (first || reduceMotion) {
      // Start (and reduced motion) at the exact pose: no spring wind-up.
      S.x.x = cur.pose.x; S.y.x = cur.pose.y; S.z.x = cur.pose.z;
      S.yaw.x = cur.pose.yaw; S.pitch.x = cur.pose.pitch; S.roll.x = cur.pose.roll;
      S.time.x = cur.time;
      first = false;
    }
    const x = S.x.step(cur.pose.x, dt);
    const y = S.y.step(cur.pose.y, dt);
    const z = S.z.step(cur.pose.z, dt);
    const yaw = S.yaw.step(cur.pose.yaw, dt);
    const pitch = S.pitch.step(cur.pose.pitch, dt);
    const roll = S.roll.step(cur.pose.roll, dt);
    const t = S.time.step(cur.time, dt);

    // Video: follow the eased time; one seek at a time, painted when it lands.
    if (video.readyState >= 1 && !video.seeking) {
      const want = clamp(t, 0, (video.duration || t + 1) - 0.05);
      if (Math.abs(video.currentTime - want) > 1 / 40) video.currentTime = want;
    }

    pivot.position.set(x * halfW * 0.46, y, z);
    pivot.rotation.set(deg(pitch), deg(yaw), deg(roll));
    // Draw only when something moved or the screen changed.
    const moving = Object.values(S).some((sp) => Math.abs(sp.v) > 1e-4);
    if (modelReady && (moving || screenDirty || modelReady !== drawnModel)) {
      renderer.render(scene, camera);
      screenDirty = false;
      drawnModel = modelReady;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    setActive(on) {
      active = on;
      if (on && !raf) {
        layout();
        screenDirty = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
  };
}
